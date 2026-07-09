"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "./prisma";
import { getSession, requireUser } from "./session";
import { canResubmit, canReview, canSubmit, canWithdraw } from "./dal";
import { STATUS, ROLE } from "./constants";

export type ActionState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ---------- 登入 / 登出 ----------

export async function login(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return { error: "請輸入帳號與密碼" };
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) {
    return { error: "帳號或密碼錯誤" };
  }

  const session = await getSession();
  session.userId = user.id;
  await session.save();
  redirect("/");
}

export async function logout() {
  const session = await getSession();
  session.destroy();
  redirect("/login");
}

// ---------- 案件欄位驗證 ----------

type CaseData = {
  plateName: string;
  orderNo: string;
  categoryId: string;
  categoryNo: string;
  carModel: string;
  description: string;
  subsidyDeptCourse: number;
  goldMedal: number;
  silverMedal: number;
  discountTotal: number;
  specialSubsidy: number;
};

function parseAmount(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").trim();
  if (s === "") return null;
  if (!/^\d+$/.test(s)) return NaN; // 僅允許非負整數
  return Number(s);
}

function validateCase(formData: FormData): {
  data?: CaseData;
  fieldErrors: Record<string, string>;
} {
  const fieldErrors: Record<string, string> = {};

  const plateName = String(formData.get("plateName") ?? "").trim();
  const orderNo = String(formData.get("orderNo") ?? "").trim().toUpperCase();
  const categoryId = String(formData.get("categoryId") ?? "").trim();
  const categoryNo = String(formData.get("categoryNo") ?? "").trim();
  const carModel = String(formData.get("carModel") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!plateName) fieldErrors.plateName = "必填";
  if (!orderNo) fieldErrors.orderNo = "必填";
  else if (!/^D.{12}$/.test(orderNo))
    fieldErrors.orderNo = "須為 13 碼、第一碼為 D";
  if (!categoryId) fieldErrors.categoryId = "必填";
  if (!categoryNo) fieldErrors.categoryNo = "必填";
  if (!carModel) fieldErrors.carModel = "必填";
  if (!description) fieldErrors.description = "必填";

  const amounts: Record<keyof Pick<CaseData,
    "subsidyDeptCourse" | "goldMedal" | "silverMedal" | "discountTotal" | "specialSubsidy">, number> =
    {} as never;
  const amountFields = [
    "subsidyDeptCourse",
    "goldMedal",
    "silverMedal",
    "discountTotal",
    "specialSubsidy",
  ] as const;
  for (const f of amountFields) {
    const n = parseAmount(formData.get(f));
    if (n === null) fieldErrors[f] = "必填";
    else if (Number.isNaN(n)) fieldErrors[f] = "請填非負整數";
    else amounts[f] = n;
  }

  // 金額防呆：特案支援金額 > 0 時，(所課支援金 + 金牌 + 銀牌) 必須 > 0
  if (
    amounts.specialSubsidy > 0 &&
    amounts.subsidyDeptCourse + amounts.goldMedal + amounts.silverMedal <= 0
  ) {
    fieldErrors.specialSubsidy =
      "特案支援金額 > 0 時，所課支援金＋金牌＋銀牌 必須大於 0";
  }

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  return {
    data: {
      plateName,
      orderNo,
      categoryId,
      categoryNo,
      carModel,
      description,
      ...amounts,
    },
    fieldErrors,
  };
}

// ---------- 送單 ----------

export async function createCase(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  if (!canSubmit(user)) return { error: "您沒有送單權限" };

  const month = currentMonth();
  const window = await prisma.monthWindow.findUnique({ where: { month } });
  if (window && !window.isOpen) {
    return { error: `本月（${month}）已關閉，暫不開放送單` };
  }

  const { data, fieldErrors } = validateCase(formData);
  if (!data) return { fieldErrors };

  let newId: string;
  try {
    const created = await prisma.case.create({
      data: {
        ...data,
        month,
        storeCode: user.storeCode,
        deptCode: user.deptCode ?? "",
        status: STATUS.PENDING_SUOZHANG,
        submittedById: user.id,
        logs: {
          create: { step: "SUBMIT", action: "SUBMIT", reviewerId: user.id },
        },
      },
    });
    newId = created.id;
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return { fieldErrors: { orderNo: "此訂單編號已存在（全系統唯一）" } };
    }
    throw e;
  }

  redirect(`/cases/${newId}`);
}

// ---------- 修改後重送 ----------

export async function updateCase(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  const caseId = String(formData.get("caseId") ?? "");
  const existing = await prisma.case.findUnique({ where: { id: caseId } });
  if (!existing) return { error: "找不到案件" };
  if (!canResubmit(user, existing)) return { error: "此案件無法重送" };

  const { data, fieldErrors } = validateCase(formData);
  if (!data) return { fieldErrors };

  try {
    await prisma.$transaction([
      prisma.case.update({
        where: { id: caseId },
        data: {
          ...data,
          status: STATUS.PENDING_SUOZHANG,
          stepEnteredAt: new Date(),
        },
      }),
      prisma.approvalLog.create({
        data: {
          caseId,
          step: "RESUBMIT",
          action: "RESUBMIT",
          reviewerId: user.id,
        },
      }),
    ]);
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return { fieldErrors: { orderNo: "此訂單編號已存在（全系統唯一）" } };
    }
    throw e;
  }

  redirect(`/cases/${caseId}`);
}

// ---------- 審核（核准 / 駁回） ----------

export async function reviewCase(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  const caseId = String(formData.get("caseId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const comment = String(formData.get("comment") ?? "").trim();

  const c = await prisma.case.findUnique({ where: { id: caseId } });
  if (!c) return { error: "找不到案件" };
  if (!canReview(user, c)) return { error: "您無權審核此案件" };
  if (decision !== "APPROVE" && decision !== "REJECT")
    return { error: "動作無效" };
  if (decision === "REJECT" && !comment)
    return { fieldErrors: { comment: "駁回必須填寫原因" } };

  let nextStatus: string;
  if (decision === "REJECT") {
    nextStatus = STATUS.REJECTED;
  } else if (c.status === STATUS.PENDING_SUOZHANG) {
    nextStatus = STATUS.PENDING_BUZHUGUAN;
  } else {
    nextStatus = STATUS.APPROVED;
  }

  const step = user.role === ROLE.SUOZHANG ? "SUOZHANG" : "BUZHUGUAN";

  await prisma.$transaction([
    prisma.case.update({
      where: { id: caseId },
      data: {
        status: nextStatus,
        stepEnteredAt:
          nextStatus === STATUS.PENDING_BUZHUGUAN ? new Date() : c.stepEnteredAt,
      },
    }),
    prisma.approvalLog.create({
      data: {
        caseId,
        step,
        action: decision,
        reviewerId: user.id,
        comment: comment || null,
      },
    }),
  ]);

  revalidatePath(`/cases/${caseId}`);
  redirect(`/cases/${caseId}`);
}

// ---------- 撤回 ----------

export async function withdrawCase(formData: FormData) {
  const user = await requireUser();
  const caseId = String(formData.get("caseId") ?? "");
  const c = await prisma.case.findUnique({ where: { id: caseId } });
  if (!c) redirect("/");
  if (!canWithdraw(user, c!)) return;

  await prisma.$transaction([
    prisma.case.update({
      where: { id: caseId },
      data: { status: STATUS.WITHDRAWN },
    }),
    prisma.approvalLog.create({
      data: { caseId, step: "WITHDRAW", action: "WITHDRAW", reviewerId: user.id },
    }),
  ]);

  redirect(`/cases/${caseId}`);
}

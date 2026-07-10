"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "./prisma";
import { getSession, requireUser } from "./session";
import {
  canResubmit,
  canReview,
  canSubmit,
  canWithdraw,
  canDelete,
  getDeptCodesForStore,
} from "./dal";
import { STATUS, ROLE, ACTION } from "./constants";
import { normalizeDeptCode } from "./format";

export type ActionState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  ok?: boolean;
  caseId?: string;
  message?: string;
  // 送出失敗時，把使用者原本填的內容一併帶回，前端才能保留資料不清空
  values?: Record<string, string>;
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
  carModel: string;
  description: string;
  deptCode: string;
  subsidyDeptCourse: number;
  goldMedal: number;
  silverMedal: number;
  discountTotal: number;
  specialSubsidy: number;
};

// 類別編號自動產生：類別名稱前兩字 + 該課（storeCode+deptCode）該類別
// 目前案件數（不含草稿）+1。所長代送的案件也計入該課的統計。
async function generateCategoryNo(
  categoryId: string,
  storeCode: string,
  deptCode: string
): Promise<string> {
  const [category, count] = await Promise.all([
    prisma.caseCategory.findUnique({ where: { id: categoryId } }),
    prisma.case.count({
      where: { storeCode, deptCode, categoryId, status: { not: STATUS.DRAFT } },
    }),
  ]);
  const abbr = (category?.name ?? "").slice(0, 2) || "特案";
  return `${abbr}${count + 1}`;
}

// 送出失敗時，把使用者填的原始欄位值（字串）擷取出來回傳給前端，
// 讓表單重新顯示時不會清空、可直接在原欄位上修正
const CASE_FORM_FIELDS = [
  "plateName",
  "orderNo",
  "categoryId",
  "carModel",
  "description",
  "deptCode",
  "subsidyDeptCourse",
  "goldMedal",
  "silverMedal",
  "discountTotal",
  "specialSubsidy",
] as const;

function extractRawValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const f of CASE_FORM_FIELDS) {
    values[f] = String(formData.get(f) ?? "");
  }
  return values;
}

function parseAmount(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").trim();
  if (s === "") return null;
  if (!/^\d+$/.test(s)) return NaN; // 僅允許非負整數
  return Number(s);
}

// requireDeptCode: 所長沒有固定課別，需在表單中選擇（必填，下拉選單）
// validDeptCodes: 該所目前有效課別代碼，用於防止表單被竄改送出不存在的課別
function validateCase(
  formData: FormData,
  opts: {
    requireDeptCode: boolean;
    fixedDeptCode: string;
    validDeptCodes?: string[];
  }
): {
  data?: CaseData;
  fieldErrors: Record<string, string>;
} {
  const fieldErrors: Record<string, string> = {};

  const plateName = String(formData.get("plateName") ?? "").trim();
  const orderNo = String(formData.get("orderNo") ?? "").trim().toUpperCase();
  const categoryId = String(formData.get("categoryId") ?? "").trim();
  const carModel = String(formData.get("carModel") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!plateName) fieldErrors.plateName = "必填";
  if (!orderNo) fieldErrors.orderNo = "必填";
  else if (!/^D.{12}$/.test(orderNo))
    fieldErrors.orderNo = "須為 13 碼、第一碼為 D";
  if (!categoryId) fieldErrors.categoryId = "必填";
  if (!carModel) fieldErrors.carModel = "必填";
  if (!description) fieldErrors.description = "必填";

  let deptCode = opts.fixedDeptCode;
  if (opts.requireDeptCode) {
    const raw = normalizeDeptCode(String(formData.get("deptCode") ?? "").trim());
    if (!/^\d+$/.test(raw)) {
      fieldErrors.deptCode = "請選擇課別";
    } else if (
      opts.validDeptCodes &&
      opts.validDeptCodes.length > 0 &&
      !opts.validDeptCodes.includes(raw)
    ) {
      fieldErrors.deptCode = "課別選項無效，請重新選擇";
    } else {
      deptCode = raw;
    }
  }

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
      carModel,
      description,
      deptCode,
      ...amounts,
    },
    fieldErrors,
  };
}

// 草稿：寬鬆解析，缺漏欄位一律給預設值，不擋存檔
function parseCaseDraft(
  formData: FormData,
  opts: { requireDeptCode: boolean; fixedDeptCode: string }
): {
  plateName: string;
  orderNo: string;
  categoryId: string | null;
  categoryNo: string;
  carModel: string;
  description: string;
  deptCode: string;
  subsidyDeptCourse: number;
  goldMedal: number;
  silverMedal: number;
  discountTotal: number;
  specialSubsidy: number;
} {
  const str = (k: string) => String(formData.get(k) ?? "").trim();
  const num = (k: string) => {
    const n = Number(str(k));
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };
  const orderNoRaw = str("orderNo").toUpperCase();
  const orderNo = orderNoRaw || `DRAFT-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const categoryId = str("categoryId") || null;

  let deptCode = opts.fixedDeptCode;
  if (opts.requireDeptCode) {
    const raw = str("deptCode");
    deptCode = /^\d+$/.test(raw) ? normalizeDeptCode(raw) : "";
  }

  return {
    plateName: str("plateName"),
    orderNo,
    categoryId,
    categoryNo: "", // 草稿不編號，正式送出時才自動產生
    carModel: str("carModel"),
    description: str("description"),
    deptCode,
    subsidyDeptCourse: num("subsidyDeptCourse"),
    goldMedal: num("goldMedal"),
    silverMedal: num("silverMedal"),
    discountTotal: num("discountTotal"),
    specialSubsidy: num("specialSubsidy"),
  };
}

// ---------- 送單 ----------

export async function createCase(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  if (!canSubmit(user)) return { error: "您沒有送單權限" };

  const intent = String(formData.get("intent") ?? "submit");
  const month = currentMonth();
  const requireDeptCode = !user.deptCode;
  const fixedDeptCode = normalizeDeptCode(user.deptCode);

  if (intent === "draft") {
    const draft = parseCaseDraft(formData, { requireDeptCode, fixedDeptCode });
    try {
      const created = await prisma.case.create({
        data: {
          ...draft,
          month,
          storeCode: user.storeCode,
          status: STATUS.DRAFT,
          submittedById: user.id,
          logs: {
            create: {
              step: "DRAFT",
              action: ACTION.SAVE_DRAFT,
              reviewerId: user.id,
            },
          },
        },
      });
      return {
        ok: true,
        caseId: created.id,
        message: "草稿已儲存，可於首頁繼續編輯或送出。",
      };
    } catch (e: unknown) {
      if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
        return {
          fieldErrors: { orderNo: "此訂單編號已存在（全系統唯一）" },
          values: extractRawValues(formData),
        };
      }
      throw e;
    }
  }

  const window = await prisma.monthWindow.findUnique({ where: { month } });
  if (window && !window.isOpen) {
    return {
      error: `本月（${month}）已關閉，暫不開放送單`,
      values: extractRawValues(formData),
    };
  }

  const validDeptCodes = requireDeptCode
    ? await getDeptCodesForStore(user.storeCode)
    : undefined;

  const { data, fieldErrors } = validateCase(formData, {
    requireDeptCode,
    fixedDeptCode,
    validDeptCodes,
  });
  if (!data) return { fieldErrors, values: extractRawValues(formData) };

  const categoryNo = await generateCategoryNo(data.categoryId, user.storeCode, data.deptCode);

  let newId: string;
  try {
    const created = await prisma.case.create({
      data: {
        ...data,
        categoryNo,
        month,
        storeCode: user.storeCode,
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
      return {
        fieldErrors: { orderNo: "此訂單編號已存在（全系統唯一）" },
        values: extractRawValues(formData),
      };
    }
    throw e;
  }

  return { ok: true, caseId: newId, message: "申請已送出，等待所長審核。" };
}

// ---------- 修改後重送／草稿編輯 ----------

export async function updateCase(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  const caseId = String(formData.get("caseId") ?? "");
  const existing = await prisma.case.findUnique({ where: { id: caseId } });
  if (!existing) return { error: "找不到案件" };
  if (!canResubmit(user, existing)) return { error: "此案件無法重送" };

  const requireDeptCode = !user.deptCode;
  const fixedDeptCode = normalizeDeptCode(user.deptCode ?? existing.deptCode);
  // 只有原本就是草稿的案件，才允許繼續存成草稿；已駁回/已撤回一律視為正式重送
  const intent =
    existing.status === STATUS.DRAFT
      ? String(formData.get("intent") ?? "submit")
      : "submit";

  if (intent === "draft") {
    const draft = parseCaseDraft(formData, { requireDeptCode, fixedDeptCode });
    try {
      await prisma.case.update({
        where: { id: caseId },
        data: { ...draft },
      });
      return { ok: true, caseId, message: "草稿已更新。" };
    } catch (e: unknown) {
      if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
        return {
          fieldErrors: { orderNo: "此訂單編號已存在（全系統唯一）" },
          values: extractRawValues(formData),
        };
      }
      throw e;
    }
  }

  const validDeptCodes = requireDeptCode
    ? await getDeptCodesForStore(existing.storeCode)
    : undefined;

  const { data, fieldErrors } = validateCase(formData, {
    requireDeptCode,
    fixedDeptCode,
    validDeptCodes,
  });
  if (!data) return { fieldErrors, values: extractRawValues(formData) };

  const categoryNo = await generateCategoryNo(
    data.categoryId,
    existing.storeCode,
    data.deptCode
  );

  const step = existing.status === STATUS.DRAFT ? "SUBMIT" : "RESUBMIT";
  const action = existing.status === STATUS.DRAFT ? "SUBMIT" : "RESUBMIT";

  try {
    await prisma.$transaction([
      prisma.case.update({
        where: { id: caseId },
        data: {
          ...data,
          categoryNo,
          status: STATUS.PENDING_SUOZHANG,
          stepEnteredAt: new Date(),
        },
      }),
      prisma.approvalLog.create({
        data: { caseId, step, action, reviewerId: user.id },
      }),
    ]);
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return {
        fieldErrors: { orderNo: "此訂單編號已存在（全系統唯一）" },
        values: extractRawValues(formData),
      };
    }
    throw e;
  }

  return { ok: true, caseId, message: "申請已送出，等待所長審核。" };
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

// ---------- 刪除（僅限自己已撤回的案件） ----------

export async function deleteCase(formData: FormData) {
  const user = await requireUser();
  const caseId = String(formData.get("caseId") ?? "");
  const c = await prisma.case.findUnique({ where: { id: caseId } });
  if (!c) redirect("/");
  if (!canDelete(user, c!)) return;

  // 先刪關聯的審核紀錄，再刪案件（無 cascade）
  await prisma.$transaction([
    prisma.approvalLog.deleteMany({ where: { caseId } }),
    prisma.case.delete({ where: { id: caseId } }),
  ]);

  redirect("/");
}

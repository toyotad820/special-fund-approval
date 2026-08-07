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
  getActiveMonth,
} from "./dal";
import { STATUS, ROLE, ACTION } from "./constants";
import { normalizeDeptCode } from "./format";
import { logAudit } from "./audit-log";

export type ActionState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  ok?: boolean;
  caseId?: string;
  message?: string;
  // 送出失敗時，把使用者原本填的內容一併帶回，前端才能保留資料不清空
  values?: Record<string, string>;
};

// ---------- 登入 / 登出 ----------

// 防暴力破解：連續失敗達門檻鎖定一段時間
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

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

  // 訊息跟一般帳密錯誤故意用同一句：如果鎖定另外回話，等於主動告訴外部「這個
  // 帳號存在而且已經被鎖定」，反而方便有心人拿已知帳號（如 boss）持續打錯密碼
  // 把它鎖死。不區分原因，一律回同一句籠統訊息。
  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    return { error: "帳號或密碼錯誤，請稍後再試" };
  }

  const ok =
    !!user && user.active && (await bcrypt.compare(password, user.passwordHash));

  if (!ok) {
    if (user) {
      const attempts = user.failedLoginAttempts + 1;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: attempts,
          lockedUntil:
            attempts >= MAX_LOGIN_ATTEMPTS
              ? new Date(Date.now() + LOCKOUT_MINUTES * 60000)
              : null,
        },
      });
    }
    await logAudit({
      actorUsername: username,
      action: "LOGIN_FAIL",
      summary: user ? "密碼錯誤" : "帳號不存在",
    });
    return { error: "帳號或密碼錯誤，請稍後再試" };
  }

  if (user.failedLoginAttempts > 0 || user.lockedUntil) {
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
  }

  const session = await getSession();
  session.userId = user.id;
  session.sessionVersion = user.sessionVersion;
  await session.save();

  await logAudit({
    actorUserId: user.id,
    actorUsername: user.username,
    action: "LOGIN_SUCCESS",
  });

  redirect("/portal");
}

export async function logout() {
  const session = await getSession();
  session.destroy();
  redirect("/login");
}

export type ChangePasswordState = { error?: string; ok?: boolean; message?: string };

// 使用者自行變更密碼（需先驗證目前密碼；管理員重設密碼另見 admin-actions.ts updateUser）
export async function changePassword(
  _prev: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  const user = await requireUser();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!current || !next || !confirm) return { error: "請填寫所有欄位" };
  if (next.length < 4) return { error: "新密碼至少 4 碼" };
  if (next !== confirm) return { error: "兩次輸入的新密碼不一致" };

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser || !(await bcrypt.compare(current, dbUser.passwordHash))) {
    return { error: "目前密碼不正確" };
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(next, 10),
      sessionVersion: { increment: 1 },
    },
  });

  // 讓其他裝置的舊 session 失效，但這個 request 自己的 session 換成新版本繼續有效
  const session = await getSession();
  session.sessionVersion = updated.sessionVersion;
  await session.save();

  return { ok: true, message: "密碼已更新，下次登入請使用新密碼。" };
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
// 該月（month）案件數（不含草稿）+1。所長代送的案件也計入該課的統計。
async function generateCategoryNo(
  categoryId: string,
  storeCode: string,
  deptCode: string,
  month: string
): Promise<string> {
  const [category, count] = await Promise.all([
    prisma.caseCategory.findUnique({ where: { id: categoryId } }),
    prisma.case.count({
      where: { month, storeCode, deptCode, categoryId, status: { not: STATUS.DRAFT } },
    }),
  ]);
  const abbr = (category?.name ?? "").slice(0, 2) || "特案";
  return `${abbr}${String(count + 1).padStart(2, "0")}`;
}

// 兩人同時送出可能搶到同一個 categoryNo（見 schema 的 @@unique 說明），
// 判斷 P2002 撞的是不是 categoryNo 那個 unique constraint，不是 orderNo
function isUniqueConflictOn(e: unknown, field: string): boolean {
  if (!e || typeof e !== "object" || !("code" in e)) return false;
  if ((e as { code?: unknown }).code !== "P2002") return false;
  const target = (e as { meta?: { target?: unknown } }).meta?.target;
  if (Array.isArray(target)) return target.includes(field);
  if (typeof target === "string") return target.includes(field);
  return false;
}

// 取得目前有效的特案類別 id / 車名清單，用於驗證下拉選單送出的值未被竄改
async function getValidCategoriesAndCars(): Promise<{
  validCategoryIds: string[];
  validCarModels: string[];
}> {
  const [categories, cars] = await Promise.all([
    prisma.caseCategory.findMany({ where: { active: true }, select: { id: true } }),
    prisma.carModel.findMany({ where: { active: true }, select: { name: true } }),
  ]);
  return {
    validCategoryIds: categories.map((c) => c.id),
    validCarModels: cars.map((c) => c.name),
  };
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

function parseAmount(v: FormDataEntryValue | null): number {
  const s = String(v ?? "").trim();
  if (s === "") return 0; // 未輸入預設為 0
  if (!/^\d+$/.test(s)) return NaN; // 僅允許非負整數
  return Number(s);
}

// requireDeptCode: 所長沒有固定課別，需在表單中選擇（必填，下拉選單）
// validDeptCodes: 該所目前有效課別代碼，用於防止表單被竄改送出不存在的課別
// validCategoryIds / validCarModels: 下拉選單當下的有效選項，防止表單被竄改送出選單以外的值
function validateCase(
  formData: FormData,
  opts: {
    storeCode: string;
    requireDeptCode: boolean;
    fixedDeptCode: string;
    validDeptCodes?: string[];
    validCategoryIds: string[];
    validCarModels: string[];
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
  const storeCode = opts.storeCode.toUpperCase();

  if (!plateName) fieldErrors.plateName = "必填";

  if (!orderNo) fieldErrors.orderNo = "必填";
  else if (!/^[A-Z0-9]{13}$/.test(orderNo))
    fieldErrors.orderNo = "須為 13 碼英數字";
  else if (orderNo.slice(0, 3) !== storeCode)
    fieldErrors.orderNo = `前 3 碼須為所別 ${storeCode}`;

  if (!categoryId) fieldErrors.categoryId = "必填";
  else if (!opts.validCategoryIds.includes(categoryId))
    fieldErrors.categoryId = "類別選項無效，請重新選擇";

  if (!carModel) fieldErrors.carModel = "必填";
  else if (!opts.validCarModels.includes(carModel))
    fieldErrors.carModel = "車名選項無效，請重新選擇";

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
    if (Number.isNaN(n)) fieldErrors[f] = "請填非負整數";
    else amounts[f] = n;
  }

  // 金額防呆：特案支援金額 > 0 時，(所課支援金 + 金牌金額 + 銀牌金額) 必須 > 0
  if (
    amounts.specialSubsidy > 0 &&
    amounts.subsidyDeptCourse + amounts.goldMedal + amounts.silverMedal <= 0
  ) {
    fieldErrors.specialSubsidy =
      "特案支援金額 > 0 時，所課支援金＋金牌金額＋銀牌金額 必須大於 0";
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
  categoryNo: null;
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
    categoryNo: null, // 草稿不編號，正式送出時才自動產生（null 而非空字串，見 schema 註解）
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
  const month = await getActiveMonth();
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

  const [validDeptCodes, { validCategoryIds, validCarModels }] = await Promise.all([
    requireDeptCode ? getDeptCodesForStore(user.storeCode) : Promise.resolve(undefined),
    getValidCategoriesAndCars(),
  ]);

  const { data, fieldErrors } = validateCase(formData, {
    storeCode: user.storeCode,
    requireDeptCode,
    fixedDeptCode,
    validDeptCodes,
    validCategoryIds,
    validCarModels,
  });
  if (!data) return { fieldErrors, values: extractRawValues(formData) };

  let newId: string | undefined;
  for (let attempt = 0; attempt < 3 && newId === undefined; attempt++) {
    const categoryNo = await generateCategoryNo(data.categoryId, user.storeCode, data.deptCode, month);
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
      if (isUniqueConflictOn(e, "categoryNo") && attempt < 2) continue; // 撞號，重算一次再試
      if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
        return {
          fieldErrors: { orderNo: "此訂單編號已存在（全系統唯一）" },
          values: extractRawValues(formData),
      };
      }
      throw e;
    }
  }
  if (newId === undefined) {
    return { error: "類別編號產生失敗（連續撞號），請重新送出" };
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

  const [validDeptCodes, { validCategoryIds, validCarModels }] = await Promise.all([
    requireDeptCode ? getDeptCodesForStore(existing.storeCode) : Promise.resolve(undefined),
    getValidCategoriesAndCars(),
  ]);

  const { data, fieldErrors } = validateCase(formData, {
    storeCode: existing.storeCode,
    requireDeptCode,
    fixedDeptCode,
    validDeptCodes,
    validCategoryIds,
    validCarModels,
  });
  if (!data) return { fieldErrors, values: extractRawValues(formData) };

  const step = existing.status === STATUS.DRAFT ? "SUBMIT" : "RESUBMIT";
  const action = existing.status === STATUS.DRAFT ? "SUBMIT" : "RESUBMIT";

  let done = false;
  for (let attempt = 0; attempt < 3 && !done; attempt++) {
    const categoryNo = await generateCategoryNo(
      data.categoryId,
      existing.storeCode,
      data.deptCode,
      existing.month
    );
    try {
      await prisma.$transaction([
        prisma.case.update({
          where: { id: caseId },
          data: {
            ...data,
            categoryNo,
            status: STATUS.PENDING_SUOZHANG,
            stepEnteredAt: new Date(),
            // 重送等於重新進入審核佇列，佇列排序（/queue 依 submittedAt 排最舊優先）
            // 應該反映「這次重新送出」的時間，不能還留第一次送出的舊時間
            submittedAt: new Date(),
          },
        }),
        prisma.approvalLog.create({
          data: { caseId, step, action, reviewerId: user.id },
        }),
      ]);
      done = true;
    } catch (e: unknown) {
      if (isUniqueConflictOn(e, "categoryNo") && attempt < 2) continue; // 撞號，重算一次再試
      if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
        return {
          fieldErrors: { orderNo: "此訂單編號已存在（全系統唯一）" },
          values: extractRawValues(formData),
        };
      }
      throw e;
    }
  }
  if (!done) {
    return { error: "類別編號產生失敗（連續撞號），請重新送出" };
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

  // 條件式更新：where 帶上讀取當下的狀態，如果案件在讀取後、寫入前已經被
  // 別的審核動作（或撤回）改掉狀態，這裡會影響 0 筆，不會平白蓋掉別人的結果，
  // 也不會留下對不上實際狀態的 ApprovalLog
  const changed = await prisma.$transaction(async (tx) => {
    const { count } = await tx.case.updateMany({
      where: { id: caseId, status: c.status },
      data: {
        status: nextStatus,
        stepEnteredAt:
          nextStatus === STATUS.PENDING_BUZHUGUAN ? new Date() : c.stepEnteredAt,
      },
    });
    if (count === 0) return false;
    await tx.approvalLog.create({
      data: {
        caseId,
        step,
        action: decision,
        reviewerId: user.id,
        comment: comment || null,
      },
    });
    return true;
  });

  if (!changed) {
    return { error: "案件狀態已被其他人異動，請重新整理後再操作" };
  }

  revalidatePath(`/cases/${caseId}`);
  // 審核完成後回到待審清單，方便繼續審下一筆，而不是留在單一案件頁
  redirect(user.role === ROLE.BUZHUGUAN ? "/queue" : "/cases-review");
}

// ---------- 整批核准（僅部長，僅核准，駁回需填原因故維持單筆） ----------

export async function bulkApproveCases(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  if (user.role !== ROLE.BUZHUGUAN) return { error: "您無權執行整批核准" };

  const caseIds = formData.getAll("caseIds").map(String).filter(Boolean);
  if (caseIds.length === 0) return { error: "請先選擇要核准的案件" };

  const cases = await prisma.case.findMany({ where: { id: { in: caseIds } } });
  const reviewable = cases.filter((c) => canReview(user, c));
  if (reviewable.length === 0) return { error: "所選案件已不在待審核狀態，請重新整理" };

  await prisma.$transaction(
    reviewable.flatMap((c) => [
      prisma.case.update({
        where: { id: c.id },
        data: { status: STATUS.APPROVED },
      }),
      prisma.approvalLog.create({
        data: { caseId: c.id, step: "BUZHUGUAN", action: "APPROVE", reviewerId: user.id },
      }),
    ])
  );

  revalidatePath("/queue");
  return { ok: true, message: `已核准 ${reviewable.length} 筆案件` };
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

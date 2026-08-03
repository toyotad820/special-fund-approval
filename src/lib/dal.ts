import "server-only";
import type { User } from "@prisma/client";
import { prisma } from "./prisma";
import { ROLE, STATUS, ACC_STATUS, OVERDUE_DAYS } from "./constants";
import { normalizeDeptCode } from "./format";

// 目前生效的申請月份：以「月份開關」目前開放中的最新月份為準（實際切月日期
// 常常不是月初 1 號，會延後幾天，由管理員手動關前月/開新月決定切換時機），
// 找不到任何開放月份時 fallback 回日曆當月，避免系統整個卡住
export async function getActiveMonth(): Promise<string> {
  const open = await prisma.monthWindow.findFirst({
    where: { isOpen: true },
    orderBy: { month: "desc" },
  });
  if (open) return open.month;
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// 該所目前有效的課別代碼（依課長帳號推得），供所長申請時的課別下拉選單使用
export async function getDeptCodesForStore(storeCode: string): Promise<string[]> {
  const rows = await prisma.user.findMany({
    where: {
      role: ROLE.KEZHANG,
      storeCode,
      active: true,
      deptCode: { not: null },
    },
    select: { deptCode: true },
    distinct: ["deptCode"],
  });
  const codes = rows
    .map((r) => normalizeDeptCode(r.deptCode))
    .filter((d) => d !== "");
  return [...new Set(codes)].sort((a, b) => {
    const na = Number(a);
    const nb = Number(b);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    return a.localeCompare(b);
  });
}

// 系統現有的所別清單（distinct storeCode），供配件中心「負責所別」勾選
export async function listStoreCodes(): Promise<string[]> {
  const rows = await prisma.user.findMany({
    select: { storeCode: true },
    distinct: ["storeCode"],
  });
  return rows
    .map((r) => r.storeCode.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

export function canSubmit(user: User): boolean {
  return user.role === ROLE.KEZHANG || user.role === ROLE.SUOZHANG;
}

export function canViewReports(user: User): boolean {
  return user.role === ROLE.BUZHUGUAN || user.role === ROLE.STAFF;
}

// 後台管理：僅 staff
export function canAdmin(user: User): boolean {
  return user.role === ROLE.STAFF;
}

type CaseLike = { status: string; storeCode: string; submittedById: string };

type ViewableCase = { storeCode: string; deptCode: string; submittedById: string };

// 此使用者能否檢視這張單（草稿為私人資料，僅本人可見）
export function canViewCase(
  user: User,
  c: ViewableCase & { status: string }
): boolean {
  if (c.submittedById === user.id) return true;
  if (c.status === STATUS.DRAFT) return false;
  if (user.role === ROLE.BUZHUGUAN || user.role === ROLE.STAFF) return true;
  if (user.role === ROLE.SUOZHANG) return c.storeCode === user.storeCode;
  if (user.role === ROLE.KEZHANG)
    return c.storeCode === user.storeCode && c.deptCode === (user.deptCode ?? "");
  return false;
}

// 此使用者能否審核這張單
export function canReview(user: User, c: CaseLike): boolean {
  if (user.role === ROLE.SUOZHANG) {
    return c.status === STATUS.PENDING_SUOZHANG && c.storeCode === user.storeCode;
  }
  if (user.role === ROLE.BUZHUGUAN) {
    return c.status === STATUS.PENDING_BUZHUGUAN;
  }
  return false;
}

// 送單人能否撤回（第一關尚未動作前）
export function canWithdraw(user: User, c: CaseLike): boolean {
  return c.submittedById === user.id && c.status === STATUS.PENDING_SUOZHANG;
}

// 送單人能否修改後重送（已駁回、已撤回、或草稿）
export function canResubmit(user: User, c: CaseLike): boolean {
  return (
    c.submittedById === user.id &&
    (c.status === STATUS.REJECTED ||
      c.status === STATUS.WITHDRAWN ||
      c.status === STATUS.DRAFT)
  );
}

// 送單人能否刪除（自己的草稿、已撤回或已駁回案件）
export function canDelete(user: User, c: CaseLike): boolean {
  return (
    c.submittedById === user.id &&
    (c.status === STATUS.WITHDRAWN ||
      c.status === STATUS.REJECTED ||
      c.status === STATUS.DRAFT)
  );
}

// 後台：staff 能否強制將已核准案件退回申請者
export function canReturnCase(user: User, c: CaseLike): boolean {
  return user.role === ROLE.STAFF && c.status === STATUS.APPROVED;
}

// 是否逾期（進入目前關卡超過門檻天數且尚在待審）
export function isOverdue(c: { status: string; stepEnteredAt: Date }): boolean {
  if (c.status !== STATUS.PENDING_SUOZHANG && c.status !== STATUS.PENDING_BUZHUGUAN) {
    return false;
  }
  const ms = Date.now() - new Date(c.stepEnteredAt).getTime();
  return ms > OVERDUE_DAYS * 24 * 60 * 60 * 1000;
}

// ============================================================
// 配件變更申請系統權限
// 單層審核：SUOZHANG/KEZHANG 送單 → BUZHUGUAN 審核 → PEIJIAN 確認
// ============================================================

type AccLike = { status: string; storeCode: string; submittedById: string };

// 能否送配件變更申請（所長與副所長=課長皆可，一律直送部長）
export function canSubmitAccessory(user: User): boolean {
  return user.role === ROLE.SUOZHANG || user.role === ROLE.KEZHANG;
}

// 能否檢視這張配件申請單（草稿為私人資料，僅本人可見）
export function canViewAccessory(user: User, r: AccLike): boolean {
  if (r.submittedById === user.id) return true;
  if (r.status === ACC_STATUS.DRAFT) return false;
  // 部長、配件中心、Staff 可見全部（非草稿）
  if (
    user.role === ROLE.BUZHUGUAN ||
    user.role === ROLE.PEIJIAN ||
    user.role === ROLE.STAFF
  ) {
    return true;
  }
  // 同所的所長/副所長可見本所案件
  if (user.role === ROLE.SUOZHANG || user.role === ROLE.KEZHANG) {
    return r.storeCode === user.storeCode;
  }
  return false;
}

// 部長能否審核（待審狀態）
export function canReviewAccessory(user: User, r: AccLike): boolean {
  return user.role === ROLE.BUZHUGUAN && r.status === ACC_STATUS.PENDING_REVIEW;
}

// 配件中心負責的所別集合（空 Set = 負責全部）
export function assignedStoreSet(user: User): Set<string> {
  return new Set(
    (user.assignedStores ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

// 配件中心能否對已核准案件確認或退回重審
export function canConfirmAccessory(user: User, r: AccLike): boolean {
  if (user.role !== ROLE.PEIJIAN || r.status !== ACC_STATUS.APPROVED) return false;
  const stores = assignedStoreSet(user);
  return stores.size === 0 || stores.has(r.storeCode);
}

// 送單人能否撤回（尚未審核前）
export function canWithdrawAccessory(user: User, r: AccLike): boolean {
  return r.submittedById === user.id && r.status === ACC_STATUS.PENDING_REVIEW;
}

// 送單人能否修改後重送（已退件、已撤回、或草稿）
export function canResubmitAccessory(user: User, r: AccLike): boolean {
  return (
    r.submittedById === user.id &&
    (r.status === ACC_STATUS.REJECTED ||
      r.status === ACC_STATUS.WITHDRAWN ||
      r.status === ACC_STATUS.DRAFT)
  );
}

// 送單人能否刪除（自己的草稿、已退件或已撤回）；Staff 例外可刪任何狀態的案件（後台清資料用）
export function canDeleteAccessory(user: User, r: AccLike): boolean {
  if (user.role === ROLE.STAFF) return true;
  return (
    r.submittedById === user.id &&
    (r.status === ACC_STATUS.DRAFT ||
      r.status === ACC_STATUS.REJECTED ||
      r.status === ACC_STATUS.WITHDRAWN)
  );
}

import "server-only";
import type { Prisma, User } from "@prisma/client";
import { ROLE, STATUS, OVERDUE_DAYS } from "./constants";

// 依角色回傳「可視案件」的查詢條件
export function visibilityWhere(user: User): Prisma.CaseWhereInput {
  switch (user.role) {
    case ROLE.KEZHANG:
      // 課長：本課（同所別 + 同課別）
      return { storeCode: user.storeCode, deptCode: user.deptCode ?? undefined };
    case ROLE.SUOZHANG:
      // 所長：本所（同所別，全部課）
      return { storeCode: user.storeCode };
    case ROLE.BUZHUGUAN:
    case ROLE.STAFF:
    default:
      // 部主管 / staff：全部
      return {};
  }
}

// 「待我審核」的查詢條件（無審核權限者回傳 null）
export function reviewQueueWhere(user: User): Prisma.CaseWhereInput | null {
  if (user.role === ROLE.SUOZHANG) {
    return { status: STATUS.PENDING_SUOZHANG, storeCode: user.storeCode };
  }
  if (user.role === ROLE.BUZHUGUAN) {
    return { status: STATUS.PENDING_BUZHUGUAN };
  }
  return null;
}

export function canSubmit(user: User): boolean {
  return user.role === ROLE.KEZHANG || user.role === ROLE.SUOZHANG;
}

export function canViewReports(user: User): boolean {
  return user.role === ROLE.BUZHUGUAN || user.role === ROLE.STAFF;
}

type CaseLike = { status: string; storeCode: string; submittedById: string };

type ViewableCase = { storeCode: string; deptCode: string; submittedById: string };

// 此使用者能否檢視這張單
export function canViewCase(user: User, c: ViewableCase): boolean {
  if (c.submittedById === user.id) return true;
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

// 送單人能否修改後重送
export function canResubmit(user: User, c: CaseLike): boolean {
  return c.submittedById === user.id && c.status === STATUS.REJECTED;
}

// 是否逾期（進入目前關卡超過門檻天數且尚在待審）
export function isOverdue(c: { status: string; stepEnteredAt: Date }): boolean {
  if (c.status !== STATUS.PENDING_SUOZHANG && c.status !== STATUS.PENDING_BUZHUGUAN) {
    return false;
  }
  const ms = Date.now() - new Date(c.stepEnteredAt).getTime();
  return ms > OVERDUE_DAYS * 24 * 60 * 60 * 1000;
}

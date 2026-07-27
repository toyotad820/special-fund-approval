// 角色
export const ROLE = {
  KEZHANG: "KEZHANG", // 課長：只送單（配件系統中代表副所長，可直接送部長）
  SUOZHANG: "SUOZHANG", // 所長：送單 + 第一關審核
  BUZHUGUAN: "BUZHUGUAN", // 部主管：第二關審核
  STAFF: "STAFF", // Staff：全域報表 + 後台設定
  PEIJIAN: "PEIJIAN", // 配件中心：配件變更核准後的明細確認
} as const;

export type Role = (typeof ROLE)[keyof typeof ROLE];

export const ROLE_LABEL: Record<string, string> = {
  KEZHANG: "課長",
  SUOZHANG: "所長",
  BUZHUGUAN: "部長",
  STAFF: "Staff",
  PEIJIAN: "配件中心",
};

// 系統（入口選單用，User.systems 逗號分隔存這裡的 key）
export const SYSTEM = {
  FUND: "fund", // 特案支援金報備系統
  CAR_SPEC_CHANGE: "car-spec-change", // 特仕車變更申請（開發中，無功能）
} as const;

export type SystemKey = (typeof SYSTEM)[keyof typeof SYSTEM];

export const SYSTEM_LABEL: Record<string, string> = {
  [SYSTEM.FUND]: "特案支援金報備",
  [SYSTEM.CAR_SPEC_CHANGE]: "特仕車變更申請",
};

// 案件狀態
export const STATUS = {
  DRAFT: "DRAFT", // 草稿（尚未送出）
  PENDING_SUOZHANG: "PENDING_SUOZHANG", // 待所長審核（第一關）
  PENDING_BUZHUGUAN: "PENDING_BUZHUGUAN", // 待部主管審核（第二關）
  APPROVED: "APPROVED", // 已核准
  REJECTED: "REJECTED", // 已駁回
  WITHDRAWN: "WITHDRAWN", // 已撤回
} as const;

export type Status = (typeof STATUS)[keyof typeof STATUS];

export const STATUS_LABEL: Record<string, string> = {
  DRAFT: "草稿",
  PENDING_SUOZHANG: "待所長審核",
  PENDING_BUZHUGUAN: "待部長審核",
  APPROVED: "已核准",
  REJECTED: "已駁回",
  WITHDRAWN: "已撤回",
};

// 狀態顏色（Tailwind class）
export const STATUS_STYLE: Record<string, string> = {
  DRAFT: "bg-violet-100 text-violet-700",
  PENDING_SUOZHANG: "bg-amber-100 text-amber-800",
  PENDING_BUZHUGUAN: "bg-blue-100 text-blue-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-rose-100 text-rose-800",
  WITHDRAWN: "bg-gray-200 text-gray-600",
};

// 狀態小圓點顏色
export const STATUS_DOT: Record<string, string> = {
  DRAFT: "bg-violet-500",
  PENDING_SUOZHANG: "bg-amber-500",
  PENDING_BUZHUGUAN: "bg-blue-500",
  APPROVED: "bg-emerald-500",
  REJECTED: "bg-rose-500",
  WITHDRAWN: "bg-slate-400",
};

// 逾期天數門檻
export const OVERDUE_DAYS = 3;

// 動作
export const ACTION = {
  SAVE_DRAFT: "SAVE_DRAFT",
  SUBMIT: "SUBMIT",
  RESUBMIT: "RESUBMIT",
  WITHDRAW: "WITHDRAW",
  APPROVE: "APPROVE",
  REJECT: "REJECT",
} as const;

export const ACTION_LABEL: Record<string, string> = {
  SAVE_DRAFT: "儲存草稿",
  SUBMIT: "送出",
  RESUBMIT: "修改後重送",
  WITHDRAW: "撤回",
  APPROVE: "核准",
  REJECT: "駁回",
  CONFIRM: "確認",
  RETURN: "退回重審",
};

// ============================================================
// 配件變更申請系統（特仕車變更申請）常數
// 單層審核：SUOZHANG/KEZHANG 送單 → BUZHUGUAN 審核 → 核准後 PEIJIAN 確認
// ============================================================

// 配件申請案件狀態
export const ACC_STATUS = {
  DRAFT: "DRAFT", // 草稿（尚未送出）
  PENDING_REVIEW: "PENDING_REVIEW", // 待部長審核
  REJECTED: "REJECTED", // 已退件（可修改後重送）
  APPROVED: "APPROVED", // 已核准（已蓋章、待配件中心確認）
  CONFIRMED: "CONFIRMED", // 配件中心已確認（結案）
  WITHDRAWN: "WITHDRAWN", // 已撤回
} as const;

export type AccStatus = (typeof ACC_STATUS)[keyof typeof ACC_STATUS];

export const ACC_STATUS_LABEL: Record<string, string> = {
  DRAFT: "草稿",
  PENDING_REVIEW: "待審核",
  REJECTED: "已退件",
  APPROVED: "已核准",
  CONFIRMED: "已確認",
  WITHDRAWN: "已撤回",
};

// 狀態顏色（沿用特案系統色票規則）
export const ACC_STATUS_STYLE: Record<string, string> = {
  DRAFT: "bg-violet-100 text-violet-700",
  PENDING_REVIEW: "bg-amber-100 text-amber-800",
  REJECTED: "bg-rose-100 text-rose-800",
  APPROVED: "bg-blue-100 text-blue-800",
  CONFIRMED: "bg-emerald-100 text-emerald-800",
  WITHDRAWN: "bg-gray-200 text-gray-600",
};

export const ACC_STATUS_DOT: Record<string, string> = {
  DRAFT: "bg-violet-500",
  PENDING_REVIEW: "bg-amber-500",
  REJECTED: "bg-rose-500",
  APPROVED: "bg-blue-500",
  CONFIRMED: "bg-emerald-500",
  WITHDRAWN: "bg-slate-400",
};

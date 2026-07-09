// 角色
export const ROLE = {
  KEZHANG: "KEZHANG", // 課長：只送單
  SUOZHANG: "SUOZHANG", // 所長：送單 + 第一關審核
  BUZHUGUAN: "BUZHUGUAN", // 部主管：第二關審核
  STAFF: "STAFF", // Staff：全域報表 + 後台設定
} as const;

export type Role = (typeof ROLE)[keyof typeof ROLE];

export const ROLE_LABEL: Record<string, string> = {
  KEZHANG: "課長",
  SUOZHANG: "所長",
  BUZHUGUAN: "部長",
  STAFF: "Staff",
};

// 案件狀態
export const STATUS = {
  PENDING_SUOZHANG: "PENDING_SUOZHANG", // 待所長審核（第一關）
  PENDING_BUZHUGUAN: "PENDING_BUZHUGUAN", // 待部主管審核（第二關）
  APPROVED: "APPROVED", // 已核准
  REJECTED: "REJECTED", // 已駁回
  WITHDRAWN: "WITHDRAWN", // 已撤回
} as const;

export type Status = (typeof STATUS)[keyof typeof STATUS];

export const STATUS_LABEL: Record<string, string> = {
  PENDING_SUOZHANG: "待所長審核",
  PENDING_BUZHUGUAN: "待部長審核",
  APPROVED: "已核准",
  REJECTED: "已駁回",
  WITHDRAWN: "已撤回",
};

// 狀態顏色（Tailwind class）
export const STATUS_STYLE: Record<string, string> = {
  PENDING_SUOZHANG: "bg-amber-100 text-amber-800",
  PENDING_BUZHUGUAN: "bg-blue-100 text-blue-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-rose-100 text-rose-800",
  WITHDRAWN: "bg-gray-200 text-gray-600",
};

// 狀態小圓點顏色
export const STATUS_DOT: Record<string, string> = {
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
  SUBMIT: "SUBMIT",
  RESUBMIT: "RESUBMIT",
  WITHDRAW: "WITHDRAW",
  APPROVE: "APPROVE",
  REJECT: "REJECT",
} as const;

export const ACTION_LABEL: Record<string, string> = {
  SUBMIT: "送出",
  RESUBMIT: "修改後重送",
  WITHDRAW: "撤回",
  APPROVE: "核准",
  REJECT: "駁回",
};

import { ROLE_LABEL, STATUS } from "@/lib/constants";
import { type CaseRowData } from "@/components/SortableCaseTable";

export const caseInclude = {
  category: { select: { name: true } },
  submittedBy: { select: { name: true } },
  logs: {
    where: { action: "REJECT" },
    orderBy: { createdAt: "desc" },
    take: 1,
    select: { step: true, reviewer: { select: { name: true } } },
  },
} as const;

export type CaseWithRels = {
  id: string;
  orderNo: string;
  month: string;
  storeCode: string;
  deptCode: string;
  plateName: string;
  categoryNo: string;
  carModel: string;
  subsidyDeptCourse: number;
  goldMedal: number;
  silverMedal: number;
  discountTotal: number;
  specialSubsidy: number;
  description: string;
  submittedAt: Date;
  status: string;
  category: { name: string } | null;
  submittedBy: { name: string };
  logs: { step: string; reviewer: { name: string } }[];
};

export function toRow(c: CaseWithRels): CaseRowData {
  const rej = c.status === STATUS.REJECTED ? c.logs[0] : undefined;
  return {
    id: c.id,
    orderNo: c.orderNo,
    month: c.month,
    storeDept: `${c.storeCode} / ${c.deptCode}`,
    plateName: c.plateName,
    categoryName: c.category?.name ?? "（尚未選擇）",
    categoryNo: c.categoryNo,
    carModel: c.carModel,
    subsidyDeptCourse: c.subsidyDeptCourse,
    goldMedal: c.goldMedal,
    silverMedal: c.silverMedal,
    discountTotal: c.discountTotal,
    specialSubsidy: c.specialSubsidy,
    description: c.description,
    submitterName: c.submittedBy.name,
    submittedAt: c.submittedAt.toISOString(),
    status: c.status,
    rejectedByRole: rej ? ROLE_LABEL[rej.step] ?? "" : null,
  };
}

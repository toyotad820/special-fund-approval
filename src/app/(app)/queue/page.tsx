import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ROLE, STATUS } from "@/lib/constants";
import QueueTable from "@/components/QueueTable";
import { caseInclude, toRow } from "@/lib/case-helpers";

export default async function QueuePage() {
  const user = await requireUser();
  if (user.role !== ROLE.BUZHUGUAN) redirect("/");

  const cases = await prisma.case.findMany({
    where: { status: STATUS.PENDING_BUZHUGUAN },
    include: caseInclude,
    orderBy: { submittedAt: "asc" },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-bold text-slate-800">
        待審案件 <span className="text-blue-600">({cases.length})</span>
      </h1>
      <QueueTable rows={cases.map(toRow)} />
    </div>
  );
}

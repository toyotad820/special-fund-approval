import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { canViewReports } from "@/lib/dal";
import ReportTabs from "@/components/ReportTabs";

export default async function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  if (!canViewReports(user)) redirect("/");

  return (
    <div className="space-y-4">
      <ReportTabs />
      {children}
    </div>
  );
}

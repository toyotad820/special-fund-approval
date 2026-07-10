import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { canViewReports } from "@/lib/dal";

const TABS = [
  { href: "/reports", label: "總覽" },
  { href: "/reports/category-usage", label: "所課別特案使用統計表" },
];

export default async function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  if (!canViewReports(user)) redirect("/");

  return (
    <div className="space-y-4">
      <nav className="flex gap-1 flex-wrap border-b border-slate-200">
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="px-3 py-2 text-sm text-slate-600 hover:text-blue-600 hover:border-b-2 hover:border-blue-500 -mb-px"
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}

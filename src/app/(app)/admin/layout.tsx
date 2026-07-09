import Link from "next/link";
import { requireUser } from "@/lib/session";
import { canAdmin } from "@/lib/dal";
import { redirect } from "next/navigation";

const tabs = [
  { href: "/admin/users", label: "人員" },
  { href: "/admin/categories", label: "特案類別" },
  { href: "/admin/cars", label: "車種" },
  { href: "/admin/months", label: "月份開關" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  if (!canAdmin(user)) redirect("/");

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-slate-800">後台管理</h1>
      <nav className="flex gap-1 flex-wrap border-b border-slate-200">
        {tabs.map((t) => (
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

import Link from "next/link";
import { requireUser } from "@/lib/session";
import { canAdmin } from "@/lib/dal";
import { ROLE_LABEL } from "@/lib/constants";
import { redirect } from "next/navigation";
import NavBar, { type NavItem } from "@/components/NavBar";

export default async function UsersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  if (!canAdmin(user)) redirect("/portal");

  const items: NavItem[] = [
    { href: "/portal", label: "系統選單" },
    { href: "/users", label: "後臺管理" },
  ];

  return (
    <div className="flex-1 flex flex-col">
      <NavBar
        userName={user.name}
        roleLabel={ROLE_LABEL[user.role]}
        items={items}
        homeHref="/users"
        title="後臺管理"
        iconSrc="/後臺管理.png"
        showVersion={false}
      />
      <main className="flex-1 w-full mx-auto p-4 sm:p-6">
        <div className="max-w-5xl mx-auto space-y-4">
          <h1 className="text-lg font-bold text-slate-800">後臺管理</h1>
          <nav className="flex gap-1 flex-wrap border-b border-slate-200">
            <Link
              href="/users"
              className="px-3 py-2 text-sm text-slate-600 hover:text-blue-600 hover:border-b-2 hover:border-blue-500 -mb-px"
            >
              人員
            </Link>
            <Link
              href="/admin/targets"
              className="px-3 py-2 text-sm text-slate-600 hover:text-blue-600 hover:border-b-2 hover:border-blue-500 -mb-px"
            >
              目標台數
            </Link>
          </nav>
          {children}
        </div>
      </main>
    </div>
  );
}

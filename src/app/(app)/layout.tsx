import { requireUser } from "@/lib/session";
import { canSubmit, canViewReports, canAdmin } from "@/lib/dal";
import { ROLE_LABEL } from "@/lib/constants";
import NavBar, { type NavItem } from "@/components/NavBar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  const items: NavItem[] = [{ href: "/", label: "首頁" }];
  if (canSubmit(user)) items.push({ href: "/cases/new", label: "新增申請" });
  if (canViewReports(user)) items.push({ href: "/reports", label: "報表" });
  if (canAdmin(user)) items.push({ href: "/admin", label: "後台" });

  return (
    <div className="flex-1 flex flex-col">
      <NavBar
        userName={user.name}
        roleLabel={ROLE_LABEL[user.role]}
        items={items}
      />
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6">
        {children}
      </main>
    </div>
  );
}

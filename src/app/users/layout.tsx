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
    { href: "/users", label: "人員管理" },
  ];

  return (
    <div className="flex-1 flex flex-col">
      <NavBar
        userName={user.name}
        roleLabel={ROLE_LABEL[user.role]}
        items={items}
        homeHref="/users"
        title="人員管理"
        iconSrc="/icon-user-management.png"
        showVersion={false}
      />
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6">
        {children}
      </main>
    </div>
  );
}

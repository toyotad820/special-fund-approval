import { requireUser } from "@/lib/session";
import { canSubmitAccessory } from "@/lib/dal";
import { ROLE, ROLE_LABEL, SYSTEM } from "@/lib/constants";
import { ACCESSORY_VERSION } from "@/lib/version";
import { redirect } from "next/navigation";
import NavBar, { type NavItem } from "@/components/NavBar";

export default async function AccessoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  const mySystems = user.systems.split(",").map((s) => s.trim()).filter(Boolean);
  // 無此系統權限者擋掉（Staff 例外：可檢視/管理）
  if (!mySystems.includes(SYSTEM.CAR_SPEC_CHANGE) && user.role !== ROLE.STAFF) {
    redirect("/portal");
  }

  const items: NavItem[] = [];
  if (mySystems.length > 1) items.push({ href: "/portal", label: "系統選單" });
  // 動作項目排第二（新增申請／待審核／待確認）
  if (canSubmitAccessory(user)) {
    items.push({ href: "/accessory/new", label: "新增申請" });
  }
  if (user.role === ROLE.BUZHUGUAN) {
    items.push({ href: "/accessory/review", label: "待審核" });
  }
  if (user.role === ROLE.PEIJIAN) {
    items.push({ href: "/accessory/confirm", label: "待確認" });
  }
  // 案件明細排第三
  items.push({ href: "/accessory", label: "案件明細" });
  // 報表（部長／配件中心／Staff）
  if (
    user.role === ROLE.BUZHUGUAN ||
    user.role === ROLE.PEIJIAN ||
    user.role === ROLE.STAFF
  ) {
    items.push({ href: "/accessory/reports", label: "報表" });
  }

  return (
    <div className="flex-1 flex flex-col">
      <NavBar
        userName={user.name}
        roleLabel={ROLE_LABEL[user.role]}
        items={items}
        homeHref="/accessory"
        title="配件變更申請"
        iconSrc="/icon-car-spec-change.png"
        version={ACCESSORY_VERSION}
      />
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6">
        {children}
      </main>
    </div>
  );
}

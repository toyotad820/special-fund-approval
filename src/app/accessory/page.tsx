import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { ROLE } from "@/lib/constants";

// 純導向 dispatcher：依角色進入對應首頁。實際案件清單在 /accessory/list（NavBar「案件明細」指向那裡）。
export default async function AccessoryHome() {
  const user = await requireUser();

  if (user.role === ROLE.BUZHUGUAN) redirect("/accessory/review");
  if (user.role === ROLE.PEIJIAN) redirect("/accessory/confirm");
  if (user.role === ROLE.SUOZHANG || user.role === ROLE.KEZHANG) redirect("/accessory/new");
  redirect("/accessory/list");
}

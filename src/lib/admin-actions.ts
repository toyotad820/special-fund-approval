"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "./prisma";
import { requireUser } from "./session";
import { canAdmin } from "./dal";
import { ROLE, ROLE_LABEL } from "./constants";
import { normalizeDeptCode } from "./format";

export type ActionState = {
  ok?: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
};

async function requireAdmin() {
  const user = await requireUser();
  if (!canAdmin(user)) redirect("/");
  return user;
}

const VALID_ROLES = [ROLE.KEZHANG, ROLE.SUOZHANG, ROLE.BUZHUGUAN, ROLE.STAFF] as const;

// 接受代碼或中文，回傳角色代碼；無效回 null
function normalizeRole(v: string): string | null {
  const s = v.trim();
  if ((VALID_ROLES as readonly string[]).includes(s)) return s;
  const byLabel = Object.entries(ROLE_LABEL).find(([, label]) => label === s);
  return byLabel ? byLabel[0] : null;
}

// ---------- 人員 ----------

export async function createUser(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();

  const username = String(formData.get("username") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const role = normalizeRole(String(formData.get("role") ?? ""));
  const storeCode = String(formData.get("storeCode") ?? "").trim();
  const deptCode = normalizeDeptCode(String(formData.get("deptCode") ?? "").trim());
  const password = String(formData.get("password") ?? "").trim() || "1234";

  const fieldErrors: Record<string, string> = {};
  if (!username) fieldErrors.username = "必填";
  if (!name) fieldErrors.name = "必填";
  if (!role) fieldErrors.role = "角色無效";
  if (!storeCode) fieldErrors.storeCode = "必填";
  if (role === ROLE.KEZHANG && !deptCode)
    fieldErrors.deptCode = "課長需填課別";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const exists = await prisma.user.findUnique({ where: { username } });
  if (exists) return { fieldErrors: { username: "帳號已存在" } };

  await prisma.user.create({
    data: {
      username,
      name,
      role: role!,
      storeCode,
      deptCode: deptCode || null,
      passwordHash: await bcrypt.hash(password, 10),
    },
  });

  revalidatePath("/admin/users");
  redirect("/admin/users");
}

export async function updateUser(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const role = normalizeRole(String(formData.get("role") ?? ""));
  const storeCode = String(formData.get("storeCode") ?? "").trim();
  const deptCode = normalizeDeptCode(String(formData.get("deptCode") ?? "").trim());
  const active = formData.get("active") === "on";
  const newPassword = String(formData.get("password") ?? "").trim();

  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors.name = "必填";
  if (!role) fieldErrors.role = "角色無效";
  if (!storeCode) fieldErrors.storeCode = "必填";
  if (role === ROLE.KEZHANG && !deptCode) fieldErrors.deptCode = "課長需填課別";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  await prisma.user.update({
    where: { id },
    data: {
      name,
      role: role!,
      storeCode,
      deptCode: deptCode || null,
      active,
      ...(newPassword ? { passwordHash: await bcrypt.hash(newPassword, 10) } : {}),
    },
  });

  revalidatePath("/admin/users");
  redirect("/admin/users");
}

// 刪除人員（有案件/審核紀錄者不可刪，改用停用；也不可刪自己）
export async function deleteUser(formData: FormData) {
  const me = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/admin/users");
  if (id === me.id) redirect("/admin/users?err=self");

  const [caseCount, logCount] = await Promise.all([
    prisma.case.count({ where: { submittedById: id } }),
    prisma.approvalLog.count({ where: { reviewerId: id } }),
  ]);
  if (caseCount > 0 || logCount > 0) {
    redirect("/admin/users?err=inuse");
  }

  await prisma.user.delete({ where: { id } });
  redirect("/admin/users");
}

// CSV 匯入人員：欄位 username,name,role,storeCode,deptCode,password
export async function importUsers(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "請選擇 CSV 檔" };
  }

  const { parseCsvRecords, decodeCsvBytes } = await import("./csv");
  const text = decodeCsvBytes(new Uint8Array(await file.arrayBuffer()));
  const records = parseCsvRecords(text);
  if (records.length === 0) return { error: "檔案沒有資料列" };

  let created = 0;
  let updated = 0;
  const errors: string[] = [];

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const line = i + 2; // 含表頭
    const username = (r.username ?? r["帳號"] ?? "").trim();
    const name = (r.name ?? r["姓名"] ?? "").trim();
    const role = normalizeRole(r.role ?? r["角色"] ?? "");
    const storeCode = (r.storeCode ?? r["所別"] ?? "").trim();
    const deptCode = normalizeDeptCode((r.deptCode ?? r["課別"] ?? "").trim());
    const password = (r.password ?? r["密碼"] ?? "").trim();

    if (!username || !name || !role || !storeCode) {
      errors.push(`第 ${line} 列：缺必要欄位或角色無效`);
      continue;
    }

    try {
      const existing = await prisma.user.findUnique({ where: { username } });
      if (existing) {
        await prisma.user.update({
          where: { username },
          data: {
            name,
            role,
            storeCode,
            deptCode: deptCode || null,
            ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
          },
        });
        updated++;
      } else {
        await prisma.user.create({
          data: {
            username,
            name,
            role,
            storeCode,
            deptCode: deptCode || null,
            passwordHash: await bcrypt.hash(password || "1234", 10),
          },
        });
        created++;
      }
    } catch {
      errors.push(`第 ${line} 列：寫入失敗`);
    }
  }

  revalidatePath("/admin/users");
  const msg = `新增 ${created} 筆、更新 ${updated} 筆` +
    (errors.length ? `；${errors.length} 筆失敗：${errors.slice(0, 5).join("；")}` : "");
  return { ok: errors.length === 0, message: msg, error: errors.length ? msg : undefined };
}

// ---------- 特案類別 / 車種（共用模式） ----------

export async function createCategory(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { fieldErrors: { name: "必填" } };
  const exists = await prisma.caseCategory.findUnique({ where: { name } });
  if (exists) return { fieldErrors: { name: "已存在" } };
  const max = await prisma.caseCategory.aggregate({ _max: { sortOrder: true } });
  await prisma.caseCategory.create({
    data: { name, sortOrder: (max._max.sortOrder ?? 0) + 1 },
  });
  revalidatePath("/admin/categories");
  return { ok: true };
}

export async function toggleCategory(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const c = await prisma.caseCategory.findUnique({ where: { id } });
  if (c) await prisma.caseCategory.update({ where: { id }, data: { active: !c.active } });
  revalidatePath("/admin/categories");
}

export async function createCar(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { fieldErrors: { name: "必填" } };
  const exists = await prisma.carModel.findUnique({ where: { name } });
  if (exists) return { fieldErrors: { name: "已存在" } };
  const max = await prisma.carModel.aggregate({ _max: { sortOrder: true } });
  await prisma.carModel.create({
    data: { name, sortOrder: (max._max.sortOrder ?? 0) + 1 },
  });
  revalidatePath("/admin/cars");
  return { ok: true };
}

export async function toggleCar(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const c = await prisma.carModel.findUnique({ where: { id } });
  if (c) await prisma.carModel.update({ where: { id }, data: { active: !c.active } });
  revalidatePath("/admin/cars");
}

// ---------- 月份開關 ----------

export async function createMonth(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const month = String(formData.get("month") ?? "").trim();
  if (!/^\d{4}-\d{2}$/.test(month))
    return { fieldErrors: { month: "格式須為 YYYY-MM" } };
  const exists = await prisma.monthWindow.findUnique({ where: { month } });
  if (exists) return { fieldErrors: { month: "已存在" } };
  await prisma.monthWindow.create({ data: { month, isOpen: true } });
  revalidatePath("/admin/months");
  return { ok: true };
}

export async function toggleMonth(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const m = await prisma.monthWindow.findUnique({ where: { id } });
  if (m) await prisma.monthWindow.update({ where: { id }, data: { isOpen: !m.isOpen } });
  revalidatePath("/admin/months");
}

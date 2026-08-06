"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "./prisma";
import { requireUser } from "./session";
import { canAdmin, canReturnCase } from "./dal";
import { ROLE, ROLE_LABEL, STATUS } from "./constants";
import { normalizeDeptCode } from "./format";
import { STANDARD_CAR_MODELS } from "./carModels";

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

const VALID_ROLES = [
  ROLE.KEZHANG,
  ROLE.SUOZHANG,
  ROLE.BUZHUGUAN,
  ROLE.STAFF,
  ROLE.PEIJIAN,
] as const;

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
  const password = String(formData.get("password") ?? "").trim() || "22819125";
  const systems = String(formData.get("systems") ?? "fund").trim() || "fund";
  const assignedStores = String(formData.get("assignedStores") ?? "").trim();

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
      systems,
      assignedStores: role === ROLE.PEIJIAN ? assignedStores : "",
      passwordHash: await bcrypt.hash(password, 10),
    },
  });

  revalidatePath("/users");
  redirect("/users");
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
  const newPassword = String(formData.get("password") ?? "").trim();
  const systems = String(formData.get("systems") ?? "fund").trim() || "fund";
  const assignedStores = String(formData.get("assignedStores") ?? "").trim();

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
      systems,
      assignedStores: role === ROLE.PEIJIAN ? assignedStores : "",
      // 後台重設密碼時順便讓這個人現有的登入（其他裝置）全部失效
      ...(newPassword
        ? {
            passwordHash: await bcrypt.hash(newPassword, 10),
            sessionVersion: { increment: 1 },
          }
        : {}),
    },
  });

  revalidatePath("/users");
  redirect("/users");
}

// 清單內直接切換某人員的單一系統權限（打勾即改）
export async function toggleUserSystem(
  userId: string,
  system: string,
  enabled: boolean
): Promise<void> {
  await requireAdmin();

  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (!u) throw new Error("人員不存在");

  const set = new Set(
    u.systems.split(",").map((s) => s.trim()).filter(Boolean)
  );
  if (enabled) set.add(system);
  else set.delete(system);

  await prisma.user.update({
    where: { id: userId },
    data: { systems: [...set].join(",") },
  });

  revalidatePath("/users");
}

// 清單內直接切換啟用/停用（打勾即改）
export async function toggleUserActive(
  userId: string,
  active: boolean
): Promise<void> {
  await requireAdmin();
  await prisma.user.update({
    where: { id: userId },
    data: { active },
  });
  revalidatePath("/users");
}

// 刪除人員（有案件/審核紀錄者不可刪，改用停用；也不可刪自己）
export async function deleteUser(formData: FormData) {
  const me = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/users");
  if (id === me.id) redirect("/users?err=self");

  const [caseCount, logCount] = await Promise.all([
    prisma.case.count({ where: { submittedById: id } }),
    prisma.approvalLog.count({ where: { reviewerId: id } }),
  ]);
  if (caseCount > 0 || logCount > 0) {
    redirect("/users?err=inuse");
  }

  await prisma.user.delete({ where: { id } });
  redirect("/users");
}

const MAX_CSV_SIZE = 2 * 1024 * 1024; // 2 MB，防手殘上傳錯檔
const MAX_CSV_ROWS = 1000;

// CSV 匯入人員：欄位 username,name,role,storeCode,deptCode,password
export async function importUsers(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const me = await requireAdmin();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "請選擇 CSV 檔" };
  }
  if (file.size > MAX_CSV_SIZE) {
    return { error: "CSV 檔案不可超過 2 MB" };
  }

  const { parseCsvRecords, decodeCsvBytes } = await import("./csv");
  const text = decodeCsvBytes(new Uint8Array(await file.arrayBuffer()));
  const records = parseCsvRecords(text);
  if (records.length === 0) return { error: "檔案沒有資料列" };
  if (records.length > MAX_CSV_ROWS) {
    return { error: `單次最多匯入 ${MAX_CSV_ROWS} 筆資料（本次 ${records.length} 筆）` };
  }

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
    // 防止 CSV 意外把匯入者自己的帳號改掉（例如角色/所別打錯字）
    if (username === me.username) {
      errors.push(`第 ${line} 列：不可透過 CSV 修改自己的帳號（${username}）`);
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
            ...(password
              ? {
                  passwordHash: await bcrypt.hash(password, 10),
                  sessionVersion: { increment: 1 },
                }
              : {}),
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
            passwordHash: await bcrypt.hash(password || "22819125", 10),
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

// 車種沒有關聯案件的外鍵限制（Case.carModel 只是文字欄位），可以直接刪除
export async function deleteCar(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.carModel.delete({ where: { id } }).catch(() => {});
  revalidatePath("/admin/cars");
}

// 同步車種清單為標準清單：標準清單內的車種一律啟用並依序排列，
// 不在標準清單內的既有車種直接刪除（車種沒有關聯案件的外鍵限制）
export async function syncStandardCarModels() {
  await requireAdmin();
  for (let i = 0; i < STANDARD_CAR_MODELS.length; i++) {
    await prisma.carModel.upsert({
      where: { name: STANDARD_CAR_MODELS[i] },
      update: { active: true, sortOrder: i },
      create: { name: STANDARD_CAR_MODELS[i], active: true, sortOrder: i },
    });
  }
  await prisma.carModel.deleteMany({
    where: { name: { notIn: [...STANDARD_CAR_MODELS] } },
  });
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
  revalidatePath("/users/months");
  return { ok: true };
}

export async function toggleMonth(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const m = await prisma.monthWindow.findUnique({ where: { id } });
  if (m) await prisma.monthWindow.update({ where: { id }, data: { isOpen: !m.isOpen } });
  revalidatePath("/users/months");
}

// ---------- 案件退回（已核准後強制取消，退回申請者修改重送） ----------

export async function returnCase(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireAdmin();
  const orderNo = String(formData.get("orderNo") ?? "").trim().toUpperCase();
  const comment = String(formData.get("comment") ?? "").trim();
  if (!comment) return { fieldErrors: { comment: "退回原因必填" } };

  const c = await prisma.case.findUnique({ where: { orderNo } });
  if (!c) return { error: "查無此訂單編號的案件" };
  if (!canReturnCase(user, c)) return { error: "僅能退回「已核准」狀態的案件" };

  await prisma.$transaction([
    prisma.case.update({
      where: { id: c.id },
      data: { status: STATUS.WITHDRAWN },
    }),
    prisma.approvalLog.create({
      data: {
        caseId: c.id,
        step: "STAFF",
        action: "WITHDRAW",
        reviewerId: user.id,
        comment: `[管理員強制退回] ${comment}`,
      },
    }),
  ]);

  revalidatePath(`/cases/${c.id}`);
  revalidatePath("/admin/case-return");
  return { ok: true, message: `已將訂單 ${orderNo} 退回申請者，可由送單人修改後重送。` };
}

// ---------- 目標台數 ----------

export async function importUnitTargets(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();

  const month = String(formData.get("month") ?? "").trim();
  if (!/^\d{4}-\d{2}$/.test(month)) return { error: "請選擇月份" };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "請選擇 CSV 檔" };
  }

  const { parseCsvRecords, decodeCsvBytes } = await import("./csv");
  const text = decodeCsvBytes(new Uint8Array(await file.arrayBuffer()));
  const records = parseCsvRecords(text);
  if (records.length === 0) return { error: "檔案沒有資料列" };

  const errors: string[] = [];
  // key 重複時（同一批檔案裡打錯打兩次）以後面那列為準；只收課別列，所層級由系統加總算出
  const byKey = new Map<string, { storeCode: string; deptCode: string; targetCount: number }>();

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const line = i + 2; // 含表頭
    const storeCode = (r.storeCode ?? r["所別"] ?? "").trim();
    const deptCode = normalizeDeptCode((r.deptCode ?? r["課別"] ?? "").trim());
    const targetCount = Number(r.targetCount ?? r["目標台數"] ?? "");

    if (!storeCode || !deptCode || deptCode === "0" || !Number.isFinite(targetCount)) {
      errors.push(`第 ${line} 列：缺必要欄位、數值格式錯誤，或誤填所層級列（本表只填課別）`);
      continue;
    }
    byKey.set(`${storeCode} ${deptCode}`, { storeCode, deptCode, targetCount });
  }

  const deptRows = [...byKey.values()];
  if (deptRows.length === 0) {
    return { error: `沒有可用的資料列；${errors.slice(0, 5).join("；")}` };
  }

  // 所層級＝該所底下各課加總（deptCode="0"，業務編制沒有這個課別編號，純粹存所層級的獨立數值）
  const storeTotals = new Map<string, number>();
  for (const r of deptRows) {
    storeTotals.set(r.storeCode, (storeTotals.get(r.storeCode) ?? 0) + r.targetCount);
  }
  const storeRows = [...storeTotals.entries()].map(([storeCode, targetCount]) => ({
    storeCode,
    deptCode: "0",
    targetCount,
  }));

  // 比重＝該列 targetCount 佔全公司課目標總和的百分比（所/課都套同一公式，四捨五入到小數1位）
  const companyTotal = deptRows.reduce((sum, r) => sum + r.targetCount, 0);
  const rows = [...deptRows, ...storeRows].map((r) => ({
    ...r,
    weight: companyTotal > 0 ? Math.round((r.targetCount / companyTotal) * 1000) / 10 : 0,
  }));

  // 整批覆蓋：上傳成功即以這份檔案為準，清掉該月舊資料再整批寫入
  await prisma.$transaction([
    prisma.unitTarget.deleteMany({ where: { month } }),
    prisma.unitTarget.createMany({
      data: rows.map((r) => ({ month, ...r })),
    }),
  ]);

  revalidatePath("/users/targets");
  const msg = `已覆蓋寫入 ${rows.length} 筆` +
    (errors.length ? `；${errors.length} 筆略過：${errors.slice(0, 5).join("；")}` : "");
  return { ok: errors.length === 0, message: msg, error: errors.length ? msg : undefined };
}


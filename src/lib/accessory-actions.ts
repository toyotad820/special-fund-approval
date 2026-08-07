"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import sharp, { type Metadata } from "sharp";
import { prisma } from "./prisma";
import { requireUser } from "./session";
import {
  canSubmitAccessory,
  canReviewAccessory,
  canConfirmAccessory,
  canWithdrawAccessory,
  canResubmitAccessory,
  canDeleteAccessory,
  getActiveMonth,
} from "./dal";
import { ACC_STATUS, ROLE } from "./constants";
import { ocrExtractFields, type OcrResult } from "./ocr";
import { ocrExtractFieldsVision } from "./ocr-vision";
import { checkAccessoryBlocks } from "./accessory-validate";
import { stampImage } from "./accessory-stamp";
import { uploadToDrive, isDriveEnabled, getOrCreateMonthFolder } from "./dropbox";

export type AccActionState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  blocks?: string[]; // 擋送原因（命中規則）
  ok?: boolean;
  requestId?: string;
  message?: string;
  values?: Record<string, string>;
};


type ImageInput = { data: string; mimeType: string; ocrRaw?: string };

// 前端只用 accept="image/*" 擋，那個很好繞過，這裡要真的驗證內容：
// mimeType 白名單 + 大小上限 + 用 sharp 實際解碼確認是真的圖片（不是隨便一個
// 偽造 mimeType 的檔案），三個都過才收。OCR 觸發點跟正式送單都要過這關，
// 不然畸形/偽造檔案可以繞過送單驗證直接打到 OCR API 浪費額度或讓 sharp 掛掉
const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 單張 8MB（server action 總上限 10MB）
// base64 比原始 bytes 大約膨脹 4/3，解碼前先擋，不然超大字串在真正檢查大小之前
// 就已經整個進了記憶體
const MAX_BASE64_LENGTH = Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 1024;
const MAX_IMAGE_PIXELS = 20_000_000; // 檔案可能不大但解壓後像素超大，另外擋
const FORMAT_TO_MIME: Record<string, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

async function validateImage(base64: string, mimeType: string): Promise<string | undefined> {
  if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
    return `不支援的圖片格式：${mimeType}`;
  }
  if (base64.length > MAX_BASE64_LENGTH) {
    return "圖片資料過大";
  }
  let buf: Buffer;
  try {
    buf = Buffer.from(base64, "base64");
  } catch {
    return "圖片資料損毀，請重新上傳";
  }
  if (buf.length === 0 || buf.length > MAX_IMAGE_BYTES) {
    return "圖片檔案過大或損毀（單張上限 8MB）";
  }
  let meta: Metadata;
  try {
    meta = await sharp(buf).metadata();
    if (!meta.width || !meta.height) throw new Error("no dimensions");
  } catch {
    return "圖片內容無法辨識，請確認檔案未毀損、重新上傳";
  }
  if (meta.width * meta.height > MAX_IMAGE_PIXELS) {
    return "圖片解析度過大";
  }
  // 宣告的 mimeType 跟 sharp 實際解出來的格式要一致，不然是偽裝過副檔名/mimeType
  if (!meta.format || FORMAT_TO_MIME[meta.format] !== mimeType) {
    return "圖片格式與檔案內容不一致";
  }
  return undefined;
}

function emptyOcrResult(error: string): OcrResult {
  return {
    fields: {
      dataNo: "",
      storeCode: "",
      salesName: "",
      customerName: "",
      carModel: "",
      accessoryNameQty: "",
      remarks: "",
    },
    raw: "",
    ok: false,
    error,
  };
}

// 圖片辨識：表單「辨識」按鈕呼叫（直接傳 base64＋mime）
export async function ocrAccessory(
  base64: string,
  mimeType: string
): Promise<OcrResult> {
  const user = await requireUser();
  if (!canSubmitAccessory(user)) return emptyOcrResult("您沒有配件變更申請權限");
  const imgError = await validateImage(base64, mimeType);
  if (imgError) return emptyOcrResult(imgError);
  return ocrExtractFields({ data: base64, mimeType });
}

// 圖片辨識測試：Google Cloud Vision 版（與上方 Gemini 版並存，供比較測試用）
export async function ocrAccessoryVision(
  base64: string,
  mimeType: string
): Promise<OcrResult & { elapsedMs?: number }> {
  const user = await requireUser();
  if (!canSubmitAccessory(user)) return emptyOcrResult("您沒有配件變更申請權限");
  const imgError = await validateImage(base64, mimeType);
  if (imgError) return emptyOcrResult(imgError);
  return ocrExtractFieldsVision({ data: base64, mimeType });
}

const TEXT_FIELDS = [
  "dataNo",
  "storeCode",
  "salesName",
  "customerName",
  "carModel",
  "deptCode",
  "accessoryNameQty",
  "accessoryBefore",
  "accessoryAfter",
  "changeDescription",
] as const;

function extractValues(fd: FormData): Record<string, string> {
  const v: Record<string, string> = {};
  for (const f of TEXT_FIELDS) v[f] = String(fd.get(f) ?? "");
  return v;
}

async function parseImages(
  fd: FormData
): Promise<{ images: ImageInput[]; error?: string }> {
  let arr: unknown;
  try {
    arr = JSON.parse(String(fd.get("imagesJson") ?? "[]"));
  } catch {
    return { images: [] };
  }
  if (!Array.isArray(arr)) return { images: [] };

  const images: ImageInput[] = [];
  for (const x of arr) {
    if (!x || typeof x.data !== "string" || typeof x.mimeType !== "string") continue;
    const error = await validateImage(x.data, x.mimeType);
    if (error) return { images: [], error };
    images.push({ data: x.data, mimeType: x.mimeType, ocrRaw: x.ocrRaw });
  }
  return { images };
}

// 送單／存草稿
export async function createAccessoryRequest(
  _prev: AccActionState,
  formData: FormData
): Promise<AccActionState> {
  const user = await requireUser();
  if (!canSubmitAccessory(user)) return { error: "您沒有配件變更申請權限" };

  const intent = String(formData.get("intent") ?? "submit");
  const values = extractValues(formData);
  const { images, error: imageError } = await parseImages(formData);
  if (imageError) return { error: imageError, values };
  const dataNo = values.dataNo.trim().toUpperCase();
  const month = await getActiveMonth();

  // ---- 草稿：寬鬆存檔，不擋 ----
  if (intent === "draft") {
    if (!dataNo)
      return {
        fieldErrors: { dataNo: "草稿仍需填資料編號（作為唯一鍵）" },
        values,
      };
    try {
      const created = await prisma.accessoryRequest.create({
        data: {
          dataNo,
          month,
          storeCode: values.storeCode.trim().toUpperCase(),
          salesName: values.salesName.trim(),
          customerName: values.customerName.trim(),
          carModel: values.carModel.trim(),
          deptCode: values.deptCode.trim() || null,
          accessoryNameQty: values.accessoryNameQty.trim(),
          accessoryBefore: values.accessoryBefore.trim(),
          accessoryAfter: values.accessoryAfter.trim(),
          changeDescription: values.changeDescription.trim(),
          status: ACC_STATUS.DRAFT,
          submittedById: user.id,
          images: {
            create: images.map((img, i) => ({
              mimeType: img.mimeType,
              imageData: img.data,
              ocrRaw: img.ocrRaw ?? null,
              sortOrder: i,
            })),
          },
          logs: {
            create: { step: "DRAFT", action: "SAVE_DRAFT", reviewerId: user.id },
          },
        },
      });
      return { ok: true, requestId: created.id, message: "草稿已儲存。" };
    } catch (e: unknown) {
      if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
        return { fieldErrors: { dataNo: "此資料編號已存在（全系統唯一）" }, values };
      }
      throw e;
    }
  }

  // ---- 正式送出：必填驗證（OCR 沒辨識出來就要求手動填，不能空著送出）----
  const fieldErrors: Record<string, string> = {};
  if (!dataNo) fieldErrors.dataNo = "必填";
  if (!values.storeCode.trim()) fieldErrors.storeCode = "必填";
  if (!values.deptCode.trim()) fieldErrors.deptCode = "必填";
  if (!values.salesName.trim()) fieldErrors.salesName = "必填";
  if (!values.customerName.trim()) fieldErrors.customerName = "必填";
  if (!values.carModel.trim()) fieldErrors.carModel = "必填";
  if (!values.changeDescription.trim()) fieldErrors.changeDescription = "必填";
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors, values };

  // ---- 警示規則（命中只標紅字警告，仍可送出）----
  const warnings = checkAccessoryBlocks({
    dataNo,
    accessoryBefore: values.accessoryBefore,
    accessoryAfter: values.accessoryAfter,
    changeDescription: values.changeDescription,
    accessoryNameQty: values.accessoryNameQty,
  });

  // ---- 建立申請單 ----
  try {
    const created = await prisma.accessoryRequest.create({
      data: {
        dataNo,
        month,
        storeCode: values.storeCode.trim().toUpperCase(),
        salesName: values.salesName.trim(),
        customerName: values.customerName.trim(),
        carModel: values.carModel.trim(),
        deptCode: values.deptCode.trim() || null,
        accessoryNameQty: values.accessoryNameQty.trim(),
        accessoryBefore: values.accessoryBefore.trim(),
        accessoryAfter: values.accessoryAfter.trim(),
        changeDescription: values.changeDescription.trim(),
        warningFlag: warnings.length > 0,
        warningText: warnings.length > 0 ? warnings.join("；") : null,
        status: ACC_STATUS.PENDING_REVIEW,
        submittedById: user.id,
        images: {
          create: images.map((img, i) => ({
            mimeType: img.mimeType,
            imageData: img.data,
            ocrRaw: img.ocrRaw ?? null,
            sortOrder: i,
          })),
        },
        logs: {
          create: { step: "SUBMIT", action: "SUBMIT", reviewerId: user.id },
        },
      },
    });
    return { ok: true, requestId: created.id, message: "申請已送出，等待部長審核。" };
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return { fieldErrors: { dataNo: "此資料編號已存在（全系統唯一）" }, values };
    }
    throw e;
  }
}

// ---- 編輯後重送／存草稿（申請者對已退件、已撤回、草稿案件）----
export async function editAccessoryRequest(
  _prev: AccActionState,
  formData: FormData
): Promise<AccActionState> {
  const user = await requireUser();

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "缺少案件 ID" };

  const existing = await prisma.accessoryRequest.findUnique({ where: { id } });
  if (!existing) return { error: "案件不存在" };
  if (!canResubmitAccessory(user, existing)) return { error: "此案件無法編輯" };

  const intent = String(formData.get("intent") ?? "submit");
  const values = extractValues(formData);
  const { images, error: imageError } = await parseImages(formData);
  if (imageError) return { error: imageError, values };
  const dataNo = values.dataNo.trim().toUpperCase();
  const isSubmit = intent === "submit";

  const fieldErrors: Record<string, string> = {};
  if (!dataNo) fieldErrors.dataNo = "資料編號必填";
  if (isSubmit) {
    if (!values.storeCode.trim()) fieldErrors.storeCode = "必填";
    if (!values.deptCode.trim()) fieldErrors.deptCode = "必填";
    if (!values.salesName.trim()) fieldErrors.salesName = "必填";
    if (!values.customerName.trim()) fieldErrors.customerName = "必填";
    if (!values.carModel.trim()) fieldErrors.carModel = "必填";
    if (!values.changeDescription.trim()) fieldErrors.changeDescription = "必填";
  }
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors, values };

  try {
    await prisma.$transaction([
      prisma.accessoryImage.deleteMany({ where: { requestId: id } }),
      prisma.accessoryRequest.update({
        where: { id },
        data: {
          dataNo,
          storeCode: values.storeCode.trim().toUpperCase(),
          salesName: values.salesName.trim(),
          customerName: values.customerName.trim(),
          carModel: values.carModel.trim(),
          deptCode: values.deptCode.trim() || null,
          accessoryNameQty: values.accessoryNameQty.trim(),
          accessoryBefore: values.accessoryBefore.trim(),
          accessoryAfter: values.accessoryAfter.trim(),
          changeDescription: values.changeDescription.trim(),
          status: isSubmit ? ACC_STATUS.PENDING_REVIEW : ACC_STATUS.DRAFT,
          ...(isSubmit ? { submittedAt: new Date() } : {}),
          images: {
            create: images.map((img, i) => ({
              mimeType: img.mimeType,
              imageData: img.data,
              ocrRaw: img.ocrRaw ?? null,
              sortOrder: i,
            })),
          },
          logs: {
            create: isSubmit
              ? { step: "SUBMIT", action: "RESUBMIT", reviewerId: user.id }
              : { step: "DRAFT", action: "SAVE_DRAFT", reviewerId: user.id },
          },
        },
      }),
    ]);
    return {
      ok: true,
      requestId: id,
      message: isSubmit ? "已重新送出，等待部長審核。" : "草稿已更新。",
    };
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return { fieldErrors: { dataNo: "此資料編號已存在（全系統唯一）" }, values };
    }
    throw e;
  }
}

// ---- 申請者撤回（待審核時）----
export async function withdrawAccessory(formData: FormData): Promise<void> {
  const user = await requireUser();

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("缺少案件 ID");

  const r = await prisma.accessoryRequest.findUnique({ where: { id } });
  if (!r) throw new Error("案件不存在");
  if (!canWithdrawAccessory(user, r)) throw new Error("此案件無法撤回");

  await prisma.accessoryRequest.update({
    where: { id },
    data: {
      status: ACC_STATUS.WITHDRAWN,
      logs: {
        create: { step: "WITHDRAWN", action: "WITHDRAW", reviewerId: user.id },
      },
    },
  });

  redirect(`/accessory/${id}`);
}

// ---- 申請者刪除（草稿／已退件／已撤回）----
export async function deleteAccessory(formData: FormData): Promise<void> {
  const user = await requireUser();

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("缺少案件 ID");

  const r = await prisma.accessoryRequest.findUnique({ where: { id } });
  if (!r) throw new Error("案件不存在");
  if (!canDeleteAccessory(user, r)) throw new Error("此案件無法刪除");

  await prisma.$transaction([
    prisma.accessoryLog.deleteMany({ where: { requestId: id } }),
    prisma.accessoryImage.deleteMany({ where: { requestId: id } }),
    prisma.accessoryRequest.delete({ where: { id } }),
  ]);

  redirect("/accessory");
}

// ---- 部長核准 ----
export async function approveAccessory(formData: FormData): Promise<void> {
  const user = await requireUser();

  const id = String(formData.get("id") ?? "");
  const remark = String(formData.get("remark") ?? "").trim();
  if (!id) throw new Error("缺少案件 ID");

  const r = await prisma.accessoryRequest.findUnique({
    where: { id },
    include: { images: { orderBy: { sortOrder: "asc" } } },
  });

  if (!r) throw new Error("案件不存在");
  if (!canReviewAccessory(user, r)) throw new Error("您沒有權限審核此案件");

  // 蓋章第一張圖片（如果存在且有 base64）
  const firstImg = r.images[0];
  let stampedData: string | null = null;
  if (firstImg?.imageData) {
    const date = new Date().toLocaleDateString("zh-TW");
    stampedData = await stampImage(firstImg.imageData, firstImg.mimeType, user.name, date);
  }

  await prisma.accessoryRequest.update({
    where: { id },
    data: {
      status: ACC_STATUS.APPROVED,
      ...(firstImg && stampedData
        ? {
            images: {
              update: {
                where: { id: firstImg.id },
                data: { stampedData },
              },
            },
          }
        : {}),
      logs: {
        create: {
          step: "APPROVED",
          action: "APPROVE",
          reviewerId: user.id,
          ...(remark ? { comment: remark } : {}),
        },
      },
    },
  });

  // 注意：Drive 歸檔統一在「確認結案」時執行（帳號/月份資料夾結構），
  // 核准階段只蓋章存 DB，不上傳，以免提前設 driveFileId 導致確認時跳過上傳。

  redirect("/accessory/review");
}

// ---- 部長整批核准（僅核准，駁回需填原因故維持單筆）----
export async function bulkApproveAccessory(
  _prev: AccActionState,
  formData: FormData
): Promise<AccActionState> {
  const user = await requireUser();
  if (user.role !== ROLE.BUZHUGUAN) return { error: "您沒有權限執行整批核准" };

  const ids = formData.getAll("ids").map(String).filter(Boolean);
  if (ids.length === 0) return { error: "請先選擇要核准的案件" };

  const requests = await prisma.accessoryRequest.findMany({
    where: { id: { in: ids } },
    include: { images: { orderBy: { sortOrder: "asc" } } },
  });
  const reviewable = requests.filter((r) => canReviewAccessory(user, r));
  if (reviewable.length === 0) return { error: "所選案件已不在待審核狀態，請重新整理" };

  for (const r of reviewable) {
    const firstImg = r.images[0];
    let stampedData: string | null = null;
    if (firstImg?.imageData) {
      const date = new Date().toLocaleDateString("zh-TW");
      stampedData = await stampImage(firstImg.imageData, firstImg.mimeType, user.name, date);
    }
    await prisma.accessoryRequest.update({
      where: { id: r.id },
      data: {
        status: ACC_STATUS.APPROVED,
        ...(firstImg && stampedData
          ? { images: { update: { where: { id: firstImg.id }, data: { stampedData } } } }
          : {}),
        logs: { create: { step: "APPROVED", action: "APPROVE", reviewerId: user.id } },
      },
    });
  }

  revalidatePath("/accessory/review");
  return { ok: true, message: `已核准 ${reviewable.length} 筆案件` };
}

// ---- 部長駁回 ----
export async function rejectAccessory(formData: FormData): Promise<void> {
  const user = await requireUser();

  const id = String(formData.get("id") ?? "");
  const remark = String(formData.get("remark") ?? "").trim();

  if (!id) throw new Error("缺少案件 ID");

  const r = await prisma.accessoryRequest.findUnique({ where: { id } });
  if (!r) throw new Error("案件不存在");
  if (!canReviewAccessory(user, r)) throw new Error("您沒有權限審核此案件");

  await prisma.accessoryRequest.update({
    where: { id },
    data: {
      status: ACC_STATUS.REJECTED,
      logs: {
        create: {
          step: "REJECTED",
          action: "REJECT",
          reviewerId: user.id,
          ...(remark ? { comment: remark } : {}),
        },
      },
    },
  });

  redirect("/accessory/review");
}

type ConfirmableRequest = {
  id: string;
  dataNo: string;
  month: string;
  images: {
    id: string;
    mimeType: string;
    sortOrder: number;
    driveFileId: string | null;
    stampedData: string | null;
    imageData: string | null;
  }[];
};

// 確認結案的核心邏輯（單筆／整批共用）：更新狀態、歸檔 Dropbox、清空已歸檔的 base64
async function confirmOne(
  r: ConfirmableRequest,
  user: { id: string; username: string },
  remark?: string
): Promise<void> {
  await prisma.accessoryRequest.update({
    where: { id: r.id },
    data: {
      status: ACC_STATUS.CONFIRMED,
      logs: {
        create: {
          step: "CONFIRMED",
          action: "CONFIRM",
          reviewerId: user.id,
          ...(remark ? { comment: remark } : {}),
        },
      },
    },
  });

  // 歸檔至 Dropbox — 用戶帳號為資料夾名稱，按月份分資料夾。失敗不阻斷結案。
  if (isDriveEnabled()) {
    try {
      // 先取得或建立用戶帳號資料夾，再建月份子資料夾
      const userFolderId = await getOrCreateMonthFolder(user.username);
      const monthFolderId = await getOrCreateMonthFolder(r.month, userFolderId);
      for (const img of r.images) {
        // 只上傳尚未歸檔的圖片（無 driveFileId）
        if (!img.driveFileId) {
          const base64 = img.stampedData || img.imageData;
          if (!base64) continue;
          try {
            const fileId = await uploadToDrive(
              `${r.dataNo}${r.images.length > 1 ? `_${img.sortOrder + 1}` : ""}.jpg`,
              img.mimeType,
              Buffer.from(base64, "base64"),
              monthFolderId
            );
            await prisma.accessoryImage.update({
              where: { id: img.id },
              data: { driveFileId: fileId },
            });
          } catch (e) {
            console.error(`[drive] 上傳失敗 ${r.dataNo}:`, e instanceof Error ? e.message : e);
          }
        }
      }
    } catch (e) {
      console.error("[drive] 月份資料夾建立失敗:", e instanceof Error ? e.message : e);
    }
  }

  // 結案後清空已歸檔 Drive 的 base64（省 DB 空間；未歸檔者保留）
  await prisma.accessoryImage.updateMany({
    where: { requestId: r.id, driveFileId: { not: null } },
    data: { imageData: null, stampedData: null },
  });
}

// ---- 配件中心確認（結案）----
export async function confirmAccessory(formData: FormData): Promise<void> {
  const user = await requireUser();

  const id = String(formData.get("id") ?? "");
  const remark = String(formData.get("remark") ?? "").trim();
  if (!id) throw new Error("缺少案件 ID");

  const r = await prisma.accessoryRequest.findUnique({
    where: { id },
    include: { images: { orderBy: { sortOrder: "asc" } } },
  });
  if (!r) throw new Error("案件不存在");
  if (!canConfirmAccessory(user, r)) throw new Error("您沒有權限確認此案件");

  await confirmOne(r, user, remark);

  redirect("/accessory/confirm");
}

// ---- 配件中心整批確認結案（僅結案，退回需填原因故維持單筆）----
export async function bulkConfirmAccessory(
  _prev: AccActionState,
  formData: FormData
): Promise<AccActionState> {
  const user = await requireUser();
  if (user.role !== ROLE.PEIJIAN) return { error: "您沒有權限執行整批確認" };

  const ids = formData.getAll("ids").map(String).filter(Boolean);
  if (ids.length === 0) return { error: "請先選擇要確認的案件" };

  const requests = await prisma.accessoryRequest.findMany({
    where: { id: { in: ids } },
    include: { images: { orderBy: { sortOrder: "asc" } } },
  });
  const confirmable = requests.filter((r) => canConfirmAccessory(user, r));
  if (confirmable.length === 0) return { error: "所選案件已不在待確認狀態，請重新整理" };

  for (const r of confirmable) {
    await confirmOne(r, user);
  }

  revalidatePath("/accessory/confirm");
  return { ok: true, message: `已確認結案 ${confirmable.length} 筆案件` };
}

// ---- 配件中心退回重審（打回部長）----
export async function returnAccessory(formData: FormData): Promise<void> {
  const user = await requireUser();

  const id = String(formData.get("id") ?? "");
  const remark = String(formData.get("remark") ?? "").trim();
  if (!id) throw new Error("缺少案件 ID");

  const r = await prisma.accessoryRequest.findUnique({ where: { id } });
  if (!r) throw new Error("案件不存在");
  if (!canConfirmAccessory(user, r)) throw new Error("您沒有權限退回此案件");

  await prisma.accessoryRequest.update({
    where: { id },
    data: {
      status: ACC_STATUS.PENDING_REVIEW,
      logs: {
        create: {
          step: "RETURN",
          action: "RETURN",
          reviewerId: user.id,
          ...(remark ? { comment: remark } : {}),
        },
      },
    },
  });

  redirect("/accessory/confirm");
}

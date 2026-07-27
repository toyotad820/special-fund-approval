"use server";

import { prisma } from "./prisma";
import { requireUser } from "./session";
import { canSubmitAccessory } from "./dal";
import { ACC_STATUS } from "./constants";
import { ocrExtractFields, type OcrResult } from "./ocr";
import { checkAccessoryBlocks } from "./accessory-validate";

export type AccActionState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  blocks?: string[]; // 擋送原因（命中規則）
  ok?: boolean;
  requestId?: string;
  message?: string;
  values?: Record<string, string>;
};

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// 圖片辨識：表單「辨識」按鈕呼叫（直接傳 base64＋mime）
export async function ocrAccessory(
  base64: string,
  mimeType: string
): Promise<OcrResult> {
  const user = await requireUser();
  if (!canSubmitAccessory(user)) {
    return {
      fields: {
        dataNo: "",
        storeCode: "",
        salesName: "",
        customerName: "",
        carModel: "",
      },
      raw: "",
      ok: false,
      error: "您沒有配件變更申請權限",
    };
  }
  return ocrExtractFields({ data: base64, mimeType });
}

type ImageInput = { data: string; mimeType: string; ocrRaw?: string };

const TEXT_FIELDS = [
  "dataNo",
  "storeCode",
  "salesName",
  "customerName",
  "carModel",
  "accessoryBefore",
  "accessoryAfter",
  "changeDescription",
] as const;

function extractValues(fd: FormData): Record<string, string> {
  const v: Record<string, string> = {};
  for (const f of TEXT_FIELDS) v[f] = String(fd.get(f) ?? "");
  return v;
}

function parseImages(fd: FormData): ImageInput[] {
  try {
    const raw = String(fd.get("imagesJson") ?? "[]");
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((x) => x && typeof x.data === "string" && typeof x.mimeType === "string")
      .map((x) => ({ data: x.data, mimeType: x.mimeType, ocrRaw: x.ocrRaw }));
  } catch {
    return [];
  }
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
  const ocrDataNo = String(formData.get("ocrDataNo") ?? "");
  const images = parseImages(formData);
  const dataNo = values.dataNo.trim().toUpperCase();

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
          month: currentMonth(),
          storeCode: values.storeCode.trim().toUpperCase(),
          salesName: values.salesName.trim(),
          customerName: values.customerName.trim(),
          carModel: values.carModel.trim(),
          accessoryNameQty: "",
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

  // ---- 正式送出：必填驗證 ----
  const fieldErrors: Record<string, string> = {};
  for (const f of TEXT_FIELDS) {
    if (!values[f].trim()) fieldErrors[f] = "必填";
  }
  if (images.length === 0) fieldErrors.imagesJson = "請至少上傳一張工單圖片";
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors, values };

  // ---- 擋送規則（命中任一即不許送出）----
  const blocks = checkAccessoryBlocks(
    {
      dataNo,
      accessoryBefore: values.accessoryBefore,
      accessoryAfter: values.accessoryAfter,
      changeDescription: values.changeDescription,
    },
    ocrDataNo
  );
  if (blocks.length > 0) return { blocks, values };

  // ---- 建立申請單 ----
  try {
    const created = await prisma.accessoryRequest.create({
      data: {
        dataNo,
        month: currentMonth(),
        storeCode: values.storeCode.trim().toUpperCase(),
        salesName: values.salesName.trim(),
        customerName: values.customerName.trim(),
        carModel: values.carModel.trim(),
        accessoryNameQty: "",
        accessoryBefore: values.accessoryBefore.trim(),
        accessoryAfter: values.accessoryAfter.trim(),
        changeDescription: values.changeDescription.trim(),
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

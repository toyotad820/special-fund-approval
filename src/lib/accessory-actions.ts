"use server";

import { redirect } from "next/navigation";
import { prisma } from "./prisma";
import { requireUser } from "./session";
import {
  canSubmitAccessory,
  canReviewAccessory,
  canConfirmAccessory,
  canWithdrawAccessory,
  canResubmitAccessory,
} from "./dal";
import { ACC_STATUS, ACTION_LABEL } from "./constants";
import { ocrExtractFields, type OcrResult } from "./ocr";
import { checkAccessoryBlocks } from "./accessory-validate";
import { stampImage } from "./accessory-stamp";

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
        remarks: "",
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

  // ---- 正式送出：最小必填驗證 ----
  const fieldErrors: Record<string, string> = {};
  // 只要求資料編號（允許其他欄位手動填寫或留空用於測試）
  if (!dataNo) fieldErrors.dataNo = "必填";
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
  const images = parseImages(formData);
  const dataNo = values.dataNo.trim().toUpperCase();

  if (!dataNo)
    return { fieldErrors: { dataNo: "資料編號必填" }, values };

  const isSubmit = intent === "submit";

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

  redirect("/accessory/review");
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

// ---- 配件中心確認（結案）----
export async function confirmAccessory(formData: FormData): Promise<void> {
  const user = await requireUser();

  const id = String(formData.get("id") ?? "");
  const remark = String(formData.get("remark") ?? "").trim();
  if (!id) throw new Error("缺少案件 ID");

  const r = await prisma.accessoryRequest.findUnique({ where: { id } });
  if (!r) throw new Error("案件不存在");
  if (!canConfirmAccessory(user, r)) throw new Error("您沒有權限確認此案件");

  await prisma.accessoryRequest.update({
    where: { id },
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

  redirect("/accessory/confirm");
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

"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createAccessoryRequest,
  editAccessoryRequest,
  ocrAccessory,
  ocrAccessoryVision,
  type AccActionState,
} from "@/lib/accessory-actions";
import {
  checkAccessoryBlocks,
  splitAccessoryItems,
  accessoryItemQty,
} from "@/lib/accessory-validate";

type ImageItem = { data: string; mimeType: string; ocrRaw?: string; name: string };

const EMPTY_FIELDS = {
  dataNo: "",
  storeCode: "",
  salesName: "",
  customerName: "",
  carModel: "",
  deptCode: "",
  accessoryNameQty: "",
  accessoryBefore: "",
  accessoryAfter: "",
  changeDescription: "",
};
type Fields = typeof EMPTY_FIELDS;

export type AccessoryInitial = {
  id: string;
  fields: Fields;
  images: ImageItem[];
  userRole?: string;
  userDeptCode?: string | null;
  deptOptions?: { code: string; label: string }[];
};

// 前端壓縮：長邊縮到 1600px、輸出 JPEG，降低體積與 OCR 成本，並避開 server action body 上限
function fileToCompressedBase64(
  file: File
): Promise<{ data: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 1600;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("canvas 不支援"));
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        resolve({ data: dataUrl.split(",")[1], mimeType: "image/jpeg" });
      };
      img.onerror = () => reject(new Error("圖片載入失敗"));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error("讀檔失敗"));
    reader.readAsDataURL(file);
  });
}

export default function AccessoryForm({ initial }: { initial?: AccessoryInitial }) {
  const router = useRouter();
  const isEdit = !!initial?.id;
  const [state, formAction, pending] = useActionState<AccActionState, FormData>(
    isEdit ? editAccessoryRequest : createAccessoryRequest,
    {}
  );
  const formRef = useRef<HTMLFormElement>(null);
  const intentRef = useRef<HTMLInputElement>(null);

  const userRole = initial?.userRole;
  const userDeptCode = initial?.userDeptCode;
  const deptOptions = initial?.deptOptions ?? [];
  const isKezhang = userRole === "KEZHANG";
  const isDeptCodeReadonly = isKezhang && userDeptCode;

  const [images, setImages] = useState<ImageItem[]>(initial?.images ?? []);
  const [fields, setFields] = useState<Fields>(initial?.fields ?? EMPTY_FIELDS);
  const [ocrDataNo, setOcrDataNo] = useState("");
  const [ocrRunning, setOcrRunning] = useState(false);
  const [ocrMsg, setOcrMsg] = useState<string | null>(null);
  const [ocrElapsed, setOcrElapsed] = useState<number | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  const set = (k: keyof Fields, v: string) =>
    setFields((f) => ({ ...f, [k]: v }));

  const onPick = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const added: ImageItem[] = [];
    for (const file of Array.from(files)) {
      try {
        const { data, mimeType } = await fileToCompressedBase64(file);
        added.push({ data, mimeType, name: file.name });
      } catch {
        /* 略過壞檔 */
      }
    }
    setImages((prev) => [...prev, ...added]);
  };

  const removeImage = (i: number) =>
    setImages((prev) => prev.filter((_, idx) => idx !== i));

  const runOcr = async (provider: "gemini" | "vision" = "gemini") => {
    if (images.length === 0) {
      setOcrElapsed(null);
      setOcrMsg("請先上傳工單圖片");
      return;
    }
    setOcrRunning(true);
    setOcrMsg(null);
    setOcrElapsed(null);
    try {
      const first = images[0];
      const t0 = Date.now();
      const res =
        provider === "vision"
          ? await ocrAccessoryVision(first.data, first.mimeType)
          : await ocrAccessory(first.data, first.mimeType);
      const elapsed = Date.now() - t0;
      if (!res.ok) {
        setOcrDataNo("");
        setOcrElapsed(elapsed);
        setOcrMsg(res.error || "辨識失敗，請重新上傳清晰的工單圖片");
        return;
      }
      const f = res.fields;
      // 用「更換/替換/升級/換/改」等字眼分割 remarks 到變更前/後（較長字眼優先比對，避免切錯字）
      let before = fields.accessoryBefore;
      let after = fields.accessoryAfter;
      if (f.remarks) {
        const SPLIT_KEYWORDS = ["不裝升級", "更換", "替換", "升級", "換", "改"];
        for (const kw of SPLIT_KEYWORDS) {
          const idx = f.remarks.indexOf(kw);
          if (idx > -1) {
            before = f.remarks.slice(0, idx).trim();
            after = f.remarks.slice(idx + kw.length).trim();
            break;
          }
        }
      }
      setFields((prev) => ({
        ...prev,
        dataNo: f.dataNo || prev.dataNo,
        storeCode: f.storeCode || prev.storeCode,
        salesName: f.salesName || prev.salesName,
        customerName: f.customerName || prev.customerName,
        carModel: f.carModel || prev.carModel,
        accessoryNameQty: f.accessoryNameQty || prev.accessoryNameQty,
        accessoryBefore: before,
        accessoryAfter: after,
        changeDescription: f.remarks || prev.changeDescription,
      }));
      setOcrDataNo(f.dataNo);
      setImages((prev) =>
        prev.map((img, idx) => (idx === 0 ? { ...img, ocrRaw: res.raw } : img))
      );
      setOcrElapsed(elapsed);
      setOcrMsg("辨識完成，請核對欄位後送出。");
    } finally {
      setOcrRunning(false);
    }
  };

  // 即時警示檢查（只顯示紅字警告，不阻擋送出）
  const warnings = useMemo(
    () =>
      checkAccessoryBlocks({
        dataNo: fields.dataNo,
        accessoryBefore: fields.accessoryBefore,
        accessoryAfter: fields.accessoryAfter,
        changeDescription: fields.changeDescription,
        accessoryNameQty: fields.accessoryNameQty,
      }),
    [fields]
  );

  // 正式送出必填：資料編號/所別/課別(所長可留空視為所層級)/員編姓名/客戶名稱/車名/更換說明；
  // OCR 沒辨識出來就要求手動填，不能空著送出（警示規則另外處理，不擋送）
  const canSubmit =
    !pending &&
    !!fields.dataNo.trim() &&
    !!fields.storeCode.trim() &&
    (isKezhang || !!fields.deptCode.trim()) &&
    !!fields.salesName.trim() &&
    !!fields.customerName.trim() &&
    !!fields.carModel.trim() &&
    !!fields.changeDescription.trim();

  // 送出成功 → 導回列表（編輯模式回該案件明細）
  // 注意：新增模式不能導去 /accessory，該路徑對課長/所長會 redirect 回 /accessory/new，等於繞回空白表單
  if (state.ok && state.requestId) {
    router.push(isEdit ? `/accessory/${initial!.id}` : "/accessory/list");
  }

  const submit = (intent: "draft" | "submit") => {
    if (intentRef.current) intentRef.current.value = intent;
    formRef.current?.requestSubmit();
  };

  const inputCls =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500";
  // 欄位值已被使用者改過（不等於觸發此錯誤當下送出的值）就不再顯示舊錯誤，
  // 否則例如資料編號重複警告，換成新編號後仍會殘留舊訊息
  const err = (k: string) => {
    const message = state.fieldErrors?.[k];
    if (!message) return undefined;
    const fieldsAsRecord = fields as Record<string, string>;
    if (state.values && k in fieldsAsRecord && state.values[k] !== fieldsAsRecord[k]) {
      return undefined;
    }
    return message;
  };

  return (
    <form ref={formRef} action={formAction} className="space-y-5">
      <input ref={intentRef} type="hidden" name="intent" defaultValue="submit" />
      {isEdit && <input type="hidden" name="id" value={initial!.id} />}
      <input type="hidden" name="ocrDataNo" value={ocrDataNo} />
      <input type="hidden" name="imagesJson" value={JSON.stringify(images)} />

      {/* 圖片上傳 */}
      <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">
          OPT 工單圖片 <span className="text-rose-500">*</span>
        </h2>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => onPick(e.target.files)}
          className="block text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-blue-700 hover:file:bg-blue-100"
        />
        {err("imagesJson") && (
          <p className="text-xs text-rose-600">{err("imagesJson")}</p>
        )}
        {images.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {images.map((img, i) => (
              <div key={i} className="relative">
                <button
                  type="button"
                  onClick={() => setPreviewIndex(i)}
                  className="block"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- 本機預覽 base64 縮圖 */}
                  <img
                    src={`data:${img.mimeType};base64,${img.data}`}
                    alt={img.name}
                    className="w-24 h-32 object-cover rounded-lg border border-slate-200"
                  />
                </button>
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="absolute -top-2 -right-2 w-6 h-6 grid place-items-center rounded-full bg-white border border-slate-300 text-slate-500 shadow-sm hover:text-rose-600"
                  aria-label="移除"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => runOcr("vision")}
            disabled={ocrRunning || images.length === 0}
            className="rounded-lg bg-slate-800 text-white px-4 py-2 text-sm font-medium hover:bg-slate-900 disabled:opacity-50"
          >
            辨識圖片
          </button>
          {ocrMsg &&
            (() => {
              const [firstLine, ...restLines] = ocrMsg.split(/(?<=，)/);
              return (
                <span className="flex flex-col leading-tight">
                  <span>
                    {ocrElapsed !== null && (
                      <span className="text-sm text-slate-500">{ocrElapsed}ms </span>
                    )}
                    <span className="text-base font-medium text-slate-700">{firstLine}</span>
                  </span>
                  {restLines.map((part, i) => (
                    <span key={i} className="text-base font-medium text-slate-700">
                      {part}
                    </span>
                  ))}
                </span>
              );
            })()}
        </div>
      </section>

      {/* 上傳圖片全螢幕預覽（點縮圖開啟，點背景或叉叉關閉） */}
      {previewIndex !== null && images[previewIndex] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2"
          onClick={() => setPreviewIndex(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- 本機預覽 base64 大圖 */}
          <img
            src={`data:${images[previewIndex].mimeType};base64,${images[previewIndex].data}`}
            alt={images[previewIndex].name}
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={() => setPreviewIndex(null)}
            className="absolute top-4 right-4 w-10 h-10 grid place-items-center rounded-full bg-black/50 text-white text-lg hover:bg-black/70 transition-colors"
            aria-label="關閉"
          >
            ✕
          </button>
        </div>
      )}

      {/* 辨識中：置中小視窗 */}
      {ocrRunning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl px-8 py-6 flex flex-col items-center gap-3">
            <svg
              className="animate-spin h-8 w-8 text-slate-700"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <span className="text-sm text-slate-700 font-medium">辨識中…</span>
          </div>
        </div>
      )}

      {/* 辨識填入欄位（可人工修改） */}
      <section className="bg-white rounded-2xl border border-slate-200 p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="資料編號" required error={err("dataNo")}>
          <input
            name="dataNo"
            value={fields.dataNo}
            onChange={(e) => set("dataNo", e.target.value.toUpperCase())}
            className={inputCls}
          />
        </Field>
        <Field label="所別" required error={err("storeCode")}>
          <input
            name="storeCode"
            value={fields.storeCode}
            onChange={(e) => set("storeCode", e.target.value.toUpperCase())}
            className={inputCls}
          />
        </Field>
        <Field label="課別" required={!isKezhang} error={err("deptCode")}>
          {isDeptCodeReadonly ? (
            <input
              type="text"
              name="deptCode"
              value={fields.deptCode}
              readOnly
              className={`${inputCls} bg-slate-100 cursor-not-allowed`}
            />
          ) : (
            <select
              name="deptCode"
              value={fields.deptCode}
              onChange={(e) => set("deptCode", e.target.value)}
              className={inputCls}
            >
              <option value="">-- 選擇課別 --</option>
              {deptOptions.map((opt) => (
                <option key={opt.code} value={opt.code}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="員編/姓名" required error={err("salesName")}>
          <input
            name="salesName"
            value={fields.salesName}
            onChange={(e) => set("salesName", e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="客戶名稱" required error={err("customerName")}>
          <input
            name="customerName"
            value={fields.customerName}
            onChange={(e) => set("customerName", e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="車名" required error={err("carModel")}>
          <input
            name="carModel"
            value={fields.carModel}
            onChange={(e) => set("carModel", e.target.value)}
            className={inputCls}
          />
        </Field>
      </section>

      {/* 人工填寫欄位 */}
      <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
        <Field label="配件/數量" error={err("accessoryNameQty")}>
          <textarea
            name="accessoryNameQty"
            rows={6}
            value={fields.accessoryNameQty}
            onChange={(e) => set("accessoryNameQty", e.target.value)}
            className={inputCls}
          />
          <AccessoryItemsPreview text={fields.accessoryNameQty} />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="變更前配件" error={err("accessoryBefore")}>
            <textarea
              name="accessoryBefore"
              rows={2}
              value={fields.accessoryBefore}
              onChange={(e) => set("accessoryBefore", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="變更後配件" error={err("accessoryAfter")}>
            <textarea
              name="accessoryAfter"
              rows={2}
              value={fields.accessoryAfter}
              onChange={(e) => set("accessoryAfter", e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>
        <Field label="更換說明" required error={err("changeDescription")}>
          <textarea
            name="changeDescription"
            rows={3}
            value={fields.changeDescription}
            onChange={(e) => set("changeDescription", e.target.value)}
            className={inputCls}
          />
        </Field>
      </section>

      {/* 錯誤 / 擋送提示 */}
      {state.error && (
        <p className="text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2">
          {state.error}
        </p>
      )}
      {(warnings.length > 0 || (state.blocks?.length ?? 0) > 0) && (
        <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3">
          <p className="text-sm font-semibold text-rose-700 mb-1">
            ⚠ 警告（仍可送出，審核方會看到此標記）：
          </p>
          <ul className="list-disc list-inside text-sm text-rose-600 space-y-0.5">
            {(warnings.length > 0 ? warnings : state.blocks ?? []).map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 動作 */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => submit("submit")}
          disabled={!canSubmit}
          className="flex-1 rounded-lg bg-blue-600 text-white py-2.5 font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {pending ? "送出中…" : isEdit ? "重新送出" : "送出申請"}
        </button>
        <button
          type="button"
          onClick={() => submit("draft")}
          disabled={pending || !fields.dataNo.trim()}
          className="rounded-lg border border-slate-300 text-slate-600 px-4 py-2.5 text-sm hover:bg-slate-50 disabled:opacity-50"
        >
          存草稿
        </button>
      </div>
    </form>
  );
}

// 唯讀色彩預覽：只列出上方文字框裡數量 >1 的品項，標紅提醒，方便一眼看出異常；
// 數量正常的品項不重複顯示。不阻擋、不強制格式——文字框本身仍可自由編輯，隨內容即時重算。
function AccessoryItemsPreview({ text }: { text: string }) {
  const flagged = splitAccessoryItems(text).filter((item) => {
    const qty = accessoryItemQty(item);
    return qty !== null && qty > 1;
  });
  if (flagged.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {flagged.map((item, i) => (
        <span
          key={i}
          className="inline-block rounded-md px-2 py-1 text-xs bg-rose-100 text-rose-700 font-medium"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm text-slate-600 mb-1">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-rose-600 mt-1">{error}</p>}
    </div>
  );
}

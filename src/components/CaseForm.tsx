"use client";

import { useActionState, useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { ActionState } from "@/lib/actions";
import { money } from "@/lib/format";
import Modal from "@/components/Modal";

type Option = { id: string; name: string };

export type CaseInitial = {
  plateName?: string;
  orderNo?: string;
  categoryId?: string;
  carModel?: string;
  description?: string;
  deptCode?: string;
  subsidyDeptCourse?: number;
  goldMedal?: number;
  silverMedal?: number;
  discountTotal?: number;
  specialSubsidy?: number;
};

const AMOUNTS: { name: keyof CaseInitial; label: string; hint?: string }[] = [
  { name: "subsidyDeptCourse", label: "所課支援金" },
  { name: "goldMedal", label: "金牌金額" },
  { name: "silverMedal", label: "銀牌金額" },
  { name: "discountTotal", label: "折讓總額" },
  { name: "specialSubsidy", label: "特案支援金額", hint: "可為 0" },
];

const initialState: ActionState = {};

export default function CaseForm({
  submitAction,
  categories,
  cars,
  month,
  storeCode,
  deptCode,
  deptEditable = false,
  deptOptions = [],
  allowDraft = true,
  initial,
  caseId,
  submitLabel = "送出",
}: {
  submitAction: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  categories: Option[];
  cars: Option[];
  month: string;
  storeCode: string;
  deptCode: string;
  deptEditable?: boolean;
  deptOptions?: string[];
  allowDraft?: boolean;
  initial?: CaseInitial;
  caseId?: string;
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(submitAction, initialState);
  const fe = state.fieldErrors ?? {};
  const router = useRouter();

  // 偵測「這次是否剛完成一次送出」，避免初始 state 誤觸發彈窗
  const [modalOpen, setModalOpen] = useState(false);
  // 送出失敗時遞增，強制表單重新掛載以套用 state.values（保留使用者剛填的內容）
  const [formKey, setFormKey] = useState(0);
  const seenRef = useRef(state);
  useEffect(() => {
    if (state !== seenRef.current) {
      seenRef.current = state;
      setModalOpen(true);
      if (!state.ok) setFormKey((k) => k + 1);
    }
  }, [state]);

  // 送出失敗時，欄位值優先用剛才送出的內容（state.values），否則退回原始資料（initial）
  const v = (key: string, fallback?: string | number): string | undefined =>
    state.values?.[key] ?? (fallback !== undefined ? String(fallback) : undefined);

  const formRef = useRef<HTMLFormElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [snapshot, setSnapshot] = useState<Record<string, string> | null>(null);
  const [capturing, setCapturing] = useState(false);

  const num = (fd: FormData, k: string) => money(Number(fd.get(k) || 0));

  async function handleCapture() {
    const form = formRef.current;
    if (!form) return;
    const fd = new FormData(form);
    const catId = String(fd.get("categoryId") || "");
    setSnapshot({
      月份: month,
      所別: storeCode,
      課別: String(fd.get("deptCode") || deptCode || "-"),
      領牌名稱: String(fd.get("plateName") || "-"),
      訂單編號: String(fd.get("orderNo") || "-").toUpperCase(),
      特案類別: categories.find((c) => c.id === catId)?.name || "-",
      車名: String(fd.get("carModel") || "-"),
      所課支援金: num(fd, "subsidyDeptCourse"),
      金牌金額: num(fd, "goldMedal"),
      銀牌金額: num(fd, "silverMedal"),
      折讓總額: num(fd, "discountTotal"),
      特案支援金額: num(fd, "specialSubsidy"),
      特案內容說明: String(fd.get("description") || "-"),
    });
    setCapturing(true);
    // 等卡片渲染完成
    await new Promise((r) =>
      requestAnimationFrame(() => requestAnimationFrame(() => r(null)))
    );
    try {
      const node = cardRef.current;
      if (!node) return;
      const { toBlob } = await import("html-to-image");
      const blob = await toBlob(node, {
        pixelRatio: 2,
        backgroundColor: "#ffffff",
      });
      if (!blob) return;

      const orderNo = String(fd.get("orderNo") || "草稿").toUpperCase();
      const filename = `特案申請_${orderNo}.png`;
      const file = new File([blob], filename, { type: "image/png" });

      // 裝置判斷要放最前面：桌面瀏覽器（尤其 Windows Edge）雖然也支援
      // navigator.share/canShare，但作業系統層級的分享清單常常找不到
      // 能接收檔案的目標，會跳出「無法為您顯示所有可分享的方式」錯誤。
      // 所以只在手機上才嘗試系統分享，桌面一律直接下載。
      const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

      if (isMobile) {
        const nav = navigator as Navigator & {
          canShare?: (data: { files: File[] }) => boolean;
          share?: (data: { files: File[]; title?: string }) => Promise<void>;
        };
        if (nav.canShare?.({ files: [file] }) && nav.share) {
          try {
            await nav.share({ files: [file], title: filename });
            return;
          } catch (err) {
            // 使用者取消分享則不做任何事；其他錯誤則往下退回開新分頁
            if (err instanceof Error && err.name === "AbortError") return;
          }
        }
      }

      const url = URL.createObjectURL(blob);
      if (!isMobile) {
        // 桌面瀏覽器：直接觸發下載
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
      } else {
        // 不支援分享的手機瀏覽器：開新分頁，讓使用者長按圖片儲存
        window.open(url, "_blank");
      }
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } finally {
      setCapturing(false);
      setSnapshot(null);
    }
  }

  const err = (n: string) =>
    fe[n] ? <p className="text-xs text-rose-600 mt-1">{fe[n]}</p> : null;

  const inputCls = "input";
  // 有錯誤的欄位加紅框醒目提示
  const fieldCls = (n: string) =>
    fe[n] ? `${inputCls} border-rose-400 focus:border-rose-500 focus:ring-rose-500/30` : inputCls;

  const problemMessages = [
    ...(state.error ? [state.error] : []),
    ...Object.values(fe),
  ];

  return (
    <>
    <form key={formKey} ref={formRef} action={formAction} className="space-y-5">
      {caseId && <input type="hidden" name="caseId" value={caseId} />}

      {state.error && (
        <p className="text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2">
          {state.error}
        </p>
      )}

      {/* 自動帶入資訊 */}
      <div className="grid grid-cols-3 gap-3 text-sm bg-slate-50 rounded-lg p-3">
        <div>
          <div className="text-slate-400 text-xs">月份</div>
          <div className="font-medium">{month}</div>
        </div>
        <div>
          <div className="text-slate-400 text-xs">所別</div>
          <div className="font-medium">{storeCode}</div>
        </div>
        <div>
          <div className="text-slate-400 text-xs mb-1">
            課別
            {deptEditable && <span className="text-rose-500"> *</span>}
          </div>
          {deptEditable ? (
            <>
              <select
                name="deptCode"
                required
                defaultValue={v("deptCode", initial?.deptCode) ?? ""}
                className={`w-full rounded-md border px-2 py-1 text-sm bg-white ${
                  fe.deptCode ? "border-rose-400" : "border-slate-300"
                }`}
              >
                <option value="">請選擇</option>
                {deptOptions.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              {deptOptions.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  本所尚無課長帳號，請先請後臺建立課長人員
                </p>
              )}
              {err("deptCode")}
            </>
          ) : (
            <div className="font-medium">{deptCode || "-"}</div>
          )}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="label">
            領牌名稱 <span className="text-rose-500">*</span>
          </label>
          <input
            name="plateName"
            defaultValue={v("plateName", initial?.plateName)}
            className={fieldCls("plateName")}
          />
          {err("plateName")}
        </div>
        <div>
          <label className="label">
            訂單編號 <span className="text-rose-500">*</span>
          </label>
          <input
            name="orderNo"
            defaultValue={v("orderNo", initial?.orderNo)}
            placeholder={`${storeCode} + 10 碼，共 13 碼`}
            maxLength={13}
            className={`${fieldCls("orderNo")} font-mono uppercase`}
          />
          {err("orderNo")}
        </div>
        <div>
          <label className="label">
            特案類別 <span className="text-rose-500">*</span>
          </label>
          <select
            name="categoryId"
            defaultValue={v("categoryId", initial?.categoryId) ?? ""}
            className={fieldCls("categoryId")}
          >
            <option value="">請選擇</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-400 mt-1">類別編號將於送出後自動產生</p>
          {err("categoryId")}
        </div>
        <div>
          <label className="label">
            車名 <span className="text-rose-500">*</span>
          </label>
          <select
            name="carModel"
            defaultValue={v("carModel", initial?.carModel) ?? ""}
            className={fieldCls("carModel")}
          >
            <option value="">請選擇</option>
            {cars.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
          {err("carModel")}
        </div>
      </div>

      {/* 金額 */}
      <div>
        <div className="text-sm font-medium text-slate-600 mb-2">
          金額（整數）
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {AMOUNTS.map((a) => (
            <div key={a.name}>
              <label className="block text-sm text-slate-600 mb-1">
                {a.label}
                {a.hint && (
                  <span className="text-xs text-slate-400 ml-1">（{a.hint}）</span>
                )}
              </label>
              <input
                name={a.name}
                type="number"
                min={0}
                step={1}
                defaultValue={v(a.name, initial?.[a.name] as number | undefined)}
                className={fieldCls(a.name)}
              />
              {err(a.name)}
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="label">
          特案內容說明 <span className="text-rose-500">*</span>
        </label>
        <textarea
          name="description"
          rows={4}
          defaultValue={v("description", initial?.description)}
          className={fieldCls("description")}
        />
        {err("description")}
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button
          type="submit"
          name="intent"
          value="submit"
          disabled={pending}
          className="btn btn-primary"
        >
          {pending ? "處理中…" : submitLabel}
        </button>
        {allowDraft && (
          <button
            type="submit"
            name="intent"
            value="draft"
            disabled={pending}
            className="btn border border-violet-300 text-violet-700 bg-white hover:bg-violet-50"
          >
            {pending ? "處理中…" : "儲存草稿"}
          </button>
        )}
        <button
          type="button"
          onClick={handleCapture}
          disabled={capturing}
          className="btn border border-emerald-500 text-emerald-700 bg-white hover:bg-emerald-50"
        >
          {capturing ? "產生中…" : "擷取為圖片"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="btn btn-secondary"
        >
          ← 取消
        </button>
      </div>
    </form>

    {/* 送出／儲存後的處理狀況視窗 */}
    <Modal open={modalOpen && !!state.ok} onClose={() => setModalOpen(false)}>
      <div className="text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 grid place-items-center text-2xl mb-3">
          ✓
        </div>
        <h3 className="text-base font-bold text-slate-800">處理成功</h3>
        <p className="text-sm text-slate-500 mt-1">{state.message}</p>
        <div className="flex gap-3 mt-5">
          <button
            className="btn btn-secondary flex-1"
            onClick={() => {
              setModalOpen(false);
              router.push("/");
            }}
          >
            回首頁
          </button>
          <button
            className="btn btn-primary flex-1"
            onClick={() => {
              setModalOpen(false);
              if (state.caseId) router.push(`/cases/${state.caseId}`);
            }}
          >
            查看案件
          </button>
        </div>
      </div>
    </Modal>

    <Modal
      open={modalOpen && !state.ok && problemMessages.length > 0}
      onClose={() => setModalOpen(false)}
    >
      <div>
        <div className="mx-auto w-12 h-12 rounded-full bg-rose-100 text-rose-600 grid place-items-center text-2xl mb-3">
          !
        </div>
        <h3 className="text-base font-bold text-slate-800 text-center">
          無法送出，請確認以下問題
        </h3>
        <ul className="mt-3 space-y-1.5 text-sm text-rose-600 list-disc list-inside">
          {problemMessages.map((m, i) => (
            <li key={i}>{m}</li>
          ))}
        </ul>
        <button
          className="btn btn-secondary w-full mt-5"
          onClick={() => setModalOpen(false)}
        >
          關閉
        </button>
      </div>
    </Modal>

    {snapshot && (
      <div
        aria-hidden
        style={{ position: "fixed", left: "-99999px", top: 0, pointerEvents: "none" }}
      >
        <div
          ref={cardRef}
          style={{
            width: 375,
            boxSizing: "border-box",
            background: "#ffffff",
            padding: 28,
            fontFamily:
              '"Microsoft JhengHei","PingFang TC",system-ui,sans-serif',
            color: "#1e293b",
          }}
        >
          <div
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: "#0b5cad",
              paddingBottom: 10,
              borderBottom: "2px solid #e8f1fb",
              marginBottom: 14,
            }}
          >
            特案支援金報備申請
          </div>
          <div style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>
            月份 {snapshot["月份"]}　·　所別 {snapshot["所別"]}　·　課別{" "}
            {snapshot["課別"]}
          </div>

          {[
            "領牌名稱",
            "訂單編號",
            "特案類別",
            "車名",
            "所課支援金",
            "金牌金額",
            "銀牌金額",
            "折讓總額",
            "特案支援金額",
          ].map((k) => (
            <div
              key={k}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 16,
                padding: "7px 0",
                borderBottom: "1px solid #f1f5f9",
                fontSize: 14,
              }}
            >
              <span style={{ color: "#94a3b8" }}>{k}</span>
              <span style={{ fontWeight: 600, textAlign: "right" }}>
                {snapshot[k]}
              </span>
            </div>
          ))}

          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 4 }}>
              特案內容說明
            </div>
            <div style={{ fontSize: 14, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
              {snapshot["特案內容說明"]}
            </div>
          </div>

          <div
            style={{
              marginTop: 18,
              fontSize: 11,
              color: "#cbd5e1",
              textAlign: "right",
            }}
          >
            產生時間：{new Date().toLocaleString("zh-Hant")}
          </div>
        </div>
      </div>
    )}
    </>
  );
}

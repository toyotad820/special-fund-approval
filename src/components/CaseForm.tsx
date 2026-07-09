"use client";

import { useActionState, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ActionState } from "@/lib/actions";
import { money } from "@/lib/format";

type Option = { id: string; name: string };

export type CaseInitial = {
  plateName?: string;
  orderNo?: string;
  categoryId?: string;
  categoryNo?: string;
  carModel?: string;
  description?: string;
  subsidyDeptCourse?: number;
  goldMedal?: number;
  silverMedal?: number;
  discountTotal?: number;
  specialSubsidy?: number;
};

const AMOUNTS: { name: keyof CaseInitial; label: string; hint?: string }[] = [
  { name: "subsidyDeptCourse", label: "所課支援金" },
  { name: "goldMedal", label: "金牌" },
  { name: "silverMedal", label: "銀牌" },
  { name: "discountTotal", label: "折讓總額" },
  { name: "specialSubsidy", label: "特案支援金額", hint: "可為 0" },
];

export default function CaseForm({
  submitAction,
  categories,
  cars,
  month,
  storeCode,
  deptCode,
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
  initial?: CaseInitial;
  caseId?: string;
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(submitAction, {});
  const fe = state.fieldErrors ?? {};

  const router = useRouter();
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
      課別: deptCode || "-",
      領牌名稱: String(fd.get("plateName") || "-"),
      訂單編號: String(fd.get("orderNo") || "-").toUpperCase(),
      特案類別: categories.find((c) => c.id === catId)?.name || "-",
      類別編號: String(fd.get("categoryNo") || "-"),
      車名: String(fd.get("carModel") || "-"),
      所課支援金: num(fd, "subsidyDeptCourse"),
      金牌: num(fd, "goldMedal"),
      銀牌: num(fd, "silverMedal"),
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
      if (node) {
        const { toPng } = await import("html-to-image");
        const dataUrl = await toPng(node, {
          pixelRatio: 2,
          backgroundColor: "#ffffff",
        });
        const orderNo = String(fd.get("orderNo") || "草稿").toUpperCase();
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = `特案申請_${orderNo}.png`;
        a.click();
      }
    } finally {
      setCapturing(false);
      setSnapshot(null);
    }
  }

  const err = (n: string) =>
    fe[n] ? <p className="text-xs text-rose-600 mt-1">{fe[n]}</p> : null;

  const inputCls =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <>
    <form ref={formRef} action={formAction} className="space-y-5">
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
          <div className="text-slate-400 text-xs">課別</div>
          <div className="font-medium">{deptCode || "-"}</div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">
            領牌名稱 <span className="text-rose-500">*</span>
          </label>
          <input name="plateName" defaultValue={initial?.plateName} className={inputCls} />
          {err("plateName")}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">
            訂單編號 <span className="text-rose-500">*</span>
          </label>
          <input
            name="orderNo"
            defaultValue={initial?.orderNo}
            placeholder="D + 12 碼，共 13 碼"
            maxLength={13}
            className={`${inputCls} font-mono uppercase`}
          />
          {err("orderNo")}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">
            特案類別 <span className="text-rose-500">*</span>
          </label>
          <select
            name="categoryId"
            defaultValue={initial?.categoryId ?? ""}
            className={inputCls}
          >
            <option value="">請選擇</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {err("categoryId")}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">
            類別編號 <span className="text-rose-500">*</span>
          </label>
          <input
            name="categoryNo"
            defaultValue={initial?.categoryNo}
            placeholder="D單位代號-課別-編號2碼"
            className={inputCls}
          />
          {err("categoryNo")}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">
            車名 <span className="text-rose-500">*</span>
          </label>
          <select
            name="carModel"
            defaultValue={initial?.carModel ?? ""}
            className={inputCls}
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
                defaultValue={initial?.[a.name] as number | undefined}
                className={inputCls}
              />
              {err(a.name)}
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-600 mb-1">
          特案內容說明 <span className="text-rose-500">*</span>
        </label>
        <textarea
          name="description"
          rows={4}
          defaultValue={initial?.description}
          className={inputCls}
        />
        {err("description")}
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-blue-600 text-white px-6 py-2.5 font-medium hover:bg-blue-700 disabled:opacity-60 transition"
        >
          {pending ? "處理中…" : submitLabel}
        </button>
        <button
          type="button"
          onClick={handleCapture}
          disabled={capturing}
          className="rounded-lg border border-emerald-500 text-emerald-700 px-5 py-2.5 font-medium hover:bg-emerald-50 disabled:opacity-60 transition"
        >
          {capturing ? "產生中…" : "擷取為圖片"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border border-slate-300 text-slate-600 px-5 py-2.5 font-medium hover:bg-slate-50 transition"
        >
          取消
        </button>
      </div>
    </form>

    {snapshot && (
      <div
        aria-hidden
        style={{ position: "fixed", left: "-99999px", top: 0, pointerEvents: "none" }}
      >
        <div
          ref={cardRef}
          style={{
            width: 620,
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
            "類別編號",
            "車名",
            "所課支援金",
            "金牌",
            "銀牌",
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

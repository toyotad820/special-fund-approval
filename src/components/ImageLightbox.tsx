"use client";

import { useEffect, useState } from "react";

export default function ImageLightbox({
  images,
}: {
  images: Array<{ src: string; alt?: string }>;
}) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  // 拖曳狀態（不進 state，避免每次移動重繪整棵樹）
  const drag = useState(() => ({ active: false, moved: false, sx: 0, sy: 0, ox: 0, oy: 0 }))[0];

  // ESC 關閉放大檢視
  useEffect(() => {
    if (selectedIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedIndex(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedIndex]);

  if (images.length === 0) return null;

  const selected = selectedIndex !== null ? images[selectedIndex] : null;

  const reset = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };
  const open = (i: number) => {
    setSelectedIndex(i);
    reset();
  };
  const close = () => {
    setSelectedIndex(null);
    reset();
  };
  const setZoomClamped = (z: number) => {
    const nz = Math.min(4, Math.max(1, +z.toFixed(2)));
    setZoom(nz);
    if (nz === 1) setOffset({ x: 0, y: 0 });
  };

  // 通用拖曳（滑鼠與觸控共用）
  const startDrag = (x: number, y: number) => {
    if (zoom === 1) return;
    drag.active = true;
    drag.moved = false;
    drag.sx = x;
    drag.sy = y;
    drag.ox = offset.x;
    drag.oy = offset.y;
  };
  const moveDrag = (x: number, y: number) => {
    if (!drag.active) return;
    const dx = x - drag.sx;
    const dy = y - drag.sy;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.moved = true;
    setOffset({ x: drag.ox + dx, y: drag.oy + dy });
  };
  const endDrag = () => {
    drag.active = false;
  };
  const onClick = () => {
    if (drag.moved) return; // 拖曳結束不觸發縮放切換
    setZoomClamped(zoom > 1 ? 1 : 1.25);
  };

  const onMouseDown = (e: React.MouseEvent) => startDrag(e.clientX, e.clientY);
  const onMouseMove = (e: React.MouseEvent) => moveDrag(e.clientX, e.clientY);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    if (t) startDrag(t.clientX, t.clientY);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const t = e.touches[0];
    if (t) moveDrag(t.clientX, t.clientY);
  };

  return (
    <>
      <div className="flex flex-wrap gap-3">
        {images.map((img, i) => (
          <button
            key={i}
            onClick={() => open(i)}
            className="block w-40 h-52 rounded-lg border border-slate-200 overflow-hidden hover:ring-2 hover:ring-blue-500 transition-all"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.src}
              alt={img.alt || `圖片 ${i + 1}`}
              className="w-full h-full object-cover"
            />
          </button>
        ))}
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2 sm:p-3"
          onClick={close}
        >
          <div
            className="relative w-full max-w-[97vw] max-h-[97vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="overflow-hidden mx-auto flex-1 min-h-0 flex items-center justify-center rounded-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selected.src}
                alt={selected.alt || "放大圖"}
                draggable={false}
                onClick={onClick}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={endDrag}
                onMouseLeave={endDrag}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={endDrag}
                style={{
                  transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                  touchAction: zoom > 1 ? "none" : "auto",
                }}
                className={`max-w-full max-h-full object-contain select-none ${
                  zoom > 1 ? (drag.active ? "cursor-grabbing" : "cursor-grab") : "cursor-zoom-in"
                }`}
              />
            </div>
            <div className="flex items-center justify-center gap-2 mt-2">
              <button
                onClick={() => setZoomClamped(zoom - 0.25)}
                className="w-8 h-8 grid place-items-center rounded-lg bg-white/10 hover:bg-white/20 text-white text-lg"
                aria-label="縮小"
              >
                −
              </button>
              <span className="text-white text-xs w-12 text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => setZoomClamped(zoom + 0.25)}
                className="w-8 h-8 grid place-items-center rounded-lg bg-white/10 hover:bg-white/20 text-white text-lg"
                aria-label="放大"
              >
                ＋
              </button>
            </div>
            <div className="flex items-center justify-between gap-3 mt-3">
              <button
                onClick={() => open(selectedIndex! > 0 ? selectedIndex! - 1 : images.length - 1)}
                className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm"
              >
                ← 上一張
              </button>
              <span className="text-white text-sm">
                {selectedIndex! + 1} / {images.length}
              </span>
              <button
                onClick={() => open(selectedIndex! < images.length - 1 ? selectedIndex! + 1 : 0)}
                className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm"
              >
                下一張 →
              </button>
            </div>
            <button
              onClick={close}
              className="absolute top-2 right-2 z-10 w-10 h-10 grid place-items-center rounded-full bg-black/50 text-white text-lg hover:bg-black/70 transition-colors"
              aria-label="關閉"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
}

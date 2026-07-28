"use client";

import { useState } from "react";

export default function ImageLightbox({
  images,
}: {
  images: Array<{ src: string; alt?: string }>;
}) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [origin, setOrigin] = useState("center center");

  if (images.length === 0) return null;

  const selected = selectedIndex !== null ? images[selectedIndex] : null;

  const open = (i: number) => {
    setSelectedIndex(i);
    setZoom(1);
    setOrigin("center center");
  };
  const close = () => {
    setSelectedIndex(null);
    setZoom(1);
  };
  const toggleZoom = () => setZoom((z) => (z > 1 ? 1 : 2.5));
  const onMove = (e: React.MouseEvent<HTMLImageElement>) => {
    if (zoom === 1) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    setOrigin(`${x}% ${y}%`);
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={close}
        >
          <div
            className="relative max-w-4xl w-full max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="overflow-hidden mx-auto max-h-[80vh] rounded-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selected.src}
                alt={selected.alt || "放大圖"}
                onClick={toggleZoom}
                onMouseMove={onMove}
                onMouseLeave={() => setOrigin("center center")}
                style={{ transform: `scale(${zoom})`, transformOrigin: origin }}
                className={`max-w-full max-h-[80vh] object-contain mx-auto transition-transform duration-100 ${
                  zoom > 1 ? "cursor-zoom-out" : "cursor-zoom-in"
                }`}
              />
            </div>
            <div className="flex items-center justify-center gap-2 mt-2">
              <button
                onClick={() => setZoom((z) => Math.max(1, +(z - 0.5).toFixed(1)))}
                className="w-8 h-8 grid place-items-center rounded-lg bg-white/10 hover:bg-white/20 text-white text-lg"
                aria-label="縮小"
              >
                −
              </button>
              <span className="text-white text-xs w-12 text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => setZoom((z) => Math.min(4, +(z + 0.5).toFixed(1)))}
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
              className="absolute -top-8 -right-8 w-8 h-8 grid place-items-center rounded-full text-white hover:bg-white/20 transition-colors"
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

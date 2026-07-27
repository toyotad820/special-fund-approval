"use client";

import { useState } from "react";

export default function ImageLightbox({
  images,
}: {
  images: Array<{ src: string; alt?: string }>;
}) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  if (images.length === 0) return null;

  const selected = selectedIndex !== null ? images[selectedIndex] : null;

  return (
    <>
      <div className="flex flex-wrap gap-3">
        {images.map((img, i) => (
          <button
            key={i}
            onClick={() => setSelectedIndex(i)}
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
          onClick={() => setSelectedIndex(null)}
        >
          <div
            className="relative max-w-4xl w-full max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selected.src}
              alt={selected.alt || "放大圖"}
              className="max-w-full max-h-[80vh] object-contain mx-auto"
            />
            <div className="flex items-center justify-between gap-3 mt-3">
              <button
                onClick={() =>
                  setSelectedIndex((i) =>
                    i! > 0 ? i! - 1 : images.length - 1
                  )
                }
                className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm"
              >
                ← 上一張
              </button>
              <span className="text-white text-sm">
                {selectedIndex! + 1} / {images.length}
              </span>
              <button
                onClick={() =>
                  setSelectedIndex((i) =>
                    i! < images.length - 1 ? i! + 1 : 0
                  )
                }
                className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm"
              >
                下一張 →
              </button>
            </div>
            <button
              onClick={() => setSelectedIndex(null)}
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

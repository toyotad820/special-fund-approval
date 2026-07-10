"use client";

export default function Modal({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-sm p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="關閉視窗"
          className="absolute top-3 right-3 w-7 h-7 grid place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
        >
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}

import { ACC_STATUS_LABEL, ACC_STATUS_STYLE, ACC_STATUS_DOT } from "@/lib/constants";

export default function AccStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-2.5 py-0.5 ${ACC_STATUS_STYLE[status] ?? "bg-slate-100 text-slate-600"}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${ACC_STATUS_DOT[status] ?? "bg-slate-400"}`}
      />
      {ACC_STATUS_LABEL[status] ?? status}
    </span>
  );
}

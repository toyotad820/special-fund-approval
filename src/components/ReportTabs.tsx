"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/reports", label: "總覽" },
  { href: "/reports/category-usage", label: "所課別特案使用統計表" },
  { href: "/reports/target-vs-actual", label: "目標達成統計表" },
  { href: "/reports/export", label: "案件明細下載" },
];

export default function ReportTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-2 flex-wrap bg-slate-100 rounded-xl p-1.5 w-fit">
      {TABS.map((t) => {
        const active =
          t.href === "/reports" ? pathname === "/reports" : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${
              active
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-800 hover:bg-white/70"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

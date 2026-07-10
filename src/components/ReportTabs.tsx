"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/reports", label: "總覽" },
  { href: "/reports/category-usage", label: "所課別特案使用統計表" },
  { href: "/reports/export", label: "案件明細下載" },
];

export default function ReportTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 flex-wrap border-b border-slate-200">
      {TABS.map((t) => {
        const active =
          t.href === "/reports" ? pathname === "/reports" : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`px-3 py-2 text-sm font-medium -mb-px border-b-2 transition-colors ${
              active
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/lib/actions";
import { APP_VERSION, CHANGELOG } from "@/lib/version";

export type NavItem = { href: string; label: string };

export default function NavBar({
  userName,
  roleLabel,
  items,
}: {
  userName: string;
  roleLabel: string;
  items: NavItem[];
}) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-20 bg-white/85 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-5xl mx-auto px-4 py-2 flex items-stretch gap-3">
        {/* logo 用特案支援金報備自己的 icon，高度跟右邊兩排文字疊起來一樣高，不用 TOYOTA 品牌標 */}
        <Link href="/" className="shrink-0 flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- 固定高度貼齊右側兩排文字（動態撐滿在巢狀 flex 下會反過來被 img 原始像素尺寸撐爆，改用固定值） */}
          <img src="/icon-fund.png" alt="特案支援金報備" className="h-14 w-auto rounded-lg" />
        </Link>

        <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
          {/* 第一排：系統名稱＋版本號　...　角色 */}
          <div className="flex items-center justify-between gap-3">
            <Link href="/" className="flex items-center gap-2 min-w-0">
              <span className="font-bold text-slate-800 text-sm truncate">特案支援金報備</span>
              <span
                title={`v${APP_VERSION} · ${CHANGELOG[0]?.note ?? ""}`}
                className="text-[10px] font-mono text-slate-400 bg-slate-100 rounded-full px-1.5 py-0.5 whitespace-nowrap cursor-default shrink-0"
              >
                v{APP_VERSION}
              </span>
            </Link>
            <div className="flex items-center gap-2.5 text-sm shrink-0">
              <span className="text-slate-600 truncate hidden sm:inline max-w-[8rem]">
                {userName}
              </span>
              <span className="text-xs bg-slate-100 text-slate-600 rounded-full px-2.5 py-0.5 whitespace-nowrap font-medium">
                {roleLabel}
              </span>
            </div>
          </div>

          {/* 第二排：功能項目（裝不下時整排換行，跟第一排左邊對齊）　...　登出
              items-start：nav 換成兩行時，登出要貼齊第二排第一行，不要被夾在兩行中間置中 */}
          <div className="flex items-start justify-between gap-3">
            <nav className="flex items-center flex-wrap gap-0.5 text-sm min-w-0 -ml-2 sm:-ml-3">
              {items.map((it) => {
                const active = isActive(it.href);
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    className={`whitespace-nowrap px-2 sm:px-3 py-1.5 rounded-lg font-medium transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 ${
                      active
                        ? "bg-blue-50 text-blue-700"
                        : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                    }`}
                  >
                    {it.label}
                  </Link>
                );
              })}
            </nav>
            <form action={logout} className="shrink-0">
              <button className="whitespace-nowrap text-slate-400 hover:text-rose-600 transition-colors font-bold px-1.5 py-1.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/50">
                登出
              </button>
            </form>
          </div>
        </div>
      </div>
    </header>
  );
}

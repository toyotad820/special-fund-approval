"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/lib/actions";

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
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-5 min-w-0">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <span className="grid place-items-center w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-blue-500 text-white font-bold text-sm shadow-sm shadow-blue-600/30">
              特
            </span>
            <span className="font-bold text-slate-800 hidden md:inline whitespace-nowrap">
              特案支援金報備
            </span>
          </Link>
          <nav className="flex items-center gap-0.5 text-sm">
            {items.map((it) => {
              const active = isActive(it.href);
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
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
        </div>

        <div className="flex items-center gap-2.5 text-sm min-w-0">
          <span className="text-slate-600 truncate hidden sm:inline max-w-[8rem]">
            {userName}
          </span>
          <span className="text-xs bg-slate-100 text-slate-600 rounded-full px-2.5 py-0.5 whitespace-nowrap font-medium">
            {roleLabel}
          </span>
          <form action={logout}>
            <button className="text-slate-400 hover:text-rose-600 transition-colors font-medium">
              登出
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

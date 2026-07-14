"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/lib/actions";
import { APP_VERSION, CHANGELOG } from "@/lib/version";
import BrandMark from "@/components/BrandMark";

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
            <span className="hidden md:inline">
              <BrandMark size="sm" />
            </span>
            <span className="md:hidden">
              <BrandMark size="sm" showTitle={false} />
            </span>
            <span
              title={`v${APP_VERSION} · ${CHANGELOG[0]?.note ?? ""}`}
              className="text-[10px] font-mono text-slate-400 bg-slate-100 rounded-full px-1.5 py-0.5 whitespace-nowrap cursor-default"
            >
              v{APP_VERSION}
            </span>
          </Link>
          <nav className="flex items-center gap-0.5 text-sm">
            {items.map((it) => {
              const active = isActive(it.href);
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 ${
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
            <button className="text-slate-400 hover:text-rose-600 transition-colors font-medium px-2 py-2.5 -mx-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/50">
              登出
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

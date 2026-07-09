import Link from "next/link";
import { requireUser } from "@/lib/session";
import { logout } from "@/lib/actions";
import { canSubmit, canViewReports, canAdmin } from "@/lib/dal";
import { ROLE_LABEL } from "@/lib/constants";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <div className="flex-1 flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-1 sm:gap-4 min-w-0">
            <Link href="/" className="font-bold text-slate-800 whitespace-nowrap">
              特案報備
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <Link
                href="/"
                className="px-2 py-1 rounded text-slate-600 hover:bg-slate-100"
              >
                首頁
              </Link>
              {canSubmit(user) && (
                <Link
                  href="/cases/new"
                  className="px-2 py-1 rounded text-slate-600 hover:bg-slate-100"
                >
                  新增申請
                </Link>
              )}
              {canViewReports(user) && (
                <Link
                  href="/reports"
                  className="px-2 py-1 rounded text-slate-600 hover:bg-slate-100"
                >
                  報表
                </Link>
              )}
              {canAdmin(user) && (
                <Link
                  href="/admin"
                  className="px-2 py-1 rounded text-slate-600 hover:bg-slate-100"
                >
                  後台
                </Link>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm min-w-0">
            <span className="text-slate-500 truncate hidden sm:inline">
              {user.name}
            </span>
            <span className="text-xs bg-slate-100 text-slate-600 rounded-full px-2 py-0.5 whitespace-nowrap">
              {ROLE_LABEL[user.role]}
            </span>
            <form action={logout}>
              <button className="text-slate-500 hover:text-rose-600">登出</button>
            </form>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto p-4">{children}</main>
    </div>
  );
}

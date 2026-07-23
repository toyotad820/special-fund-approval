import Link from "next/link";
import { requireUser } from "@/lib/session";
import { logout } from "@/lib/actions";
import { SYSTEM, SYSTEM_LABEL } from "@/lib/constants";
import PortalMark from "@/components/PortalMark";

// 系統入口卡片設定：href 為 null 表示尚無功能（顯示開發中，不可點）
// icon 圖檔已經是圓角方形＋深藍底，直接當整塊 icon 用，不用另外包 div 上色/裁圓角
const SYSTEM_CARDS: { key: string; href: string | null; iconSrc: string }[] = [
  { key: SYSTEM.FUND, href: "/", iconSrc: "/icon-fund.png" },
  { key: SYSTEM.CAR_SPEC_CHANGE, href: null, iconSrc: "/icon-car-spec-change.png" },
];

export default async function PortalPage() {
  const user = await requireUser();
  const mySystems = new Set(user.systems.split(",").map((s) => s.trim()).filter(Boolean));
  const cards = SYSTEM_CARDS.filter((c) => mySystems.has(c.key));

  return (
    <div className="flex-1 flex flex-col items-center p-4 sm:p-6">
      <div className="w-full max-w-3xl">
        <div className="flex items-start justify-between gap-3 mb-8 mt-4">
          <div className="min-w-0">
            <span className="hidden sm:inline">
              <PortalMark size="md" />
            </span>
            <span className="sm:hidden">
              <PortalMark size="sm" />
            </span>
          </div>
          <div className="flex items-center gap-2.5 sm:gap-3 text-sm shrink-0 pt-1 sm:pt-0">
            <span className="text-slate-600 truncate hidden sm:inline max-w-[8rem]">
              {user.name}
            </span>
            <form action={logout}>
              <button className="whitespace-nowrap text-slate-400 hover:text-rose-600 transition-colors font-bold">
                登出
              </button>
            </form>
          </div>
        </div>

        {cards.length === 0 ? (
          <p className="text-sm text-slate-400">目前沒有任何系統使用權限，請聯絡管理員。</p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-x-4 gap-y-6">
            {cards.map((c) => {
              const disabled = !c.href;
              const tile = (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element -- 固定小尺寸 icon，不需要 next/image 最佳化 */}
                  <img
                    src={c.iconSrc}
                    alt={SYSTEM_LABEL[c.key]}
                    className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl shadow-sm transition-transform ${
                      disabled ? "opacity-60" : "group-hover:scale-[1.04]"
                    }`}
                  />
                  {disabled && (
                    <span className="absolute -top-1.5 -right-1.5 text-[10px] font-medium text-slate-500 bg-white border border-slate-200 rounded-full px-1.5 py-0.5 shadow-sm">
                      開發中
                    </span>
                  )}
                </div>
              );
              const label = (
                <span className="mt-2 text-xs sm:text-sm text-slate-700 text-center leading-tight">
                  {SYSTEM_LABEL[c.key]}
                </span>
              );
              return disabled ? (
                <div key={c.key} className="flex flex-col items-center opacity-70 cursor-not-allowed">
                  {tile}
                  {label}
                </div>
              ) : (
                <Link key={c.key} href={c.href!} className="group flex flex-col items-center">
                  {tile}
                  {label}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

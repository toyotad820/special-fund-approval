// TOYOTA車輛部申請系統的入口品牌標：登入頁／系統選單頁共用，跟各子系統
// 進去後 NavBar 用的 BrandMark 標題不同（這裡固定顯示「TOYOTA車輛部申請系統」），
// 但 logo 圖片沿用同一份官方 TOYOTA 素材。
export default function PortalMark({
  size = "md",
  showTitle = true,
}: {
  size?: "sm" | "md" | "lg";
  showTitle?: boolean;
}) {
  const logoHeight = size === "sm" ? 24 : size === "lg" ? 72 : 36;
  const titleSize = size === "sm" ? "text-sm" : size === "lg" ? "text-xl" : "text-lg";

  return (
    <span className="flex items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element -- 固定小尺寸品牌標，不需要 next/image 最佳化 */}
      <img
        src="/toyota-logo.png"
        alt="TOYOTA"
        height={logoHeight}
        style={{ height: logoHeight, width: "auto" }}
      />
      {showTitle && (
        <span className={`font-bold text-slate-800 ${titleSize} leading-none border-l border-slate-300 pl-2.5`}>
          TOYOTA車輛部申請系統
        </span>
      )}
    </span>
  );
}

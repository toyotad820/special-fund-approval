// 品牌標：TOYOTA 文字標＋系統中文名。用文字排版呈現品牌感，
// 不重製 TOYOTA 橢圓廠徽圖形（商標圖形不能隨意手繪重現）。
export default function BrandMark({
  size = "md",
  showTitle = true,
}: {
  size?: "sm" | "md" | "lg";
  showTitle?: boolean;
}) {
  const toyotaSize = size === "sm" ? "text-base" : size === "lg" ? "text-3xl" : "text-xl";
  const titleSize = size === "sm" ? "text-sm" : size === "lg" ? "text-xl" : "text-lg";

  return (
    <span className="flex items-center gap-2.5">
      <span
        className={`font-black tracking-wider text-[#EB0A1E] ${toyotaSize} leading-none`}
        style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
      >
        TOYOTA
      </span>
      {showTitle && (
        <span className={`font-bold text-slate-800 ${titleSize} leading-none border-l border-slate-300 pl-2.5`}>
          特案支援金報備
        </span>
      )}
    </span>
  );
}

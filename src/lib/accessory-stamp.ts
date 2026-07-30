import "server-only";
import sharp from "sharp";
import { parse as parseFont, type Font } from "opentype.js";
import { STAMP_FONT_B64 } from "./stamp-font";

// Vercel serverless 無內建 CJK 字型，librsvg 渲染 <text> 會空白（只剩圓圈、無文字）。
// 解法：用 opentype.js 把文字轉成向量 <path>，librsvg 畫 path 完全不需字型系統/fontconfig/Pango。
// 字型以 base64 內嵌成程式碼模組（stamp-font.ts），保證被打包進 lambda。
let _font: Font | null = null;
function getFont(): Font {
  if (!_font) {
    const buf = Buffer.from(STAMP_FONT_B64, "base64");
    _font = parseFont(
      buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
    );
  }
  return _font;
}

// 產生一行文字的置中向量路徑 d（以 cx 為水平中心、baselineY 為基線）
function centeredPathData(
  text: string,
  fontSize: number,
  cx: number,
  baselineY: number
): string {
  const font = getFont();
  const width = font.getAdvanceWidth(text, fontSize);
  const x = cx - width / 2;
  return font.getPath(text, x, baselineY, fontSize).toPathData(2);
}

// 蓋章參數
const STAMP_CONFIG = {
  diameter: 152, // 約 4cm（96 DPI 下）
  position: { right: 40, bottom: 40 }, // 右下角內縮
  circleBorder: 3,
  textColor: "#dc2626", // 紅色
  bgColor: "#fef2f2", // 淡紅色背景
};

// 生成蓋章（紅圈 + 向量文字路徑）
async function generateStampImage(approverName: string, date: string): Promise<Buffer> {
  const size = STAMP_CONFIG.diameter;
  const cx = size / 2;
  const textSize = 32;

  // 三行文字轉向量路徑（基線 Y 沿用原本相對中心的位置）
  const titlePath = centeredPathData("已審核", textSize, cx, size / 2 - 26);
  const namePath = centeredPathData(approverName || "", textSize - 6, cx, size / 2 + 10);
  const datePath = centeredPathData(date || "", textSize - 6, cx, size / 2 + 44);

  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${cx}" cy="${cx}" r="${(size - STAMP_CONFIG.circleBorder * 2) / 2}"
        fill="${STAMP_CONFIG.bgColor}" stroke="${STAMP_CONFIG.textColor}" stroke-width="${STAMP_CONFIG.circleBorder}"/>
      <path d="${titlePath}" fill="${STAMP_CONFIG.textColor}"/>
      <path d="${namePath}" fill="${STAMP_CONFIG.textColor}"/>
      <path d="${datePath}" fill="${STAMP_CONFIG.textColor}"/>
    </svg>
  `;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

// 在圖片上蓋章（右下角）
export async function stampImage(
  imageBase64: string,
  mimeType: string,
  approverName: string,
  date: string
): Promise<string> {
  try {
    const imageBuffer = Buffer.from(imageBase64, "base64");
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height) {
      throw new Error("無法取得圖片尺寸");
    }

    const stampBuffer = await generateStampImage(approverName, date);

    const stampPos = {
      left: metadata.width - STAMP_CONFIG.diameter - STAMP_CONFIG.position.right,
      top: metadata.height - STAMP_CONFIG.diameter - STAMP_CONFIG.position.bottom,
    };

    const stampedBuffer = await image
      .composite([{ input: stampBuffer, left: stampPos.left, top: stampPos.top }])
      .toBuffer();

    return stampedBuffer.toString("base64");
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`蓋章失敗: ${msg}`);
  }
}

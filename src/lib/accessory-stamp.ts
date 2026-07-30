import "server-only";
import sharp from "sharp";
import fs from "fs";
import os from "os";
import path from "path";

// Vercel serverless 無內建 CJK 字型，librsvg 渲染 <text> 會空白（只剩圓圈）。
// 於執行期產生一份 fontconfig 設定指向 repo 內的 Noto Sans TC，並以 FONTCONFIG_FILE 注入。
// 必須在第一次呼叫 sharp/librsvg 前設定，故放在 module 載入時執行。
const FONT_FAMILY = "Noto Sans TC";
let fontReady = false;
function ensureFontconfig() {
  if (fontReady) return;
  try {
    const fontDir = path.join(process.cwd(), "public", "fonts");
    const cacheDir = path.join(os.tmpdir(), "fontconfig-cache");
    fs.mkdirSync(cacheDir, { recursive: true });
    const conf = `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>${fontDir}</dir>
  <cachedir>${cacheDir}</cachedir>
</fontconfig>`;
    const confPath = path.join(os.tmpdir(), "acc-fonts.conf");
    fs.writeFileSync(confPath, conf);
    process.env.FONTCONFIG_FILE = confPath;
  } catch (e) {
    console.error("[stamp] fontconfig 設定失敗:", e instanceof Error ? e.message : e);
  }
  fontReady = true;
}
ensureFontconfig();

// XML/SVG 文字逸出（審核人姓名可能含特殊字元）
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// 蓋章參數
const STAMP_CONFIG = {
  diameter: 152, // 約 4cm（96 DPI 下）
  position: { right: 40, bottom: 40 }, // 右下角內縮
  circleBorder: 3,
  textColor: "#dc2626", // 紅色
  bgColor: "#fef2f2", // 淡紅色背景
};

// 生成蓋章（紅圈 + 文字）
async function generateStampImage(approverName: string, date: string): Promise<Buffer> {
  const size = STAMP_CONFIG.diameter;
  const textSize = 32;
  const lineHeight = 44;

  // 建立蓋章 SVG
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <!-- 背景圓形 -->
      <circle cx="${size / 2}" cy="${size / 2}" r="${(size - STAMP_CONFIG.circleBorder * 2) / 2}"
        fill="${STAMP_CONFIG.bgColor}" stroke="${STAMP_CONFIG.textColor}" stroke-width="${STAMP_CONFIG.circleBorder}"/>

      <!-- 上方文字：已審核 -->
      <text x="${size / 2}" y="${size / 2 - 26}" font-size="${textSize}" font-weight="bold"
        text-anchor="middle" fill="${STAMP_CONFIG.textColor}" font-family="${FONT_FAMILY}">已審核</text>

      <!-- 中間文字：審核人名 -->
      <text x="${size / 2}" y="${size / 2 + 10}" font-size="${textSize - 6}"
        text-anchor="middle" fill="${STAMP_CONFIG.textColor}" font-family="${FONT_FAMILY}">${esc(approverName)}</text>

      <!-- 下方文字：日期 -->
      <text x="${size / 2}" y="${size / 2 + 44}" font-size="${textSize - 6}"
        text-anchor="middle" fill="${STAMP_CONFIG.textColor}" font-family="${FONT_FAMILY}">${esc(date)}</text>
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
    // 解碼圖片
    const imageBuffer = Buffer.from(imageBase64, "base64");
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height) {
      throw new Error("無法取得圖片尺寸");
    }

    // 生成蓋章
    const stampBuffer = await generateStampImage(approverName, date);

    // 計算蓋章位置（右下角）
    const stampPos = {
      left: metadata.width - STAMP_CONFIG.diameter - STAMP_CONFIG.position.right,
      top: metadata.height - STAMP_CONFIG.diameter - STAMP_CONFIG.position.bottom,
    };

    // 合成圖片
    const stampedBuffer = await image
      .composite([{ input: stampBuffer, left: stampPos.left, top: stampPos.top }])
      .toBuffer();

    // 回傳 base64
    return stampedBuffer.toString("base64");
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`蓋章失敗: ${msg}`);
  }
}

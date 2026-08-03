import type { NextConfig } from "next";

// 開發模式（HMR/Fast Refresh）需要 unsafe-eval，正式環境不需要、也不該開
const isDev = process.env.NODE_ENV === "development";

// img-src 需要 data: 是因為配件變更上傳圖片在送出前用 base64 data URI 預覽；
// style-src 需要 unsafe-inline 是因為 React 的 style={{...}} 內嵌樣式屬性
const csp = [
  "default-src 'self'",
  `script-src 'self'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  experimental: {
    // 配件變更申請會把壓縮後的工單圖片以 base64 透過 server action 送出，
    // 預設 1MB 上限不夠，放寬到 10MB（多張圖）。
    serverActions: { bodySizeLimit: "10mb" },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

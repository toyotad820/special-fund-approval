import type { NextConfig } from "next";

// CSP 改由 src/middleware.ts 用 per-request nonce 動態產生，這裡不再設 CSP header
const securityHeaders = [
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

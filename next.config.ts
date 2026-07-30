import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // 配件變更申請會把壓縮後的工單圖片以 base64 透過 server action 送出，
    // 預設 1MB 上限不夠，放寬到 10MB（多張圖）。
    serverActions: { bodySizeLimit: "10mb" },
  },
};

export default nextConfig;

import "server-only";

// ============================================================
// Dropbox 歸檔（App folder scoped access — refresh token 永不過期）
//
// 環境變數：
//   DROPBOX_APP_KEY
//   DROPBOX_APP_SECRET
//   DROPBOX_REFRESH_TOKEN
//
// 任一未設定時 isDriveEnabled()=false，呼叫端應跳過上傳（不阻斷核准流程）。
// App folder 範圍：路徑一律相對於該 App 專屬資料夾，不需帶母資料夾 ID。
// ============================================================

export function isDriveEnabled(): boolean {
  return !!(
    process.env.DROPBOX_APP_KEY &&
    process.env.DROPBOX_APP_SECRET &&
    process.env.DROPBOX_REFRESH_TOKEN
  );
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now) return cachedToken.token;

  const appKey = process.env.DROPBOX_APP_KEY;
  const appSecret = process.env.DROPBOX_APP_SECRET;
  const refreshToken = process.env.DROPBOX_REFRESH_TOKEN;
  if (!appKey || !appSecret || !refreshToken) {
    throw new Error("未設定 Dropbox 環境變數");
  }

  const res = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: appKey,
      client_secret: appSecret,
    }),
  });
  if (!res.ok) {
    throw new Error(`Dropbox token 換發失敗: ${res.status} ${await res.text()}`);
  }

  const json = await res.json();
  cachedToken = { token: json.access_token, expiresAt: now + (json.expires_in - 60) * 1000 };
  return cachedToken.token;
}

function buildPath(...parts: string[]): string {
  return "/" + parts.filter(Boolean).join("/");
}

// 與 drive.ts 介面對齊：回傳「資料夾路徑」而非 ID。Dropbox 上傳時會自動建立缺少的父層資料夾。
export async function getOrCreateMonthFolder(
  month: string,
  parentFolderId?: string
): Promise<string> {
  return parentFolderId ? `${parentFolderId}/${month}` : buildPath(month);
}

// 上傳一個檔案到指定路徑，回傳 Dropbox 檔案永久 ID
export async function uploadToDrive(
  fileName: string,
  mimeType: string,
  data: Buffer,
  parentFolderId?: string
): Promise<string> {
  const path = parentFolderId ? `${parentFolderId}/${fileName}` : buildPath(fileName);
  const token = await getAccessToken();

  const res = await fetch("https://content.dropboxapi.com/2/files/upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Dropbox-API-Arg": JSON.stringify({ path, mode: "overwrite", mute: true }),
      "Content-Type": "application/octet-stream",
    },
    body: new Uint8Array(data),
  });
  if (!res.ok) {
    throw new Error(`Dropbox 上傳失敗: ${res.status} ${await res.text()}`);
  }

  const json = await res.json();
  const id = json.id;
  if (!id) throw new Error("Dropbox 未回傳 fileId");
  return id;
}

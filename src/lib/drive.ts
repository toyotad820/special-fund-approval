import "server-only";
import { google } from "googleapis";

// ============================================================
// Google Drive 歸檔（OAuth — 個人帳號授權）
//
// 環境變數：
//   GOOGLE_OAUTH_CLIENT_ID       OAuth 客戶端 ID
//   GOOGLE_OAUTH_CLIENT_SECRET   OAuth 客戶端密碼
//   GOOGLE_OAUTH_REFRESH_TOKEN   OAuth refresh token（透過授權流程取得）
//   DRIVE_ACCESSORY_FOLDER_ID    歸檔母資料夾 ID
//
// 任一未設定時 isDriveEnabled()=false，呼叫端應跳過上傳（不阻斷核准流程）。
// ============================================================

export function isDriveEnabled(): boolean {
  return !!(
    process.env.GOOGLE_OAUTH_CLIENT_ID &&
    process.env.GOOGLE_OAUTH_CLIENT_SECRET &&
    process.env.GOOGLE_OAUTH_REFRESH_TOKEN &&
    process.env.DRIVE_ACCESSORY_FOLDER_ID
  );
}

function getDriveClient() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("未設定 OAuth 環境變數");
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, "http://localhost");
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  return google.drive({ version: "v3", auth: oauth2Client });
}

// 上傳一個檔案到歸檔資料夾，回傳 Drive fileId
export async function uploadToDrive(
  fileName: string,
  mimeType: string,
  data: Buffer
): Promise<string> {
  const folderId = process.env.DRIVE_ACCESSORY_FOLDER_ID;
  if (!folderId) throw new Error("未設定 DRIVE_ACCESSORY_FOLDER_ID");

  const drive = getDriveClient();
  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
    },
    media: {
      mimeType,
      body: data,
    },
    fields: "id",
    supportsAllDrives: true,
  });

  const id = res.data.id;
  if (!id) throw new Error("Drive 未回傳 fileId");
  return id;
}

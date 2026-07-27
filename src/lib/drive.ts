import "server-only";
import { google } from "googleapis";
import { Readable } from "node:stream";

// ============================================================
// Google Drive 歸檔（服務帳號）
//
// 環境變數：
//   GOOGLE_SA_KEY_BASE64        服務帳號 JSON 金鑰（base64 編碼整份）
//   DRIVE_ACCESSORY_FOLDER_ID   歸檔母資料夾 ID（需分享給服務帳號 client_email，編輯者）
//
// 兩者任一未設定時 isDriveEnabled()=false，呼叫端應跳過上傳（不阻斷核准流程）。
// ============================================================

export function isDriveEnabled(): boolean {
  return !!process.env.GOOGLE_SA_KEY_BASE64 && !!process.env.DRIVE_ACCESSORY_FOLDER_ID;
}

function getDriveClient() {
  const b64 = process.env.GOOGLE_SA_KEY_BASE64;
  if (!b64) throw new Error("未設定 GOOGLE_SA_KEY_BASE64");
  const credentials = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  return google.drive({ version: "v3", auth });
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
      body: Readable.from(data),
    },
    fields: "id",
    supportsAllDrives: true,
  });

  const id = res.data.id;
  if (!id) throw new Error("Drive 未回傳 fileId");
  return id;
}

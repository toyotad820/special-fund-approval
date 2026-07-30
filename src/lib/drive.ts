import "server-only";
import { google } from "googleapis";
import { JWT } from "google-auth-library";
import { Readable } from "stream";

// ============================================================
// Google Drive 歸檔（Service Account — 永不過期）
//
// 環境變數：
//   GOOGLE_SERVICE_ACCOUNT_KEY     Service Account JSON (base64)
//   DRIVE_ACCESSORY_FOLDER_ID      歸檔母資料夾 ID
//
// 任一未設定時 isDriveEnabled()=false，呼叫端應跳過上傳（不阻斷核准流程）。
// ============================================================

export function isDriveEnabled(): boolean {
  return !!(
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY &&
    process.env.DRIVE_ACCESSORY_FOLDER_ID
  );
}

function getDriveClient() {
  const keyB64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

  if (!keyB64) {
    throw new Error("未設定 GOOGLE_SERVICE_ACCOUNT_KEY");
  }

  let keyJson;
  try {
    const keyStr = Buffer.from(keyB64, "base64").toString("utf-8");
    keyJson = JSON.parse(keyStr);
  } catch (e) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY 解析失敗");
  }

  const jwtClient = new JWT({
    email: keyJson.client_email,
    key: keyJson.private_key,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });

  return google.drive({ version: "v3", auth: jwtClient as any });
}

// 取得或建立月份資料夾（YYYY-MM 格式），回傳資料夾 ID
export async function getOrCreateMonthFolder(
  month: string,
  parentFolderId?: string
): Promise<string> {
  const parentId = parentFolderId || process.env.DRIVE_ACCESSORY_FOLDER_ID;
  if (!parentId) throw new Error("未設定 DRIVE_ACCESSORY_FOLDER_ID");

  const drive = getDriveClient();

  // 查詢該月份資料夾是否已存在
  const query = `'${parentId}' in parents and name='${month}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const listRes = await drive.files.list({
    q: query,
    spaces: "drive",
    fields: "files(id)",
    pageSize: 1,
  });

  if (listRes.data.files && listRes.data.files.length > 0) {
    return listRes.data.files[0].id!;
  }

  // 不存在則建立新資料夾
  const createRes = await drive.files.create({
    requestBody: {
      name: month,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id",
    supportsAllDrives: true,
  });

  const folderId = createRes.data.id;
  if (!folderId) throw new Error("Drive 未回傳資料夾 ID");
  return folderId;
}

// 上傳一個檔案到指定資料夾，回傳 Drive fileId
export async function uploadToDrive(
  fileName: string,
  mimeType: string,
  data: Buffer,
  parentFolderId?: string
): Promise<string> {
  const folderId = parentFolderId || process.env.DRIVE_ACCESSORY_FOLDER_ID;
  if (!folderId) throw new Error("未設定上傳資料夾");

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

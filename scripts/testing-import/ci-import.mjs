// 測試期間專用：GitHub Actions 排程用（每日 06:00 台灣時間），從 Google Drive 抓最新的
// 「中部TOYOTA_特案申請彙整」試算表、清洗、直接覆蓋寫入正式站資料庫。
// 正式站上線後這支腳本、.github/workflows/daily-import.yml 連同整個 testing-import 目錄可以刪除。
//
// 需要的環境變數（皆存在 GitHub Actions Secrets，不進版控）：
//   GDRIVE_SA_KEY      服務帳戶金鑰 JSON（原始內容，不是路徑）
//   DRIVE_FILE_ID       Google Sheet 的檔案 ID
//   PROD_DATABASE_URL   正式站 Postgres 連線字串（DATABASE_URL_UNPOOLED）

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { importToDb } from "./lib.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, "../..");

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    cwd: ROOT,
    stdio: "inherit",
    shell: true,
    ...opts,
    env: { ...process.env, PYTHONIOENCODING: "utf-8", ...opts.env },
  });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} 失敗（exit ${r.status}）`);
}

function base64url(input) {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function getDriveAccessToken(sa) {
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/drive.readonly",
    aud: sa.token_uri,
    exp: now + 3600,
    iat: now,
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claim))}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(unsigned);
  const signature = signer
    .sign(sa.private_key)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const jwt = `${unsigned}.${signature}`;

  const res = await fetch(sa.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`取得 Drive access token 失敗: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function downloadSheetAsXlsx(fileId, token, outPath) {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`下載 Google Sheet 失敗（${res.status}）: ${await res.text()}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(outPath, buf);
  return buf.length;
}

async function main() {
  const saKeyRaw = process.env.GDRIVE_SA_KEY;
  const fileId = process.env.DRIVE_FILE_ID;
  const dbUrl = process.env.PROD_DATABASE_URL;
  if (!saKeyRaw || !fileId || !dbUrl) {
    throw new Error("缺少環境變數 GDRIVE_SA_KEY / DRIVE_FILE_ID / PROD_DATABASE_URL");
  }
  const sa = JSON.parse(saKeyRaw);

  const xlsxPath = path.join(DIR, "drive_download.xlsx");
  const cleanedPath = path.join(DIR, "cleaned_cases.json");

  try {
    console.log("[1/3] 從 Google Drive 下載最新試算表");
    const token = await getDriveAccessToken(sa);
    const bytes = await downloadSheetAsXlsx(fileId, token, xlsxPath);
    console.log(`下載完成: ${bytes} bytes`);

    console.log("\n[2/3] 清洗 Excel");
    run("python3", ["build_cases.py", xlsxPath, cleanedPath], { cwd: DIR });
    const records = JSON.parse(fs.readFileSync(cleanedPath, "utf-8"));
    console.log(`清洗完成，共 ${records.length} 筆。`);

    console.log("\n[3/3] 寫入正式站資料庫");
    await importToDb(records, dbUrl);
  } finally {
    if (fs.existsSync(xlsxPath)) fs.unlinkSync(xlsxPath);
    if (fs.existsSync(cleanedPath)) fs.unlinkSync(cleanedPath);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

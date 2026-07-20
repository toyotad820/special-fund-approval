// 測試期間專用：把 LINE bot 匯出的申請彙整 Excel 清洗後，整批覆蓋 Case 資料表
// （企業大口類別的既有案件會保留，不受影響）。
// 正式站上線、不再靠 Excel 匯入申請資料後，這支腳本連同整個 testing-import 目錄可以刪除。
//
// 用法：
//   node scripts/testing-import/run.mjs --file <申請彙整.xlsx> --target local
//   node scripts/testing-import/run.mjs --file <申請彙整.xlsx> --target production
//
// production 需要：本機已 `npx vercel link` 過此專案，且已用有權限的帳號 `npx vercel login`。

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { importToDb } from "./lib.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, "../..");

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

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

async function main() {
  const file = arg("file");
  const target = arg("target", "local");
  if (!file || !fs.existsSync(file)) {
    console.error("用法: node run.mjs --file <申請彙整.xlsx> --target local|production");
    process.exit(1);
  }
  if (!["local", "production"].includes(target)) {
    console.error("--target 只能是 local 或 production");
    process.exit(1);
  }

  const cleanedPath = path.join(DIR, "cleaned_cases.json");
  console.log(`\n[1/3] 清洗 Excel: ${file}`);
  run("python3", ["build_cases.py", path.resolve(file), cleanedPath], { cwd: DIR });
  const records = JSON.parse(fs.readFileSync(cleanedPath, "utf-8"));
  console.log(`清洗完成，共 ${records.length} 筆。`);

  let envFile;
  let mainError;
  try {
    if (target === "production") {
      console.log("\n[2/3] 切換到正式站 Postgres schema、抓取正式站連線字串");
      run("npx", ["prisma", "generate", "--schema=prisma/schema.production.prisma"]);
      envFile = path.join(ROOT, ".env.production.local.tmp");
      run("npx", ["vercel", "env", "pull", envFile, "--environment=production", "--yes"]);
      const envText = fs.readFileSync(envFile, "utf-8");
      const m = envText.match(/^DATABASE_URL_UNPOOLED="?(.*?)"?$/m);
      if (!m) throw new Error("在 vercel env pull 結果裡找不到 DATABASE_URL_UNPOOLED");
      console.log("\n[3/3] 寫入正式站資料庫");
      await importToDb(records, m[1]);
    } else {
      console.log("\n[2/3] 使用本機 SQLite schema");
      run("npx", ["prisma", "generate", "--schema=prisma/schema.prisma"]);
      console.log("\n[3/3] 寫入本機資料庫");
      await importToDb(records);
    }
  } catch (e) {
    mainError = e; // 先記住真正的錯誤，不要被下面清理步驟的錯誤蓋掉
  } finally {
    if (target === "production") {
      console.log("\n還原本機開發用 Prisma Client...");
      try {
        run("npx", ["prisma", "generate", "--schema=prisma/schema.prisma"]);
      } catch (cleanupErr) {
        console.error("還原本機 Prisma Client 失敗（不影響上面的匯入結果）:", cleanupErr.message);
      }
    }
    if (envFile && fs.existsSync(envFile)) fs.unlinkSync(envFile);
    if (fs.existsSync(cleanedPath)) fs.unlinkSync(cleanedPath);
  }
  if (mainError) throw mainError;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

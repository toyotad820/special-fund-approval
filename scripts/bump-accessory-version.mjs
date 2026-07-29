// pre-commit 觸發：把 ACCESSORY_VERSION 修訂號 +1（1.2.0 → 1.2.1）
import { readFileSync, writeFileSync } from "node:fs";

const FILE = "src/lib/version.ts";
const src = readFileSync(FILE, "utf8");
const re = /(ACCESSORY_VERSION = ")(\d+)\.(\d+)\.(\d+)(")/;
const m = src.match(re);
if (!m) {
  console.error("找不到 ACCESSORY_VERSION，略過自動遞增");
  process.exit(0);
}
const next = `${m[1]}${m[2]}.${m[3]}.${Number(m[4]) + 1}${m[5]}`;
writeFileSync(FILE, src.replace(re, next));
console.log(`ACCESSORY_VERSION → ${m[2]}.${m[3]}.${Number(m[4]) + 1}`);

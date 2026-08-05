// pre-commit 觸發：把 ACCESSORY_VERSION 修訂號 +1（1.2.0 → 1.2.1）
// 修訂號超過 20 就進位到次版號（例：1.4.20 → 1.5.1，不是 1.4.21）
import { readFileSync, writeFileSync } from "node:fs";

const FILE = "src/lib/version.ts";
const src = readFileSync(FILE, "utf8");
const re = /(ACCESSORY_VERSION = ")(\d+)\.(\d+)\.(\d+)(")/;
const m = src.match(re);
if (!m) {
  console.error("找不到 ACCESSORY_VERSION，略過自動遞增");
  process.exit(0);
}
let major = Number(m[2]);
let minor = Number(m[3]);
let patch = Number(m[4]) + 1;
if (patch > 20) {
  minor += 1;
  patch = 1;
}
const next = `${m[1]}${major}.${minor}.${patch}${m[5]}`;
writeFileSync(FILE, src.replace(re, next));
console.log(`ACCESSORY_VERSION → ${major}.${minor}.${patch}`);

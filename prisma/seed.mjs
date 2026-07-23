import pkg from "@prisma/client";
import bcrypt from "bcryptjs";

const { PrismaClient } = pkg;

const prisma = new PrismaClient();

function ym(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

async function main() {
  const pw = await bcrypt.hash("1234", 10);

  // 特案類別
  const categories = [
    "營業車",
    "租賃車",
    "企業大口",
    "員工車",
    "一般車",
  ];
  for (let i = 0; i < categories.length; i++) {
    await prisma.caseCategory.upsert({
      where: { name: categories[i] },
      update: { sortOrder: i },
      create: { name: categories[i], sortOrder: i },
    });
  }

  // 車種（現行 TOYOTA 標準車型清單，須與 src/lib/admin-actions.ts 的 STANDARD_CAR_MODELS 保持一致）
  const cars = [
    "ALTIS",
    "ALTIS HV",
    "C CROSS",
    "C CROSS HV",
    "TOWN ACE",
    "TOWN ACE VAN",
    "VIOS",
    "Y CROSS",
    "ALPHARD HV",
    "ALPHARD PHV",
    "CAMRY",
    "CAMRY HV",
    "COROLLA SP",
    "CROWN HV",
    "GR 86",
    "GR YARIS",
    "HILUX",
    "LAND CRUISER",
    "PRIUS PHV",
    "RAV4 HV",
    "RAV4 PHV",
    "SIENNA HV",
    "SUPRA",
    "URBAN CRUISER",
    "bZ4X",
  ];
  for (let i = 0; i < cars.length; i++) {
    await prisma.carModel.upsert({
      where: { name: cars[i] },
      update: { sortOrder: i },
      create: { name: cars[i], sortOrder: i },
    });
  }

  // 當月開放
  const month = ym();
  await prisma.monthWindow.upsert({
    where: { month },
    update: { isOpen: true },
    create: { month, isOpen: true },
  });

  // 人員
  const users = [
    { username: "boss", name: "王大明", role: "BUZHUGUAN", storeCode: "HQ", deptCode: null, systems: "fund,car-spec-change" },
    { username: "staff1", name: "Staff 陳小美", role: "STAFF", storeCode: "HQ", deptCode: null, systems: "fund" },

    { username: "s01", name: "D01 所長 林所長", role: "SUOZHANG", storeCode: "D01", deptCode: null, systems: "fund" },
    { username: "k01a", name: "D01 一課 課長 張課長", role: "KEZHANG", storeCode: "D01", deptCode: "1", systems: "fund" },
    { username: "k01b", name: "D01 二課 課長 李課長", role: "KEZHANG", storeCode: "D01", deptCode: "2", systems: "fund" },

    { username: "s02", name: "D02 所長 吳所長", role: "SUOZHANG", storeCode: "D02", deptCode: null, systems: "fund" },
    { username: "k02a", name: "D02 一課 課長 黃課長", role: "KEZHANG", storeCode: "D02", deptCode: "1", systems: "fund" },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { username: u.username },
      update: { name: u.name, role: u.role, storeCode: u.storeCode, deptCode: u.deptCode, systems: u.systems },
      create: { ...u, passwordHash: pw },
    });
  }

  console.log("Seed 完成。測試帳號密碼皆為 1234：");
  console.log(users.map((u) => `  ${u.username}  (${u.name})`).join("\n"));
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 暫時除錯用：查測試案件是否還在，查完即刪。
export async function GET() {
  const byId = await prisma.accessoryRequest.findUnique({
    where: { id: "cms7efga30001l204y8phwr28" },
  });
  const byDataNo = await prisma.accessoryRequest.findFirst({
    where: { dataNo: "D999999990001" },
  });
  const byName = await prisma.accessoryRequest.findMany({
    where: { customerName: "系統驗證測試" },
  });
  return NextResponse.json({ byId, byDataNo, byNameCount: byName.length, byName });
}

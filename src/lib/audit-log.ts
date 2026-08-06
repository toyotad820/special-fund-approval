import "server-only";
import { prisma } from "./prisma";

// 稽核紀錄最小版：只負責寫入，沒有查詢介面（出事時直接查 DB）。
// 寫入失敗不能反過來擋住真正的業務操作，所以吞掉錯誤只印 log。
export async function logAudit(entry: {
  actorUserId?: string | null;
  actorUsername?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  summary?: string;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: entry.actorUserId ?? null,
        actorUsername: entry.actorUsername ?? null,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        summary: entry.summary,
      },
    });
  } catch (e) {
    console.error("[audit-log] 寫入失敗:", e instanceof Error ? e.message : e);
  }
}

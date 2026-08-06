import "server-only";
import { getIronSession, type IronSession } from "iron-session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";

export type SessionData = {
  userId?: string;
  sessionVersion?: number;
};

const sessionOptions = {
  password: process.env.SESSION_SECRET as string,
  cookieName: "sfa_session",
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
  },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

// 取得目前登入者（未登入回傳 null）
export async function getCurrentUser() {
  const session = await getSession();
  if (!session.userId) return null;
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || !user.active) return null;
  // 密碼被改／後台重設過，sessionVersion 會落後，讓這個舊 session 失效
  // 注意：這裡可能在 render 階段被呼叫（cookies() 唯讀），不能在這裡寫 cookie／
  // destroy session，直接回 null 讓 requireUser 導去 /login 即可，
  // 舊 cookie 會在下次成功登入時被新 session 覆蓋掉
  if (session.sessionVersion !== user.sessionVersion) {
    return null;
  }
  return user;
}

// 強制需要登入，未登入導向 /login
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

import "server-only";
import { getIronSession, type IronSession } from "iron-session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";

export type SessionData = {
  userId?: string;
  sessionVersion?: number;
};

// iron-session 用這把密鑰加密／簽章整個 session cookie；太短或沒設，等於
// 所有登入狀態都可能被偽造或破解，這裡擋在第一次用到 session 之前就直接炸掉，
// 不要讓弱密鑰悄悄跑起來
const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET || SESSION_SECRET.length < 32) {
  throw new Error(
    "SESSION_SECRET 未設定或長度不足 32 字元，請確認環境變數（.env.local / Vercel 專案設定）"
  );
}

// cookie 的 Secure 旗標只能在 HTTPS 連線下被瀏覽器接受，非 HTTPS（例如公司內網
// 用純 HTTP 部署）下若還設 Secure，瀏覽器會直接丟掉這個 cookie，登入永遠卡在
// 被導回登入頁。正式站（Vercel，HTTPS）維持原本行為；內網 HTTP 部署在該台主機
// 的環境變數設 COOKIE_SECURE=false 關掉即可。
const secureCookie =
  process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false";

const sessionOptions = {
  password: SESSION_SECRET,
  cookieName: "sfa_session",
  cookieOptions: {
    httpOnly: true,
    secure: secureCookie,
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

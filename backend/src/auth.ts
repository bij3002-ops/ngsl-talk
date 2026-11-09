import { randomBytes, timingSafeEqual } from "node:crypto";
import type { Context, MiddlewareHandler } from "hono";
import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";

/**
 * 배포용 간단한 접속 비밀번호.
 * APP_PASSWORD가 없으면(로컬 개발) 인증을 끕니다.
 * 공개 주소로 배포할 때는 반드시 설정해야 합니다. 설정하지 않으면 누구나 내 Gemini API 사용량을 쓸 수 있습니다.
 */
const PASSWORD = process.env.APP_PASSWORD ?? "";
export const authEnabled = PASSWORD.length > 0;

// SESSION_SECRET이 없으면 서버가 시작될 때마다 새로 만듭니다. 이 경우 재시작하면 다시 로그인해야 합니다.
const SECRET = process.env.SESSION_SECRET || randomBytes(32).toString("hex");
const COOKIE = "ngsl_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30일

// 비밀번호 무차별 대입을 늦추기 위한 IP별 실패 횟수 (메모리)
const failures = new Map<string, { count: number; until: number }>();
const MAX_FAILURES = 5;
const LOCK_MS = 10 * 60 * 1000;

function clientIp(c: Context): string {
  return c.req.header("x-forwarded-for")?.split(",")[0].trim() || c.req.header("x-real-ip") || "local";
}

function isHttps(c: Context): boolean {
  return c.req.header("x-forwarded-proto") === "https" || new URL(c.req.url).protocol === "https:";
}

function passwordMatches(input: string): boolean {
  const a = Buffer.from(input);
  const b = Buffer.from(PASSWORD);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function isLoggedIn(c: Context): Promise<boolean> {
  if (!authEnabled) return true;
  return (await getSignedCookie(c, SECRET, COOKIE)) === "ok";
}

export async function login(c: Context) {
  if (!authEnabled) return c.json({ ok: true });
  const ip = clientIp(c);
  const f = failures.get(ip);
  if (f && f.count >= MAX_FAILURES && Date.now() < f.until) {
    throw new HTTPException(429, { message: "시도가 너무 많습니다. 10분 뒤에 다시 시도하세요." });
  }
  const { password } = await c.req.json<{ password?: string }>().catch(() => ({ password: "" }));
  if (!passwordMatches(String(password ?? ""))) {
    const count = (f && Date.now() < f.until ? f.count : 0) + 1;
    failures.set(ip, { count, until: Date.now() + LOCK_MS });
    throw new HTTPException(401, { message: "비밀번호가 맞지 않습니다." });
  }
  failures.delete(ip);
  await setSignedCookie(c, COOKIE, "ok", SECRET, {
    httpOnly: true,
    secure: isHttps(c),
    sameSite: "Lax",
    path: "/",
    maxAge: MAX_AGE,
  });
  return c.json({ ok: true });
}

export function logout(c: Context) {
  deleteCookie(c, COOKIE, { path: "/" });
  return c.json({ ok: true });
}

/** 로그인하지 않은 요청을 막습니다. (/api/auth/*, /api/health 제외) */
export const requireAuth: MiddlewareHandler = async (c, next) => {
  const path = c.req.path;
  if (path.startsWith("/api/auth/") || path === "/api/health") return next();
  if (!(await isLoggedIn(c))) throw new HTTPException(401, { message: "로그인이 필요합니다." });
  return next();
};

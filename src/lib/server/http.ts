import "server-only";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { ConfigError, getEnv } from "./env";
import { getKV, KEY_PREFIX } from "./kv";
import { AIError } from "@/lib/ai/provider";
import { timingSafeEqual, createHash } from "node:crypto";

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "PAYLOAD_TOO_LARGE"
  | "AI_NOT_CONFIGURED"
  | "EXAM_SECRET_MISSING"
  | "AI_FAILED"
  | "INSUFFICIENT_REFERENCE"
  | "INVALID_TOKEN"
  | "NOT_ENOUGH_QUESTIONS"
  | "INTERNAL";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ApiErrorCode,
    message: string,
    public readonly extra?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export function jsonError(status: number, code: ApiErrorCode, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: { code, message, ...extra } }, { status });
}

/** Bọc route handler: chuyển lỗi thành JSON thống nhất, không lộ stack/secret. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof ApiError) return jsonError(e.status, e.code, e.message, e.extra);
      if (e instanceof ConfigError) {
        const code = e.code === "ENV_INVALID" ? "INTERNAL" : e.code;
        return jsonError(503, code, e.message);
      }
      if (e instanceof AIError) {
        console.error("[ai]", e.code, e.message);
        return jsonError(502, "AI_FAILED", e.userMessage());
      }
      console.error("[api] unexpected error", e);
      return jsonError(500, "INTERNAL", "Đã có lỗi xảy ra phía máy chủ. Vui lòng thử lại.");
    }
  };
}

const MAX_BODY_BYTES = 512 * 1024;

export async function readJson<S extends z.ZodType>(req: Request, schema: S, maxBytes = MAX_BODY_BYTES): Promise<z.infer<S>> {
  assertSameOrigin(req);
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > maxBytes) throw new ApiError(413, "PAYLOAD_TOO_LARGE", "Dữ liệu gửi lên quá lớn.");
  const text = await req.text();
  if (text.length > maxBytes) throw new ApiError(413, "PAYLOAD_TOO_LARGE", "Dữ liệu gửi lên quá lớn.");
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ApiError(400, "BAD_REQUEST", "Body phải là JSON hợp lệ.");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new ApiError(400, "BAD_REQUEST", "Dữ liệu không hợp lệ.", {
      issues: parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`),
    });
  }
  return parsed.data;
}

/** Chặn request POST từ origin khác (giảm lạm dụng API công khai từ website khác). */
export function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return; // request không từ trình duyệt (curl, server) — vẫn bị rate limit
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    if (host && new URL(origin).host !== host) throw new ApiError(403, "FORBIDDEN", "Origin không được phép.");
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(403, "FORBIDDEN", "Origin không hợp lệ.");
  }
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  const ip = fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
  // Băm IP để không lưu IP thô
  return createHash("sha256").update(ip).digest("base64url").slice(0, 16);
}

/** Rate limit theo cửa sổ cố định. Ném ApiError 429 khi vượt. */
export async function rateLimit(name: string, id: string, limit: number, windowSeconds: number) {
  const kv = getKV();
  const windowStart = Math.floor(Date.now() / 1000 / windowSeconds);
  const key = `${KEY_PREFIX}rl:${name}:${id}:${windowStart}`;
  const count = await kv.incr(key, windowSeconds + 5);
  if (count > limit) {
    const retryAfter = windowSeconds - (Math.floor(Date.now() / 1000) % windowSeconds);
    throw new ApiError(429, "RATE_LIMITED", `Bạn thao tác quá nhanh. Vui lòng thử lại sau ${formatWait(retryAfter)}.`, { retryAfter });
  }
}

function formatWait(sec: number) {
  if (sec < 90) return `${sec} giây`;
  if (sec < 5400) return `${Math.ceil(sec / 60)} phút`;
  return `${Math.ceil(sec / 3600)} giờ`;
}

/** Ngân sách AI toàn hệ thống mỗi ngày — chặn chi phí khi bị lạm dụng phân tán. */
export async function consumeGlobalAIBudget(calls = 1) {
  const env = getEnv();
  const kv = getKV();
  const day = new Date().toISOString().slice(0, 10);
  let count = 0;
  for (let i = 0; i < calls; i++) count = await kv.incr(`${KEY_PREFIX}ai-budget:${day}`, 26 * 3600);
  if (count > env.RATE_LIMIT_GLOBAL_AI_PER_DAY) {
    throw new ApiError(429, "RATE_LIMITED", "Hệ thống đã đạt giới hạn lượt dùng AI hôm nay. Vui lòng thử lại vào ngày mai.");
  }
}

export function assertAdmin(req: Request) {
  const secret = getEnv().ADMIN_SECRET;
  if (!secret || secret.length < 16) throw new ApiError(403, "FORBIDDEN", "API quản trị chưa được bật (thiếu ADMIN_SECRET).");
  const given = req.headers.get("x-admin-secret") ?? "";
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(secret).digest();
  if (!timingSafeEqual(a, b)) throw new ApiError(403, "FORBIDDEN", "Sai mã quản trị.");
}

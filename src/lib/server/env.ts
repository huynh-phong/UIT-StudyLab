import "server-only";
import { z } from "zod";

/**
 * Toàn bộ cấu hình phụ thuộc môi trường được đọc tại đây — không đọc process.env rải rác.
 * Local: khai báo trong file `.env` ở thư mục gốc. Vercel: Project Settings → Environment Variables.
 */

const emptyToUndef = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const optStr = z.preprocess(emptyToUndef, z.string().trim().optional());
const int = (def: number, min: number, max: number) =>
  z.preprocess(emptyToUndef, z.coerce.number().int().min(min).max(max).default(def));
const bool = (def: boolean) =>
  z.preprocess(emptyToUndef, z.enum(["true", "false", "1", "0"]).default(def ? "true" : "false")).transform((v) => v === "true" || v === "1");

const EnvSchema = z.object({
  /** auto: dùng OpenAI nếu có OPENAI_API_KEY, ngược lại dùng Gemini nếu có GEMINI_API_KEY. */
  AI_PROVIDER: z.preprocess(emptyToUndef, z.enum(["auto", "openai", "gemini"]).default("auto")),
  OPENAI_API_KEY: optStr,
  OPENAI_MODEL: optStr,
  OPENAI_MODEL_GRADER: optStr,
  OPENAI_MODEL_GENERATOR: optStr,
  OPENAI_BASE_URL: z.preprocess(emptyToUndef, z.string().url().default("https://api.openai.com/v1")),
  GEMINI_API_KEY: optStr,
  GEMINI_MODEL: optStr,
  GEMINI_MODEL_GRADER: optStr,
  GEMINI_MODEL_GENERATOR: optStr,
  GEMINI_BASE_URL: z.preprocess(emptyToUndef, z.string().url().default("https://generativelanguage.googleapis.com/v1beta/openai")),
  /** Model dự phòng (cách nhau bởi dấu phẩy) — dùng khi model chính hết hạn mức (429) hoặc quá tải (503). */
  AI_MODEL_FALLBACKS: optStr,
  AI_TIMEOUT_MS: int(45_000, 5_000, 120_000),
  AI_MAX_RETRIES: int(1, 0, 3),
  AI_REVIEW_ENABLED: bool(true),
  /** Cho phép AI tạo câu hỏi thi thử. Mặc định tắt: AI chỉ dùng để chấm tự luận, đề thi tạo bằng thuật toán. */
  AI_EXAM_GENERATION_ENABLED: bool(false),

  EXAM_TOKEN_SECRET: optStr,
  EXAM_GEN_MAX_NEW_QUESTIONS: int(24, 0, 100),

  UPSTASH_REDIS_REST_URL: optStr,
  UPSTASH_REDIS_REST_TOKEN: optStr,

  RATE_LIMIT_ESSAY_PER_MINUTE: int(6, 1, 1000),
  RATE_LIMIT_ESSAY_PER_DAY: int(80, 1, 100_000),
  RATE_LIMIT_EXAM_PER_HOUR: int(6, 1, 1000),
  RATE_LIMIT_GLOBAL_AI_PER_DAY: int(2_000, 1, 10_000_000),

  ADMIN_SECRET: optStr,
  ENABLE_DEMO_CONTENT: z.preprocess(emptyToUndef, z.enum(["auto", "true", "false"]).default("auto")),
});

export type Env = z.infer<typeof EnvSchema>;

export class ConfigError extends Error {
  constructor(
    public readonly code: "AI_NOT_CONFIGURED" | "EXAM_SECRET_MISSING" | "ENV_INVALID",
    message: string,
  ) {
    super(message);
    this.name = "ConfigError";
  }
}

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const detail = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new ConfigError("ENV_INVALID", `Biến môi trường không hợp lệ — ${detail}`);
  }
  cached = parsed.data;
  return cached;
}

/** Dùng trong test để đọc lại env sau khi thay đổi process.env. */
export function resetEnvCache() {
  cached = null;
}

export interface AIConfig {
  provider: "openai" | "gemini";
  apiKey: string;
  baseUrl: string;
  graderModel: string;
  generatorModel: string;
  fallbackModels: string[];
  timeoutMs: number;
  maxRetries: number;
  reviewEnabled: boolean;
}

/** Chọn nhà cung cấp AI theo AI_PROVIDER và khóa đang có. null = chưa cấu hình. */
function resolveProvider(env: Env): "openai" | "gemini" | null {
  if (env.AI_PROVIDER === "openai") return env.OPENAI_API_KEY ? "openai" : null;
  if (env.AI_PROVIDER === "gemini") return env.GEMINI_API_KEY ? "gemini" : null;
  if (env.OPENAI_API_KEY) return "openai";
  if (env.GEMINI_API_KEY) return "gemini";
  return null;
}

function aiReady(env: Env) {
  const p = resolveProvider(env);
  return p === "openai" ? Boolean(env.OPENAI_MODEL) : p === "gemini" ? Boolean(env.GEMINI_MODEL) : false;
}

export function getAIConfig(): AIConfig {
  const env = getEnv();
  const provider = resolveProvider(env);
  const shared = {
    timeoutMs: env.AI_TIMEOUT_MS,
    maxRetries: env.AI_MAX_RETRIES,
    reviewEnabled: env.AI_REVIEW_ENABLED,
    fallbackModels: (env.AI_MODEL_FALLBACKS ?? "").split(",").map((m) => m.trim()).filter(Boolean),
  };
  const where = "Khai báo trong file .env (local) hoặc Vercel → Settings → Environment Variables.";
  if (provider === "openai") {
    if (!env.OPENAI_MODEL) throw new ConfigError("AI_NOT_CONFIGURED", `Tính năng AI chưa được cấu hình: thiếu OPENAI_MODEL. ${where}`);
    return {
      provider,
      apiKey: env.OPENAI_API_KEY!,
      baseUrl: env.OPENAI_BASE_URL.replace(/\/+$/, ""),
      graderModel: env.OPENAI_MODEL_GRADER ?? env.OPENAI_MODEL,
      generatorModel: env.OPENAI_MODEL_GENERATOR ?? env.OPENAI_MODEL,
      ...shared,
    };
  }
  if (provider === "gemini") {
    if (!env.GEMINI_MODEL) throw new ConfigError("AI_NOT_CONFIGURED", `Tính năng AI chưa được cấu hình: thiếu GEMINI_MODEL. ${where}`);
    return {
      provider,
      apiKey: env.GEMINI_API_KEY!,
      baseUrl: env.GEMINI_BASE_URL.replace(/\/+$/, ""),
      graderModel: env.GEMINI_MODEL_GRADER ?? env.GEMINI_MODEL,
      generatorModel: env.GEMINI_MODEL_GENERATOR ?? env.GEMINI_MODEL,
      ...shared,
    };
  }
  throw new ConfigError(
    "AI_NOT_CONFIGURED",
    `Tính năng AI chưa được cấu hình: cần OPENAI_API_KEY + OPENAI_MODEL hoặc GEMINI_API_KEY + GEMINI_MODEL. ${where}`,
  );
}

export function getExamSecret(): string {
  const secret = getEnv().EXAM_TOKEN_SECRET;
  if (!secret || secret.length < 32) {
    throw new ConfigError(
      "EXAM_SECRET_MISSING",
      "Thiếu EXAM_TOKEN_SECRET (tối thiểu 32 ký tự) để niêm phong đáp án đề thi. Tạo bằng: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
  }
  return secret;
}

export interface FeatureFlags {
  ai: boolean;
  /** AI được phép tạo câu hỏi thi thử (cần ai = true và AI_EXAM_GENERATION_ENABLED = true). */
  aiExamGeneration: boolean;
  examMode: boolean;
  persistentStore: boolean;
  admin: boolean;
}

/** Trạng thái tính năng (chỉ boolean, không bao giờ trả về giá trị secret). */
export function getFeatureFlags(): FeatureFlags {
  let env: Env;
  try {
    env = getEnv();
  } catch {
    return { ai: false, aiExamGeneration: false, examMode: false, persistentStore: false, admin: false };
  }
  return {
    ai: aiReady(env),
    aiExamGeneration: aiReady(env) && env.AI_EXAM_GENERATION_ENABLED,
    examMode: Boolean(env.EXAM_TOKEN_SECRET && env.EXAM_TOKEN_SECRET.length >= 32),
    persistentStore: Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN),
    admin: Boolean(env.ADMIN_SECRET && env.ADMIN_SECRET.length >= 16),
  };
}

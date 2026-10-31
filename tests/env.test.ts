import { afterEach, describe, expect, it } from "vitest";
import { getAIConfig, getFeatureFlags, resetEnvCache } from "@/lib/server/env";

const KEYS = ["AI_PROVIDER", "OPENAI_API_KEY", "OPENAI_MODEL", "GEMINI_API_KEY", "GEMINI_MODEL", "GEMINI_MODEL_GRADER"];
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));

function setEnv(vars: Record<string, string | undefined>) {
  for (const k of KEYS) delete process.env[k];
  for (const [k, v] of Object.entries(vars)) if (v !== undefined) process.env[k] = v;
  resetEnvCache();
}

afterEach(() => setEnv(saved));

describe("chọn nhà cung cấp AI", () => {
  it("auto: dùng Gemini khi chỉ có GEMINI_API_KEY", () => {
    setEnv({ GEMINI_API_KEY: "g-key", GEMINI_MODEL: "gemini-3.5-flash", GEMINI_MODEL_GRADER: "gemini-grader" });
    const cfg = getAIConfig();
    expect(cfg.provider).toBe("gemini");
    expect(cfg.baseUrl).toBe("https://generativelanguage.googleapis.com/v1beta/openai");
    expect(cfg.graderModel).toBe("gemini-grader");
    expect(cfg.generatorModel).toBe("gemini-3.5-flash");
    expect(getFeatureFlags().ai).toBe(true);
  });

  it("auto: ưu tiên OpenAI khi có cả hai khóa", () => {
    setEnv({ OPENAI_API_KEY: "o", OPENAI_MODEL: "gpt-x", GEMINI_API_KEY: "g", GEMINI_MODEL: "gm" });
    expect(getAIConfig().provider).toBe("openai");
  });

  it("chỉ định rõ gemini nhưng thiếu model → báo lỗi cấu hình rõ ràng", () => {
    setEnv({ AI_PROVIDER: "gemini", GEMINI_API_KEY: "g" });
    expect(() => getAIConfig()).toThrow(/GEMINI_MODEL/);
    expect(getFeatureFlags().ai).toBe(false);
  });

  it("không có khóa nào → AI tắt", () => {
    setEnv({});
    expect(getFeatureFlags().ai).toBe(false);
    expect(() => getAIConfig()).toThrow(/GEMINI_API_KEY/);
  });
});

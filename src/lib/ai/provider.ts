import "server-only";
import type { z } from "zod";
import { getAIConfig, type AIConfig } from "@/lib/server/env";

/**
 * Lớp trừu tượng nhà cung cấp AI. Các service (chấm tự luận, tạo đề) chỉ phụ thuộc interface này,
 * nên có thể đổi nhà cung cấp bằng cách thêm một implementation mới và chọn qua AI_PROVIDER.
 */

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "file"; file: { filename: string; file_data: string } };

export interface JsonRequest<S extends z.ZodType> {
  purpose: "grader" | "generator" | "reviewer" | "import";
  system: string;
  user: string | ContentPart[];
  schema: S;
  maxOutputTokens?: number;
  /** Thời hạn tuyệt đối (epoch ms) — không gọi/chờ quá mốc này. */
  deadline?: number;
}

export interface AIProvider {
  readonly name: string;
  generateJson<S extends z.ZodType>(req: JsonRequest<S>): Promise<z.infer<S>>;
}

export type AIErrorCode = "timeout" | "rate_limited" | "upstream" | "invalid_output" | "auth";

export class AIError extends Error {
  constructor(
    public readonly code: AIErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AIError";
  }
  userMessage() {
    switch (this.code) {
      case "timeout":
        return "AI phản hồi quá lâu. Vui lòng thử lại.";
      case "rate_limited":
        return "Nhà cung cấp AI đang quá tải hoặc hết hạn mức. Vui lòng thử lại sau.";
      case "auth":
        return "Khóa API AI không hợp lệ hoặc không có quyền dùng model đã cấu hình.";
      case "invalid_output":
        return "AI trả về dữ liệu không đúng định dạng. Vui lòng thử lại.";
      default:
        return "Dịch vụ AI tạm thời gặp lỗi. Vui lòng thử lại.";
    }
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Tách JSON từ phản hồi (phòng khi model bọc trong ```json). */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const body = fenced ? fenced[1] : trimmed;
  try {
    return JSON.parse(body);
  } catch {
    const start = body.indexOf("{");
    const end = body.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(body.slice(start, end + 1));
    throw new AIError("invalid_output", "Phản hồi không phải JSON");
  }
}

/** Provider cho mọi API tương thích OpenAI Chat Completions (OpenAI, Gemini OpenAI-compatible endpoint…). */
class OpenAICompatibleProvider implements AIProvider {
  readonly name: string;
  constructor(private cfg: AIConfig) {
    this.name = cfg.provider;
  }

  private model(purpose: JsonRequest<z.ZodType>["purpose"]) {
    return purpose === "grader" ? this.cfg.graderModel : this.cfg.generatorModel;
  }

  async generateJson<S extends z.ZodType>(req: JsonRequest<S>): Promise<z.infer<S>> {
    let lastError: AIError = new AIError("upstream", "Không có phản hồi");
    let feedback: string | null = null;

    // Thứ tự model: model chính rồi tới các model dự phòng (khi hết hạn mức/quá tải thì chuyển ngay)
    const models = [this.model(req.purpose), ...this.cfg.fallbackModels.filter((m) => m !== this.model(req.purpose))];
    let modelIndex = 0;
    const totalAttempts = this.cfg.maxRetries + models.length;

    for (let attempt = 0; attempt < totalAttempts; attempt++) {
      const remaining = req.deadline ? req.deadline - Date.now() : Infinity;
      if (remaining < 3_000) throw new AIError("timeout", "Hết thời gian cho phép");
      const timeout = Math.min(this.cfg.timeoutMs, remaining);

      try {
        const messages: { role: string; content: string | ContentPart[] }[] = [
          { role: "system", content: `${req.system}\n\nChỉ trả về một đối tượng JSON hợp lệ, không kèm văn bản khác.` },
          { role: "user", content: req.user },
        ];
        if (feedback) messages.push({ role: "user", content: feedback });

        const res = await fetch(`${this.cfg.baseUrl}/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.cfg.apiKey}` },
          body: JSON.stringify({
            model: models[modelIndex],
            messages,
            response_format: { type: "json_object" },
            max_completion_tokens: req.maxOutputTokens ?? 4_000,
          }),
          signal: AbortSignal.timeout(timeout),
        });

        if (res.status === 401 || res.status === 403) throw new AIError("auth", `HTTP ${res.status}`);
        if (res.status === 404 || res.status === 400) {
          const detail = await res.text().catch(() => "");
          // Lỗi cấu hình (model không tồn tại, tham số sai) — không retry
          throw new AIError("upstream", `HTTP ${res.status}: ${detail.slice(0, 300)}`);
        }
        if (res.status === 429 || res.status === 503) {
          lastError = new AIError(res.status === 429 ? "rate_limited" : "upstream", `HTTP ${res.status} (${models[modelIndex]})`);
          if (modelIndex < models.length - 1) {
            modelIndex++;
            continue; // chuyển sang model dự phòng ngay, không chờ
          }
        } else if (!res.ok) {
          lastError = new AIError("upstream", `HTTP ${res.status}`);
        } else {
          const data = (await res.json()) as { choices?: { message?: { content?: string | null } ; finish_reason?: string }[] };
          const content = data.choices?.[0]?.message?.content;
          if (!content) {
            lastError = new AIError("invalid_output", `Phản hồi rỗng (finish_reason=${data.choices?.[0]?.finish_reason})`);
          } else {
            let json: unknown;
            try {
              json = extractJson(content);
            } catch {
              lastError = new AIError("invalid_output", "Không phân tích được JSON");
              feedback = "Phản hồi trước không phải JSON hợp lệ. Hãy trả về đúng một đối tượng JSON.";
              continue;
            }
            const parsed = req.schema.safeParse(json);
            if (parsed.success) return parsed.data;
            const issues = parsed.error.issues.slice(0, 6).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
            lastError = new AIError("invalid_output", `Sai schema: ${issues}`);
            feedback = `JSON trước không đúng schema yêu cầu (${issues}). Hãy sửa và trả lại toàn bộ JSON.`;
            continue;
          }
        }
      } catch (e) {
        if (e instanceof AIError && (e.code === "auth" || e.code === "upstream")) throw e;
        if (e instanceof AIError) lastError = e;
        else if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) lastError = new AIError("timeout", "Hết thời gian chờ");
        else lastError = new AIError("upstream", e instanceof Error ? e.message : String(e));
      }
      if (attempt < totalAttempts - 1) await sleep(600 * 2 ** Math.min(attempt, 4) + Math.random() * 300);
    }
    throw lastError;
  }
}

let override: AIProvider | null = null;

/** Cho phép test thay provider giả. */
export function setAIProviderForTesting(p: AIProvider | null) {
  override = p;
}

export function getAIProvider(): AIProvider {
  if (override) return override;
  const cfg = getAIConfig();
  // Gemini cung cấp endpoint tương thích OpenAI nên dùng chung một implementation.
  return new OpenAICompatibleProvider(cfg);
}

import { z } from "zod";
import {
  CalcCheckSchema,
  DifficultySchema,
  QuestionSchema,
  RubricItemSchema,
  type Difficulty,
  type Question,
} from "@/lib/bank/schema";
import { verifyCalcOptions } from "@/lib/net/ipv4";
import { maxSimilarity, normalizeText, questionText } from "./similarity";

/**
 * Kiểm tra chất lượng câu hỏi do AI tạo — các bước tất định (không cần AI):
 * cấu trúc, đáp án xác định, phương án trùng, độ tương đồng với câu gốc/câu đã có, phép tính IPv4.
 * Bước AI reviewer độc lập nằm ở exam-generator.ts. AI tự kiểm tra KHÔNG được coi là bằng chứng tuyệt đối:
 * câu đạt chỉ được gắn trạng thái "ai_checked" và có thể bị người quản trị loại bỏ.
 */

export const GeneratedMcqSchema = z.object({
  content: z.string().min(15).max(3000),
  options: z
    .array(z.object({ id: z.enum(["A", "B", "C", "D"]), content: z.string().min(1).max(600) }))
    .length(4),
  correctOptionId: z.enum(["A", "B", "C", "D"]),
  explanation: z.object({
    correct: z.string().min(10).max(800),
    whyCorrect: z.string().min(10).max(1500),
    whyWrong: z.record(z.string(), z.string().min(5).max(800)),
    related: z.string().max(1500).optional(),
    tip: z.string().max(300).optional(),
  }),
  difficulty: DifficultySchema,
  basedOn: z.array(z.string()).max(5).default([]),
  knowledgePoint: z.string().min(3).max(300),
  calc: CalcCheckSchema.nullish(),
});
export type GeneratedMcq = z.infer<typeof GeneratedMcqSchema>;

export const GeneratedEssaySchema = z.object({
  content: z.string().min(20).max(3000),
  modelAnswer: z.string().min(30).max(5000),
  rubric: z.array(RubricItemSchema).min(1).max(8),
  difficulty: DifficultySchema,
  basedOn: z.array(z.string()).max(5).default([]),
  knowledgePoint: z.string().min(3).max(300),
});
export type GeneratedEssay = z.infer<typeof GeneratedEssaySchema>;

export interface QCContext {
  /** Câu gốc của chương (để chống trùng). */
  sources: Question[];
  /** Câu đã có trong pool/đã chọn (để chống trùng lẫn nhau). */
  existing: { content: string; options?: { content: string }[] }[];
  /** Ngưỡng bị loại khi quá giống. */
  rejectSimilarity?: number;
}

export interface QCResult {
  ok: boolean;
  reasons: string[];
  flags: string[];
  checks: string[];
  maxSourceSimilarity: number;
}

const IP_WITH_PREFIX = /\b\d{1,3}(?:\.\d{1,3}){3}\s*\/\s*\d{1,2}\b/;

export function checkGeneratedMcq(q: GeneratedMcq, ctx: QCContext): QCResult {
  const reasons: string[] = [];
  const flags: string[] = [];
  const checks: string[] = ["schema"];
  const threshold = ctx.rejectSimilarity ?? 0.6;

  const ids = q.options.map((o) => o.id);
  if (new Set(ids).size !== 4 || !["A", "B", "C", "D"].every((x) => ids.includes(x as "A")))
    reasons.push("Mã phương án phải đủ A, B, C, D và không trùng");

  const normalized = q.options.map((o) => normalizeText(o.content));
  if (new Set(normalized).size !== normalized.length) reasons.push("Có phương án trùng nội dung");
  if (normalized.some((o) => /^(tất cả|cả [a-d] và [a-d]|không có (đáp án|phương án) nào)/.test(o)))
    reasons.push("Không dùng phương án dạng \"tất cả/không có đáp án nào\" vì dễ gây nhiều đáp án đúng");
  checks.push("options");

  const wrongIds = ids.filter((id) => id !== q.correctOptionId);
  const missingWhy = wrongIds.filter((id) => !q.explanation.whyWrong[id]);
  if (missingWhy.length) reasons.push(`Thiếu giải thích vì sao phương án ${missingWhy.join(", ")} sai`);
  checks.push("explanation");

  if (q.calc) {
    const v = verifyCalcOptions(q.calc, q.options, q.correctOptionId);
    if (!v.ok) reasons.push(`Kiểm tra phép tính độc lập thất bại: ${v.reason}`);
    else checks.push("calc");
    if (!q.content.includes(q.calc.ip)) reasons.push("Dữ kiện calc không khớp địa chỉ IP trong đề");
  } else if (IP_WITH_PREFIX.test(q.content)) {
    flags.push("Câu có dữ kiện IP/prefix nhưng không kiểm chứng được bằng bộ tính độc lập");
  }

  const text = questionText(q);
  const src = maxSimilarity(text, ctx.sources.map((s) => questionText(s as { content: string; options?: { content: string }[] })));
  if (src.score >= threshold) reasons.push(`Quá giống câu gốc (${Math.round(src.score * 100)}%)`);
  const ex = maxSimilarity(text, ctx.existing.map(questionText));
  if (ex.score >= threshold) reasons.push(`Trùng với câu đã có (${Math.round(ex.score * 100)}%)`);
  checks.push("similarity");

  return { ok: reasons.length === 0, reasons, flags, checks, maxSourceSimilarity: src.score };
}

export function checkGeneratedEssay(q: GeneratedEssay, ctx: QCContext): QCResult {
  const reasons: string[] = [];
  const flags: string[] = [];
  const checks = ["schema"];
  const threshold = ctx.rejectSimilarity ?? 0.6;
  const rubricIds = q.rubric.map((r) => r.id);
  if (new Set(rubricIds).size !== rubricIds.length) reasons.push("Trùng id tiêu chí rubric");
  checks.push("rubric");
  const src = maxSimilarity(q.content, ctx.sources.map((s) => s.content));
  if (src.score >= threshold) reasons.push(`Quá giống câu gốc (${Math.round(src.score * 100)}%)`);
  const ex = maxSimilarity(q.content, ctx.existing.map((e) => e.content));
  if (ex.score >= threshold) reasons.push(`Trùng với câu đã có (${Math.round(ex.score * 100)}%)`);
  checks.push("similarity");
  return { ok: reasons.length === 0, reasons, flags, checks, maxSourceSimilarity: src.score };
}

/** Chuyển câu AI tạo (đã qua QC) thành Question chuẩn, gắn nhãn nguồn gốc. */
export function toQuestion(
  g: GeneratedMcq | GeneratedEssay,
  meta: { id: string; courseId: string; examType: Question["examType"]; chapterId: string; flags: string[]; sourceIds: string[] },
): Question {
  const base = {
    id: meta.id,
    courseId: meta.courseId,
    examType: meta.examType,
    chapterId: meta.chapterId,
    difficulty: g.difficulty as Difficulty,
    source: { kind: "ai_generated" as const, reference: g.knowledgePoint, basedOn: g.basedOn.filter((b) => meta.sourceIds.includes(b)) },
    verification: meta.flags.length ? ("needs_review" as const) : ("ai_checked" as const),
    tags: ["ai"],
  };
  const q: unknown =
    "options" in g
      ? {
          ...base,
          type: "mcq",
          content: g.content,
          options: g.options,
          correctOptionId: g.correctOptionId,
          explanation: {
            correct: g.explanation.correct,
            whyCorrect: g.explanation.whyCorrect,
            whyWrong: Object.fromEntries(Object.entries(g.explanation.whyWrong).filter(([k]) => k !== g.correctOptionId)),
            related: g.explanation.related,
            tip: g.explanation.tip,
          },
          ...(g.calc ? { calc: g.calc } : {}),
        }
      : { ...base, type: "essay", content: g.content, essay: { modelAnswer: g.modelAnswer, rubric: g.rubric } };
  return QuestionSchema.parse(q);
}

import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Chapter, Difficulty, Question } from "@/lib/bank/schema";
import { getAIProvider } from "./provider";
import {
  checkGeneratedEssay,
  checkGeneratedMcq,
  GeneratedEssaySchema,
  GeneratedMcqSchema,
  toQuestion,
  type GeneratedEssay,
  type GeneratedMcq,
} from "@/lib/exam/quality";

/**
 * AI Exam Generator: tạo câu hỏi MỚI theo phạm vi một chương, dựa trên câu gốc làm mẫu,
 * rồi đưa qua kiểm tra tất định (quality.ts) và một bước AI reviewer giải độc lập.
 */

export interface GenerateRequest {
  courseName: string;
  courseId: string;
  examType: Question["examType"];
  chapter: Chapter;
  type: "mcq" | "essay";
  count: number;
  difficulty?: Partial<Record<Difficulty, number>>;
  /** Câu gốc của chương — mẫu phạm vi kiến thức và độ khó. */
  sources: Question[];
  /** Câu đã có (pool) — để tránh trùng. */
  existing: Question[];
  review: boolean;
  deadline: number;
}

export interface GenerateOutcome {
  accepted: Question[];
  rejected: { content: string; reasons: string[] }[];
}

const SYSTEM = `Bạn là giảng viên ra đề môn Mạng máy tính (đại học, tiếng Việt).
Nhiệm vụ: tạo câu hỏi THI THỬ MỚI dựa trên các câu gốc được cung cấp.
Yêu cầu bắt buộc:
- Kiểm tra cùng năng lực/kiến thức và độ khó tương đương câu gốc, nằm trong phạm vi chương. Không đưa kiến thức ngoài phạm vi thể hiện trong câu gốc và mô tả chương.
- Câu phải MỚI: thay đổi dữ kiện, số liệu, tình huống hoặc góc hỏi. KHÔNG chép lại câu gốc, KHÔNG chỉ đảo thứ tự phương án hay đổi vài từ.
- Trắc nghiệm: đúng 4 phương án A–D, chỉ MỘT phương án đúng, các phương án nhiễu hợp lý (lỗi sai thường gặp). Không dùng "tất cả đều đúng/sai".
- Tính toán phải chính xác. Với câu tính toán IPv4 (địa chỉ mạng, broadcast, mask, host đầu/cuối, số host khả dụng, tổng số địa chỉ, wildcard), BẮT BUỘC điền trường "calc" để hệ thống kiểm tra độc lập; phương án đúng phải ghi đúng định dạng kết quả (ví dụ "192.168.1.64" hoặc "30").
- Giải thích ngắn gọn, đúng kiến thức; whyWrong giải thích từng phương án sai.
- Nội dung dùng Markdown; công thức dùng LaTeX trong $...$; địa chỉ IP đặt trong \`backtick\`.`;

function sourceBlock(sources: Question[]) {
  return sources
    .slice(0, 12)
    .map((q) => {
      if (q.type === "mcq") {
        const opts = q.options.map((o) => `   ${o.id}. ${o.content}`).join("\n");
        return `[${q.id}] (${q.difficulty ?? "?"}) ${q.content}\n${opts}\n   Đáp án: ${q.correctOptionId}`;
      }
      return `[${q.id}] (tự luận, ${q.difficulty ?? "?"}) ${q.content}${q.essay ? `\n   Ý chính đáp án: ${q.essay.rubric.map((r) => r.criterion).join("; ")}` : ""}`;
    })
    .join("\n\n");
}

function difficultyHint(d: GenerateRequest["difficulty"], count: number) {
  if (!d) return "Giữ phân bố độ khó tương tự câu gốc.";
  const parts = Object.entries(d)
    .filter(([, v]) => (v ?? 0) > 0)
    .map(([k, v]) => `${k}: ${v}`);
  return parts.length ? `Phân bố độ khó mong muốn (tỉ lệ) cho ${count} câu: ${parts.join(", ")}.` : "Giữ phân bố độ khó tương tự câu gốc.";
}

const McqBatchSchema = z.object({ questions: z.array(z.unknown()).min(1).max(12) });

function mcqPrompt(req: GenerateRequest, n: number) {
  return `Học phần: ${req.courseName}
Chương: ${req.chapter.title}${req.chapter.description ? ` — ${req.chapter.description}` : ""}

CÂU GỐC (mẫu phạm vi và độ khó):
${sourceBlock(req.sources)}

${req.existing.length ? `ĐÃ CÓ (không tạo trùng):\n${req.existing.slice(0, 15).map((q) => `- ${q.content.slice(0, 160)}`).join("\n")}\n` : ""}
Tạo ${n} câu trắc nghiệm mới. ${difficultyHint(req.difficulty, n)}
Trả về JSON:
{"questions":[{
  "content": "...",
  "options": [{"id":"A","content":"..."},{"id":"B","content":"..."},{"id":"C","content":"..."},{"id":"D","content":"..."}],
  "correctOptionId": "A|B|C|D",
  "explanation": {"correct":"1–3 câu vì sao đúng","whyCorrect":"giải thích chi tiết","whyWrong":{"<id sai>":"vì sao sai"},"related":"kiến thức liên quan","tip":"ghi nhớ ngắn"},
  "difficulty": "easy|medium|hard",
  "basedOn": ["<id câu gốc tham khảo>"],
  "knowledgePoint": "kiến thức được kiểm tra",
  "calc": {"kind":"ipv4","ip":"x.x.x.x","prefix":26,"ask":"network|broadcast|mask|firstHost|lastHost|usableHosts|totalAddresses|wildcard"} hoặc null
}]}`;
}

function essayPrompt(req: GenerateRequest, n: number) {
  return `Học phần: ${req.courseName}
Chương: ${req.chapter.title}${req.chapter.description ? ` — ${req.chapter.description}` : ""}

CÂU GỐC (mẫu phạm vi và độ khó):
${sourceBlock(req.sources)}

${req.existing.length ? `ĐÃ CÓ (không tạo trùng):\n${req.existing.slice(0, 10).map((q) => `- ${q.content.slice(0, 160)}`).join("\n")}\n` : ""}
Tạo ${n} câu tự luận mới kèm đáp án mẫu và rubric chấm (tổng điểm rubric tùy ý, mỗi tiêu chí có keyPoints). ${difficultyHint(req.difficulty, n)}
Trả về JSON:
{"questions":[{"content":"...","modelAnswer":"...","rubric":[{"id":"r1","criterion":"...","points":1,"keyPoints":["..."]}],"difficulty":"easy|medium|hard","basedOn":["<id câu gốc>"],"knowledgePoint":"..."}]}`;
}

const ReviewSchema = z.object({
  reviews: z.array(
    z.object({
      index: z.number().int(),
      answer: z.string().nullable(),
      ambiguous: z.boolean(),
      inScope: z.boolean(),
      factualIssues: z.array(z.string()).max(5),
    }),
  ),
});

const EssayReviewSchema = z.object({
  reviews: z.array(
    z.object({
      index: z.number().int(),
      inScope: z.boolean(),
      answerable: z.boolean(),
      modelAnswerCorrect: z.boolean(),
      issues: z.array(z.string()).max(5),
    }),
  ),
});

const REVIEW_SYSTEM = `Bạn là người phản biện đề thi Mạng máy tính độc lập. Bạn KHÔNG được biết đáp án do người ra đề chọn.
Với mỗi câu: tự giải, chọn phương án đúng; đánh dấu ambiguous=true nếu có từ 2 phương án đúng trở lên hoặc không có phương án nào đúng;
inScope=false nếu kiến thức nằm ngoài phạm vi chương được mô tả; liệt kê lỗi kiến thức/tính toán nếu có. Trả lời trung thực, ngắn gọn.`;

async function reviewMcqs(req: GenerateRequest, items: GeneratedMcq[]) {
  const body = items
    .map((q, i) => `#${i}\n${q.content}\n${q.options.map((o) => `${o.id}. ${o.content}`).join("\n")}`)
    .join("\n\n");
  const out = await getAIProvider().generateJson({
    purpose: "reviewer",
    system: REVIEW_SYSTEM,
    user: `Chương: ${req.chapter.title}${req.chapter.description ? ` — ${req.chapter.description}` : ""}\n\n${body}\n\nTrả về JSON: {"reviews":[{"index":0,"answer":"A|B|C|D|null","ambiguous":false,"inScope":true,"factualIssues":[]}]}`,
    schema: ReviewSchema,
    maxOutputTokens: 3_000,
    deadline: req.deadline,
  });
  return out.reviews;
}

async function reviewEssays(req: GenerateRequest, items: GeneratedEssay[]) {
  const body = items.map((q, i) => `#${i}\nĐề: ${q.content}\nĐáp án mẫu: ${q.modelAnswer}`).join("\n\n");
  const out = await getAIProvider().generateJson({
    purpose: "reviewer",
    system: `Bạn là người phản biện đề tự luận Mạng máy tính độc lập. Kiểm tra: câu hỏi trong phạm vi chương, có thể trả lời rõ ràng, đáp án mẫu đúng kiến thức.`,
    user: `Chương: ${req.chapter.title}\n\n${body}\n\nTrả về JSON: {"reviews":[{"index":0,"inScope":true,"answerable":true,"modelAnswerCorrect":true,"issues":[]}]}`,
    schema: EssayReviewSchema,
    maxOutputTokens: 2_000,
    deadline: req.deadline,
  });
  return out.reviews;
}

export async function generateQuestions(req: GenerateRequest): Promise<GenerateOutcome> {
  const n = Math.min(Math.max(req.count, 1), 8);
  const accepted: Question[] = [];
  const rejected: GenerateOutcome["rejected"] = [];
  const sourceIds = req.sources.map((s) => s.id);
  const existing: { content: string; options?: { content: string }[] }[] = [...req.existing];

  const raw = await getAIProvider().generateJson({
    purpose: "generator",
    system: SYSTEM,
    user: req.type === "mcq" ? mcqPrompt(req, n) : essayPrompt(req, n),
    schema: McqBatchSchema,
    maxOutputTokens: 6_000,
    deadline: req.deadline,
  });

  if (req.type === "mcq") {
    const candidates: { g: GeneratedMcq; flags: string[] }[] = [];
    for (const item of raw.questions) {
      const parsed = GeneratedMcqSchema.safeParse(item);
      if (!parsed.success) {
        rejected.push({ content: String((item as { content?: unknown })?.content ?? "").slice(0, 120), reasons: ["Sai cấu trúc"] });
        continue;
      }
      const qc = checkGeneratedMcq(parsed.data, { sources: req.sources, existing });
      if (!qc.ok) {
        rejected.push({ content: parsed.data.content.slice(0, 120), reasons: qc.reasons });
        continue;
      }
      existing.push(parsed.data);
      candidates.push({ g: parsed.data, flags: qc.flags });
    }

    if (req.review && candidates.length) {
      const reviews = await reviewMcqs(req, candidates.map((c) => c.g));
      candidates.forEach((c, i) => {
        const r = reviews.find((x) => x.index === i);
        const reasons: string[] = [];
        if (!r) reasons.push("Không có kết quả phản biện");
        else {
          if (r.ambiguous) reasons.push("Phản biện: có nhiều hoặc không có đáp án đúng");
          if (!r.inScope) reasons.push("Phản biện: ngoài phạm vi chương");
          if ((r.answer ?? "").toUpperCase() !== c.g.correctOptionId && !c.g.calc)
            reasons.push(`Phản biện giải ra ${r.answer ?? "không xác định"}, khác đáp án ${c.g.correctOptionId}`);
          if (r.factualIssues.length) reasons.push(...r.factualIssues.map((x) => `Phản biện: ${x}`));
          // Câu có calc đã được kiểm chứng bằng code; nếu reviewer giải khác thì chỉ gắn cờ.
          if (c.g.calc && (r.answer ?? "").toUpperCase() !== c.g.correctOptionId) c.flags.push("Reviewer AI giải khác kết quả tính độc lập");
        }
        if (reasons.length) rejected.push({ content: c.g.content.slice(0, 120), reasons });
        else accepted.push(toQuestion(c.g, { id: `ai-${randomUUID()}`, courseId: req.courseId, examType: req.examType, chapterId: req.chapter.id, flags: c.flags, sourceIds }));
      });
    } else {
      for (const c of candidates)
        accepted.push(
          toQuestion(c.g, {
            id: `ai-${randomUUID()}`,
            courseId: req.courseId,
            examType: req.examType,
            chapterId: req.chapter.id,
            flags: [...c.flags, "Chưa qua bước phản biện AI"],
            sourceIds,
          }),
        );
    }
  } else {
    const candidates: { g: GeneratedEssay; flags: string[] }[] = [];
    for (const item of raw.questions) {
      const parsed = GeneratedEssaySchema.safeParse(item);
      if (!parsed.success) {
        rejected.push({ content: String((item as { content?: unknown })?.content ?? "").slice(0, 120), reasons: ["Sai cấu trúc"] });
        continue;
      }
      const qc = checkGeneratedEssay(parsed.data, { sources: req.sources, existing });
      if (!qc.ok) {
        rejected.push({ content: parsed.data.content.slice(0, 120), reasons: qc.reasons });
        continue;
      }
      existing.push(parsed.data);
      candidates.push({ g: parsed.data, flags: qc.flags });
    }
    const reviews = req.review && candidates.length ? await reviewEssays(req, candidates.map((c) => c.g)) : null;
    candidates.forEach((c, i) => {
      const r = reviews?.find((x) => x.index === i);
      const reasons: string[] = [];
      if (reviews) {
        if (!r) reasons.push("Không có kết quả phản biện");
        else {
          if (!r.inScope) reasons.push("Phản biện: ngoài phạm vi chương");
          if (!r.answerable) reasons.push("Phản biện: đề không rõ ràng");
          if (!r.modelAnswerCorrect) reasons.push("Phản biện: đáp án mẫu chưa đúng");
        }
      } else c.flags.push("Chưa qua bước phản biện AI");
      if (reasons.length) rejected.push({ content: c.g.content.slice(0, 120), reasons });
      else accepted.push(toQuestion(c.g, { id: `ai-${randomUUID()}`, courseId: req.courseId, examType: req.examType, chapterId: req.chapter.id, flags: c.flags, sourceIds }));
    });
  }

  return { accepted, rejected };
}

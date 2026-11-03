import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { isExamEligible, type BlueprintSlot, type BuiltExam, type Question } from "@/lib/bank/schema";
import { generateQuestions } from "@/lib/ai/exam-generator";
import { addToPool, isServable, markServed, readPool } from "./pool";
import { generateFromTemplate, templatesFor } from "./generators";
import type { SealedExam } from "./token";
import type { PublicExam, PublicExamQuestion } from "./types";

export const GENERATOR_VERSION = "g1";

/** Tỉ lệ câu tính toán sinh bằng thuật toán trong mỗi ô của đề (chế độ "algo"). */
export const ALGO_GENERATED_RATIO = 0.3;

export interface AssembleOptions {
  exam: BuiltExam & { course: { code: string; name: string } };
  /** algo: câu gốc + câu tính toán sinh bằng thuật toán · bank: chỉ câu gốc · ai: AI tạo câu mới */
  mode: "algo" | "ai" | "bank";
  /** ID câu người dùng đã gặp gần đây — ưu tiên tránh lặp lại. */
  exclude: string[];
  aiAvailable: boolean;
  maxNewQuestions: number;
  review: boolean;
  deadline: number;
  /** Gọi trước mỗi lượt gọi AI (kiểm tra ngân sách). */
  beforeAICall: (calls: number) => Promise<void>;
  rng?: () => number;
}

export interface AssembleResult {
  sealed: SealedExam;
  warnings: string[];
  composition: { aiGenerated: number; generated: number; fromBank: number };
}

export class NotEnoughQuestionsError extends Error {}

function shuffleInPlace<T>(a: T[], rng: () => number) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  return shuffleInPlace([...arr], rng);
}

/** Chọn `count` câu, ưu tiên câu chưa gặp; chỉ dùng lại câu đã gặp khi thiếu. */
export function pickPreferFresh<T extends { id: string }>(items: T[], count: number, exclude: Set<string>, taken: Set<string>, rng?: () => number) {
  const available = items.filter((i) => !taken.has(i.id));
  const fresh = shuffle(available.filter((i) => !exclude.has(i.id)), rng);
  const seen = shuffle(available.filter((i) => exclude.has(i.id)), rng);
  return [...fresh, ...seen].slice(0, count);
}

export async function assembleExam(o: AssembleOptions): Promise<AssembleResult> {
  const bp = o.exam.blueprint;
  if (!bp) throw new NotEnoughQuestionsError("Kỳ thi này chưa có cấu trúc đề chuẩn (blueprint).");
  const exclude = new Set(o.exclude);
  const rng = o.rng ?? Math.random;
  const taken = new Set<string>();
  const warnings: string[] = [];
  let budget = o.maxNewQuestions;
  let aiDisabledReason: string | null = o.mode === "ai" && !o.aiAvailable ? "AI chưa được cấu hình" : null;
  const chapterTitle = (id: string) => o.exam.chapters.find((c) => c.id === id)?.title ?? id;

  const picked: { slot: BlueprintSlot; questions: Question[] }[] = bp.slots.map((slot) => ({ slot, questions: [] }));

  // Các ô cùng (chương, loại) được xử lý tuần tự để không ghi đè pool; các nhóm khác chạy song song.
  const groups = new Map<string, number[]>();
  bp.slots.forEach((s, i) => {
    const k = `${s.chapterId}:${s.type}`;
    groups.set(k, [...(groups.get(k) ?? []), i]);
  });

  await Promise.all(
    [...groups.values()].map(async (indexes) => {
      for (const i of indexes) {
        const slot = bp.slots[i];
        const chapter = o.exam.chapters.find((c) => c.id === slot.chapterId)!;
        const sourceChapters = new Set([slot.chapterId, ...(slot.alsoFrom ?? [])]);
        const bankPool = o.exam.questions.filter((q) => sourceChapters.has(q.chapterId) && q.type === slot.type && isExamEligible(q));
        const out = picked[i].questions;

        if (o.mode === "ai") {
          const pool = (await readPool(o.exam.key, slot.chapterId, slot.type)).filter(isServable).map((p) => p.question);
          for (const q of pickPreferFresh(pool.filter((q) => !exclude.has(q.id)), slot.count, exclude, taken, o.rng)) {
            out.push(q);
            taken.add(q.id);
          }
          let need = slot.count - out.length;
          if (need > 0 && !aiDisabledReason && budget > 0 && bankPool.length > 0) {
            const n = Math.min(need + 1, budget, 8);
            budget -= n;
            try {
              await o.beforeAICall(o.review ? 2 : 1);
              const gen = await generateQuestions({
                courseName: `${o.exam.course.code} — ${o.exam.course.name}`,
                courseId: o.exam.courseId,
                examType: o.exam.examType,
                chapter,
                type: slot.type,
                count: n,
                difficulty: slot.difficulty,
                sources: bankPool,
                existing: pool,
                review: o.review,
                deadline: o.deadline,
              });
              await addToPool(o.exam.key, slot.chapterId, slot.type, gen.accepted);
              for (const q of gen.accepted.slice(0, need)) {
                out.push(q);
                taken.add(q.id);
              }
              if (gen.rejected.length) console.info(`[exam-gen] ${chapter.id}/${slot.type}: loại ${gen.rejected.length} câu`, gen.rejected.map((r) => r.reasons));
            } catch (e) {
              console.error("[exam-gen] lỗi tạo câu", e instanceof Error ? e.message : e);
              const msg = e instanceof Error && "code" in e && (e as { code?: string }).code === "RATE_LIMITED" ? e.message : "Không tạo được câu mới bằng AI lúc này";
              aiDisabledReason = msg;
            }
          } else if (need > 0 && bankPool.length === 0 && !aiDisabledReason) {
            warnings.push(`Chương "${chapter.title}" chưa có câu gốc đã xác minh để AI làm mẫu.`);
          }
          need = slot.count - out.length;
          if (need > 0) {
            const fill = pickPreferFresh(bankPool, need, exclude, taken, o.rng);
            for (const q of fill) {
              out.push(q);
              taken.add(q.id);
            }
            if (fill.length) warnings.push(`${fill.length} câu chương "${chapter.title}" (${slot.type === "mcq" ? "trắc nghiệm" : "tự luận"}) lấy từ ngân hàng câu gốc do ${aiDisabledReason ?? "chưa đủ câu AI đạt kiểm định"}.`);
          }
        } else if (o.mode === "algo") {
          // Một phần câu là bài tính toán mới sinh bằng thuật toán (mỗi dạng tối đa 1 câu), phần còn lại lấy câu gốc
          const templates = slot.type === "mcq" ? shuffle(templatesFor(slot.chapterId), rng) : [];
          const genCount = templates.length ? Math.min(templates.length, Math.max(1, Math.round(slot.count * ALGO_GENERATED_RATIO))) : 0;
          for (const t of templates.slice(0, genCount)) out.push(generateFromTemplate(t, Math.floor(rng() * 2 ** 32)));
          for (const q of pickPreferFresh(bankPool, slot.count - out.length, exclude, taken, o.rng)) {
            out.push(q);
            taken.add(q.id);
          }
          // Ngân hàng chưa đủ câu: bổ sung thêm câu sinh tự động (số liệu khác nhau)
          for (let k = 0; out.length < slot.count && templates.length; k++)
            out.push(generateFromTemplate(templates[k % templates.length], Math.floor(rng() * 2 ** 32)));
          if (slot.count >= 2) shuffleInPlace(out, rng);
        } else {
          for (const q of pickPreferFresh(bankPool, slot.count, exclude, taken, o.rng)) {
            out.push(q);
            taken.add(q.id);
          }
        }

        if (out.length < slot.count) {
          throw new NotEnoughQuestionsError(
            `Không đủ câu hỏi cho chương "${chapter.title}" (${slot.type === "mcq" ? "trắc nghiệm" : "tự luận"}): cần ${slot.count}, có ${out.length}.`,
          );
        }
      }
    }),
  );

  // Đánh dấu số lần sử dụng của câu AI trong pool
  await Promise.all(
    picked.map(({ slot, questions }) =>
      markServed(o.exam.key, slot.chapterId, slot.type, questions.filter((q) => q.source.kind === "ai_generated").map((q) => q.id)),
    ),
  );

  // Trắc nghiệm trước, tự luận sau; giữ thứ tự ô trong blueprint
  const ordered = [...picked.filter((p) => p.slot.type === "mcq"), ...picked.filter((p) => p.slot.type === "essay")].flatMap((p) =>
    p.questions.map((q) => ({ question: q, points: p.slot.pointsEach, chapterTitle: chapterTitle(q.chapterId) })),
  );
  const ids = ordered.map((x) => x.question.id);
  const version = `${GENERATOR_VERSION}-${createHash("sha256").update(ids.join("|")).digest("hex").slice(0, 10)}`;
  const aiGenerated = ordered.filter((x) => x.question.source.kind === "ai_generated").length;
  const generated = ordered.filter((x) => x.question.source.kind === "generated").length;

  return {
    sealed: {
      v: 1,
      attemptId: randomUUID(),
      examKey: o.exam.key,
      title: bp.title,
      version,
      createdAt: Date.now(),
      durationMinutes: bp.durationMinutes,
      questions: ordered,
    },
    warnings: [...new Set(warnings)],
    composition: { aiGenerated, generated, fromBank: ordered.length - aiGenerated - generated },
  };
}

export function toPublicExam(
  r: AssembleResult,
  token: string,
  exam: BuiltExam & { course: { code: string } },
): PublicExam {
  const s = r.sealed;
  const questions: PublicExamQuestion[] = s.questions.map(({ question: q, points, chapterTitle }, index) => ({
    id: q.id,
    index,
    type: q.type,
    content: q.content,
    options: q.type === "mcq" ? q.options.map((o) => ({ id: o.id, content: o.content })) : undefined,
    points,
    chapterId: q.chapterId,
    chapterTitle,
    difficulty: q.difficulty,
    origin: q.source.kind,
    answerFormat: q.type === "essay" ? q.essay?.format : undefined,
    placeholder: q.type === "essay" ? q.essay?.placeholder : undefined,
  }));
  return {
    attemptId: s.attemptId,
    examKey: s.examKey,
    courseCode: exam.course.code,
    examType: exam.examType,
    title: s.title,
    version: s.version,
    isDemo: exam.isDemo,
    blueprintVerified: exam.blueprint?.status === "verified",
    createdAt: s.createdAt,
    durationMinutes: s.durationMinutes,
    deadline: s.durationMinutes ? s.createdAt + s.durationMinutes * 60_000 : null,
    questions,
    totalPoints: questions.reduce((a, q) => a + q.points, 0),
    composition: r.composition,
    warnings: r.warnings,
    token,
  };
}

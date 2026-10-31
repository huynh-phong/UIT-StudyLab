import type { McqQuestion } from "@/lib/bank/schema";
import type { McqGrade } from "./types";

/** Chấm một câu trắc nghiệm bằng đáp án chuẩn. Không phân biệt hoa/thường, bỏ khoảng trắng. */
export function gradeMcq(question: Pick<McqQuestion, "id" | "correctOptionId" | "options">, selected: string | null | undefined, points = 1): McqGrade {
  const sel = typeof selected === "string" ? selected.trim().toUpperCase() : "";
  const valid = sel !== "" && question.options.some((o) => o.id === sel);
  const isCorrect = valid && sel === question.correctOptionId.toUpperCase();
  return {
    questionId: question.id,
    selected: valid ? sel : null,
    correctOptionId: question.correctOptionId,
    isCorrect,
    blank: !valid,
    points,
    awarded: isCorrect ? points : 0,
  };
}

/** Nội dung giải thích hiển thị khi trả lời sai — đúng với phương án người dùng đã chọn. */
export function wrongFeedback(question: McqQuestion, selected: string) {
  const e = question.explanation;
  return {
    correctOptionId: question.correctOptionId,
    correctContent: question.options.find((o) => o.id === question.correctOptionId)?.content ?? "",
    whyCorrect: e.whyCorrect ?? e.correct,
    whySelectedWrong: e.whyWrong?.[selected] ?? null,
    related: e.related ?? null,
    tip: e.tip ?? null,
  };
}

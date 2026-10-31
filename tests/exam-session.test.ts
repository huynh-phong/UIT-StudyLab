import { describe, expect, it } from "vitest";
import { scoreExam, type ScoringInput } from "@/lib/exam/scoring";
import { openExam, sealExam, TokenError, TOKEN_TTL_MS, type SealedExam } from "@/lib/exam/token";
import { pickPreferFresh, shuffle } from "@/lib/exam/assemble";
import type { EssayGradeResult } from "@/lib/grading/types";
import { essay, mcq, SECRET } from "./helpers";

const T0 = 1_700_000_000_000;

function exam(durationMinutes: number | null = 30): ScoringInput {
  return {
    attemptId: "att-1",
    examKey: "it005/midterm",
    title: "Đề thử",
    version: "g1-abc",
    createdAt: T0,
    durationMinutes,
    questions: [
      { question: mcq({ id: "m1", chapterId: "ch1" }), points: 1, chapterTitle: "Chương 1" },
      { question: mcq({ id: "m2", chapterId: "ch1" }), points: 1, chapterTitle: "Chương 1" },
      { question: mcq({ id: "m3", chapterId: "ch2" }), points: 2, chapterTitle: "Chương 2" },
      { question: essay({ id: "e1", chapterId: "ch2" }), points: 4, chapterTitle: "Chương 2" },
    ],
  };
}

const graded = (score: number, maxScore = 4): EssayGradeResult => ({
  status: "graded",
  score,
  maxScore,
  rubric: [],
  correctPoints: [],
  missingPoints: [],
  incorrectPoints: [],
  feedback: "ok",
  suggestions: [],
  offTopic: false,
  modelAnswer: "x",
  gradedAt: new Date(T0).toISOString(),
});

const meta = { startedAt: T0 + 1000, submittedAt: T0 + 61_000, autoSubmitted: false };

describe("scoreExam — chấm bài thi", () => {
  it("chấm đủ khi tự luận đã có điểm", () => {
    const r = scoreExam(exam(), { m1: { optionId: "B" }, m2: { optionId: "A" }, e1: { text: "bài làm" } }, { e1: graded(3) }, meta);
    expect(r.gradingStatus).toBe("complete");
    expect(r.mcqScore).toBe(1);
    expect(r.mcqMax).toBe(4);
    expect(r.essayScore).toBe(3);
    expect(r.totalScore).toBe(4);
    expect(r.totalMax).toBe(8);
    expect(r.score10).toBe(5);
    expect(r.counts).toEqual({ correct: 2, wrong: 1, blank: 1, pendingEssay: 0, total: 4 });
    expect(r.durationSec).toBe(60);
    const ch2 = r.chapters.find((c) => c.chapterId === "ch2")!;
    expect(ch2).toMatchObject({ total: 2, blank: 1, correct: 1, score: 3, maxScore: 6 });
  });

  it("không hiển thị điểm tổng khi chấm tự luận lỗi, nhưng vẫn giữ điểm trắc nghiệm", () => {
    const r = scoreExam(exam(), { m1: { optionId: "B" }, e1: { text: "bài làm" } }, { e1: { status: "failed", message: "AI lỗi" } }, meta);
    expect(r.gradingStatus).toBe("partial");
    expect(r.totalScore).toBeNull();
    expect(r.score10).toBeNull();
    expect(r.mcqScore).toBe(1);
    expect(r.counts.pendingEssay).toBe(1);
    expect(r.questions.find((q) => q.question.id === "e1")?.essay?.status).toBe("failed");
  });

  it("tự luận bỏ trống được tính 0 điểm, không chờ chấm", () => {
    const r = scoreExam(exam(), { e1: { text: "   " } }, {}, meta);
    expect(r.gradingStatus).toBe("complete");
    expect(r.totalScore).toBe(0);
    expect(r.counts.blank).toBe(4);
    expect(r.questions[3].essay).toEqual({ status: "blank" });
  });

  it("giới hạn thời gian làm bài theo hạn nộp", () => {
    const r = scoreExam(exam(1), {}, {}, { startedAt: T0, submittedAt: T0 + 10 * 60_000, autoSubmitted: true });
    expect(r.durationSec).toBe(60);
    expect(r.autoSubmitted).toBe(true);
  });

  it("không cho startedAt sớm hơn thời điểm tạo đề", () => {
    const r = scoreExam(exam(null), {}, {}, { startedAt: T0 - 999_999, submittedAt: T0 + 5000, autoSubmitted: false });
    expect(r.durationSec).toBe(5);
  });
});

describe("token niêm phong đề thi", () => {
  const sealed: SealedExam = { v: 1, ...exam(), createdAt: Date.now() };

  it("mã hóa và giải mã đúng, không lộ đáp án dạng rõ", () => {
    const token = sealExam(sealed, SECRET);
    expect(token.startsWith("v1.")).toBe(true);
    expect(token).not.toContain("correctOptionId");
    expect(Buffer.from(token.slice(3), "base64url").toString("latin1")).not.toContain("192.168.10.64");
    const opened = openExam(token, SECRET);
    expect(opened.questions).toHaveLength(4);
    expect(opened.questions[0].question).toMatchObject({ type: "mcq", correctOptionId: "B" });
  });

  it("từ chối token bị sửa", () => {
    const token = sealExam(sealed, SECRET);
    const i = token.length - 10;
    const tampered = token.slice(0, i) + (token[i] === "A" ? "B" : "A") + token.slice(i + 1);
    expect(() => openExam(tampered, SECRET)).toThrow(TokenError);
  });

  it("từ chối token ký bằng secret khác", () => {
    const token = sealExam(sealed, SECRET);
    expect(() => openExam(token, `${SECRET}-other`)).toThrow(TokenError);
  });

  it("từ chối token hết hạn", () => {
    const old = sealExam({ ...sealed, createdAt: Date.now() - TOKEN_TTL_MS - 1000 }, SECRET);
    expect(() => openExam(old, SECRET)).toThrow(/hết hạn/);
  });

  it("từ chối chuỗi rác", () => {
    expect(() => openExam("v1.abc", SECRET)).toThrow(TokenError);
    expect(() => openExam("garbage", SECRET)).toThrow(TokenError);
  });
});

describe("chọn câu cho đề", () => {
  const items = Array.from({ length: 10 }, (_, i) => ({ id: `q${i}` }));

  it("ưu tiên câu chưa gặp, chỉ dùng lại câu đã gặp khi thiếu", () => {
    const exclude = new Set(["q0", "q1", "q2", "q3", "q4", "q5", "q6", "q7"]);
    const picked = pickPreferFresh(items, 4, exclude, new Set());
    expect(picked).toHaveLength(4);
    expect(picked.slice(0, 2).map((p) => p.id).sort()).toEqual(["q8", "q9"]);
  });

  it("không chọn câu đã nằm trong đề", () => {
    const picked = pickPreferFresh(items, 10, new Set(), new Set(["q3"]));
    expect(picked.map((p) => p.id)).not.toContain("q3");
    expect(picked).toHaveLength(9);
  });

  it("shuffle giữ nguyên phần tử", () => {
    expect(shuffle(items).map((i) => i.id).sort()).toEqual(items.map((i) => i.id).sort());
  });
});

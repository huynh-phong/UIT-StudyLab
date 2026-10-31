import { describe, expect, it } from "vitest";
import { AIGradeSchema, emptyAnswerResult, normalizeGrade } from "@/lib/ai/essay-grader";
import { extractJson } from "@/lib/ai/provider";
import { checkGeneratedEssay, checkGeneratedMcq, GeneratedMcqSchema, toQuestion, type GeneratedMcq } from "@/lib/exam/quality";
import { similarity } from "@/lib/exam/similarity";
import { essay, mcq } from "./helpers";

const spec = essay().essay!;

const aiGrade = {
  rubric: [
    { id: "r1", awarded: 5, comment: "Đúng" },
    { id: "r2", awarded: 1.5, comment: "Thiếu ví dụ" },
    { id: "hack", awarded: 100, comment: "id lạ" },
  ],
  correctPoints: ["TCP hướng kết nối"],
  missingPoints: ["Ví dụ UDP"],
  incorrectPoints: [],
  feedback: "Khá tốt.",
  suggestions: ["Bổ sung ví dụ"],
  offTopic: false,
};

describe("kết quả AI chấm tự luận", () => {
  it("schema từ chối dữ liệu sai cấu trúc", () => {
    expect(AIGradeSchema.safeParse({ ...aiGrade, rubric: "x" }).success).toBe(false);
    expect(AIGradeSchema.safeParse({ ...aiGrade, feedback: "" }).success).toBe(false);
    expect(AIGradeSchema.safeParse({ ...aiGrade, rubric: [{ id: "r1", awarded: -1, comment: "" }] }).success).toBe(false);
    expect(AIGradeSchema.safeParse(aiGrade).success).toBe(true);
  });

  it("kẹp điểm theo tối đa từng tiêu chí và bỏ tiêu chí lạ", () => {
    const r = normalizeGrade(AIGradeSchema.parse(aiGrade), spec);
    expect(r.rubric.map((x) => x.awarded)).toEqual([2, 1.5]);
    expect(r.rubric.find((x) => x.id === "hack")).toBeUndefined();
    expect(r.score).toBe(3.5);
    expect(r.maxScore).toBe(4);
  });

  it("bổ sung tiêu chí AI bỏ sót với 0 điểm", () => {
    const r = normalizeGrade(AIGradeSchema.parse({ ...aiGrade, rubric: [{ id: "r2", awarded: 2, comment: "ok" }] }), spec);
    expect(r.rubric.find((x) => x.id === "r1")?.awarded).toBe(0);
    expect(r.score).toBe(2);
  });

  it("quy đổi theo thang điểm của câu trong đề", () => {
    const r = normalizeGrade(AIGradeSchema.parse(aiGrade), spec, 2);
    expect(r.score).toBe(1.75);
    expect(r.maxScore).toBe(2);
  });

  it("bài lạc đề nhận 0 điểm", () => {
    const r = normalizeGrade(AIGradeSchema.parse({ ...aiGrade, offTopic: true }), spec);
    expect(r.score).toBe(0);
  });

  it("bài trống không cần gọi AI", () => {
    const r = emptyAnswerResult(spec, 4);
    expect(r).toMatchObject({ status: "graded", score: 0, maxScore: 4 });
    expect(r.missingPoints).toHaveLength(2);
  });

  it("tách JSON từ phản hồi có code fence", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Kết quả: {"a":2} xong')).toEqual({ a: 2 });
    expect(() => extractJson("không có json")).toThrow();
  });
});

function generated(overrides: Partial<GeneratedMcq> = {}): GeneratedMcq {
  return GeneratedMcqSchema.parse({
    content: "Một máy tính có địa chỉ `10.20.30.200/27`. Địa chỉ broadcast của mạng con chứa máy này là gì?",
    options: [
      { id: "A", content: "10.20.30.223" },
      { id: "B", content: "10.20.30.255" },
      { id: "C", content: "10.20.30.192" },
      { id: "D", content: "10.20.30.207" },
    ],
    correctOptionId: "A",
    explanation: {
      correct: "/27 có bước nhảy 32; 200 thuộc khối 192–223.",
      whyCorrect: "Mạng 10.20.30.192/27, broadcast = 192 + 32 − 1 = 223.",
      whyWrong: { B: "Đây là broadcast của /24.", C: "Đây là địa chỉ mạng.", D: "Nhầm bước nhảy 16." },
    },
    difficulty: "medium",
    basedOn: ["q-mcq"],
    knowledgePoint: "Tính broadcast",
    calc: { kind: "ipv4", ip: "10.20.30.200", prefix: 27, ask: "broadcast" },
    ...overrides,
  });
}

describe("kiểm tra chất lượng câu AI tạo", () => {
  const ctx = { sources: [mcq()], existing: [] };

  it("chấp nhận câu hợp lệ có phép tính đúng", () => {
    const r = checkGeneratedMcq(generated(), ctx);
    expect(r.reasons).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.checks).toContain("calc");
  });

  it("loại câu có đáp án khai báo sai so với phép tính độc lập", () => {
    const r = checkGeneratedMcq(generated({ correctOptionId: "B" }), ctx);
    expect(r.ok).toBe(false);
    expect(r.reasons.join(" ")).toMatch(/phép tính/);
  });

  it("loại câu có phương án trùng nội dung", () => {
    const g = generated();
    const r = checkGeneratedMcq({ ...g, options: g.options.map((o) => (o.id === "D" ? { ...o, content: "10.20.30.192" } : o)) }, ctx);
    expect(r.reasons.join(" ")).toMatch(/trùng nội dung/);
  });

  it("loại câu thiếu giải thích cho phương án sai", () => {
    const g = generated();
    const r = checkGeneratedMcq({ ...g, explanation: { ...g.explanation, whyWrong: { B: "x sai rồi" } } }, ctx);
    expect(r.reasons.join(" ")).toMatch(/Thiếu giải thích/);
  });

  it("loại câu chép gần nguyên văn câu gốc (chỉ đảo phương án)", () => {
    const src = mcq();
    const copy = generated({
      content: src.content,
      options: [...src.options].reverse().map((o, i) => ({ id: (["A", "B", "C", "D"] as const)[i], content: o.content })),
      correctOptionId: "C",
      calc: null,
      explanation: { correct: "Giải thích đủ dài.", whyCorrect: "Giải thích đủ dài.", whyWrong: { A: "sai vì…", B: "sai vì…", D: "sai vì…" } },
    });
    const r = checkGeneratedMcq(copy, { sources: [src], existing: [] });
    expect(r.ok).toBe(false);
    expect(r.reasons.join(" ")).toMatch(/Quá giống câu gốc/);
  });

  it("gắn cờ cần duyệt khi câu có IP/prefix nhưng không có dữ kiện kiểm tra", () => {
    const r = checkGeneratedMcq(generated({ calc: null }), ctx);
    expect(r.ok).toBe(true);
    expect(r.flags.length).toBeGreaterThan(0);
  });

  it("schema từ chối câu không đủ 4 phương án", () => {
    const g = generated();
    expect(GeneratedMcqSchema.safeParse({ ...g, options: g.options.slice(0, 3) }).success).toBe(false);
  });

  it("chuyển thành Question với nhãn nguồn AI và trạng thái phù hợp", () => {
    const q = toQuestion(generated(), { id: "ai-1", courseId: "it005", examType: "midterm", chapterId: "ch1", flags: [], sourceIds: ["q-mcq"] });
    expect(q).toMatchObject({ type: "mcq", source: { kind: "ai_generated", basedOn: ["q-mcq"] }, verification: "ai_checked" });
    const flagged = toQuestion(generated(), { id: "ai-2", courseId: "it005", examType: "midterm", chapterId: "ch1", flags: ["x"], sourceIds: [] });
    expect(flagged.verification).toBe("needs_review");
    expect(flagged.source.basedOn).toEqual([]);
  });

  it("kiểm tra câu tự luận AI tạo", () => {
    const g = {
      content: "Giải thích vì sao UDP phù hợp cho ứng dụng gọi thoại qua Internet hơn TCP.",
      modelAnswer: "UDP không có cơ chế truyền lại nên độ trễ thấp, phù hợp thoại thời gian thực…",
      rubric: [
        { id: "r1", criterion: "Độ trễ", points: 1 },
        { id: "r1", criterion: "Trùng id", points: 1 },
      ],
      difficulty: "medium" as const,
      basedOn: [],
      knowledgePoint: "UDP",
    };
    expect(checkGeneratedEssay(g, { sources: [], existing: [] }).reasons.join(" ")).toMatch(/Trùng id/);
  });

  it("độ tương đồng: giống hệt = 1, khác hẳn ≈ 0", () => {
    expect(similarity("một hai ba bốn năm", "một hai ba bốn năm")).toBe(1);
    expect(similarity("định tuyến gói tin ở tầng mạng", "cổng mặc định của HTTPS là bao nhiêu")).toBeLessThan(0.1);
  });
});

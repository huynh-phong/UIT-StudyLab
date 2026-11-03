import { describe, expect, it } from "vitest";
import bankData from "@/generated/bank.json";
import { isStudyEligible, QuestionSchema, type BuiltBank, type BuiltExam, type Question } from "@/lib/bank/schema";
import { assembleExam } from "@/lib/exam/assemble";

const bank = bankData as unknown as BuiltBank;
const course = bank.courses.find((c) => c.id === "it004")!;
const exam = course.exams.find((e) => e.examType === "midterm")! as BuiltExam;
const real = { ...exam, course: { code: course.code, name: course.name } };
const qs = exam.questions as Question[];
const essays = qs.filter((q) => q.type === "essay");
const study = qs.filter(isStudyEligible);

const make = () =>
  assembleExam({ exam: real, mode: "algo", exclude: [], aiAvailable: false, maxNewQuestions: 0, review: false, deadline: Date.now() + 10_000, beforeAICall: async () => {} });

describe("ngân hàng IT004", () => {
  it("mọi câu hợp lệ schema, ID và đề không trùng", () => {
    for (const q of qs) expect(QuestionSchema.safeParse(q).success, q.id).toBe(true);
    expect(new Set(qs.map((q) => q.id)).size).toBe(qs.length);
    const contents = qs.map((q) => q.content.replace(/\s+/g, " ").trim());
    expect(contents.length - new Set(contents).size).toBe(0);
  });

  it("phủ đủ mọi dạng trong đề, mỗi dạng đủ câu để luyện", () => {
    const count = (tag: string) => study.filter((q) => q.tags?.includes(tag)).length;
    const min: Record<string, number> = {
      "dang-chon-chieu": 15, "dang-ket": 20, "dang-neu-co": 15, "dang-khong": 10, "dang-chi": 3, "dang-ca-hai": 10, "dang-chia": 20,
      "dang-gom": 15, "dang-gom-loc": 5, "dang-max-ket": 3, "dang-ti-le": 5, "dang-hoac": 3,
      "dang-check-in": 5, "dang-check-sosanh": 5, "dang-fk": 5, "dang-add-column": 3, "dang-alter-column": 2, "dang-drop-column": 2, "dang-update-tinh": 10, "dang-update-gan": 4, "dang-delete": 4, "dang-delete-null": 2,
    };
    for (const [tag, n] of Object.entries(min)) expect(count(tag), tag).toBeGreaterThanOrEqual(n);
    for (const id of ["it004-c1", "it004-c2", "it004-sql", "it004-ra1", "it004-ra2", "it004-ra3", "it004-ra4", "it004-ra5", "it004-ra6"]) {
      expect(study.filter((q) => q.chapterId === id).length, id).toBeGreaterThanOrEqual(5);
    }
  });

  it("chủ yếu lấy từ đề các năm", () => {
    const original = study.filter((q) => q.source.kind === "original").length;
    expect(original / study.length).toBeGreaterThan(0.75);
    const refs = study.map((q) => q.source.reference ?? "").join("|");
    for (const y of ["2015–2016", "2016–2017", "2017–2018", "2018–2019", "2019–2020", "2020–2021", "2022–2023", "2023–2024", "2024–2025", "2025–2026"]) expect(refs, y).toContain(y);
  });

  it("chỉ có các dạng ra thi: không có trắc nghiệm, câu nào cũng là bài làm tự luận", () => {
    expect(qs.filter((q) => q.type === "mcq")).toHaveLength(0);
    for (const q of qs) expect(q.type, q.id).toBe("essay");
  });

  it("tự luận có đáp án mẫu, rubric tổng 10 điểm và đúng hàng nút ký hiệu", () => {
    for (const q of essays) {
      if (q.type !== "essay") continue;
      expect(q.essay?.modelAnswer, q.id).toBeTruthy();
      expect(q.essay!.rubric.reduce((s, r) => s + r.points, 0), q.id).toBeCloseTo(10);
      expect(q.essay!.keyboard, q.id).toBeTruthy();
    }
    const ra = essays.filter((q) => q.type === "essay" && q.essay?.keyboard === "ra");
    for (const q of ra) if (q.type === "essay") expect(q.essay!.modelAnswer, q.id).toMatch(/[σπ⋈⟕÷ℑ∩−]/u);
  });

  it("câu tổng hợp của đề không hiện trong ôn tập", () => {
    const composite = qs.filter((q) => q.examOnly);
    expect(composite.length).toBeGreaterThanOrEqual(20);
    for (const q of composite) {
      expect(isStudyEligible(q)).toBe(false);
      expect(q.tags).toContain("cau-2");
    }
  });
});

describe("đề thi thử IT004", () => {
  it("cấu trúc như đề thật: toàn tự luận, Câu 1 2,5 điểm, Câu 2 7,5 điểm, 75 phút", () => {
    const bp = exam.blueprint!;
    expect(bp.durationMinutes).toBe(75);
    expect(bp.slots.every((s) => s.type === "essay")).toBe(true);
    expect(bp.slots.reduce((a, s) => a + s.count * s.pointsEach, 0)).toBeCloseTo(10);
  });

  it("đề tạo ra có đúng một Câu 1 và một Câu 2, hai đề thường khác nhau", async () => {
    const ids = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const r = await make();
      const list = r.sealed.questions;
      expect(list).toHaveLength(2);
      expect(list.flatMap((x) => x.question.tags ?? []).sort()).toEqual(["cau-1", "cau-2"]);
      expect(list.map((x) => x.points).sort()).toEqual([2.5, 7.5]);
      ids.add(list.map((x) => x.question.id).join("|"));
    }
    expect(ids.size).toBeGreaterThan(5);
  });
});

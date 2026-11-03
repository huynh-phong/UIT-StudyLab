import { describe, expect, it } from "vitest";
import bankData from "@/generated/bank.json";
import { QuestionSchema, type BuiltBank, type BuiltExam, type McqQuestion, type Question } from "@/lib/bank/schema";
import { assembleExam } from "@/lib/exam/assemble";
import { generateFromTemplate, TEMPLATES } from "@/lib/exam/generators";
import { verifyEssay, verifyMcq } from "@/lib/mips/verify";

const bank = bankData as unknown as BuiltBank;
const course = bank.courses.find((c) => c.id === "it006")!;
const exam = course.exams.find((e) => e.examType === "midterm")! as BuiltExam;
const real = { ...exam, course: { code: course.code, name: course.name } };
const qs = exam.questions as Question[];
const mcqs = qs.filter((q): q is McqQuestion => q.type === "mcq");
const essays = qs.filter((q) => q.type === "essay");

const make = () =>
  assembleExam({ exam: real, mode: "algo", exclude: [], aiAvailable: false, maxNewQuestions: 0, review: false, deadline: Date.now() + 10_000, beforeAICall: async () => {} });

describe("ngân hàng IT006", () => {
  it("mọi câu hợp lệ schema, ID không trùng", () => {
    for (const q of qs) expect(QuestionSchema.safeParse(q).success, q.id).toBe(true);
    expect(new Set(qs.map((q) => q.id)).size).toBe(qs.length);
  });

  it("phủ đủ các phần của Chương 1 và Chương 2", () => {
    expect(exam.chapters.map((c) => c.id)).toEqual(["it006-c1a", "it006-c1b", "it006-c2a", "it006-c2b", "it006-c2c"]);
    for (const c of exam.chapters) {
      expect(mcqs.filter((q) => q.chapterId === c.id).length, c.id).toBeGreaterThanOrEqual(30);
    }
    for (const id of ["it006-c1a", "it006-c1b"]) expect(essays.filter((q) => q.chapterId === id)).toHaveLength(0);
    for (const id of ["it006-c2a", "it006-c2b", "it006-c2c"]) expect(essays.filter((q) => q.chapterId === id).length, id).toBeGreaterThanOrEqual(3);
    expect(essays.length).toBeGreaterThanOrEqual(50);
  });

  it("không có đề hoặc phương án bị trùng", () => {
    const normalized = qs.map((q) => q.content.replace(/\s+/g, " ").trim());
    expect(normalized.length - new Set(normalized).size).toBe(0);
    for (const q of mcqs) {
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options.map((o) => o.content)).size, q.id).toBe(4);
    }
  });

  it("đáp án gắn kiểm chứng đều khớp bộ mô phỏng", () => {
    const withVerify = mcqs.filter((q) => q.verify);
    expect(withVerify.length).toBeGreaterThan(30);
    for (const q of withVerify) expect(verifyMcq(q), q.id).toBeNull();
    for (const q of essays) if (q.type === "essay") expect(verifyEssay(q), q.id).toBeNull();
  });

  it("tự luận có đáp án mẫu và rubric tổng 10 điểm", () => {
    for (const q of essays) {
      if (q.type !== "essay") continue;
      expect(q.essay?.modelAnswer, q.id).toBeTruthy();
      expect(q.essay!.rubric.reduce((s, r) => s + r.points, 0), q.id).toBeCloseTo(10);
    }
  });

  it("có câu từ đủ các đề giữa kỳ 2019–2026", () => {
    const refs = qs.map((q) => q.source.reference ?? "").join("|");
    for (const y of ["HK1 2019–2020", "HK1 2020–2021", "HK2 2020–2021", "HK2 2021–2022", "HK1 2022–2023", "HK1 2023–2024", "HK2 2023–2024", "HK1 2024–2025", "HK2 2024–2025", "HK1 2025–2026"])
      expect(refs, y).toContain(y);
  });

  it("đề thi có đủ câu cho hai dạng tự luận", () => {
    for (const tag of ["lap-trinh", "ma-may"]) expect(essays.filter((q) => q.tags?.includes(tag)).length, tag).toBeGreaterThanOrEqual(8);
  });

  it("có nhiều dạng tự luận: viết code, chạy kiểm chứng, chuyển đổi mã máy", () => {
    const specs = essays.flatMap((q) => (q.type === "essay" && q.essay ? [q.essay] : []));
    expect(specs.filter((s) => s.format === "code").length).toBeGreaterThanOrEqual(20);
    expect(specs.filter((s) => s.format === "text").length).toBeGreaterThanOrEqual(10);
    expect(specs.filter((s) => s.encodings?.length).length).toBeGreaterThanOrEqual(10);
    expect(specs.filter((s) => s.verify?.length).length).toBeGreaterThanOrEqual(25);
  });
});

describe("đề thi thử IT006", () => {
  it("cấu trúc đề: 8 điểm trắc nghiệm, 2 điểm tự luận", () => {
    const slots = exam.blueprint!.slots;
    const points = (t: "mcq" | "essay") => slots.filter((s) => s.type === t).reduce((a, s) => a + s.count * s.pointsEach, 0);
    expect(points("mcq")).toBeCloseTo(8);
    expect(points("essay")).toBeCloseTo(2);
  });

  it("đề tạo ra đúng số câu, không trùng, chỉ thuộc IT006", async () => {
    for (let i = 0; i < 40; i++) {
      const r = await make();
      const list = r.sealed.questions;
      expect(list).toHaveLength(18);
      expect(list.filter((x) => x.question.type === "essay")).toHaveLength(2);
      expect(new Set(list.map((x) => x.question.id)).size).toBe(18);
      const es = list.filter((x) => x.question.type === "essay").map((x) => x.question);
      expect(es.flatMap((q) => q.tags ?? []).sort()).toEqual(["lap-trinh", "ma-may"]);
      for (const q of es) expect(["it006-c1a", "it006-c1b"]).not.toContain(q.chapterId);
      for (const x of list) expect(x.question.courseId).toBe("it006");
      expect(list.reduce((a, x) => a + x.points, 0)).toBeCloseTo(10);
    }
  });

  it("đề có câu sinh bằng thuật toán và hai đề khác nhau", async () => {
    const [a, b] = await Promise.all([make(), make()]);
    expect(a.composition.generated).toBeGreaterThan(0);
    expect(a.sealed.questions.map((x) => x.question.id)).not.toEqual(b.sealed.questions.map((x) => x.question.id));
  });
});

describe("bộ sinh câu IT006: đối chiếu bằng phép tính độc lập", () => {
  const SEEDS = Array.from({ length: 200 }, (_, i) => (i + 1) * 2654435761);
  const byId = (id: string) => TEMPLATES.find((t) => t.id === id)!;
  const correct = (q: McqQuestion) => q.options.find((o) => o.id === q.correctOptionId)!.content.replace(/`/g, "");

  it("bù hai: chuỗi bit trong đề bằng đáp án", () => {
    for (const seed of SEEDS) {
      const q = generateFromTemplate(byId("it006-twos"), seed);
      const bits = q.content.match(/`([01 ]+)`/)![1].replace(/ /g, "");
      const value = parseInt(bits, 2) - 2 ** bits.length;
      expect(Number(correct(q))).toBe(value);
    }
  });

  it("địa chỉ phần tử mảng = nền + chỉ số × 4", () => {
    for (const seed of SEEDS) {
      const q = generateFromTemplate(byId("it006-element-address"), seed);
      const b = parseInt(q.content.match(/0x[0-9a-f]+/i)![0], 16);
      const i = Number(q.content.match(/A\[(\d+)\]/)![1]);
      expect(parseInt(correct(q), 16)).toBe(b + i * 4);
    }
  });

  it("immediate của beq = (đích − (PC + 4)) / 4", () => {
    for (const seed of SEEDS) {
      const q = generateFromTemplate(byId("it006-branch-offset"), seed);
      const [pc, target] = [...q.content.matchAll(/0x[0-9a-f]+/gi)].map((m) => parseInt(m[0], 16));
      expect(Number(correct(q))).toBe((target - (pc + 4)) / 4);
    }
  });

  it("mã R-format ghép đúng các trường", () => {
    const REG: Record<string, number> = {};
    ["$zero", "$at", "$v0", "$v1", "$a0", "$a1", "$a2", "$a3", "$t0", "$t1", "$t2", "$t3", "$t4", "$t5", "$t6", "$t7", "$s0", "$s1", "$s2", "$s3", "$s4", "$s5", "$s6", "$s7", "$t8", "$t9", "$k0", "$k1", "$gp", "$sp", "$fp", "$ra"].forEach((r, i) => (REG[r] = i));
    const FUNCT: Record<string, number> = { add: 0x20, sub: 0x22, and: 0x24, or: 0x25, nor: 0x27, slt: 0x2a };
    for (const seed of SEEDS) {
      const q = generateFromTemplate(byId("it006-encode-r"), seed);
      const [, op, rd, rs, rt] = q.content.match(/`(\w+) (\$\w+), (\$\w+), (\$\w+)`/)!;
      const w = ((REG[rs] << 21) | (REG[rt] << 16) | (REG[rd] << 11) | FUNCT[op]) >>> 0;
      expect(parseInt(correct(q), 16)).toBe(w);
    }
  });
});

import { describe, expect, it } from "vitest";
import bankData from "@/generated/bank.json";
import { QuestionSchema, type BuiltBank, type BuiltExam, type McqQuestion } from "@/lib/bank/schema";
import { generateFromTemplate, TEMPLATES, vn } from "@/lib/exam/generators";
import { assembleExam } from "@/lib/exam/assemble";

const SEEDS = Array.from({ length: 300 }, (_, i) => (i + 1) * 2654435761);
const correctText = (q: McqQuestion) => q.options.find((o) => o.id === q.correctOptionId)!.content;
/** Lấy số đầu tiên trong mỗi đoạn in đậm của đề, ví dụ "**Seq = 2837**" → 2837. */
const nums = (s: string) =>
  [...s.matchAll(/\*\*([^*]+)\*\*/g)].map((m) => Number((m[1].match(/\d+(?:[.,]\d+)?/) ?? ["NaN"])[0].replace(",", ".")));

describe("bộ sinh câu hỏi tính toán", () => {
  for (const t of TEMPLATES) {
    it(`${t.id}: hợp lệ schema, 4 phương án khác nhau, có lời giải cho từng phương án sai`, () => {
      for (const seed of SEEDS.slice(0, 120)) {
        const q = generateFromTemplate(t, seed);
        expect(QuestionSchema.safeParse(q).success).toBe(true);
        expect(q.options).toHaveLength(4);
        expect(new Set(q.options.map((o) => o.content)).size).toBe(4);
        expect(q.source.kind).toBe("generated");
        expect(q.chapterId).toBe(t.chapterId);
        const wrong = q.options.filter((o) => o.id !== q.correctOptionId).map((o) => o.id).sort();
        expect(Object.keys(q.explanation.whyWrong ?? {}).sort()).toEqual(wrong);
        expect(q.content).not.toMatch(/NaN|undefined|Infinity/);
        expect(q.options.map((o) => o.content).join(" ")).not.toMatch(/NaN|undefined|Infinity/);
      }
    });
  }

  it("cùng seed cho cùng câu hỏi (tái lập được)", () => {
    for (const t of TEMPLATES) expect(generateFromTemplate(t, 12345)).toEqual(generateFromTemplate(t, 12345));
  });

  const byId = (id: string) => TEMPLATES.find((t) => t.id === id)!;

  it("checksum: đáp án khớp phép tính độc lập", () => {
    for (const seed of SEEDS) {
      const q = generateFromTemplate(byId("checksum"), seed);
      const words = [...q.content.matchAll(/`([01 ]{19})`/g)].map((m) => parseInt(m[1].replace(/ /g, ""), 2));
      expect(words).toHaveLength(2);
      let sum = words[0] + words[1];
      sum = (sum & 0xffff) + (sum >> 16);
      const expected = (~sum & 0xffff).toString(2).padStart(16, "0");
      expect(correctText(q).replace(/[` ]/g, "")).toBe(expected);
    }
  });

  it("ACK TCP = Seq + số byte", () => {
    for (const seed of SEEDS) {
      const q = generateFromTemplate(byId("tcp-ack"), seed);
      const [seq, len] = nums(q.content);
      expect(Number(correctText(q))).toBe(seq + len);
    }
  });

  it("UDP Length = dữ liệu + 8 byte header", () => {
    for (const seed of SEEDS) {
      const q = generateFromTemplate(byId("udp-length"), seed);
      const n = nums(q.content).find((x) => !Number.isNaN(x))!;
      const ans = Number(correctText(q).replace(" byte", ""));
      expect(ans).toBe(q.content.includes("Phần dữ liệu") ? n - 8 : n + 8);
    }
  });

  it("trễ truyền = L·8/R", () => {
    for (const seed of SEEDS) {
      const q = generateFromTemplate(byId("trans-delay"), seed);
      const [L, R] = nums(q.content);
      expect(correctText(q)).toBe(`${vn(((L * 8) / (R * 1e6)) * 1000)} ms`);
    }
  });

  it("thông lượng đầu cuối = liên kết chậm nhất", () => {
    for (const seed of SEEDS) {
      const q = generateFromTemplate(byId("throughput"), seed);
      const rates = q.content.match(/\*\*(.*?)\*\*/)![1].split(",").map((x) => parseFloat(x));
      expect(correctText(q)).toBe(`${Math.min(...rates)} Mbps`);
    }
  });

  it("cửa sổ Selective Repeat = 2^(k−1)", () => {
    for (const seed of SEEDS.slice(0, 50)) {
      const q = generateFromTemplate(byId("sr-window"), seed);
      const [k] = nums(q.content);
      expect(Number(correctText(q))).toBe(2 ** (k - 1));
    }
  });

  it("HTTP không bền vững = 2 RTT × số đối tượng", () => {
    for (const seed of SEEDS.slice(0, 80)) {
      const q = generateFromTemplate(byId("http-nonpersistent"), seed);
      const [n] = nums(q.content);
      expect(correctText(q)).toBe(`${2 * (n + 1)} RTT`);
    }
  });

  it("timeout: ssthresh = cwnd/2, cwnd = 1; 3 ACK trùng: cwnd = ssthresh + 3", () => {
    for (const seed of SEEDS.slice(0, 80)) {
      const a = generateFromTemplate(byId("cwnd-timeout"), seed);
      const [c] = nums(a.content);
      expect(correctText(a)).toBe(`ssthresh = ${c / 2}, cwnd = 1`);
      const b = generateFromTemplate(byId("cwnd-dupack"), seed);
      const [c2] = nums(b.content);
      expect(correctText(b)).toBe(`ssthresh = ${c2 / 2}, cwnd = ${c2 / 2 + 3}`);
    }
  });

  it("mỗi chương có ít nhất một dạng bài", () => {
    for (const ch of ["ch1-internet", "ch2-application", "ch3-transport"]) expect(TEMPLATES.some((t) => t.chapterId === ch)).toBe(true);
  });
});

describe("tạo đề theo thuật toán với ngân hàng IT005 thật", () => {
  const bank = bankData as unknown as BuiltBank;
  const real = bank.courses
    .flatMap((c) => c.exams.map((e) => ({ ...e, course: { code: c.code, name: c.name } })))
    .find((e) => !e.isDemo && e.courseId === "it005")! as BuiltExam & { course: { code: string; name: string } };

  it("ngân hàng thật có blueprint 30 câu / 65 phút và đủ câu cho mọi chương", () => {
    expect(real.blueprint?.durationMinutes).toBe(65);
    expect(real.blueprint?.slots.reduce((a, s) => a + s.count, 0)).toBe(30);
    expect(real.questions.length).toBeGreaterThan(200);
  });

  it("đề mới: đúng phân bố chương, có bài tính toán sinh mới, không trùng câu", async () => {
    const r = await assembleExam({
      exam: real,
      mode: "algo",
      exclude: [],
      aiAvailable: false,
      maxNewQuestions: 0,
      review: false,
      deadline: Date.now() + 10_000,
      beforeAICall: async () => {},
    });
    const qs = r.sealed.questions.map((x) => x.question);
    expect(qs).toHaveLength(30);
    for (const s of real.blueprint!.slots) expect(qs.filter((q) => q.chapterId === s.chapterId)).toHaveLength(s.count);
    expect(r.composition.generated).toBeGreaterThanOrEqual(3);
    expect(r.composition.generated).toBeLessThanOrEqual(12);
    expect(r.composition.aiGenerated).toBe(0);
    expect(new Set(qs.map((q) => q.id)).size).toBe(30);
    expect(new Set(qs.map((q) => q.content)).size).toBe(30);
  });

  it("hai lần tạo đề cho ra hai đề khác nhau", async () => {
    const make = () =>
      assembleExam({ exam: real, mode: "algo", exclude: [], aiAvailable: false, maxNewQuestions: 0, review: false, deadline: Date.now() + 10_000, beforeAICall: async () => {} });
    const [a, b] = await Promise.all([make(), make()]);
    expect(a.sealed.version).not.toBe(b.sealed.version);
  });
});

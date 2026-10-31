import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { z } from "zod";
import bankData from "@/generated/bank.json";
import { QuestionSchema, isExamEligible, type BuiltBank, type BuiltExam, type Question } from "@/lib/bank/schema";
import { verifyCalcOptions } from "@/lib/net/ipv4";
import { assembleExam, NotEnoughQuestionsError, toPublicExam } from "@/lib/exam/assemble";
import { openExam, sealExam } from "@/lib/exam/token";
import { setAIProviderForTesting, type AIProvider, type JsonRequest } from "@/lib/ai/provider";
import { resetEnvCache } from "@/lib/server/env";
import { POST as submitRoute } from "@/app/api/exam/submit/route";
import { POST as gradeEssayRoute } from "@/app/api/essay/grade/route";
import { SECRET } from "./helpers";

const bank = bankData as unknown as BuiltBank;
const demo = bank.courses.flatMap((c) => c.exams.map((e) => ({ ...e, course: { code: c.code, name: c.name } }))).find((e) => e.isDemo)! as BuiltExam & {
  course: { code: string; name: string };
};

beforeEach(() => {
  process.env.EXAM_TOKEN_SECRET = SECRET;
  // Các test dưới dùng bộ câu minh họa (có câu tự luận); ngân hàng thật đã có dữ liệu nên phải bật demo rõ ràng
  process.env.ENABLE_DEMO_CONTENT = "true";
  delete process.env.OPENAI_API_KEY;
  resetEnvCache();
});
afterEach(() => setAIProviderForTesting(null));

describe("ngân hàng câu hỏi đã build", () => {
  it("mọi câu hợp lệ theo schema và phép tính khai báo được kiểm chứng", () => {
    const all = bank.courses.flatMap((c) => c.exams.flatMap((e) => e.questions));
    expect(all.length).toBeGreaterThan(0);
    for (const q of all) {
      expect(QuestionSchema.safeParse(q).success).toBe(true);
      if (q.type === "mcq" && q.calc) expect(verifyCalcOptions(q.calc, q.options, q.correctOptionId).ok).toBe(true);
    }
  });

  it("câu tự luận thiếu rubric không đủ điều kiện vào đề thi", () => {
    const noRubric = demo.questions.find((q) => q.type === "essay" && !q.essay)!;
    expect(isExamEligible(noRubric)).toBe(false);
  });
});

const noAI = { aiAvailable: false, maxNewQuestions: 0, review: false, deadline: Date.now() + 30_000, beforeAICall: async () => {} };

describe("tạo đề thi", () => {
  it("chế độ ngân hàng: đúng cấu trúc blueprint, trắc nghiệm trước, không lộ đáp án ra client", async () => {
    const r = await assembleExam({ ...noAI, exam: demo, mode: "bank", exclude: [] });
    const bp = demo.blueprint!;
    expect(r.sealed.questions).toHaveLength(bp.slots.reduce((a, s) => a + s.count, 0));
    for (const s of bp.slots) {
      expect(r.sealed.questions.filter((x) => x.question.chapterId === s.chapterId && x.question.type === s.type)).toHaveLength(s.count);
    }
    const types = r.sealed.questions.map((x) => x.question.type);
    expect(types.indexOf("essay")).toBeGreaterThan(types.lastIndexOf("mcq"));
    expect(new Set(r.sealed.questions.map((x) => x.question.id)).size).toBe(r.sealed.questions.length);
    expect(r.sealed.questions.every((x) => isExamEligible(x.question))).toBe(true);

    const pub = toPublicExam(r, sealExam(r.sealed, SECRET), demo);
    const json = JSON.stringify(pub.questions);
    for (const k of ["correctOptionId", "explanation", "modelAnswer", "rubric", "whyWrong"]) expect(json).not.toContain(k);
    expect(pub.deadline).toBe(pub.createdAt + bp.durationMinutes! * 60_000);
  });

  it("chế độ AI không khả dụng: dùng câu gốc và có cảnh báo rõ ràng", async () => {
    const r = await assembleExam({ ...noAI, exam: demo, mode: "ai", exclude: [] });
    expect(r.composition.aiGenerated).toBe(0);
    expect(r.warnings.join(" ")).toMatch(/AI chưa được cấu hình/);
  });

  it("báo lỗi khi ngân hàng không đủ câu", async () => {
    const thin = { ...demo, questions: demo.questions.slice(0, 2) };
    await expect(assembleExam({ ...noAI, exam: thin, mode: "bank", exclude: [] })).rejects.toBeInstanceOf(NotEnoughQuestionsError);
  });

  it("chế độ AI: chỉ nhận câu qua kiểm định và phản biện, loại câu sai phép tính", async () => {
    let call = 0;
    const fake: AIProvider = {
      name: "fake",
      async generateJson<S extends z.ZodType>(req: JsonRequest<S>) {
        call++;
        if (req.purpose === "generator") {
          const isEssay = req.user.toString().includes("câu tự luận mới");
          if (isEssay) return { questions: [] } as z.infer<S>;
          const mk = (ip: string, prefix: number, network: string, correct: "A" | "B") => ({
            content: `Máy trạm có địa chỉ \`${ip}/${prefix}\`. Địa chỉ mạng của mạng con chứa máy trạm này là gì? (${call})`,
            options: [
              { id: "A", content: network },
              { id: "B", content: "0.0.0.1" },
              { id: "C", content: "0.0.0.2" },
              { id: "D", content: "0.0.0.3" },
            ],
            correctOptionId: correct,
            explanation: { correct: "Giải thích ngắn gọn đúng.", whyCorrect: "Giải thích chi tiết đủ dài.", whyWrong: { A: "sai vì…", B: "sai vì…", C: "sai vì…", D: "sai vì…" } },
            difficulty: "medium",
            basedOn: [],
            knowledgePoint: "Địa chỉ mạng",
            calc: { kind: "ipv4", ip, prefix, ask: "network" },
          });
          return {
            questions: [
              mk("10.9.8.77", 26, "10.9.8.64", "A"),
              mk("172.20.1.130", 25, "172.20.1.128", "A"),
              mk("192.168.50.99", 27, "192.168.50.96", "A"),
              mk("10.1.1.200", 28, "10.1.1.192", "B"), // đáp án khai báo sai → bị loại
            ],
          } as z.infer<S>;
        }
        // reviewer đồng ý với mọi câu
        return { reviews: [0, 1, 2, 3].map((index) => ({ index, answer: "A", ambiguous: false, inScope: true, factualIssues: [] })) } as z.infer<S>;
      },
    };
    setAIProviderForTesting(fake);
    const ipv4Only = {
      ...demo,
      key: `test:${Date.now()}`,
      blueprint: { ...demo.blueprint!, slots: [{ chapterId: "demo-ipv4", type: "mcq" as const, count: 3, pointsEach: 1 }] },
    };
    const r = await assembleExam({ ...noAI, aiAvailable: true, maxNewQuestions: 10, review: true, exam: ipv4Only, mode: "ai", exclude: [] });
    expect(r.composition.aiGenerated).toBe(3);
    expect(r.sealed.questions.every((x) => x.question.source.kind === "ai_generated")).toBe(true);
    expect(r.sealed.questions.map((x) => x.question.content).join(" ")).not.toContain("10.1.1.200");
    expect(r.sealed.questions.every((x) => ["ai_checked", "needs_review"].includes(x.question.verification))).toBe(true);

    // Lần sau dùng lại pool → không cần gọi AI
    const before = call;
    const again = await assembleExam({ ...noAI, aiAvailable: true, maxNewQuestions: 10, review: true, exam: ipv4Only, mode: "ai", exclude: [] });
    expect(call).toBe(before);
    expect(again.composition.aiGenerated).toBe(3);
  });
});

function jsonRequest(url: string, body: unknown) {
  return new Request(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

describe("quy trình nộp bài (route /api/exam/submit)", () => {
  it("chấm trắc nghiệm theo đáp án niêm phong; tự luận báo chưa khả dụng khi chưa cấu hình AI", async () => {
    const r = await assembleExam({ ...noAI, exam: demo, mode: "bank", exclude: [] });
    const token = sealExam(r.sealed, SECRET);
    const responses: Record<string, { optionId?: string; text?: string }> = {};
    let expectedCorrect = 0;
    r.sealed.questions.forEach(({ question }, i) => {
      if (question.type === "mcq") {
        const pick = i % 2 === 0 ? question.correctOptionId : question.options.find((o) => o.id !== question.correctOptionId)!.id;
        if (pick === question.correctOptionId) expectedCorrect++;
        responses[question.id] = { optionId: pick };
      } else responses[question.id] = { text: "TCP hướng kết nối và tin cậy, UDP thì không." };
    });

    const res = await submitRoute(jsonRequest("http://localhost/api/exam/submit", { token, responses, startedAt: r.sealed.createdAt, submittedAt: Date.now() }));
    expect(res.status).toBe(200);
    const { result } = await res.json();
    expect(result.counts.correct).toBe(expectedCorrect);
    expect(result.gradingStatus).toBe("partial");
    expect(result.totalScore).toBeNull();
    const essayQ = result.questions.find((g: { question: Question }) => g.question.type === "essay");
    expect(essayQ.essay.status).toBe("unavailable");
    expect(essayQ.response.text).toContain("TCP");
  });

  it("từ chối token giả mạo", async () => {
    const res = await submitRoute(jsonRequest("http://localhost/api/exam/submit", { token: "v1.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", responses: {}, startedAt: 1, submittedAt: 2 }));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("INVALID_TOKEN");
  });

  it("từ chối body không hợp lệ", async () => {
    const res = await submitRoute(jsonRequest("http://localhost/api/exam/submit", { token: 1 }));
    expect(res.status).toBe(400);
  });

  it("chặn request từ origin khác", async () => {
    const req = new Request("http://localhost/api/exam/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", origin: "https://evil.example", host: "localhost" },
      body: "{}",
    });
    expect((await submitRoute(req)).status).toBe(403);
  });
});

describe("route chấm tự luận ôn tập", () => {
  it("báo lỗi cấu hình rõ ràng khi thiếu OPENAI_API_KEY, không lộ secret", async () => {
    const q = demo.questions.find((x) => x.type === "essay" && x.essay)!;
    const res = await gradeEssayRoute(jsonRequest("http://localhost/api/essay/grade", { questionId: q.id, answer: "Một câu trả lời đủ dài để chấm." }));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error.code).toBe("AI_NOT_CONFIGURED");
    expect(body.error.message).toMatch(/OPENAI_API_KEY/);
    expect(JSON.stringify(body)).not.toContain(SECRET);
  });

  it("không chấm giả khi câu thiếu đáp án mẫu/rubric", async () => {
    const q = demo.questions.find((x) => x.type === "essay" && !x.essay)!;
    const res = await gradeEssayRoute(jsonRequest("http://localhost/api/essay/grade", { questionId: q.id, answer: "Một câu trả lời đủ dài." }));
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe("INSUFFICIENT_REFERENCE");
  });

  it("dùng provider AI giả: chấm và chuẩn hóa điểm theo rubric", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.OPENAI_MODEL = "test-model";
    resetEnvCache();
    setAIProviderForTesting({
      name: "fake",
      async generateJson<S extends z.ZodType>() {
        return {
          rubric: [{ id: "r1", awarded: 99, comment: "tốt" }],
          correctPoints: ["a"],
          missingPoints: [],
          incorrectPoints: [],
          feedback: "Ổn.",
          suggestions: [],
          offTopic: false,
        } as z.infer<S>;
      },
    });
    const q = demo.questions.find((x) => x.type === "essay" && x.essay)!;
    const res = await gradeEssayRoute(jsonRequest("http://localhost/api/essay/grade", { questionId: q.id, answer: `Bài làm thử nghiệm ${Date.now()}` }));
    expect(res.status).toBe(200);
    const { result } = await res.json();
    const r1 = q.type === "essay" ? q.essay!.rubric[0].points : 0;
    expect(result.rubric[0].awarded).toBe(r1);
    expect(result.score).toBeLessThanOrEqual(result.maxScore);
    delete process.env.OPENAI_MODEL;
  });
});

describe("mở token sau khi tạo đề", () => {
  it("đề mở lại khớp phiên bản và số câu", async () => {
    const r = await assembleExam({ ...noAI, exam: demo, mode: "bank", exclude: [] });
    const opened = openExam(sealExam(r.sealed, SECRET), SECRET);
    expect(opened.version).toBe(r.sealed.version);
    expect(opened.questions.length).toBe(r.sealed.questions.length);
  });
});

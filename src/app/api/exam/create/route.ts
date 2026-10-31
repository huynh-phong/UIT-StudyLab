import { NextResponse } from "next/server";
import { z } from "zod";
import { findExamByKey } from "@/lib/bank/repo";
import { assembleExam, NotEnoughQuestionsError, toPublicExam } from "@/lib/exam/assemble";
import { sealExam } from "@/lib/exam/token";
import { getEnv, getExamSecret, getFeatureFlags } from "@/lib/server/env";
import { ApiError, clientIp, consumeGlobalAIBudget, handle, rateLimit, readJson } from "@/lib/server/http";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  examKey: z.string().min(1).max(100),
  mode: z.enum(["algo", "bank", "ai"]).default("algo"),
  exclude: z.array(z.string().max(200)).max(500).default([]),
});

export const POST = handle(async (req: Request) => {
  const body = await readJson(req, Body, 64 * 1024);
  getExamSecret(); // bắt buộc để niêm phong đáp án
  const exam = findExamByKey(body.examKey);
  if (!exam) throw new ApiError(404, "NOT_FOUND", "Không tìm thấy kỳ thi.");
  if (!exam.blueprint) throw new ApiError(422, "NOT_ENOUGH_QUESTIONS", "Kỳ thi này chưa có cấu trúc đề chuẩn.");

  const env = getEnv();
  const flags = getFeatureFlags();
  const ip = clientIp(req);
  await rateLimit("exam-create", ip, env.RATE_LIMIT_EXAM_PER_HOUR * 4, 3600);
  if (body.mode === "ai" && !flags.aiExamGeneration) {
    throw new ApiError(422, "BAD_REQUEST", "Tạo đề bằng AI đang tắt (AI chỉ dùng để chấm tự luận). Hãy chọn \"Đề mới theo thuật toán\".");
  }

  let generationLimited = false;
  try {
    const result = await assembleExam({
      exam,
      mode: body.mode,
      exclude: body.exclude,
      aiAvailable: flags.aiExamGeneration,
      maxNewQuestions: env.EXAM_GEN_MAX_NEW_QUESTIONS,
      review: env.AI_REVIEW_ENABLED,
      deadline: Date.now() + 50_000,
      beforeAICall: async (calls) => {
        if (!generationLimited) {
          // Giới hạn lượt tạo đề có gọi AI theo giờ (chỉ tính một lần mỗi đề)
          generationLimited = true;
          await rateLimit("exam-gen", ip, env.RATE_LIMIT_EXAM_PER_HOUR, 3600);
        }
        await consumeGlobalAIBudget(calls);
      },
    });
    const token = sealExam(result.sealed);
    return NextResponse.json({ ok: true, exam: toPublicExam(result, token, exam) });
  } catch (e) {
    if (e instanceof NotEnoughQuestionsError) throw new ApiError(422, "NOT_ENOUGH_QUESTIONS", e.message);
    throw e;
  }
});

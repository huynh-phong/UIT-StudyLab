import { NextResponse } from "next/server";
import { z } from "zod";
import { findQuestion } from "@/lib/bank/repo";
import { gradeEssay } from "@/lib/ai/essay-grader";
import { getAIConfig, getEnv } from "@/lib/server/env";
import { ApiError, clientIp, consumeGlobalAIBudget, handle, rateLimit, readJson } from "@/lib/server/http";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  questionId: z.string().min(1).max(200),
  answer: z.string().max(8000, "Câu trả lời tối đa 8000 ký tự"),
});

/**
 * Chấm câu tự luận trong chế độ Ôn tập.
 * Đáp án mẫu + rubric được lấy từ ngân hàng phía server, KHÔNG nhận từ client.
 */
export const POST = handle(async (req: Request) => {
  const body = await readJson(req, Body, 64 * 1024);
  const found = findQuestion(body.questionId);
  if (!found || found.question.type !== "essay") throw new ApiError(404, "NOT_FOUND", "Không tìm thấy câu tự luận.");
  const q = found.question;
  if (!q.essay) {
    throw new ApiError(422, "INSUFFICIENT_REFERENCE", "Câu hỏi này chưa có đáp án mẫu hoặc rubric đã xác minh nên hệ thống không chấm điểm. Cần bổ sung dữ liệu.");
  }
  getAIConfig(); // ném ConfigError rõ ràng nếu chưa cấu hình khóa/model AI

  const env = getEnv();
  const ip = clientIp(req);
  const result = await gradeEssay(
    { questionId: q.id, questionContent: q.content, spec: q.essay, answer: body.answer, maxScore: q.points, deadline: Date.now() + 55_000 },
    {
      // Chỉ trừ lượt khi thực sự gọi AI (kết quả cache/bài trống không tính)
      beforeAICall: async () => {
        await rateLimit("essay-min", ip, env.RATE_LIMIT_ESSAY_PER_MINUTE, 60);
        await rateLimit("essay-day", ip, env.RATE_LIMIT_ESSAY_PER_DAY, 86_400);
        await consumeGlobalAIBudget();
      },
    },
  );
  return NextResponse.json({ ok: true, result });
});

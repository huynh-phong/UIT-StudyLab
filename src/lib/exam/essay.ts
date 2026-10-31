import "server-only";
import type { Question } from "@/lib/bank/schema";
import { gradeEssay } from "@/lib/ai/essay-grader";
import { AIError } from "@/lib/ai/provider";
import type { EssayGradeState } from "@/lib/grading/types";
import { getEnv, getFeatureFlags } from "@/lib/server/env";
import { ApiError, consumeGlobalAIBudget, rateLimit } from "@/lib/server/http";

/** Chấm một câu tự luận trong bài thi; mọi lỗi được chuyển thành trạng thái thay vì ném ra. */
export async function gradeExamEssay(question: Question, points: number, text: string, ip: string, deadline: number): Promise<EssayGradeState> {
  if (question.type !== "essay") return { status: "failed", message: "Không phải câu tự luận" };
  if (!question.essay) return { status: "insufficient_reference", message: "Câu hỏi chưa có đáp án mẫu/rubric đã xác minh." };
  if (!getFeatureFlags().ai) return { status: "unavailable", message: "Chấm tự luận bằng AI chưa được cấu hình (thiếu khóa/model AI)." };
  const env = getEnv();
  try {
    return await gradeEssay(
      { questionId: question.id, questionContent: question.content, spec: question.essay, answer: text, maxScore: points, deadline },
      {
        beforeAICall: async () => {
          await rateLimit("essay-min", ip, env.RATE_LIMIT_ESSAY_PER_MINUTE, 60);
          await rateLimit("essay-day", ip, env.RATE_LIMIT_ESSAY_PER_DAY, 86_400);
          await consumeGlobalAIBudget();
        },
      },
    );
  } catch (e) {
    if (e instanceof ApiError) return { status: "failed", message: e.message };
    if (e instanceof AIError) return { status: "failed", message: e.userMessage() };
    console.error("[exam-essay]", e);
    return { status: "failed", message: "Chưa chấm được câu tự luận. Bạn có thể chấm lại sau." };
  }
}

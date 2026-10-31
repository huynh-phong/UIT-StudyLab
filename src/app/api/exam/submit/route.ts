import { NextResponse } from "next/server";
import { z } from "zod";
import { openExam, TokenError } from "@/lib/exam/token";
import { scoreExam } from "@/lib/exam/scoring";
import { gradeExamEssay } from "@/lib/exam/essay";
import type { EssayGradeState } from "@/lib/grading/types";
import { ApiError, clientIp, handle, readJson } from "@/lib/server/http";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  token: z.string().min(10).max(400_000),
  responses: z.record(
    z.string().max(200),
    z.object({ optionId: z.string().max(4).nullish(), text: z.string().max(8000).nullish() }),
  ),
  startedAt: z.number().int().positive(),
  submittedAt: z.number().int().positive(),
  autoSubmitted: z.boolean().default(false),
});

/**
 * Nộp bài: mở token niêm phong, chấm trắc nghiệm bằng đáp án đã lưu, chấm tự luận bằng AI.
 * Lỗi AI ở từng câu tự luận KHÔNG làm hỏng bài nộp: câu đó được đánh dấu "failed" để chấm lại sau.
 */
export const POST = handle(async (req: Request) => {
  const body = await readJson(req, Body, 900 * 1024);
  let sealed;
  try {
    sealed = openExam(body.token);
  } catch (e) {
    if (e instanceof TokenError) throw new ApiError(400, "INVALID_TOKEN", e.message);
    throw e;
  }

  const ip = clientIp(req);
  const deadline = Date.now() + 50_000;
  const essays: Record<string, EssayGradeState> = {};
  await Promise.all(
    sealed.questions
      .filter(({ question }) => question.type === "essay")
      .map(async ({ question, points }) => {
        const text = body.responses[question.id]?.text?.trim() ?? "";
        if (!text) return;
        essays[question.id] = await gradeExamEssay(question, points, text, ip, deadline);
      }),
  );

  const now = Date.now();
  const result = scoreExam(sealed, body.responses, essays, {
    startedAt: body.startedAt,
    submittedAt: Math.min(body.submittedAt, now),
    autoSubmitted: body.autoSubmitted,
  });
  return NextResponse.json({ ok: true, result });
});

import { NextResponse } from "next/server";
import { z } from "zod";
import { openExam, TokenError } from "@/lib/exam/token";
import { gradeExamEssay } from "@/lib/exam/essay";
import { ApiError, clientIp, handle, readJson } from "@/lib/server/http";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  token: z.string().min(10).max(400_000),
  questionId: z.string().min(1).max(200),
  text: z.string().min(1).max(8000),
});

/** Chấm lại một câu tự luận của bài thi đã nộp (khi lần chấm trước lỗi hoặc AI chưa cấu hình). */
export const POST = handle(async (req: Request) => {
  const body = await readJson(req, Body, 600 * 1024);
  let sealed;
  try {
    sealed = openExam(body.token);
  } catch (e) {
    if (e instanceof TokenError) throw new ApiError(400, "INVALID_TOKEN", e.message);
    throw e;
  }
  const item = sealed.questions.find((x) => x.question.id === body.questionId);
  if (!item || item.question.type !== "essay") throw new ApiError(404, "NOT_FOUND", "Không tìm thấy câu tự luận trong bài thi.");
  const state = await gradeExamEssay(item.question, item.points, body.text, clientIp(req), Date.now() + 55_000);
  return NextResponse.json({ ok: true, state });
});

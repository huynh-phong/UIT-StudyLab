import { NextResponse } from "next/server";
import { z } from "zod";
import { openExam, TokenError } from "@/lib/exam/token";
import { updatePoolItem } from "@/lib/exam/pool";
import { getKV, KEY_PREFIX } from "@/lib/server/kv";
import { ApiError, clientIp, handle, rateLimit, readJson } from "@/lib/server/http";
import type { QuestionReport } from "@/lib/exam/types";

export const runtime = "nodejs";

const Body = z.object({
  questionId: z.string().min(1).max(200),
  /** Token bài thi — bắt buộc khi báo lỗi câu do AI tạo. */
  token: z.string().max(400_000).optional(),
  reason: z.enum(["wrong_answer", "ambiguous", "out_of_scope", "typo", "other"]),
  note: z.string().max(1000).optional(),
});

/** Sinh viên báo câu hỏi có vấn đề → đưa vào danh sách cần người quản trị xác minh. */
export const POST = handle(async (req: Request) => {
  const body = await readJson(req, Body, 450 * 1024);
  await rateLimit("report", clientIp(req), 20, 3600);
  const report: QuestionReport = { questionId: body.questionId, reason: body.reason, note: body.note, at: new Date().toISOString() };

  if (body.token) {
    let sealed;
    try {
      sealed = openExam(body.token);
    } catch (e) {
      if (e instanceof TokenError) throw new ApiError(400, "INVALID_TOKEN", e.message);
      throw e;
    }
    const item = sealed.questions.find((x) => x.question.id === body.questionId);
    if (!item) throw new ApiError(404, "NOT_FOUND", "Câu hỏi không thuộc bài thi.");
    report.examKey = sealed.examKey;
    report.chapterId = item.question.chapterId;
    if (item.question.source.kind === "ai_generated") {
      await updatePoolItem(sealed.examKey, item.question.chapterId, item.question.type, item.question.id, "report");
    }
  }

  const kv = getKV();
  const key = `${KEY_PREFIX}reports`;
  const list = (await kv.get<QuestionReport[]>(key)) ?? [];
  await kv.set(key, [...list, report].slice(-1000));
  return NextResponse.json({ ok: true });
});

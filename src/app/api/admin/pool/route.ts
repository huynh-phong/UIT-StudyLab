import { NextResponse } from "next/server";
import { z } from "zod";
import { findExamByKey } from "@/lib/bank/repo";
import { isExamEligible } from "@/lib/bank/schema";
import { generateQuestions } from "@/lib/ai/exam-generator";
import { addToPool, readPool, updatePoolItem } from "@/lib/exam/pool";
import { getEnv } from "@/lib/server/env";
import { getKV, KEY_PREFIX } from "@/lib/server/kv";
import { ApiError, assertAdmin, consumeGlobalAIBudget, handle, readJson } from "@/lib/server/http";
import type { QuestionReport } from "@/lib/exam/types";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * API quản trị (yêu cầu header `x-admin-secret: <ADMIN_SECRET>`):
 *  GET  ?examKey=...            — xem pool câu AI và danh sách báo lỗi
 *  POST {action:"approve"|"reject", examKey, chapterId, type, id}  — duyệt/loại câu AI
 *  POST {action:"warm", examKey, perSlot}                          — tạo trước câu AI cho mọi ô trong blueprint
 */
export const GET = handle(async (req: Request) => {
  assertAdmin(req);
  const examKey = new URL(req.url).searchParams.get("examKey");
  const exam = examKey ? findExamByKey(examKey) : null;
  if (!exam) throw new ApiError(404, "NOT_FOUND", "Cần tham số examKey hợp lệ.");
  const buckets = await Promise.all(
    exam.chapters.flatMap((c) =>
      (["mcq", "essay"] as const).map(async (type) => ({ chapterId: c.id, type, items: await readPool(exam.key, c.id, type) })),
    ),
  );
  const reports = (await getKV().get<QuestionReport[]>(`${KEY_PREFIX}reports`)) ?? [];
  return NextResponse.json({ ok: true, persistent: getKV().persistent, buckets: buckets.filter((b) => b.items.length), reports });
});

const Body = z.discriminatedUnion("action", [
  z.object({
    action: z.enum(["approve", "reject"]),
    examKey: z.string(),
    chapterId: z.string(),
    type: z.enum(["mcq", "essay"]),
    id: z.string(),
  }),
  z.object({ action: z.literal("warm"), examKey: z.string(), perSlot: z.number().int().min(1).max(8).default(4) }),
]);

export const POST = handle(async (req: Request) => {
  assertAdmin(req);
  const body = await readJson(req, Body);
  const exam = findExamByKey(body.examKey);
  if (!exam) throw new ApiError(404, "NOT_FOUND", "Không tìm thấy kỳ thi.");

  if (body.action !== "warm") {
    const ok = await updatePoolItem(exam.key, body.chapterId, body.type, body.id, body.action);
    if (!ok) throw new ApiError(404, "NOT_FOUND", "Không tìm thấy câu trong pool.");
    return NextResponse.json({ ok: true });
  }

  if (!exam.blueprint) throw new ApiError(422, "NOT_ENOUGH_QUESTIONS", "Kỳ thi chưa có blueprint.");
  const env = getEnv();
  const deadline = Date.now() + 55_000;
  const seen = new Set<string>();
  const report = await Promise.all(
    exam.blueprint.slots
      .filter((s) => {
        const k = `${s.chapterId}:${s.type}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .map(async (slot) => {
        const chapter = exam.chapters.find((c) => c.id === slot.chapterId)!;
        const sources = exam.questions.filter((q) => q.chapterId === slot.chapterId && q.type === slot.type && isExamEligible(q));
        if (!sources.length) return { chapterId: slot.chapterId, type: slot.type, accepted: 0, rejected: 0, error: "Chưa có câu gốc đã xác minh" };
        try {
          await consumeGlobalAIBudget(env.AI_REVIEW_ENABLED ? 2 : 1);
          const existing = (await readPool(exam.key, slot.chapterId, slot.type)).map((p) => p.question);
          const gen = await generateQuestions({
            courseName: `${exam.course.code} — ${exam.course.name}`,
            courseId: exam.courseId,
            examType: exam.examType,
            chapter,
            type: slot.type,
            count: body.perSlot,
            difficulty: slot.difficulty,
            sources,
            existing,
            review: env.AI_REVIEW_ENABLED,
            deadline,
          });
          await addToPool(exam.key, slot.chapterId, slot.type, gen.accepted);
          return { chapterId: slot.chapterId, type: slot.type, accepted: gen.accepted.length, rejected: gen.rejected.length, rejectedReasons: gen.rejected };
        } catch (e) {
          return { chapterId: slot.chapterId, type: slot.type, accepted: 0, rejected: 0, error: e instanceof Error ? e.message : String(e) };
        }
      }),
  );
  return NextResponse.json({ ok: true, report });
});

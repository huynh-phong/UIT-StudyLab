import "server-only";
import type { Question } from "@/lib/bank/schema";
import { getKV, KEY_PREFIX, type KV } from "@/lib/server/kv";

/**
 * Pool câu hỏi AI đã qua kiểm tra — tạo trước và tái sử dụng giữa các lượt thi để giảm thời gian chờ và chi phí API.
 * Lưu trong KV (Upstash Redis nếu cấu hình). Mỗi "bucket" = (kỳ thi, chương, loại câu).
 */

export interface PoolItem {
  question: Question;
  createdAt: string;
  /** Số lần đã được đưa vào đề. */
  served: number;
  reports: number;
}

const MAX_PER_BUCKET = 300;
const bucketKey = (examKey: string, chapterId: string, type: string) => `${KEY_PREFIX}pool:${examKey}:${chapterId}:${type}`;

export async function readPool(examKey: string, chapterId: string, type: "mcq" | "essay", kv: KV = getKV()) {
  return (await kv.get<PoolItem[]>(bucketKey(examKey, chapterId, type))) ?? [];
}

export async function addToPool(examKey: string, chapterId: string, type: "mcq" | "essay", questions: Question[], kv: KV = getKV()) {
  if (!questions.length) return;
  const items = await readPool(examKey, chapterId, type, kv);
  const now = new Date().toISOString();
  const next = [...items, ...questions.map((q) => ({ question: q, createdAt: now, served: 0, reports: 0 }))].slice(-MAX_PER_BUCKET);
  await kv.set(bucketKey(examKey, chapterId, type), next);
}

export async function markServed(examKey: string, chapterId: string, type: "mcq" | "essay", ids: string[], kv: KV = getKV()) {
  if (!ids.length) return;
  const items = await readPool(examKey, chapterId, type, kv);
  const set = new Set(ids);
  await kv.set(
    bucketKey(examKey, chapterId, type),
    items.map((i) => (set.has(i.question.id) ? { ...i, served: i.served + 1 } : i)),
  );
}

export async function updatePoolItem(
  examKey: string,
  chapterId: string,
  type: "mcq" | "essay",
  id: string,
  action: "approve" | "reject" | "report",
  kv: KV = getKV(),
) {
  const items = await readPool(examKey, chapterId, type, kv);
  let found = false;
  const next = items
    .map((i) => {
      if (i.question.id !== id) return i;
      found = true;
      if (action === "approve") return { ...i, question: { ...i.question, verification: "verified" as const } };
      if (action === "report") {
        const reports = i.reports + 1;
        return { ...i, reports, question: { ...i.question, verification: "needs_review" as const } };
      }
      return null;
    })
    .filter((i): i is PoolItem => i !== null);
  if (found) await kv.set(bucketKey(examKey, chapterId, type), next);
  return found;
}

/** Câu trong pool có thể đưa vào đề: chưa bị báo lỗi quá 1 lần. */
export function isServable(i: PoolItem) {
  return i.reports < 2 && i.question.verification !== "draft";
}

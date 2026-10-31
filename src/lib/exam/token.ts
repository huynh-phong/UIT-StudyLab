import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { deflateRawSync, inflateRawSync } from "node:zlib";
import { z } from "zod";
import { QuestionSchema } from "@/lib/bank/schema";
import { getExamSecret } from "@/lib/server/env";

/**
 * "Niêm phong" đề thi: toàn bộ đáp án/lời giải được mã hóa AES-256-GCM vào một token gửi cho client.
 * Client không đọc được đáp án trước khi nộp; server mở token khi chấm. Không cần database phía server
 * → tương thích Vercel Functions (stateless).
 */

export const SealedExamSchema = z.object({
  v: z.literal(1),
  attemptId: z.string(),
  examKey: z.string(),
  title: z.string(),
  version: z.string(),
  createdAt: z.number(),
  durationMinutes: z.number().nullable(),
  questions: z.array(
    z.object({
      question: QuestionSchema,
      points: z.number(),
      chapterTitle: z.string(),
    }),
  ),
});
export type SealedExam = z.infer<typeof SealedExamSchema>;

/** Token hết hạn sau 14 ngày (đủ để chấm lại tự luận khi AI lỗi). */
export const TOKEN_TTL_MS = 14 * 24 * 3600 * 1000;

function key(secret: string) {
  return createHash("sha256").update(`studylab-exam:${secret}`).digest();
}

export function sealExam(exam: SealedExam, secret = getExamSecret()): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  const plain = deflateRawSync(Buffer.from(JSON.stringify(exam), "utf8"));
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${Buffer.concat([iv, tag, enc]).toString("base64url")}`;
}

export class TokenError extends Error {}

export function openExam(token: string, secret = getExamSecret(), now = Date.now()): SealedExam {
  if (!token.startsWith("v1.")) throw new TokenError("Định dạng token không hợp lệ");
  let raw: Buffer;
  try {
    raw = Buffer.from(token.slice(3), "base64url");
  } catch {
    throw new TokenError("Token hỏng");
  }
  if (raw.length < 29) throw new TokenError("Token hỏng");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const enc = raw.subarray(28);
  let json: unknown;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(secret), iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(enc), decipher.final()]);
    json = JSON.parse(inflateRawSync(plain).toString("utf8"));
  } catch {
    throw new TokenError("Token không hợp lệ hoặc đã bị chỉnh sửa");
  }
  const parsed = SealedExamSchema.safeParse(json);
  if (!parsed.success) throw new TokenError("Nội dung token không hợp lệ");
  if (now - parsed.data.createdAt > TOKEN_TTL_MS) throw new TokenError("Phiên thi đã hết hạn");
  return parsed.data;
}

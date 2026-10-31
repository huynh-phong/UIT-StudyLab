/** Chạy một lần khi server khởi động: kiểm tra biến môi trường và báo rõ tính năng nào chưa sẵn sàng. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { getAIConfig, getEnv, getFeatureFlags } = await import("@/lib/server/env");
  try {
    getEnv();
  } catch (e) {
    console.error(`[studylab] ${(e as Error).message}`);
    return;
  }
  const f = getFeatureFlags();
  const notes: string[] = [];
  if (!f.ai) notes.push("AI (chấm tự luận, tạo đề) TẮT — thiếu GEMINI_API_KEY + GEMINI_MODEL (hoặc OPENAI_API_KEY + OPENAI_MODEL)");
  if (!f.examMode) notes.push("Thi thử TẮT — thiếu EXAM_TOKEN_SECRET (≥ 32 ký tự)");
  if (!f.persistentStore) notes.push("Không có Upstash Redis — rate limit/cache/pool chỉ lưu trong bộ nhớ tiến trình");
  for (const n of notes) console.warn(`[studylab] ${n}`);
  if (f.ai) {
    const ai = getAIConfig();
    console.info(`[studylab] AI: ${ai.provider} · chấm: ${ai.graderModel} · tạo đề: ${ai.generatorModel}`);
  }
}

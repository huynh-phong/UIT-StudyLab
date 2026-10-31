/**
 * Nhập & chuẩn hóa bộ đề thành bản nháp JSON để người quản trị duyệt trước khi đưa vào ngân hàng.
 *
 *   npm run bank:import -- --file <đường dẫn> --course it005 --exam midterm [--chapter <id>] [--set <tên bộ đề>]
 *
 * Định dạng hỗ trợ:
 *   .json            — mảng câu hỏi đúng schema (chỉ kiểm tra & gắn nhãn, không gọi AI)
 *   .txt / .md       — văn bản đề (AI trích xuất cấu trúc)
 *   .pdf             — AI đọc trực tiếp file PDF
 *   .png/.jpg/.webp  — ảnh chụp đề (AI đọc ảnh)
 *   .docx            — hãy xuất sang PDF hoặc lưu thành .txt/.md trước
 *
 * Kết quả ghi vào content/imports/*.json với verification = "draft" (không xuất hiện trong ôn tập/thi thử).
 * Sau khi kiểm tra đáp án, chương, giải thích: chuyển verification thành "verified" (hoặc "unverified"),
 * rồi chuyển file vào content/banks/<course>/<exam>/questions/ và chạy `npm run bank:validate`.
 */
import fs from "node:fs";
import path from "node:path";
import { config } from "dotenv";
import { z } from "zod";
import { QuestionSchema } from "../src/lib/bank/schema";

config({ path: path.resolve(__dirname, "..", ".env"), quiet: true });

const args = process.argv.slice(2);
const arg = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const file = arg("file");
const course = arg("course");
const exam = arg("exam");
const chapter = arg("chapter");
const setId = arg("set");

if (!file || !course || !exam || !["midterm", "final"].includes(exam)) {
  console.error("Cách dùng: npm run bank:import -- --file <đường dẫn> --course it005 --exam midterm|final [--chapter <id>] [--set <tên>]");
  process.exit(1);
}

const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "content", "imports");
const ext = path.extname(file).toLowerCase();
const base = path.basename(file, ext).replace(/[^a-z0-9-]+/gi, "-").toLowerCase();

const SYSTEM = `Bạn chuyển đề thi môn học (tiếng Việt) thành JSON có cấu trúc. NGUYÊN TẮC BẮT BUỘC:
- Giữ NGUYÊN VĂN nội dung câu hỏi và phương án; dùng Markdown, LaTeX ($...$) cho công thức, bảng GFM cho bảng, \`backtick\` cho địa chỉ IP/lệnh.
- KHÔNG tự suy đoán đáp án: chỉ điền "correctOptionId" khi tài liệu có đáp án; nếu không có, đặt "correctOptionId": null và "answerInDocument": false.
- KHÔNG tự đặt tên chương: chỉ điền "chapterLabel" khi tài liệu ghi rõ chương/phần; nếu không, để null.
- Giải thích ("explanation") có thể soạn nháp nhưng phải đúng kiến thức; đánh dấu "explanationDrafted": true.
- Câu tự luận: chỉ điền "modelAnswer"/"rubric" nếu tài liệu có đáp án; nếu không, để null.`;

const USER = `Trả về JSON: {"questions":[{
  "number": "<số câu trong đề>",
  "type": "mcq" | "essay",
  "content": "...",
  "options": [{"id":"A","content":"..."}] | null,
  "correctOptionId": "A" | null,
  "answerInDocument": true | false,
  "chapterLabel": string | null,
  "explanation": {"correct":"1–3 câu","whyCorrect":"...","whyWrong":{"B":"..."},"related":"...","tip":"..."} | null,
  "explanationDrafted": true | false,
  "modelAnswer": string | null,
  "rubric": [{"id":"r1","criterion":"...","points":1,"keyPoints":["..."]}] | null,
  "points": number | null
}]}`;

const Extracted = z.object({
  questions: z.array(
    z.object({
      number: z.union([z.string(), z.number()]).nullish(),
      type: z.enum(["mcq", "essay"]),
      content: z.string(),
      options: z.array(z.object({ id: z.string(), content: z.string() })).nullish(),
      correctOptionId: z.string().nullish(),
      answerInDocument: z.boolean().nullish(),
      chapterLabel: z.string().nullish(),
      explanation: z.record(z.string(), z.unknown()).nullish(),
      explanationDrafted: z.boolean().nullish(),
      modelAnswer: z.string().nullish(),
      rubric: z.array(z.object({ id: z.string(), criterion: z.string(), points: z.number(), keyPoints: z.array(z.string()).optional() })).nullish(),
      points: z.number().nullish(),
    }),
  ),
});

async function extractWithAI(): Promise<z.infer<typeof Extracted>> {
  const key = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL_GENERATOR || process.env.OPENAI_MODEL;
  if (!key || !model) throw new Error("Thiếu OPENAI_API_KEY / OPENAI_MODEL trong .env — cần cho việc trích xuất từ văn bản, PDF hoặc ảnh.");
  const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
  const buf = fs.readFileSync(file!);
  let content: unknown;
  if ([".txt", ".md"].includes(ext)) content = `${USER}\n\nĐỀ THI:\n${buf.toString("utf8")}`;
  else if (ext === ".pdf")
    content = [
      { type: "text", text: USER },
      { type: "file", file: { filename: path.basename(file!), file_data: `data:application/pdf;base64,${buf.toString("base64")}` } },
    ];
  else if ([".png", ".jpg", ".jpeg", ".webp"].includes(ext)) {
    const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
    content = [
      { type: "text", text: USER },
      { type: "image_url", image_url: { url: `data:${mime};base64,${buf.toString("base64")}` } },
    ];
  } else throw new Error(`Chưa hỗ trợ định dạng ${ext}. Với .docx, hãy xuất sang PDF hoặc .txt trước.`);

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: `${SYSTEM}\nChỉ trả về JSON.` },
        { role: "user", content },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 16_000,
    }),
    signal: AbortSignal.timeout(180_000),
  });
  if (!res.ok) throw new Error(`AI trả lỗi HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { choices: { message: { content: string } }[] };
  return Extracted.parse(JSON.parse(data.choices[0].message.content));
}

function toDraft(x: z.infer<typeof Extracted>["questions"][number], i: number) {
  const id = `${course}-${exam}-${base}-${String(i + 1).padStart(3, "0")}`;
  const common = {
    id,
    courseId: course,
    examType: exam,
    chapterId: chapter ?? "CHUA_GAN_CHUONG",
    ...(setId ? { setId } : {}),
    content: x.content,
    ...(x.points ? { points: x.points } : {}),
    source: { kind: "original", reference: `${path.basename(file!)}${x.number ? ` — câu ${x.number}` : ""}` },
    verification: "draft",
    _import: {
      chapterLabel: x.chapterLabel ?? null,
      answerInDocument: x.answerInDocument ?? false,
      explanationDrafted: x.explanationDrafted ?? false,
      note: "Kiểm tra đáp án, chương và giải thích trước khi đổi verification. Xóa trường _import khi duyệt xong.",
    },
  };
  if (x.type === "mcq")
    return { ...common, type: "mcq", options: x.options ?? [], correctOptionId: x.correctOptionId ?? "", explanation: x.explanation ?? { correct: "" } };
  return { ...common, type: "essay", ...(x.modelAnswer && x.rubric ? { essay: { modelAnswer: x.modelAnswer, rubric: x.rubric } } : {}) };
}

async function main() {
  if (!fs.existsSync(file!)) throw new Error(`Không tìm thấy file ${file}`);
  let drafts: Record<string, unknown>[];
  if (ext === ".json") {
    const raw = JSON.parse(fs.readFileSync(file!, "utf8"));
    if (!Array.isArray(raw)) throw new Error("File JSON phải là một mảng câu hỏi.");
    drafts = raw.map((q: Record<string, unknown>) => ({ ...q, verification: q.verification ?? "draft" }));
  } else {
    console.log(`Đang trích xuất ${path.basename(file!)} bằng AI…`);
    drafts = (await extractWithAI()).questions.map(toDraft);
  }

  let ok = 0;
  for (const d of drafts) {
    const { _import, ...rest } = d as { _import?: unknown };
    void _import;
    const r = QuestionSchema.safeParse(rest);
    if (r.success) ok++;
    else console.warn(`⚠  ${String(d.id)}: ${r.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const out = path.join(OUT_DIR, `${course}-${exam}-${base}-${Date.now()}.json`);
  fs.writeFileSync(out, JSON.stringify(drafts, null, 2));
  console.log(`\n✔  Đã ghi ${drafts.length} câu (${ok} đúng schema) → ${path.relative(ROOT, out)}`);
  console.log("   Bước tiếp theo: duyệt file, gán chapterId, đổi verification, chuyển vào content/banks/... rồi chạy npm run bank:validate.");
}

main().catch((e) => {
  console.error(`✖  ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});

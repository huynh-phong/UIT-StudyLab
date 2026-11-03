/**
 * Đọc & kiểm tra toàn bộ ngân hàng câu hỏi trong /content, ghi ra src/generated/bank.json.
 *
 *   npm run bank:build      — kiểm tra + ghi file
 *   npm run bank:validate   — chỉ kiểm tra (CI)
 *
 * Cấu trúc thư mục:
 *   content/banks/<courseId>/course.json
 *   content/banks/<courseId>/<examType>/exam.json
 *   content/banks/<courseId>/<examType>/questions/*.json
 *   content/demo/<courseId>/<examType>/...   (dữ liệu minh họa, cùng định dạng)
 */
import fs from "node:fs";
import path from "node:path";
import {
  CourseFileSchema,
  ExamFileSchema,
  QuestionSchema,
  type BuiltBank,
  type BuiltCourse,
  type BuiltExam,
  type Question,
} from "../src/lib/bank/schema";
import { verifyCalcOptions } from "../src/lib/net/ipv4";
import { verifyEssay, verifyMcq } from "../src/lib/mips/verify";

const ROOT = path.resolve(__dirname, "..");
const CONTENT = path.join(ROOT, "content");
const OUT = path.join(ROOT, "src", "generated", "bank.json");
const checkOnly = process.argv.includes("--check");

const errors: string[] = [];
const warnings: string[] = [];

function readJson(file: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    errors.push(`${rel(file)}: JSON không hợp lệ — ${(e as Error).message}`);
    return undefined;
  }
}
const rel = (f: string) => path.relative(ROOT, f).replaceAll("\\", "/");
const dirs = (p: string) =>
  fs.existsSync(p) ? fs.readdirSync(p, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name) : [];

function loadExam(dir: string, isDemo: boolean, courseId: string, seenIds: Map<string, string>): BuiltExam | null {
  const examPath = path.join(dir, "exam.json");
  if (!fs.existsSync(examPath)) return null;
  const parsed = ExamFileSchema.safeParse(readJson(examPath));
  if (!parsed.success) {
    errors.push(`${rel(examPath)}: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
    return null;
  }
  const exam = parsed.data;
  if (exam.courseId !== courseId) errors.push(`${rel(examPath)}: courseId "${exam.courseId}" không khớp thư mục "${courseId}"`);
  const chapterIds = new Set(exam.chapters.map((c) => c.id));
  if (chapterIds.size !== exam.chapters.length) errors.push(`${rel(examPath)}: trùng ID chương`);

  const questions: Question[] = [];
  const qDir = path.join(dir, "questions");
  const files = fs.existsSync(qDir) ? fs.readdirSync(qDir).filter((f) => f.endsWith(".json")).sort() : [];
  for (const f of files) {
    const file = path.join(qDir, f);
    const raw = readJson(file);
    if (raw === undefined) continue;
    if (!Array.isArray(raw)) {
      errors.push(`${rel(file)}: phải là một mảng câu hỏi`);
      continue;
    }
    raw.forEach((item, idx) => {
      const r = QuestionSchema.safeParse(item);
      const label = `${rel(file)}[${idx}]${(item as { id?: string })?.id ? ` (${(item as { id: string }).id})` : ""}`;
      if (!r.success) {
        errors.push(`${label}: ${r.error.issues.map((i) => `${i.path.join(".") || "(root)"} ${i.message}`).join("; ")}`);
        return;
      }
      const q = r.data;
      if (q.courseId !== exam.courseId || q.examType !== exam.examType)
        errors.push(`${label}: courseId/examType không khớp exam.json`);
      if (!chapterIds.has(q.chapterId)) errors.push(`${label}: chương "${q.chapterId}" chưa khai báo trong exam.json`);
      const dup = seenIds.get(q.id);
      if (dup) errors.push(`${label}: trùng ID với ${dup}`);
      seenIds.set(q.id, label);
      if (isDemo && q.source.kind !== "demo") errors.push(`${label}: câu trong thư mục demo phải có source.kind = "demo"`);
      if (!isDemo && q.source.kind === "demo") errors.push(`${label}: câu demo không được đặt trong ngân hàng thực tế`);
      if (q.type === "mcq" && q.calc) {
        const v = verifyCalcOptions(q.calc, q.options, q.correctOptionId);
        if (!v.ok) errors.push(`${label}: kiểm tra phép tính thất bại — ${v.reason}`);
      }
      if (q.type === "mcq" && q.verify) {
        const reason = verifyMcq(q);
        if (reason) errors.push(`${label}: kiểm chứng thất bại — ${reason}`);
      }
      if (q.type === "essay" && q.essay?.verify) {
        const reason = verifyEssay(q);
        if (reason) errors.push(`${label}: đáp án mẫu chạy sai — ${reason}`);
      }
      if (q.type === "essay" && !q.essay) warnings.push(`${label}: tự luận chưa có đáp án mẫu/rubric — sẽ không được chấm AI`);
      if (q.verification === "draft") warnings.push(`${label}: đang ở trạng thái draft — bị ẩn khỏi ôn tập và thi thử`);
      questions.push(q);
    });
  }

  if (exam.blueprint) {
    for (const s of exam.blueprint.slots) {
      for (const id of [s.chapterId, ...(s.alsoFrom ?? [])])
        if (!chapterIds.has(id)) errors.push(`${rel(examPath)}: blueprint dùng chương "${id}" chưa khai báo`);
    }
  }
  return { ...exam, isDemo, key: `${isDemo ? "demo:" : ""}${exam.courseId}/${exam.examType}`, questions };
}

function main() {
  const seenIds = new Map<string, string>();
  const courses: BuiltCourse[] = [];
  const bankRoot = path.join(CONTENT, "banks");
  const demoRoot = path.join(CONTENT, "demo");

  for (const courseId of dirs(bankRoot)) {
    const coursePath = path.join(bankRoot, courseId, "course.json");
    const parsed = CourseFileSchema.safeParse(readJson(coursePath));
    if (!parsed.success) {
      errors.push(`${rel(coursePath)}: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
      continue;
    }
    const exams: BuiltExam[] = [];
    for (const examDir of dirs(path.join(bankRoot, courseId))) {
      const e = loadExam(path.join(bankRoot, courseId, examDir), false, courseId, seenIds);
      if (e) exams.push(e);
    }
    for (const examDir of dirs(path.join(demoRoot, courseId))) {
      const e = loadExam(path.join(demoRoot, courseId, examDir), true, courseId, seenIds);
      if (e) exams.push(e);
    }
    courses.push({ ...parsed.data, exams });
  }

  for (const w of warnings) console.warn(`⚠  ${w}`);
  if (errors.length) {
    for (const e of errors) console.error(`✖  ${e}`);
    console.error(`\nNgân hàng câu hỏi có ${errors.length} lỗi. Sửa các lỗi trên rồi chạy lại.`);
    process.exit(1);
  }

  const bank: BuiltBank = { generatedAt: new Date().toISOString(), courses };
  const summary = courses
    .flatMap((c) => c.exams.map((e) => `${e.key}: ${e.chapters.length} chương, ${e.questions.length} câu`))
    .join("\n   ");
  if (!checkOnly) {
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(bank));
  }
  console.log(`✔  Ngân hàng câu hỏi hợp lệ${checkOnly ? "" : ` → ${rel(OUT)}`}\n   ${summary}`);
}

main();

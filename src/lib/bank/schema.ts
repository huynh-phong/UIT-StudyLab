import { z } from "zod";

/**
 * Schema ngân hàng câu hỏi.
 * Cấu trúc: Học phần (course) → Kỳ thi (exam: midterm/final) → Chương (chapter) → Câu hỏi.
 * Dùng chung cho script build dữ liệu, server và client.
 */

export const ExamTypeSchema = z.enum(["midterm", "final"]);
export type ExamType = z.infer<typeof ExamTypeSchema>;

export const EXAM_TYPE_LABEL: Record<ExamType, string> = {
  midterm: "Giữa kỳ",
  final: "Cuối kỳ",
};

export const DifficultySchema = z.enum(["easy", "medium", "hard"]);
export type Difficulty = z.infer<typeof DifficultySchema>;

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: "Dễ",
  medium: "Trung bình",
  hard: "Khó",
};

/**
 * verified      — đã đối chiếu với tài liệu/đáp án chính thức hoặc người quản trị xác nhận.
 * unverified    — có đáp án nhưng chưa được kiểm chứng.
 * needs_review  — bị đánh dấu cần người quản trị xem lại.
 * draft         — bản nháp (ví dụ vừa nhập tự động), chưa dùng được.
 * ai_checked    — câu do AI tạo, đã qua kiểm tra tự động nhưng chưa có người duyệt.
 */
export const VerificationSchema = z.enum(["verified", "unverified", "needs_review", "draft", "ai_checked"]);
export type Verification = z.infer<typeof VerificationSchema>;

export const SourceSchema = z.object({
  /**
   * original: từ đề gốc; authored: soạn thêm dựa trên lý thuyết trong tài liệu;
   * generated: sinh bằng thuật toán (đáp án tính bằng code); ai_generated: AI tạo khi chạy; demo: dữ liệu minh họa
   */
  kind: z.enum(["original", "authored", "generated", "ai_generated", "demo"]),
  /** Tên tài liệu / bộ đề / năm học (nếu có) */
  reference: z.string().optional(),
  /** Câu gốc dùng làm mẫu khi AI tạo câu mới */
  basedOn: z.array(z.string()).optional(),
});

export const OptionIdSchema = z.string().regex(/^[A-H]$/, "Mã đáp án phải là A–H");

export const OptionSchema = z.object({
  id: OptionIdSchema,
  content: z.string().min(1),
});
export type QuestionOption = z.infer<typeof OptionSchema>;

export const McqExplanationSchema = z.object({
  /** Giải thích ngắn (1–3 câu) hiển thị khi trả lời đúng. */
  correct: z.string().min(1),
  /** Lý do đáp án đúng là đúng (chi tiết hơn, hiển thị khi sai). Nếu thiếu dùng `correct`. */
  whyCorrect: z.string().optional(),
  /** Lý do từng phương án sai là sai: { "B": "...", "C": "..." } */
  whyWrong: z.record(OptionIdSchema, z.string()).optional(),
  /** Kiến thức liên quan giúp tránh nhầm lẫn. */
  related: z.string().optional(),
  /** Ghi nhớ ngắn. */
  tip: z.string().optional(),
});
export type McqExplanation = z.infer<typeof McqExplanationSchema>;

export const RubricItemSchema = z.object({
  id: z.string().min(1),
  criterion: z.string().min(1),
  points: z.number().positive(),
  /** Các ý kiến thức cụ thể cần có để đạt tiêu chí. */
  keyPoints: z.array(z.string()).optional(),
});
export type RubricItem = z.infer<typeof RubricItemSchema>;

/** Một trường hợp chạy thử để kiểm chứng đáp án mẫu dạng code bằng bộ mô phỏng MIPS. */
export const RunCaseSchema = z.object({
  regs: z.record(z.string(), z.number()).optional(),
  /** Word ban đầu trong bộ nhớ: khóa là địa chỉ byte. */
  words: z.record(z.string(), z.number()).optional(),
  expectRegs: z.record(z.string(), z.number()).optional(),
  expectWords: z.record(z.string(), z.number()).optional(),
});
export type RunCase = z.infer<typeof RunCaseSchema>;

export const EssaySpecSchema = z.object({
  modelAnswer: z.string().min(1),
  rubric: z.array(RubricItemSchema).min(1),
  /** code: ô nhập dùng font đơn cách; text: văn bản thường. */
  format: z.enum(["code", "text"]).optional(),
  /** Gợi ý cách trình bày, hiển thị trong ô nhập. */
  placeholder: z.string().optional(),
  /** Khối mips đầu tiên của đáp án mẫu phải chạy đúng các trường hợp này. */
  verify: z.array(RunCaseSchema).optional(),
});
export type EssaySpec = z.infer<typeof EssaySpecSchema>;

/** Thông tin cho bộ kiểm tra phép tính độc lập (ví dụ subnet). */
export const CalcCheckSchema = z.object({
  kind: z.literal("ipv4"),
  ip: z.string(),
  prefix: z.number().int().min(0).max(32),
  ask: z.enum(["network", "broadcast", "mask", "firstHost", "lastHost", "usableHosts", "totalAddresses", "wildcard"]),
});
export type CalcCheck = z.infer<typeof CalcCheckSchema>;

/** Kiểm chứng đáp án trắc nghiệm bằng code khi build ngân hàng. */
export const McqVerifySchema = z.discriminatedUnion("kind", [
  /** Phương án đúng phải bằng mã máy (hex hoặc nhị phân) của lệnh. */
  z.object({ kind: z.literal("encode"), asm: z.string(), pc: z.number().optional(), labels: z.record(z.string(), z.number()).optional() }),
  /** Phương án đúng phải là lệnh Assembly của mã máy. */
  z.object({ kind: z.literal("decode"), hex: z.string() }),
  /** Chạy khối mips trong đề: thanh ghi `reg` phải bằng số trong phương án đúng. */
  z.object({
    kind: z.literal("run"),
    reg: z.string(),
    code: z.string().optional(),
    regs: z.record(z.string(), z.number()).optional(),
    words: z.record(z.string(), z.number()).optional(),
    littleEndian: z.boolean().optional(),
  }),
  /** Phương án đúng phải bằng giá trị tính sẵn (bài hiệu suất, ảnh…), sai số 0,5%. */
  z.object({ kind: z.literal("value"), expr: z.string() }),
]);
export type McqVerify = z.infer<typeof McqVerifySchema>;

const QuestionBase = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9._-]*$/i, "ID chỉ gồm chữ, số, dấu chấm, gạch nối, gạch dưới"),
  courseId: z.string().min(1),
  examType: ExamTypeSchema,
  chapterId: z.string().min(1),
  /** Bộ đề chứa câu hỏi (nếu có). */
  setId: z.string().optional(),
  /** Nội dung câu hỏi: Markdown + LaTeX ($...$, $$...$$), bảng GFM, code block, ảnh. */
  content: z.string().min(1),
  difficulty: DifficultySchema.optional(),
  /** Điểm/trọng số mặc định khi xuất hiện trong đề. */
  points: z.number().positive().optional(),
  source: SourceSchema,
  verification: VerificationSchema,
  tags: z.array(z.string()).optional(),
});

export const McqQuestionSchema = QuestionBase.extend({
  type: z.literal("mcq"),
  options: z.array(OptionSchema).min(2).max(8),
  correctOptionId: OptionIdSchema,
  explanation: McqExplanationSchema,
  calc: CalcCheckSchema.optional(),
  verify: McqVerifySchema.optional(),
}).superRefine((q, ctx) => {
  const ids = q.options.map((o) => o.id);
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", message: "Mã phương án bị trùng" });
  if (!ids.includes(q.correctOptionId))
    ctx.addIssue({ code: "custom", message: `Đáp án ${q.correctOptionId} không có trong danh sách phương án` });
});
export type McqQuestion = z.infer<typeof McqQuestionSchema>;

export const EssayQuestionSchema = QuestionBase.extend({
  type: z.literal("essay"),
  /** Có thể thiếu: khi đó hệ thống KHÔNG chấm điểm mà báo cần bổ sung dữ liệu. */
  essay: EssaySpecSchema.optional(),
});
export type EssayQuestion = z.infer<typeof EssayQuestionSchema>;

export const QuestionSchema = z.discriminatedUnion("type", [McqQuestionSchema, EssayQuestionSchema]);
export type Question = z.infer<typeof QuestionSchema>;

export const ChapterSchema = z.object({
  id: z.string().min(1),
  order: z.number().int(),
  title: z.string().min(1),
  description: z.string().optional(),
});
export type Chapter = z.infer<typeof ChapterSchema>;

/** Một ô phân bố trong cấu trúc đề: chương X có N câu loại Y, mỗi câu P điểm. */
export const BlueprintSlotSchema = z.object({
  chapterId: z.string().min(1),
  type: z.enum(["mcq", "essay"]),
  count: z.number().int().positive(),
  pointsEach: z.number().positive(),
  /** Có thể lấy câu từ các chương này ngoài chapterId. */
  alsoFrom: z.array(z.string()).optional(),
  difficulty: z
    .object({ easy: z.number().min(0), medium: z.number().min(0), hard: z.number().min(0) })
    .partial()
    .optional(),
});
export type BlueprintSlot = z.infer<typeof BlueprintSlotSchema>;

export const BlueprintSchema = z.object({
  /** verified: lấy từ tài liệu thực tế/đã xác nhận; unverified: cấu hình tạm, phải hiển thị cảnh báo. */
  status: z.enum(["verified", "unverified"]),
  /** Ghi chú nguồn: đề nào, năm nào, ai xác nhận. */
  sourceNote: z.string().min(1),
  title: z.string().min(1),
  /** null = không giới hạn thời gian */
  durationMinutes: z.number().int().positive().nullable(),
  slots: z.array(BlueprintSlotSchema).min(1),
  notes: z.string().optional(),
});
export type Blueprint = z.infer<typeof BlueprintSchema>;

export const ExamFileSchema = z.object({
  courseId: z.string().min(1),
  examType: ExamTypeSchema,
  title: z.string().min(1),
  description: z.string().optional(),
  chapters: z.array(ChapterSchema),
  blueprint: BlueprintSchema.optional(),
});
export type ExamFile = z.infer<typeof ExamFileSchema>;

export const CourseFileSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  code: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
});
export type CourseFile = z.infer<typeof CourseFileSchema>;

export const QuestionFileSchema = z.array(z.unknown());

/** Dữ liệu đã build, được ghi ra src/generated/bank.json */
export interface BuiltExam extends ExamFile {
  isDemo: boolean;
  /** Khóa duy nhất: `${courseId}/${examType}` hoặc `demo:${courseId}/${examType}` */
  key: string;
  questions: Question[];
}
export interface BuiltCourse extends CourseFile {
  exams: BuiltExam[];
}
export interface BuiltBank {
  generatedAt: string;
  courses: BuiltCourse[];
}

/** Câu hỏi có thể dùng trong đề thi thử mặc định. */
export function isExamEligible(q: Question): boolean {
  if (q.verification !== "verified") return false;
  if (q.type === "essay" && !q.essay) return false;
  return true;
}

/** Câu hỏi có thể hiển thị trong chế độ ôn tập (cần có đáp án). */
export function isStudyEligible(q: Question): boolean {
  return q.verification !== "draft";
}

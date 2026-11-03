import type { Difficulty, ExamType } from "@/lib/bank/schema";
import type { EssayGradeState, McqGrade } from "@/lib/grading/types";
import type { Question } from "@/lib/bank/schema";

/** Câu hỏi gửi cho client trong lúc thi — KHÔNG chứa đáp án hay lời giải. */
export interface PublicExamQuestion {
  id: string;
  index: number;
  type: "mcq" | "essay";
  content: string;
  options?: { id: string; content: string }[];
  points: number;
  chapterId: string;
  chapterTitle: string;
  difficulty?: Difficulty;
  origin: "ai_generated" | "authored" | "generated" | "original" | "demo";
  answerFormat?: "code" | "text";
  placeholder?: string;
  keyboard?: "ra" | "er" | "sql" | "mixed";
}

export interface PublicExam {
  attemptId: string;
  examKey: string;
  courseCode: string;
  examType: ExamType;
  title: string;
  version: string;
  isDemo: boolean;
  blueprintVerified: boolean;
  createdAt: number;
  durationMinutes: number | null;
  /** epoch ms; null nếu không giới hạn thời gian */
  deadline: number | null;
  questions: PublicExamQuestion[];
  totalPoints: number;
  composition: { aiGenerated: number; generated: number; fromBank: number };
  warnings: string[];
  token: string;
}

export interface ExamResponse {
  optionId?: string | null;
  text?: string | null;
}

export interface GradedQuestion {
  question: Question;
  index: number;
  points: number;
  chapterTitle: string;
  response: ExamResponse | null;
  mcq?: McqGrade;
  essay?: EssayGradeState;
}

export interface ChapterBreakdown {
  chapterId: string;
  chapterTitle: string;
  total: number;
  correct: number;
  wrong: number;
  blank: number;
  pending: number;
  score: number;
  maxScore: number;
}

export interface ExamResult {
  attemptId: string;
  examKey: string;
  title: string;
  version: string;
  /** complete: đã chấm đủ; partial: còn tự luận chưa chấm được (lỗi/chưa cấu hình AI). */
  gradingStatus: "complete" | "partial";
  mcqScore: number;
  mcqMax: number;
  essayScore: number;
  essayMax: number;
  /** Chỉ có khi gradingStatus = complete */
  totalScore: number | null;
  totalMax: number;
  /** Điểm quy về thang 10 (chỉ khi complete) */
  score10: number | null;
  counts: { correct: number; wrong: number; blank: number; pendingEssay: number; total: number };
  chapters: ChapterBreakdown[];
  questions: GradedQuestion[];
  startedAt: number;
  submittedAt: number;
  durationSec: number;
  autoSubmitted: boolean;
}

export interface QuestionReport {
  questionId: string;
  examKey?: string;
  chapterId?: string;
  reason: string;
  note?: string;
  at: string;
}

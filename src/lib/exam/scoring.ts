import { gradeMcq } from "@/lib/grading/mcq";
import type { EssayGradeState } from "@/lib/grading/types";
import type { ChapterBreakdown, ExamResponse, ExamResult, GradedQuestion } from "./types";
import type { Question } from "@/lib/bank/schema";

/** Logic chấm bài thi thuần (không I/O) — dùng cho route nộp bài và test. */

export interface ScoringInput {
  attemptId: string;
  examKey: string;
  title: string;
  version: string;
  createdAt: number;
  durationMinutes: number | null;
  questions: { question: Question; points: number; chapterTitle: string }[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function isEssayPending(s: EssayGradeState | undefined) {
  return !s || s.status === "failed" || s.status === "unavailable" || s.status === "insufficient_reference";
}

export function scoreExam(
  exam: ScoringInput,
  responses: Record<string, ExamResponse | undefined>,
  essays: Record<string, EssayGradeState | undefined>,
  meta: { startedAt: number; submittedAt: number; autoSubmitted: boolean },
): ExamResult {
  const graded: GradedQuestion[] = [];
  const chapters = new Map<string, ChapterBreakdown>();
  let mcqScore = 0,
    mcqMax = 0,
    essayScore = 0,
    essayMax = 0;
  const counts = { correct: 0, wrong: 0, blank: 0, pendingEssay: 0, total: exam.questions.length };

  exam.questions.forEach(({ question, points, chapterTitle }, index) => {
    const response = responses[question.id] ?? null;
    const ch =
      chapters.get(question.chapterId) ??
      ({ chapterId: question.chapterId, chapterTitle, total: 0, correct: 0, wrong: 0, blank: 0, pending: 0, score: 0, maxScore: 0 } as ChapterBreakdown);
    chapters.set(question.chapterId, ch);
    ch.total++;
    ch.maxScore += points;

    if (question.type === "mcq") {
      const g = gradeMcq(question, response?.optionId ?? null, points);
      mcqMax += points;
      mcqScore += g.awarded;
      ch.score += g.awarded;
      if (g.blank) {
        counts.blank++;
        ch.blank++;
      } else if (g.isCorrect) {
        counts.correct++;
        ch.correct++;
      } else {
        counts.wrong++;
        ch.wrong++;
      }
      graded.push({ question, index, points, chapterTitle, response, mcq: g });
    } else {
      essayMax += points;
      const text = response?.text?.trim() ?? "";
      const state: EssayGradeState | undefined = text ? essays[question.id] : { status: "blank" };
      if (!text) {
        counts.blank++;
        ch.blank++;
      } else if (state?.status === "graded") {
        essayScore += state.score;
        ch.score += state.score;
        if (state.score >= state.maxScore / 2) {
          counts.correct++;
          ch.correct++;
        } else {
          counts.wrong++;
          ch.wrong++;
        }
      } else {
        counts.pendingEssay++;
        ch.pending++;
      }
      graded.push({ question, index, points, chapterTitle, response, essay: state ?? { status: "failed", message: "Chưa chấm" } });
    }
  });

  const totalMax = round2(mcqMax + essayMax);
  const complete = counts.pendingEssay === 0;
  const totalScore = complete ? round2(mcqScore + essayScore) : null;
  const deadline = exam.durationMinutes ? exam.createdAt + exam.durationMinutes * 60_000 : null;
  const start = Math.max(meta.startedAt, exam.createdAt);
  const end = deadline ? Math.min(meta.submittedAt, deadline) : meta.submittedAt;

  return {
    attemptId: exam.attemptId,
    examKey: exam.examKey,
    title: exam.title,
    version: exam.version,
    gradingStatus: complete ? "complete" : "partial",
    mcqScore: round2(mcqScore),
    mcqMax: round2(mcqMax),
    essayScore: round2(essayScore),
    essayMax: round2(essayMax),
    totalScore,
    totalMax,
    score10: totalScore !== null && totalMax > 0 ? round2((totalScore / totalMax) * 10) : null,
    counts,
    chapters: [...chapters.values()].map((c) => ({ ...c, score: round2(c.score), maxScore: round2(c.maxScore) })),
    questions: graded,
    startedAt: start,
    submittedAt: meta.submittedAt,
    durationSec: Math.max(0, Math.round((end - start) / 1000)),
    autoSubmitted: meta.autoSubmitted,
  };
}

"use client";

import type { ExamSummary } from "@/lib/bank/repo";
import { sessionProgress, type QuestionStat, type StudySession } from "@/lib/store/study";

import { chapterSessionKey } from "@/lib/session-keys";

export { chapterSessionKey };
export const chapterHref = (e: Pick<ExamSummary, "courseId" | "slug">, chapterId: string) => `/on-tap/${e.courseId}/${e.slug}/${chapterId}`;

export interface ChapterProgress {
  examKey: string;
  chapterId: string;
  title: string;
  description?: string;
  href: string;
  isDemo: boolean;
  total: number;
  done: number;
  correct: number;
  graded: number;
  started: boolean;
  updatedAt: number;
}

export function computeChapterProgress(exams: ExamSummary[], sessions: Record<string, StudySession>): ChapterProgress[] {
  return exams.flatMap((e) =>
    e.chapters.map((c) => {
      const s = sessions[chapterSessionKey(e.key, c.id)];
      const p = sessionProgress(s, c.questionIds);
      return {
        examKey: e.key,
        chapterId: c.id,
        title: c.title,
        description: c.description,
        href: chapterHref(e, c.id),
        isDemo: e.isDemo,
        total: p.total,
        done: p.done,
        correct: p.correct,
        graded: p.graded,
        started: Boolean(s && Object.keys(s.answers).length),
        updatedAt: s?.updatedAt ?? 0,
      };
    }),
  );
}

export function overallStats(stats: Record<string, QuestionStat>, scope?: Set<string>) {
  let attempted = 0,
    correctLast = 0,
    totalAttempts = 0,
    totalCorrect = 0;
  for (const [id, s] of Object.entries(stats)) {
    if (scope && !scope.has(id)) continue;
    attempted++;
    if (s.last === "correct") correctLast++;
    totalAttempts += s.attempts;
    totalCorrect += s.correct;
  }
  return { attempted, correctLast, wrongLast: attempted - correctLast, totalAttempts, totalCorrect };
}

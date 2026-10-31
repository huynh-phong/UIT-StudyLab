"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { ExamResponse, ExamResult, PublicExam } from "@/lib/exam/types";
import type { EssayGradeState } from "@/lib/grading/types";
import { scoreExam } from "@/lib/exam/scoring";

/** Phiên thi đang làm + lịch sử thi thử — lưu trên trình duyệt để không mất bài khi tải lại trang. */

export interface ActiveExam {
  exam: PublicExam;
  responses: Record<string, ExamResponse>;
  marked: Record<string, true>;
  current: number;
  startedAt: number;
}

export interface ExamAttempt {
  id: string;
  examKey: string;
  title: string;
  courseCode: string;
  version: string;
  isDemo: boolean;
  createdAt: number;
  submittedAt: number;
  composition: PublicExam["composition"];
  warnings: string[];
  /** Token niêm phong — dùng để chấm lại tự luận / báo lỗi câu hỏi. */
  token: string;
  result: ExamResult;
}

const MAX_HISTORY = 20;

interface ExamState {
  active: ActiveExam | null;
  history: ExamAttempt[];
  start(exam: PublicExam): void;
  answer(questionId: string, response: ExamResponse): void;
  toggleMark(questionId: string): void;
  setCurrent(index: number): void;
  discardActive(): void;
  finish(result: ExamResult): ExamAttempt | null;
  updateEssay(attemptId: string, questionId: string, state: EssayGradeState): void;
  removeAttempt(id: string): void;
}

export const useExamStore = create<ExamState>()(
  persist(
    (set, get) => ({
      active: null,
      history: [],
      start(exam) {
        set({ active: { exam, responses: {}, marked: {}, current: 0, startedAt: Date.now() } });
      },
      answer(questionId, response) {
        const a = get().active;
        if (!a) return;
        if (a.exam.deadline && Date.now() > a.exam.deadline) return; // hết giờ: khóa bài
        set({ active: { ...a, responses: { ...a.responses, [questionId]: { ...a.responses[questionId], ...response } } } });
      },
      toggleMark(questionId) {
        const a = get().active;
        if (!a) return;
        const marked = { ...a.marked };
        if (marked[questionId]) delete marked[questionId];
        else marked[questionId] = true;
        set({ active: { ...a, marked } });
      },
      setCurrent(index) {
        const a = get().active;
        if (!a) return;
        set({ active: { ...a, current: Math.max(0, Math.min(index, a.exam.questions.length - 1)) } });
      },
      discardActive() {
        set({ active: null });
      },
      finish(result) {
        const a = get().active;
        if (!a || a.exam.attemptId !== result.attemptId) return null;
        const attempt: ExamAttempt = {
          id: result.attemptId,
          examKey: a.exam.examKey,
          title: a.exam.title,
          courseCode: a.exam.courseCode,
          version: a.exam.version,
          isDemo: a.exam.isDemo,
          createdAt: a.exam.createdAt,
          submittedAt: result.submittedAt,
          composition: a.exam.composition,
          warnings: a.exam.warnings,
          token: a.exam.token,
          result,
        };
        set({ active: null, history: [attempt, ...get().history.filter((h) => h.id !== attempt.id)].slice(0, MAX_HISTORY) });
        return attempt;
      },
      updateEssay(attemptId, questionId, state) {
        set({
          history: get().history.map((h) => {
            if (h.id !== attemptId) return h;
            const r = h.result;
            const essays: Record<string, EssayGradeState> = {};
            const responses: Record<string, ExamResponse> = {};
            for (const g of r.questions) {
              if (g.essay) essays[g.question.id] = g.essay;
              if (g.response) responses[g.question.id] = g.response;
            }
            essays[questionId] = state;
            const rescored = scoreExam(
              {
                attemptId: r.attemptId,
                examKey: r.examKey,
                title: r.title,
                version: r.version,
                createdAt: h.createdAt,
                durationMinutes: null,
                questions: r.questions.map((g) => ({ question: g.question, points: g.points, chapterTitle: g.chapterTitle })),
              },
              responses,
              essays,
              { startedAt: r.startedAt, submittedAt: r.submittedAt, autoSubmitted: r.autoSubmitted },
            );
            return { ...h, result: { ...rescored, durationSec: r.durationSec } };
          }),
        });
      },
      removeAttempt(id) {
        set({ history: get().history.filter((h) => h.id !== id) });
      },
    }),
    {
      name: "studylab:exam:v1",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ active: s.active, history: s.history }),
    },
  ),
);

/** ID câu đã gặp trong các lần thi gần đây — gửi lên server để hạn chế trùng câu. */
export function recentExamQuestionIds(history: ExamAttempt[], examKey: string, limit = 300) {
  const ids: string[] = [];
  for (const h of history) {
    if (h.examKey !== examKey) continue;
    for (const g of h.result.questions) ids.push(g.question.id);
    if (ids.length >= limit) break;
  }
  return [...new Set(ids)].slice(0, limit);
}

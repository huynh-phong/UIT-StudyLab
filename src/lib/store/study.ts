"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { EssayGradeState } from "@/lib/grading/types";

/**
 * Tiến độ ôn tập — lưu trên trình duyệt (localStorage), không cần tài khoản.
 * Mỗi chương/phiên ôn có session riêng, độc lập nhau.
 */

export interface McqAnswer {
  kind: "mcq";
  selected: string | null;
  confirmed: boolean;
  correct?: boolean;
  at: number;
}

export interface EssayAnswer {
  kind: "essay";
  text: string;
  status: "draft" | "grading" | "done" | "error";
  grade?: EssayGradeState;
  error?: string;
  at: number;
}

export type StudyAnswer = McqAnswer | EssayAnswer;

export interface StudySession {
  key: string;
  title: string;
  href: string;
  currentId: string | null;
  answers: Record<string, StudyAnswer>;
  /** Chỉ với phiên ôn tập lại (câu sai/đã đánh dấu): danh sách câu cố định lúc bắt đầu. */
  questionIds?: string[];
  total: number;
  startedAt: number;
  updatedAt: number;
}

export interface QuestionStat {
  attempts: number;
  correct: number;
  last: "correct" | "wrong";
  lastAt: number;
}

interface StudyState {
  sessions: Record<string, StudySession>;
  stats: Record<string, QuestionStat>;
  bookmarks: Record<string, number>;
  wrong: Record<string, number>;

  ensureSession(key: string, meta: { title: string; href: string; total: number; questionIds?: string[] }): void;
  setCurrent(key: string, questionId: string): void;
  selectOption(key: string, questionId: string, optionId: string): void;
  confirmMcq(key: string, questionId: string, correct: boolean): void;
  setEssayText(key: string, questionId: string, text: string): void;
  setEssayGrading(key: string, questionId: string): void;
  setEssayResult(key: string, questionId: string, grade: EssayGradeState): void;
  setEssayError(key: string, questionId: string, error: string): void;
  resetSession(key: string): void;
  toggleBookmark(questionId: string): void;
  removeWrong(questionId: string): void;
  clearAll(): void;
}

function recordStat(stats: Record<string, QuestionStat>, id: string, correct: boolean): Record<string, QuestionStat> {
  const prev = stats[id];
  return {
    ...stats,
    [id]: {
      attempts: (prev?.attempts ?? 0) + 1,
      correct: (prev?.correct ?? 0) + (correct ? 1 : 0),
      last: correct ? "correct" : "wrong",
      lastAt: Date.now(),
    },
  };
}

export const useStudyStore = create<StudyState>()(
  persist(
    (set, get) => {
      const patchAnswer = (key: string, questionId: string, fn: (prev: StudyAnswer | undefined) => StudyAnswer | undefined) => {
        const s = get().sessions[key];
        if (!s) return;
        const next = fn(s.answers[questionId]);
        if (!next) return;
        set({ sessions: { ...get().sessions, [key]: { ...s, answers: { ...s.answers, [questionId]: next }, updatedAt: Date.now() } } });
      };

      return {
        sessions: {},
        stats: {},
        bookmarks: {},
        wrong: {},

        ensureSession(key, meta) {
          const s = get().sessions[key];
          if (s) {
            if (s.total !== meta.total || s.title !== meta.title)
              set({ sessions: { ...get().sessions, [key]: { ...s, total: meta.total, title: meta.title, href: meta.href } } });
            return;
          }
          const now = Date.now();
          set({
            sessions: {
              ...get().sessions,
              [key]: { key, title: meta.title, href: meta.href, total: meta.total, questionIds: meta.questionIds, currentId: null, answers: {}, startedAt: now, updatedAt: now },
            },
          });
        },
        setCurrent(key, questionId) {
          const s = get().sessions[key];
          if (!s || s.currentId === questionId) return;
          set({ sessions: { ...get().sessions, [key]: { ...s, currentId: questionId, updatedAt: Date.now() } } });
        },
        selectOption(key, questionId, optionId) {
          patchAnswer(key, questionId, (prev) => {
            if (prev?.kind === "mcq" && prev.confirmed) return undefined; // đã khóa sau khi xác nhận
            return { kind: "mcq", selected: optionId, confirmed: false, at: Date.now() };
          });
        },
        confirmMcq(key, questionId, correct) {
          const s = get().sessions[key];
          const prev = s?.answers[questionId];
          if (!s || prev?.kind !== "mcq" || prev.confirmed || !prev.selected) return;
          patchAnswer(key, questionId, () => ({ ...prev, confirmed: true, correct, at: Date.now() }));
          set({
            stats: recordStat(get().stats, questionId, correct),
            wrong: correct ? get().wrong : { ...get().wrong, [questionId]: Date.now() },
          });
        },
        setEssayText(key, questionId, text) {
          patchAnswer(key, questionId, (prev) => {
            if (prev?.kind === "essay" && (prev.status === "grading" || prev.status === "done")) return undefined;
            return { kind: "essay", text, status: "draft", at: Date.now() };
          });
        },
        setEssayGrading(key, questionId) {
          patchAnswer(key, questionId, (prev) => (prev?.kind === "essay" ? { ...prev, status: "grading", error: undefined, at: Date.now() } : undefined));
        },
        setEssayResult(key, questionId, grade) {
          patchAnswer(key, questionId, (prev) => (prev?.kind === "essay" ? { ...prev, status: "done", grade, error: undefined, at: Date.now() } : undefined));
          if (grade.status === "graded") {
            const correct = grade.score >= grade.maxScore / 2;
            set({ stats: recordStat(get().stats, questionId, correct), wrong: correct ? get().wrong : { ...get().wrong, [questionId]: Date.now() } });
          }
        },
        setEssayError(key, questionId, error) {
          patchAnswer(key, questionId, (prev) => (prev?.kind === "essay" ? { ...prev, status: "error", error, at: Date.now() } : undefined));
        },
        resetSession(key) {
          const { [key]: _removed, ...rest } = get().sessions;
          void _removed;
          set({ sessions: rest });
        },
        toggleBookmark(questionId) {
          const b = { ...get().bookmarks };
          if (b[questionId]) delete b[questionId];
          else b[questionId] = Date.now();
          set({ bookmarks: b });
        },
        removeWrong(questionId) {
          const w = { ...get().wrong };
          delete w[questionId];
          set({ wrong: w });
        },
        clearAll() {
          set({ sessions: {}, stats: {}, bookmarks: {}, wrong: {} });
        },
      };
    },
    {
      name: "studylab:study:v1",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ sessions: s.sessions, stats: s.stats, bookmarks: s.bookmarks, wrong: s.wrong }),
      // Nếu tải lại trang khi đang chấm AI, đưa về nháp — không tự gọi lại AI (tránh vòng lặp yêu cầu).
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        for (const s of Object.values(state.sessions)) {
          for (const [id, a] of Object.entries(s.answers)) {
            if (a.kind === "essay" && a.status === "grading") s.answers[id] = { ...a, status: "draft" };
          }
        }
      },
    },
  ),
);

/** Số câu đã hoàn thành (đã xác nhận / đã chấm) trong một phiên. */
export function sessionProgress(s: StudySession | undefined, questionIds: string[]) {
  let done = 0,
    correct = 0,
    graded = 0;
  if (!s) return { done, correct, graded, total: questionIds.length };
  for (const id of questionIds) {
    const a = s.answers[id];
    if (!a) continue;
    if (a.kind === "mcq" && a.confirmed) {
      done++;
      graded++;
      if (a.correct) correct++;
    } else if (a.kind === "essay" && a.status === "done") {
      done++;
      if (a.grade?.status === "graded") {
        graded++;
        if (a.grade.score >= a.grade.maxScore / 2) correct++;
      }
    }
  }
  return { done, correct, graded, total: questionIds.length };
}

export function isAnswerDone(a: StudyAnswer | undefined) {
  return Boolean(a && ((a.kind === "mcq" && a.confirmed) || (a.kind === "essay" && a.status === "done")));
}

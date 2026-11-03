"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  ChevronLeft,
  ChevronRight,
  FlaskConical,
  LayoutGrid,
  PartyPopper,
  RotateCcw,
  ShieldAlert,
} from "lucide-react";
import { DIFFICULTY_LABEL, type Question } from "@/lib/bank/schema";
import { gradeMcq } from "@/lib/grading/mcq";
import { isAnswerDone, sessionProgress, useStudyStore, type StudyAnswer } from "@/lib/store/study";
import { useHydrated } from "@/lib/hooks";
import { RichContent } from "@/components/rich-content";
import { OptionCard, type OptionState } from "@/components/question/option-card";
import { McqFeedback } from "@/components/question/mcq-feedback";
import { EssayPanel } from "./essay-panel";
import { MipsReferenceButton } from "@/components/mips-reference";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Callout, Skeleton } from "@/components/ui/misc";
import { cn, pct } from "@/lib/utils";

export interface StudySessionProps {
  sessionKey: string;
  title: string;
  courseLabel: string;
  href: string;
  backHref: string;
  backLabel: string;
  questions: Question[];
  chapterTitles: Record<string, string>;
  isDemo: boolean;
  aiAvailable: boolean;
  /** Phiên ôn lại: cố định danh sách câu lúc bắt đầu. */
  fixedQuestionIds?: string[];
}

export function StudySession(props: StudySessionProps) {
  const hydrated = useHydrated();
  if (!hydrated) return <SessionSkeleton />;
  return <SessionInner {...props} />;
}

function SessionInner({ sessionKey, title, courseLabel, href, backHref, backLabel, questions, chapterTitles, isDemo, aiAvailable, fixedQuestionIds }: StudySessionProps) {
  const session = useStudyStore((s) => s.sessions[sessionKey]);
  const bookmarks = useStudyStore((s) => s.bookmarks);
  const { ensureSession, setCurrent, selectOption, confirmMcq, toggleBookmark, resetSession } = useStudyStore.getState();
  const [showGrid, setShowGrid] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ensureSession(sessionKey, { title, href, total: questions.length, questionIds: fixedQuestionIds });
  }, [ensureSession, sessionKey, title, href, questions.length, fixedQuestionIds]);

  const ids = useMemo(() => questions.map((q) => q.id), [questions]);
  const progress = sessionProgress(session, ids);
  const allDone = progress.total > 0 && progress.done === progress.total;

  const index = useMemo(() => {
    const byCurrent = session?.currentId ? ids.indexOf(session.currentId) : -1;
    if (byCurrent >= 0) return byCurrent;
    const firstOpen = ids.findIndex((id) => !isAnswerDone(session?.answers[id]));
    return firstOpen >= 0 ? firstOpen : 0;
  }, [session, ids]);

  const q = questions[index];
  const answer = q ? session?.answers[q.id] : undefined;

  const goTo = useCallback(
    (i: number) => {
      const target = questions[Math.max(0, Math.min(i, questions.length - 1))];
      if (target) setCurrent(sessionKey, target.id);
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [questions, sessionKey, setCurrent],
  );

  const goNext = useCallback(() => {
    if (index < questions.length - 1) return goTo(index + 1);
    const firstOpen = ids.findIndex((id) => !isAnswerDone(session?.answers[id]));
    if (firstOpen >= 0) goTo(firstOpen);
    else topRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [goTo, ids, index, questions.length, session]);

  const confirm = useCallback(() => {
    if (!q || q.type !== "mcq" || answer?.kind !== "mcq" || !answer.selected || answer.confirmed) return;
    confirmMcq(sessionKey, q.id, gradeMcq(q, answer.selected).isCorrect);
  }, [answer, confirmMcq, q, sessionKey]);

  // Phím tắt: A–D / 1–4 chọn, Enter xác nhận / câu tiếp, ← → chuyển câu
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT" || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey || !q) return;
      if (q.type === "mcq" && !(answer?.kind === "mcq" && answer.confirmed)) {
        const k = e.key.toUpperCase();
        const byNum = /^[1-8]$/.test(k) ? q.options[Number(k) - 1]?.id : undefined;
        const opt = q.options.find((o) => o.id === k)?.id ?? byNum;
        if (opt) {
          selectOption(sessionKey, q.id, opt);
          return;
        }
      }
      if (e.key === "Enter") {
        if (q.type === "mcq" && answer?.kind === "mcq" && !answer.confirmed && answer.selected) confirm();
        else if (isAnswerDone(answer)) goNext();
      } else if (e.key === "ArrowRight") goTo(index + 1);
      else if (e.key === "ArrowLeft") goTo(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [answer, confirm, goNext, goTo, index, q, selectOption, sessionKey]);

  if (!q) {
    return (
      <Callout tone="info" title="Không có câu hỏi">
        Chương này chưa có câu hỏi nào. <Link href={backHref} className="underline">Quay lại</Link>
      </Callout>
    );
  }

  const bookmarked = Boolean(bookmarks[q.id]);
  const mcqDone = q.type === "mcq" && answer?.kind === "mcq" && answer.confirmed;

  return (
    <div ref={topRef} className="mx-auto max-w-3xl scroll-mt-20">
      {/* Đầu trang */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link href={backHref} className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-primary">
          <ArrowLeft className="size-4 shrink-0" />
          <span className="truncate">{backLabel}</span>
        </Link>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (window.confirm("Ôn lại từ đầu? Các câu đã làm trong phiên này sẽ được làm lại (thống kê tổng vẫn giữ).")) resetSession(sessionKey);
          }}
        >
          <RotateCcw /> <span className="hidden sm:inline">Ôn lại từ đầu</span>
        </Button>
      </div>

      <div className="mb-4">
        <p className="text-xs font-medium text-muted">{courseLabel}</p>
        <h1 className="mt-0.5 text-lg font-bold leading-snug sm:text-xl">{title}</h1>
      </div>

      <AnimatePresence>{allDone && <CompletionCard progress={progress} onRestart={() => resetSession(sessionKey)} backHref={backHref} />}</AnimatePresence>

      <Card className="p-4 sm:p-6">
        {/* Thanh tiến độ + điều hướng */}
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold">
            Câu <span className="text-primary">{index + 1}</span>
            <span className="text-muted">/{questions.length}</span>
          </p>
          <div className="flex items-center gap-1">
            {questions.some((x) => x.courseId === "it006") && <MipsReferenceButton />}
            <Button variant="ghost" size="sm" onClick={() => setShowGrid((v) => !v)} aria-expanded={showGrid}>
              <LayoutGrid /> <span className="hidden sm:inline">Danh sách câu</span>
            </Button>
            <Button
              variant={bookmarked ? "soft" : "ghost"}
              size="sm"
              onClick={() => toggleBookmark(q.id)}
              aria-pressed={bookmarked}
              title={bookmarked ? "Bỏ đánh dấu" : "Đánh dấu để xem lại"}
            >
              {bookmarked ? <BookmarkCheck /> : <Bookmark />}
              <span className="hidden sm:inline">{bookmarked ? "Đã đánh dấu" : "Đánh dấu"}</span>
            </Button>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Progress value={pct(progress.done, progress.total)} label="Tiến độ phiên ôn tập" />
          <span className="shrink-0 text-xs tabular-nums text-muted">
            {progress.done}/{progress.total}
          </span>
        </div>

        <AnimatePresence initial={false}>
          {showGrid && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden">
              <QuestionGrid
                ids={ids}
                answers={session?.answers ?? {}}
                bookmarks={bookmarks}
                current={index}
                onPick={(i) => {
                  goTo(i);
                  setShowGrid(false);
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Câu hỏi */}
        <motion.div key={q.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
          <div className="mt-5 flex flex-wrap items-center gap-1.5">
            <Badge variant="muted">{q.type === "mcq" ? "Trắc nghiệm" : "Tự luận"}</Badge>
            {chapterTitles[q.chapterId] && fixedQuestionIds && <Badge variant="outline">{chapterTitles[q.chapterId]}</Badge>}
            {q.difficulty && <Badge variant="outline">{DIFFICULTY_LABEL[q.difficulty]}</Badge>}
            {(isDemo || q.source.kind === "demo") && (
              <Badge variant="secondary">
                <FlaskConical /> Minh họa
              </Badge>
            )}
            {q.source.kind === "authored" && <Badge variant="outline">Soạn từ lý thuyết</Badge>}
            {q.source.kind === "original" && q.courseId === "it006" && <Badge variant="default">Câu trong đề</Badge>}
            {q.verification !== "verified" && (
              <Badge variant="warning">
                <ShieldAlert /> Chưa xác minh
              </Badge>
            )}
          </div>

          <RichContent className="mt-3 text-base sm:text-[17px]">{q.content}</RichContent>

          <div className="mt-5">
            {q.type === "mcq" ? (
              <McqBlock
                question={q}
                answer={answer}
                onSelect={(opt) => selectOption(sessionKey, q.id, opt)}
                onConfirm={confirm}
                onNext={goNext}
                isLast={index === questions.length - 1}
              />
            ) : (
              <EssayPanel key={q.id} sessionKey={sessionKey} question={q} answer={answer?.kind === "essay" ? answer : undefined} aiAvailable={aiAvailable} onNext={goNext} />
            )}
          </div>
        </motion.div>

        {/* Điều hướng câu */}
        <div className="mt-6 flex items-center justify-between gap-2 border-t border-border pt-4">
          <Button variant="outline" onClick={() => goTo(index - 1)} disabled={index === 0}>
            <ChevronLeft /> Câu trước
          </Button>
          {!mcqDone && q.type === "mcq" && (
            <Button variant="ghost" onClick={() => goTo(index + 1)} disabled={index === questions.length - 1}>
              Bỏ qua <ChevronRight />
            </Button>
          )}
          {(mcqDone || q.type === "essay") && (
            <Button variant="outline" onClick={() => goTo(index + 1)} disabled={index === questions.length - 1}>
              Câu sau <ChevronRight />
            </Button>
          )}
        </div>
      </Card>
      <p className="mt-3 hidden text-center text-xs text-muted sm:block">Phím tắt: A–D chọn đáp án · Enter xác nhận / câu tiếp theo · ← → chuyển câu</p>
    </div>
  );
}

function McqBlock({
  question,
  answer,
  onSelect,
  onConfirm,
  onNext,
  isLast,
}: {
  question: Extract<Question, { type: "mcq" }>;
  answer: StudyAnswer | undefined;
  onSelect: (id: string) => void;
  onConfirm: () => void;
  onNext: () => void;
  isLast: boolean;
}) {
  const a = answer?.kind === "mcq" ? answer : undefined;
  const confirmed = Boolean(a?.confirmed);
  const selected = a?.selected ?? null;

  const stateOf = (id: string): OptionState => {
    if (!confirmed) return selected === id ? "selected" : "idle";
    if (id === question.correctOptionId) return selected === id ? "correct" : "reveal";
    if (id === selected) return "wrong";
    return "dimmed";
  };

  return (
    <div>
      <div role="radiogroup" aria-label="Các phương án trả lời" className="space-y-2.5">
        {question.options.map((o) => (
          <OptionCard key={o.id} id={o.id} content={o.content} state={stateOf(o.id)} disabled={confirmed} onSelect={() => onSelect(o.id)} />
        ))}
      </div>

      {!confirmed ? (
        <Button size="lg" className="mt-5 w-full sm:w-auto sm:min-w-44" disabled={!selected} onClick={onConfirm}>
          Xác nhận
        </Button>
      ) : (
        <div className="mt-5 space-y-4">
          <McqFeedback question={question} selected={selected!} correct={Boolean(a?.correct)} />
          <Button size="lg" className="w-full sm:w-auto sm:min-w-44" onClick={onNext}>
            {isLast ? "Hoàn tất" : "Câu tiếp theo"} <ArrowRight />
          </Button>
        </div>
      )}
    </div>
  );
}

function QuestionGrid({
  ids,
  answers,
  bookmarks,
  current,
  onPick,
}: {
  ids: string[];
  answers: Record<string, StudyAnswer>;
  bookmarks: Record<string, number>;
  current: number;
  onPick: (i: number) => void;
}) {
  return (
    <div className="mt-4 rounded-xl bg-subtle p-3">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(2.5rem,1fr))] gap-1.5">
        {ids.map((id, i) => {
          const a = answers[id];
          const state =
            a?.kind === "mcq" && a.confirmed
              ? a.correct
                ? "correct"
                : "wrong"
              : a?.kind === "essay" && a.status === "done"
                ? "done"
                : a
                  ? "draft"
                  : "none";
          return (
            <button
              key={id}
              type="button"
              onClick={() => onPick(i)}
              aria-label={`Câu ${i + 1}`}
              aria-current={i === current ? "step" : undefined}
              className={cn(
                "relative flex h-10 items-center justify-center rounded-lg border text-sm font-semibold tabular-nums transition-colors",
                state === "correct" && "border-success/30 bg-success-soft text-green-700",
                state === "wrong" && "border-error/30 bg-error-soft text-red-700",
                state === "done" && "border-primary/30 bg-primary-soft text-primary",
                state === "draft" && "border-primary/30 bg-surface text-primary",
                state === "none" && "border-border bg-surface text-muted hover:border-primary/40",
                i === current && "ring-2 ring-primary ring-offset-1",
              )}
            >
              {i + 1}
              {bookmarks[id] && <span className="absolute right-1 top-1 size-1.5 rounded-full bg-warning" />}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
        <Legend className="bg-success-soft border-success/30" label="Đúng" />
        <Legend className="bg-error-soft border-error/30" label="Sai" />
        <Legend className="bg-primary-soft border-primary/30" label="Đã làm (tự luận)" />
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-warning" /> Đã đánh dấu
        </span>
      </div>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("size-3 rounded border", className)} />
      {label}
    </span>
  );
}

function CompletionCard({ progress, onRestart, backHref }: { progress: ReturnType<typeof sessionProgress>; onRestart: () => void; backHref: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-4">
      <Card className="border-success/25 bg-gradient-to-br from-success-soft to-surface p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-success text-primary-foreground">
            <PartyPopper className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Bạn đã hoàn thành phiên ôn tập!</p>
            <p className="mt-0.5 text-sm text-muted">
              Đúng {progress.correct}/{progress.graded} câu đã chấm ({pct(progress.correct, progress.graded)}%).
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" asChild>
                <Link href="/da-luu?tab=sai">Xem câu từng sai</Link>
              </Button>
              <Button size="sm" variant="outline" onClick={onRestart}>
                <RotateCcw /> Ôn lại từ đầu
              </Button>
              <Button size="sm" variant="ghost" asChild>
                <Link href={backHref}>Chọn chương khác</Link>
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

function SessionSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-4" aria-busy>
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-7 w-72" />
      <Card className="space-y-4 p-6">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-2 w-full" />
        <Skeleton className="h-20 w-full" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </Card>
    </div>
  );
}

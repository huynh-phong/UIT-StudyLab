"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, Calculator, ChevronLeft, ChevronRight, Clock, Flag, FlaskConical, LayoutGrid, Loader2, Send, Sparkles, X } from "lucide-react";
import type { ExamResult, PublicExamQuestion } from "@/lib/exam/types";
import { useExamStore, type ActiveExam } from "@/lib/store/exam";
import { useHydrated, useNow } from "@/lib/hooks";
import { postJson } from "@/lib/api-client";
import { RichContent } from "@/components/rich-content";
import { OptionCard } from "@/components/question/option-card";
import { LogoMark } from "@/components/logo";
import { MipsReferenceButton } from "@/components/mips-reference";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Callout, EmptyState, Skeleton, Textarea } from "@/components/ui/misc";
import { SymbolKeyboard } from "@/components/symbol-keyboard";
import { Progress } from "@/components/ui/progress";
import { cn, formatDuration, formatScore } from "@/lib/utils";

/** Đang chuyển sang trang kết quả sau khi nộp — tránh nháy màn hình "không có bài thi". */
let redirectingAfterSubmit = false;

const isAnswered = (a: ActiveExam, q: PublicExamQuestion) => {
  const r = a.responses[q.id];
  return q.type === "mcq" ? Boolean(r?.optionId) : Boolean(r?.text?.trim());
};

export function ExamRoom() {
  const hydrated = useHydrated();
  const active = useExamStore((s) => s.active);
  if (!hydrated || (!active && redirectingAfterSubmit))
    return (
      <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
        <Skeleton className="h-14 w-full rounded-2xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  if (!active)
    return (
      <div className="mx-auto max-w-lg p-6 pt-20">
        <EmptyState
          icon={<Clock />}
          title="Không có bài thi đang làm"
          description="Hãy tạo một đề thi thử mới hoặc xem lại kết quả trong lịch sử."
          action={
            <Button asChild>
              <Link href="/thi-thu">Đến trang Thi thử</Link>
            </Button>
          }
        />
      </div>
    );
  return <Room key={active.exam.attemptId} active={active} />;
}

function Room({ active }: { active: ActiveExam }) {
  const router = useRouter();
  const { answer, toggleMark, setCurrent } = useExamStore.getState();
  const exam = active.exam;
  const now = useNow(1000);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submittedRef = useRef(false);
  const answerRef = useRef<HTMLTextAreaElement>(null);

  const q = exam.questions[active.current];
  const timeLeft = exam.deadline ? Math.max(0, Math.floor((exam.deadline - now) / 1000)) : null;
  const expired = timeLeft === 0;
  const answeredCount = exam.questions.filter((x) => isAnswered(active, x)).length;
  const markedCount = Object.keys(active.marked).length;

  const submit = async (auto: boolean) => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    setSubmitError(null);
    setConfirmOpen(false);
    const latest = useExamStore.getState().active;
    if (!latest) return;
    try {
      const res = await postJson<{ result: ExamResult }>(
        "/api/exam/submit",
        {
          token: latest.exam.token,
          responses: latest.responses,
          startedAt: latest.startedAt,
          submittedAt: Date.now(),
          autoSubmitted: auto,
        },
        90_000,
      );
      redirectingAfterSubmit = true;
      const attempt = useExamStore.getState().finish(res.result);
      router.replace(attempt ? `/thi-thu/ket-qua/${attempt.id}` : "/thi-thu");
      setTimeout(() => (redirectingAfterSubmit = false), 3000);
    } catch (e) {
      submittedRef.current = false;
      setSubmitting(false);
      setSubmitError(e instanceof Error ? e.message : "Nộp bài thất bại.");
    }
  };

  // Tự động nộp khi hết giờ (kể cả khi mở lại trang sau hạn)
  const onExpired = useEffectEvent(() => {
    if (!submittedRef.current && !submitError) void submit(true);
  });
  useEffect(() => {
    if (expired) onExpired();
  }, [expired, submitError]);

  const go = (i: number) => {
    setCurrent(i);
    setNavOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const navigator = (
    <QuestionNavigator active={active} onPick={go} answeredCount={answeredCount} markedCount={markedCount} />
  );

  return (
    <div className="pb-24 lg:pb-10">
      {/* Thanh trên phòng thi */}
      <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <LogoMark className="hidden size-8 sm:block" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold sm:text-base">{exam.title}</p>
            <p className="text-xs text-muted">
              {exam.courseCode} · Câu {active.current + 1}/{exam.questions.length}
            </p>
          </div>
          {exam.courseCode === "IT006" && <MipsReferenceButton />}
          <Timer timeLeft={timeLeft} startedAt={active.startedAt} now={now} />
          <Button onClick={() => setConfirmOpen(true)} disabled={submitting} className="hidden sm:inline-flex">
            <Send /> Nộp bài
          </Button>
        </div>
        <Progress value={(answeredCount / exam.questions.length) * 100} className="h-1 rounded-none" label="Số câu đã trả lời" />
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 pt-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_288px]">
        <div className="min-w-0 space-y-4">
          {(exam.isDemo || exam.warnings.length > 0) && active.current === 0 && (
            <div className="space-y-2">
              {exam.isDemo && (
                <Callout tone="demo" icon={<FlaskConical />} title="Đề minh họa">
                  Đề được tạo từ dữ liệu minh họa để kiểm tra chức năng, không phải đề thi chính thức.
                </Callout>
              )}
              {exam.warnings.map((w, i) => (
                <Callout key={i} tone="warning" icon={<AlertTriangle />}>
                  {w}
                </Callout>
              ))}
            </div>
          )}

          <Card className="p-4 sm:p-6">
            <motion.div key={q.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-semibold">Câu {active.current + 1}</span>
                  <Badge variant="muted">{q.type === "mcq" ? "Trắc nghiệm" : "Tự luận"}</Badge>
                  <Badge variant="outline">{formatScore(q.points)} điểm</Badge>
                  {q.origin === "ai_generated" && (
                    <Badge variant="default">
                      <Sparkles /> AI tạo
                    </Badge>
                  )}
                  {q.origin === "generated" && (
                    <Badge variant="secondary">
                      <Calculator /> Bài tính toán mới
                    </Badge>
                  )}
                </div>
                <Button
                  variant={active.marked[q.id] ? "soft" : "ghost"}
                  size="sm"
                  onClick={() => toggleMark(q.id)}
                  aria-pressed={Boolean(active.marked[q.id])}
                  className={cn(active.marked[q.id] && "bg-warning-soft text-amber-700 hover:bg-warning-soft-hover")}
                >
                  <Flag /> {active.marked[q.id] ? "Đã đánh dấu" : "Đánh dấu xem lại"}
                </Button>
              </div>
              <p className="mt-1 text-xs text-muted">{q.chapterTitle}</p>

              <RichContent className="mt-4 text-base sm:text-[17px]">{q.content}</RichContent>

              <div className="mt-5">
                {q.type === "mcq" ? (
                  <div role="radiogroup" aria-label="Các phương án" className="space-y-2.5">
                    {q.options!.map((o) => (
                      <OptionCard
                        key={o.id}
                        id={o.id}
                        content={o.content}
                        state={active.responses[q.id]?.optionId === o.id ? "selected" : "idle"}
                        disabled={expired || submitting}
                        onSelect={() => answer(q.id, { optionId: active.responses[q.id]?.optionId === o.id ? null : o.id })}
                      />
                    ))}
                    <p className="pt-1 text-xs text-muted">Nhấn lại phương án đã chọn để bỏ chọn. Có thể đổi đáp án tới khi nộp bài.</p>
                  </div>
                ) : (
                  <div>
                    {q.keyboard && (
                      <SymbolKeyboard
                        kind={q.keyboard}
                        textareaRef={answerRef}
                        value={active.responses[q.id]?.text ?? ""}
                        disabled={expired || submitting}
                        className="mb-2"
                        onChange={(next) => answer(q.id, { text: next })}
                      />
                    )}
                    <Textarea
                      ref={answerRef}
                      value={active.responses[q.id]?.text ?? ""}
                      onChange={(e) => answer(q.id, { text: e.target.value })}
                      maxLength={8000}
                      disabled={expired || submitting}
                      placeholder={q.placeholder ?? "Nhập câu trả lời của bạn…"}
                      spellCheck={q.answerFormat !== "code"}
                      aria-label={`Câu trả lời câu ${active.current + 1}`}
                      className={cn("min-h-56", q.answerFormat === "code" && "font-mono text-sm")}
                    />
                    <p className="mt-1 text-right text-xs text-muted">{(active.responses[q.id]?.text ?? "").length}/8000 ký tự · tự động lưu</p>
                  </div>
                )}
              </div>
            </motion.div>

            <div className="mt-6 flex items-center justify-between gap-2 border-t border-border pt-4">
              <Button variant="outline" onClick={() => go(active.current - 1)} disabled={active.current === 0}>
                <ChevronLeft /> Câu trước
              </Button>
              {active.current < exam.questions.length - 1 ? (
                <Button onClick={() => go(active.current + 1)}>
                  Câu tiếp <ChevronRight />
                </Button>
              ) : (
                <Button onClick={() => setConfirmOpen(true)} disabled={submitting}>
                  <Send /> Nộp bài
                </Button>
              )}
            </div>
          </Card>

          {submitError && (
            <Callout tone="error" title="Nộp bài chưa thành công">
              {submitError} Bài làm của bạn vẫn được lưu trên trình duyệt.
              <div className="mt-2">
                <Button size="sm" variant="danger" onClick={() => submit(expired)}>
                  Thử nộp lại
                </Button>
              </div>
            </Callout>
          )}
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-24">{navigator}</div>
        </aside>
      </div>

      {/* Thanh dưới (mobile) */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t border-border bg-surface/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
        <Button variant="outline" className="flex-1" onClick={() => setNavOpen(true)}>
          <LayoutGrid /> Danh sách câu ({answeredCount}/{exam.questions.length})
        </Button>
        <Button onClick={() => setConfirmOpen(true)} disabled={submitting}>
          <Send /> Nộp bài
        </Button>
      </div>

      <AnimatePresence>
        {navOpen && (
          <>
            <motion.div className="fixed inset-0 z-40 bg-slate-900/30 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setNavOpen(false)} />
            <motion.div
              role="dialog"
              aria-label="Danh sách câu hỏi"
              className="fixed inset-x-0 bottom-0 z-50 max-h-[75dvh] overflow-y-auto rounded-t-3xl bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl lg:hidden"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 400, damping: 40 }}
            >
              <div className="mb-2 flex items-center justify-between">
                <p className="font-semibold">Danh sách câu hỏi</p>
                <Button variant="ghost" size="icon" onClick={() => setNavOpen(false)} aria-label="Đóng">
                  <X />
                </Button>
              </div>
              {navigator}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogTitle>Nộp bài thi?</DialogTitle>
          <DialogDescription>Sau khi nộp, bạn không thể sửa đáp án.</DialogDescription>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <Stat label="Đã trả lời" value={answeredCount} tone="text-primary" />
            <Stat label="Chưa trả lời" value={exam.questions.length - answeredCount} tone={answeredCount < exam.questions.length ? "text-red-600" : "text-foreground"} />
            <Stat label="Đánh dấu" value={markedCount} tone="text-amber-600" />
          </div>
          {answeredCount < exam.questions.length && (
            <Callout tone="warning" icon={<AlertTriangle />} className="mt-4">
              Bạn còn {exam.questions.length - answeredCount} câu chưa trả lời.
            </Callout>
          )}
          {markedCount > 0 && <p className="mt-3 text-sm text-muted">Bạn đang đánh dấu {markedCount} câu để xem lại.</p>}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Tiếp tục làm bài
            </Button>
            <Button onClick={() => submit(false)}>
              <Send /> Nộp bài
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AnimatePresence>
        {submitting && (
          <motion.div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 p-6 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Card role="status" aria-live="polite" className="w-full max-w-sm p-6 text-center">
              <Loader2 className="mx-auto size-8 animate-spin text-primary" />
              <p className="mt-3 font-semibold">{expired ? "Hết giờ — đang tự động nộp bài…" : "Đang chấm bài…"}</p>
              <p className="mt-1 text-sm text-muted">
                {exam.questions.some((x) => x.type === "essay") ? "Phần tự luận được AI chấm theo rubric, có thể mất tới 30 giây." : "Chỉ mất vài giây."}
              </p>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Timer({ timeLeft, startedAt, now }: { timeLeft: number | null; startedAt: number; now: number }) {
  if (timeLeft === null)
    return (
      <div className="flex items-center gap-1.5 rounded-xl bg-subtle px-3 py-2 text-sm font-semibold tabular-nums text-muted" title="Thời gian đã làm">
        <Clock className="size-4" /> {formatDuration((now - startedAt) / 1000)}
      </div>
    );
  const danger = timeLeft <= 60;
  const warn = timeLeft <= 300;
  return (
    <div
      role="timer"
      aria-label={`Thời gian còn lại ${formatDuration(timeLeft)}`}
      className={cn(
        "flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold tabular-nums transition-colors",
        danger ? "animate-pulse bg-error-soft text-red-700" : warn ? "bg-warning-soft text-amber-700" : "bg-primary-soft text-primary",
      )}
    >
      <Clock className="size-4" /> {formatDuration(timeLeft)}
    </div>
  );
}

function QuestionNavigator({ active, onPick, answeredCount, markedCount }: { active: ActiveExam; onPick: (i: number) => void; answeredCount: number; markedCount: number }) {
  const qs = active.exam.questions;
  return (
    <Card className="p-4">
      <p className="mb-3 hidden text-sm font-semibold lg:block">Danh sách câu hỏi</p>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(2.5rem,1fr))] gap-1.5">
        {qs.map((q, i) => {
          const answered = isAnswered(active, q);
          const marked = Boolean(active.marked[q.id]);
          return (
            <button
              key={q.id}
              type="button"
              onClick={() => onPick(i)}
              aria-label={`Câu ${i + 1}${answered ? ", đã trả lời" : ", chưa trả lời"}${marked ? ", đã đánh dấu" : ""}`}
              aria-current={i === active.current ? "step" : undefined}
              className={cn(
                "relative flex h-10 items-center justify-center rounded-lg border text-sm font-semibold tabular-nums transition-colors duration-150",
                answered ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface text-muted hover:border-primary/40",
                i === active.current && "ring-2 ring-primary/40 ring-offset-2",
              )}
            >
              {i + 1}
              {marked && <Flag className="absolute -right-1 -top-1 size-3.5 fill-warning text-warning" />}
            </button>
          );
        })}
      </div>
      <div className="mt-4 space-y-1.5 text-xs text-muted">
        <p className="flex items-center gap-2">
          <span className="size-3 rounded bg-primary" /> Đã trả lời ({answeredCount})
        </p>
        <p className="flex items-center gap-2">
          <span className="size-3 rounded border border-border bg-surface" /> Chưa trả lời ({qs.length - answeredCount})
        </p>
        <p className="flex items-center gap-2">
          <Flag className="size-3 fill-warning text-warning" /> Đánh dấu xem lại ({markedCount})
        </p>
      </div>
    </Card>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl bg-subtle py-3">
      <p className={cn("text-2xl font-bold tabular-nums", tone)}>{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  AlertTriangle,
  ArrowLeft,
  Calculator,
  CheckCircle2,
  CircleSlash,
  Clock,
  Flag,
  FlaskConical,
  Hourglass,
  RefreshCw,
  RotateCcw,
  Sparkles,
  XCircle,
} from "lucide-react";
import type { GradedQuestion } from "@/lib/exam/types";
import type { EssayGradeState } from "@/lib/grading/types";
import { isEssayPending } from "@/lib/exam/scoring";
import { useExamStore, type ExamAttempt } from "@/lib/store/exam";
import { useHydrated } from "@/lib/hooks";
import { postJson } from "@/lib/api-client";
import { RichContent } from "@/components/rich-content";
import { OptionCard, type OptionState } from "@/components/question/option-card";
import { McqFeedback } from "@/components/question/mcq-feedback";
import { AIGradingLoader, EssayResultView } from "@/components/question/essay-result";
import { AnimatedNumber } from "@/components/stat";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Callout, EmptyState, Skeleton, Textarea } from "@/components/ui/misc";
import { Progress } from "@/components/ui/progress";
import { cn, formatDateTime, formatDuration, formatScore, pct } from "@/lib/utils";

type Filter = "all" | "wrong" | "blank" | "pending";

export function ResultView({ attemptId }: { attemptId: string }) {
  const hydrated = useHydrated();
  const attempt = useExamStore((s) => s.history.find((h) => h.id === attemptId));
  if (!hydrated)
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  if (!attempt)
    return (
      <EmptyState
        icon={<AlertTriangle />}
        title="Không tìm thấy bài thi"
        description="Kết quả thi được lưu trên trình duyệt đã làm bài. Có thể bài thi đã bị xóa khỏi lịch sử."
        action={
          <Button asChild>
            <Link href="/thi-thu">Về trang Thi thử</Link>
          </Button>
        }
      />
    );
  return <Result attempt={attempt} />;
}

function Result({ attempt }: { attempt: ExamAttempt }) {
  const r = attempt.result;
  const [filter, setFilter] = useState<Filter>(r.counts.wrong > 0 ? "wrong" : "all");
  const pending = r.questions.filter((g) => g.question.type === "essay" && g.response?.text?.trim() && isEssayPending(g.essay));

  const shown = useMemo(
    () =>
      r.questions.filter((g) => {
        if (filter === "all") return true;
        if (filter === "pending") return g.question.type === "essay" && g.response?.text?.trim() && isEssayPending(g.essay);
        if (filter === "blank") return g.mcq ? g.mcq.blank : g.essay?.status === "blank";
        if (g.mcq) return !g.mcq.blank && !g.mcq.isCorrect;
        return g.essay?.status === "graded" && g.essay.score < g.essay.maxScore / 2;
      }),
    [filter, r.questions],
  );

  return (
    <div className="space-y-6">
      <div>
        <Link href="/thi-thu" className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-primary">
          <ArrowLeft className="size-4" /> Thi thử
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">{attempt.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted">
          <span>{formatDateTime(attempt.submittedAt)}</span>
          <span>·</span>
          <span>Mã phiên: {attempt.id.slice(0, 8)}</span>
          <span>·</span>
          <span>Phiên bản đề: {attempt.version}</span>
          {attempt.isDemo && (
            <Badge variant="secondary">
              <FlaskConical /> Minh họa
            </Badge>
          )}
          {attempt.composition.aiGenerated > 0 && (
            <Badge>
              <Sparkles /> {attempt.composition.aiGenerated} câu AI tạo
            </Badge>
          )}
          {(attempt.composition.generated ?? 0) > 0 && (
            <Badge variant="secondary">
              <Calculator /> {attempt.composition.generated} bài tính toán sinh tự động
            </Badge>
          )}
        </div>
      </div>

      {/* Điểm */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="overflow-hidden">
          <div className="grid gap-0 sm:grid-cols-[minmax(0,240px)_1fr]">
            <div className={cn("flex flex-col items-center justify-center p-6 text-center", r.gradingStatus === "complete" ? "bg-primary-soft" : "bg-warning-soft")}>
              {r.gradingStatus === "complete" && r.score10 !== null ? (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">Điểm (thang 10)</p>
                  <p className="mt-1 text-5xl font-bold text-primary">
                    <AnimatedNumber value={r.score10} decimals={r.score10 % 1 === 0 ? 0 : 2} />
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {formatScore(r.totalScore!)}/{formatScore(r.totalMax)} điểm
                  </p>
                </>
              ) : (
                <>
                  <Hourglass className="size-8 text-amber-600" />
                  <p className="mt-2 font-semibold text-amber-800">Chưa có điểm tổng</p>
                  <p className="mt-1 text-sm text-amber-800/80">Còn {r.counts.pendingEssay} câu tự luận chưa chấm được. Điểm trắc nghiệm đã được lưu.</p>
                </>
              )}
            </div>
            <div className="space-y-4 p-5 sm:p-6">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Mini icon={<CheckCircle2 className="text-green-600" />} label="Đúng" value={r.counts.correct} />
                <Mini icon={<XCircle className="text-red-600" />} label="Sai" value={r.counts.wrong} />
                <Mini icon={<CircleSlash className="text-muted" />} label="Bỏ trống" value={r.counts.blank} />
                <Mini icon={<Clock className="text-primary" />} label="Thời gian" value={formatDuration(r.durationSec)} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <ScoreLine label="Trắc nghiệm" score={r.mcqScore} max={r.mcqMax} />
                {r.essayMax > 0 && <ScoreLine label="Tự luận" score={r.essayScore} max={r.essayMax} pending={r.counts.pendingEssay > 0} />}
              </div>
              {r.autoSubmitted && <p className="text-xs text-muted">Bài được tự động nộp khi hết giờ.</p>}
            </div>
          </div>
        </Card>
      </motion.div>

      {pending.length > 0 && <RegradeAll attempt={attempt} pending={pending} />}

      {attempt.warnings.length > 0 && (
        <div className="space-y-2">
          {attempt.warnings.map((w, i) => (
            <Callout key={i} tone="warning" icon={<AlertTriangle />}>
              {w}
            </Callout>
          ))}
        </div>
      )}

      {/* Theo chương */}
      <section>
        <h2 className="mb-3 text-base font-semibold">Kết quả theo chương</h2>
        <Card className="divide-y divide-border">
          {r.chapters.map((c) => (
            <div key={c.chapterId} className="p-4 sm:px-5">
              <div className="flex items-center justify-between gap-3">
                <p className="min-w-0 truncate text-sm font-medium">{c.chapterTitle}</p>
                <p className="shrink-0 text-sm font-semibold tabular-nums">
                  {formatScore(c.score)}/{formatScore(c.maxScore)}
                </p>
              </div>
              <Progress value={pct(c.score, c.maxScore)} className="mt-2 h-1.5" barClassName={pct(c.score, c.maxScore) >= 50 ? "bg-success" : "bg-error"} />
              <p className="mt-1.5 text-xs text-muted">
                {c.correct} đúng · {c.wrong} sai · {c.blank} trống{c.pending ? ` · ${c.pending} chờ chấm` : ""}
              </p>
            </div>
          ))}
        </Card>
      </section>

      {/* Xem lại */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Xem lại đề, đáp án và giải thích</h2>
          <div className="flex flex-wrap gap-1 rounded-xl bg-subtle p-1" role="tablist">
            {(
              [
                ["all", `Tất cả (${r.counts.total})`],
                ["wrong", `Câu sai (${r.counts.wrong})`],
                ["blank", `Bỏ trống (${r.counts.blank})`],
                ...(r.counts.pendingEssay ? [["pending", `Chờ chấm (${r.counts.pendingEssay})`]] : []),
              ] as [Filter, string][]
            ).map(([k, label]) => (
              <button
                key={k}
                role="tab"
                aria-selected={filter === k}
                onClick={() => setFilter(k)}
                className={cn("rounded-lg px-3 py-1.5 text-xs font-medium transition-colors", filter === k ? "bg-surface text-primary shadow-sm" : "text-muted hover:text-foreground")}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          {shown.length === 0 && <p className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center text-sm text-muted">Không có câu nào trong mục này.</p>}
          {shown.map((g) => (
            <ReviewCard key={g.question.id} g={g} attempt={attempt} />
          ))}
        </div>
      </section>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button asChild size="lg">
          <Link href="/thi-thu">
            <RotateCcw /> Thi thử đề mới
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/on-tap">Ôn tập theo chương</Link>
        </Button>
      </div>
    </div>
  );
}

function Mini({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-subtle px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[11px] text-muted [&_svg]:size-3.5">
        {icon}
        {label}
      </p>
      <p className="mt-0.5 text-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}

function ScoreLine({ label, score, max, pending }: { label: string; score: number; max: number; pending?: boolean }) {
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span className="text-muted">{label}</span>
        <span className="font-semibold tabular-nums">
          {formatScore(score)}/{formatScore(max)}
          {pending && <span className="ml-1 text-xs font-normal text-amber-600">(chưa đủ)</span>}
        </span>
      </div>
      <Progress value={pct(score, max)} className="mt-1.5 h-1.5" />
    </div>
  );
}

function useRegrade(attempt: ExamAttempt) {
  const updateEssay = useExamStore((s) => s.updateEssay);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const regrade = async (g: GradedQuestion) => {
    const text = g.response?.text?.trim();
    if (!text || busy[g.question.id]) return;
    setBusy((b) => ({ ...b, [g.question.id]: true }));
    try {
      const res = await postJson<{ state: EssayGradeState }>("/api/exam/grade-essay", { token: attempt.token, questionId: g.question.id, text });
      updateEssay(attempt.id, g.question.id, res.state);
    } catch (e) {
      updateEssay(attempt.id, g.question.id, { status: "failed", message: e instanceof Error ? e.message : "Chấm lại thất bại." });
    } finally {
      setBusy((b) => ({ ...b, [g.question.id]: false }));
    }
  };
  return { busy, regrade };
}

function RegradeAll({ attempt, pending }: { attempt: ExamAttempt; pending: GradedQuestion[] }) {
  const { busy, regrade } = useRegrade(attempt);
  const running = Object.values(busy).some(Boolean);
  return (
    <Callout tone="warning" icon={<Hourglass />} title={`${pending.length} câu tự luận chưa được chấm`}>
      <p>{pending[0].essay && "message" in pending[0].essay ? pending[0].essay.message : "AI chưa chấm được phần tự luận."} Bài làm đã được lưu; bạn có thể chấm lại.</p>
      <Button
        size="sm"
        variant="outline"
        className="mt-2 bg-surface"
        disabled={running}
        onClick={async () => {
          for (const g of pending) await regrade(g);
        }}
      >
        <RefreshCw className={cn(running && "animate-spin")} /> {running ? "Đang chấm lại…" : "Chấm lại tự luận"}
      </Button>
    </Callout>
  );
}

function ReviewCard({ g, attempt }: { g: GradedQuestion; attempt: ExamAttempt }) {
  const q = g.question;
  const { busy, regrade } = useRegrade(attempt);
  const status = g.mcq
    ? g.mcq.blank
      ? "blank"
      : g.mcq.isCorrect
        ? "correct"
        : "wrong"
    : g.essay?.status === "blank"
      ? "blank"
      : g.essay?.status === "graded"
        ? g.essay.score >= g.essay.maxScore / 2
          ? "correct"
          : "wrong"
        : "pending";
  const awarded = g.mcq ? g.mcq.awarded : g.essay?.status === "graded" ? g.essay.score : null;

  return (
    <Card className="p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              "flex size-7 items-center justify-center rounded-lg text-xs font-bold text-primary-foreground",
              status === "correct" ? "bg-success" : status === "wrong" ? "bg-error" : status === "pending" ? "bg-warning" : "bg-slate-400",
            )}
          >
            {g.index + 1}
          </span>
          <Badge variant="muted">{q.type === "mcq" ? "Trắc nghiệm" : "Tự luận"}</Badge>
          <Badge variant="outline">{g.chapterTitle}</Badge>
          {q.source.kind === "ai_generated" && (
            <Badge>
              <Sparkles /> AI tạo · chưa có người duyệt
            </Badge>
          )}
          {q.source.kind === "generated" && (
            <Badge variant="secondary">
              <Calculator /> Sinh tự động · đáp án tính bằng code
            </Badge>
          )}
        </div>
        <span className="text-sm font-semibold tabular-nums">
          {awarded === null ? "—" : formatScore(awarded)}/{formatScore(g.points)} điểm
        </span>
      </div>

      <RichContent className="mt-4 text-[15px] sm:text-base">{q.content}</RichContent>

      <div className="mt-4 space-y-3">
        {q.type === "mcq" && g.mcq && (
          <>
            <div className="space-y-2">
              {q.options.map((o) => {
                const state: OptionState =
                  o.id === q.correctOptionId ? (g.mcq!.selected === o.id ? "correct" : "reveal") : o.id === g.mcq!.selected ? "wrong" : "dimmed";
                return <OptionCard key={o.id} id={o.id} content={o.content} state={state} disabled />;
              })}
            </div>
            {g.mcq.blank ? (
              <>
                <Callout tone="info" icon={<CircleSlash />} title={`Bạn bỏ trống câu này. Đáp án đúng: ${q.correctOptionId}`} />
                <div className="rounded-2xl border border-border bg-subtle p-4">
                  <RichContent className="text-[15px]">{q.explanation.whyCorrect ?? q.explanation.correct}</RichContent>
                </div>
              </>
            ) : (
              <McqFeedback question={q} selected={g.mcq.selected!} correct={g.mcq.isCorrect} savedNote={false} />
            )}
          </>
        )}

        {q.type === "essay" && (
          <>
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Bài làm của bạn</p>
              {g.response?.text?.trim() ? (
                <div className="whitespace-pre-wrap rounded-xl border border-border bg-subtle px-4 py-3 text-[15px] leading-relaxed">{g.response.text}</div>
              ) : (
                <p className="text-sm text-muted">(Bỏ trống)</p>
              )}
            </div>
            {busy[q.id] ? (
              <AIGradingLoader label="AI đang chấm lại câu này…" />
            ) : (
              g.essay && <EssayResultView state={g.essay} fallbackModelAnswer={q.essay?.modelAnswer} />
            )}
            {status === "pending" && !busy[q.id] && (
              <Button variant="outline" size="sm" onClick={() => regrade(g)}>
                <RefreshCw /> Chấm lại câu này
              </Button>
            )}
          </>
        )}
      </div>

      <div className="mt-4 flex justify-end">
        <ReportButton questionId={q.id} token={attempt.token} />
      </div>
    </Card>
  );
}

const REASONS = [
  ["wrong_answer", "Đáp án/lời giải sai"],
  ["ambiguous", "Có nhiều đáp án đúng / đề mơ hồ"],
  ["out_of_scope", "Ngoài phạm vi kiến thức"],
  ["typo", "Lỗi chính tả, định dạng"],
  ["other", "Khác"],
] as const;

function ReportButton({ questionId, token }: { questionId: string; token: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REASONS)[number][0]>("wrong_answer");
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  const send = async () => {
    setState("sending");
    try {
      await postJson("/api/report", { questionId, token, reason, note: note.trim() || undefined });
      setState("sent");
      setTimeout(() => setOpen(false), 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gửi thất bại");
      setState("error");
    }
  };

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} disabled={state === "sent"}>
        <Flag /> {state === "sent" ? "Đã báo lỗi" : "Báo lỗi câu hỏi"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Báo lỗi câu hỏi</DialogTitle>
          <DialogDescription>Câu bị báo lỗi sẽ được đánh dấu để người quản trị xác minh và tạm ngừng dùng nếu bị báo nhiều lần.</DialogDescription>
          <div className="mt-4 space-y-2" role="radiogroup">
            {REASONS.map(([k, label]) => (
              <label key={k} className={cn("flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm", reason === k ? "border-primary bg-primary-soft" : "border-border")}>
                <input type="radio" name="reason" value={k} checked={reason === k} onChange={() => setReason(k)} className="accent-primary" />
                {label}
              </label>
            ))}
          </div>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="Mô tả thêm (không bắt buộc)" className="mt-3 min-h-20" />
          {state === "error" && <p className="mt-2 text-sm text-red-600">{error}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Hủy
            </Button>
            <Button onClick={send} disabled={state === "sending" || state === "sent"}>
              {state === "sent" ? "Đã gửi" : state === "sending" ? "Đang gửi…" : "Gửi báo lỗi"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

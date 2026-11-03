"use client";

import { motion } from "motion/react";
import { AlertTriangle, CheckCircle2, ChevronDown, CircleSlash, FileText, Lightbulb, MinusCircle, Sparkles, XCircle } from "lucide-react";
import type { EssayGradeState } from "@/lib/grading/types";
import { RichContent } from "@/components/rich-content";
import { Progress } from "@/components/ui/progress";
import { Callout } from "@/components/ui/misc";
import { formatScore, pct } from "@/lib/utils";

/** Trạng thái chờ riêng cho AI. */
export function AIGradingLoader({ label = "AI đang đọc và chấm bài của bạn…" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="rounded-2xl border border-primary/15 bg-primary-soft/50 p-5">
      <div className="flex items-center gap-2.5 text-sm font-medium text-primary">
        <motion.span animate={{ rotate: [0, 15, -10, 0], scale: [1, 1.12, 1] }} transition={{ duration: 1.6, repeat: Infinity }}>
          <Sparkles className="size-5" />
        </motion.span>
        {label}
      </div>
      <div className="mt-4 space-y-2.5">
        <div className="skeleton h-3 w-11/12 rounded-full" />
        <div className="skeleton h-3 w-9/12 rounded-full" />
        <div className="skeleton h-3 w-10/12 rounded-full" />
      </div>
      <p className="mt-3 text-xs text-muted">Thường mất 5–20 giây. Đừng đóng trang.</p>
    </div>
  );
}

export function ModelAnswer({ text, defaultOpen = false }: { text: string; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="group rounded-xl border border-border bg-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold">
        <span className="flex items-center gap-2">
          <FileText className="size-4 text-primary" /> Đáp án mẫu
        </span>
        <ChevronDown className="size-4 text-muted transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-border px-4 py-3">
        <RichContent className="text-[15px]">{text}</RichContent>
      </div>
    </details>
  );
}

export function EssayResultView({ state, fallbackModelAnswer }: { state: EssayGradeState; fallbackModelAnswer?: string }) {
  if (state.status === "blank") return <Callout tone="warning" icon={<CircleSlash />} title="Bỏ trống" />;
  if (state.status !== "graded") {
    const tone = state.status === "failed" ? "error" : "warning";
    const title =
      state.status === "insufficient_reference"
        ? "Chưa thể chấm: thiếu đáp án mẫu/rubric đã xác minh"
        : state.status === "unavailable"
          ? "Chấm AI chưa khả dụng"
          : "Chưa chấm được câu này";
    return (
      <div className="space-y-3">
        <Callout tone={tone} icon={<AlertTriangle />} title={title}>
          {state.message}
        </Callout>
        {fallbackModelAnswer && <ModelAnswer text={fallbackModelAnswer} />}
      </div>
    );
  }

  const ratio = pct(state.score, state.maxScore);
  const perfect = state.score >= state.maxScore;
  const tone = perfect ? "text-green-600" : ratio >= 50 ? "text-primary" : "text-red-600";
  const bar = perfect ? "bg-success" : ratio >= 50 ? "bg-primary" : "bg-error";
  const verdict = perfect
    ? { title: "Chính xác!", note: "Bài làm đạt đủ các ý theo đáp án.", cls: "border-success/25 bg-success-soft text-green-700", icon: <CheckCircle2 className="size-5" /> }
    : ratio >= 50
      ? { title: "Gần đúng — còn điểm cần sửa", note: "Xem các điểm sai và ý còn thiếu bên dưới.", cls: "border-primary/20 bg-primary-soft text-primary", icon: <AlertTriangle className="size-5" /> }
      : { title: "Chưa chính xác!", note: "Xem các điểm sai và ý còn thiếu bên dưới.", cls: "border-error/20 bg-error-soft text-red-700", icon: <XCircle className="size-5" /> };
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-4" aria-live="polite">
      <div className={`rounded-2xl border px-4 py-3 ${verdict.cls}`}>
        <p className="flex items-center gap-2 font-semibold">
          {verdict.icon} {verdict.title}
        </p>
        <p className="mt-0.5 pl-7 text-sm opacity-90">{verdict.note}</p>
      </div>

      {!perfect && <PointList icon={<XCircle className="size-4 text-red-600" />} title="Điểm sai cần sửa" items={state.incorrectPoints} empty="Không có ý sai; bài làm chủ yếu còn thiếu ý." />}
      {!perfect && <PointList icon={<MinusCircle className="size-4 text-amber-600" />} title="Ý còn thiếu" items={state.missingPoints} empty="Không thiếu ý quan trọng." />}

      <div className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Điểm tham khảo (AI chấm)</p>
            <p className={`mt-1 text-3xl font-bold tabular-nums ${tone}`}>
              {formatScore(state.score)}
              <span className="text-lg font-medium text-muted">/{formatScore(state.maxScore)}</span>
            </p>
          </div>
          {state.offTopic && (
            <span className="rounded-full bg-error-soft px-2.5 py-1 text-xs font-medium text-red-700">Bài làm lạc đề</span>
          )}
        </div>
        <Progress value={ratio} className="mt-3" barClassName={bar} />
        <div className="mt-4 divide-y divide-border rounded-xl border border-border">
          {state.rubric.map((r) => (
            <div key={r.id} className="flex gap-3 px-3.5 py-2.5 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{r.criterion}</p>
                <p className="mt-0.5 text-muted">{r.comment}</p>
              </div>
              <span className="shrink-0 font-semibold tabular-nums">
                {formatScore(r.awarded)}/{formatScore(r.max)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <PointList icon={<CheckCircle2 className="size-4 text-green-600" />} title="Ý đã trả lời đúng" items={state.correctPoints} empty="Chưa có ý nào đạt yêu cầu." />

      <div className="rounded-xl bg-subtle px-4 py-3.5">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Nhận xét</p>
        <RichContent className="text-[15px]">{state.feedback}</RichContent>
      </div>
      {state.suggestions.length > 0 && (
        <div className="flex gap-2.5 rounded-xl border border-warning/25 bg-warning-soft px-4 py-3 text-sm text-amber-900">
          <Lightbulb className="mt-0.5 size-4 shrink-0" />
          <ul className="list-disc space-y-1 pl-4">
            {state.suggestions.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}
      <ModelAnswer text={state.modelAnswer} />
      <p className="text-xs text-muted">Điểm do AI chấm dựa trên rubric, chỉ mang tính tham khảo.</p>
    </motion.div>
  );
}

function PointList({ icon, title, items, empty }: { icon: React.ReactNode; title: string; items: string[]; empty: string }) {
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold">
        {icon}
        {title}
      </p>
      {items.length ? (
        <ul className="space-y-1.5 pl-6 text-[15px]">
          {items.map((x, i) => (
            <li key={i} className="list-disc marker:text-muted">
              <RichContent inline>{x}</RichContent>
            </li>
          ))}
        </ul>
      ) : (
        <p className="pl-6 text-sm text-muted">{empty}</p>
      )}
    </div>
  );
}

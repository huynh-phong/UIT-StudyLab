"use client";

import { motion } from "motion/react";
import { BookmarkPlus, CheckCircle2, Lightbulb, Link2, XCircle } from "lucide-react";
import type { McqQuestion } from "@/lib/bank/schema";
import { wrongFeedback } from "@/lib/grading/mcq";
import { RichContent } from "@/components/rich-content";

/** Phản hồi sau khi xác nhận: ngắn gọn khi đúng, chi tiết và đúng với phương án đã chọn khi sai. */
export function McqFeedback({ question, selected, correct, savedNote = true }: { question: McqQuestion; selected: string; correct: boolean; savedNote?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      aria-live="polite"
    >
      {correct ? <CorrectPanel text={question.explanation.correct} /> : <WrongPanel question={question} selected={selected} savedNote={savedNote} />}
    </motion.div>
  );
}

function CorrectPanel({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-success/25 bg-success-soft p-4 sm:p-5">
      <p className="flex items-center gap-2 font-semibold text-green-700">
        <CheckCircle2 className="size-5" /> Chính xác!
      </p>
      <RichContent className="mt-2 text-[15px] text-green-950/85">{text}</RichContent>
    </div>
  );
}

function WrongPanel({ question, selected, savedNote }: { question: McqQuestion; selected: string; savedNote: boolean }) {
  const f = wrongFeedback(question, selected);
  return (
    <div className="overflow-hidden rounded-2xl border border-error/20 bg-surface">
      <div className="flex items-center justify-between gap-3 bg-error-soft px-4 py-3 sm:px-5">
        <p className="flex items-center gap-2 font-semibold text-red-700">
          <XCircle className="size-5" /> Chưa chính xác!
        </p>
        {savedNote && (
          <span className="flex items-center gap-1 text-xs font-medium text-red-700/80">
            <BookmarkPlus className="size-3.5" /> Đã lưu vào câu từng sai
          </span>
        )}
      </div>
      <div className="space-y-4 p-4 text-[15px] sm:p-5">
        <Section title="Đáp án chính xác">
          <div className="flex items-start gap-2.5 rounded-xl bg-success-soft px-3 py-2.5">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-success text-xs font-bold text-primary-foreground">{f.correctOptionId}</span>
            <RichContent inline className="min-w-0 flex-1">
              {f.correctContent}
            </RichContent>
          </div>
        </Section>
        <Section title={`Vì sao ${f.correctOptionId} đúng`}>
          <RichContent>{f.whyCorrect}</RichContent>
        </Section>
        <Section title={`Vì sao phương án ${selected} bạn chọn chưa đúng`}>
          <RichContent>{f.whySelectedWrong ?? "Phương án này không thỏa yêu cầu của câu hỏi. Đối chiếu với lời giải của đáp án đúng ở trên để thấy điểm khác biệt."}</RichContent>
        </Section>
        {f.related && (
          <Section title="Kiến thức liên quan" icon={<Link2 className="size-3.5" />}>
            <RichContent>{f.related}</RichContent>
          </Section>
        )}
        {f.tip && (
          <div className="flex gap-2.5 rounded-xl border border-warning/25 bg-warning-soft px-3.5 py-3 text-amber-900">
            <Lightbulb className="mt-0.5 size-4 shrink-0" />
            <RichContent className="min-w-0 flex-1 text-sm">{`**Ghi nhớ:** ${f.tip}`}</RichContent>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
        {icon}
        {title}
      </p>
      {children}
    </div>
  );
}

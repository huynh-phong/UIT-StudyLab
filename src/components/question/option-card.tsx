"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, X } from "lucide-react";
import { RichContent } from "@/components/rich-content";
import { cn } from "@/lib/utils";

export type OptionState = "idle" | "selected" | "correct" | "wrong" | "dimmed" | "reveal";

const styles: Record<OptionState, { card: string; key: string }> = {
  idle: { card: "border-border bg-surface hover:border-primary/40 hover:bg-primary-soft/40", key: "bg-subtle text-muted group-hover:bg-primary-soft group-hover:text-primary" },
  selected: { card: "border-primary bg-primary-soft ring-4 ring-primary/10", key: "bg-primary text-white" },
  correct: { card: "border-success bg-success-soft ring-4 ring-success/10", key: "bg-success text-white" },
  wrong: { card: "border-error/70 bg-error-soft", key: "bg-error text-white" },
  /** đáp án đúng được đánh dấu khi người dùng chọn sai */
  reveal: { card: "border-success bg-success-soft/70", key: "bg-success text-white" },
  dimmed: { card: "border-border bg-surface opacity-60", key: "bg-subtle text-muted" },
};

export function OptionCard({
  id,
  content,
  state,
  disabled,
  onSelect,
}: {
  id: string;
  content: string;
  state: OptionState;
  disabled?: boolean;
  onSelect?: () => void;
}) {
  const s = styles[state];
  const icon = state === "correct" || state === "reveal" ? "check" : state === "wrong" ? "x" : null;
  return (
    <motion.button
      type="button"
      role="radio"
      aria-checked={state === "selected" || state === "correct" || state === "wrong"}
      aria-label={`Phương án ${id}`}
      disabled={disabled}
      onClick={onSelect}
      whileTap={disabled ? undefined : { scale: 0.985 }}
      className={cn(
        "group flex min-h-14 w-full items-start gap-3 rounded-xl border-2 px-3.5 py-3 text-left transition-[background-color,border-color,box-shadow,opacity] duration-200 sm:gap-4 sm:px-4",
        s.card,
        disabled ? "cursor-default" : "cursor-pointer",
      )}
    >
      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold transition-colors duration-200", s.key)}>{id}</span>
      <RichContent inline className="min-w-0 flex-1 pt-1 text-[15px] leading-relaxed">
        {content}
      </RichContent>
      <AnimatePresence>
        {icon && (
          <motion.span
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 25 }}
            className={cn("mt-1 flex size-6 shrink-0 items-center justify-center rounded-full text-white", icon === "check" ? "bg-success" : "bg-error")}
          >
            {icon === "check" ? <Check className="size-4" strokeWidth={3} /> : <X className="size-4" strokeWidth={3} />}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

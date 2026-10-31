"use client";

import { useEffect, useRef } from "react";
import { animate, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export function AnimatedNumber({ value, suffix = "", decimals = 0 }: { value: number; suffix?: string; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fmt = (n: number) => `${n.toFixed(decimals).replace(".", ",")}${suffix}`;
    if (reduce) {
      el.textContent = fmt(value);
      prev.current = value;
      return;
    }
    const controls = animate(prev.current, value, {
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => (el.textContent = fmt(v)),
    });
    prev.current = value;
    return () => controls.stop();
  }, [value, suffix, decimals, reduce]);
  return (
    <span ref={ref} className="tabular-nums">
      {`0${suffix}`}
    </span>
  );
}

export function StatCard({
  icon,
  label,
  value,
  hint,
  tone = "primary",
  delay = 0,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: "primary" | "secondary" | "success" | "warning";
  delay?: number;
}) {
  const tones = {
    primary: "bg-primary-soft text-primary",
    secondary: "bg-secondary-soft text-teal-600",
    success: "bg-success-soft text-green-600",
    warning: "bg-warning-soft text-amber-600",
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-card)] sm:p-5"
    >
      <div className={cn("mb-3 flex size-9 items-center justify-center rounded-xl [&_svg]:size-[18px]", tones[tone])}>{icon}</div>
      <p className="text-xs font-medium text-muted sm:text-sm">{label}</p>
      <p className="mt-0.5 text-2xl font-bold tracking-tight sm:text-[26px]">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </motion.div>
  );
}

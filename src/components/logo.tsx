import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("size-9", className)} aria-hidden>
      <rect width="40" height="40" rx="11" fill="#2563EB" />
      <path d="M13 14.5v7.2a7 7 0 0 0 14 0v-7.2" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" />
      <circle cx="13" cy="12" r="2.6" fill="#5EEAD4" />
      <circle cx="27" cy="12" r="2.6" fill="#5EEAD4" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="leading-tight">
        <span className="block text-[15px] font-bold tracking-tight text-foreground">UIT StudyLab</span>
        <span className="block text-[11px] font-medium text-muted">Ôn tập &amp; thi thử</span>
      </span>
    </span>
  );
}

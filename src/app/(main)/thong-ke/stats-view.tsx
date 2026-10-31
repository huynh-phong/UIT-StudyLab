"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Bookmark, CheckCircle2, ListChecks, Target, Trophy, XCircle } from "lucide-react";
import type { ExamSummary } from "@/lib/bank/repo";
import { useStudyStore } from "@/lib/store/study";
import { useExamStore } from "@/lib/store/exam";
import { useHydrated } from "@/lib/hooks";
import { computeChapterProgress, overallStats } from "@/lib/progress";
import { AnimatedNumber, StatCard } from "@/components/stat";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader, Skeleton } from "@/components/ui/misc";
import { Progress } from "@/components/ui/progress";
import { cn, formatDateTime, formatScore, pct } from "@/lib/utils";

export function StatsView({ exams }: { exams: ExamSummary[] }) {
  const hydrated = useHydrated();
  const sessions = useStudyStore((s) => s.sessions);
  const stats = useStudyStore((s) => s.stats);
  const bookmarks = useStudyStore((s) => s.bookmarks);
  const wrong = useStudyStore((s) => s.wrong);
  const history = useExamStore((s) => s.history);
  const clearAll = useStudyStore((s) => s.clearAll);

  if (!hydrated)
    return (
      <div>
        <PageHeader title="Thống kê học tập" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      </div>
    );

  const scope = new Set(exams.flatMap((e) => e.chapters.flatMap((c) => c.questionIds)));
  const o = overallStats(stats, scope);
  const chapters = computeChapterProgress(exams, sessions);
  const recent = [...history].slice(0, 10).reverse();

  return (
    <div className="space-y-8">
      <PageHeader title="Thống kê học tập" description="Dữ liệu được lưu trên trình duyệt này và chỉ bạn nhìn thấy." />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={<ListChecks />} label="Tổng số câu đã làm" value={<AnimatedNumber value={o.attempted} />} hint={`${o.totalAttempts} lượt trả lời`} />
        <StatCard icon={<CheckCircle2 />} label="Trả lời đúng" tone="success" value={<AnimatedNumber value={o.correctLast} />} hint="Theo lần trả lời gần nhất" delay={0.04} />
        <StatCard icon={<XCircle />} label="Trả lời sai" tone="warning" value={<AnimatedNumber value={o.wrongLast} />} hint={`${Object.keys(wrong).length} câu trong danh sách sai`} delay={0.08} />
        <StatCard icon={<Target />} label="Tỉ lệ chính xác" tone="secondary" value={o.attempted ? <AnimatedNumber value={pct(o.correctLast, o.attempted)} suffix="%" /> : "—"} hint={`${Object.keys(bookmarks).length} câu đã đánh dấu`} delay={0.12} />
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold">Tiến độ và độ chính xác theo chương</h2>
        <Card className="divide-y divide-border">
          {chapters.length === 0 && <p className="p-5 text-sm text-muted">Chưa có chương nào.</p>}
          {chapters.map((c) => (
            <Link key={`${c.examKey}:${c.chapterId}`} href={c.href} className="grid gap-3 p-4 transition-colors hover:bg-subtle/50 sm:grid-cols-[minmax(0,1fr)_200px_200px] sm:items-center sm:px-5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{c.title}</p>
                {c.isDemo && <Badge variant="secondary" className="mt-1">Minh họa</Badge>}
              </div>
              <Bar label="Tiến độ" value={pct(c.done, c.total)} text={`${c.done}/${c.total}`} />
              <Bar label="Đúng" value={pct(c.correct, c.graded)} text={c.graded ? `${pct(c.correct, c.graded)}%` : "—"} tone={c.graded ? (pct(c.correct, c.graded) >= 50 ? "bg-success" : "bg-error") : "bg-subtle"} />
            </Link>
          ))}
        </Card>
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
          <Trophy className="size-4 text-amber-500" /> Lịch sử thi thử
        </h2>
        {history.length === 0 ? (
          <EmptyState icon={<Trophy />} title="Chưa có bài thi thử" action={<Button asChild><Link href="/thi-thu">Thi thử ngay</Link></Button>} />
        ) : (
          <Card className="p-5">
            <p className="mb-4 text-xs text-muted">Điểm (thang 10) của tối đa 10 lần thi gần nhất</p>
            <div className="flex h-44 items-end gap-2 sm:gap-3" role="img" aria-label="Biểu đồ điểm các lần thi gần nhất">
              {recent.map((h, i) => {
                const s = h.result.score10;
                return (
                  <Link key={h.id} href={`/thi-thu/ket-qua/${h.id}`} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
                    <span className="text-xs font-semibold tabular-nums text-muted group-hover:text-primary">{s === null ? "…" : formatScore(s)}</span>
                    <motion.div
                      className={cn("w-full max-w-10 rounded-t-lg", s === null ? "bg-warning/40" : s >= 5 ? "bg-primary group-hover:bg-primary-hover" : "bg-error/70")}
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.max(4, ((s ?? 0) / 10) * 100)}%` }}
                      transition={{ duration: 0.5, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
                      title={`${h.title} — ${formatDateTime(h.submittedAt)}`}
                    />
                    <span className="text-[10px] tabular-nums text-muted">#{history.length - (recent.length - 1 - i)}</span>
                  </Link>
                );
              })}
            </div>
          </Card>
        )}
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-border p-4">
        <p className="flex items-center gap-2 text-sm text-muted">
          <Bookmark className="size-4" /> Muốn bắt đầu lại từ đầu? Xóa toàn bộ tiến độ ôn tập trên trình duyệt này (không xóa lịch sử thi).
        </p>
        <Button
          variant="ghost"
          className="text-red-600 hover:bg-error-soft hover:text-red-700"
          onClick={() => window.confirm("Xóa toàn bộ tiến độ ôn tập, đánh dấu và danh sách câu sai? Không thể hoàn tác.") && clearAll()}
        >
          Xóa tiến độ ôn tập
        </Button>
      </section>
    </div>
  );
}

function Bar({ label, value, text, tone = "bg-primary" }: { label: string; value: number; text: string; tone?: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-muted">
        <span>{label}</span>
        <span className="tabular-nums">{text}</span>
      </div>
      <Progress value={value} className="h-1.5" barClassName={tone} />
    </div>
  );
}

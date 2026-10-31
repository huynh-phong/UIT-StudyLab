"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, BookOpenCheck, CheckCircle2, CircleDot, FlaskConical, ListChecks, PlayCircle, Target, Timer, Trophy } from "lucide-react";
import type { ExamSummary } from "@/lib/bank/repo";
import { EXAM_TYPE_LABEL } from "@/lib/bank/schema";
import type { FeatureFlags } from "@/lib/server/env";
import { useStudyStore } from "@/lib/store/study";
import { useExamStore } from "@/lib/store/exam";
import { useHydrated } from "@/lib/hooks";
import { computeChapterProgress, overallStats } from "@/lib/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Callout, Skeleton } from "@/components/ui/misc";
import { AnimatedNumber, StatCard } from "@/components/stat";
import { LogoMark } from "@/components/logo";
import { formatDateTime, formatScore, pct } from "@/lib/utils";

export function DashboardView({ exams, features }: { exams: ExamSummary[]; features: FeatureFlags }) {
  const hydrated = useHydrated();
  const sessions = useStudyStore((s) => s.sessions);
  const stats = useStudyStore((s) => s.stats);
  const history = useExamStore((s) => s.history);
  const activeExam = useExamStore((s) => s.active);

  const chapters = computeChapterProgress(exams, sessions);
  const totalQuestions = chapters.reduce((a, c) => a + c.total, 0);
  const doneQuestions = chapters.reduce((a, c) => a + c.done, 0);
  const scope = new Set(exams.flatMap((e) => e.chapters.flatMap((c) => c.questionIds)));
  const overall = overallStats(stats, scope);
  const accuracy = pct(overall.correctLast, overall.attempted);
  const lastExam = history[0];
  const continueChapter = chapters.filter((c) => c.started && c.done < c.total).sort((a, b) => b.updatedAt - a.updatedAt)[0];
  const hasDemo = exams.some((e) => e.isDemo);
  const realExam = exams.find((e) => !e.isDemo);
  const current = realExam ?? exams[0];

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section>
        <Card className="relative overflow-hidden p-6 sm:p-8">
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-primary-soft" />
          <div aria-hidden className="pointer-events-none absolute -bottom-24 right-24 size-48 rounded-full bg-secondary-soft/70" />
          <div className="relative">
            <div className="mb-5 flex items-center gap-3">
              <LogoMark className="size-11" />
              <div>
                <h1 className="text-xl font-bold tracking-tight sm:text-2xl">UIT StudyLab</h1>
                <p className="text-sm text-muted">Ôn tập thông minh — hiểu vì sao đúng, vì sao sai</p>
              </div>
            </div>
            <p className="max-w-xl text-[15px] leading-relaxed text-foreground/80">
              Làm trực tiếp các câu hỏi trong bộ đề, xem giải thích ngay sau mỗi câu và thi thử theo cấu trúc đề chuẩn.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="bg-surface py-1 text-foreground">
                <BookOpenCheck /> {current ? `${current.courseCode} — ${current.courseName}` : "Chưa có học phần"}
              </Badge>
              {current && (
                <Badge variant="secondary" className="py-1">
                  <CircleDot /> {EXAM_TYPE_LABEL[current.examType]}
                </Badge>
              )}
            </div>
            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/on-tap">
                  <BookOpenCheck /> Ôn tập
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/thi-thu">
                  <Timer /> Thi thử
                </Link>
              </Button>
            </div>
          </div>
        </Card>
      </section>

      {hasDemo && (
        <Callout tone="demo" icon={<FlaskConical />} title="Đang hiển thị dữ liệu minh họa">
          {realExam && realExam.chapters.length === 0
            ? "Ngân hàng đề IT005 giữa kỳ chưa được nạp. Các câu hỏi gắn nhãn “Minh họa” chỉ để kiểm tra chức năng, không phải đề thi chính thức."
            : "Các câu hỏi gắn nhãn “Minh họa” chỉ để kiểm tra chức năng, không phải đề thi chính thức."}
        </Callout>
      )}

      {/* Tiếp tục */}
      {hydrated && (activeExam || continueChapter) && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid gap-3 sm:grid-cols-2">
          {activeExam && (
            <ContinueCard
              href="/thi-thu/phong-thi"
              icon={<Timer />}
              label="Bài thi đang làm"
              title={activeExam.exam.title}
              meta={`${Object.keys(activeExam.responses).length}/${activeExam.exam.questions.length} câu đã trả lời`}
            />
          )}
          {continueChapter && (
            <ContinueCard
              href={continueChapter.href}
              icon={<PlayCircle />}
              label="Tiếp tục ôn tập"
              title={continueChapter.title}
              meta={`${continueChapter.done}/${continueChapter.total} câu`}
              progress={pct(continueChapter.done, continueChapter.total)}
            />
          )}
        </motion.div>
      )}

      {/* Thống kê */}
      <section aria-label="Thống kê nhanh" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {!hydrated ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[132px] rounded-2xl" />)
        ) : (
          <>
            <StatCard icon={<ListChecks />} label="Tiến độ ôn tập" value={<AnimatedNumber value={pct(doneQuestions, totalQuestions)} suffix="%" />} hint={`${doneQuestions}/${totalQuestions} câu`} />
            <StatCard icon={<CheckCircle2 />} label="Câu đã làm" tone="secondary" value={<AnimatedNumber value={overall.attempted} />} hint={`${overall.totalAttempts} lượt trả lời`} delay={0.04} />
            <StatCard
              icon={<Target />}
              label="Tỉ lệ đúng"
              tone="success"
              value={overall.attempted ? <AnimatedNumber value={accuracy} suffix="%" /> : "—"}
              hint={overall.attempted ? `${overall.correctLast} đúng · ${overall.wrongLast} sai (lần gần nhất)` : "Chưa có dữ liệu"}
              delay={0.08}
            />
            <StatCard
              icon={<Trophy />}
              label="Thi thử gần nhất"
              tone="warning"
              value={
                lastExam ? (
                  lastExam.result.score10 !== null ? (
                    <>
                      {formatScore(lastExam.result.score10)}
                      <span className="text-base font-medium text-muted">/10</span>
                    </>
                  ) : (
                    <span className="text-base font-semibold text-amber-600">Đang chờ chấm</span>
                  )
                ) : (
                  "—"
                )
              }
              hint={lastExam ? formatDateTime(lastExam.submittedAt) : "Chưa thi lần nào"}
              delay={0.12}
            />
          </>
        )}
      </section>

      {/* Tiến độ theo chương */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Tiến độ theo chương</h2>
          <Link href="/on-tap" className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            Tất cả <ArrowRight className="size-4" />
          </Link>
        </div>
        <Card className="divide-y divide-border">
          {chapters.length === 0 && <p className="p-5 text-sm text-muted">Chưa có chương nào. Hãy nạp bộ đề theo hướng dẫn trong README.</p>}
          {chapters.slice(0, 6).map((c) => (
            <Link key={`${c.examKey}:${c.chapterId}`} href={c.href} className="flex items-center gap-4 p-4 transition-colors hover:bg-subtle/60 sm:px-5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium">{c.title}</p>
                  {c.isDemo && <Badge variant="secondary">Minh họa</Badge>}
                </div>
                <div className="mt-2 flex items-center gap-3">
                  {hydrated ? <Progress value={pct(c.done, c.total)} className="h-1.5" label={`Tiến độ ${c.title}`} /> : <Skeleton className="h-1.5 w-full" />}
                  <span className="w-14 shrink-0 text-right text-xs tabular-nums text-muted">{hydrated ? `${c.done}/${c.total}` : ""}</span>
                </div>
              </div>
              <ArrowRight className="size-4 shrink-0 text-muted" />
            </Link>
          ))}
        </Card>
      </section>

      {!features.ai && (
        <Callout tone="info" title="Tính năng AI chưa được cấu hình">
          Chấm tự luận và tạo đề thi thử bằng AI cần khóa AI trên máy chủ (<code>GEMINI_API_KEY</code> + <code>GEMINI_MODEL</code> hoặc <code>OPENAI_API_KEY</code> + <code>OPENAI_MODEL</code>). Trắc nghiệm vẫn hoạt động đầy đủ.
        </Callout>
      )}
    </div>
  );
}

function ContinueCard({ href, icon, label, title, meta, progress }: { href: string; icon: React.ReactNode; label: string; title: string; meta: string; progress?: number }) {
  return (
    <Link href={href} className="group block">
      <Card className="flex items-center gap-4 p-4 transition-[box-shadow,transform,border-color] duration-200 group-hover:-translate-y-0.5 group-hover:border-primary/30 group-hover:shadow-[var(--shadow-card-hover)]">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-white [&_svg]:size-5">{icon}</div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-primary">{label}</p>
          <p className="truncate text-sm font-semibold">{title}</p>
          <p className="text-xs text-muted">{meta}</p>
          {progress !== undefined && <Progress value={progress} className="mt-2 h-1.5" />}
        </div>
        <ArrowRight className="size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
      </Card>
    </Link>
  );
}

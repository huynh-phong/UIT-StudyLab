"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, BookOpenCheck, CheckCircle2, Cpu, FlaskConical, ListChecks, Network, PlayCircle, Target, Timer, Trophy, Database } from "lucide-react";
import type { ExamSummary } from "@/lib/bank/repo";
import { EXAM_TYPE_LABEL } from "@/lib/bank/schema";
import type { FeatureFlags } from "@/lib/server/env";
import { useStudyStore } from "@/lib/store/study";
import { useExamStore } from "@/lib/store/exam";
import { useHydrated } from "@/lib/hooks";
import { computeChapterProgress, overallStats, type ChapterProgress } from "@/lib/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Callout, Skeleton } from "@/components/ui/misc";
import { AnimatedNumber, StatCard } from "@/components/stat";
import { LogoMark } from "@/components/logo";
import { formatDateTime, formatScore, pct } from "@/lib/utils";

const COURSE_ICON: Record<string, React.ReactNode> = { it004: <Database />, it005: <Network />, it006: <Cpu /> };

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
  const demoShown = exams.some((e) => e.isDemo);
  const withContent = exams.filter((e) => e.chapters.length > 0);

  return (
    <div className="space-y-6">
      <section>
        <Card className="relative overflow-hidden p-6 sm:p-8">
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-primary-soft" />
          <div aria-hidden className="pointer-events-none absolute -bottom-24 right-24 size-48 rounded-full bg-secondary-soft/70" />
          <div className="relative">
            <div className="mb-4 flex items-center gap-3">
              <LogoMark className="size-11" />
              <div>
                <h1 className="text-xl font-bold tracking-tight sm:text-2xl">UIT StudyLab</h1>
                <p className="text-sm text-muted">Ôn tập thông minh — hiểu vì sao đúng, vì sao sai</p>
              </div>
            </div>
            <p className="max-w-xl text-[15px] leading-relaxed text-foreground/80">
              Làm trực tiếp các câu hỏi trong bộ đề, xem giải thích ngay sau mỗi câu và thi thử theo cấu trúc đề chuẩn. Chọn học phần bên dưới để bắt đầu.
            </p>
          </div>
        </Card>
      </section>

      <section aria-labelledby="courses-heading">
        <h2 id="courses-heading" className="mb-3 text-base font-semibold">
          Học phần
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {withContent.map((exam, i) => (
            <CourseCard key={exam.key} exam={exam} chapters={chapters.filter((c) => c.examKey === exam.key)} hydrated={hydrated} index={i} />
          ))}
        </div>
      </section>

      {demoShown && (
        <Callout tone="demo" icon={<FlaskConical />} title="Đang hiển thị dữ liệu minh họa">
          Các câu hỏi gắn nhãn “Minh họa” chỉ để kiểm tra chức năng, không phải đề thi chính thức.
        </Callout>
      )}

      {hydrated && (activeExam || continueChapter) && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid gap-3 sm:grid-cols-2">
          {activeExam && (
            <ContinueCard
              href="/thi-thu/phong-thi"
              icon={<Timer />}
              label={`Bài thi đang làm · ${activeExam.exam.courseCode}`}
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
              hint={lastExam ? `${lastExam.courseCode} · ${formatDateTime(lastExam.submittedAt)}` : "Chưa thi lần nào"}
              delay={0.12}
            />
          </>
        )}
      </section>

      {!features.ai && (
        <Callout tone="info" title="Chấm tự luận bằng AI chưa được cấu hình">
          Chấm tự luận cần khóa AI trên máy chủ (<code>GEMINI_API_KEY</code> + <code>GEMINI_MODEL</code>). Trắc nghiệm vẫn hoạt động đầy đủ.
        </Callout>
      )}
    </div>
  );
}

function CourseCard({ exam, chapters, hydrated, index }: { exam: ExamSummary; chapters: ChapterProgress[]; hydrated: boolean; index: number }) {
  const total = chapters.reduce((a, c) => a + c.total, 0);
  const done = chapters.reduce((a, c) => a + c.done, 0);
  const history = useExamStore((s) => s.history);
  const last = history.find((h) => h.examKey === exam.key);
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, delay: index * 0.05 }} className="h-full">
      <Card className="flex h-full flex-col p-5 transition-[box-shadow,transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[var(--shadow-card-hover)] sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary [&_svg]:size-5">{COURSE_ICON[exam.courseId] ?? <BookOpenCheck />}</div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 className="font-bold tracking-tight">{exam.courseCode}</h3>
              <Badge variant="secondary">{EXAM_TYPE_LABEL[exam.examType]}</Badge>
              {exam.isDemo && <Badge variant="muted">Minh họa</Badge>}
            </div>
            <p className="mt-0.5 text-sm font-medium text-foreground/80">{exam.courseName}</p>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-1.5 flex justify-between text-xs text-muted">
            <span>
              {chapters.length} phần · {total} câu hỏi
            </span>
            <span className="tabular-nums">{hydrated ? `${done}/${total} đã làm` : ""}</span>
          </div>
          {hydrated ? <Progress value={pct(done, total)} label={`Tiến độ ${exam.courseCode}`} /> : <Skeleton className="h-2 w-full" />}
          <p className="mt-2 text-xs text-muted">
            {hydrated && last
              ? `Thi thử gần nhất: ${last.result.score10 !== null ? `${formatScore(last.result.score10)}/10` : "đang chờ chấm"} · ${formatDateTime(last.submittedAt)}`
              : "Chưa thi thử môn này"}
          </p>
        </div>

        <ul className="mt-3 space-y-1">
          {chapters.map((c) => (
            <li key={c.chapterId}>
              <Link href={c.href} className="group flex items-center gap-2 rounded-lg px-2 py-1 text-sm transition-colors hover:bg-subtle">
                <span className="min-w-0 flex-1 truncate text-foreground/80 group-hover:text-primary">{c.title}</span>
                <span className="shrink-0 text-xs tabular-nums text-muted">{hydrated ? `${c.done}/${c.total}` : c.total}</span>
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-auto flex gap-2 pt-4">
          <Button asChild className="flex-1">
            <Link href={`/on-tap?mon=${exam.courseId}`}>
              <BookOpenCheck /> Ôn tập
            </Link>
          </Button>
          <Button asChild variant="outline" className="flex-1">
            <Link href={`/thi-thu?mon=${exam.courseId}`}>
              <Timer /> Thi thử
            </Link>
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}

function ContinueCard({ href, icon, label, title, meta, progress }: { href: string; icon: React.ReactNode; label: string; title: string; meta: string; progress?: number }) {
  return (
    <Link href={href} className="group block">
      <Card className="flex items-center gap-4 p-4 transition-[box-shadow,transform,border-color] duration-200 group-hover:-translate-y-0.5 group-hover:border-primary/30 group-hover:shadow-[var(--shadow-card-hover)]">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground [&_svg]:size-5">{icon}</div>
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

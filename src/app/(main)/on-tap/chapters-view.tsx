"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, BookOpen, CheckCircle2, FlaskConical, Inbox, RotateCcw, Target } from "lucide-react";
import type { ExamSummary } from "@/lib/bank/repo";
import { EXAM_TYPE_LABEL } from "@/lib/bank/schema";
import { useStudyStore } from "@/lib/store/study";
import { useHydrated } from "@/lib/hooks";
import { chapterSessionKey, computeChapterProgress, type ChapterProgress } from "@/lib/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { EmptyState, PageHeader, Skeleton } from "@/components/ui/misc";
import { CourseTabs, uniqueCourses, useSelectedCourse } from "@/components/course-tabs";
import { pct } from "@/lib/utils";

export function ChaptersView({ exams }: { exams: ExamSummary[] }) {
  const hydrated = useHydrated();
  const sessions = useStudyStore((s) => s.sessions);
  const resetSession = useStudyStore((s) => s.resetSession);
  const courses = uniqueCourses(exams, (e) => ({ id: e.courseId, code: e.courseCode, name: e.courseName }));
  const selected = useSelectedCourse(courses);

  return (
    <div>
      <PageHeader title="Ôn tập theo chương" description="Chọn một chương để làm câu hỏi. Tiến độ của từng chương được lưu riêng trên trình duyệt này." />
      <CourseTabs courses={courses} selected={selected} />
      <div className="space-y-10">
        {exams.filter((e) => e.courseId === selected).map((exam) => {
          const chapters = computeChapterProgress([exam], sessions);
          return (
            <section key={exam.key} aria-labelledby={`exam-${exam.key}`}>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <h2 id={`exam-${exam.key}`} className="text-base font-semibold">
                  {exam.courseCode} — {exam.courseName}
                </h2>
                <Badge variant="muted">{EXAM_TYPE_LABEL[exam.examType]}</Badge>
                {exam.isDemo && (
                  <Badge variant="secondary">
                    <FlaskConical /> Dữ liệu minh họa
                  </Badge>
                )}
              </div>
              {exam.isDemo && exam.description && <p className="-mt-2 mb-4 text-sm text-muted">{exam.description}</p>}

              {chapters.length === 0 ? (
                <EmptyState
                  icon={<Inbox />}
                  title="Chưa có bộ đề"
                  description={
                    <>
                      Ngân hàng câu hỏi <b>{exam.title}</b> chưa được nạp. Danh sách chương sẽ xuất hiện khi bộ đề được thêm vào thư mục{" "}
                      <code className="rounded bg-subtle px-1">content/banks/{exam.courseId}/{exam.examType}</code>.
                    </>
                  }
                />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {chapters.map((c, i) => (
                    <ChapterCard
                      key={c.chapterId}
                      c={c}
                      index={i}
                      hydrated={hydrated}
                      onReset={() => {
                        if (window.confirm(`Ôn lại "${c.title}" từ đầu? Các câu đã làm trong chương sẽ được làm lại (thống kê tổng vẫn giữ).`))
                          resetSession(chapterSessionKey(exam.key, c.chapterId));
                      }}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function ChapterCard({ c, index, hydrated, onReset }: { c: ChapterProgress; index: number; hydrated: boolean; onReset: () => void }) {
  const progress = pct(c.done, c.total);
  const accuracy = pct(c.correct, c.graded);
  const finished = c.total > 0 && c.done >= c.total;
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, delay: Math.min(index * 0.04, 0.3) }}>
      <Card className="group flex h-full flex-col p-5 transition-[box-shadow,transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[var(--shadow-card-hover)]">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <BookOpen className="size-5" />
          </div>
          {hydrated && finished && (
            <Badge variant="success">
              <CheckCircle2 /> Hoàn thành
            </Badge>
          )}
        </div>
        <h3 className="font-semibold leading-snug">{c.title}</h3>
        {c.description && <p className="mt-1 line-clamp-2 text-sm text-muted">{c.description}</p>}

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Metric label="Tổng số câu" value={c.total} />
          <Metric label="Đã làm" value={hydrated ? c.done : null} />
          <Metric label="Tỉ lệ đúng" value={hydrated ? (c.graded ? `${accuracy}%` : "—") : null} icon={<Target className="size-3" />} />
        </div>

        <div className="mt-4">
          {hydrated ? <Progress value={progress} label={`Tiến độ ${c.title}`} /> : <Skeleton className="h-2 w-full" />}
        </div>

        <div className="mt-5 flex gap-2 pt-1">
          <Button asChild className="flex-1" variant={c.started && !finished ? "default" : finished ? "outline" : "default"}>
            <Link href={c.href} aria-disabled={c.total === 0}>
              {!hydrated || !c.started ? "Bắt đầu ôn tập" : finished ? "Xem lại" : "Tiếp tục"}
              <ArrowRight />
            </Link>
          </Button>
          {hydrated && c.started && (
            <Button variant="ghost" size="icon" onClick={onReset} title="Ôn lại chương từ đầu" aria-label={`Ôn lại ${c.title} từ đầu`}>
              <RotateCcw />
            </Button>
          )}
        </div>
      </Card>
    </motion.div>
  );
}

function Metric({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-subtle px-2 py-2">
      <p className="text-base font-semibold tabular-nums">{value ?? <Skeleton className="mx-auto h-5 w-8" />}</p>
      <p className="flex items-center justify-center gap-1 text-[11px] text-muted">
        {icon}
        {label}
      </p>
    </div>
  );
}

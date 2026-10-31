import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { examSlug, findExam, studyQuestions } from "@/lib/bank/repo";
import { EXAM_TYPE_LABEL } from "@/lib/bank/schema";
import { getFeatureFlags } from "@/lib/server/env";
import { chapterSessionKey } from "@/lib/session-keys";
import { StudySession } from "@/components/study/study-session";

export const dynamic = "force-dynamic";

type Params = Promise<{ courseId: string; examSlug: string; chapterId: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const p = await params;
  const exam = findExam(p.courseId, p.examSlug);
  const chapter = exam?.chapters.find((c) => c.id === p.chapterId);
  return { title: chapter ? `${chapter.title} — Ôn tập` : "Ôn tập" };
}

export default async function ChapterStudyPage({ params }: { params: Params }) {
  const p = await params;
  const exam = findExam(p.courseId, p.examSlug);
  const chapter = exam?.chapters.find((c) => c.id === p.chapterId);
  if (!exam || !chapter) notFound();

  const questions = studyQuestions(exam, chapter.id);
  return (
    <StudySession
      sessionKey={chapterSessionKey(exam.key, chapter.id)}
      title={chapter.title}
      courseLabel={`${exam.course.code} — ${exam.course.name} · ${EXAM_TYPE_LABEL[exam.examType]}`}
      href={`/on-tap/${exam.courseId}/${examSlug(exam)}/${chapter.id}`}
      backHref="/on-tap"
      backLabel="Danh sách chương"
      questions={questions}
      chapterTitles={Object.fromEntries(exam.chapters.map((c) => [c.id, c.title]))}
      isDemo={exam.isDemo}
      aiAvailable={getFeatureFlags().ai}
    />
  );
}

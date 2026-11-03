import type { Metadata } from "next";
import { Suspense } from "react";
import { visibleExams } from "@/lib/bank/repo";
import { isExamEligible } from "@/lib/bank/schema";
import { getFeatureFlags } from "@/lib/server/env";
import { ExamLanding, type ExamOffer } from "./exam-landing";

export const metadata: Metadata = { title: "Thi thử" };
export const dynamic = "force-dynamic";

export default function ExamPage() {
  const offers: ExamOffer[] = visibleExams().map((e) => {
    const bp = e.blueprint;
    const chapterTitle = (id: string) => e.chapters.find((c) => c.id === id)?.title ?? id;
    return {
      key: e.key,
      courseId: e.courseId,
      courseCode: e.course.code,
      courseName: e.course.name,
      examType: e.examType,
      title: e.title,
      isDemo: e.isDemo,
      chapterCount: e.chapters.length,
      blueprint: bp
        ? {
            title: bp.title,
            status: bp.status,
            sourceNote: bp.sourceNote,
            durationMinutes: bp.durationMinutes,
            totalQuestions: bp.slots.reduce((a, s) => a + s.count, 0),
            mcqCount: bp.slots.filter((s) => s.type === "mcq").reduce((a, s) => a + s.count, 0),
            essayCount: bp.slots.filter((s) => s.type === "essay").reduce((a, s) => a + s.count, 0),
            totalPoints: bp.slots.reduce((a, s) => a + s.count * s.pointsEach, 0),
            slots: bp.slots.map((s) => {
              const chapters = [s.chapterId, ...(s.alsoFrom ?? [])];
              const available = e.questions.filter((q) => chapters.includes(q.chapterId) && q.type === s.type && isExamEligible(q)).length;
              return { chapterTitle: chapters.map(chapterTitle).join(" / "), type: s.type, count: s.count, pointsEach: s.pointsEach, bankAvailable: available };
            }),
          }
        : null,
    };
  });
  return (
    <Suspense>
      <ExamLanding offers={offers} features={getFeatureFlags()} />
    </Suspense>
  );
}

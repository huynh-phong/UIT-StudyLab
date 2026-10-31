import type { Metadata } from "next";
import { studyQuestions, visibleExams } from "@/lib/bank/repo";
import { getFeatureFlags } from "@/lib/server/env";
import { ReviewSession } from "./review-session";

export const metadata: Metadata = { title: "Ôn lại câu đã lưu" };
export const dynamic = "force-dynamic";

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ nguon?: string }> }) {
  const { nguon } = await searchParams;
  const source = nguon === "sai" ? "sai" : "danh-dau";
  const exams = visibleExams();
  return (
    <ReviewSession
      source={source}
      questions={exams.flatMap((e) => studyQuestions(e))}
      chapterTitles={Object.fromEntries(exams.flatMap((e) => e.chapters.map((c) => [c.id, c.title])))}
      aiAvailable={getFeatureFlags().ai}
    />
  );
}

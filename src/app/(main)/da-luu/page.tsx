import type { Metadata } from "next";
import { Suspense } from "react";
import { studyQuestions, visibleExams } from "@/lib/bank/repo";
import { SavedView, type SavedItem } from "./saved-view";

export const metadata: Metadata = { title: "Câu hỏi đã lưu" };
export const dynamic = "force-dynamic";

export default function SavedPage() {
  const items: SavedItem[] = visibleExams().flatMap((e) =>
    studyQuestions(e).map((q) => ({
      id: q.id,
      type: q.type,
      preview: q.content.replace(/[`*_#>$|]/g, "").replace(/\s+/g, " ").slice(0, 220),
      chapterTitle: e.chapters.find((c) => c.id === q.chapterId)?.title ?? q.chapterId,
      courseCode: e.course.code,
      isDemo: e.isDemo,
    })),
  );
  return (
    <Suspense>
      <SavedView items={items} />
    </Suspense>
  );
}

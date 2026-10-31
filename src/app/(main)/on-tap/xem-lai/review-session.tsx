"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Inbox } from "lucide-react";
import type { Question } from "@/lib/bank/schema";
import { useStudyStore } from "@/lib/store/study";
import { useHydrated } from "@/lib/hooks";
import { StudySession } from "@/components/study/study-session";
import { Button } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/misc";

/** Phiên ôn lại câu sai / câu đã đánh dấu. Danh sách câu được cố định khi bắt đầu phiên. */
export function ReviewSession({
  source,
  questions,
  chapterTitles,
  aiAvailable,
}: {
  source: "sai" | "danh-dau";
  questions: Question[];
  chapterTitles: Record<string, string>;
  aiAvailable: boolean;
}) {
  const hydrated = useHydrated();
  if (!hydrated) return <Skeleton className="mx-auto h-96 max-w-3xl rounded-2xl" />;
  return <Inner source={source} questions={questions} chapterTitles={chapterTitles} aiAvailable={aiAvailable} />;
}

function Inner({ source, questions, chapterTitles, aiAvailable }: { source: "sai" | "danh-dau"; questions: Question[]; chapterTitles: Record<string, string>; aiAvailable: boolean }) {
  const key = `review:${source}`;
  const existing = useStudyStore((s) => s.sessions[key]);
  const ids = useStudyStore((s) => (source === "sai" ? s.wrong : s.bookmarks));
  // Ảnh chụp danh sách khi mở trang — không thay đổi trong lúc làm (ví dụ khi trả lời sai thêm câu)
  const [snapshot] = useState(() =>
    existing?.questionIds ?? Object.entries(ids).sort((a, b) => b[1] - a[1]).map(([id]) => id),
  );
  const byId = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);
  const list = useMemo(() => snapshot.map((id) => byId.get(id)).filter((q): q is Question => Boolean(q)), [snapshot, byId]);
  const fixedIds = useMemo(() => list.map((q) => q.id), [list]);

  if (list.length === 0)
    return (
      <EmptyState
        icon={<Inbox />}
        title="Không có câu nào để ôn lại"
        description={source === "sai" ? "Bạn chưa có câu trả lời sai nào." : "Bạn chưa đánh dấu câu nào."}
        action={
          <Button asChild variant="outline">
            <Link href="/da-luu">Về Câu hỏi đã lưu</Link>
          </Button>
        }
      />
    );

  return (
    <StudySession
      sessionKey={key}
      title={source === "sai" ? "Ôn lại các câu từng trả lời sai" : "Ôn lại các câu đã đánh dấu"}
      courseLabel={`${list.length} câu · danh sách được cố định khi bắt đầu phiên`}
      href={`/on-tap/xem-lai?nguon=${source}`}
      backHref={`/da-luu?tab=${source}`}
      backLabel="Câu hỏi đã lưu"
      questions={list}
      chapterTitles={chapterTitles}
      isDemo={false}
      aiAvailable={aiAvailable}
      fixedQuestionIds={fixedIds}
    />
  );
}

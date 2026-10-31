"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Bookmark, BookmarkX, PlayCircle, Trash2, XCircle } from "lucide-react";
import { useStudyStore } from "@/lib/store/study";
import { useHydrated } from "@/lib/hooks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader, Skeleton } from "@/components/ui/misc";
import { cn, formatDateTime } from "@/lib/utils";

export interface SavedItem {
  id: string;
  type: "mcq" | "essay";
  preview: string;
  chapterTitle: string;
  courseCode: string;
  isDemo: boolean;
}

type Tab = "danh-dau" | "sai";

export function SavedView({ items }: { items: SavedItem[] }) {
  const params = useSearchParams();
  const tab: Tab = params.get("tab") === "sai" ? "sai" : "danh-dau";
  const hydrated = useHydrated();
  const bookmarks = useStudyStore((s) => s.bookmarks);
  const wrong = useStudyStore((s) => s.wrong);
  const stats = useStudyStore((s) => s.stats);
  const { toggleBookmark, removeWrong } = useStudyStore.getState();

  const source = tab === "sai" ? wrong : bookmarks;
  const byId = new Map(items.map((i) => [i.id, i]));
  const list = Object.entries(source)
    .filter(([id]) => byId.has(id))
    .sort((a, b) => b[1] - a[1])
    .map(([id, at]) => ({ ...byId.get(id)!, at }));

  return (
    <div>
      <PageHeader
        title="Câu hỏi đã lưu"
        description="Các câu bạn đánh dấu để xem lại và các câu từng trả lời sai trong chế độ Ôn tập."
        actions={
          hydrated && list.length > 0 ? (
            <Button asChild>
              <Link href={`/on-tap/xem-lai?nguon=${tab}`}>
                <PlayCircle /> Ôn {list.length} câu này
              </Link>
            </Button>
          ) : undefined
        }
      />

      <div className="mb-5 inline-flex rounded-xl bg-subtle p-1" role="tablist">
        {(
          [
            ["danh-dau", "Đã đánh dấu", Bookmark, Object.keys(bookmarks).filter((id) => byId.has(id)).length],
            ["sai", "Từng trả lời sai", XCircle, Object.keys(wrong).filter((id) => byId.has(id)).length],
          ] as const
        ).map(([k, label, Icon, count]) => (
          <Link
            key={k}
            href={`/da-luu?tab=${k}`}
            role="tab"
            aria-selected={tab === k}
            className={cn(
              "relative flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
              tab === k ? "text-primary" : "text-muted hover:text-foreground",
            )}
          >
            {tab === k && <motion.span layoutId="saved-tab" className="absolute inset-0 rounded-lg bg-surface shadow-sm" transition={{ duration: 0.2 }} />}
            <Icon className="relative size-4" />
            <span className="relative">
              {label} {hydrated && <span className="tabular-nums text-muted">({count})</span>}
            </span>
          </Link>
        ))}
      </div>

      {!hydrated ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={tab === "sai" ? <XCircle /> : <Bookmark />}
          title={tab === "sai" ? "Chưa có câu trả lời sai" : "Chưa đánh dấu câu nào"}
          description={
            tab === "sai"
              ? "Khi bạn trả lời sai trong chế độ Ôn tập, câu hỏi sẽ tự động được lưu tại đây."
              : "Nhấn biểu tượng đánh dấu trong khi ôn tập để lưu câu muốn xem lại."
          }
          action={
            <Button asChild variant="outline">
              <Link href="/on-tap">Đi đến Ôn tập</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {list.map((item) => (
              <motion.div key={item.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0, marginTop: 0 }} transition={{ duration: 0.2 }}>
                <Card className="flex items-start gap-3 p-4 sm:p-5">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge variant="muted">{item.type === "mcq" ? "Trắc nghiệm" : "Tự luận"}</Badge>
                      <Badge variant="outline">{item.chapterTitle}</Badge>
                      {item.isDemo && <Badge variant="secondary">Minh họa</Badge>}
                      {tab === "sai" && stats[item.id] && (
                        <span className="text-xs text-muted">
                          Đúng {stats[item.id].correct}/{stats[item.id].attempts} lần · gần nhất {stats[item.id].last === "correct" ? "đúng" : "sai"}
                        </span>
                      )}
                    </div>
                    <p className="line-clamp-2 text-sm leading-relaxed">{item.preview}</p>
                    <p className="mt-1 text-xs text-muted">{formatDateTime(item.at)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={tab === "sai" ? "Xóa khỏi danh sách câu sai" : "Bỏ đánh dấu"}
                    onClick={() => (tab === "sai" ? removeWrong(item.id) : toggleBookmark(item.id))}
                  >
                    {tab === "sai" ? <Trash2 /> : <BookmarkX />}
                  </Button>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

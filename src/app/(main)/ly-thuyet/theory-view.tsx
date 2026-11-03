"use client";

import Link from "next/link";
import { ArrowRight, Target } from "lucide-react";
import { RichContent } from "@/components/rich-content";
import { VISUALS } from "@/components/theory/visuals";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";

export interface TheorySection {
  id: string;
  title: string;
  /** Mức độ xuất hiện trong đề. */
  weight?: string;
  /** Phần ôn tập để luyện ngay sau khi đọc. */
  practice?: string;
  md: string;
}

/** Nội dung Markdown xen các hình minh họa, đánh dấu bằng dòng [[visual:ten]]. */
function SectionBody({ md }: { md: string }) {
  const parts = md.split(/^\[\[visual:([\w-]+)\]\]$/m);
  return (
    <div className="mt-4">
      {parts.map((part, i) => {
        if (i % 2 === 0) return part.trim() ? <RichContent key={i} className="theory text-[15px]">{part}</RichContent> : null;
        const Visual = VISUALS[part];
        return Visual ? <Visual key={i} /> : null;
      })}
    </div>
  );
}

export function TheoryView({ sections }: { sections: TheorySection[] }) {
  return (
    <div>
      <PageHeader
        title="Lý thuyết trọng tâm IT006"
        description="Lộ trình ôn thi giữa kỳ Kiến trúc máy tính, kể cả khi chưa học gì. Chỉ gồm những gì đề hay ra, có hình và phần tự bấm để thử."
      />

      {sections.length === 0 ? (
        <EmptyState icon={<Target />} title="Chưa có nội dung" description="Phần lý thuyết chưa được dựng." />
      ) : (
        <>
          <nav aria-label="Mục lục" className="mb-6 rounded-2xl border border-border bg-surface p-4">
            <p className="mb-2 text-sm font-semibold">Mục lục</p>
            <ol className="grid gap-1 sm:grid-cols-2">
              {sections.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="block rounded-lg px-2 py-1.5 text-sm text-muted transition-colors hover:bg-subtle hover:text-primary">
                    {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="space-y-5">
            {sections.map((s) => (
              <section key={s.id} id={s.id} aria-labelledby={`${s.id}-title`} className="scroll-mt-20">
                <Card className="p-5 sm:p-6">
                  <h2 id={`${s.id}-title`} className="text-lg font-bold tracking-tight sm:text-xl">
                    {s.title}
                  </h2>
                  {s.weight && (
                    <Badge variant="secondary" className="mt-2">
                      <Target /> {s.weight}
                    </Badge>
                  )}
                  <SectionBody md={s.md} />
                  {s.practice && (
                    <Button asChild variant="soft" className="mt-5">
                      <Link href={`/on-tap/it006/midterm/${s.practice}`}>
                        Luyện câu hỏi phần này <ArrowRight />
                      </Link>
                    </Button>
                  )}
                </Card>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

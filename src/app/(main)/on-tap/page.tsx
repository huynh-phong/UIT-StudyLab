import type { Metadata } from "next";
import { Suspense } from "react";
import { examSummaries } from "@/lib/bank/repo";
import { ChaptersView } from "./chapters-view";

export const metadata: Metadata = { title: "Ôn tập" };
export const dynamic = "force-dynamic";

export default function StudyPage() {
  return (
    <Suspense>
      <ChaptersView exams={examSummaries()} />
    </Suspense>
  );
}

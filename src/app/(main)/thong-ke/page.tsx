import type { Metadata } from "next";
import { examSummaries } from "@/lib/bank/repo";
import { StatsView } from "./stats-view";

export const metadata: Metadata = { title: "Thống kê" };
export const dynamic = "force-dynamic";

export default function StatsPage() {
  return <StatsView exams={examSummaries()} />;
}

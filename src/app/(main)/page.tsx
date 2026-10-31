import { examSummaries } from "@/lib/bank/repo";
import { getFeatureFlags } from "@/lib/server/env";
import { DashboardView } from "./dashboard-view";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return <DashboardView exams={examSummaries()} features={getFeatureFlags()} />;
}

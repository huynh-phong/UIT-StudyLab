import type { Metadata } from "next";
import { ResultView } from "./result-view";

export const metadata: Metadata = { title: "Kết quả thi thử" };

export default async function ResultPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  return <ResultView attemptId={attemptId} />;
}

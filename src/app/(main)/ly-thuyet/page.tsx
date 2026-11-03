import type { Metadata } from "next";
import theory from "@/generated/theory.json";
import { TheoryView, type TheorySection } from "./theory-view";

export const metadata: Metadata = { title: "Lý thuyết trọng tâm" };

export default function TheoryPage() {
  const sections = (theory as { courses: Record<string, TheorySection[]> }).courses.it006 ?? [];
  return <TheoryView sections={sections} />;
}

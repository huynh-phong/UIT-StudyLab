import "server-only";
import bankData from "@/generated/bank.json";
import { getEnv } from "@/lib/server/env";
import { isStudyEligible, type BuiltBank, type BuiltExam, type Chapter, type Question } from "./schema";

/** Truy cập ngân hàng câu hỏi đã build (src/generated/bank.json). Chỉ dùng phía server. */

const bank = bankData as unknown as BuiltBank;

export function examSlug(e: Pick<BuiltExam, "examType" | "isDemo">) {
  return e.isDemo ? `${e.examType}-demo` : e.examType;
}

function demoMode() {
  try {
    return getEnv().ENABLE_DEMO_CONTENT;
  } catch {
    return "auto" as const;
  }
}

/** Kỳ thi hiển thị cho người dùng. Demo chỉ hiện khi bật, hoặc ở chế độ auto khi ngân hàng thực tế cùng kỳ còn trống. */
export function visibleExams(): (BuiltExam & { course: { id: string; code: string; name: string } })[] {
  const mode = demoMode();
  const out: (BuiltExam & { course: { id: string; code: string; name: string } })[] = [];
  for (const c of bank.courses) {
    for (const e of c.exams) {
      if (e.isDemo) {
        if (mode === "false") continue;
        if (mode === "auto") {
          const real = c.exams.find((x) => !x.isDemo && x.examType === e.examType);
          if (real && real.questions.length > 0) continue;
        }
      }
      // Kỳ thi thật chưa có dữ liệu vẫn được liệt kê để hiển thị empty state
      out.push({ ...e, course: { id: c.id, code: c.code, name: c.name } });
    }
  }
  return out;
}

export function getCourses() {
  return bank.courses.map(({ exams, ...c }) => ({ ...c, examCount: exams.length }));
}

export function findExam(courseId: string, slug: string) {
  return visibleExams().find((e) => e.courseId === courseId && examSlug(e) === slug) ?? null;
}

export function findExamByKey(key: string) {
  return visibleExams().find((e) => e.key === key) ?? null;
}

export function studyQuestions(exam: BuiltExam, chapterId?: string): Question[] {
  return exam.questions.filter((q) => isStudyEligible(q) && (!chapterId || q.chapterId === chapterId));
}

export function sortedChapters(exam: BuiltExam): Chapter[] {
  return [...exam.chapters].sort((a, b) => a.order - b.order);
}

export function findQuestion(id: string): { question: Question; exam: BuiltExam } | null {
  for (const e of visibleExams()) {
    const q = e.questions.find((x) => x.id === id);
    if (q) return { question: q, exam: e };
  }
  return null;
}

/** Tóm tắt nhẹ cho client (không gồm nội dung câu hỏi/đáp án). */
export interface ExamSummary {
  key: string;
  courseId: string;
  courseCode: string;
  courseName: string;
  examType: BuiltExam["examType"];
  slug: string;
  title: string;
  description?: string;
  isDemo: boolean;
  chapters: { id: string; title: string; description?: string; questionIds: string[] }[];
  hasBlueprint: boolean;
}

export function examSummaries(): ExamSummary[] {
  return visibleExams().map((e) => ({
    key: e.key,
    courseId: e.courseId,
    courseCode: e.course.code,
    courseName: e.course.name,
    examType: e.examType,
    slug: examSlug(e),
    title: e.title,
    description: e.description,
    isDemo: e.isDemo,
    hasBlueprint: Boolean(e.blueprint),
    chapters: sortedChapters(e).map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      questionIds: studyQuestions(e, c.id).map((q) => q.id),
    }))
      // Phần chỉ có câu dùng để ghép đề thì không hiện trong danh sách ôn tập
      .filter((c) => c.questionIds.length > 0),
  }));
}

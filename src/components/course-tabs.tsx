"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export interface CourseTab {
  id: string;
  code: string;
  name: string;
}

/** Danh sách học phần không trùng lặp, giữ thứ tự xuất hiện. */
export function uniqueCourses<T>(items: T[], get: (x: T) => CourseTab): CourseTab[] {
  const seen = new Map<string, CourseTab>();
  for (const it of items) {
    const c = get(it);
    if (!seen.has(c.id)) seen.set(c.id, c);
  }
  return [...seen.values()];
}

/** Học phần đang chọn theo tham số ?mon=, mặc định là học phần đầu tiên. */
export function useSelectedCourse(courses: CourseTab[]) {
  const params = useSearchParams();
  const wanted = params.get("mon");
  return courses.find((c) => c.id === wanted)?.id ?? courses[0]?.id;
}

export function CourseTabs({ courses, selected }: { courses: CourseTab[]; selected?: string }) {
  const pathname = usePathname();
  if (courses.length < 2) return null;
  return (
    <div className="mb-6 flex flex-wrap gap-1 rounded-xl bg-subtle p-1 sm:inline-flex" role="tablist" aria-label="Chọn học phần">
      {courses.map((c) => (
        <Link
          key={c.id}
          href={`${pathname}?mon=${c.id}`}
          scroll={false}
          role="tab"
          aria-selected={selected === c.id}
          className={cn("relative flex-1 rounded-lg px-4 py-2 text-center text-sm font-medium transition-colors sm:flex-none", selected === c.id ? "text-primary" : "text-muted hover:text-foreground")}
        >
          {selected === c.id && <motion.span layoutId={`course-tab-${pathname}`} className="absolute inset-0 rounded-lg bg-surface shadow-sm" transition={{ duration: 0.2 }} />}
          <span className="relative">
            {c.code}
            <span className="hidden font-normal text-muted sm:inline"> · {c.name}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}

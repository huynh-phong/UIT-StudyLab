"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { BarChart3, Bookmark, BookOpenCheck, LayoutDashboard, Timer } from "lucide-react";
import { Logo, LogoMark } from "./logo";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Tổng quan", short: "Tổng quan", icon: LayoutDashboard },
  { href: "/on-tap", label: "Ôn tập", short: "Ôn tập", icon: BookOpenCheck },
  { href: "/thi-thu", label: "Thi thử", short: "Thi thử", icon: Timer },
  { href: "/da-luu", label: "Câu hỏi đã lưu", short: "Đã lưu", icon: Bookmark },
  { href: "/thong-ke", label: "Thống kê", short: "Thống kê", icon: BarChart3 },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-dvh">
      {/* Sidebar desktop */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-surface/80 px-4 py-5 backdrop-blur lg:flex">
        <Link href="/" className="mb-8 px-2">
          <Logo />
        </Link>
        <nav className="flex flex-col gap-1" aria-label="Điều hướng chính">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-200",
                  active ? "text-primary" : "text-muted hover:bg-subtle hover:text-foreground",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-xl bg-primary-soft"
                    transition={{ type: "spring", stiffness: 500, damping: 40 }}
                  />
                )}
                <item.icon className="relative size-[18px]" />
                <span className="relative">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto rounded-xl bg-subtle p-3 text-xs leading-relaxed text-muted">
          Nền tảng ôn tập độc lập dành cho sinh viên UIT — không phải hệ thống chính thức của nhà trường.
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Thanh trên mobile */}
        <header className="sticky top-0 z-30 flex h-14 items-center border-b border-border bg-surface/85 px-4 backdrop-blur lg:hidden">
          <Link href="/" className="flex items-center gap-2" aria-label="UIT StudyLab — Trang chủ">
            <LogoMark className="size-8" />
            <span className="text-[15px] font-bold tracking-tight">UIT StudyLab</span>
          </Link>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-12 lg:pt-10">{children}</main>
      </div>

      {/* Thanh điều hướng dưới (mobile) */}
      <nav
        aria-label="Điều hướng chính"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn("relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors", active ? "text-primary" : "text-muted")}
            >
              {active && <motion.span layoutId="mnav-active" className="absolute top-0 h-0.5 w-8 rounded-full bg-primary" />}
              <item.icon className="size-5" />
              {item.short}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

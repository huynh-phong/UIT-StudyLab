"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileQuestion,
  FlaskConical,
  History,
  Inbox,
  Library,
  ShieldCheck,
  Shuffle,
  Sparkles,
  Timer,
  Trash2,
} from "lucide-react";
import { EXAM_TYPE_LABEL, type ExamType } from "@/lib/bank/schema";
import type { FeatureFlags } from "@/lib/server/env";
import type { PublicExam } from "@/lib/exam/types";
import { recentExamQuestionIds, useExamStore } from "@/lib/store/exam";
import { useHydrated } from "@/lib/hooks";
import { postJson } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Callout, EmptyState, PageHeader, Skeleton } from "@/components/ui/misc";
import { CourseTabs, uniqueCourses, useSelectedCourse } from "@/components/course-tabs";
import { cn, formatDateTime, formatDuration, formatScore } from "@/lib/utils";

type Mode = "algo" | "bank" | "ai";

export interface ExamOffer {
  key: string;
  courseId: string;
  courseCode: string;
  courseName: string;
  examType: ExamType;
  title: string;
  isDemo: boolean;
  chapterCount: number;
  blueprint: {
    title: string;
    status: "verified" | "unverified";
    sourceNote: string;
    durationMinutes: number | null;
    totalQuestions: number;
    mcqCount: number;
    essayCount: number;
    totalPoints: number;
    slots: { chapterTitle: string; type: "mcq" | "essay"; count: number; pointsEach: number; bankAvailable: number }[];
  } | null;
}

export function ExamLanding({ offers, features }: { offers: ExamOffer[]; features: FeatureFlags }) {
  const hydrated = useHydrated();
  const active = useExamStore((s) => s.active);
  const history = useExamStore((s) => s.history);
  const discardActive = useExamStore((s) => s.discardActive);
  const courses = uniqueCourses(offers, (o) => ({ id: o.courseId, code: o.courseCode, name: o.courseName }));
  const selected = useSelectedCourse(courses);

  return (
    <div>
      <PageHeader
        title="Thi thử"
        description="Mỗi lần thi là một đề mới theo cấu trúc đề giữa kỳ thật. Trong lúc làm bài, đáp án và lời giải được giữ kín cho tới khi bạn nộp bài."
      />

      {hydrated && active && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <Card className="flex flex-col gap-4 border-primary/25 p-5 sm:flex-row sm:items-center">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Timer className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-primary">Bài thi đang làm dở</p>
              <p className="font-semibold">{active.exam.title}</p>
              <p className="text-sm text-muted">
                Đã trả lời {Object.values(active.responses).filter((r) => r.optionId || r.text?.trim()).length}/{active.exam.questions.length} câu
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => window.confirm("Hủy bài thi đang làm? Bài làm sẽ không được lưu vào lịch sử.") && discardActive()}>
                Hủy bài
              </Button>
              <Button asChild>
                <Link href="/thi-thu/phong-thi">
                  Tiếp tục làm bài <ArrowRight />
                </Link>
              </Button>
            </div>
          </Card>
        </motion.div>
      )}

      {!features.examMode && (
        <Callout tone="warning" icon={<AlertTriangle />} title="Chế độ thi thử chưa được cấu hình" className="mb-6">
          Máy chủ thiếu biến môi trường <code>EXAM_TOKEN_SECRET</code> (dùng để niêm phong đáp án đề thi). Xem hướng dẫn trong README.
        </Callout>
      )}

      <div className="space-y-5">
        <CourseTabs courses={courses} selected={selected} />
        {offers.filter((o) => o.courseId === selected).map((o) => (
          <OfferCard key={o.key} offer={o} features={features} />
        ))}
      </div>

      <section className="mt-10">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
          <History className="size-4 text-muted" /> Lịch sử thi thử
        </h2>
        {!hydrated ? (
          <Skeleton className="h-24 w-full rounded-2xl" />
        ) : history.length === 0 ? (
          <EmptyState icon={<History />} title="Chưa có bài thi nào" description="Kết quả các lần thi thử sẽ được lưu tại đây trên trình duyệt này." />
        ) : (
          <HistoryList />
        )}
      </section>
    </div>
  );
}

function OfferCard({ offer, features }: { offer: ExamOffer; features: FeatureFlags }) {
  const router = useRouter();
  const bp = offer.blueprint;
  const history = useExamStore((s) => s.history);
  const active = useExamStore((s) => s.active);
  const bankEnough = bp ? bp.slots.every((s) => s.bankAvailable >= s.count) : false;
  const [mode, setMode] = useState<Mode>("algo");
  const [showDist, setShowDist] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  if (!bp) {
    return (
      <Card className="p-5 sm:p-6">
        <OfferHeader offer={offer} />
        <EmptyState
          className="mt-4"
          icon={<Inbox />}
          title="Chưa có cấu trúc đề chuẩn"
          description="Thi thử cần cấu trúc đề (số câu, thời gian, phân bố chương, điểm) được xác định từ đề thật. Cấu trúc sẽ được bổ sung khi có bộ đề — hệ thống không tự đặt cấu trúc mặc định."
        />
      </Card>
    );
  }

  const canStart = features.examMode && (mode === "ai" ? features.aiExamGeneration : mode === "bank" ? bankEnough : offer.chapterCount > 0);

  const start = async () => {
    if (busy.current || !canStart) return;
    if (active && !window.confirm("Bạn đang có một bài thi chưa nộp. Tạo đề mới sẽ hủy bài thi đó. Tiếp tục?")) return;
    busy.current = true;
    setLoading(true);
    setError(null);
    try {
      const res = await postJson<{ exam: PublicExam }>(
        "/api/exam/create",
        { examKey: offer.key, mode, exclude: recentExamQuestionIds(history, offer.key) },
        90_000,
      );
      useExamStore.getState().start(res.exam);
      router.push("/thi-thu/phong-thi");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tạo được đề thi.");
      setLoading(false);
    } finally {
      busy.current = false;
    }
  };

  return (
    <Card className="p-5 sm:p-6">
      <OfferHeader offer={offer} />

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Fact icon={<FileQuestion />} label="Số câu" value={`${bp.totalQuestions} câu`} />
        <Fact icon={<Clock />} label="Thời gian" value={bp.durationMinutes ? `${bp.durationMinutes} phút` : "Không giới hạn"} />
        <Fact icon={<CheckCircle2 />} label="Trắc nghiệm / Tự luận" value={`${bp.mcqCount} / ${bp.essayCount}`} />
        <Fact icon={<ShieldCheck />} label="Tổng điểm" value={formatScore(bp.totalPoints)} />
      </div>

      {bp.status !== "verified" && (
        <Callout tone="warning" icon={<AlertTriangle />} title="Cấu trúc đề chưa được xác nhận" className="mt-4">
          {bp.sourceNote}
        </Callout>
      )}

      <button
        type="button"
        onClick={() => setShowDist((v) => !v)}
        className="mt-4 flex items-center gap-1.5 text-sm font-medium text-primary"
        aria-expanded={showDist}
      >
        Phân bố câu hỏi theo chương <ChevronDown className={cn("size-4 transition-transform", showDist && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {showDist && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="mt-3 overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[420px] text-sm">
                <thead className="bg-subtle text-left text-xs text-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">Chương</th>
                    <th className="px-3 py-2 font-medium">Loại</th>
                    <th className="px-3 py-2 text-right font-medium">Số câu</th>
                    <th className="px-3 py-2 text-right font-medium">Điểm/câu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {bp.slots.map((s, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2">{s.chapterTitle}</td>
                      <td className="px-3 py-2">{s.type === "mcq" ? "Trắc nghiệm" : "Tự luận"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{s.count}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatScore(s.pointsEach)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <fieldset className="mt-5" disabled={loading}>
        <legend className="mb-2 text-sm font-semibold">Cách tạo đề</legend>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <ModeCard
            selected={mode === "algo"}
            onSelect={() => setMode("algo")}
            icon={<Shuffle />}
            title="Đề mới theo thuật toán"
            description="Câu trong ngân hàng (ưu tiên câu chưa gặp) kết hợp khoảng 30% bài tính toán mới với số liệu khác, đáp án được tính bằng code."
          />
          <ModeCard
            selected={mode === "bank"}
            onSelect={() => setMode("bank")}
            disabled={!bankEnough}
            icon={<Library />}
            title="Chỉ câu trong ngân hàng"
            description={bankEnough ? "Chọn ngẫu nhiên câu đã xác minh trong ngân hàng của môn, không sinh thêm bài mới." : "Ngân hàng chưa đủ câu đã xác minh cho mọi chương trong cấu trúc."}
          />
          {features.aiExamGeneration && (
            <ModeCard
              selected={mode === "ai"}
              onSelect={() => setMode("ai")}
              icon={<Sparkles />}
              title="AI tạo đề mới"
              description="Câu hỏi do AI tạo theo cấu trúc đề chuẩn, đã qua kiểm tra tự động. Có thể mất 20–50 giây."
            />
          )}
        </div>
      </fieldset>

      <AnimatePresence>
        {loading && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <GeneratingState mode={mode} />
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <Callout tone="error" title="Không tạo được đề thi" className="mt-4">
          {error}
        </Callout>
      )}

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button size="lg" onClick={start} disabled={!canStart || loading}>
          <Timer /> {loading ? "Đang chuẩn bị đề…" : "Bắt đầu thi thử"}
        </Button>
        <p className="text-xs text-muted">Bài làm được lưu liên tục — tải lại trang không mất bài.</p>
      </div>
    </Card>
  );
}

function OfferHeader({ offer }: { offer: ExamOffer }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <h2 className="text-base font-semibold sm:text-lg">
        {offer.courseCode} — {offer.courseName}
      </h2>
      <Badge variant="muted">{EXAM_TYPE_LABEL[offer.examType]}</Badge>
      {offer.isDemo && (
        <Badge variant="secondary">
          <FlaskConical /> Minh họa
        </Badge>
      )}
      {offer.blueprint?.status === "verified" && (
        <Badge variant="success">
          <ShieldCheck /> Cấu trúc đã xác nhận
        </Badge>
      )}
    </div>
  );
}

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-subtle px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[11px] text-muted [&_svg]:size-3.5">
        {icon}
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold">{value}</p>
    </div>
  );
}

function ModeCard({
  selected,
  onSelect,
  disabled,
  icon,
  title,
  description,
}: {
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex items-start gap-3 rounded-xl border-2 p-3.5 text-left transition-[border-color,background-color] duration-200",
        selected ? "border-primary bg-primary-soft" : "border-border bg-surface hover:border-primary/40",
        disabled && "cursor-not-allowed opacity-55 hover:border-border",
      )}
    >
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg [&_svg]:size-[18px]", selected ? "bg-primary text-primary-foreground" : "bg-subtle text-muted")}>
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted">{description}</span>
      </span>
    </button>
  );
}

const AI_STEPS = ["Đọc cấu trúc đề chuẩn", "Lấy câu đã kiểm định trong pool", "AI tạo câu hỏi mới", "Kiểm tra đáp án, phép tính và độ trùng lặp", "Niêm phong đáp án"];

function GeneratingState({ mode }: { mode: Mode }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (mode !== "ai") return;
    const t = setInterval(() => setStep((s) => Math.min(s + 1, AI_STEPS.length - 1)), 6000);
    return () => clearInterval(t);
  }, [mode]);
  return (
    <div role="status" aria-live="polite" className="mt-4 rounded-xl border border-primary/15 bg-primary-soft/50 p-4">
      <p className="flex items-center gap-2 text-sm font-medium text-primary">
        <motion.span animate={{ rotate: 360 }} transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}>
          <Sparkles className="size-4" />
        </motion.span>
        {mode === "ai" ? AI_STEPS[step] : mode === "algo" ? "Đang chọn câu hỏi và sinh bài tính toán mới…" : "Đang chọn câu hỏi từ ngân hàng…"}
      </p>
      <div className="mt-3 skeleton h-2 w-full rounded-full" />
    </div>
  );
}

function HistoryList() {
  const history = useExamStore((s) => s.history);
  const removeAttempt = useExamStore((s) => s.removeAttempt);
  return (
    <Card className="divide-y divide-border">
      {history.map((h) => (
        <div key={h.id} className="flex items-center gap-3 p-4 sm:px-5">
          <Link href={`/thi-thu/ket-qua/${h.id}`} className="group flex min-w-0 flex-1 items-center gap-4">
            <div
              className={cn(
                "flex size-12 shrink-0 flex-col items-center justify-center rounded-xl text-sm font-bold tabular-nums",
                h.result.score10 === null ? "bg-warning-soft text-amber-700" : h.result.score10 >= 5 ? "bg-success-soft text-green-700" : "bg-error-soft text-red-700",
              )}
            >
              {h.result.score10 === null ? "…" : formatScore(h.result.score10)}
              <span className="text-[9px] font-medium opacity-70">/10</span>
            </div>
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-1.5 truncate text-sm font-semibold group-hover:text-primary">
                {h.title}
                {h.isDemo && <Badge variant="secondary">Minh họa</Badge>}
                {h.result.gradingStatus === "partial" && <Badge variant="warning">Chờ chấm tự luận</Badge>}
              </p>
              <p className="text-xs text-muted">
                {formatDateTime(h.submittedAt)} · {formatDuration(h.result.durationSec)} · {h.result.counts.correct} đúng / {h.result.counts.wrong} sai / {h.result.counts.blank} trống
              </p>
            </div>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Xóa khỏi lịch sử"
            onClick={() => window.confirm("Xóa bài thi này khỏi lịch sử?") && removeAttempt(h.id)}
          >
            <Trash2 />
          </Button>
        </div>
      ))}
    </Card>
  );
}

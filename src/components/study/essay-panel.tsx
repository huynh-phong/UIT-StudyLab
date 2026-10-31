"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Eye, Info, RefreshCw, Sparkles } from "lucide-react";
import type { EssayQuestion } from "@/lib/bank/schema";
import type { EssayGradeResult } from "@/lib/grading/types";
import { useStudyStore, type EssayAnswer } from "@/lib/store/study";
import { ApiClientError, postJson } from "@/lib/api-client";
import { AIGradingLoader, EssayResultView } from "@/components/question/essay-result";
import { Button } from "@/components/ui/button";
import { Callout, Textarea } from "@/components/ui/misc";

const MAX_CHARS = 8000;

export function EssayPanel({
  sessionKey,
  question,
  answer,
  aiAvailable,
  onNext,
}: {
  sessionKey: string;
  question: EssayQuestion;
  answer: EssayAnswer | undefined;
  aiAvailable: boolean;
  onNext: () => void;
}) {
  const { setEssayText, setEssayGrading, setEssayResult, setEssayError } = useStudyStore.getState();
  const [text, setText] = useState(answer?.text ?? "");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);
  const status = answer?.status ?? "draft";
  const locked = status === "grading" || status === "done";
  const hasReference = Boolean(question.essay);

  // Lưu nháp (debounce) để không mất bài khi tải lại trang
  const scheduleSave = (value: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => setEssayText(sessionKey, question.id, value), 400);
  };
  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    [],
  );

  const flush = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setEssayText(sessionKey, question.id, text);
  };

  const submit = async () => {
    if (inFlight.current || locked || !text.trim()) return;
    inFlight.current = true;
    flush();
    setEssayGrading(sessionKey, question.id);
    try {
      const res = await postJson<{ result: EssayGradeResult }>("/api/essay/grade", { questionId: question.id, answer: text });
      setEssayResult(sessionKey, question.id, res.result);
    } catch (e) {
      if (e instanceof ApiClientError && e.code === "INSUFFICIENT_REFERENCE") {
        setEssayResult(sessionKey, question.id, { status: "insufficient_reference", message: e.message });
      } else {
        setEssayError(sessionKey, question.id, e instanceof Error ? e.message : "Đã có lỗi xảy ra.");
      }
    } finally {
      inFlight.current = false;
    }
  };

  /** Không có AI / không có rubric: lưu bài làm và tự đối chiếu (không chấm điểm giả tạo). */
  const selfCheck = () => {
    flush();
    setEssayResult(
      sessionKey,
      question.id,
      hasReference
        ? { status: "unavailable", message: "Chấm AI chưa được cấu hình. Câu trả lời của bạn đã được lưu — hãy tự đối chiếu với đáp án mẫu bên dưới." }
        : { status: "insufficient_reference", message: "Câu hỏi chưa có đáp án mẫu/rubric đã xác minh nên hệ thống không chấm điểm. Câu trả lời của bạn đã được lưu." },
    );
  };

  return (
    <div className="space-y-4">
      {!hasReference && (
        <Callout tone="warning" icon={<Info />} title="Câu hỏi cần bổ sung dữ liệu">
          Câu này chưa có đáp án mẫu hoặc rubric đã xác minh, vì vậy hệ thống sẽ không chấm điểm.
        </Callout>
      )}

      <div>
        <label htmlFor={`essay-${question.id}`} className="mb-1.5 block text-sm font-medium">
          Câu trả lời của bạn
        </label>
        <Textarea
          id={`essay-${question.id}`}
          value={text}
          disabled={locked}
          maxLength={MAX_CHARS}
          placeholder="Trình bày câu trả lời. Có thể xuống dòng, liệt kê từng ý…"
          onChange={(e) => {
            setText(e.target.value);
            scheduleSave(e.target.value);
          }}
          onBlur={() => !locked && flush()}
        />
        <p className="mt-1 text-right text-xs tabular-nums text-muted">
          {text.length.toLocaleString("vi-VN")}/{MAX_CHARS.toLocaleString("vi-VN")} ký tự
        </p>
      </div>

      {status === "grading" && <AIGradingLoader />}

      {status === "error" && (
        <Callout tone="error" title="Chưa chấm được câu trả lời">
          {answer?.error} Câu trả lời của bạn vẫn được lưu.
        </Callout>
      )}

      {(status === "draft" || status === "error") && (
        <div className="flex flex-col gap-2 sm:flex-row">
          {hasReference && aiAvailable && (
            <Button size="lg" disabled={!text.trim()} onClick={submit}>
              {status === "error" ? <RefreshCw /> : <Sparkles />}
              {status === "error" ? "Thử chấm lại" : "Xác nhận và kiểm tra bằng AI"}
            </Button>
          )}
          {(!hasReference || !aiAvailable) && (
            <Button size="lg" variant={hasReference ? "default" : "outline"} disabled={!text.trim()} onClick={selfCheck}>
              <Eye /> {hasReference ? "Xác nhận và xem đáp án mẫu" : "Lưu câu trả lời"}
            </Button>
          )}
        </div>
      )}
      {(status === "draft" || status === "error") && hasReference && !aiAvailable && (
        <p className="text-xs text-muted">Chấm tự luận bằng AI chưa được cấu hình trên máy chủ (thiếu khóa AI).</p>
      )}

      {status === "done" && answer?.grade && (
        <>
          <EssayResultView state={answer.grade} fallbackModelAnswer={question.essay?.modelAnswer} />
          <Button size="lg" className="w-full sm:w-auto sm:min-w-44" onClick={onNext}>
            Câu tiếp theo <ArrowRight />
          </Button>
        </>
      )}
    </div>
  );
}

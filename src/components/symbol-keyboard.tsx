"use client";

import type { RefObject } from "react";
import { cn } from "@/lib/utils";

export type KeyboardKind = "ra" | "er" | "sql" | "mixed";

interface SymbolKey {
  text: string;
  title: string;
  /** Hiển thị trên nút khi khác với nội dung chèn. */
  label?: string;
  /** Bọc đoạn đang chọn thay vì chèn. */
  wrap?: boolean;
}

const RA_OPERATORS: SymbolKey[] = [
  { text: "σ ", label: "σ", title: "Phép chọn" },
  { text: "π ", label: "π", title: "Phép chiếu" },
  { text: " ⋈ ", label: "⋈", title: "Phép kết" },
  { text: " ⟕ ", label: "⟕", title: "Kết ngoài trái" },
  { text: " ⟖ ", label: "⟖", title: "Kết ngoài phải" },
  { text: " ⟗ ", label: "⟗", title: "Kết ngoài đầy đủ" },
  { text: " × ", label: "×", title: "Tích Descartes" },
  { text: " ÷ ", label: "÷", title: "Phép chia" },
  { text: " ∪ ", label: "∪", title: "Phép hợp" },
  { text: " ∩ ", label: "∩", title: "Phép giao" },
  { text: " − ", label: "−", title: "Phép trừ" },
  { text: " ℑ ", label: "ℑ", title: "Gom nhóm" },
  { text: "ρ ", label: "ρ", title: "Đổi tên" },
  { text: " ← ", label: "←", title: "Gán tên cho kết quả" },
];
const RA_CONDITIONS: SymbolKey[] = [
  { text: " ∧ ", label: "∧", title: "Và" },
  { text: " ∨ ", label: "∨", title: "Hoặc" },
  { text: "¬", label: "¬", title: "Phủ định" },
  { text: "≠", title: "Khác" },
  { text: "≥", title: "Lớn hơn hoặc bằng" },
  { text: "≤", title: "Nhỏ hơn hoặc bằng" },
  { text: "count()", label: "count", title: "Hàm đếm" },
  { text: "sum()", label: "sum", title: "Hàm tổng" },
  { text: "avg()", label: "avg", title: "Hàm trung bình" },
  { text: "max()", label: "max", title: "Hàm lớn nhất" },
  { text: "min()", label: "min", title: "Hàm nhỏ nhất" },
  { text: "Year()", label: "Year", title: "Lấy năm" },
  { text: "Month()", label: "Month", title: "Lấy tháng" },
];
const ER_KEYS: SymbolKey[] = [
  { text: "(1,1)", title: "Duy nhất một" },
  { text: "(0,1)", title: "Không hoặc một" },
  { text: "(1,n)", title: "Một hoặc nhiều" },
  { text: "(0,n)", title: "Không hoặc nhiều" },
  { text: " — ", label: "—", title: "Nối hai bên của mối kết hợp" },
  { text: " → ", label: "→", title: "Khóa ngoại tham chiếu đến" },
  { text: "_", label: "_Khóa_", title: "Đánh dấu khóa chính (gạch chân): chọn tên thuộc tính rồi bấm", wrap: true },
];

const GROUPS: Record<KeyboardKind, { label: string; keys: SymbolKey[] }[]> = {
  ra: [
    { label: "Phép toán", keys: RA_OPERATORS },
    { label: "Điều kiện, hàm", keys: RA_CONDITIONS },
  ],
  er: [{ label: "Bản số, khóa", keys: ER_KEYS }],
  sql: [],
  mixed: [
    { label: "Phép toán", keys: RA_OPERATORS },
    { label: "Điều kiện, hàm", keys: RA_CONDITIONS },
  ],
};

/** Hàng nút chèn ký hiệu vào ô tự luận, vì σ, π, ⋈… không gõ được bằng bàn phím thường. */
export function SymbolKeyboard({
  kind,
  textareaRef,
  value,
  onChange,
  disabled,
  className,
}: {
  kind: KeyboardKind;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const groups = GROUPS[kind];
  if (!groups.length) return null;

  const press = (key: SymbolKey) => {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const selected = value.slice(start, end);
    const insert = key.wrap ? `${key.text}${selected}${key.text}` : key.text;
    onChange(value.slice(0, start) + insert + value.slice(end));
    // Con trỏ: nằm trong ngoặc của hàm, trong cặp dấu khi chưa chọn gì, còn lại nằm sau đoạn chèn
    const caret = insert.endsWith("()")
      ? start + insert.length - 1
      : key.wrap && !selected
        ? start + key.text.length
        : start + insert.length;
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(caret, caret);
    });
  };

  return (
    <div role="toolbar" aria-label="Chèn ký hiệu" className={cn("space-y-1.5 rounded-xl border border-border bg-subtle p-2", className)}>
      {groups.map((group) => (
        <div key={group.label} className="flex flex-wrap items-center gap-1">
          <span className="mr-1 text-xs text-muted">{group.label}</span>
          {group.keys.map((key) => (
            <button
              key={key.title}
              type="button"
              title={key.title}
              aria-label={key.title}
              disabled={disabled}
              // Giữ nguyên vùng đang chọn trong ô nhập khi bấm nút
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => press(key)}
              className="flex h-9 min-w-9 items-center justify-center rounded-lg border border-border bg-surface px-2 font-mono text-sm text-foreground transition-colors hover:border-primary/40 hover:bg-primary-soft hover:text-primary disabled:pointer-events-none disabled:opacity-50"
            >
              {key.label ?? key.text}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

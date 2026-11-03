"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

export type ThemeMode = "light" | "dark" | "system";

const STORAGE_KEY = "uit-studylab-theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

/** Chạy trước khi trang hiển thị để không bị chớp sai màu khi tải lại. */
export const THEME_INIT_SCRIPT = `(function(){var d=document.documentElement,t;try{t=localStorage.getItem("${STORAGE_KEY}")}catch(e){}if(t!=="light"&&t!=="dark")t=matchMedia("${DARK_QUERY}").matches?"dark":"light";d.dataset.theme=t})()`;

const OPTIONS: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Sáng", icon: Sun },
  { value: "dark", label: "Tối", icon: Moon },
  { value: "system", label: "Hệ thống", icon: Monitor },
];

const listeners = new Set<() => void>();

function readMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // Trình duyệt chặn lưu trữ: dùng theo hệ thống
  }
  return "system";
}

function applyMode(mode: ThemeMode) {
  const dark = mode === "dark" || (mode === "system" && matchMedia(DARK_QUERY).matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

function setMode(mode: ThemeMode) {
  try {
    if (mode === "system") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Không lưu được thì chế độ chỉ có hiệu lực tới khi tải lại trang
  }
  applyMode(mode);
  listeners.forEach((notify) => notify());
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
}

/** Theo dõi thay đổi của hệ điều hành và của các tab khác, áp dụng cho mọi trang kể cả phòng thi. */
export function useThemeSync() {
  useEffect(() => {
    const media = matchMedia(DARK_QUERY);
    const sync = () => {
      applyMode(readMode());
      listeners.forEach((notify) => notify());
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY || e.key === null) sync();
    };
    media.addEventListener("change", sync);
    window.addEventListener("storage", onStorage);
    return () => {
      media.removeEventListener("change", sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
}

export function ThemeSwitcher({ compact = false, className }: { compact?: boolean; className?: string }) {
  // Máy chủ không biết lựa chọn đã lưu nên chưa tô nút nào cho tới khi trang chạy trên trình duyệt
  const mode = useSyncExternalStore<ThemeMode | null>(subscribe, readMode, () => null);

  return (
    <div role="radiogroup" aria-label="Chế độ giao diện" className={cn("flex gap-0.5 rounded-xl bg-subtle p-1", className)}>
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={mode === value}
          aria-label={label}
          title={label}
          onClick={() => setMode(value)}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition-colors duration-200",
            compact ? "size-8" : "h-8 flex-auto whitespace-nowrap px-1.5",
            mode === value ? "bg-surface text-primary shadow-sm" : "text-muted hover:text-foreground",
          )}
        >
          <Icon className="size-4 shrink-0" />
          {!compact && label}
        </button>
      ))}
    </div>
  );
}

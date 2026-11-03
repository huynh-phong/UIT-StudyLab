"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, RotateCcw } from "lucide-react";
import { decode, encode, formatOf, intToTwosComplement, REG_NAMES, toBin, toHex, traceProgram } from "@/lib/mips/mips";
import { TRACES, WALKTHROUGHS } from "@/lib/theory/walkthroughs";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Khung chung cho một hình minh họa. */
function Frame({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <figure className="my-5 rounded-2xl border border-primary/25 bg-background p-3.5 sm:p-5">
      <figcaption className="mb-3">
        <span className="text-sm font-bold text-primary">{title}</span>
        {hint && <span className="mt-0.5 block text-xs text-muted">{hint}</span>}
      </figcaption>
      {children}
    </figure>
  );
}

function Choice<T extends string | number>({ options, value, onChange, label }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="mb-3 flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "min-h-9 rounded-lg border px-3 py-1.5 text-left text-sm font-medium transition-colors",
            value === o.value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface text-foreground hover:border-primary/40",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Slider({ label, value, min, max, step, unit, onChange }: { label: string; value: number; min: number; max: number; step: number; unit?: string; onChange: (v: number) => void }) {
  return (
    <label className="block text-sm">
      <span className="flex justify-between gap-2">
        <span>{label}</span>
        <b className="tabular-nums">
          {value.toLocaleString("vi-VN")} {unit}
        </b>
      </span>
      <input type="range" aria-label={label} min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 w-full accent-[var(--color-primary)]" />
    </label>
  );
}

const CODE = "font-mono text-[13px] leading-relaxed";

// ───────────── Nền tảng ─────────────

function HexTable() {
  const [hex, setHex] = useState("AD");
  const clean = hex.replace(/^0x/i, "").replace(/[^0-9a-f]/gi, "").toUpperCase().slice(0, 8);
  return (
    <Frame title="Bảng đổi hex: chỉ có 16 dòng" hint="Gõ một số hex bên dưới để xem nó thành nhị phân thế nào">
      <div className="grid grid-cols-4 gap-1 sm:grid-cols-8">
        {Array.from({ length: 16 }, (_, i) => {
          const h = i.toString(16).toUpperCase();
          const used = clean.includes(h);
          return (
            <div key={i} className={cn("rounded-lg border px-1 py-1.5 text-center", used ? "border-primary bg-primary-soft" : "border-border bg-surface")}>
              <b className="block font-mono text-sm text-primary">{h}</b>
              <span className="block font-mono text-[11px]">{i.toString(2).padStart(4, "0")}</span>
              <span className="block text-[10px] text-muted">= {i}</span>
            </div>
          );
        })}
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm">
        Số hex:
        <span className="font-mono text-muted">0x</span>
        <input value={clean} onChange={(e) => setHex(e.target.value)} spellCheck={false} aria-label="Nhập số hex" className="w-32 rounded-lg border border-border bg-surface px-2 py-1 font-mono uppercase" />
      </label>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {[...clean].map((c, i) => (
          <div key={i} className="rounded-lg bg-primary-soft px-2 py-1 text-center">
            <b className="block font-mono text-primary">{c}</b>
            <span className="font-mono text-xs">{parseInt(c, 16).toString(2).padStart(4, "0")}</span>
          </div>
        ))}
      </div>
    </Frame>
  );
}

// ───────────── Phần 1 ─────────────

const FLOW = [
  { tool: "Compiler", job: "Dịch C sang hợp ngữ", out: "add $s0, $s1, $s2", input: "f = g + h;" },
  { tool: "Assembler", job: "Dịch hợp ngữ sang mã máy", out: "0x02328020" },
  { tool: "Linker", job: "Ghép với thư viện", out: "File chạy được" },
  { tool: "Loader", job: "Nạp vào RAM", out: "Chương trình chạy" },
];

function CompileFlow() {
  return (
    <Frame title="Từ code bạn viết đến chương trình chạy" hint="Thứ tự này ra thi rất nhiều. Nhớ theo chữ cái đầu: C → A → L → L">
      <p className={cn(CODE, "mb-2 rounded-lg bg-subtle px-3 py-2")}>Bạn viết: f = g + h;</p>
      <ol className="grid gap-2 sm:grid-cols-4">
        {FLOW.map((s, i) => (
          <li key={s.tool} className="relative rounded-xl border border-border bg-surface p-3">
            <b className="text-primary">
              {i + 1}. {s.tool}
            </b>
            <p className="mt-1 text-xs text-muted">{s.job}</p>
            <p className={cn(CODE, "mt-2 break-words text-xs font-semibold")}>{s.out}</p>
          </li>
        ))}
      </ol>
    </Frame>
  );
}

const LEVELS = [
  { name: "Register", where: "Trong tay bạn", note: "Trong CPU", width: "24%" },
  { name: "Cache", where: "Trên bàn học", note: "SRAM", width: "42%" },
  { name: "RAM", where: "Trên kệ sách", note: "DRAM, mất điện là mất", width: "68%" },
  { name: "SSD / HDD", where: "Trong kho", note: "Mất điện vẫn còn", width: "100%" },
];

function MemoryPyramid() {
  return (
    <Frame title="Bộ nhớ: càng gần CPU càng nhanh, nhưng càng ít" hint="Giống đồ dùng học tập: thứ cần gấp thì để gần tay, nhưng tay cầm được rất ít">
      <div className="flex gap-3">
        <div className="flex w-14 shrink-0 flex-col items-center justify-between text-center text-[11px] font-semibold text-green-700">
          <span>Nhanh, ít</span>
          <ArrowDown className="size-5 flex-1 text-muted" />
          <span className="text-amber-700">Chậm, nhiều</span>
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          {LEVELS.map((l) => (
            <div key={l.name}>
              <div className="min-w-fit rounded-lg bg-primary-soft px-2.5 py-1.5 text-primary" style={{ width: l.width }}>
                <b className="whitespace-nowrap text-sm">{l.name}</b>
              </div>
              <p className="mt-0.5 text-xs text-muted">
                {l.where} · {l.note}
              </p>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-3 text-sm">
        <b>Cache</b> đứng giữa <b>CPU và RAM</b>: để sẵn thứ hay dùng, CPU khỏi phải chờ RAM.
      </p>
    </Frame>
  );
}

const SIZE_PRESETS = [
  { value: "4k", label: "Ảnh 4K", w: 3840, h: 2160, fps: 0, sec: 0 },
  { value: "fhd", label: "Ảnh Full HD", w: 1920, h: 1080, fps: 0, sec: 0 },
  { value: "v60", label: "Video 1080p, 60 fps, 30 giây", w: 1920, h: 1080, fps: 60, sec: 30 },
  { value: "v30", label: "Video 480p, 30 fps, 10 giây", w: 640, h: 480, fps: 30, sec: 10 },
];

function SizeCalc() {
  const [id, setId] = useState("4k");
  const p = SIZE_PRESETS.find((x) => x.value === id)!;
  const frame = p.w * p.h * 3;
  const total = p.fps ? frame * p.fps * p.sec : frame;
  const mb = total / 2 ** 20;
  return (
    <Frame title="Tính dung lượng ảnh và video" hint="Bấm để đổi đề bài. Mỗi điểm ảnh RGB có 3 màu, mỗi màu 8 bit = 1 byte, nên tốn 3 byte">
      <Choice label="Chọn đề bài" options={SIZE_PRESETS} value={id} onChange={setId} />
      <div className="flex flex-wrap items-stretch gap-1.5 text-center text-sm">
        <Factor top={p.w.toLocaleString("vi-VN")} bottom="điểm ngang" />
        <Op>×</Op>
        <Factor top={p.h.toLocaleString("vi-VN")} bottom="điểm dọc" />
        <Op>×</Op>
        <Factor top="3" bottom="byte mỗi điểm" />
        {p.fps > 0 && (
          <>
            <Op>×</Op>
            <Factor top={String(p.fps)} bottom="ảnh mỗi giây" />
            <Op>×</Op>
            <Factor top={String(p.sec)} bottom="giây" />
          </>
        )}
      </div>
      <p className="mt-3 text-sm">
        = <b className="tabular-nums">{total.toLocaleString("vi-VN")}</b> byte ≈{" "}
        <b className="text-primary">{mb >= 1024 ? `${(mb / 1024).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} GB` : `${mb.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} MB`}</b>
      </p>
    </Frame>
  );
}

function Factor({ top, bottom }: { top: string; bottom: string }) {
  return (
    <div className="min-w-16 rounded-lg border border-border bg-surface px-2 py-1">
      <b className="tabular-nums">{top}</b>
      <span className="block text-[11px] text-muted">{bottom}</span>
    </div>
  );
}
const Op = ({ children }: { children: ReactNode }) => <span className="self-center font-bold text-muted">{children}</span>;

// ───────────── Phần 2 ─────────────

function CpuRace() {
  const [a, setA] = useState({ f: 0.4, cpi: 3 });
  const [b, setB] = useState({ f: 0.6, cpi: 5 });
  const n = 1000;
  const ta = (n * a.cpi) / a.f;
  const tb = (n * b.cpi) / b.f;
  const max = Math.max(ta, tb);
  const row = (name: string, m: { f: number; cpi: number }, set: (v: { f: number; cpi: number }) => void, t: number, tone: string) => (
    <div className="rounded-xl border border-border bg-surface p-3">
      <b>Máy {name}</b>
      <div className="mt-2 space-y-2">
        <Slider label="Tần số" value={m.f} min={0.2} max={4} step={0.2} unit="GHz" onChange={(f) => set({ ...m, f })} />
        <Slider label="CPI (nhịp cho mỗi lệnh)" value={m.cpi} min={1} max={6} step={0.5} onChange={(cpi) => set({ ...m, cpi })} />
      </div>
      <div className="mt-3 h-3 rounded-full bg-subtle">
        <div className={cn("h-full rounded-full transition-[width] duration-300", tone)} style={{ width: `${(t / max) * 100}%` }} />
      </div>
      <p className="mt-1 text-sm tabular-nums">
        {n} × {m.cpi.toLocaleString("vi-VN")} ÷ {m.f.toLocaleString("vi-VN")} = <b>{Math.round(t).toLocaleString("vi-VN")} ns</b>
      </p>
    </div>
  );
  return (
    <Frame title="Thử đua hai máy, cùng chạy 1000 lệnh" hint="Kéo thanh trượt. Thanh màu càng ngắn tức là càng nhanh">
      <div className="grid gap-2 sm:grid-cols-2">
        {row("A", a, setA, ta, "bg-primary")}
        {row("B", b, setB, tb, "bg-secondary")}
      </div>
      <p className="mt-3 text-sm font-semibold">
        {ta === tb ? "Hai máy bằng nhau." : `Máy ${ta < tb ? "A" : "B"} nhanh hơn ${(Math.max(ta, tb) / Math.min(ta, tb)).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} lần.`}
      </p>
      <p className="mt-1 text-xs text-muted">Thử chỉnh để máy có GHz cao hơn vẫn thua: đó là lý do không chỉ nhìn GHz.</p>
    </Frame>
  );
}

const CLASSES = [
  { name: "Arith", n: 50, c: 4 },
  { name: "Store", n: 20, c: 5 },
  { name: "Load", n: 30, c: 5 },
  { name: "Branch", n: 50, c: 3 },
];

function CycleBars() {
  const total = CLASSES.reduce((s, x) => s + x.n * x.c, 0);
  return (
    <Frame title="Nhiều loại lệnh: tính từng loại rồi cộng lại" hint="Đề: 150 lệnh, máy 2 GHz. Dạng này năm nào cũng có">
      <div className="space-y-1.5">
        {CLASSES.map((x) => (
          <div key={x.name} className="grid grid-cols-[3.5rem_1fr] items-center gap-2 text-sm">
            <span>{x.name}</span>
            <div className="min-w-0 truncate rounded bg-primary-soft px-2 py-0.5 text-primary tabular-nums" style={{ width: `${Math.max(((x.n * x.c) / 200) * 100, 62)}%` }}>
              {x.n} × {x.c} = <b>{x.n * x.c}</b>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-sm">
        Cộng lại: <b>{total} nhịp</b>. Thời gian = {total} ÷ 2 GHz = <b className="text-primary">{total / 2} ns</b>.
      </p>
    </Frame>
  );
}

// ───────────── Phần 3 ─────────────

const REG_GROUPS: { from: number; to: number; tone: string; label: string; tip: (i: number) => string }[] = [
  { from: 0, to: 0, tone: "bg-subtle text-foreground", label: "Luôn bằng 0", tip: () => "Luôn bằng 0" },
  { from: 1, to: 1, tone: "bg-subtle text-muted", label: "Dành riêng", tip: () => "Assembler dùng" },
  { from: 2, to: 3, tone: "bg-secondary-soft text-teal-700", label: "$v: kết quả trả về", tip: () => "Kết quả trả về" },
  { from: 4, to: 7, tone: "bg-warning-soft text-amber-700", label: "$a: tham số", tip: (i) => `4 + ${i - 4} = ${i}` },
  { from: 8, to: 15, tone: "bg-primary-soft text-primary", label: "$t: giấy nháp", tip: (i) => `8 + ${i - 8} = ${i}` },
  { from: 16, to: 23, tone: "bg-success-soft text-green-700", label: "$s: biến cần giữ", tip: (i) => `16 + ${i - 16} = ${i}` },
  { from: 24, to: 25, tone: "bg-primary-soft text-primary", label: "$t8, $t9", tip: (i) => `16 + ${i - 16} = ${i}` },
  { from: 26, to: 28, tone: "bg-subtle text-muted", label: "Dành riêng", tip: () => "Hệ thống dùng" },
  { from: 29, to: 29, tone: "bg-error-soft text-red-700", label: "$sp: đỉnh stack", tip: () => "Đỉnh stack" },
  { from: 30, to: 30, tone: "bg-subtle text-muted", label: "Dành riêng", tip: () => "Con trỏ frame" },
  { from: 31, to: 31, tone: "bg-error-soft text-red-700", label: "$ra: địa chỉ quay về", tip: () => "Địa chỉ quay về" },
];
const groupOf = (i: number) => REG_GROUPS.find((g) => i >= g.from && i <= g.to)!;

function RegisterMap() {
  const [sel, setSel] = useState(13);
  return (
    <Frame title="32 thanh ghi và số thứ tự của chúng" hint="Bấm vào một ô. Làm mã máy phải đổi tên thanh ghi thành số này">
      <div className="grid grid-cols-4 gap-1 sm:grid-cols-8">
        {REG_NAMES.map((name, i) => (
          <button
            key={name}
            type="button"
            aria-pressed={sel === i}
            onClick={() => setSel(i)}
            className={cn("rounded-lg px-1 py-1.5 text-center transition-shadow", groupOf(i).tone, sel === i && "ring-2 ring-primary")}
          >
            <span className="block text-[10px] tabular-nums opacity-80">{i}</span>
            <span className="block font-mono text-xs font-semibold">{name}</span>
          </button>
        ))}
      </div>
      <p className="mt-3 rounded-lg bg-subtle px-3 py-2 text-sm">
        <b className="font-mono">{REG_NAMES[sel]}</b> có số thứ tự <b>{sel}</b>. {groupOf(sel).tip(sel)}.
      </p>
    </Frame>
  );
}

function Bits({ s, tone }: { s: string; tone?: string }) {
  return <span className={cn("font-mono text-xs tabular-nums sm:text-sm", tone)}>{s.replace(/(.{4})(?=.)/g, "$1 ")}</span>;
}

function TwosComplement() {
  const [n, setN] = useState(2024);
  const value = Math.min(Math.max(Math.abs(Math.trunc(n)) || 0, 1), 32767);
  const plus = intToTwosComplement(value, 16);
  const flip = [...plus].map((b) => (b === "0" ? "1" : "0")).join("");
  const minus = intToTwosComplement(-value, 16);
  const hex = (65536 - value).toString(16).toUpperCase().padStart(4, "0");
  return (
    <Frame title="Đổi số âm sang bù hai: 3 bước" hint="Máy không có dấu trừ. Nó dùng bit đầu tiên làm dấu: 1 là âm">
      <label className="mb-3 flex items-center gap-2 text-sm">
        Đổi số âm: <span className="font-bold">−</span>
        <input type="number" min={1} max={32767} value={n} onChange={(e) => setN(Number(e.target.value))} aria-label="Giá trị tuyệt đối" className="w-24 rounded-lg border border-border bg-surface px-2 py-1 tabular-nums" />
      </label>
      <ol className="space-y-2 text-sm">
        <li className="rounded-lg bg-surface p-2.5">
          <b>1. Viết số dương</b>
          <br />
          <Bits s={plus} />
        </li>
        <li className="rounded-lg bg-surface p-2.5">
          <b>2. Đảo mọi bit</b> (0 thành 1, 1 thành 0)
          <br />
          <Bits s={flip} tone="text-amber-700" />
        </li>
        <li className="rounded-lg bg-surface p-2.5">
          <b>3. Cộng thêm 1</b>
          <br />
          <Bits s={minus} tone="text-green-700" /> = <b className="font-mono text-primary">0x{hex}</b>
        </li>
      </ol>
      <p className="mt-2 text-xs text-muted">
        Cách nhanh bằng máy tính: 65536 − {value} = {65536 - value}, đổi sang hex.
      </p>
    </Frame>
  );
}

// ───────────── Phần 4 ─────────────

const BASE = 0x10010008;
const CELLS = [4, 5, 6, 7];
const hexAddr = (a: number) => `0x${a.toString(16).toUpperCase().padStart(8, "0")}`;
const MEM_OPTIONS = [
  { value: "lw0", label: "lw $t1, 0($t0)", op: "lw", off: 0 },
  { value: "lw4", label: "lw $t1, 4($t0)", op: "lw", off: 4 },
  { value: "lw12", label: "lw $t1, 12($t0)", op: "lw", off: 12 },
  { value: "sw8", label: "sw $t1, 8($t0)", op: "sw", off: 8 },
];

function MemoryLwSw() {
  const [id, setId] = useState("lw12");
  const o = MEM_OPTIONS.find((x) => x.value === id)!;
  const addr = BASE + o.off;
  const isLoad = o.op === "lw";
  return (
    <Frame title="lw đọc, sw ghi: máy tìm ô nhớ như thế nào" hint="Bấm từng lệnh. Giả sử $t0 đang chứa địa chỉ 0x10010008, $t1 đang chứa 99">
      <Choice label="Chọn lệnh" options={MEM_OPTIONS} value={id} onChange={setId} />
      <p className="mb-3 rounded-lg bg-subtle px-3 py-2 text-sm">
        Địa chỉ = $t0 + {o.off} = <b className="font-mono">{hexAddr(addr)}</b>
      </p>
      <div className="grid items-center gap-2 sm:grid-cols-[1fr_auto_1fr]">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted">Bộ nhớ</p>
          {CELLS.map((v, i) => {
            const a = BASE + i * 4;
            const hit = a === addr;
            return (
              <div key={a} className={cn("flex justify-between gap-2 rounded-lg border px-2.5 py-1.5", hit ? "border-primary bg-primary-soft" : "border-border bg-surface")}>
                <span className="font-mono text-xs text-muted">{hexAddr(a)}</span>
                <b className="tabular-nums">{hit && !isLoad ? 99 : v}</b>
              </div>
            );
          })}
        </div>
        <div className="flex flex-col items-center text-primary">
          {isLoad ? <ArrowRight className="hidden size-6 sm:block" /> : <ArrowLeft className="hidden size-6 sm:block" />}
          <ArrowDown className={cn("size-5 sm:hidden", !isLoad && "rotate-180")} />
          <span className="text-xs font-semibold">{isLoad ? "đọc ra" : "ghi vào"}</span>
        </div>
        <div>
          <p className="text-xs font-semibold text-muted">Thanh ghi $t1</p>
          <div className="rounded-lg border border-primary bg-primary-soft px-3 py-2 text-center text-lg font-bold tabular-nums">{isLoad ? CELLS[o.off / 4] : 99}</div>
          <p className="mt-1 text-xs text-muted">{isLoad ? "$t1 nhận giá trị mới" : "$t1 giữ nguyên, ô nhớ bị đổi"}</p>
        </div>
      </div>
    </Frame>
  );
}

function ArrayOffset() {
  const [i, setI] = useState(3);
  return (
    <Frame title="Vì sao A[i] phải nhân 4?" hint="Mỗi số chiếm 4 ô byte. Muốn tới phần tử thứ i phải đi qua i × 4 ô. Bấm một phần tử">
      <div className="flex gap-1 overflow-x-auto pb-1">
        {[0, 1, 2, 3, 4, 5].map((k) => (
          <button key={k} type="button" aria-pressed={i === k} onClick={() => setI(k)} className={cn("min-w-12 flex-1 rounded-lg border px-1 py-2 text-center", k === i ? "border-primary bg-primary text-primary-foreground" : k < i ? "border-primary/40 bg-primary-soft" : "border-border bg-surface")}>
            <span className="block font-mono text-sm font-semibold">A[{k}]</span>
            <span className="block text-[11px] tabular-nums opacity-80">+{k * 4}</span>
          </button>
        ))}
      </div>
      <p className="mt-3 text-sm">
        Muốn đọc <b className="font-mono">A[{i}]</b> viết <b className="font-mono text-primary">lw $t0, {i * 4}($s3)</b>, vì {i} × 4 = {i * 4}.
      </p>
    </Frame>
  );
}

// ───────────── Phần 5 ─────────────

const TONES = ["bg-primary-soft text-primary", "bg-success-soft text-green-700", "bg-warning-soft text-amber-700", "bg-error-soft text-red-700", "bg-secondary-soft text-teal-700", "bg-subtle text-foreground"];

interface Field {
  name: string;
  size: number;
  note: string;
  tone: string;
}

function fieldsOf(word: number): Field[] {
  const b = toBin(word);
  const num = (from: number, len: number) => parseInt(b.slice(from, from + len), 2);
  const reg = (v: number) => `${v} = ${REG_NAMES[v]}`;
  const fmt = formatOf(word);
  const hx = (v: number) => `0x${v.toString(16).toUpperCase()}`;
  if (fmt === "R") {
    return [
      { name: "op", size: 6, note: "Luôn 0 với nhóm R", tone: TONES[0] },
      { name: "rs", size: 5, note: reg(num(6, 5)), tone: TONES[1] },
      { name: "rt", size: 5, note: reg(num(11, 5)), tone: TONES[2] },
      { name: "rd", size: 5, note: reg(num(16, 5)), tone: TONES[3] },
      { name: "shamt", size: 5, note: `Dịch ${num(21, 5)} bit`, tone: TONES[4] },
      { name: "funct", size: 6, note: `Tên lệnh: ${hx(num(26, 6))}`, tone: TONES[5] },
    ];
  }
  if (fmt === "J") {
    return [
      { name: "op", size: 6, note: `Tên lệnh: ${hx(num(0, 6))}`, tone: TONES[0] },
      { name: "address", size: 26, note: `Địa chỉ ÷ 4 = ${num(6, 26)}`, tone: TONES[1] },
    ];
  }
  const imm = num(16, 16);
  return [
    { name: "op", size: 6, note: `Tên lệnh: ${hx(num(0, 6))}`, tone: TONES[0] },
    { name: "rs", size: 5, note: reg(num(6, 5)), tone: TONES[1] },
    { name: "rt", size: 5, note: reg(num(11, 5)), tone: TONES[2] },
    { name: "immediate", size: 16, note: `Số: ${imm >= 0x8000 ? imm - 0x10000 : imm} (${hx(imm)})`, tone: TONES[3] },
  ];
}

const ENC_PRESETS = ["add $t0, $s1, $s2", "lw $t3, -12($s0)", "sw $t5, -36($s1)", "srl $t8, $s5, 23", "andi $s2, $s4, 512", "addi $t0, $zero, 4"];
const DEC_PRESETS = ["0xAD190008", "0x010F502A", "0x316C007C", "0x29ABFF79", "0x000A90C2"];

function Encoder() {
  const [mode, setMode] = useState<"enc" | "dec">("enc");
  const [asm, setAsm] = useState(ENC_PRESETS[0]);
  const [hex, setHex] = useState(DEC_PRESETS[0]);

  const { word, error, text } = useMemo(() => {
    try {
      if (mode === "enc") return { word: encode(asm.trim()), error: null, text: asm.trim() };
      const h = hex.trim().replace(/^0x/i, "");
      if (!/^[0-9a-f]{1,8}$/i.test(h)) throw new Error("Hãy nhập số hex, ví dụ 0xAD190008.");
      const w = Number.parseInt(h, 16);
      return { word: w, error: null, text: decode(w) };
    } catch (e) {
      return { word: 0, error: e instanceof Error ? e.message : "Không đọc được.", text: "" };
    }
  }, [mode, asm, hex]);

  const fields = error ? [] : fieldsOf(word);
  const bits = toBin(word);
  const toneAt: string[] = [];
  for (const f of fields) for (let i = 0; i < f.size; i++) toneAt.push(f.tone);
  const presets = mode === "enc" ? ENC_PRESETS : DEC_PRESETS;
  const current = mode === "enc" ? asm : hex;
  const setCurrent = mode === "enc" ? setAsm : setHex;

  return (
    <Frame title="Máy đổi mã: tự gõ để xem" hint="Có thể gõ lệnh trong đề để tự kiểm tra (trừ beq, j, vì chúng cần biết địa chỉ)">
      <Choice label="Chiều đổi" options={[{ value: "enc", label: "Lệnh → Hex" }, { value: "dec", label: "Hex → Lệnh" }]} value={mode} onChange={setMode} />
      <input
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
        spellCheck={false}
        aria-label={mode === "enc" ? "Nhập lệnh MIPS" : "Nhập mã hex"}
        className="w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-sm"
      />
      <div className="mt-2 flex flex-wrap gap-1">
        {presets.map((p) => (
          <button key={p} type="button" onClick={() => setCurrent(p)} className="rounded-md border border-border bg-surface px-2 py-1 font-mono text-[11px] text-muted hover:border-primary/40 hover:text-primary">
            {p}
          </button>
        ))}
      </div>

      {error ? (
        <p className="mt-3 rounded-lg bg-error-soft px-3 py-2 text-sm text-red-700">{error}</p>
      ) : (
        <div className="mt-4 space-y-4">
          <div>
            <p className="mb-1.5 text-xs font-semibold text-muted">Bước 1. Xếp vào các ô: dạng {formatOf(word)}</p>
            <div className="grid gap-1 sm:flex">
              {fields.map((f, i) => {
                const start = fields.slice(0, i).reduce((s, x) => s + x.size, 0);
                return (
                  <div key={f.name} className={cn("min-w-0 rounded-lg px-2 py-1.5", f.tone)} style={{ flexGrow: f.size, flexBasis: 0 }}>
                    <b className="text-xs">{f.name}</b>
                    <span className="block break-all font-mono text-xs">{bits.slice(start, start + f.size)}</span>
                    <span className="block text-[11px] opacity-90">{f.note}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-semibold text-muted">Bước 2. Gom mỗi 4 bit thành 1 chữ số hex</p>
            <div className="grid grid-cols-4 gap-1 sm:grid-cols-8">
              {Array.from({ length: 8 }, (_, n) => (
                <div key={n} className="rounded-lg border border-border bg-surface p-1 text-center">
                  <span className="flex justify-center font-mono text-xs">
                    {[0, 1, 2, 3].map((k) => (
                      <span key={k} className={cn("rounded-sm px-px", toneAt[n * 4 + k])}>
                        {bits[n * 4 + k]}
                      </span>
                    ))}
                  </span>
                  <b className="font-mono">{parseInt(bits.slice(n * 4, n * 4 + 4), 2).toString(16).toUpperCase()}</b>
                </div>
              ))}
            </div>
          </div>
          <p className="rounded-lg bg-primary-soft px-3 py-2 text-sm">
            <b className="font-mono">{text}</b> <span className="text-muted">là</span> <b className="font-mono text-primary">{toHex(word)}</b>
          </p>
        </div>
      )}
    </Frame>
  );
}

function BranchCount() {
  const rows = [
    { addr: 80012, code: "bne $t0, $s5, Exit", tag: "Đứng ở đây", tone: "bg-warning-soft" },
    { addr: 80016, code: "addi $s3, $s3, 1", tag: "Bắt đầu đếm: 0", tone: "bg-surface" },
    { addr: 80020, code: "j Loop", tag: "Đếm: 1", tone: "bg-surface" },
    { addr: 80024, code: "Exit:", tag: "Đếm: 2, tới nơi", tone: "bg-success-soft" },
  ];
  return (
    <Frame title="beq, bne lưu gì? Đếm số lệnh phải nhảy" hint="Đếm bắt đầu từ lệnh ngay sau nó, không phải từ chính nó">
      <div className="space-y-1">
        {rows.map((r) => (
          <div key={r.addr} className={cn("grid grid-cols-[3.2rem_1fr] gap-x-2 rounded-lg px-2.5 py-1.5 sm:grid-cols-[3.2rem_1fr_auto]", r.tone)}>
            <span className="font-mono text-xs text-muted">{r.addr}</span>
            <span className="min-w-0 font-mono text-[13px]">{r.code}</span>
            <b className="col-span-2 text-xs text-primary sm:col-span-1">{r.tag}</b>
          </div>
        ))}
      </div>
      <p className="mt-3 text-sm">
        Nhảy lên phía trên thì đếm ra số âm. Kiểm tra bằng công thức: (80024 − 80016) ÷ 4 = <b className="text-primary">2</b>.
      </p>
    </Frame>
  );
}

// ───────────── Phần 6 ─────────────

function BitShift() {
  const [dir, setDir] = useState<"sll" | "srl">("sll");
  const [k, setK] = useState(2);
  const v = 6;
  const out = dir === "sll" ? (v << k) & 0xff : v >> k;
  const bits = v.toString(2).padStart(8, "0");
  const res = out.toString(2).padStart(8, "0");
  return (
    <Frame title="Dịch bit: nhân chia cực nhanh" hint="Trong hệ 10, thêm số 0 vào cuối là nhân 10. Trong hệ 2, thêm số 0 là nhân 2">
      <Choice label="Hướng dịch" options={[{ value: "sll", label: "sll: dịch trái" }, { value: "srl", label: "srl: dịch phải" }]} value={dir} onChange={setDir} />
      <Slider label="Số bit dịch" value={k} min={0} max={3} step={1} onChange={setK} />
      <div className="mt-3 space-y-2">
        <BitRow label={`Ban đầu = ${v}`} bits={bits} />
        <BitRow label={`Sau khi dịch = ${out}`} bits={res} highlight />
      </div>
      <p className="mt-3 text-sm">
        {dir === "sll" ? `Dịch trái ${k} bit là nhân ${2 ** k}: ${v} × ${2 ** k} = ${out}.` : `Dịch phải ${k} bit là chia ${2 ** k}, bỏ phần dư: ${v} ÷ ${2 ** k} = ${out}.`} Chỗ trống luôn được điền số 0.
      </p>
    </Frame>
  );
}

function BitRow({ label, bits, highlight, onToggle }: { label: string; bits: string; highlight?: boolean; onToggle?: (i: number) => void }) {
  return (
    <div>
      <p className="mb-1 text-xs text-muted">{label}</p>
      <div className="grid grid-cols-8 gap-1">
        {[...bits].map((b, i) => {
          const cls = cn("rounded-md py-1.5 text-center font-mono text-sm font-bold", b === "1" ? (highlight ? "bg-primary text-primary-foreground" : "bg-primary-soft text-primary") : "bg-subtle text-muted");
          return onToggle ? (
            <button key={i} type="button" aria-label={`Đổi bit thứ ${i + 1}`} onClick={() => onToggle(i)} className={cn(cls, "hover:ring-2 hover:ring-primary/40")}>
              {b}
            </button>
          ) : (
            <div key={i} className={cls}>
              {b}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BitLogic() {
  const [op, setOp] = useState<"and" | "or">("and");
  const [a, setA] = useState("11001010");
  const [b, setB] = useState("10101100");
  const flip = (s: string, i: number) => s.slice(0, i) + (s[i] === "1" ? "0" : "1") + s.slice(i + 1);
  const r = [...a].map((x, i) => (op === "and" ? (x === "1" && b[i] === "1" ? "1" : "0") : x === "1" || b[i] === "1" ? "1" : "0")).join("");
  return (
    <Frame title="AND và OR: so từng cặp bit theo cột" hint="Bấm vào các bit ở hai hàng trên để thử">
      <Choice label="Phép toán" options={[{ value: "and", label: "AND: cả hai là 1 mới ra 1" }, { value: "or", label: "OR: có một số 1 là ra 1" }]} value={op} onChange={setOp} />
      <div className="space-y-2">
        <BitRow label="Số thứ nhất" bits={a} onToggle={(i) => setA(flip(a, i))} />
        <BitRow label="Số thứ hai" bits={b} onToggle={(i) => setB(flip(b, i))} />
        <BitRow label="Kết quả" bits={r} highlight />
      </div>
    </Frame>
  );
}

// ───────────── Phần 7 ─────────────

function describe(line: string, before: Record<string, number>, after: Record<string, number>, jumped: boolean): string {
  const clean = line.replace(/#.*$/, "").replace(/^[A-Za-z_]\w*:\s*/, "").trim();
  const [op, ...rest] = clean.split(/[\s,]+/).filter(Boolean);
  const v = (x: string) => (/^-?\d+$/.test(x) ? Number(x) : before[x === "$0" ? "$zero" : x]);
  const [d, a, b] = rest;
  switch (op) {
    case "slt":
    case "slti":
      return `${v(a)} < ${v(b)} ${after[d] ? "đúng" : "sai"}, nên ${d} = ${after[d]}.`;
    case "beq":
      return v(d) === v(a) ? `${v(d)} bằng ${v(a)}, nên nhảy tới ${b}.` : `${v(d)} khác ${v(a)}, nên không nhảy, đi tiếp xuống dưới.`;
    case "bne":
      return v(d) !== v(a) ? `${v(d)} khác ${v(a)}, nên nhảy tới ${b}.` : `${v(d)} bằng ${v(a)}, nên không nhảy, đi tiếp xuống dưới.`;
    case "addi":
    case "add":
      return `${d} = ${v(a)} + ${v(b)} = ${after[d]}.`;
    case "sub":
      return `${d} = ${v(a)} − ${v(b)} = ${after[d]}.`;
    case "sll":
      return `${d} = ${v(a)} × ${2 ** Number(b)} = ${after[d]} (dịch trái ${b} bit).`;
    case "j":
      return `Luôn nhảy tới ${d}.`;
    default:
      return jumped ? `Nhảy tiếp.` : `Chạy lệnh ${op}.`;
  }
}

function Tracer() {
  const [id, setId] = useState(TRACES[0].id);
  const [step, setStep] = useState(0);
  const ex = TRACES.find((t) => t.id === id)!;
  const trace = useMemo(() => traceProgram(ex.code.join("\n"), { regs: ex.regs }), [ex]);
  const total = trace.steps.length;
  const cur = trace.steps[step - 1];
  const regs = cur ? cur.after : (trace.initial);
  const prev = cur ? cur.before : trace.initial;
  const done = step === total;
  return (
    <Frame title="Máy chạy từng dòng: bấm “Bước tiếp”" hint="Khi thi hãy kẻ bảng và làm y như vậy trên giấy">
      <Choice
        label="Chọn đoạn lệnh"
        options={TRACES.map((t) => ({ value: t.id, label: t.title }))}
        value={id}
        onChange={(v) => {
          setId(v);
          setStep(0);
        }}
      />
      <div className="grid gap-3 sm:grid-cols-[1.3fr_1fr]">
        <ol className="min-w-0 overflow-x-auto rounded-xl border border-border bg-surface py-1.5">
          {ex.code.map((line, i) => (
            <li key={i} className={cn(CODE, "whitespace-pre px-3 py-0.5", cur?.line === i && "bg-primary-soft font-semibold text-primary")}>
              {line}
            </li>
          ))}
        </ol>
        <div className="grid grid-cols-3 content-start gap-1 sm:grid-cols-2">
          {ex.watch.map((r) => (
            <div key={r} className={cn("rounded-lg border p-2 text-center transition-colors", cur && regs[r] !== prev[r] ? "border-primary bg-primary-soft" : "border-border bg-surface")}>
              <span className="block font-mono text-xs text-muted">{r}</span>
              <b className="text-lg tabular-nums">{regs[r]}</b>
            </div>
          ))}
        </div>
      </div>
      <p aria-live="polite" className="mt-3 min-h-11 rounded-lg bg-subtle px-3 py-2 text-sm">
        {step === 0 ? "Chưa chạy. Đây là giá trị ban đầu." : describe(ex.code[cur.line], cur.before, cur.after, cur.jumped)}
        {done && <b className="block text-primary">Xong, sau {total} lần chạy lệnh.</b>}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
          <ArrowLeft /> Lùi
        </Button>
        <Button size="sm" disabled={done} onClick={() => setStep((s) => s + 1)}>
          Bước tiếp <ArrowRight />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setStep(0)}>
          <RotateCcw /> Làm lại
        </Button>
      </div>
    </Frame>
  );
}

// ───────────── Phần 8 ─────────────

const STACK_STEPS = [
  { code: "(ban đầu)", sp: 0x1000, cell: null as number | null, s0: 5, why: "$s0 đang giữ số 5 của người gọi. Thủ tục muốn mượn $s0." },
  { code: "addi $sp, $sp, -4", sp: 0xffc, cell: null, s0: 5, why: "Chừa một chỗ trống: stack lớn dần xuống địa chỉ nhỏ hơn." },
  { code: "sw $s0, 0($sp)", sp: 0xffc, cell: 5, s0: 5, why: "Cất số 5 vào chỗ vừa chừa." },
  { code: "addi $s0, $zero, 9", sp: 0xffc, cell: 5, s0: 9, why: "Giờ thoải mái dùng $s0." },
  { code: "lw $s0, 0($sp)", sp: 0xffc, cell: 5, s0: 5, why: "Dùng xong, lấy lại số 5." },
  { code: "addi $sp, $sp, 4", sp: 0x1000, cell: 5, s0: 5, why: "Trả lại chỗ. $s0 và $sp đều như lúc đầu, người gọi không hề hay biết." },
];

function StackStepper() {
  const [i, setI] = useState(0);
  const s = STACK_STEPS[i];
  const hex = (a: number) => `0x${a.toString(16).toUpperCase().padStart(4, "0")}`;
  return (
    <Frame title="Stack như chồng đĩa: mượn thì phải trả" hint="Đĩa đặt sau cùng được lấy ra trước (LIFO). Bấm để xem từng lệnh">
      <p className={cn(CODE, "mb-3 rounded-lg bg-primary-soft px-3 py-2 font-semibold text-primary")}>{s.code}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          {[0x1000, 0xffc].map((a) => (
            <div key={a} className={cn("flex items-center justify-between gap-2 rounded-lg border px-3 py-2", s.sp === a ? "border-primary bg-primary-soft" : "border-border bg-surface")}>
              <span className="font-mono text-xs text-muted">{hex(a)}</span>
              <b className="tabular-nums">{a === 0xffc ? (s.cell ?? "trống") : "đã có dữ liệu"}</b>
              {s.sp === a && <span className="text-xs font-bold text-primary">← $sp</span>}
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-border bg-surface p-3 text-center">
          <span className="block font-mono text-xs text-muted">$s0</span>
          <b className="text-2xl tabular-nums">{s.s0}</b>
        </div>
      </div>
      <p aria-live="polite" className="mt-3 min-h-11 rounded-lg bg-subtle px-3 py-2 text-sm">
        {s.why}
      </p>
      <div className="mt-2 flex gap-2">
        <Button size="sm" variant="outline" disabled={i === 0} onClick={() => setI(i - 1)}>
          <ArrowLeft /> Lùi
        </Button>
        <Button size="sm" disabled={i === STACK_STEPS.length - 1} onClick={() => setI(i + 1)}>
          Bước tiếp <ArrowRight />
        </Button>
      </div>
    </Frame>
  );
}

// ───────────── Phần 9 ─────────────

function CToMips() {
  const [id, setId] = useState(WALKTHROUGHS[1].id);
  const [i, setI] = useState(0);
  const w = WALKTHROUGHS.find((x) => x.id === id)!;
  const s = w.steps[i];
  const at = w.c.indexOf(s.piece);
  return (
    <Frame title="Dịch C sang MIPS: mỗi mảnh C ứng với lệnh nào" hint="Chọn dạng bài rồi bấm từng bước. Tô màu cho biết đoạn C và các lệnh tương ứng">
      <Choice
        label="Chọn dạng bài"
        options={WALKTHROUGHS.map((x) => ({ value: x.id, label: x.title }))}
        value={id}
        onChange={(v) => {
          setId(v);
          setI(0);
        }}
      />
      <p className="mb-2 text-xs text-muted">{w.vars}</p>
      <p className={cn(CODE, "mb-3 break-words rounded-lg bg-surface px-3 py-2")}>
        {at >= 0 ? (
          <>
            {w.c.slice(0, at)}
            <mark className="rounded bg-warning-soft px-0.5 font-semibold text-amber-700">{s.piece}</mark>
            {w.c.slice(at + s.piece.length)}
          </>
        ) : (
          w.c
        )}
      </p>
      <ol className="overflow-x-auto rounded-xl border border-border bg-surface py-1.5">
        {w.code.map((line, n) => (
          <li key={n} className={cn(CODE, "whitespace-pre px-3 py-0.5", s.lines.includes(n) && "bg-primary-soft font-semibold text-primary")}>
            {line}
          </li>
        ))}
      </ol>
      <p aria-live="polite" className="mt-3 min-h-11 rounded-lg bg-subtle px-3 py-2 text-sm">
        {s.why}
      </p>
      <div className="mt-2 flex items-center gap-2">
        <Button size="sm" variant="outline" disabled={i === 0} onClick={() => setI(i - 1)}>
          <ArrowLeft /> Lùi
        </Button>
        <Button size="sm" disabled={i === w.steps.length - 1} onClick={() => setI(i + 1)}>
          Bước tiếp <ArrowRight />
        </Button>
        <span className="text-xs tabular-nums text-muted">
          {i + 1}/{w.steps.length}
        </span>
      </div>
    </Frame>
  );
}

export const VISUALS: Record<string, () => ReactNode> = {
  "hex-table": HexTable,
  "compile-flow": CompileFlow,
  "memory-pyramid": MemoryPyramid,
  "size-calc": SizeCalc,
  "cpu-race": CpuRace,
  "cycle-bars": CycleBars,
  "register-map": RegisterMap,
  twos: TwosComplement,
  "memory-lwsw": MemoryLwSw,
  "array-offset": ArrayOffset,
  encoder: Encoder,
  "branch-count": BranchCount,
  "bit-shift": BitShift,
  "bit-logic": BitLogic,
  tracer: Tracer,
  stack: StackStepper,
  "c-to-mips": CToMips,
};

import { decode, encode, intToTwosComplement, REG_NAMES, regIndex, run, toHex } from "@/lib/mips/mips";
import { int, pick, vn, type Draft, type GeneratorTemplate, type Rng } from "./generator-utils";

/** Các dạng bài tính toán IT006 — Chương 1 và Chương 2. Đáp án tính bằng code và bộ mô phỏng MIPS. */

export const C1A = "it006-c1a";
export const C1B = "it006-c1b";
export const C2A = "it006-c2a";
export const C2B = "it006-c2b";
export const C2C = "it006-c2c";

const base = { courseId: "it006" } as const;
const code = (lines: string[]) => "```mips\n" + lines.join("\n") + "\n```";
const hex = (n: number, width = 8) => `\`0x${(n >>> 0).toString(16).toUpperCase().padStart(width, "0")}\``;
const hexw = (n: number) => `\`${toHex(n)}\``;
const tick = (s: string) => `\`${s}\``;

const TEMP = ["$t0", "$t1", "$t2", "$t3", "$t4", "$t5", "$t6", "$t7"] as const;
const SAVED = ["$s0", "$s1", "$s2", "$s3", "$s4", "$s5", "$s6", "$s7"] as const;
const ANY = [...TEMP, ...SAVED] as const;

/** Chọn k phần tử khác nhau. */
function some<T>(rng: Rng, arr: readonly T[], k: number): T[] {
  const a = [...arr];
  const out: T[] = [];
  for (let i = 0; i < k; i++) out.push(a.splice(Math.floor(rng() * a.length), 1)[0]);
  return out;
}

/** Thời gian theo đơn vị dễ đọc. */
function time(sec: number): string {
  if (sec >= 1) return `${vn(sec)} s`;
  if (sec >= 1e-3) return `${vn(sec * 1e3)} ms`;
  if (sec >= 1e-6) return `${vn(sec * 1e6)} µs`;
  return `${vn(sec * 1e9)} ns`;
}

function freq(hz: number): string {
  if (hz >= 1e9) return `${vn(hz / 1e9)} GHz`;
  if (hz >= 1e6) return `${vn(hz / 1e6)} MHz`;
  return `${vn(hz / 1e3)} KHz`;
}

const pow10 = (e: number) => `$10^{${e}}$`;

export const IT006_TEMPLATES: GeneratorTemplate[] = [
  // ───────────── Chương 1a ─────────────
  {
    id: "it006-frame-buffer",
    chapterId: C1A,
    title: "Dung lượng frame buffer",
    build(rng): Draft {
      const [w, h] = pick(rng, [[640, 480], [800, 600], [1280, 720], [1280, 800], [1920, 1080], [2560, 1440], [3840, 2160], [4096, 2160]] as const);
      const bits = pick(rng, [8, 10, 12]);
      const channels = pick(rng, [{ n: 3, name: "RGB" }, { n: 4, name: "CMYK" }]);
      const totalBits = w * h * channels.n * bits;
      const mb = totalBits / 8 / 2 ** 20;
      return {
        ...base,
        template: "Frame buffer",
        chapterId: C1A,
        content: `Một ảnh có độ phân giải **${w} × ${h}** pixel, dùng hệ màu **${channels.name}** (${channels.n} kênh), mỗi kênh **${bits} bit**. Dung lượng tối thiểu của frame buffer để chứa một khung ảnh xấp xỉ bao nhiêu MB (1 MB = $2^{20}$ byte)?`,
        correct: `${vn(mb, 2)} MB`,
        distractors: [
          { text: `${vn(totalBits / 2 ** 20, 2)} MB`, why: "Quên chia 8 để đổi bit sang byte." },
          { text: `${vn((w * h * bits) / 8 / 2 ** 20, 2)} MB`, why: `Quên nhân số kênh màu (${channels.n}).` },
          { text: `${vn((w * h * channels.n) / 2 ** 20, 2)} MB`, why: "Coi mỗi kênh chỉ chiếm 1 byte, chưa tính đúng số bit mỗi kênh." },
          { text: `${vn(totalBits / 8 / 2 ** 10, 2)} MB`, why: "Chia sai đơn vị: chia $2^{10}$ là ra KB, không phải MB." },
        ],
        explanation: {
          correct: `Số bit = ${w} × ${h} × ${channels.n} × ${bits} = ${totalBits} bit = ${totalBits / 8} byte ≈ ${vn(mb, 2)} MB.`,
          tip: "Dung lượng = số pixel × số kênh × số bit mỗi kênh; rồi **chia 8** ra byte.",
        },
        difficulty: "medium",
      };
    },
  },
  {
    id: "it006-unit",
    chapterId: C1A,
    title: "Đổi đơn vị lưu trữ",
    build(rng): Draft {
      const unit = pick(rng, [{ n: "KB", e: 10 }, { n: "MB", e: 20 }, { n: "GB", e: 30 }, { n: "TB", e: 40 }, { n: "PB", e: 50 }]);
      const k = pick(rng, [0, 1, 2, 3, 4]);
      const asBit = rng() < 0.5;
      const e = unit.e + k + (asBit ? 3 : 0);
      const p = (x: number) => `$2^{${x}}$`;
      return {
        ...base,
        template: "Đơn vị lưu trữ",
        chapterId: C1A,
        content: `**${2 ** k} ${unit.n}** bằng bao nhiêu **${asBit ? "bit" : "byte"}**?`,
        correct: p(e),
        distractors: [
          { text: p(asBit ? e - 3 : e + 3), why: asBit ? "Đây là số byte; đổi sang bit phải nhân 8 ($2^3$)." : "Đây là số bit; đề hỏi byte." },
          { text: p(e + 10), why: "Nhầm sang đơn vị lớn hơn một bậc ($2^{10}$ lần)." },
          { text: p(e - 10), why: "Nhầm sang đơn vị nhỏ hơn một bậc." },
          { text: p(e + 1), why: "Tính sai số mũ." },
        ],
        explanation: { correct: `${2 ** k} = $2^{${k}}$; 1 ${unit.n} = $2^{${unit.e}}$ byte${asBit ? "; 1 byte = $2^3$ bit" : ""} → $2^{${e}}$ ${asBit ? "bit" : "byte"}.`, tip: "KB, MB, GB, TB, PB = $2^{10}, 2^{20}, 2^{30}, 2^{40}, 2^{50}$ byte." },
        difficulty: "easy",
      };
    },
  },

  // ───────────── Chương 1b ─────────────
  {
    id: "it006-cpu-time",
    chapterId: C1B,
    title: "Thời gian thực thi CPU",
    build(rng): Draft {
      const ic = pick(rng, [2, 4, 5, 6, 8, 10]);
      const e = pick(rng, [6, 7, 8, 9]);
      const cpi = pick(rng, [1, 1.5, 2, 2.5, 3, 4]);
      const f = pick(rng, [1, 2, 2.5, 4, 5]);
      const t = (ic * 10 ** e * cpi) / (f * 1e9);
      return {
        ...base,
        template: "CPU Time",
        chapterId: C1B,
        content: `Một chương trình có **${ic} × ${pow10(e)} lệnh**, **CPI = ${vn(cpi)}**, chạy trên bộ xử lý **${vn(f)} GHz**. Thời gian thực thi của chương trình là:`,
        correct: time(t),
        distractors: [
          { text: time((ic * 10 ** e) / (f * 1e9)), why: "Quên nhân CPI." },
          { text: time((ic * 10 ** e * cpi * f) / 1e9 / (f * f) / (cpi === 1 ? 2 : 1) * (cpi === 1 ? 1 : cpi)), why: "Nhân thừa CPI hoặc tính sai số chu kỳ." },
          { text: time((ic * 10 ** e * f * 1e9) / 1e18 / cpi), why: "Đảo vị trí CPI và tần số trong công thức." },
          { text: time(t * 1000), why: "Đổi sai đơn vị thời gian." },
          { text: time(t / 1000), why: "Đổi sai đơn vị thời gian." },
        ],
        explanation: { correct: `CPU Time = IC × CPI / Clock Rate = ${ic} × ${pow10(e)} × ${vn(cpi)} / (${vn(f)} × $10^9$) = ${time(t)}.`, tip: "Số lệnh × chu kỳ/lệnh ÷ chu kỳ/giây = giây." },
        difficulty: "easy",
      };
    },
  },
  {
    id: "it006-clock",
    chapterId: C1B,
    title: "Chu kỳ và tần số xung clock",
    build(rng): Draft {
      const toFreq = rng() < 0.5;
      if (toFreq) {
        const [txt, sec] = pick(rng, [["250 ps", 250e-12], ["500 ps", 500e-12], ["2 ns", 2e-9], ["4 ns", 4e-9], ["5 ns", 5e-9], ["2 µs", 2e-6], ["4 µs", 4e-6], ["5 µs", 5e-6]] as const);
        const f = 1 / sec;
        return {
          ...base,
          template: "Chu kỳ xung clock",
          chapterId: C1B,
          content: `Chu kỳ xung clock là **${txt}** thì tần số xung clock là:`,
          correct: freq(f),
          distractors: [
            { text: freq(f * 1000), why: "Sai một bậc đơn vị (nhầm giữa KHz, MHz, GHz)." },
            { text: freq(f / 1000), why: "Sai một bậc đơn vị." },
            { text: freq(f * 2), why: "Tính sai phép nghịch đảo." },
            { text: freq(f / 2), why: "Tính sai phép nghịch đảo." },
          ],
          explanation: { correct: `Clock Rate = 1 / Clock Cycle Time = 1 / ${txt} = ${freq(f)}.` },
          difficulty: "easy",
        };
      }
      const f = pick(rng, [1, 2, 2.5, 4, 5, 8]);
      const ns = 1 / f;
      const fmt = (x: number) => (x >= 1 ? `${vn(x)} ns` : `${vn(x * 1000)} ps`);
      return {
        ...base,
        template: "Chu kỳ xung clock",
        chapterId: C1B,
        content: `Bộ xử lý có tần số xung clock **${vn(f)} GHz**. Chu kỳ xung clock là:`,
        correct: fmt(ns),
        distractors: [
          { text: fmt(ns * 10), why: "Sai một bậc khi tính nghịch đảo." },
          { text: fmt(ns / 10), why: "Sai một bậc khi tính nghịch đảo." },
          { text: fmt(f), why: "Lấy luôn giá trị tần số thay vì nghịch đảo." },
          { text: `${vn(ns)} µs`, why: "Sai đơn vị: $10^{-9}$ s là ns." },
        ],
        explanation: { correct: `Clock Cycle Time = 1 / (${vn(f)} × $10^9$) s = ${fmt(ns)}.` },
        difficulty: "easy",
      };
    },
  },
  {
    id: "it006-avg-cpi",
    chapterId: C1B,
    title: "CPI trung bình",
    build(rng): Draft {
      const mix = pick(rng, [[50, 30, 20], [40, 40, 20], [60, 20, 20], [30, 50, 20], [25, 25, 50], [10, 30, 60], [20, 30, 50]] as const);
      const cpis = some(rng, [1, 2, 3, 4, 5], 3);
      const avg = (mix[0] * cpis[0] + mix[1] * cpis[1] + mix[2] * cpis[2]) / 100;
      const simple = (cpis[0] + cpis[1] + cpis[2]) / 3;
      return {
        ...base,
        template: "CPI trung bình",
        chapterId: C1B,
        content: `Chương trình gồm 3 lớp lệnh:\n\n| Lớp | CPI | Tỉ lệ lệnh |\n|---|---|---|\n| A | ${cpis[0]} | ${mix[0]}% |\n| B | ${cpis[1]} | ${mix[1]}% |\n| C | ${cpis[2]} | ${mix[2]}% |\n\nCPI trung bình của chương trình là:`,
        correct: vn(avg, 2),
        distractors: [
          { text: vn(simple, 2), why: "Đây là trung bình cộng đơn giản, chưa tính theo tỉ lệ lệnh." },
          { text: vn(avg + 0.5, 2), why: "Tính sai tổng có trọng số." },
          { text: vn(avg - 0.3, 2), why: "Tính sai tổng có trọng số." },
          { text: vn(cpis[0] + cpis[1] + cpis[2], 2), why: "Chỉ cộng các CPI, chưa nhân tỉ lệ." },
        ],
        explanation: { correct: `CPI = ${mix[0] / 100} × ${cpis[0]} + ${mix[1] / 100} × ${cpis[1]} + ${mix[2] / 100} × ${cpis[2]} = ${vn(avg, 2)}.`, tip: "CPI trung bình = Σ(tỉ lệ × CPI), **không** phải trung bình cộng." },
        difficulty: "medium",
      };
    },
  },
  {
    id: "it006-compare",
    chapterId: C1B,
    title: "So sánh hiệu suất hai máy",
    build(rng): Draft {
      let fa = 0, fb = 0, ca = 0, cb = 0;
      do {
        fa = pick(rng, [1, 2, 2.5, 3, 4]);
        fb = pick(rng, [1, 2, 2.5, 3, 4]);
        ca = pick(rng, [1, 1.2, 1.5, 2, 2.5, 3]);
        cb = pick(rng, [1, 1.2, 1.5, 2, 2.5, 3]);
      } while (Math.abs(ca / fa - cb / fb) < 1e-9);
      const ta = ca / fa;
      const tb = cb / fb;
      const aFaster = ta < tb;
      const ratio = aFaster ? tb / ta : ta / tb;
      const line = (who: string, r: number) => `Máy ${who} nhanh hơn ${vn(r, 2)} lần`;
      return {
        ...base,
        template: "So sánh hiệu suất",
        chapterId: C1B,
        content: `Máy A có tần số **${vn(fa)} GHz**, **CPI = ${vn(ca)}**; máy B có tần số **${vn(fb)} GHz**, **CPI = ${vn(cb)}**. Cả hai chạy cùng một chương trình (cùng số lệnh). Phát biểu nào đúng?`,
        correct: line(aFaster ? "A" : "B", ratio),
        distractors: [
          { text: line(aFaster ? "B" : "A", ratio), why: `Máy có thời gian thực thi nhỏ hơn mới nhanh hơn; ở đây là máy ${aFaster ? "A" : "B"}.` },
          { text: line(aFaster ? "A" : "B", fa > fb ? fa / fb : fb / fa === 1 ? ratio + 0.5 : fb / fa), why: "Chỉ so sánh tần số, chưa xét CPI." },
          { text: line(aFaster ? "B" : "A", ca > cb ? ca / cb : cb / ca === 1 ? ratio + 0.25 : cb / ca), why: "Chỉ so sánh CPI, chưa xét tần số." },
          { text: "Hai máy có hiệu suất bằng nhau", why: "CPI/tần số của hai máy khác nhau nên thời gian thực thi khác nhau." },
        ],
        explanation: {
          correct: `Thời gian mỗi lệnh: A = ${vn(ca)} / ${vn(fa)} = ${vn(ta, 3)} ns; B = ${vn(cb)} / ${vn(fb)} = ${vn(tb, 3)} ns. Máy ${aFaster ? "A" : "B"} nhanh hơn ${vn(ratio, 2)} lần.`,
          tip: "GHz cao hơn **chưa chắc** nhanh hơn: phải xét cả CPI.",
        },
        difficulty: "medium",
      };
    },
  },
  {
    id: "it006-ipc",
    chapterId: C1B,
    title: "Tính IPC",
    build(rng): Draft {
      const f = pick(rng, [1, 2, 3, 4]);
      const t = pick(rng, [2, 4, 5, 8, 10]);
      const ipc = pick(rng, [0.5, 1, 1.5, 2, 2.5, 3]);
      const ic = f * t * ipc;
      return {
        ...base,
        template: "IPC",
        chapterId: C1B,
        content: `Bộ xử lý có Clock Rate = **${f} GHz**, thực thi một chương trình có **${vn(ic)} × $10^9$ lệnh** trong **${t} giây**. Số lệnh thực thi trong một chu kỳ (IPC) là:`,
        correct: vn(ipc, 2),
        distractors: [
          { text: vn(1 / ipc, 2) === vn(ipc, 2) ? vn(ipc + 1, 2) : vn(1 / ipc, 2), why: "Đây là CPI (nghịch đảo của IPC), không phải IPC." },
          { text: vn(ic / t, 2), why: "Đây là số tỉ lệnh trong một giây, chưa chia cho tần số." },
          { text: vn(ic / f, 2), why: "Quên chia cho thời gian." },
          { text: vn(ipc * 2, 2), why: "Tính sai tổng số chu kỳ." },
          { text: vn(ipc + 0.75, 2), why: "Tính sai tổng số chu kỳ." },
        ],
        explanation: { correct: `Tổng chu kỳ = ${t} × ${f} × $10^9$ = ${t * f} × $10^9$. IPC = ${vn(ic)} × $10^9$ / (${t * f} × $10^9$) = ${vn(ipc, 2)}.`, tip: "IPC = 1 / CPI." },
        difficulty: "medium",
      };
    },
  },
  {
    id: "it006-mips-rate",
    chapterId: C1B,
    title: "Tính MIPS và IPS",
    build(rng): Draft {
      const f = pick(rng, [1, 1.5, 2, 3, 4, 6]);
      const cpi = pick(rng, [1, 1.5, 2, 2.5, 3, 4]);
      const mips = (f * 1e9) / (cpi * 1e6);
      return {
        ...base,
        template: "MIPS",
        chapterId: C1B,
        content: `Bộ xử lý có Clock Rate = **${vn(f)} GHz**, **CPI = ${vn(cpi)}**. Tốc độ thực thi theo **MIPS** (triệu lệnh/giây) là:`,
        correct: `${vn(mips, 2)} MIPS`,
        distractors: [
          { text: `${vn(mips * cpi * cpi, 2)} MIPS`, why: "Nhân CPI thay vì chia cho CPI." },
          { text: `${vn(mips / 1000, 2)} MIPS`, why: "Chia sai $10^6$: 1 GHz = $10^9$ Hz." },
          { text: `${vn(mips * 1000, 2)} MIPS`, why: "Chưa chia $10^6$ đúng cách." },
          { text: `${vn(f * 1000, 2)} MIPS`, why: "Quên chia cho CPI." },
          { text: `${vn(mips + 100, 2)} MIPS`, why: "Tính sai." },
        ],
        explanation: { correct: `MIPS = Clock Rate / (CPI × $10^6$) = ${vn(f)} × $10^9$ / (${vn(cpi)} × $10^6$) = ${vn(mips, 2)}.`, tip: "IPS không chia $10^6$; MIPS = IPS / $10^6$." },
        difficulty: "easy",
      };
    },
  },
  {
    id: "it006-new-clock",
    chapterId: C1B,
    title: "Tần số cần thiết cho máy mới",
    build(rng): Draft {
      const ta = pick(rng, [8, 10, 12, 15, 20]);
      const fa = pick(rng, [1, 2, 3, 4]);
      const tb = pick(rng, [4, 5, 6, 8]);
      const k = pick(rng, [1.2, 1.25, 1.5, 2]);
      const fb = (ta * fa * k) / tb;
      return {
        ...base,
        template: "Tần số máy mới",
        chapterId: C1B,
        content: `Chương trình chạy trong **${ta} giây** trên máy A có tần số **${fa} GHz**. Máy B cần chạy chương trình này trong **${tb} giây**, nhưng cần số chu kỳ clock nhiều gấp **${vn(k)} lần** máy A. Tần số xung clock của máy B là:`,
        correct: `${vn(fb, 2)} GHz`,
        distractors: [
          { text: `${vn((ta * fa) / tb, 2)} GHz`, why: `Quên hệ số ${vn(k)} lần số chu kỳ.` },
          { text: `${vn((ta * fa) / (tb * k), 2)} GHz`, why: "Chia cho hệ số thay vì nhân." },
          { text: `${vn((tb * fa * k) / ta, 2)} GHz`, why: "Đảo tỉ số thời gian." },
          { text: `${vn(fa * k, 2)} GHz`, why: "Quên yếu tố thời gian thực thi." },
        ],
        explanation: { correct: `Chu kỳ máy A = ${ta} × ${fa} × $10^9$. Chu kỳ máy B = ${vn(k)} × ${ta * fa} × $10^9$. Clock Rate B = ${vn(k * ta * fa)} × $10^9$ / ${tb} = ${vn(fb, 2)} GHz.` },
        difficulty: "hard",
      };
    },
  },

  // ───────────── Chương 2a ─────────────
  {
    id: "it006-offset",
    chapterId: C2A,
    title: "Offset của phần tử mảng",
    build(rng): Draft {
      const k = int(rng, 3, 300);
      const [dst, baseReg] = some(rng, ANY, 2);
      return {
        ...base,
        template: "Offset mảng",
        chapterId: C2A,
        content: `Mảng số nguyên \`A\` (mỗi phần tử 1 word), địa chỉ nền nằm trong ${tick(baseReg)}. Lệnh nào nạp đúng \`A[${k}]\` vào ${tick(dst)}?`,
        correct: tick(`lw ${dst}, ${k * 4}(${baseReg})`),
        distractors: [
          { text: tick(`lw ${dst}, ${k}(${baseReg})`), why: "Quên nhân 4: MIPS định địa chỉ theo byte, mỗi word 4 byte." },
          { text: tick(`sw ${dst}, ${k * 4}(${baseReg})`), why: "`sw` ghi ra bộ nhớ; muốn nạp vào thanh ghi phải dùng `lw`." },
          { text: tick(`lw ${baseReg}, ${k * 4}(${dst})`), why: "Đảo vai trò: thanh ghi nền nằm trong ngoặc." },
          { text: tick(`lw ${dst}, ${k * 8}(${baseReg})`), why: "Mỗi word 4 byte, không phải 8 byte." },
        ],
        explanation: { correct: `Offset = ${k} × 4 = ${k * 4} byte, nên lệnh là \`lw ${dst}, ${k * 4}(${baseReg})\`.`, tip: "Địa chỉ A[i] = nền + i × 4." },
        difficulty: "easy",
      };
    },
  },
  {
    id: "it006-element-address",
    chapterId: C2A,
    title: "Địa chỉ phần tử mảng",
    build(rng): Draft {
      const b = pick(rng, [0x10010000, 0x10010040, 0x10000000, 0x00400100, 0x7fff0000]);
      const i = int(rng, 2, 60);
      const a = b + i * 4;
      return {
        ...base,
        template: "Địa chỉ mảng",
        chapterId: C2A,
        content: `Mảng word \`A\` có địa chỉ nền ${hex(b)}. Địa chỉ của \`A[${i}]\` là:`,
        correct: hex(a),
        distractors: [
          { text: hex(b + i), why: "Quên nhân 4." },
          { text: hex(b + i * 2), why: "Mỗi word 4 byte, không phải 2 byte." },
          { text: hex(b + (i + 1) * 4), why: "Chỉ số mảng bắt đầu từ 0, A[0] nằm tại địa chỉ nền." },
          { text: hex(b + i * 8), why: "Mỗi word 4 byte, không phải 8 byte." },
        ],
        explanation: { correct: `Địa chỉ = ${hex(b)} + ${i} × 4 = ${hex(b)} + ${i * 4} = ${hex(a)}.` },
        difficulty: "easy",
      };
    },
  },
  {
    id: "it006-twos",
    chapterId: C2A,
    title: "Đổi số bù hai sang hệ 10",
    build(rng): Draft {
      const width = pick(rng, [8, 16]);
      const n = -int(rng, 2, width === 8 ? 120 : 3000);
      const bits = intToTwosComplement(n, width);
      const grouped = bits.replace(/(.{4})(?=.)/g, "$1 ");
      const unsigned = 2 ** width + n;
      const mag = parseInt(bits.slice(1), 2);
      return {
        ...base,
        template: "Bù hai",
        chapterId: C2A,
        content: `Chuỗi **${width} bit** \`${grouped}\` biểu diễn số có dấu theo bù hai. Giá trị hệ 10 của nó là:`,
        correct: `${n}`,
        distractors: [
          { text: `${unsigned}`, why: "Đây là giá trị nếu coi là số không dấu." },
          { text: `${-n}`, why: "MSB = 1 nên đây là số âm." },
          { text: `${-mag}`, why: "Bù hai không phải dấu–độ lớn: không thể chỉ bỏ bit dấu rồi đọc phần còn lại." },
          { text: `${n - 1}`, why: "Thiếu bước cộng 1 sau khi đảo bit." },
          { text: `${n + 1}`, why: "Thiếu bước cộng 1 sau khi đảo bit." },
        ],
        explanation: { correct: `MSB = 1 nên là số âm. Đảo bit rồi cộng 1 được độ lớn ${-n}, vậy giá trị là ${n}.`, related: `Cách khác: giá trị = $-2^{${width - 1}}$ + phần còn lại = ${-(2 ** (width - 1))} + ${mag} = ${n}.` },
        difficulty: "medium",
      };
    },
  },
  {
    id: "it006-sign-extend",
    chapterId: C2A,
    title: "Mở rộng dấu",
    build(rng): Draft {
      const v = pick(rng, [int(rng, 0x8000, 0xffff), int(rng, 0x0100, 0x7fff)]);
      const neg = v >= 0x8000;
      const sign = neg ? (0xffff0000 | v) >>> 0 : v;
      return {
        ...base,
        template: "Sign-extend",
        chapterId: C2A,
        content: `Mở rộng có dấu (sign-extend) số 16 bit ${hex(v, 4)} thành 32 bit được:`,
        correct: hex(sign),
        distractors: [
          neg ? { text: hex(v), why: "Đây là zero-extend; sign-extend phải lặp bit dấu 1." } : { text: hex((0xffff0000 | v) >>> 0), why: "MSB của số này là 0 nên phần mở rộng phải là các bit 0." },
          { text: hex(((v << 16) | 0xffff) >>> 0), why: "Phần mở rộng nằm bên trái, không phải bên phải." },
          { text: hex((v << 16) >>> 0), why: "Phần mở rộng nằm bên trái, không phải bên phải." },
          { text: hex((0x7fff0000 | v) >>> 0), why: "Phải lặp đúng bit dấu cho cả 16 bit mới." },
        ],
        explanation: { correct: `MSB của ${hex(v, 4)} là ${neg ? 1 : 0} nên 16 bit trái được điền toàn ${neg ? 1 : 0} → ${hex(sign)}.`, tip: "Sign-extend lặp bit dấu; zero-extend thêm 0." },
        difficulty: "medium",
      };
    },
  },
  {
    id: "it006-trace-arith",
    chapterId: C2A,
    title: "Truy vết lệnh số học",
    build(rng): Draft {
      const a = int(rng, 2, 30);
      const b = int(rng, 2, 30);
      const c = int(rng, 1, 15);
      const op = pick(rng, ["add", "sub"]);
      const prog = [`add $t0, $s1, $s2`, `addi $t1, $t0, ${c}`, `${op} $s0, $t1, $s1`];
      const v = run(prog.join("\n"), { regs: { $s1: a, $s2: b } }).regs.$s0;
      return {
        ...base,
        template: "Truy vết lệnh số học",
        chapterId: C2A,
        content: `Cho \`$s1 = ${a}\`, \`$s2 = ${b}\`. Sau khi chạy đoạn lệnh sau, \`$s0\` bằng bao nhiêu?\n\n${code(prog)}`,
        correct: `${v}`,
        distractors: [
          { text: `${a + b + c}`, why: "Quên lệnh cuối cùng." },
          { text: `${op === "add" ? a + b + c - a : a + b + c + a}`, why: `Nhầm phép \`${op}\` ở lệnh cuối.` },
          { text: `${a + b}`, why: "Chỉ tính lệnh đầu tiên." },
          { text: `${v + c}`, why: "Cộng thừa hằng số." },
          { text: `${v - 1}`, why: "Tính sai." },
        ],
        explanation: { correct: `$t0 = ${a} + ${b} = ${a + b}; $t1 = ${a + b} + ${c} = ${a + b + c}; $s0 = ${a + b + c} ${op === "add" ? "+" : "−"} ${a} = ${v}.` },
        difficulty: "easy",
      };
    },
  },

  // ───────────── Chương 2b ─────────────
  {
    id: "it006-encode-r",
    chapterId: C2B,
    title: "Mã máy lệnh R-format",
    build(rng): Draft {
      const [rd, rs, rt] = some(rng, ANY, 3);
      const op = pick(rng, ["add", "sub", "and", "or", "slt", "nor"]);
      const asm = `${op} ${rd}, ${rs}, ${rt}`;
      const w = encode(asm);
      const other = op === "add" ? "sub" : "add";
      return {
        ...base,
        template: "Mã máy R-format",
        chapterId: C2B,
        content: `Mã máy (hex) của lệnh \`${asm}\` là:`,
        correct: hexw(w),
        distractors: [
          { text: hexw(encode(`${op} ${rs}, ${rd}, ${rt}`)), why: "Đặt sai vị trí: rd là toán hạng đầu tiên trong Assembly nhưng đứng sau rs, rt trong mã máy." },
          { text: hexw(encode(`${op} ${rd}, ${rt}, ${rs}`)), why: "Đảo rs và rt." },
          { text: hexw(encode(`${other} ${rd}, ${rs}, ${rt}`)), why: "Sai trường funct." },
          { text: hexw(encode(`${op} ${rt}, ${rd}, ${rs}`)), why: "Sai thứ tự các trường thanh ghi." },
        ],
        explanation: {
          correct: `R-format: op = 0, rs = ${rs} = ${regIndex(rs)}, rt = ${rt} = ${regIndex(rt)}, rd = ${rd} = ${regIndex(rd)}, shamt = 0, funct của \`${op}\` → ${hexw(w)}.`,
          tip: "Assembly ghi `rd, rs, rt`; mã máy xếp `op rs rt rd shamt funct`.",
        },
        difficulty: "medium",
      };
    },
  },
  {
    id: "it006-encode-i",
    chapterId: C2B,
    title: "Mã máy lệnh I-format",
    build(rng): Draft {
      const [a, b] = some(rng, ANY, 2);
      const kind = pick(rng, ["addi", "lw", "sw"]);
      const imm = kind === "addi" ? pick(rng, [int(rng, 1, 200), -int(rng, 1, 200)]) : int(rng, 1, 50) * 4;
      const asm = kind === "addi" ? `addi ${a}, ${b}, ${imm}` : `${kind} ${a}, ${imm}(${b})`;
      const w = encode(asm);
      const swapped = kind === "addi" ? `addi ${b}, ${a}, ${imm}` : `${kind} ${b}, ${imm}(${a})`;
      const wrongOp = kind === "addi" ? `andi ${a}, ${b}, ${imm & 0xffff}` : `${kind === "lw" ? "sw" : "lw"} ${a}, ${imm}(${b})`;
      const wrongImm = kind === "addi" ? `addi ${a}, ${b}, ${imm + 1}` : `${kind} ${a}, ${imm + 4}(${b})`;
      return {
        ...base,
        template: "Mã máy I-format",
        chapterId: C2B,
        content: `Mã máy (hex) của lệnh \`${asm}\` là:`,
        correct: hexw(w),
        distractors: [
          { text: hexw(encode(swapped)), why: "Đảo rs và rt: với I-format, thanh ghi đích/dữ liệu nằm ở trường rt." },
          { text: hexw(encode(wrongOp)), why: "Sai opcode." },
          { text: hexw(encode(wrongImm)), why: "Sai trường immediate." },
          { text: hexw(((w & 0xffff0000) | ((imm >>> 0) >> 2 & 0xffff)) >>> 0), why: "Không được chia 4 ở trường immediate của lệnh này." },
        ],
        explanation: {
          correct: `I-format: op(${kind}), rs = ${regIndex(b)}, rt = ${regIndex(a)}, immediate = ${imm}${imm < 0 ? ` (bù hai 16 bit: ${hex(imm & 0xffff, 4)})` : ""} → ${hexw(w)}.`,
          tip: "Số âm trong immediate biểu diễn bằng bù hai 16 bit.",
        },
        difficulty: "medium",
      };
    },
  },
  {
    id: "it006-decode",
    chapterId: C2B,
    title: "Giải mã lệnh",
    build(rng): Draft {
      const [a, b, c] = some(rng, ANY, 3);
      const kind = pick(rng, ["r", "shift", "addi", "lw"]);
      const asm =
        kind === "r" ? `${pick(rng, ["add", "sub", "and", "or"])} ${a}, ${b}, ${c}` : kind === "shift" ? `${pick(rng, ["sll", "srl"])} ${a}, ${b}, ${int(rng, 1, 31)}` : kind === "addi" ? `addi ${a}, ${b}, ${int(rng, 1, 500)}` : `lw ${a}, ${int(rng, 1, 40) * 4}(${b})`;
      const w = encode(asm);
      const d = decode(w);
      const wrong = (s: string) => tick(s);
      const parts = d.split(" ");
      const name = parts[0];
      const alt: Record<string, string> = { add: "sub", sub: "add", and: "or", or: "and", sll: "srl", srl: "sll", addi: "andi", lw: "sw" };
      const rest = parts.slice(1).join(" ");
      const swap = kind === "lw" ? `lw ${b}, ${d.match(/,\s*(-?\d+)\(/)![1]}(${a})` : kind === "r" ? `${name} ${b}, ${a}, ${c}` : `${name} ${b}, ${a}, ${d.split(", ")[2]}`;
      const swap2 = kind === "r" ? `${name} ${c}, ${a}, ${b}` : kind === "lw" ? `lw ${a}, ${Number(d.match(/,\s*(-?\d+)\(/)![1]) * 2}(${b})` : `${name} ${a}, ${b}, ${Number(d.split(", ")[2]) + 1}`;
      return {
        ...base,
        template: "Giải mã lệnh",
        chapterId: C2B,
        content: `Lệnh Assembly MIPS tương ứng với mã máy ${hexw(w)} là:`,
        correct: tick(d),
        distractors: [
          { text: wrong(`${alt[name]} ${rest}`), why: "Sai opcode/funct nên sai tên lệnh." },
          { text: wrong(swap), why: "Sai vị trí thanh ghi." },
          { text: wrong(swap2), why: "Đọc sai các trường." },
        ],
        explanation: { correct: `Đổi sang nhị phân, tách trường theo định dạng rồi tra op/funct và số thanh ghi → \`${d}\`.`, tip: "op = 0 → R-format: tách 6-5-5-5-5-6 và xem funct." },
        difficulty: "hard",
      };
    },
  },
  {
    id: "it006-branch-offset",
    chapterId: C2B,
    title: "Trường địa chỉ của beq/bne",
    build(rng): Draft {
      const pc = pick(rng, [0x40, 0x80, 0xa4, 0x100, 0x400000, 0x400020]);
      const n = pick(rng, [int(rng, 1, 12), -int(rng, 1, 6)]);
      const target = pc + 4 + n * 4;
      const reg = pick(rng, SAVED);
      return {
        ...base,
        template: "Địa chỉ rẽ nhánh",
        chapterId: C2B,
        content: `Lệnh \`beq ${reg}, $zero, L\` nằm tại địa chỉ ${hex(pc)}; nhãn \`L\` ở địa chỉ ${hex(target)}. Giá trị trường immediate (hệ 10) của lệnh là:`,
        correct: `${n}`,
        distractors: [
          { text: `${(target - pc) / 4}`, why: "Offset tính từ PC + 4, không phải từ PC." },
          { text: `${target - pc - 4}`, why: "Quên chia 4: offset tính theo số lệnh (word), không theo byte." },
          { text: `${target - pc}`, why: "Quên cả PC + 4 lẫn chia 4." },
          { text: `${n - 1}`, why: "Tính sai." },
        ],
        explanation: { correct: `immediate = (${hex(target)} − (${hex(pc)} + 4)) / 4 = ${n}.`, tip: "Đích = PC + 4 + immediate × 4." },
        difficulty: "hard",
      };
    },
  },
  {
    id: "it006-shift-mask",
    chapterId: C2B,
    title: "Dịch bit và phép logic",
    build(rng): Draft {
      const v = pick(rng, [0x20222023, 0x55555555, 0x12345678, 0x0000ff0f, 0xabcd1234, 0x0f0f0f0f]);
      const k = int(rng, 1, 8);
      const useSll = rng() < 0.5;
      const mask = pick(rng, [0x0fef, 0x00ff, 0xff00, 0x0f0f, 0xffef, 0x1234]);
      const logic = pick(rng, ["andi", "ori"]);
      const prog = [`${useSll ? "sll" : "srl"} $t1, $t0, ${k}`, `${logic} $t1, $t1, 0x${mask.toString(16).toUpperCase()}`];
      const res = run(prog.join("\n"), { regs: { $t0: v } }).regs.$t1 >>> 0;
      const shifted = (useSll ? v << k : v >>> k) >>> 0;
      const flip = (useSll ? v >>> k : v << k) >>> 0;
      const other = logic === "andi" ? (shifted | mask) >>> 0 : (shifted & mask) >>> 0;
      return {
        ...base,
        template: "Dịch bit và logic",
        chapterId: C2B,
        content: `Cho \`$t0 = ${toHex(v)}\`. Giá trị của \`$t1\` sau khi chạy đoạn lệnh sau là:\n\n${code(prog)}`,
        correct: hex(res),
        distractors: [
          { text: hex(shifted), why: `Quên lệnh \`${logic}\`.` },
          { text: hex(other), why: `Nhầm phép \`${logic}\` với phép còn lại.` },
          { text: hex((logic === "andi" ? flip & mask : flip | mask) >>> 0), why: "Dịch sai chiều." },
          { text: hex((res ^ 0x10) >>> 0), why: "Tính sai một bit." },
        ],
        explanation: { correct: `Sau khi dịch: ${hex(shifted)}. ${logic === "andi" ? "AND" : "OR"} với số tức thời zero-extend ${hex(mask)} → ${hex(res)}.`, tip: "`andi`, `ori` mở rộng số tức thời bằng **zero-extend**." },
        difficulty: "hard",
      };
    },
  },
  {
    id: "it006-branch-trace",
    chapterId: C2B,
    title: "Truy vết rẽ nhánh",
    build(rng): Draft {
      const a = int(rng, 1, 20);
      const lim = int(rng, 2, 20);
      const shift = int(rng, 1, 3);
      const b = int(rng, 0, 9);
      const prog = [`slti $t0, $s1, ${lim}`, `beq $t0, $zero, ELSE`, `sll $t1, $s1, ${shift}`, `add $s2, $s2, $t1`, `j End`, `ELSE: add $s2, $s1, $zero`, `End:`];
      const v = run(prog.join("\n"), { regs: { $s1: a, $s2: b } }).regs.$s2;
      const thenV = b + (a << shift);
      return {
        ...base,
        template: "Truy vết rẽ nhánh",
        chapterId: C2B,
        content: `Cho \`$s1 = ${a}\`, \`$s2 = ${b}\`. Sau khi chạy đoạn lệnh, \`$s2\` bằng bao nhiêu?\n\n${code(prog)}`,
        correct: `${v}`,
        distractors: [
          { text: `${v === thenV ? a : thenV}`, why: "Đi nhầm nhánh: kiểm tra lại kết quả của `slti`." },
          { text: `${a << shift}`, why: "Quên cộng giá trị ban đầu của `$s2`." },
          { text: `${b + a}`, why: "Quên lệnh dịch trái." },
          { text: `${v + 1}`, why: "Tính sai." },
          { text: `${v + a}`, why: "Tính sai." },
        ],
        explanation: { correct: `\`slti\`: ${a} < ${lim} ${a < lim ? "đúng" : "sai"} → $t0 = ${a < lim ? 1 : 0}. ${a < lim ? `Không nhảy: $t1 = ${a} << ${shift} = ${a << shift}; $s2 = ${b} + ${a << shift} = ${v}.` : `Nhảy tới ELSE: $s2 = $s1 = ${a}.`}` },
        difficulty: "medium",
      };
    },
  },
  {
    id: "it006-loop-trace",
    chapterId: C2B,
    title: "Truy vết vòng lặp",
    build(rng): Draft {
      const start = int(rng, 1, 6);
      const step = pick(rng, [2, 3, 4]);
      const iters = int(rng, 2, 4);
      const count = step * iters;
      const prog = [`addi $s0, $zero, ${start}`, `addi $t1, $zero, ${count}`, `loop: beq $t1, $zero, end`, `sll $s0, $s0, 1`, `addi $t1, $t1, -${step}`, `j loop`, `end: addi $s1, $s0, 5`];
      const r = run(prog.join("\n")).regs;
      return {
        ...base,
        template: "Truy vết vòng lặp",
        chapterId: C2B,
        content: `Sau khi đoạn chương trình thực thi xong, giá trị trong \`$s0\` là bao nhiêu?\n\n${code(prog)}`,
        correct: `${r.$s0}`,
        distractors: [
          { text: `${r.$s1}`, why: "Đây là `$s1`; lệnh cuối không thay đổi `$s0`." },
          { text: `${r.$s0 / 2}`, why: "Thiếu một vòng lặp." },
          { text: `${r.$s0 * 2}`, why: "Thừa một vòng lặp." },
          { text: `${start + iters}`, why: "`sll 1` nhân đôi, không phải cộng 1." },
        ],
        explanation: { correct: `$t1 giảm từ ${count} về 0, mỗi lần ${step} → ${iters} vòng. Mỗi vòng $s0 nhân đôi: ${start} × $2^{${iters}}$ = ${r.$s0}.` },
        difficulty: "medium",
      };
    },
  },

  // ───────────── Chương 2c ─────────────
  {
    id: "it006-stack",
    chapterId: C2C,
    title: "Cấp phát stack",
    build(rng): Draft {
      const n = int(rng, 2, 6);
      const sp = pick(rng, [0x7fffeffc, 0x7ffffff8, 0x10008000, 0x00002000]);
      return {
        ...base,
        template: "Cấp phát stack",
        chapterId: C2C,
        content: `Một thủ tục cần lưu **${n} thanh ghi** \`$s\` lên stack. Trước khi vào thủ tục \`$sp = ${toHex(sp)}\`. Sau khi cấp phát xong, \`$sp\` bằng:`,
        correct: hex(sp - 4 * n),
        distractors: [
          { text: hex(sp + 4 * n), why: "Stack phát triển từ địa chỉ cao xuống thấp nên phải trừ." },
          { text: hex(sp - n), why: "Mỗi thanh ghi 1 word = 4 byte." },
          { text: hex(sp - 8 * n), why: "Mỗi thanh ghi 4 byte, không phải 8 byte." },
          { text: hex(sp), why: "Phải giảm `$sp` để cấp phát." },
        ],
        explanation: { correct: `Cần 4 × ${n} = ${4 * n} byte: \`addi $sp, $sp, -${4 * n}\` → ${hex(sp - 4 * n)}.`, tip: "Push: giảm `$sp` trước rồi `sw`. Pop: `lw` trước rồi tăng `$sp`." },
        difficulty: "easy",
      };
    },
  },
  {
    id: "it006-jal",
    chapterId: C2C,
    title: "Giá trị $ra sau jal",
    build(rng): Draft {
      const pc = pick(rng, [0x00400020, 0x00400100, 0x0040003c, 0x00000080, 0x00001000]);
      const target = pc + int(rng, 3, 20) * 4;
      return {
        ...base,
        template: "Lệnh jal",
        chapterId: C2C,
        content: `Lệnh \`jal proc\` nằm tại địa chỉ ${hex(pc)}, nhãn \`proc\` ở địa chỉ ${hex(target)}. Sau khi thực thi lệnh này:`,
        correct: `\`$ra = 0x${(pc + 4).toString(16).toUpperCase().padStart(8, "0")}\`, \`PC = 0x${target.toString(16).toUpperCase().padStart(8, "0")}\``,
        distractors: [
          { text: `\`$ra = 0x${pc.toString(16).toUpperCase().padStart(8, "0")}\`, \`PC = 0x${target.toString(16).toUpperCase().padStart(8, "0")}\``, why: "`$ra` phải chứa địa chỉ lệnh ngay sau `jal`, tức PC + 4." },
          { text: `\`$ra = 0x${target.toString(16).toUpperCase().padStart(8, "0")}\`, \`PC = 0x${(pc + 4).toString(16).toUpperCase().padStart(8, "0")}\``, why: "Đảo hai giá trị." },
          { text: `\`$ra = 0x${(pc + 4).toString(16).toUpperCase().padStart(8, "0")}\`, \`PC = 0x${(pc + 4).toString(16).toUpperCase().padStart(8, "0")}\``, why: "`jal` phải chuyển PC tới thủ tục." },
          { text: `\`$ra = 0x${(pc + 8).toString(16).toUpperCase().padStart(8, "0")}\`, \`PC = 0x${target.toString(16).toUpperCase().padStart(8, "0")}\``, why: "Theo slide, `$ra = PC + 4`." },
        ],
        explanation: { correct: `\`jal\` làm hai việc: $ra = PC + 4 = ${hex(pc + 4)}, rồi PC = địa chỉ thủ tục = ${hex(target)}.`, tip: "`jr $ra` đặt PC = $ra để quay về." },
        difficulty: "easy",
      };
    },
  },
];

// Tránh cảnh báo biến chưa dùng khi các mẫu thay đổi
void REG_NAMES;

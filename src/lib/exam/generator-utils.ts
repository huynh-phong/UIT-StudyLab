import type { Difficulty } from "@/lib/bank/schema";

export type Rng = () => number;

/** PRNG có seed (mulberry32) — cùng seed cho cùng câu hỏi. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const pick = <T,>(rng: Rng, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];
export const int = (rng: Rng, min: number, max: number) => min + Math.floor(rng() * (max - min + 1));

/** Định dạng số kiểu Việt Nam: dấu phẩy thập phân, bỏ số 0 thừa. */
export function vn(n: number, maxDecimals = 3): string {
  const r = Number(n.toFixed(maxDecimals));
  return r.toLocaleString("vi-VN", { maximumFractionDigits: maxDecimals, useGrouping: false });
}

/** Số rất nhỏ: giữ 2 chữ số có nghĩa. */
export function vnSig(n: number): string {
  if (n === 0) return "0";
  const digits = Math.max(0, 1 - Math.floor(Math.log10(Math.abs(n))));
  return vn(Number(n.toPrecision(2)), Math.min(digits + 1, 10));
}

export interface Choice {
  text: string;
  why?: string;
}

export interface Draft {
  template: string;
  /** Mặc định it005. */
  courseId?: string;
  chapterId: string;
  content: string;
  correct: string;
  distractors: Choice[];
  explanation: { correct: string; whyCorrect?: string; related?: string; tip?: string };
  difficulty: Difficulty;
}

export interface GeneratorTemplate {
  id: string;
  chapterId: string;
  title: string;
  build(rng: Rng): Draft;
}

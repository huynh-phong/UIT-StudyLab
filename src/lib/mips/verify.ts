import type { EssayQuestion, McqQuestion } from "../bank/schema";
import { decode, encode, regIndex, run, toBin, toHex } from "./mips";

/** Kiểm chứng đáp án bằng bộ mã hóa/mô phỏng. Trả về lý do sai, hoặc null nếu đúng. */

const strip = (s: string) => s.replace(/[`*$\\\s]/g, "").toLowerCase();

/** Chuẩn hóa lệnh để so sánh: bỏ dấu cách, tên thanh ghi đưa về chỉ số. */
function normalizeAsm(s: string) {
  return s
    .replace(/`/g, "")
    .trim()
    .replace(/\$[a-z0-9]+/gi, (r) => `r${regIndex(r)}`)
    .replace(/\s*,\s*/g, ",")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function firstMipsBlock(text: string): string | null {
  const m = text.match(/```mips\n([\s\S]*?)```/);
  return m ? m[1] : null;
}

/** Số đầu tiên trong phương án, hỗ trợ hex, dấu phẩy thập phân và phần đơn vị phía sau. */
function optionNumber(text: string): number | null {
  const t = text.replace(/[`*$\s]/g, "");
  const hex = t.match(/^-?0x[0-9a-f]+/i);
  if (hex) return Number.parseInt(hex[0], 16);
  const dec = t.match(/-?\d+(?:[.,]\d+)?/);
  return dec ? Number(dec[0].replace(",", ".")) : null;
}

const wordsOf = (w?: Record<string, number>) => (w ? Object.fromEntries(Object.entries(w).map(([k, v]) => [Number(k), v])) : undefined);

export function verifyMcq(q: McqQuestion): string | null {
  const v = q.verify;
  if (!v) return null;
  const correct = q.options.find((o) => o.id === q.correctOptionId)!.content;
  try {
    switch (v.kind) {
      case "encode": {
        const w = encode(v.asm, { pc: v.pc, labels: v.labels });
        const c = strip(correct);
        if (c !== toHex(w).toLowerCase() && c !== toBin(w)) return `mã của "${v.asm}" là ${toHex(w)}, phương án đúng ghi ${correct}`;
        return null;
      }
      case "decode": {
        const d = decode(Number.parseInt(v.hex, 16));
        if (normalizeAsm(d) !== normalizeAsm(correct)) return `giải mã ${v.hex} ra "${d}", phương án đúng ghi ${correct}`;
        return null;
      }
      case "run": {
        const code = v.code ?? firstMipsBlock(q.content);
        if (!code) return "không có khối ```mips trong đề";
        const got = run(code, { regs: v.regs, words: wordsOf(v.words), littleEndian: v.littleEndian }).regs[v.reg];
        const want = optionNumber(correct);
        if (want === null || (want | 0) !== got) return `chạy ra ${v.reg} = ${got} (0x${(got >>> 0).toString(16)}), phương án đúng ghi ${correct}`;
        return null;
      }
      case "value": {
        const value = Function(`"use strict"; return (${v.expr});`)() as number;
        const want = optionNumber(correct);
        if (want === null || Math.abs(want - value) > Math.abs(value) * 0.005) return `tính ra ${value}, phương án đúng ghi ${correct}`;
        return null;
      }
    }
  } catch (e) {
    return (e as Error).message;
  }
}

export function verifyEssay(q: EssayQuestion): string | null {
  const spec = q.essay;
  for (const e of spec?.encodings ?? []) {
    try {
      const got = toHex(encode(e.asm, { pc: e.pc, labels: e.labels }));
      if (got.toLowerCase() !== e.hex.toLowerCase()) return `mã của "${e.asm}" là ${got}, đáp án mẫu ghi ${e.hex}`;
      if (!spec!.modelAnswer.toLowerCase().includes(e.hex.toLowerCase())) return `đáp án mẫu không chứa ${e.hex}`;
    } catch (err) {
      return `"${e.asm}": ${(err as Error).message}`;
    }
  }
  if (!spec?.verify) return null;
  const code = firstMipsBlock(spec.modelAnswer);
  if (!code) return "đáp án mẫu không có khối ```mips";
  for (const [i, c] of spec.verify.entries()) {
    try {
      const r = run(code, { regs: c.regs, words: wordsOf(c.words) });
      for (const [reg, want] of Object.entries(c.expectRegs ?? {})) {
        if (r.regs[reg] !== (want | 0)) return `trường hợp ${i + 1}: ${reg} = ${r.regs[reg]}, mong đợi ${want}`;
      }
      for (const [addr, want] of Object.entries(c.expectWords ?? {})) {
        if (r.word(Number(addr)) !== want >>> 0) return `trường hợp ${i + 1}: M[${addr}] = ${r.word(Number(addr))}, mong đợi ${want}`;
      }
    } catch (e) {
      return `trường hợp ${i + 1}: ${(e as Error).message}`;
    }
  }
  return null;
}

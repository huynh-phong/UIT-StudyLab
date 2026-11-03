import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import theory from "@/generated/theory.json";
import { encode, run, toHex } from "@/lib/mips/mips";

const raw = fs.readFileSync(path.resolve(__dirname, "../content/theory/it006.md"), "utf8");
const blocks = [...raw.matchAll(/```mips\n([\s\S]*?)```/g)].map((m) => m[1]);
const block = (marker: string) => {
  const found = blocks.find((b) => b.startsWith(`# ${marker}\n`));
  if (!found) throw new Error(`Không thấy khối ${marker}`);
  return found;
};
const words = (base: number, values: number[]) => Object.fromEntries(values.map((v, i) => [base + i * 4, v]));

describe("lý thuyết IT006: ví dụ tính đúng", () => {
  it("được dựng thành các phần có id không trùng", () => {
    const sections = (theory as { courses: Record<string, { id: string; title: string; md: string }[]> }).courses.it006;
    expect(sections.length).toBeGreaterThanOrEqual(10);
    expect(new Set(sections.map((s) => s.id)).size).toBe(sections.length);
    for (const s of sections) expect(s.md.length, s.id).toBeGreaterThan(100);
  });

  it("mã máy trong bài khớp bộ mã hóa", () => {
    const cases: [string, string, { pc?: number; labels?: Record<string, number> }?][] = [
      ["add $t0, $s1, $s2", "0x02324020"],
      ["lw $t3, -12($s0)", "0x8E0BFFF4"],
      ["srl $t8, $s5, 23", "0x0015C5C2"],
      ["sw $t9, 8($t0)", "0xAD190008"],
    ];
    for (const [asm, hex, opts] of cases) {
      expect(toHex(encode(asm, opts)).toUpperCase(), asm).toBe(hex.toUpperCase());
      expect(raw, hex).toContain(hex);
    }
    const bne = encode("bne $t0, $s5, Exit", { pc: 80012, labels: { Exit: 80024 } });
    expect(bne & 0xffff).toBe(2);
    const j = encode("j Loop", { pc: 80020, labels: { Loop: 80000 } });
    expect(j & 0x3ffffff).toBe(20000);
  });

  it("phép tính logic, dịch bit và bù hai", () => {
    expect(run("srl $t1, $t0, 3", { regs: { $t0: 0x20242025 } }).regs.$t1 >>> 0).toBe(0x04048404);
    expect(run("and $t2, $t0, $t1", { regs: { $t0: 0x12345678, $t1: 0x20242025 } }).regs.$t2 >>> 0).toBe(0x00240020);
    expect(run("andi $t1, $t1, 0x0FEF", { regs: { $t1: 0x04044404 } }).regs.$t1 >>> 0).toBe(0x00000404);
    expect(run("lw $t0, -12($t1)", { regs: { $t1: 0x1001001c }, words: { 0x10010010: 6 } }).regs.$t0).toBe(6);
    expect(65536 - 2024).toBe(0xf818);
    expect(65536 - 2024).toBe(63512);
  });

  it("các bài tính dung lượng và hiệu suất", () => {
    expect(3840 * 2160 * 3).toBe(24883200);
    expect(Math.round((24883200 / 2 ** 20) * 10) / 10).toBe(23.7);
    expect(1920 * 1080 * 3 * 60 * 30).toBe(11197440000);
    expect((500 * 8) / 200).toBe(20);
    expect((2025 * 2) / 3).toBe(1350);
    expect(50 * 4 + 20 * 5 + 30 * 5 + 50 * 3).toBe(600);
    expect(0.5 * 1 + 0.3 * 3 + 0.2 * 4).toBeCloseTo(2.2);
    expect((14 * 1.8 * 1.5) / 9).toBeCloseTo(4.2);
    expect(1.25 / 1.1).toBeCloseTo(1.136, 3);
    expect(30 / (3 * 4)).toBe(2.5);
  });

  it("bảng chạy tay vòng lặp", () => {
    const code = blocks.find((b) => b.startsWith("start: slt"))!;
    const r = run(code, { regs: { $t0: 3, $t1: 7 } });
    expect(r.regs.$t1).toBe(11);
    expect(r.regs.$t0).toBe(0);
    expect(r.regs.$t2).toBe(0);
  });

  it("đoạn đọc thành câu while chạy đúng", () => {
    const code = blocks.find((b) => b.startsWith("Loop: sll $t1, $s3, 2"))!;
    expect(run(code, { regs: { $s3: 0, $s5: 7, $s6: 4096 }, words: words(4096, [7, 7, 1]) }).regs.$s3).toBe(2);
  });

  it("stack cất và lấy lại đúng", () => {
    const code = blocks.find((b) => b.startsWith("addi $sp, $sp, -4"))!;
    const r = run(code, { regs: { $sp: 4096, $s0: 100, $a0: 1, $a1: 2 } });
    expect(r.regs.$s0).toBe(100);
    expect(r.regs.$sp).toBe(4096);
  });

  it("khuôn if-else", () => {
    expect(run(block("if-else"), { regs: { $s1: 9, $s2: 4, $s3: 5, $s4: 2 } }).regs.$s0).toBe(13);
    expect(run(block("if-else"), { regs: { $s1: 9, $s2: 4, $s3: 2, $s4: 2 } }).regs.$s0).toBe(5);
  });

  it("khuôn tính tổng và trung bình", () => {
    const r = run(block("tong-tb"), { regs: { $s3: 4096 }, words: words(4096, [1, 2, 3, 4, 5, 6, 7, 8]) });
    expect(r.regs.$s1).toBe(36);
    expect(r.regs.$s2).toBe(4);
  });

  it("khuôn tìm lớn nhất", () => {
    const r = run(block("tim-max"), { regs: { $s7: 4096 }, words: words(4096, [3, 9, -1, 20, 5, 7, 0, 2, 1, 4]) });
    expect(r.regs.$s0).toBe(20);
  });

  it("khuôn hai mảng ra đúng giá trị ghi trong bài", () => {
    const r = run(block("hai-mang"), {
      regs: { $s2: 7, $s3: 2, $s6: 4096, $s7: 8192 },
      words: { ...words(4096, [23, 2, 45, 11, 5]), ...words(8192, [12, 30, 15, 17, 9]) },
    });
    expect([0, 1, 2, 3, 4].map((i) => r.word(4096 + i * 4))).toEqual([23, 25, 10, 12, 4]);
  });

  it("khuôn xử lý chuỗi", () => {
    // Chuỗi "KtmT" và byte 0 kết thúc
    const r = run(block("chuoi"), { regs: { $s3: 4096 }, words: { 4096: 0x4b746d54, 4100: 0 } });
    expect(r.word(4096)).toBe(0x4b544d54);
  });
});

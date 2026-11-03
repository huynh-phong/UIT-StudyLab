/**
 * Bộ mã hóa, giải mã và mô phỏng MIPS-32 thu nhỏ — phạm vi các lệnh trong Chương 2 môn Kiến trúc máy tính.
 * Dùng để sinh câu hỏi và kiểm chứng đáp án (mã máy, kết quả chạy chương trình) bằng code.
 */

export const REG_NAMES = [
  "$zero", "$at", "$v0", "$v1", "$a0", "$a1", "$a2", "$a3",
  "$t0", "$t1", "$t2", "$t3", "$t4", "$t5", "$t6", "$t7",
  "$s0", "$s1", "$s2", "$s3", "$s4", "$s5", "$s6", "$s7",
  "$t8", "$t9", "$k0", "$k1", "$gp", "$sp", "$fp", "$ra",
] as const;

export function regIndex(name: string): number {
  const n = name.trim().toLowerCase();
  if (n === "$0") return 0;
  const byName = REG_NAMES.indexOf(n as (typeof REG_NAMES)[number]);
  if (byName >= 0) return byName;
  const m = n.match(/^\$(\d{1,2})$/);
  if (m && Number(m[1]) < 32) return Number(m[1]);
  throw new Error(`Thanh ghi không hợp lệ: ${name}`);
}

/** Lệnh R: funct; dạng 3 thanh ghi rd, rs, rt. */
export const R_FUNCT: Record<string, number> = { add: 0x20, addu: 0x21, sub: 0x22, subu: 0x23, and: 0x24, or: 0x25, nor: 0x27, slt: 0x2a, sltu: 0x2b };
export const SHIFT_FUNCT: Record<string, number> = { sll: 0x00, srl: 0x02 };
/** Lệnh I số học/logic: rt, rs, imm. */
export const I_OP: Record<string, number> = { addi: 0x08, addiu: 0x09, slti: 0x0a, sltiu: 0x0b, andi: 0x0c, ori: 0x0d };
/** Lệnh truy cập bộ nhớ: rt, imm(rs). */
export const MEM_OP: Record<string, number> = { lw: 0x23, sw: 0x2b, lb: 0x20, lbu: 0x24, sb: 0x28 };
export const BRANCH_OP: Record<string, number> = { beq: 0x04, bne: 0x05 };
export const JUMP_OP: Record<string, number> = { j: 0x02, jal: 0x03 };

function parseNum(s: string): number {
  const t = s.trim().toLowerCase();
  const neg = t.startsWith("-");
  const body = neg ? t.slice(1) : t;
  const v = body.startsWith("0x") ? parseInt(body, 16) : /^\d+$/.test(body) ? parseInt(body, 10) : NaN;
  if (Number.isNaN(v)) throw new Error(`Số không hợp lệ: ${s}`);
  return neg ? -v : v;
}

function splitArgs(rest: string) {
  return rest.split(",").map((x) => x.trim()).filter(Boolean);
}

function parseMem(s: string): { imm: number; base: string } {
  const m = s.trim().match(/^(-?(?:0x[0-9a-f]+|\d+))?\s*\(\s*(\$\w+)\s*\)$/i);
  if (!m) throw new Error(`Toán hạng bộ nhớ không hợp lệ: ${s}`);
  return { imm: m[1] ? parseNum(m[1]) : 0, base: m[2] };
}

const u32 = (x: number) => x >>> 0;
const rType = (rs: number, rt: number, rd: number, shamt: number, funct: number) => u32((rs << 21) | (rt << 16) | (rd << 11) | (shamt << 6) | funct);
const iType = (op: number, rs: number, rt: number, imm: number) => u32((op << 26) | (rs << 21) | (rt << 16) | (imm & 0xffff));

function checkImm(imm: number, signed: boolean) {
  const ok = signed ? imm >= -32768 && imm <= 32767 : imm >= -32768 && imm <= 65535;
  if (!ok) throw new Error(`Số tức thời vượt 16 bit: ${imm}`);
}

export interface EncodeContext {
  /** Địa chỉ của lệnh này (cần cho beq/bne/j theo nhãn). */
  pc?: number;
  labels?: Record<string, number>;
}

/** Mã hóa một lệnh Assembly thành word 32 bit. */
export function encode(asm: string, ctx: EncodeContext = {}): number {
  const line = asm.replace(/#.*$/, "").trim();
  const sp = line.search(/\s/);
  const op = (sp < 0 ? line : line.slice(0, sp)).toLowerCase();
  const args = sp < 0 ? [] : splitArgs(line.slice(sp + 1));

  if (op in R_FUNCT) return rType(regIndex(args[1]), regIndex(args[2]), regIndex(args[0]), 0, R_FUNCT[op]);
  if (op in SHIFT_FUNCT) return rType(0, regIndex(args[1]), regIndex(args[0]), parseNum(args[2]), SHIFT_FUNCT[op]);
  if (op === "jr") return rType(regIndex(args[0]), 0, 0, 0, 0x08);
  if (op in I_OP) {
    const imm = parseNum(args[2]);
    checkImm(imm, op === "addi" || op === "slti");
    return iType(I_OP[op], regIndex(args[1]), regIndex(args[0]), imm);
  }
  if (op === "lui") return iType(0x0f, 0, regIndex(args[0]), parseNum(args[1]));
  if (op in MEM_OP) {
    const { imm, base } = parseMem(args[1]);
    checkImm(imm, true);
    return iType(MEM_OP[op], regIndex(base), regIndex(args[0]), imm);
  }
  if (op in BRANCH_OP) {
    const target = args[2];
    let offset: number;
    if (/^-?(0x)?[0-9a-f]+$/i.test(target)) offset = parseNum(target);
    else {
      const addr = ctx.labels?.[target];
      if (addr === undefined || ctx.pc === undefined) throw new Error(`Thiếu nhãn ${target}`);
      offset = (addr - (ctx.pc + 4)) / 4;
    }
    return iType(BRANCH_OP[op], regIndex(args[0]), regIndex(args[1]), offset);
  }
  if (op in JUMP_OP) {
    const target = args[0];
    const addr = /^(0x)?[0-9a-f]+$/i.test(target) ? parseNum(target) : ctx.labels?.[target];
    if (addr === undefined) throw new Error(`Thiếu nhãn ${target}`);
    return u32((JUMP_OP[op] << 26) | ((addr >>> 2) & 0x3ffffff));
  }
  throw new Error(`Lệnh chưa hỗ trợ: ${op}`);
}

export const toHex = (w: number) => `0x${u32(w).toString(16).toUpperCase().padStart(8, "0")}`;
export const toBin = (w: number) => u32(w).toString(2).padStart(32, "0");

/** Chuỗi 32 bit tách theo định dạng: R (6 5 5 5 5 6), I (6 5 5 16), J (6 26). */
export function toFields(w: number): string {
  const b = toBin(w);
  const op = u32(w) >>> 26;
  if (op === 0) return [b.slice(0, 6), b.slice(6, 11), b.slice(11, 16), b.slice(16, 21), b.slice(21, 26), b.slice(26)].join(" ");
  if (op === 2 || op === 3) return [b.slice(0, 6), b.slice(6)].join(" ");
  return [b.slice(0, 6), b.slice(6, 11), b.slice(11, 16), b.slice(16)].join(" ");
}

export type InstructionFormat = "R" | "I" | "J";
export function formatOf(w: number): InstructionFormat {
  const op = u32(w) >>> 26;
  return op === 0 ? "R" : op === 2 || op === 3 ? "J" : "I";
}

/** Giải mã word 32 bit thành Assembly (số tức thời ghi hệ 10). */
export function decode(word: number): string {
  const w = u32(word);
  const op = w >>> 26;
  const rs = (w >>> 21) & 31;
  const rt = (w >>> 16) & 31;
  const rd = (w >>> 11) & 31;
  const shamt = (w >>> 6) & 31;
  const funct = w & 63;
  const imm = w & 0xffff;
  const simm = imm >= 0x8000 ? imm - 0x10000 : imm;
  const r = (i: number) => REG_NAMES[i];
  if (op === 0) {
    if (funct === 0x08) return `jr ${r(rs)}`;
    const shift = Object.keys(SHIFT_FUNCT).find((k) => SHIFT_FUNCT[k] === funct);
    if (shift) return `${shift} ${r(rd)}, ${r(rt)}, ${shamt}`;
    const name = Object.keys(R_FUNCT).find((k) => R_FUNCT[k] === funct);
    if (!name) throw new Error(`funct lạ: ${funct}`);
    return `${name} ${r(rd)}, ${r(rs)}, ${r(rt)}`;
  }
  const jump = Object.keys(JUMP_OP).find((k) => JUMP_OP[k] === op);
  if (jump) return `${jump} ${(w & 0x3ffffff) * 4}`;
  const iName = Object.keys(I_OP).find((k) => I_OP[k] === op);
  if (iName) return `${iName} ${r(rt)}, ${r(rs)}, ${iName === "andi" || iName === "ori" ? imm : simm}`;
  const mem = Object.keys(MEM_OP).find((k) => MEM_OP[k] === op);
  if (mem) return `${mem} ${r(rt)}, ${simm}(${r(rs)})`;
  const br = Object.keys(BRANCH_OP).find((k) => BRANCH_OP[k] === op);
  if (br) return `${br} ${r(rs)}, ${r(rt)}, ${simm}`;
  if (op === 0x0f) return `lui ${r(rt)}, ${imm}`;
  throw new Error(`opcode lạ: ${op}`);
}

// ───────────── Mô phỏng ─────────────

export interface RunOptions {
  /** Giá trị ban đầu của thanh ghi, ví dụ { "$s1": 5 }. */
  regs?: Record<string, number>;
  /** Giá trị ban đầu của word trong bộ nhớ, theo địa chỉ byte. */
  words?: Record<number, number>;
  /** Bộ nhớ little-endian (mặc định big-endian như sách giáo trình). */
  littleEndian?: boolean;
  textBase?: number;
  maxSteps?: number;
}

export interface RunResult {
  regs: Record<string, number>;
  /** Đọc một word (không dấu) tại địa chỉ byte. */
  word(addr: number): number;
  pc: number;
  steps: number;
  /** Số lệnh đã thực thi theo tên lệnh. */
  executed: Record<string, number>;
}

interface Parsed {
  op: string;
  args: string[];
}

/** Chạy đoạn Assembly (hỗ trợ nhãn, comment `#`, các lệnh giả li/move/blt/bgt/ble/bge) cho tới khi hết chương trình. */
export function run(source: string, opts: RunOptions = {}): RunResult {
  const textBase = opts.textBase ?? 0x00400000;
  const program: Parsed[] = [];
  const labels: Record<string, number> = {};

  for (const raw of source.split("\n")) {
    let line = raw.replace(/#.*$/, "").replace(/\/\/.*$/, "").trim();
    for (;;) {
      const m = line.match(/^([A-Za-z_][\w.]*)\s*:\s*(.*)$/);
      if (!m) break;
      labels[m[1]] = program.length;
      line = m[2].trim();
    }
    if (!line) continue;
    const sp = line.search(/\s/);
    program.push({ op: (sp < 0 ? line : line.slice(0, sp)).toLowerCase(), args: sp < 0 ? [] : splitArgs(line.slice(sp + 1)) });
  }

  const regs = new Int32Array(32);
  regs[29] = 0x7fffeffc | 0;
  for (const [k, v] of Object.entries(opts.regs ?? {})) regs[regIndex(k)] = v | 0;
  const mem = new Map<number, number>();
  const little = Boolean(opts.littleEndian);
  const setByte = (a: number, v: number) => mem.set(u32(a), v & 0xff);
  const getByte = (a: number) => mem.get(u32(a)) ?? 0;
  const setWord = (a: number, v: number) => {
    if (u32(a) % 4 !== 0) throw new Error(`Địa chỉ word không chia hết cho 4: ${a}`);
    for (let i = 0; i < 4; i++) setByte(a + i, (v >>> (little ? 8 * i : 24 - 8 * i)) & 0xff);
  };
  const getWord = (a: number) => {
    if (u32(a) % 4 !== 0) throw new Error(`Địa chỉ word không chia hết cho 4: ${a}`);
    let v = 0;
    for (let i = 0; i < 4; i++) v = (v | (getByte(a + i) << (little ? 8 * i : 24 - 8 * i))) >>> 0;
    return v;
  };
  for (const [a, v] of Object.entries(opts.words ?? {})) setWord(Number(a), v);

  const R = (n: string) => regs[regIndex(n)];
  const W = (n: string, v: number) => {
    const i = regIndex(n);
    if (i !== 0) regs[i] = v | 0;
  };
  const target = (label: string) => {
    if (!(label in labels)) throw new Error(`Không có nhãn ${label}`);
    return labels[label];
  };

  let pc = 0;
  let steps = 0;
  const maxSteps = opts.maxSteps ?? 200_000;
  const executed: Record<string, number> = {};
  /** Trả về khi nhảy tới địa chỉ ngoài chương trình (ví dụ jr $ra về $ra ban đầu = 0). */
  while (pc >= 0 && pc < program.length) {
    if (++steps > maxSteps) throw new Error("Chương trình chạy quá nhiều bước (có thể lặp vô hạn)");
    const { op, args: a } = program[pc];
    executed[op] = (executed[op] ?? 0) + 1;
    let next = pc + 1;
    switch (op) {
      case "add":
      case "addu":
        W(a[0], R(a[1]) + R(a[2]));
        break;
      case "sub":
      case "subu":
        W(a[0], R(a[1]) - R(a[2]));
        break;
      case "and":
        W(a[0], R(a[1]) & R(a[2]));
        break;
      case "or":
        W(a[0], R(a[1]) | R(a[2]));
        break;
      case "nor":
        W(a[0], ~(R(a[1]) | R(a[2])));
        break;
      case "slt":
        W(a[0], R(a[1]) < R(a[2]) ? 1 : 0);
        break;
      case "sltu":
        W(a[0], u32(R(a[1])) < u32(R(a[2])) ? 1 : 0);
        break;
      case "sll":
        W(a[0], R(a[1]) << parseNum(a[2]));
        break;
      case "srl":
        W(a[0], R(a[1]) >>> parseNum(a[2]));
        break;
      case "addi":
      case "addiu":
        W(a[0], R(a[1]) + parseNum(a[2]));
        break;
      case "andi":
        W(a[0], R(a[1]) & (parseNum(a[2]) & 0xffff));
        break;
      case "ori":
        W(a[0], R(a[1]) | (parseNum(a[2]) & 0xffff));
        break;
      case "slti":
        W(a[0], R(a[1]) < parseNum(a[2]) ? 1 : 0);
        break;
      case "sltiu":
        W(a[0], u32(R(a[1])) < u32(parseNum(a[2])) ? 1 : 0);
        break;
      case "lui":
        W(a[0], parseNum(a[1]) << 16);
        break;
      case "li":
        W(a[0], parseNum(a[1]));
        break;
      case "move":
        W(a[0], R(a[1]));
        break;
      case "nop":
        break;
      case "lw": {
        const { imm, base } = parseMem(a[1]);
        W(a[0], getWord(R(base) + imm));
        break;
      }
      case "sw": {
        const { imm, base } = parseMem(a[1]);
        setWord(R(base) + imm, R(a[0]));
        break;
      }
      case "lb": {
        const { imm, base } = parseMem(a[1]);
        W(a[0], (getByte(R(base) + imm) << 24) >> 24);
        break;
      }
      case "lbu": {
        const { imm, base } = parseMem(a[1]);
        W(a[0], getByte(R(base) + imm));
        break;
      }
      case "sb": {
        const { imm, base } = parseMem(a[1]);
        setByte(R(base) + imm, R(a[0]));
        break;
      }
      case "beq":
        if (R(a[0]) === R(a[1])) next = target(a[2]);
        break;
      case "bne":
        if (R(a[0]) !== R(a[1])) next = target(a[2]);
        break;
      case "blt":
        if (R(a[0]) < R(a[1])) next = target(a[2]);
        break;
      case "bgt":
        if (R(a[0]) > R(a[1])) next = target(a[2]);
        break;
      case "ble":
        if (R(a[0]) <= R(a[1])) next = target(a[2]);
        break;
      case "bge":
        if (R(a[0]) >= R(a[1])) next = target(a[2]);
        break;
      case "j":
        next = target(a[0]);
        break;
      case "jal":
        W("$ra", textBase + (pc + 1) * 4);
        next = target(a[0]);
        break;
      case "jr":
        next = (u32(R(a[0])) - textBase) / 4;
        if (!Number.isInteger(next)) throw new Error("jr tới địa chỉ không hợp lệ");
        break;
      default:
        throw new Error(`Lệnh chưa hỗ trợ khi chạy: ${op}`);
    }
    pc = next;
  }

  const outRegs: Record<string, number> = {};
  REG_NAMES.forEach((n, i) => (outRegs[n] = regs[i]));
  return { regs: outRegs, word: getWord, pc: textBase + pc * 4, steps, executed };
}

// ───────────── Tiện ích số học ─────────────

/** Internet/bù hai: đổi chuỗi bit bù hai sang số có dấu. */
export function twosComplementToInt(bits: string): number {
  const b = bits.replace(/\s/g, "");
  const v = parseInt(b, 2);
  return b[0] === "1" ? v - 2 ** b.length : v;
}

export function intToTwosComplement(n: number, width: number): string {
  const m = n < 0 ? 2 ** width + n : n;
  return m.toString(2).padStart(width, "0");
}

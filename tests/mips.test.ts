import { describe, expect, it } from "vitest";
import { decode, encode, formatOf, intToTwosComplement, regIndex, run, toFields, toHex, twosComplementToInt } from "@/lib/mips/mips";
import { protectRegisters } from "@/lib/mips/markdown";

describe("mã hóa MIPS", () => {
  it("khớp các đáp án đã có trong đề và slide", () => {
    expect(toHex(encode("addi $s1, $s7, -55"))).toBe("0x22F1FFC9");
    expect(toHex(encode("srl $s5, $t8, 27"))).toBe("0x0018AEC2");
    expect(toFields(encode("and $t3, $s0, $s2"))).toBe("000000 10000 10010 01011 00000 100100");
    expect(toFields(encode("sll $t1, $t5, 7"))).toBe("000000 00000 01101 01001 00111 000000");
    expect(toFields(encode("sub $t3, $t1, $t2"))).toBe("000000 01001 01010 01011 00000 100010");
    expect(toHex(encode("beq $t0, $0, 3"))).toBe("0x11000003");
    expect(toHex(encode("add $t0, $s1, $s2"))).toBe("0x02324020");
  });

  it("beq theo nhãn: offset = (đích − (PC + 4)) / 4", () => {
    expect(toHex(encode("beq $t0, $0, else", { pc: 0xa4, labels: { else: 0xb4 } }))).toBe("0x11000003");
  });

  it("giải mã đúng", () => {
    expect(decode(0x01f37024)).toBe("and $t6, $t7, $s3");
    expect(decode(0x22f1ffc9)).toBe("addi $s1, $s7, -55");
    expect(decode(0x8d280004)).toBe("lw $t0, 4($t1)");
    expect(decode(encode("jr $ra"))).toBe("jr $ra");
  });

  it("mã hóa rồi giải mã trả lại đúng lệnh", () => {
    for (const asm of ["add $t0, $s1, $s2", "sub $v0, $a0, $a1", "slt $t0, $s0, $s1", "sll $t1, $s3, 2", "lw $s0, 32($s3)", "sw $t0, -8($sp)", "addi $sp, $sp, -4", "beq $s0, $s1, 25", "ori $t0, $t1, 255"]) {
      expect(decode(encode(asm))).toBe(asm);
    }
  });

  it("phân loại định dạng và chỉ số thanh ghi", () => {
    expect(formatOf(encode("add $t0, $t1, $t2"))).toBe("R");
    expect(formatOf(encode("lw $t0, 0($t1)"))).toBe("I");
    expect(formatOf(encode("j 1024"))).toBe("J");
    expect(regIndex("$t8")).toBe(24);
    expect(regIndex("$ra")).toBe(31);
    expect(regIndex("$s6")).toBe(22);
  });

  it("từ chối số tức thời vượt 16 bit", () => {
    expect(() => encode("addi $t0, $0, 70000")).toThrow(/16 bit/);
  });
});

describe("mô phỏng MIPS", () => {
  it("các đoạn chương trình trong đề cho đúng kết quả", () => {
    const q13 = "addi $s0, $zero, 5\naddi $t1, $zero, 12\nloop: beq $t1, $zero, end\nsll $s0, $s0, 1\naddi $t1, $t1, -4\nj loop\nend: addi $s1, $s0, 5";
    expect(run(q13).regs.$s0).toBe(40);

    const q18 = "slti $t0, $s1, 0x2022\nbeq $t0, $zero, ELSE\nsrl $t1, $s1, 1\nadd $s2, $s2, $t1\nj End\nELSE: andi $s2, $s1, 0x2023\nEnd:";
    expect(run(q18, { regs: { $s1: 0x2021, $s2: 1 } }).regs.$s2).toBe(0x1011);

    const q11 = "srl $t1, $t0, 3\nandi $t1, $t1, 0x0FEF";
    expect(run(q11, { regs: { $t0: 0x20222023 } }).regs.$t1).toBe(0x404);
  });

  it("thứ tự byte: little-endian và big-endian", () => {
    const code = "addi $t0, $0, 0x1000\nsw $s0, 0($t0)\nlb $s1, 0($t0)";
    expect(run(code, { regs: { $s0: 0x20222023 }, littleEndian: true }).regs.$s1).toBe(0x23);
    expect(run(code, { regs: { $s0: 0x20222023 } }).regs.$s1).toBe(0x20);
  });

  it("lw/sw, mảng và vòng lặp", () => {
    const code = "addi $s2, $zero, 0\naddi $t0, $zero, 0\nLoop: slti $t1, $t0, 4\nbeq $t1, $zero, Exit\nsll $t2, $t0, 2\nadd $t2, $t2, $s0\nlw $t3, 0($t2)\nadd $s2, $s2, $t3\naddi $t0, $t0, 1\nj Loop\nExit:";
    expect(run(code, { regs: { $s0: 0x100 }, words: { 0x100: 1, 0x104: 2, 0x108: 3, 0x10c: 4 } }).regs.$s2).toBe(10);
  });

  it("gọi thủ tục, stack và trở về", () => {
    const code = "addi $a0, $zero, 7\naddi $a1, $zero, 2\naddi $a2, $zero, 1\naddi $a3, $zero, 3\njal proc\nadd $s6, $v0, $zero\nj EXIT\nproc: addi $sp, $sp, -4\nsw $s0, 0($sp)\nadd $t0, $a0, $a1\nadd $t1, $a2, $a3\nsub $s0, $t0, $t1\nadd $v0, $s0, $zero\nlw $s0, 0($sp)\naddi $sp, $sp, 4\njr $ra\nEXIT:";
    const r = run(code, { regs: { $s0: 99, $sp: 0x8000 } });
    expect(r.regs.$s6).toBe(5);
    expect(r.regs.$s0).toBe(99);
    expect(r.regs.$sp).toBe(0x8000);
  });

  it("$zero luôn bằng 0; báo lỗi địa chỉ không chia hết cho 4 và vòng lặp vô hạn", () => {
    expect(run("addi $zero, $zero, 5").regs.$zero).toBe(0);
    expect(() => run("lw $t0, 2($zero)")).toThrow(/chia hết cho 4/);
    expect(() => run("L: j L", { maxSteps: 100 })).toThrow(/quá nhiều bước/);
  });

  it("bù hai", () => {
    expect(twosComplementToInt("11111100")).toBe(-4);
    expect(twosComplementToInt("0111")).toBe(7);
    expect(intToTwosComplement(-2, 16)).toBe("1111111111111110");
  });
});

describe("protectRegisters", () => {
  it("bọc thanh ghi ngoài code, giữ nguyên code và công thức", () => {
    expect(protectRegisters("Sai ở add $t0, $t1, 0($sp)")).toBe("Sai ở add `$t0`, `$t1`, 0(`$sp`)");
    expect(protectRegisters("`add $t0, $t1` và $s2")).toBe("`add $t0, $t1` và `$s2`");
    expect(protectRegisters("```mips\nadd $t0, $t1, $t2\n```")).toBe("```mips\nadd $t0, $t1, $t2\n```");
    expect(protectRegisters("Công thức $2^k$ và $T = I \times CPI$")).toBe("Công thức $2^k$ và $T = I \times CPI$");
  });
});

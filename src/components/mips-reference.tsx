"use client";

import { useState } from "react";
import { BookText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

/** Bảng tham khảo MIPS — đề cương cho phép sinh viên tham khảo bảng này trong đề thi. */

const REGISTERS: [string, string, string][] = [
  ["$zero", "0", "Hằng số 0"],
  ["$at", "1", "Dành cho assembler"],
  ["$v0–$v1", "2–3", "Giá trị trả về"],
  ["$a0–$a3", "4–7", "Tham số truyền vào thủ tục"],
  ["$t0–$t7", "8–15", "Thanh ghi tạm"],
  ["$s0–$s7", "16–23", "Lưu giá trị bền vững (phải lưu/phục hồi)"],
  ["$t8–$t9", "24–25", "Thanh ghi tạm"],
  ["$k0–$k1", "26–27", "Dành cho hệ điều hành"],
  ["$gp", "28", "Global pointer"],
  ["$sp", "29", "Stack pointer"],
  ["$fp", "30", "Frame pointer"],
  ["$ra", "31", "Địa chỉ trả về"],
];

const R_FORMAT: [string, string, string, string][] = [
  ["add", "20", "add rd, rs, rt", "rd = rs + rt"],
  ["addu", "21", "addu rd, rs, rt", "rd = rs + rt (không dấu)"],
  ["sub", "22", "sub rd, rs, rt", "rd = rs − rt"],
  ["subu", "23", "subu rd, rs, rt", "rd = rs − rt (không dấu)"],
  ["and", "24", "and rd, rs, rt", "rd = rs & rt"],
  ["or", "25", "or rd, rs, rt", "rd = rs | rt"],
  ["nor", "27", "nor rd, rs, rt", "rd = ~(rs | rt)"],
  ["slt", "2a", "slt rd, rs, rt", "rd = (rs < rt) ? 1 : 0"],
  ["sltu", "2b", "sltu rd, rs, rt", "như slt, so sánh không dấu"],
  ["sll", "00", "sll rd, rt, shamt", "rd = rt << shamt"],
  ["srl", "02", "srl rd, rt, shamt", "rd = rt >>> shamt"],
  ["jr", "08", "jr rs", "PC = rs"],
];

const I_FORMAT: [string, string, string, string][] = [
  ["addi", "08", "addi rt, rs, imm", "rt = rs + SignExt(imm)"],
  ["addiu", "09", "addiu rt, rs, imm", "rt = rs + SignExt(imm)"],
  ["andi", "0c", "andi rt, rs, imm", "rt = rs & ZeroExt(imm)"],
  ["ori", "0d", "ori rt, rs, imm", "rt = rs | ZeroExt(imm)"],
  ["slti", "0a", "slti rt, rs, imm", "rt = (rs < SignExt(imm)) ? 1 : 0"],
  ["sltiu", "0b", "sltiu rt, rs, imm", "như slti, so sánh không dấu"],
  ["lw", "23", "lw rt, imm(rs)", "rt = M[rs + SignExt(imm)]"],
  ["sw", "2b", "sw rt, imm(rs)", "M[rs + SignExt(imm)] = rt"],
  ["lb", "20", "lb rt, imm(rs)", "rt = SignExt(byte M[rs + imm])"],
  ["lbu", "24", "lbu rt, imm(rs)", "rt = ZeroExt(byte M[rs + imm])"],
  ["sb", "28", "sb rt, imm(rs)", "byte M[rs + imm] = rt"],
  ["lui", "0f", "lui rt, imm", "rt = imm << 16"],
  ["beq", "04", "beq rs, rt, label", "nếu rs == rt: PC = PC + 4 + imm × 4"],
  ["bne", "05", "bne rs, rt, label", "nếu rs != rt: PC = PC + 4 + imm × 4"],
];

const J_FORMAT: [string, string, string, string][] = [
  ["j", "02", "j label", "PC = địa chỉ nhãn"],
  ["jal", "03", "jal label", "$ra = PC + 4; PC = địa chỉ nhãn"],
];

function InstructionTable({ code, rows }: { code: string; rows: [string, string, string, string][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[420px] text-xs">
        <thead className="bg-subtle text-left text-muted">
          <tr>
            <th className="px-2.5 py-1.5 font-medium">Lệnh</th>
            <th className="px-2.5 py-1.5 font-medium">{code}</th>
            <th className="px-2.5 py-1.5 font-medium">Cú pháp</th>
            <th className="px-2.5 py-1.5 font-medium">Ý nghĩa</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border font-mono">
          {rows.map(([name, hex, syntax, meaning]) => (
            <tr key={name}>
              <td className="px-2.5 py-1 font-semibold">{name}</td>
              <td className="px-2.5 py-1">{hex}</td>
              <td className="px-2.5 py-1 whitespace-nowrap">{syntax}</td>
              <td className="px-2.5 py-1 font-sans">{meaning}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Format({ name, parts }: { name: string; parts: [string, number][] }) {
  const total = parts.reduce((a, [, n]) => a + n, 0);
  return (
    <div>
      <p className="mb-1 text-xs font-semibold">{name}</p>
      <div className="flex overflow-hidden rounded-lg border border-border text-center text-[11px]">
        {parts.map(([label, bits]) => (
          <div key={label} className="min-w-0 border-r border-border px-0.5 py-1 last:border-r-0" style={{ width: `${(bits / total) * 100}%` }}>
            <div className="truncate font-mono font-semibold">{label}</div>
            <div className="text-muted">{bits}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MipsReferenceButton({ size = "sm" }: { size?: "sm" | "default" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size={size} onClick={() => setOpen(true)} title="Xem bảng lệnh MIPS">
        <BookText /> <span className="hidden sm:inline">Bảng MIPS</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogTitle>Bảng tham khảo MIPS</DialogTitle>
          <DialogDescription>Đề thi có đính kèm bảng MIPS để tham khảo. Các giá trị op và funct ghi ở hệ 16.</DialogDescription>

          <div className="mt-4 space-y-5">
            <section className="space-y-2.5">
              <Format name="R-format" parts={[["op", 6], ["rs", 5], ["rt", 5], ["rd", 5], ["shamt", 5], ["funct", 6]]} />
              <Format name="I-format" parts={[["op", 6], ["rs", 5], ["rt", 5], ["immediate", 16]]} />
              <Format name="J-format" parts={[["op", 6], ["address", 26]]} />
            </section>

            <section>
              <h3 className="mb-1.5 text-sm font-semibold">Thanh ghi</h3>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-xs">
                  <tbody className="divide-y divide-border">
                    {REGISTERS.map(([name, no, use]) => (
                      <tr key={name}>
                        <td className="px-2.5 py-1 font-mono font-semibold whitespace-nowrap">{name}</td>
                        <td className="px-2.5 py-1 font-mono whitespace-nowrap">{no}</td>
                        <td className="px-2.5 py-1">{use}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h3 className="mb-1.5 text-sm font-semibold">Lệnh R-format (op = 0)</h3>
              <InstructionTable code="funct" rows={R_FORMAT} />
            </section>
            <section>
              <h3 className="mb-1.5 text-sm font-semibold">Lệnh I-format</h3>
              <InstructionTable code="op" rows={I_FORMAT} />
            </section>
            <section>
              <h3 className="mb-1.5 text-sm font-semibold">Lệnh J-format</h3>
              <InstructionTable code="op" rows={J_FORMAT} />
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

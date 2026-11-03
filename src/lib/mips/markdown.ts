const CODE_SPAN = /(```[\s\S]*?```|`[^`\n]*`)/;
const REGISTER = /\$(?:zero|at|v[01]|a[0-3]|t[0-9]|s[0-7]|k[01]|gp|sp|fp|ra)(?![\w$])/g;

/**
 * Bọc tên thanh ghi MIPS trong code span để `$t0, $t1` không bị hiểu nhầm là công thức LaTeX.
 * Cần thiết vì nhận xét do AI viết không phải lúc nào cũng đặt thanh ghi trong dấu backtick.
 */
export function protectRegisters(text: string): string {
  if (!text.includes("$")) return text;
  return text
    .split(CODE_SPAN)
    .map((part, i) => (i % 2 === 1 ? part : part.replace(REGISTER, (r) => `\`${r}\``)))
    .join("");
}

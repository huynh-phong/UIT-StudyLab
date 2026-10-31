import type { CalcCheck } from "@/lib/bank/schema";

/** Bộ tính toán IPv4 độc lập — dùng để kiểm chứng đáp án các câu tính subnet (kể cả câu AI tạo). */

export function parseIPv4(ip: string): number | null {
  const parts = ip.trim().split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    value = value * 256 + n;
  }
  return value >>> 0;
}

export function formatIPv4(value: number): string {
  const v = value >>> 0;
  return [v >>> 24, (v >>> 16) & 255, (v >>> 8) & 255, v & 255].join(".");
}

export function prefixToMask(prefix: number): number {
  if (prefix <= 0) return 0;
  return (0xffffffff << (32 - prefix)) >>> 0;
}

export interface SubnetInfo {
  network: string;
  broadcast: string;
  mask: string;
  wildcard: string;
  firstHost: string;
  lastHost: string;
  totalAddresses: number;
  usableHosts: number;
}

export function subnetInfo(ip: string, prefix: number): SubnetInfo | null {
  const addr = parseIPv4(ip);
  if (addr === null || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) return null;
  const mask = prefixToMask(prefix);
  const network = (addr & mask) >>> 0;
  const broadcast = (network | (~mask >>> 0)) >>> 0;
  const total = 2 ** (32 - prefix);
  // /31 (RFC 3021) và /32 là trường hợp đặc biệt
  const usable = prefix >= 31 ? (prefix === 31 ? 2 : 1) : total - 2;
  const first = prefix >= 31 ? network : network + 1;
  const last = prefix >= 31 ? broadcast : broadcast - 1;
  return {
    network: formatIPv4(network),
    broadcast: formatIPv4(broadcast),
    mask: formatIPv4(mask),
    wildcard: formatIPv4(~mask >>> 0),
    firstHost: formatIPv4(first),
    lastHost: formatIPv4(last),
    totalAddresses: total,
    usableHosts: usable,
  };
}

export function computeCalc(calc: CalcCheck): string | null {
  const info = subnetInfo(calc.ip, calc.prefix);
  if (!info) return null;
  return String(info[calc.ask]);
}

/** Chuẩn hóa nội dung phương án để so sánh với kết quả tính (bỏ markdown, khoảng trắng, "/xx"). */
export function normalizeCalcAnswer(text: string): string {
  return text
    .replace(/[`*_$]/g, "")
    .replace(/\s+/g, "")
    .replace(/(host|hosts|địachỉ|address(es)?)$/i, "")
    .replace(/,/g, "")
    .toLowerCase();
}

export interface CalcVerdict {
  ok: boolean;
  expected: string | null;
  matchingOptionIds: string[];
  reason?: string;
}

/** Kiểm tra: đúng một phương án khớp với kết quả tính, và đó là đáp án được khai báo. */
export function verifyCalcOptions(
  calc: CalcCheck,
  options: { id: string; content: string }[],
  correctOptionId: string,
): CalcVerdict {
  const expected = computeCalc(calc);
  if (expected === null) return { ok: false, expected, matchingOptionIds: [], reason: "Dữ kiện IP/prefix không hợp lệ" };
  const target = normalizeCalcAnswer(expected);
  const matching = options.filter((o) => normalizeCalcAnswer(o.content) === target).map((o) => o.id);
  if (matching.length === 0) return { ok: false, expected, matchingOptionIds: matching, reason: `Không phương án nào bằng kết quả tính ${expected}` };
  if (matching.length > 1) return { ok: false, expected, matchingOptionIds: matching, reason: "Có nhiều phương án cùng đúng" };
  if (matching[0] !== correctOptionId)
    return { ok: false, expected, matchingOptionIds: matching, reason: `Đáp án khai báo ${correctOptionId} nhưng kết quả tính khớp ${matching[0]}` };
  return { ok: true, expected, matchingOptionIds: matching };
}

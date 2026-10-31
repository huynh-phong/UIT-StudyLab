import { describe, expect, it } from "vitest";
import { gradeMcq, wrongFeedback } from "@/lib/grading/mcq";
import { computeCalc, subnetInfo, verifyCalcOptions } from "@/lib/net/ipv4";
import { mcq } from "./helpers";

describe("gradeMcq — chấm trắc nghiệm", () => {
  const q = mcq();

  it("đúng khi chọn đáp án chuẩn", () => {
    expect(gradeMcq(q, "B", 2)).toMatchObject({ isCorrect: true, blank: false, awarded: 2, selected: "B" });
  });

  it("không phân biệt hoa thường và khoảng trắng", () => {
    expect(gradeMcq(q, " b ").isCorrect).toBe(true);
  });

  it("sai khi chọn phương án khác", () => {
    expect(gradeMcq(q, "C")).toMatchObject({ isCorrect: false, blank: false, awarded: 0, selected: "C" });
  });

  it("bỏ trống khi không chọn hoặc chọn mã không tồn tại", () => {
    expect(gradeMcq(q, null)).toMatchObject({ blank: true, isCorrect: false, selected: null });
    expect(gradeMcq(q, "")).toMatchObject({ blank: true });
    expect(gradeMcq(q, "Z")).toMatchObject({ blank: true, isCorrect: false });
  });

  it("phản hồi sai đúng với phương án người dùng đã chọn", () => {
    const f = wrongFeedback(q, "D");
    expect(f.correctOptionId).toBe("B");
    expect(f.correctContent).toBe("192.168.10.64");
    expect(f.whySelectedWrong).toBe("D là broadcast.");
    expect(f.whyCorrect).toBe("Địa chỉ mạng = IP AND mask.");
  });

  it("dùng giải thích ngắn khi thiếu whyCorrect và trả null khi thiếu lý do sai", () => {
    const f = wrongFeedback(mcq({ explanation: { correct: "Ngắn gọn." } }), "A");
    expect(f.whyCorrect).toBe("Ngắn gọn.");
    expect(f.whySelectedWrong).toBeNull();
  });
});

describe("IPv4 — bộ kiểm tra phép tính độc lập", () => {
  it("tính đúng thông tin subnet", () => {
    expect(subnetInfo("192.168.10.77", 26)).toMatchObject({
      network: "192.168.10.64",
      broadcast: "192.168.10.127",
      mask: "255.255.255.192",
      firstHost: "192.168.10.65",
      lastHost: "192.168.10.126",
      usableHosts: 62,
      totalAddresses: 64,
      wildcard: "0.0.0.63",
    });
    expect(subnetInfo("10.1.2.3", 8)?.network).toBe("10.0.0.0");
    expect(subnetInfo("172.16.5.130", 25)?.broadcast).toBe("172.16.5.255");
  });

  it("xử lý /31, /32 và /0", () => {
    expect(subnetInfo("10.0.0.1", 32)?.usableHosts).toBe(1);
    expect(subnetInfo("10.0.0.1", 31)?.usableHosts).toBe(2);
    expect(subnetInfo("8.8.8.8", 0)?.mask).toBe("0.0.0.0");
  });

  it("từ chối dữ kiện không hợp lệ", () => {
    expect(subnetInfo("256.1.1.1", 24)).toBeNull();
    expect(subnetInfo("1.2.3", 24)).toBeNull();
    expect(subnetInfo("1.2.3.4", 33)).toBeNull();
    expect(computeCalc({ kind: "ipv4", ip: "x", prefix: 24, ask: "network" })).toBeNull();
  });

  const calc = { kind: "ipv4" as const, ip: "192.168.10.77", prefix: 26, ask: "network" as const };
  const options = mcq().options;

  it("chấp nhận khi đúng một phương án khớp và là đáp án khai báo (bỏ qua markdown)", () => {
    const md = options.map((o) => ({ ...o, content: `\`${o.content}\`` }));
    expect(verifyCalcOptions(calc, md, "B")).toMatchObject({ ok: true, expected: "192.168.10.64" });
  });

  it("phát hiện đáp án khai báo sai", () => {
    const v = verifyCalcOptions(calc, options, "A");
    expect(v.ok).toBe(false);
    expect(v.matchingOptionIds).toEqual(["B"]);
  });

  it("phát hiện nhiều phương án cùng đúng hoặc không có phương án đúng", () => {
    const dup = options.map((o) => (o.id === "C" ? { ...o, content: "192.168.10.64" } : o));
    expect(verifyCalcOptions(calc, dup, "B").reason).toMatch(/nhiều/);
    const none = options.filter((o) => o.id !== "B");
    expect(verifyCalcOptions(calc, none, "A").reason).toMatch(/Không phương án/);
  });

  it("kiểm tra câu số host khả dụng", () => {
    const opts = [
      { id: "A", content: "32" },
      { id: "B", content: "30 host" },
      { id: "C", content: "31" },
      { id: "D", content: "62" },
    ];
    expect(verifyCalcOptions({ kind: "ipv4", ip: "10.0.0.0", prefix: 27, ask: "usableHosts" }, opts, "B").ok).toBe(true);
  });
});

import type { Difficulty, McqQuestion } from "@/lib/bank/schema";

/**
 * Sinh câu hỏi tính toán MỚI bằng thuật toán (không dùng AI).
 * Mỗi mẫu chọn tham số ngẫu nhiên theo seed, tính đáp án bằng code và tạo phương án nhiễu từ các lỗi sai thường gặp,
 * kèm lời giải có số liệu cụ thể. Đáp án luôn đúng vì được tính trực tiếp.
 */

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

const pick = <T,>(rng: Rng, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];
const int = (rng: Rng, min: number, max: number) => min + Math.floor(rng() * (max - min + 1));

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

interface Choice {
  text: string;
  why?: string;
}

interface Draft {
  template: string;
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

/** Ghép thành McqQuestion: loại phương án trùng, xáo vị trí, gắn lời giải từng phương án sai. */
export function finalize(d: Draft, rng: Rng, id: string): McqQuestion | null {
  const seen = new Set([d.correct]);
  const wrong: Choice[] = [];
  for (const c of d.distractors) {
    if (seen.has(c.text) || wrong.length >= 3) continue;
    seen.add(c.text);
    wrong.push(c);
  }
  if (wrong.length < 3) return null;
  const all = [{ text: d.correct, why: undefined, ok: true }, ...wrong.map((w) => ({ ...w, ok: false }))];
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  const letters = ["A", "B", "C", "D"] as const;
  const correctOptionId = letters[all.findIndex((x) => x.ok)];
  const whyWrong: Record<string, string> = {};
  all.forEach((x, i) => {
    if (!x.ok) whyWrong[letters[i]] = x.why ?? "Kết quả này không khớp với phép tính đúng ở trên.";
  });
  return {
    id,
    courseId: "it005",
    examType: "midterm",
    chapterId: d.chapterId,
    type: "mcq",
    content: d.content,
    options: all.map((x, i) => ({ id: letters[i], content: x.text })),
    correctOptionId,
    explanation: { correct: d.explanation.correct, whyCorrect: d.explanation.whyCorrect ?? d.explanation.correct, whyWrong, related: d.explanation.related, tip: d.explanation.tip },
    difficulty: d.difficulty,
    points: 1,
    source: { kind: "generated", reference: `Sinh tự động theo dạng bài: ${d.template}` },
    verification: "verified",
    tags: ["generated", d.template],
  };
}

const CH1 = "ch1-internet";
const CH2 = "ch2-application";
const CH3 = "ch3-transport";

const ms = (seconds: number) => `${vn(seconds * 1000)} ms`;

export const TEMPLATES: GeneratorTemplate[] = [
  // ───────────── Chương 1 ─────────────
  {
    id: "trans-delay",
    chapterId: CH1,
    title: "Trễ truyền L/R",
    build(rng) {
      const L = pick(rng, [500, 1000, 1250, 1500, 2000, 2500, 4000, 5000]);
      const R = pick(rng, [1, 2, 4, 5, 8, 10, 20]);
      const d = (L * 8) / (R * 1e6);
      return {
        template: "Trễ truyền",
        chapterId: CH1,
        content: `Thời gian trễ do truyền (transmission delay) của một gói có độ dài **${L} byte** trên liên kết có tốc độ truyền **${R} Mbps** là bao nhiêu?`,
        correct: ms(d),
        distractors: [
          { text: ms(d / 8), why: "Quên đổi byte sang bit (phải nhân 8)." },
          { text: ms(d * 8), why: "Nhân 8 hai lần khi đổi đơn vị." },
          { text: ms(d * 1000), why: "Nhầm đơn vị: kết quả bị nhân thêm 1000." },
          { text: ms(d / 1000), why: "Nhầm đơn vị: kết quả bị chia thêm 1000." },
        ],
        explanation: {
          correct: `$d_{trans} = L/R = ${L} \\times 8 / (${R} \\times 10^6) = ${vn(d, 6)}$ s = ${ms(d)}.`,
          tip: "Đổi **byte → bit (×8)** và **Mbps → bps (×10⁶)** trước khi chia.",
        },
        difficulty: "easy",
      };
    },
  },
  {
    id: "total-delay",
    chapterId: CH1,
    title: "Trễ truyền + trễ lan truyền",
    build(rng) {
      const L = pick(rng, [1000, 1500, 2000, 2500, 4000]);
      const R = pick(rng, [1, 2, 4, 5, 10]);
      const km = pick(rng, [200, 500, 1000, 1500, 2000, 3000, 4000]);
      const s = pick(rng, [2e8, 2.5e8, 3e8]);
      const dt = (L * 8) / (R * 1e6);
      const dp = (km * 1000) / s;
      const sTxt = s === 2.5e8 ? "2{,}5 \\times 10^8" : `${s / 1e8} \\times 10^8`;
      return {
        template: "Tổng trễ truyền + lan truyền",
        chapterId: CH1,
        content: `Một gói tin dài **${L} byte** được gửi qua đường truyền **${R} Mbps**, dài **${km} km**, tín hiệu lan truyền với tốc độ $${sTxt}$ m/s. Tổng trễ truyền và trễ lan truyền xấp xỉ bao nhiêu?`,
        correct: ms(dt + dp),
        distractors: [
          { text: ms(dt), why: "Mới chỉ tính trễ truyền, thiếu trễ lan truyền." },
          { text: ms(dp), why: "Mới chỉ tính trễ lan truyền, thiếu trễ truyền." },
          { text: ms(dt / 8 + dp), why: "Quên đổi byte sang bit khi tính trễ truyền." },
          { text: ms(dt + dp / 1000), why: "Quên đổi km sang m khi tính trễ lan truyền." },
        ],
        explanation: {
          correct: `$d_{trans} = ${L}\\times 8/(${R}\\times10^6) = ${ms(dt)}$; $d_{prop} = ${km}\\times10^3 / ${sTxt} = ${ms(dp)}$ → tổng ${ms(dt + dp)}.`,
          related: "$d_{trans} = L/R$ phụ thuộc kích thước gói và tốc độ liên kết; $d_{prop} = d/s$ phụ thuộc khoảng cách.",
        },
        difficulty: "medium",
      };
    },
  },
  {
    id: "throughput",
    chapterId: CH1,
    title: "Thông lượng đầu cuối",
    build(rng) {
      const pool = [1, 2, 3, 4, 5, 8, 10, 20, 50, 100];
      const rates: number[] = [];
      while (rates.length < 3) {
        const r = pick(rng, pool);
        if (!rates.includes(r)) rates.push(r);
      }
      const sorted = [...rates].sort((a, b) => a - b);
      return {
        template: "Thông lượng đầu cuối",
        chapterId: CH1,
        content: `Đường truyền từ host X đến host Y đi qua 3 liên kết nối tiếp có tốc độ lần lượt **${rates.join(" Mbps, ")} Mbps**. Thông lượng đầu cuối là bao nhiêu?`,
        correct: `${sorted[0]} Mbps`,
        distractors: [
          { text: `${sorted[2]} Mbps`, why: "Đây là liên kết nhanh nhất, không phải nút cổ chai." },
          { text: `${sorted[1]} Mbps`, why: "Liên kết này vẫn nhanh hơn liên kết chậm nhất." },
          { text: `${vn(rates.reduce((a, b) => a + b, 0))} Mbps`, why: "Liên kết nối tiếp không cộng dồn tốc độ." },
        ],
        explanation: { correct: `Thông lượng đầu cuối bằng tốc độ của liên kết chậm nhất (nút cổ chai): min(${rates.join(", ")}) = ${sorted[0]} Mbps.`, tip: "Nối tiếp → lấy **min**." },
        difficulty: "easy",
      };
    },
  },
  {
    id: "store-forward",
    chapterId: CH1,
    title: "Store-and-forward qua N liên kết",
    build(rng) {
      const L = pick(rng, [4000, 8000, 10000, 12000, 16000, 20000]);
      const R = pick(rng, [1, 2, 4, 5, 10]);
      const N = int(rng, 2, 5);
      const one = L / (R * 1e6);
      return {
        template: "Store-and-forward",
        chapterId: CH1,
        content: `Một gói **${L} bit** đi từ nguồn đến đích qua **${N} liên kết** giống nhau, mỗi liên kết **${R} Mbps** (store-and-forward, bỏ qua các loại trễ khác). Trễ đầu cuối là bao nhiêu?`,
        correct: ms(N * one),
        distractors: [
          { text: ms(one), why: "Đây là trễ truyền trên một liên kết." },
          { text: ms((N - 1) * one), why: "Thiếu một liên kết: có N liên kết thì truyền lại N lần." },
          { text: ms((N + 1) * one), why: "Thừa một liên kết." },
          { text: ms((N * one) / 8), why: "Đề cho bit, không cần chia 8." },
        ],
        explanation: { correct: `Mỗi liên kết tốn $L/R = ${L}/(${R}\\times10^6) = ${ms(one)}$; store-and-forward qua ${N} liên kết: ${N} × ${ms(one)} = ${ms(N * one)}.` },
        difficulty: "medium",
      };
    },
  },
  {
    id: "traffic-intensity",
    chapterId: CH1,
    title: "Cường độ lưu lượng La/R",
    build(rng) {
      const L = pick(rng, [500, 1000, 1500, 2000]);
      const R = pick(rng, [1, 2, 4, 5]);
      const target = pick(rng, [0.25, 0.4, 0.5, 0.6, 0.75, 0.8, 1.2, 1.5]);
      const a = Math.round((target * R * 1e6) / L);
      const I = (L * a) / (R * 1e6);
      const state = I > 1 ? "trễ hàng đợi tăng đến vô hạn (thực tế sẽ mất gói)" : I > 0.7 ? "trễ hàng đợi khá lớn" : "trễ hàng đợi còn nhỏ";
      return {
        template: "Cường độ lưu lượng",
        chapterId: CH1,
        content: `Gói dài **L = ${L} bit**, trung bình **${a} gói/giây** đến một liên kết **R = ${R} Mbps**. Cường độ lưu lượng $La/R$ bằng bao nhiêu?`,
        correct: vn(I, 3),
        distractors: [
          { text: vn(1 / I, 3), why: "Đảo ngược tỉ số (R/La)." },
          { text: vn(I * 8, 3), why: "Nhân thêm 8 dù L đã tính bằng bit." },
          { text: vn(I / 2, 3), why: "Tính sai tốc độ liên kết." },
          { text: vn(I * 2, 3), why: "Tính sai tốc độ liên kết." },
        ],
        explanation: { correct: `$La/R = ${L} \\times ${a} / (${R}\\times10^6) = ${vn(I, 3)}$ → ${state}.`, tip: "La/R ≈ 0: trễ nhỏ · → 1: trễ lớn · > 1: vô hạn." },
        difficulty: "medium",
      };
    },
  },
  {
    id: "circuit-users",
    chapterId: CH1,
    title: "Số người dùng chuyển mạch kênh",
    build(rng) {
      const link = pick(rng, [100, 200, 500, 1000, 2000]);
      const per = pick(rng, [5, 10, 20, 25, 50, 100]);
      if (per >= link) return TEMPLATES[5].build(rng);
      const n = Math.floor(link / per);
      const linkTxt = link >= 1000 ? `${link / 1000} Gbps` : `${link} Mbps`;
      return {
        template: "Chuyển mạch kênh",
        chapterId: CH1,
        content: `Một liên kết **${linkTxt}**, mỗi người dùng cần **${per} Mbps** khi hoạt động. Với chuyển mạch kênh, liên kết phục vụ tối đa bao nhiêu người dùng?`,
        correct: `${n}`,
        distractors: [
          { text: `${n * 10}`, why: "Nhầm đơn vị tốc độ." },
          { text: `${Math.max(1, Math.round(n / 10))}`, why: "Nhầm đơn vị tốc độ." },
          { text: `${link}`, why: "Đây là tốc độ liên kết, chưa chia cho băng thông mỗi người." },
          { text: `${n + 1}`, why: "Vượt quá dung lượng liên kết." },
        ],
        explanation: { correct: `Chuyển mạch kênh cấp cố định ${per} Mbps cho mỗi người: ${link} / ${per} = ${n} người.`, related: "Với chuyển mạch gói, liên kết phục vụ được nhiều người hơn vì người dùng không hoạt động liên tục." },
        difficulty: "easy",
      };
    },
  },

  // ───────────── Chương 2 ─────────────
  {
    id: "http-nonpersistent",
    chapterId: CH2,
    title: "HTTP không bền vững",
    build(rng) {
      const n = int(rng, 2, 12);
      const total = 2 * (n + 1);
      return {
        template: "HTTP không bền vững",
        chapterId: CH2,
        content: `Trang web gồm 1 file HTML và **${n} ảnh** nhỏ (bỏ qua thời gian truyền). Với **HTTP không bền vững**, tải tuần tự, tổng thời gian là bao nhiêu RTT?`,
        correct: `${total} RTT`,
        distractors: [
          { text: `${n + 1} RTT`, why: "Chỉ tính 1 RTT mỗi đối tượng, quên bắt tay TCP." },
          { text: `${n + 2} RTT`, why: "Đây là kết quả của kết nối bền vững không pipelining." },
          { text: `${2 * n} RTT`, why: "Quên đối tượng file HTML." },
          { text: `${total + 1} RTT`, why: "Thừa 1 RTT." },
        ],
        explanation: { correct: `Mỗi đối tượng cần 2 RTT (1 RTT bắt tay TCP + 1 RTT request/response). Có ${n + 1} đối tượng → ${n + 1} × 2 = ${total} RTT.` },
        difficulty: "medium",
      };
    },
  },
  {
    id: "http-persistent",
    chapterId: CH2,
    title: "HTTP bền vững không pipelining",
    build(rng) {
      const n = int(rng, 2, 10);
      const t = pick(rng, [0, 0.5, 1]);
      const total = 1 + (n + 1) * (1 + t);
      const tTxt = t === 0 ? "bỏ qua thời gian truyền" : `thời gian truyền mỗi đối tượng là ${vn(t)} RTT`;
      return {
        template: "HTTP bền vững",
        chapterId: CH2,
        content: `Người dùng dùng **HTTP/1.1 bền vững, không pipelining** tải trang gồm 1 file HTML và **${n} ảnh**; ${tTxt}. Tổng thời gian là bao nhiêu RTT?`,
        correct: `${vn(total)} RTT`,
        distractors: [
          { text: `${vn((n + 1) * (1 + t))} RTT`, why: "Quên 1 RTT bắt tay TCP ban đầu." },
          { text: `${vn(2 * (n + 1) + (n + 1) * t)} RTT`, why: "Đây là cách tính cho HTTP không bền vững." },
          { text: `${vn(1 + (n + 1))} RTT`, why: "Quên thời gian truyền các đối tượng." },
          { text: `${vn(2 + t * (n + 1) + 1)} RTT`, why: "Đây là cách tính cho kết nối bền vững có pipelining." },
        ],
        explanation: {
          correct: `1 RTT mở kết nối TCP, sau đó mỗi đối tượng tốn 1 RTT request/response${t ? ` + ${vn(t)} RTT truyền` : ""}: 1 + ${n + 1} × ${vn(1 + t)} = ${vn(total)} RTT.`,
          related: "Non-persistent: mỗi đối tượng 2 RTT. Persistent không pipelining: 1 RTT bắt tay + 1 RTT mỗi đối tượng. Persistent pipelining: 1 RTT bắt tay + 1 RTT HTML + 1 RTT cho tất cả ảnh.",
        },
        difficulty: "hard",
      };
    },
  },
  {
    id: "web-cache",
    chapterId: CH2,
    title: "Độ khả dụng đường truy cập có web cache",
    build(rng) {
      const R = pick(rng, [1.54, 2, 5, 10]);
      const ratio = pick(rng, [0.8, 0.9, 0.95, 0.97]);
      const rate = Number((R * ratio).toFixed(2));
      const h = pick(rng, [0.2, 0.3, 0.4, 0.5, 0.6]);
      const u = ((1 - h) * rate) / R;
      return {
        template: "Web cache",
        chapterId: CH2,
        content: `Đường truy cập Internet của một tổ chức có tốc độ **${vn(R)} Mbps**, lưu lượng yêu cầu trung bình **${vn(rate)} Mbps**. Lắp web cache có tỉ lệ trúng **${vn(h * 100)}%**. Độ khả dụng (utilization) của đường truy cập xấp xỉ:`,
        correct: vn(u, 2),
        distractors: [
          { text: vn(rate / R, 2), why: "Đây là độ khả dụng khi chưa có cache." },
          { text: vn((h * rate) / R, 2), why: "Phần trúng cache không đi ra đường truy cập; phải lấy phần trượt (1 − h)." },
          { text: vn(h, 2), why: "Đây là tỉ lệ trúng cache." },
          { text: vn(1 - h, 2), why: "Đây là tỉ lệ trượt, chưa nhân với lưu lượng và chia cho tốc độ đường truy cập." },
        ],
        explanation: { correct: `Chỉ ${vn((1 - h) * 100)}% yêu cầu phải ra Internet: ${vn(1 - h)} × ${vn(rate)} = ${vn((1 - h) * rate)} Mbps; độ khả dụng = ${vn((1 - h) * rate)} / ${vn(R)} ≈ ${vn(u, 2)}.` },
        difficulty: "hard",
      };
    },
  },
  {
    id: "cs-distribution",
    chapterId: CH2,
    title: "Thời gian phân phối file client–server",
    build(rng) {
      const F = pick(rng, [1, 2, 5, 10, 15]); // Gbit
      const us = pick(rng, [10, 20, 30, 50, 100]); // Mbps
      const dmin = pick(rng, [1, 2, 5, 10]); // Mbps
      const N = pick(rng, [10, 50, 100, 500, 1000]);
      const Fb = F * 1e9;
      const t = Math.max((N * Fb) / (us * 1e6), Fb / (dmin * 1e6));
      const sec = (x: number) => `${vn(x, 1)} s`;
      return {
        template: "Phân phối file client–server",
        chapterId: CH2,
        content: `Server phân phối một file **F = ${F} Gbit** đến **N = ${N}** máy theo mô hình client–server. Tốc độ tải lên của server $u_s = ${us}$ Mbps, tốc độ tải xuống nhỏ nhất của client $d_{min} = ${dmin}$ Mbps. Thời gian phân phối tối thiểu là:`,
        correct: sec(t),
        distractors: [
          { text: sec(Fb / (us * 1e6)), why: "Quên rằng server phải gửi N bản sao." },
          { text: sec(Fb / (dmin * 1e6)), why: "Chỉ xét giới hạn tải xuống của client." },
          { text: sec((N * Fb) / (dmin * 1e6)), why: "Nhầm: mỗi client chỉ tải 1 bản, không phải N bản." },
          { text: sec(Math.min((N * Fb) / (us * 1e6), Fb / (dmin * 1e6))), why: "Phải lấy max, không phải min." },
        ],
        explanation: { correct: `$D_{cs} = \\max\\{NF/u_s,\\ F/d_{min}\\} = \\max\\{${vn((N * Fb) / (us * 1e6), 1)},\\ ${vn(Fb / (dmin * 1e6), 1)}\\}$ = ${sec(t)}.` },
        difficulty: "hard",
      };
    },
  },

  // ───────────── Chương 3 ─────────────
  {
    id: "checksum",
    chapterId: CH3,
    title: "Internet checksum 16 bit",
    build(rng) {
      const a = int(rng, 0x1000, 0xffff);
      const b = int(rng, 0x1000, 0xffff);
      const raw = a + b;
      const sum = (raw & 0xffff) + (raw >> 16);
      const cs = ~sum & 0xffff;
      const noWrap = ~(raw & 0xffff) & 0xffff;
      const bits = (v: number) => {
        const s = v.toString(2).padStart(16, "0");
        return `\`${s.slice(0, 4)} ${s.slice(4, 8)} ${s.slice(8, 12)} ${s.slice(12)}\``;
      };
      const flip = cs ^ (1 << int(rng, 0, 15));
      return {
        template: "Checksum",
        chapterId: CH3,
        content: `Tính Internet checksum của hai từ 16 bit sau:\n\n${bits(a)}\n\n${bits(b)}`,
        correct: bits(cs),
        distractors: [
          { text: bits(sum), why: "Đây là tổng, chưa lấy bù 1." },
          { text: bits(noWrap), why: raw > 0xffff ? "Quên cộng bit tràn vòng (wraparound) về bit thấp trước khi lấy bù." : "Sai ở bước cộng." },
          { text: bits(flip), why: "Sai một bit khi cộng hoặc khi lấy bù." },
          { text: bits(~flip & 0xffff), why: "Cộng sai một bit." },
        ],
        explanation: {
          correct: `Tổng ${raw > 0xffff ? "(đã cộng bit tràn vòng) " : ""}= ${bits(sum)}; lấy bù 1 → checksum = ${bits(cs)}.`,
          tip: "Checksum = **bù 1 của tổng**; bit tràn ra khỏi 16 bit phải cộng vòng lại.",
        },
        difficulty: "medium",
      };
    },
  },
  {
    id: "udp-length",
    chapterId: CH3,
    title: "Trường Length của UDP",
    build(rng) {
      const forward = rng() < 0.5;
      const n = pick(rng, [100, 150, 200, 300, 500, 512, 800, 1000, 1200, 1400]);
      if (forward)
        return {
          template: "UDP Length",
          chapterId: CH3,
          content: `Ứng dụng gửi thông điệp **${n} byte** qua UDP. Giá trị trường **Length** trong UDP header là bao nhiêu byte?`,
          correct: `${n + 8}`,
          distractors: [
            { text: `${n}`, why: "Length tính cả 8 byte header." },
            { text: `${n - 8}`, why: "Phải cộng 8 byte header chứ không trừ." },
            { text: `${n + 20}`, why: "20 byte là header TCP tối thiểu, không phải UDP." },
            { text: `${n + 16}`, why: "Header UDP là 8 byte, không phải 16." },
          ],
          explanation: { correct: `Length = header (8 byte) + dữ liệu (${n} byte) = ${n + 8}.` },
          difficulty: "easy",
        };
      return {
        template: "UDP Length",
        chapterId: CH3,
        content: `Trường **Length** của một segment UDP có giá trị **${n}**. Phần dữ liệu thực sự dài bao nhiêu byte?`,
        correct: `${n - 8} byte`,
        distractors: [
          { text: `${n} byte`, why: "Length gồm cả header, phải trừ 8." },
          { text: `${n + 8} byte`, why: "Phải trừ 8 byte header chứ không cộng." },
          { text: `${n - 20} byte`, why: "20 byte là header TCP, không phải UDP." },
          { text: `${n - 16} byte`, why: "Header UDP là 8 byte." },
        ],
        explanation: { correct: `Dữ liệu = Length − 8 byte header = ${n} − 8 = ${n - 8} byte.` },
        difficulty: "easy",
      };
    },
  },
  {
    id: "tcp-ack",
    chapterId: CH3,
    title: "Số ACK của TCP",
    build(rng) {
      const seq = int(rng, 10, 5000);
      const len = pick(rng, [20, 30, 50, 100, 200, 500, 1000, 1460]);
      return {
        template: "TCP ACK",
        chapterId: CH3,
        content: `Host A gửi cho B một segment có **Seq = ${seq}**, chứa **${len} byte** dữ liệu. B nhận đúng. Số ACK mà B gửi lại là:`,
        correct: `${seq + len}`,
        distractors: [
          { text: `${seq + len + 1}`, why: "TCP ACK = Seq + số byte, không cộng thêm 1." },
          { text: `${seq + len - 1}`, why: "Đây là số thứ tự byte cuối đã nhận; ACK là byte tiếp theo đang chờ." },
          { text: `${seq}`, why: "Đây là Seq của segment vừa nhận." },
          { text: `${seq + 1}`, why: "Chỉ đúng khi segment chứa 1 byte (hoặc là SYN)." },
        ],
        explanation: { correct: `ACK = byte tiếp theo đang chờ = Seq + số byte = ${seq} + ${len} = ${seq + len}.`, tip: "ACK = **byte tiếp theo mong đợi** (ACK tích lũy)." },
        difficulty: "easy",
      };
    },
  },
  {
    id: "tcp-three-acks",
    chapterId: CH3,
    title: "Chuỗi ACK của 3 segment",
    build(rng) {
      const s = pick(rng, [0, 100, 200, 500, 1000, 4000]);
      const L = pick(rng, [100, 200, 500, 1000]);
      const list = (xs: number[]) => xs.join(", ");
      return {
        template: "Chuỗi ACK TCP",
        chapterId: CH3,
        content: `A gửi 3 segment liên tiếp, mỗi segment **${L} byte**; segment đầu có **Seq = ${s}**. B nhận đủ và lần lượt gửi 3 ACK. Giá trị 3 ACK là:`,
        correct: list([s + L, s + 2 * L, s + 3 * L]),
        distractors: [
          { text: list([s, s + L, s + 2 * L]), why: "Đây là Seq của 3 segment, không phải ACK." },
          { text: list([s + L + 1, s + 2 * L + 1, s + 3 * L + 1]), why: "TCP ACK không cộng thêm 1." },
          { text: list([L, 2 * L, 3 * L]), why: "Quên Seq khởi đầu." },
          { text: list([s + L - 1, s + 2 * L - 1, s + 3 * L - 1]), why: "Đây là số thứ tự byte cuối mỗi segment; ACK là byte tiếp theo." },
        ],
        explanation: { correct: `Seq của 3 segment: ${list([s, s + L, s + 2 * L])}. ACK = Seq + ${L} → ${list([s + L, s + 2 * L, s + 3 * L])}.` },
        difficulty: "medium",
      };
    },
  },
  {
    id: "tcp-last-seq",
    chapterId: CH3,
    title: "Seq của segment cuối",
    build(rng) {
      const mss = pick(rng, [500, 1000, 1460, 2000]);
      const k = int(rng, 3, 8);
      const M = mss * (k - 1) + int(rng, 1, mss);
      const last = Math.floor((M - 1) / mss) * mss;
      return {
        template: "Seq segment cuối",
        chapterId: CH3,
        content: `Thông điệp **${M} byte** được TCP chia thành các segment, mỗi segment chứa tối đa **${mss} byte**; byte đầu tiên được đánh số 0. Segment cuối cùng có Seq bằng:`,
        correct: `${last}`,
        distractors: [
          { text: `${M - 1}`, why: "Đây là số thứ tự byte cuối cùng, không phải Seq của segment." },
          { text: `${M}`, why: "Byte cuối có số thứ tự M − 1; Seq là byte đầu của segment." },
          { text: `${last - 1}`, why: "Đây là byte cuối của segment trước." },
          { text: `${last + mss}`, why: "Vượt quá kích thước thông điệp." },
        ],
        explanation: { correct: `Các segment có Seq 0, ${mss}, ${2 * mss}, …; segment cuối bắt đầu ở byte ${last} và chứa byte ${last}–${M - 1}.` },
        difficulty: "medium",
      };
    },
  },
  {
    id: "estimated-rtt",
    chapterId: CH3,
    title: "EstimatedRTT",
    build(rng) {
      const E = pick(rng, [80, 100, 120, 150, 200]);
      let S = pick(rng, [60, 90, 110, 140, 160, 180, 240]);
      if (S === E) S += 20;
      const v = 0.875 * E + 0.125 * S;
      return {
        template: "EstimatedRTT",
        chapterId: CH3,
        content: `EstimatedRTT hiện tại = **${E} ms**, SampleRTT vừa đo = **${S} ms**, $\\alpha = 0{,}125$. EstimatedRTT mới là:`,
        correct: `${vn(v)} ms`,
        distractors: [
          { text: `${vn((E + S) / 2)} ms`, why: "Đây là trung bình cộng, không phải trung bình trượt có trọng số." },
          { text: `${vn(0.125 * E + 0.875 * S)} ms`, why: "Đảo trọng số: mẫu mới chỉ chiếm 0,125." },
          { text: `${S} ms`, why: "Chỉ lấy mẫu mới." },
          { text: `${E} ms`, why: "Giá trị ước lượng phải được cập nhật theo mẫu mới." },
        ],
        explanation: { correct: `EstimatedRTT = (1 − α)·${E} + α·${S} = 0,875 × ${E} + 0,125 × ${S} = ${vn(v)} ms.`, related: "TimeoutInterval = EstimatedRTT + 4·DevRTT." },
        difficulty: "medium",
      };
    },
  },
  {
    id: "cwnd-timeout",
    chapterId: CH3,
    title: "cwnd khi timeout",
    build(rng) {
      const c = pick(rng, [8, 10, 12, 16, 20, 24, 30, 32, 40]);
      const pair = (s: number, w: number) => `ssthresh = ${s}, cwnd = ${w}`;
      return {
        template: "Điều khiển tắc nghẽn – timeout",
        chapterId: CH3,
        content: `TCP đang có **cwnd = ${c} MSS** thì xảy ra **timeout**. Giá trị mới (tính theo MSS) là:`,
        correct: pair(c / 2, 1),
        distractors: [
          { text: pair(c / 2, c / 2), why: "cwnd = ssthresh là phản ứng với 3 ACK trùng (TCP Reno), không phải timeout." },
          { text: pair(c, 1), why: "ssthresh phải giảm còn một nửa cwnd." },
          { text: pair(c / 2, c / 2 + 3), why: "Đây là fast recovery khi nhận 3 ACK trùng." },
          { text: pair(c / 2, 0), why: "cwnd nhỏ nhất là 1 MSS." },
        ],
        explanation: { correct: `Timeout: ssthresh = cwnd/2 = ${c / 2}, cwnd = 1 MSS, quay lại slow start.` },
        difficulty: "medium",
      };
    },
  },
  {
    id: "cwnd-dupack",
    chapterId: CH3,
    title: "cwnd khi 3 ACK trùng",
    build(rng) {
      const c = pick(rng, [8, 10, 12, 16, 20, 24, 30, 32]);
      const pair = (s: number, w: number) => `ssthresh = ${s}, cwnd = ${w}`;
      return {
        template: "Điều khiển tắc nghẽn – 3 ACK trùng",
        chapterId: CH3,
        content: `TCP đang có **cwnd = ${c} MSS** thì nhận **3 ACK trùng**. Theo fast recovery (như slide bài giảng), giá trị mới là:`,
        correct: pair(c / 2, c / 2 + 3),
        distractors: [
          { text: pair(c / 2, 1), why: "cwnd = 1 là phản ứng với timeout." },
          { text: pair(c, c / 2), why: "ssthresh phải giảm còn một nửa cwnd." },
          { text: pair(c / 2, c), why: "cwnd phải giảm, không giữ nguyên." },
          { text: pair(c / 2 + 3, c / 2), why: "Đảo vị trí ssthresh và cwnd." },
        ],
        explanation: { correct: `3 ACK trùng: ssthresh = ${c}/2 = ${c / 2}; cwnd = ssthresh + 3 = ${c / 2 + 3} MSS.` },
        difficulty: "hard",
      };
    },
  },
  {
    id: "sr-window",
    chapterId: CH3,
    title: "Cửa sổ tối đa Selective Repeat",
    build(rng) {
      const k = int(rng, 2, 6);
      const space = 2 ** k;
      return {
        template: "Cửa sổ Selective Repeat",
        chapterId: CH3,
        content: `Selective Repeat dùng số thứ tự **${k} bit** (0 – ${space - 1}). Kích thước cửa sổ lớn nhất để bên nhận không nhầm gói cũ với gói mới là:`,
        correct: `${space / 2}`,
        distractors: [
          { text: `${space - 1}`, why: "Đây là giới hạn của Go-Back-N." },
          { text: `${space}`, why: "Bằng toàn bộ không gian số thứ tự chắc chắn gây nhầm lẫn." },
          { text: `${space / 2 - 1}`, why: "An toàn nhưng chưa phải giá trị lớn nhất." },
          { text: `${k}`, why: "Đây là số bit, không phải kích thước cửa sổ." },
        ],
        explanation: { correct: `Với Selective Repeat, cửa sổ ≤ một nửa không gian số thứ tự: ${space}/2 = ${space / 2}.` },
        difficulty: "hard",
      };
    },
  },
  {
    id: "stop-wait-util",
    chapterId: CH3,
    title: "Hiệu suất stop-and-wait",
    build(rng) {
      const L = pick(rng, [8000, 12000, 16000]);
      const R = pick(rng, [1e8, 1e9]);
      const rtt = pick(rng, [10, 20, 30, 40, 60]);
      const tx = (L / R) * 1000;
      const U = tx / (rtt + tx);
      return {
        template: "Hiệu suất stop-and-wait",
        chapterId: CH3,
        content: `Giao thức stop-and-wait với **L = ${L} bit**, **R = ${R === 1e9 ? "1 Gbps" : "100 Mbps"}**, **RTT = ${rtt} ms**. Hiệu suất sử dụng kênh của bên gửi xấp xỉ:`,
        correct: vnSig(U),
        distractors: [
          { text: vnSig(U * 10), why: "Sai một bậc do đổi đơn vị." },
          { text: vnSig(U * 100), why: "Sai hai bậc do đổi đơn vị." },
          { text: vnSig(U / 10), why: "Sai một bậc do đổi đơn vị." },
          { text: vnSig(tx), why: "Đây là L/R tính bằng ms, chưa chia cho (RTT + L/R)." },
        ],
        explanation: { correct: `$L/R = ${vn(tx, 4)}$ ms; $U = \\frac{L/R}{RTT + L/R} = \\frac{${vn(tx, 4)}}{${vn(rtt + tx, 4)}} \\approx ${vnSig(U)}$.`, related: "Hiệu suất stop-and-wait rất thấp khi RTT lớn → cần pipelining (Go-Back-N, Selective Repeat)." },
        difficulty: "hard",
      };
    },
  },
  {
    id: "gbn-sr-retransmit",
    chapterId: CH3,
    title: "Go-Back-N / Selective Repeat gửi lại",
    build(rng) {
      const last = int(rng, 4, 7);
      const lost = int(rng, 1, last - 2);
      const gbn = rng() < 0.5;
      const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => `pkt${a + i}`).join(", ");
      const all = range(lost, last);
      return {
        template: gbn ? "Go-Back-N gửi lại" : "Selective Repeat gửi lại",
        chapterId: CH3,
        content: `${gbn ? "Go-Back-N" : "Selective Repeat"}, cửa sổ đủ lớn: bên gửi đã gửi pkt0 – pkt${last}, trong đó **pkt${lost} bị mất**, các gói còn lại đến bên nhận bình thường. Khi pkt${lost} hết giờ, bên gửi sẽ:`,
        correct: gbn ? `Gửi lại ${all}` : `Chỉ gửi lại pkt${lost}`,
        distractors: [
          gbn ? { text: `Chỉ gửi lại pkt${lost}`, why: "Chỉ gửi lại gói mất là Selective Repeat; bên nhận GBN đã hủy các gói sau." } : { text: `Gửi lại ${all}`, why: "Gửi lại cả loạt là Go-Back-N; bên nhận SR đã lưu đệm các gói sau." },
          { text: `Gửi lại ${range(0, last)}`, why: `Các gói trước pkt${lost} đã được xác nhận.` },
          { text: `Gửi tiếp pkt${last + 1}`, why: `pkt${lost} chưa được xác nhận nên phải gửi lại.` },
          { text: "Không gửi lại gói nào", why: "Gói mất phải được gửi lại." },
        ],
        explanation: {
          correct: gbn
            ? `Bên nhận Go-Back-N hủy mọi gói đến sau gói mất, nên bên gửi gửi lại pkt${lost} và tất cả gói sau nó: ${all}.`
            : `Selective Repeat có timer riêng từng gói và bên nhận đã lưu đệm các gói đến sau, nên chỉ gửi lại pkt${lost}.`,
        },
        difficulty: "medium",
      };
    },
  },
];

export function templatesFor(chapterId: string) {
  return TEMPLATES.filter((t) => t.chapterId === chapterId);
}

/** Sinh một câu hỏi từ mẫu; thử lại với seed khác nếu phương án nhiễu bị trùng. */
export function generateFromTemplate(t: GeneratorTemplate, seed: number): McqQuestion {
  for (let attempt = 0; attempt < 20; attempt++) {
    const s = (seed + attempt * 7919) >>> 0;
    const rng = seededRng(s);
    const q = finalize(t.build(rng), rng, `gen-${t.id}-${s.toString(36)}`);
    if (q) return q;
  }
  throw new Error(`Không sinh được câu hợp lệ cho mẫu ${t.id}`);
}

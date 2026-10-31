import type { McqQuestion, EssayQuestion } from "@/lib/bank/schema";

export function mcq(overrides: Partial<McqQuestion> = {}): McqQuestion {
  return {
    id: "q-mcq",
    courseId: "it005",
    examType: "midterm",
    chapterId: "ch1",
    type: "mcq",
    content: "Địa chỉ mạng của `192.168.10.77/26` là gì?",
    options: [
      { id: "A", content: "192.168.10.0" },
      { id: "B", content: "192.168.10.64" },
      { id: "C", content: "192.168.10.77" },
      { id: "D", content: "192.168.10.127" },
    ],
    correctOptionId: "B",
    explanation: {
      correct: "77 AND 192 = 64.",
      whyCorrect: "Địa chỉ mạng = IP AND mask.",
      whyWrong: { A: "A sai vì…", C: "C là địa chỉ host.", D: "D là broadcast." },
      related: "Bước nhảy 64.",
      tip: "256 − 192 = 64",
    },
    source: { kind: "original" },
    verification: "verified",
    ...overrides,
  };
}

export function essay(overrides: Partial<EssayQuestion> = {}): EssayQuestion {
  return {
    id: "q-essay",
    courseId: "it005",
    examType: "midterm",
    chapterId: "ch1",
    type: "essay",
    content: "So sánh TCP và UDP.",
    essay: {
      modelAnswer: "TCP hướng kết nối, UDP không hướng kết nối…",
      rubric: [
        { id: "r1", criterion: "Hướng kết nối", points: 2 },
        { id: "r2", criterion: "Ví dụ ứng dụng", points: 2 },
      ],
    },
    source: { kind: "original" },
    verification: "verified",
    ...overrides,
  };
}

export const SECRET = "test-secret-0123456789-abcdefghijklmnopqrstuvwxyz";

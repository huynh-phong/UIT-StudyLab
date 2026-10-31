/** Đo độ tương đồng văn bản để phát hiện câu AI tạo trùng hoặc quá giống câu gốc. */

export function normalizeText(s: string): string {
  return s
    .normalize("NFC")
    .toLowerCase()
    .replace(/[`*_#>$\\|]/g, " ")
    .replace(/[.,;:!?()[\]{}"'“”‘’]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function shingles(s: string, n = 3): Set<string> {
  const words = normalizeText(s).split(" ").filter(Boolean);
  const out = new Set<string>();
  if (words.length < n) {
    if (words.length) out.add(words.join(" "));
    return out;
  }
  for (let i = 0; i <= words.length - n; i++) out.add(words.slice(i, i + n).join(" "));
  return out;
}

/** Jaccard trên word 3-gram, 0..1. */
export function similarity(a: string, b: string): number {
  const A = shingles(a);
  const B = shingles(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

export function questionText(q: { content: string; options?: { content: string }[] }) {
  return [q.content, ...(q.options?.map((o) => o.content) ?? [])].join(" \n ");
}

export function maxSimilarity(text: string, others: string[]): { score: number; index: number } {
  let best = { score: 0, index: -1 };
  others.forEach((o, i) => {
    const s = similarity(text, o);
    if (s > best.score) best = { score: s, index: i };
  });
  return best;
}

export function fingerprint(q: { content: string; options?: { content: string }[] }) {
  return normalizeText(questionText(q)).slice(0, 400);
}

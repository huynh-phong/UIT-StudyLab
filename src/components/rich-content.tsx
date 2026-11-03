"use client";

import { memo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { protectRegisters } from "@/lib/mips/markdown";
import { cn } from "@/lib/utils";

/**
 * Hiển thị nội dung câu hỏi/đáp án/giải thích: Markdown (GFM: bảng, danh sách), LaTeX ($...$ / $$...$$),
 * code, ảnh. Không render HTML thô → an toàn trước XSS từ dữ liệu nhập.
 */

const blockComponents: Components = {
  table: ({ children }) => (
    <div className="table-wrap">
      <table>{children}</table>
    </div>
  ),
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  img: ({ src, alt }) =>
    typeof src === "string" ? (
      // eslint-disable-next-line @next/next/no-img-element -- ảnh câu hỏi có kích thước tùy ý
      <img src={src} alt={alt ?? "Hình minh họa câu hỏi"} loading="lazy" />
    ) : null,
};

const inlineComponents: Components = {
  ...blockComponents,
  p: ({ children }) => <span className="block">{children}</span>,
};

const remarkPlugins = [remarkGfm, remarkMath];
const rehypePlugins = [[rehypeKatex, { throwOnError: false, strict: "ignore" }]] as never;

export const RichContent = memo(function RichContent({ children, className, inline = false }: { children: string; className?: string; inline?: boolean }) {
  return (
    <div className={cn("rich", className)}>
      <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins} components={inline ? inlineComponents : blockComponents}>
        {protectRegisters(children)}
      </ReactMarkdown>
    </div>
  );
});

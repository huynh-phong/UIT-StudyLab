import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import "katex/dist/katex.min.css";
import "./globals.css";
import { Providers } from "@/components/providers";

const font = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-be-vietnam",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "UIT StudyLab — Ôn tập và thi thử", template: "%s · UIT StudyLab" },
  description:
    "UIT StudyLab: nền tảng ôn tập giữa kỳ, cuối kỳ và thi thử dành cho sinh viên Trường ĐH Công nghệ Thông tin. Dự án độc lập, không phải hệ thống chính thức của nhà trường.",
  applicationName: "UIT StudyLab",
};

export const viewport: Viewport = {
  themeColor: "#f8faff",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={font.variable}>
      <body className="min-h-dvh bg-background font-sans text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

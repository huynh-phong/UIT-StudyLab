import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import "katex/dist/katex.min.css";
import "./globals.css";
import { Providers } from "@/components/providers";
import { THEME_INIT_SCRIPT } from "@/components/theme-switcher";

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
  authors: [{ name: "Huỳnh Mai Phong" }],
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8faff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1120" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: data-theme do script bên dưới đặt trước khi React chạy
    <html lang="vi" className={font.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-dvh bg-background font-sans text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center p-6 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-error-soft text-red-600">
        <AlertTriangle className="size-7" />
      </div>
      <h1 className="text-xl font-bold">Đã có lỗi xảy ra</h1>
      <p className="mt-1.5 max-w-sm text-sm text-muted">Tiến độ học tập của bạn vẫn được lưu trên trình duyệt. Hãy thử tải lại.</p>
      <div className="mt-6 flex gap-2">
        <Button onClick={reset}>Thử lại</Button>
        <Button variant="outline" asChild>
          <Link href="/">Về trang chủ</Link>
        </Button>
      </div>
    </div>
  );
}

import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center p-6 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        <SearchX className="size-7" />
      </div>
      <h1 className="text-xl font-bold">Không tìm thấy trang</h1>
      <p className="mt-1.5 max-w-sm text-sm text-muted">Trang hoặc chương bạn tìm không tồn tại, hoặc bộ đề đã được cập nhật.</p>
      <Button asChild className="mt-6">
        <Link href="/">Về trang tổng quan</Link>
      </Button>
    </div>
  );
}

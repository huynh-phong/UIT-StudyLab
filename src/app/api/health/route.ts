import { NextResponse } from "next/server";
import { getFeatureFlags } from "@/lib/server/env";

export const dynamic = "force-dynamic";

/** Trạng thái cấu hình — chỉ trả về boolean, không bao giờ trả giá trị biến môi trường. */
export function GET() {
  return NextResponse.json({ ok: true, features: getFeatureFlags() });
}

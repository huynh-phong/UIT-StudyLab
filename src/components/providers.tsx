"use client";

import { MotionConfig } from "motion/react";

export function Providers({ children }: { children: React.ReactNode }) {
  // reducedMotion="user": tôn trọng thiết lập prefers-reduced-motion của hệ điều hành
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

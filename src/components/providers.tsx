"use client";

import { MotionConfig } from "motion/react";
import { useThemeSync } from "./theme-switcher";

export function Providers({ children }: { children: React.ReactNode }) {
  useThemeSync();
  // reducedMotion="user": tôn trọng thiết lập prefers-reduced-motion của hệ điều hành
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

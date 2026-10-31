import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium [&_svg]:size-3.5", {
  variants: {
    variant: {
      default: "bg-primary-soft text-primary",
      secondary: "bg-secondary-soft text-teal-700",
      success: "bg-success-soft text-green-700",
      error: "bg-error-soft text-red-700",
      warning: "bg-warning-soft text-amber-700",
      outline: "border border-border text-muted",
      muted: "bg-subtle text-muted",
    },
  },
  defaultVariants: { variant: "default" },
});

export function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

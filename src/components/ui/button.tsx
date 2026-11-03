"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-[background-color,border-color,color,box-shadow,transform] duration-200 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-sm shadow-primary/20 hover:bg-primary-hover hover:shadow-md hover:shadow-primary/25",
        secondary: "bg-secondary text-primary-foreground shadow-sm shadow-secondary/20 hover:bg-secondary-hover",
        outline: "border border-border bg-surface text-foreground hover:border-primary/40 hover:bg-primary-soft hover:text-primary",
        soft: "bg-primary-soft text-primary hover:bg-primary-soft-hover",
        ghost: "text-muted hover:bg-subtle hover:text-foreground",
        danger: "bg-error text-primary-foreground hover:bg-error-hover",
        success: "bg-success text-primary-foreground hover:bg-success-hover",
      },
      size: {
        sm: "h-9 px-3",
        default: "h-11 px-5",
        lg: "h-12 px-6 text-base",
        icon: "size-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
});
Button.displayName = "Button";

export { buttonVariants };

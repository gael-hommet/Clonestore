import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full",
    "text-sm font-semibold tracking-[-0.02em] outline-none",
    "transition-all duration-[var(--cs-speed-fast)] ease-[var(--cs-ease-premium)]",
    "disabled:pointer-events-none disabled:opacity-50",
    "focus-visible:ring-[3px] focus-visible:ring-ring/35",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ].join(" "),
  {
    variants: {
      variant: {
        default: [
          "text-white",
          "border border-[color:color-mix(in_srgb,var(--cs-violet)_18%,white)]",
          "bg-[linear-gradient(135deg,color-mix(in_srgb,var(--cs-violet)_92%,white),color-mix(in_srgb,var(--cs-violet-2)_88%,white_12%))]",
          "shadow-[0_16px_36px_rgba(103,87,255,0.22)]",
          "hover:-translate-y-[1px] hover:shadow-[0_22px_46px_rgba(103,87,255,0.26)]",
        ].join(" "),
        secondary: [
          "text-[color:var(--cs-ink-1)]",
          "border border-[color:var(--cs-line-soft)]",
          "bg-[linear-gradient(180deg,rgba(255,255,255,0.76),rgba(255,255,255,0.56))]",
          "shadow-[var(--cs-shadow-soft),var(--cs-shadow-inner)]",
          "backdrop-blur-md",
          "hover:-translate-y-[1px] hover:bg-white/90",
        ].join(" "),
        outline: [
          "text-[color:var(--cs-ink-1)]",
          "border border-[color:var(--cs-line)]",
          "bg-white/42",
          "backdrop-blur-md",
          "hover:-translate-y-[1px] hover:bg-white/62",
        ].join(" "),
        ghost: [
          "text-[color:var(--cs-ink-2)]",
          "hover:bg-white/50 hover:text-[color:var(--cs-ink-1)]",
        ].join(" "),
        destructive: [
          "text-white",
          "border border-[color:rgba(183,74,74,0.22)]",
          "bg-[linear-gradient(180deg,#d65f5f,#b74a4a)]",
          "shadow-[0_14px_32px_rgba(183,74,74,0.18)]",
          "hover:-translate-y-[1px]",
        ].join(" "),
        link: "rounded-none px-0 text-[color:var(--cs-violet)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-8 px-3 text-[13px]",
        lg: "h-11 px-5 text-[15px]",
        xl: "h-12 px-6 text-[15px]",
        icon: "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
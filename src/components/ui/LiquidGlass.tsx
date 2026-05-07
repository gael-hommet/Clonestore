import * as React from "react";
import { cn } from "@/lib/utils";

type LiquidGlassVariant =
  | "default"
  | "clear"
  | "cream"
  | "nav"
  | "panel"
  | "dark";

type LiquidGlassIntensity = "soft" | "medium" | "strong";

type LiquidGlassProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: LiquidGlassVariant;
  intensity?: LiquidGlassIntensity;
  interactive?: boolean;
  refractive?: boolean;
};

export function LiquidGlass({
  className,
  variant = "default",
  intensity = "medium",
  interactive = false,
  refractive = false,
  children,
  ...props
}: LiquidGlassProps) {
  return (
    <div
      className={cn(
        "liquid-glass",
        variant !== "default" && `liquid-glass--${variant}`,
        `liquid-glass--${intensity}`,
        interactive && "liquid-glass--interactive",
        refractive && "liquid-glass--refractive",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
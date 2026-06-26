"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { DemoTone } from "@/lib/demo/presentation/fixtures";

const dotColor: Record<DemoTone, string> = {
  ok: "bg-[var(--demo-green)]",
  warn: "bg-[var(--demo-amber)]",
  block: "bg-[var(--demo-danger)]",
  info: "bg-[#375bd8]",
};

const badgeClass: Record<DemoTone, string> = {
  ok: "border-[rgba(21,130,96,0.22)] bg-[rgba(21,130,96,0.1)] text-[var(--demo-green)]",
  warn: "border-[rgba(156,102,26,0.24)] bg-[rgba(156,102,26,0.1)] text-[var(--demo-amber)]",
  block: "border-[rgba(184,74,74,0.24)] bg-[rgba(184,74,74,0.1)] text-[var(--demo-danger)]",
  info: "border-[rgba(84,119,255,0.22)] bg-[rgba(84,119,255,0.1)] text-[#375bd8]",
};

export function ToneDot({ tone, className }: { tone: DemoTone; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block h-2 w-2 shrink-0 rounded-full", dotColor[tone], className)}
    />
  );
}

export function StatusBadge({
  tone,
  children,
  className,
}: {
  tone: DemoTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[0.7rem] font-semibold",
        badgeClass[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

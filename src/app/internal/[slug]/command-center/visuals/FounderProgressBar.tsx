"use client";

import * as React from "react";
import { ACCENTS, type AccentName, clampPct } from "./FounderVisualUtils";

/** Barre de progression horizontale (proportion réelle), dégradé CloneStore. */
export function FounderProgressBar({
  value, accent = "violet", gradientTo, height = 8, className = "", label,
}: { value: number; accent?: AccentName; gradientTo?: AccentName; height?: number; className?: string; label?: string }) {
  const pct = clampPct(value);
  const from = ACCENTS[accent].base;
  const to = ACCENTS[gradientTo ?? accent].base;
  return (
    <div
      className={`w-full overflow-hidden rounded-full bg-white/[0.07] ${className}`}
      style={{ height }}
      role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}
    >
      <div
        className="h-full rounded-full"
        style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${from}, ${to})`, boxShadow: `0 0 10px ${ACCENTS[accent].glow}`, transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)" }}
      />
    </div>
  );
}

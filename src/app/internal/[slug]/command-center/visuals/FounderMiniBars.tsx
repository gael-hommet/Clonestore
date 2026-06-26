"use client";

import * as React from "react";
import { ACCENTS, type AccentName } from "./FounderVisualUtils";

export interface MiniBarItem { label: string; value: number; accent?: AccentName }

/** Barres verticales compactes pour une répartition RÉELLE (statuts, étapes, canaux…). */
export function FounderMiniBars({
  items, height = 96, ariaLabel,
}: { items: MiniBarItem[]; height?: number; ariaLabel?: string }) {
  const max = Math.max(1, ...items.map((i) => (Number.isFinite(i.value) ? i.value : 0)));
  return (
    <div role="img" aria-label={ariaLabel ?? "répartition"} className="flex items-end gap-2" style={{ height }}>
      {items.map((it, i) => {
        const tone = ACCENTS[it.accent ?? "violet"];
        const v = Number.isFinite(it.value) ? it.value : 0;
        const h = Math.max(3, Math.round((v / max) * (height - 30)));
        return (
          <div key={`${it.label}-${i}`} className="flex flex-1 flex-col items-center justify-end gap-1.5" title={`${it.label} : ${v}`}>
            <span className="text-[0.62rem] font-bold tabular-nums text-white/80">{v}</span>
            <div
              className="w-full rounded-md"
              style={{ height: h, background: `linear-gradient(180deg, ${tone.base}, ${tone.base}55)`, boxShadow: `0 0 12px ${tone.glow}` }}
            />
            <span className="w-full truncate text-center text-[0.56rem] leading-tight text-white/45">{it.label}</span>
          </div>
        );
      })}
    </div>
  );
}

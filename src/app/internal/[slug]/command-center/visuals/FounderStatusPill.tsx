"use client";

import * as React from "react";
import { ACCENTS, type AccentName } from "./FounderVisualUtils";

/** Pastille d'état scannable (criticité, statut de source…). */
export function FounderStatusPill({
  accent = "violet", children, dot = true,
}: { accent?: AccentName; children: React.ReactNode; dot?: boolean }) {
  const c = ACCENTS[accent];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[0.62rem] font-bold uppercase tracking-wide"
      style={{ background: c.soft, color: c.text }}
    >
      {dot ? <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.base, boxShadow: `0 0 8px ${c.glow}` }} aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

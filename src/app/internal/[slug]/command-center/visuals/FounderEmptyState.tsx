"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { ACCENTS, type AccentName } from "./FounderVisualUtils";
import { GlassCard } from "./FounderSectionShell";

/** Empty state premium : orbe SVG abstraite + titre + explication utile + CTA réel optionnel. */
export function FounderEmptyState({
  icon: Icon, title, description, action, accent = "violet",
}: { icon: LucideIcon; title: string; description?: string; action?: React.ReactNode; accent?: AccentName }) {
  const c = ACCENTS[accent];
  return (
    <GlassCard className="px-6 py-12 text-center">
      <div className="pointer-events-none absolute inset-x-0 top-2 mx-auto h-44 w-44 rounded-full blur-3xl" style={{ background: c.glow, opacity: 0.14 }} aria-hidden="true" />
      <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10" style={{ background: c.soft }}>
        <span className="absolute inset-0 rounded-2xl" style={{ boxShadow: `inset 0 0 24px ${c.glow}` }} aria-hidden="true" />
        <Icon className="h-7 w-7" style={{ color: c.base }} aria-hidden="true" />
      </div>
      <p className="relative mt-4 text-[0.95rem] font-bold text-white">{title}</p>
      {description ? <p className="relative mx-auto mt-1.5 max-w-md text-[0.8rem] leading-relaxed text-white/55">{description}</p> : null}
      {action ? <div className="relative mt-5 flex justify-center">{action}</div> : null}
    </GlassCard>
  );
}

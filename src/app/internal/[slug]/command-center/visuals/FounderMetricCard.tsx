"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { ACCENTS, type AccentName } from "./FounderVisualUtils";
import { GlassCard } from "./FounderSectionShell";

/**
 * Carte KPI premium : icône, valeur, label, sous-info réelle, delta optionnel (seulement s'il
 * existe vraiment), accent chromatique, mini-visualisation optionnelle, halo léger, hover.
 */
export function FounderMetricCard({
  icon: Icon, label, value, sub, accent = "violet", delta, visual, muted = false,
}: {
  icon: LucideIcon; label: string; value: React.ReactNode; sub?: React.ReactNode; accent?: AccentName;
  delta?: { label: string; tone: AccentName } | null; visual?: React.ReactNode; muted?: boolean;
}) {
  const c = ACCENTS[accent];
  return (
    <GlassCard interactive className="p-4">
      <div className="pointer-events-none absolute -right-7 -top-10 h-24 w-24 rounded-full blur-2xl" style={{ background: c.glow, opacity: muted ? 0.06 : 0.22 }} aria-hidden="true" />
      <div className="relative flex items-start justify-between gap-2">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10" style={{ background: c.soft, color: c.base }}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        {delta ? (
          <span className="rounded-full px-2 py-0.5 text-[0.6rem] font-bold" style={{ background: ACCENTS[delta.tone].soft, color: ACCENTS[delta.tone].text }}>
            {delta.label}
          </span>
        ) : null}
      </div>
      <p className="relative mt-3 text-[1.5rem] font-bold leading-none tracking-tight text-white">{value}</p>
      <p className="relative mt-1.5 text-[0.78rem] font-semibold text-white/75">{label}</p>
      {sub ? <p className="relative mt-0.5 text-[0.62rem] leading-snug text-white/40">{sub}</p> : null}
      {visual ? <div className="relative mt-3">{visual}</div> : null}
    </GlassCard>
  );
}

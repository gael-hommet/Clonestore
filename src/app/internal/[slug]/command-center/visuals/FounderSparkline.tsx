"use client";

import * as React from "react";
import { ACCENTS, type AccentName } from "./FounderVisualUtils";

/**
 * Mini courbe SVG (aire + ligne). À n'utiliser QUE pour une vraie série ordonnée (ex. la
 * décroissance des étapes d'un funnel réel). Si moins de 2 points → ne rend rien (jamais de
 * courbe inventée). Ce n'est pas un historique temporel sauf si la série en est réellement un.
 */
export function FounderSparkline({
  data, width = 140, height = 40, accent = "violet", ariaLabel,
}: { data: number[]; width?: number; height?: number; accent?: AccentName; ariaLabel?: string }) {
  const id = React.useId();
  if (!Array.isArray(data) || data.length < 2) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = max - min || 1;
  const x = (i: number) => (i / (data.length - 1)) * width;
  const y = (v: number) => height - 3 - ((v - min) / span) * (height - 6);
  const line = data.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L ${width.toFixed(1)} ${height} L 0 ${height} Z`;
  const c = ACCENTS[accent].base;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel ?? "tendance"} className="overflow-visible">
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={c} stopOpacity="0.3" />
          <stop offset="100%" stopColor={c} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id}-fill)`} />
      <path d={line} fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(data.length - 1)} cy={y(data[data.length - 1])} r="2.6" fill={c} style={{ filter: `drop-shadow(0 0 5px ${ACCENTS[accent].glow})` }} />
    </svg>
  );
}

"use client";

import * as React from "react";
import { ACCENTS, type AccentName, clampPct, prefersReducedMotion } from "./FounderVisualUtils";

/**
 * Anneau de progression SVG — UNIQUEMENT pour de vraies proportions (conversion, activation,
 * readiness, couverture…). Valeur bornée [0,100], piste sombre, dégradé CloneStore, animation
 * de remplissage au montage (désactivée si prefers-reduced-motion).
 */
export function FounderProgressRing({
  value, size = 96, stroke = 9, accent = "violet", gradientTo, center, caption, label,
}: {
  value: number; size?: number; stroke?: number; accent?: AccentName; gradientTo?: AccentName;
  center?: React.ReactNode; caption?: React.ReactNode; label?: string;
}) {
  const pct = clampPct(value);
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const id = React.useId();
  const [drawn, setDrawn] = React.useState(0);

  React.useEffect(() => {
    if (prefersReducedMotion()) { setDrawn(pct); return; }
    const t = requestAnimationFrame(() => setDrawn(pct));
    return () => cancelAnimationFrame(t);
  }, [pct]);

  const from = ACCENTS[accent].base;
  const to = ACCENTS[gradientTo ?? accent].base;
  const offset = circ - (drawn / 100) * circ;

  return (
    <div className="flex flex-col items-center gap-2" role="img" aria-label={label ?? `${pct} %`}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }} aria-hidden="true">
          <defs>
            <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={from} />
              <stop offset="100%" stopColor={to} />
            </linearGradient>
          </defs>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth={stroke} />
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#${id})`} strokeWidth={stroke}
            strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.9s cubic-bezier(0.4,0,0.2,1)", filter: `drop-shadow(0 0 6px ${ACCENTS[accent].glow})` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          {center ?? (
            <span className="text-[1.15rem] font-bold leading-none text-white">
              {pct}<span className="ml-0.5 text-[0.62rem] font-semibold text-white/45">%</span>
            </span>
          )}
        </div>
      </div>
      {caption ? <div className="max-w-[8.5rem] text-center text-[0.7rem] font-semibold leading-tight text-white/55">{caption}</div> : null}
    </div>
  );
}

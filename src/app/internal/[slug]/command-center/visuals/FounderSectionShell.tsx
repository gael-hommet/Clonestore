"use client";

import * as React from "react";
import { ACCENTS, type AccentName } from "./FounderVisualUtils";

/** Carte en verre sombre (glassmorphism) — base de tous les blocs du cockpit. */
export function GlassCard({
  className = "", children, interactive = false, style,
}: { className?: string; children: React.ReactNode; interactive?: boolean; style?: React.CSSProperties }) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.035] backdrop-blur-xl ${interactive ? "transition-colors duration-300 hover:border-white/[0.18] hover:bg-white/[0.06]" : ""} ${className}`}
      style={{ boxShadow: "0 18px 46px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.06)", ...style }}
    >
      {children}
    </div>
  );
}

/** Conteneur de section : titre, description, action, halo localisé. */
export function FounderSectionShell({
  title, description, action, accent = "violet", children, className = "", bodyClassName = "",
}: {
  title?: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode;
  accent?: AccentName; children: React.ReactNode; className?: string; bodyClassName?: string;
}) {
  return (
    <GlassCard className={`p-5 ${className}`}>
      <div className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full blur-3xl" style={{ background: ACCENTS[accent].glow, opacity: 0.16 }} aria-hidden="true" />
      {(title || action) ? (
        <div className="relative mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {title ? <h3 className="text-[0.95rem] font-bold tracking-tight text-white">{title}</h3> : null}
            {description ? <p className="mt-0.5 text-[0.74rem] leading-relaxed text-white/50">{description}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      <div className={`relative ${bodyClassName}`}>{children}</div>
    </GlassCard>
  );
}

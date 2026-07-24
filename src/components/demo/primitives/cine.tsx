"use client";

// /demo — Vocabulaire cinématographique partagé (refonte narration par chapitres).
//
// UNE idée / UNE preuve / UNE action par écran. Ces primitives donnent à chaque
// chapitre la même hiérarchie forte (eyebrow → titre XXL → preuve → détail court)
// et rangent tout le secondaire derrière une <Disclosure>. À composer À L'INTÉRIEUR
// d'une <PinnedScene> (voir pinned.tsx) : la scène fournit l'épinglage + les étapes,
// ces primitives fournissent la mise en page et la typographie.

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Conteneur d'une scène : centre le contenu, respiration verticale. */
export function CineScene({
  children,
  align = "center",
  wide = false,
  className,
}: {
  children: React.ReactNode;
  align?: "center" | "left";
  wide?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "cine-scene cine-breath",
        align === "left" && "cine-scene--left",
        wide && "cine-scene--wide",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Marqueur de chapitre : petit numéro + libellé. */
export function CineEyebrow({ n, children }: { n?: string; children: React.ReactNode }) {
  return (
    <p className="cine-eyebrow">
      {n ? <span className="cine-eyebrow__n">{n}</span> : null}
      {children}
    </p>
  );
}

/** NIVEAU 1 — la conclusion, toujours le plus grand. */
export function CineTitle({
  children,
  as: As = "h2",
  size = "lg",
  className,
}: {
  children: React.ReactNode;
  as?: "h1" | "h2" | "h3";
  size?: "lg" | "sm";
  className?: string;
}) {
  return (
    <As className={cn("cine-title", size === "sm" && "cine-title--sm", className)}>{children}</As>
  );
}

/** NIVEAU 3 — détail court (≤ 2 lignes). */
export function CineLede({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("cine-lede", className)}>{children}</p>;
}

/** NIVEAU 2 — la preuve chiffrée : le nombre domine l'écran. */
export function BigStat({
  value,
  unit,
  label,
  accent = false,
  className,
}: {
  value: React.ReactNode;
  unit?: string;
  label?: string;
  accent?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div className={cn("cine-num", accent && "cine-num--accent")}>
        <span className="tabular-nums">{value}</span>
        {unit ? <span className="cine-num__unit">{unit}</span> : null}
      </div>
      {label ? <div className="cine-num-label">{label}</div> : null}
    </div>
  );
}

/** Progressive disclosure — le secondaire, replié par défaut. */
export function Disclosure({
  summary,
  children,
  className,
  defaultOpen = false,
}: {
  summary: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  defaultOpen?: boolean;
}) {
  return (
    <details className={cn("cine-disclosure", className)} open={defaultOpen}>
      <summary>
        <ChevronDown className="cine-disclosure__chev h-4 w-4" aria-hidden="true" />
        {summary}
      </summary>
      <div className="cine-disclosure__body">{children}</div>
    </details>
  );
}

/** Une rangée de chaîne d'exécution — révélée « live » à l'étape courante. */
export function ChainRow({
  live = false,
  done = false,
  children,
}: {
  live?: boolean;
  done?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("cine-chain__row", live && "cine-chain__row--live")}>
      <span className="cine-chain__dot" aria-hidden="true" />
      <span className={cn(done && "line-through opacity-60")}>{children}</span>
    </div>
  );
}

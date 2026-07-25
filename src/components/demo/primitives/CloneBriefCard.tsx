"use client";

import * as React from "react";
import { CheckCircle2, Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import { liquidGlassClass } from "./LiquidGlassPanel";

/** Brief exécutif CloneBrief — restitution de l'essentiel + décision attendue. */
export function CloneBriefCard({
  title,
  lines,
  decisionTitle,
  decision,
  className,
}: {
  title: string;
  lines: readonly string[] | string[];
  decisionTitle?: string;
  decision?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        liquidGlassClass("panel", "strong", { refractive: true }),
        "overflow-hidden rounded-[1.5rem] p-5",
        className,
      )}
    >
      <p className="text-[0.66rem] font-bold uppercase tracking-[0.16em] text-[var(--cs-ink-4)]">
        CloneBrief
      </p>
      <p className="mt-1 text-[1rem] font-semibold text-[var(--cs-ink-1)]">{title}</p>

      <ul className="mt-4 space-y-2">
        {lines.map((line) => (
          <li key={line} className="flex items-start gap-2.5">
            <CheckCircle2
              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--demo-green)]"
              aria-hidden="true"
            />
            <span className="text-[0.84rem] text-[var(--cs-ink-2)]">{line}</span>
          </li>
        ))}
      </ul>

      {decision ? (
        <div className="mt-4 rounded-2xl border border-[rgba(156,102,26,0.22)] bg-[rgba(156,102,26,0.07)] p-4">
          <div className="flex items-center gap-2">
            <Flag className="h-3.5 w-3.5 text-[var(--demo-amber)]" aria-hidden="true" />
            <p className="text-[0.66rem] font-bold uppercase tracking-[0.16em] text-[var(--demo-amber)]">
              {decisionTitle ?? "Décision attendue"}
            </p>
          </div>
          <p className="mt-2 text-[0.86rem] font-medium text-[var(--cs-ink-1)]">{decision}</p>
        </div>
      ) : null}
    </div>
  );
}

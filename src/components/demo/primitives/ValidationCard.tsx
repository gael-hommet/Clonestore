"use client";

import * as React from "react";
import { ShieldAlert, Check, PencilLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { liquidGlassClass } from "./LiquidGlassPanel";

/**
 * Carte de validation (E2.7). Illustration : une action préparée attend une
 * décision humaine. Les "boutons" sont décoratifs (présentation, non cliquables).
 */
export function ValidationCard({
  action,
  fields,
  className,
}: {
  action: string;
  fields: readonly string[] | string[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        liquidGlassClass("default", "strong"),
        "rounded-[1.5rem] p-5",
        className,
      )}
    >
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[rgba(156,102,26,0.12)] text-[var(--demo-amber)]">
          <ShieldAlert className="h-4 w-4" aria-hidden="true" />
        </span>
        <p className="text-[0.7rem] font-bold uppercase tracking-[0.16em] text-[var(--demo-amber)]">
          Validation attendue
        </p>
      </div>

      <p className="mt-3 text-[0.95rem] font-semibold leading-snug text-[var(--cs-ink-1)]">
        {action}
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-4">
        {fields.map((f) => (
          <div key={f} className="min-w-0">
            <dt className="text-[0.62rem] font-bold uppercase tracking-[0.12em] text-[var(--cs-ink-4)]">
              {f}
            </dt>
            <dd className="mt-1 h-1.5 w-9 rounded-full bg-[var(--cs-line-strong)]" aria-hidden="true" />
          </div>
        ))}
      </dl>

      <div className="mt-5 flex flex-wrap gap-2" aria-hidden="true">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(21,130,96,0.25)] bg-[rgba(21,130,96,0.1)] px-3.5 py-1.5 text-[0.78rem] font-semibold text-[var(--demo-green)]">
          <Check className="h-3.5 w-3.5" />
          Faire valider
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/65 bg-white/55 px-3.5 py-1.5 text-[0.78rem] font-semibold text-[var(--cs-ink-2)]">
          <PencilLine className="h-3.5 w-3.5" />
          Corriger
        </span>
      </div>
    </div>
  );
}

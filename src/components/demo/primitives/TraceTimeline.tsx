"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Stagger, StaggerItem } from "./motion";
import { ToneDot } from "./status";
import type { DemoTraceEntry } from "@/lib/demo/presentation/fixtures";

const actorClass: Record<string, string> = {
  CloneGuard: "border-[rgba(156,102,26,0.22)] bg-[rgba(156,102,26,0.1)] text-[var(--demo-amber)]",
  CloneTrace: "border-[rgba(84,119,255,0.22)] bg-[rgba(84,119,255,0.1)] text-[#375bd8]",
  CloneOS: "border-[rgba(84,119,255,0.22)] bg-[rgba(84,119,255,0.1)] text-[#375bd8]",
  CloneADN: "border-[rgba(168,118,44,0.22)] bg-[rgba(168,118,44,0.1)] text-[#8a6530]",
  Pierre: "border-[rgba(107,99,232,0.22)] bg-[rgba(107,99,232,0.1)] text-[var(--demo-violet)]",
};

/** Timeline CloneTrace — se construit pendant l'exécution (cascade). */
export function TraceTimeline({
  entries,
  className,
  footnote,
}: {
  entries: DemoTraceEntry[];
  className?: string;
  footnote?: string;
}) {
  return (
    <Stagger className={cn("space-y-2", className)} step={0.07}>
      {entries.map((entry, i) => (
        <StaggerItem key={i}>
          <div className="flex items-start gap-3">
            <span className="mt-2">
              <ToneDot tone={entry.tone} />
            </span>
            <div className="flex-1 rounded-xl border border-white/65 bg-white/55 px-3.5 py-2.5 backdrop-blur-md">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[0.7rem] text-[var(--cs-ink-4)]">{entry.time}</span>
                <span className="text-[0.8rem] text-[var(--cs-ink-2)]">{entry.event}</span>
                <span
                  className={cn(
                    "ml-auto shrink-0 rounded-full border px-2 py-0.5 text-[0.66rem] font-semibold",
                    actorClass[entry.actor] ??
                      "border-[var(--cs-line)] bg-white/60 text-[var(--cs-ink-3)]",
                  )}
                >
                  {entry.actor}
                </span>
              </div>
            </div>
          </div>
        </StaggerItem>
      ))}
      {footnote ? (
        <p className="pl-6 pt-1 text-[0.7rem] text-[var(--cs-ink-4)]">{footnote}</p>
      ) : null}
    </Stagger>
  );
}

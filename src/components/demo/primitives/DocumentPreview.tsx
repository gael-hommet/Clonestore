"use client";

import * as React from "react";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { liquidGlassClass } from "./LiquidGlassPanel";

/**
 * Aperçu de document (liquid glass niveau 1 : presque opaque, parfaitement
 * lisible). Brouillon clairement signalé.
 */
export function DocumentPreview({
  title,
  meta,
  body,
  disclaimer,
  className,
}: {
  title: string;
  meta?: readonly string[] | string[];
  body: readonly string[] | string[];
  disclaimer?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        liquidGlassClass("default", "strong"),
        "overflow-hidden rounded-[1.5rem]",
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-[var(--cs-line-soft)] bg-white/45 px-5 py-3.5">
        <FileText className="h-4 w-4 text-[var(--demo-violet)]" aria-hidden="true" />
        <p className="text-[0.82rem] font-semibold text-[var(--cs-ink-1)]">{title}</p>
      </div>

      {meta && meta.length > 0 ? (
        <div className="flex flex-wrap gap-2 px-5 pt-4">
          {meta.map((m) => (
            <span
              key={m}
              className="rounded-full border border-white/65 bg-white/60 px-2.5 py-0.5 text-[0.68rem] font-semibold text-[var(--cs-ink-3)]"
            >
              {m}
            </span>
          ))}
        </div>
      ) : null}

      <div className="space-y-2 px-5 py-4">
        {body.map((line, i) =>
          line === "" ? (
            <div key={i} className="h-1.5" />
          ) : (
            <p key={i} className="text-[0.82rem] leading-relaxed text-[var(--cs-ink-2)]">
              {line}
            </p>
          ),
        )}
      </div>

      {disclaimer ? (
        <div className="border-t border-[var(--cs-line-soft)] bg-[rgba(156,102,26,0.06)] px-5 py-3">
          <p className="text-[0.72rem] font-medium text-[var(--demo-amber)]">{disclaimer}</p>
        </div>
      ) : null}
    </div>
  );
}

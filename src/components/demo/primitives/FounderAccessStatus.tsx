"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  getCommercialPhase,
  getFounderCommercialCopy,
  type FounderCommercialCopy,
} from "@/lib/demo/presentation/commercial-state";
import { DemoCTALink } from "./DemoCTA";

const RESERVATION_ROUTE = "/reserver/pierre";

/**
 * État commercial dynamique (avant / après le lancement officiel du 8 septembre 2026).
 * Variantes "compact" (hero E2.1) et "full" (clôture E2.10).
 * Le CTA secondaire reste visuellement inférieur.
 */
export function FounderAccessStatus({
  variant = "full",
  className,
  onReserve,
}: {
  variant?: "compact" | "full";
  className?: string;
  onReserve?: () => void;
}) {
  // Phase calculée au montage (évite tout écart d'hydratation au voisinage de la date).
  const [copy, setCopy] = React.useState<FounderCommercialCopy>(() =>
    getFounderCommercialCopy("before_launch"),
  );

  React.useEffect(() => {
    setCopy(getFounderCommercialCopy(getCommercialPhase()));
  }, []);

  if (variant === "compact") {
    return (
      <p className={cn("demo-note", className)} suppressHydrationWarning>
        {copy.accessNote[0]}
        {copy.accessNote[1] ? <> · {copy.accessNote[1]}</> : null}
      </p>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <p className="text-[0.95rem] font-semibold text-[var(--cs-ink-1)]" suppressHydrationWarning>
        {copy.availability}
      </p>

      <div className="rounded-2xl border border-white/60 bg-white/45 p-4 backdrop-blur-md">
        <div className="space-y-1" suppressHydrationWarning>
          {copy.accessNote.map((line) => (
            <p key={line} className="text-[0.82rem] text-[var(--cs-ink-2)]">
              {line}
            </p>
          ))}
        </div>
        <p className="mt-3 border-t border-[var(--cs-line-soft)] pt-3 text-[0.76rem] text-[var(--cs-ink-3)]">
          {copy.priceRule}
        </p>
      </div>

      <DemoCTALink
        href={RESERVATION_ROUTE}
        variant="secondary"
        onClick={onReserve}
        className="w-full sm:w-auto"
      >
        <span suppressHydrationWarning>{copy.secondaryCta}</span>
      </DemoCTALink>
    </div>
  );
}

"use client";

// PIERRE FINAL INTERACTIVE DEMO — discreet mid-demo CTA. Never auto-interrupts;
// dismissible instantly (the "Continuer" button just resumes the journey).

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { DEMO_CTA_DESTINATIONS } from "@/lib/pierre/demo";

export function ConversionMoment({ onContinue }: { onContinue: () => void }) {
  return (
    <aside className="pd-card pd-animate-fade" style={{ padding: 14, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }} data-testid="conversion-moment">
      <p style={{ margin: 0, fontWeight: 650, color: "var(--pd-ink-1)", flex: "1 1 220px" }}>
        Imaginez Pierre dans votre entreprise.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Link
          href={DEMO_CTA_DESTINATIONS.reserve}
          className="pd-btn pd-btn-primary"
          style={{ minHeight: 42 }}
          data-conversion-cta="purchase"
          data-cta-name="demo_mid_reserve"
        >
          Réserver Pierre <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
        <button type="button" className="pd-btn pd-btn-ghost" style={{ minHeight: 42 }} onClick={onContinue} data-step-id="mid-cta-continue">
          Continuer la démonstration
        </button>
      </div>
    </aside>
  );
}

"use client";

// PIERRE FINAL INTERACTIVE DEMO — final conversion screen.
// Real destinations only. Price truth comes from the conversion contract.

import Link from "next/link";
import { ArrowRight, Settings2, Lock, SlidersHorizontal, History } from "lucide-react";
import { DEMO_CTA_DESTINATIONS } from "@/lib/pierre/demo";

// Price truth = conversion contract PIERRE_PRICE_LABEL ("449 €/mois"). Kept as a
// literal here because the contract module imports node:crypto and must not be
// pulled into this client bundle.
const PRICE_LABEL = "449 € HT/mois";

const ASSURANCES = [
  { Icon: Settings2, label: "Configuration guidée" },
  { Icon: Lock, label: "Données privées" },
  { Icon: SlidersHorizontal, label: "Autonomie contrôlée" },
  { Icon: History, label: "Traçabilité complète" },
];

export function DemoFinalCTA() {
  return (
    <section className="pd-glass" style={{ padding: "clamp(16px,3vw,32px)", textAlign: "center" }} data-testid="demo-final-cta">
      <div style={{ maxWidth: 640, margin: "0 auto", display: "grid", gap: 11 }}>
        <p className="pd-eyebrow">Passer à Pierre</p>
        <h2 className="pd-display" style={{ fontSize: "clamp(1.55rem,3.4vw,2.6rem)" }}>
          Pierre ne vous aide pas à faire les RH.
          <br />
          <span className="pd-accent">Il prend en charge le travail.</span>
        </h2>
        <p className="pd-lede" style={{ marginInline: "auto" }}>
          Vous gardez les décisions. Pierre organise, produit, relance et trace le reste.
        </p>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", paddingTop: 4 }}>
          <Link
            href={DEMO_CTA_DESTINATIONS.reserve}
            className="pd-btn pd-btn-primary"
            data-conversion-cta="purchase"
            data-cta-name="demo_final_reserve"
          >
            Réserver Pierre <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link
            href={DEMO_CTA_DESTINATIONS.discover}
            className="pd-btn pd-btn-secondary"
            data-conversion-cta="assistance"
            data-cta-name="demo_final_discover"
          >
            Découvrir l&apos;offre Pierre
          </Link>
        </div>

        <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--pd-ink-4)" }}>
          {PRICE_LABEL} — accès complet à Pierre. Aucun paiement aujourd&apos;hui.
        </p>

        <div className="pd-grid-4" style={{ marginTop: 6 }}>
          {ASSURANCES.map(({ Icon, label }) => (
            <div key={label} className="pd-card" style={{ padding: "8px 7px", display: "flex", gap: 7, alignItems: "center", justifyContent: "center" }}>
              <Icon className="h-3.5 w-3.5" aria-hidden style={{ color: "var(--pd-cool)" }} />
              <span style={{ fontSize: "0.74rem", fontWeight: 600, color: "var(--pd-ink-2)" }}>{label}</span>
            </div>
          ))}
        </div>

        <p style={{ margin: "6px 0 0", fontSize: "0.74rem", color: "var(--pd-ink-4)" }}>
          Besoin d&apos;y voir clair d&apos;abord ?{" "}
          <Link href={DEMO_CTA_DESTINATIONS.diagnostic} className="pd-link" data-conversion-cta="assistance" data-cta-name="demo_final_diagnostic" style={{ textDecoration: "underline" }}>
            Obtenir mon diagnostic RH
          </Link>
        </p>
      </div>
    </section>
  );
}

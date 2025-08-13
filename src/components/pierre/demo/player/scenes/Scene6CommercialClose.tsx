"use client";

// SCENE 6 · COMMERCIAL CLOSE — the reservation moment (never a checkout).
// Price + launch come from the canonical commercial-state (never hardcoded). The
// dominant CTA is "Réserver Pierre" → /reserver/pierre (the only commercial
// destination, P10 untouched). A discreet secondary opens the level-2 Explorer, and
// legal/safety live one tap away in the Infos & sécurité sheet — never inline.

import Link from "next/link";
import { ArrowRight, ArrowLeft, Compass, ShieldCheck } from "lucide-react";
import { trackDemoEvent, DEMO_CTA_DESTINATIONS } from "@/lib/pierre/demo";
import {
  FOUNDER_PRICE_MONTHLY,
  DEMO_LAUNCH_LABEL,
  FOUNDER_CLOSE_LABEL,
} from "@/lib/demo/presentation/commercial-state";

export function Scene6CommercialClose({
  onPrev,
  onExplore,
  onInfo,
}: {
  onPrev: () => void;
  onExplore: () => void;
  onInfo: () => void;
}) {
  return (
    <div className="pdp-scene__inner">
      <div className="pdp-close">
        <h2 className="pd-display pdp-close__title">C&apos;est ça, Pierre.</h2>
        <p className="pd-lede pdp-close__line">
          Pas un chatbot auquel vous posez des questions. Un employé IA auquel vous confiez du travail.
        </p>

        <div className="pdp-close__price">
          <span className="pdp-close__pv">{FOUNDER_PRICE_MONTHLY}</span>
          <span className="pdp-close__pl">Accès fondateur — aucun paiement aujourd&apos;hui.</span>
        </div>

        <div className="pdp-close__meta">
          <span className="pd-chip pd-chip--cool">Réservations ouvertes</span>
          <span className="pd-chip">Ouverture des activations le {DEMO_LAUNCH_LABEL}</span>
          <span className="pd-chip pd-chip--warn">Tarif fondateur jusqu&apos;au {FOUNDER_CLOSE_LABEL}</span>
        </div>

        <div className="pdp-close__cta">
          <Link
            href={DEMO_CTA_DESTINATIONS.reserve}
            className="pd-btn pd-btn-primary"
            data-conversion-cta="purchase"
            data-cta-name="demo_close_reserve"
            onClick={() => trackDemoEvent("pierre_demo_cta_clicked", { cta_position: "scene_close", cta_kind: "purchase" })}
          >
            Réserver Pierre <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <button type="button" className="pd-btn pd-btn-secondary" onClick={onExplore}>
            <Compass className="h-4 w-4" aria-hidden /> Explorer Pierre en détail
          </button>
        </div>

        <div className="pdp-close__legal">
          <Link
            href={DEMO_CTA_DESTINATIONS.discover}
            className="pdp-linkbtn"
            data-conversion-cta="assistance"
            data-cta-name="demo_close_discover"
          >
            Découvrir l&apos;offre Pierre
          </Link>
          <button type="button" className="pdp-linkbtn" onClick={onInfo}>
            <ShieldCheck className="h-3 w-3" aria-hidden style={{ display: "inline", verticalAlign: "-1px", marginRight: 4 }} />
            Infos &amp; sécurité · mentions légales
          </button>
        </div>

        <div className="pdp-nav" style={{ justifyContent: "center", marginTop: 2 }}>
          <button type="button" className="pd-btn pd-btn-ghost" onClick={onPrev}>
            <ArrowLeft className="h-4 w-4" aria-hidden /> Revoir le résultat
          </button>
        </div>
      </div>
    </div>
  );
}

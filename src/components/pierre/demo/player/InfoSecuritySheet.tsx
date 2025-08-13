"use client";

// PIERRE ZERO-SCROLL DEMO PLAYER — "Infos & sécurité" sheet (level-2).
// Holds everything that must stay ACCESSIBLE but must not sit inline in the main flow:
// the safety notices (démonstration sécurisée / données fictives / aucune action réelle /
// validation humaine) and EVERY legal link that used to live in the page footer — plus
// the honest product disclosure. Nothing legal is deleted; it simply moves one tap away.

import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { DEMO_CTA_DESTINATIONS } from "@/lib/pierre/demo";
import { PlayerOverlay } from "./PlayerOverlay";

const SAFETY = [
  "Démonstration sécurisée — aucune action réelle n'est envoyée.",
  "Données fictives — aucun email, aucun appel IA, aucune donnée modifiée.",
  "Aucune action réelle : ni envoi, ni signature, ni paiement.",
  "Validation humaine obligatoire pour toute action sensible.",
];

const LEGAL: { href: string; label: string }[] = [
  { href: DEMO_CTA_DESTINATIONS.legal_mentions, label: "Mentions légales" },
  { href: DEMO_CTA_DESTINATIONS.legal_cgv, label: "CGV" },
  { href: DEMO_CTA_DESTINATIONS.legal_cgu, label: "CGU" },
  { href: DEMO_CTA_DESTINATIONS.legal_privacy, label: "Confidentialité" },
  { href: DEMO_CTA_DESTINATIONS.legal_dpa, label: "DPA" },
];

export function InfoSecuritySheet({ onClose }: { onClose: () => void }) {
  return (
    <PlayerOverlay title="Infos & sécurité" tag="Démonstration illustrative — données fictives" onClose={onClose} narrow>
      <section aria-label="Sécurité de la démonstration">
        <p className="pd-eyebrow" style={{ marginBottom: 10 }}>Sécurité</p>
        <div className="pdp-safety">
          {SAFETY.map((s) => (
            <p key={s} className="pdp-safety__row">
              <ShieldCheck className="h-4 w-4" aria-hidden style={{ color: "var(--pd-ok)", flex: "none", marginTop: 1 }} />
              <span>{s}</span>
            </p>
          ))}
        </div>
      </section>

      <section aria-label="Documents légaux">
        <p className="pd-eyebrow" style={{ marginBottom: 10 }}>Documents légaux</p>
        <div className="pdp-legal-links">
          {LEGAL.map((l) => (
            <Link key={l.href} href={l.href}>{l.label}</Link>
          ))}
          <a href="mailto:support@clonestore.pro">Support</a>
        </div>
      </section>

      <p style={{ margin: 0, fontSize: "0.76rem", color: "var(--pd-ink-4)", lineHeight: 1.55 }}>
        Démonstration illustrative. Pierre est un poste RH opérationnel : il prépare missions, tâches,
        documents, messages et relances, garde chaque action tracée par CloneTrace et gouvernée par
        CloneGuard. Il n&apos;est pas avocat, n&apos;est pas un logiciel de paie certifié, ne prend
        aucune décision disciplinaire autonome et ne garantit pas la conformité juridique. Toute action
        sensible exige une validation humaine.
      </p>
    </PlayerOverlay>
  );
}

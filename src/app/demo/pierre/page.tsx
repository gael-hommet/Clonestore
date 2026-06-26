"use client";

// PIERRE FINAL INTERACTIVE DEMO — /demo/pierre
//
// Immersive, controlled conversion experience. SAFE: no AI call, no Supabase
// write, no Stripe, no email, no signature provider, no secret. 100% fictional
// demonstration data; analytics flow through the existing first-party tracker
// (see ./layout.tsx + DemoEventTracker). The interactive journey lives in
// <PierreDemoExperience/>; this page also carries the SEO / legal / price frame.

import Link from "next/link";
import { ShieldCheck, FileText, Clock, Activity, ArrowRight } from "lucide-react";
import { PierreDemoExperience } from "@/components/pierre/demo/PierreDemoExperience";
import "./pierre-demo.css";

const SAFETY = [
  "Démonstration sécurisée — aucune action réelle envoyée",
  "Données fictives — aucune personne ni entreprise réelle",
  "Aucun appel IA réel, aucun email envoyé, aucune donnée modifiée",
  "Validation humaine obligatoire pour toute action sensible",
];

const CAPABILITY_FRAME = [
  { Icon: Activity, label: "Comprendre la mission", text: "Une demande libre devient un plan : objectifs, tâches, échéances." },
  { Icon: FileText, label: "Produire les livrables", text: "Documents, messages et avenants préparés — jamais envoyés seuls." },
  { Icon: ShieldCheck, label: "Sécuriser — CloneGuard", text: "Garde-fous, validations humaines, refus hors rôle." },
  { Icon: Clock, label: "Suivre et tracer — CloneTrace", text: "Relances planifiées et historique de chaque action." },
];

export default function PierreDemoPage() {
  return (
    <div className="pd-root">
      <main id="demo-pierre-cockpit" className="pd-shell">
        <PierreDemoExperience />

        {/* ── Capability frame (SEO + context, responsive) ────────────────── */}
        <section className="mt-10" aria-label="Ce que Pierre fait vraiment">
          <h2 className="pd-h2" style={{ marginBottom: 14 }}>Ce que Pierre fait vraiment</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
            {CAPABILITY_FRAME.map(({ Icon, label, text }) => (
              <div key={label} className="pd-card" style={{ padding: 14, display: "grid", gap: 8 }}>
                <span className="pd-tech__badge" aria-hidden><Icon className="h-4 w-4" aria-hidden /></span>
                <span style={{ fontWeight: 700, color: "var(--pd-ink-1)", fontSize: "0.9rem" }}>{label}</span>
                <span style={{ fontSize: "0.78rem", color: "var(--pd-ink-3)", lineHeight: 1.5 }}>{text}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Footer: safety, price, legal ────────────────────────────────── */}
        <footer className="mt-10 pd-card" style={{ padding: 18 }}>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-4">
            {SAFETY.map((s) => (
              <div key={s} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden style={{ color: "var(--pd-ok)", marginTop: 2, flex: "none" }} />
                <span style={{ fontSize: "0.74rem", color: "var(--pd-ink-3)" }}>{s}</span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 14, borderTop: "1px solid var(--pd-line)", paddingTop: 14, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <Link href="/reserver/pierre" className="pd-btn pd-btn-primary" style={{ minHeight: 42 }} data-conversion-cta="purchase" data-cta-name="demo_footer_reserve">
              Réserver Pierre <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <span style={{ fontSize: "0.78rem", color: "var(--pd-ink-3)" }}>
              449&nbsp;€ HT/mois — accès complet à Pierre. Aucun paiement aujourd&apos;hui.
            </span>
            <Link href="/agents/pierre" className="pd-link" style={{ marginLeft: "auto", fontSize: "0.8rem", textDecoration: "underline", color: "var(--pd-ink-2)" }}>
              Découvrir l&apos;offre Pierre
            </Link>
          </div>

          <p style={{ marginTop: 12, fontSize: "0.72rem", color: "var(--pd-ink-4)", lineHeight: 1.6 }}>
            Démonstration illustrative. Pierre est un poste RH opérationnel : il prépare missions, documents, messages,
            relances et trace chaque action. Il n&apos;est pas avocat, n&apos;est pas un logiciel de paie certifié, ne
            prend aucune décision disciplinaire autonome et ne garantit pas la conformité juridique. Toute action sensible
            exige une validation humaine. Voir les{" "}
            <Link href="/legal/cgu" className="pd-link" style={{ textDecoration: "underline" }}>CGU</Link>,{" "}
            <Link href="/legal/cgv" className="pd-link" style={{ textDecoration: "underline" }}>CGV</Link>{" et la "}
            <Link href="/legal/confidentialite" className="pd-link" style={{ textDecoration: "underline" }}>politique de confidentialité</Link>.
          </p>
        </footer>
      </main>
    </div>
  );
}

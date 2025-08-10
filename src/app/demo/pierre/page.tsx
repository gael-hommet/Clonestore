"use client";

// PIERRE FINAL INTERACTIVE DEMO — /demo/pierre
//
// Immersive, controlled conversion experience. SAFE: no AI call, no Supabase
// write, no Stripe, no email, no signature provider, no secret. 100% fictional
// demonstration data; analytics flow through the existing first-party tracker
// (see ./layout.tsx + DemoEventTracker). The interactive journey lives in
// <PierreDemoExperience/>; this page also carries the SEO / legal / price frame.

import Link from "next/link";
import { ShieldCheck, ArrowRight, ArrowLeft } from "lucide-react";
import { PierreDemoExperience } from "@/components/pierre/demo/PierreDemoExperience";
import { PierreModes } from "@/components/pierre/PierreModes";
import { Disclosure } from "@/components/pierre/demo/parts";
import "./pierre-demo.css";

const SAFETY = [
  "Démonstration sécurisée — aucune action réelle envoyée",
  "Données fictives — aucun email, aucun appel IA, aucune donnée modifiée",
  "Validation humaine obligatoire pour toute action sensible",
];

export default function PierreDemoPage() {
  return (
    <div className="pd-root">
      <main id="demo-pierre-cockpit" data-tour-id="demo-entry" className="pd-shell">
        {/* DEMO AND MOBILE CONVERSION CLOSURE (2026-07-24) — Phase 10 explicitly requires
            a way back to the general demo; none existed (cartography confirmed zero link
            from /demo/pierre back to /demo). Placed above the experience, not inside it,
            so it never competes with the in-cockpit controls. */}
        <Link href="/demo" className="pd-link mb-3 inline-flex items-center gap-1.5 text-[0.82rem]" style={{ color: "var(--pd-ink-3)" }}>
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Retour à la démo générale
        </Link>

        <PierreDemoExperience />

        {/* ── Modes d'autonomie — progressive disclosure: one tap, never removed ── */}
        <section className="mt-6" aria-label="Modes d'autonomie de Pierre">
          <Disclosure
            label="Voir les niveaux d'autonomie — vous choisissez ce que Pierre fait seul"
            labelOpen="Masquer les niveaux d'autonomie"
            hint="4 modes"
          >
            <div style={{ marginTop: 12 }}>
              <PierreModes headingLevel="h2" />
            </div>
          </Disclosure>
        </section>

        {/* ── Footer: safety, price, legal ────────────────────────────────── */}
        <footer className="mt-6 pd-card" style={{ padding: 13 }}>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
            {SAFETY.map((s) => (
              <div key={s} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden style={{ color: "var(--pd-ok)", flex: "none" }} />
                <span style={{ fontSize: "0.72rem", color: "var(--pd-ink-3)" }}>{s}</span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 10, borderTop: "1px solid var(--pd-line)", paddingTop: 10, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
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

          <p style={{ marginTop: 9, fontSize: "0.72rem", color: "var(--pd-ink-4)", lineHeight: 1.5 }}>
            Démonstration illustrative. Pierre est un poste RH opérationnel : il prépare missions, tâches, documents,
            messages et relances, garde chaque action tracée par CloneTrace et gouvernée par CloneGuard. Il n&apos;est pas
            avocat, n&apos;est pas un logiciel de paie certifié, ne
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

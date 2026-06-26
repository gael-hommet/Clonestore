// BLOC 3 — Diagnostic RH public progressif.
//
// Pas de compte requis, pas d'email requis pour voir le résultat. Données
// jamais sensibles (validation côté serveur). Reprise après refresh via
// sessionStorage (clé liée à la conversion session si présente).

import type { Metadata } from "next";
import { DiagnosticForm } from "./_components/DiagnosticForm";

export const metadata: Metadata = {
  title: "Diagnostic RH — CloneStore",
  description:
    "Diagnostic RH gratuit : volume opérationnel, compatibilité avec Pierre, missions prioritaires. Aucune donnée sensible demandée.",
  robots: { index: true, follow: true },
};

export default function DiagnosticRhPage() {
  return (
    <div className="cs-page">
      <div className="cs-page-shell">
        <div className="space-y-6 sm:space-y-8 max-w-2xl mx-auto">
          <header className="space-y-3">
            <p className="cs-eyebrow">Diagnostic RH</p>
            <h1 className="cs-display text-[clamp(1.6rem,3.4vw,3rem)] leading-[1]">
              En quelques questions, voyez si Pierre s&apos;adapte à votre RH.
            </h1>
            <p className="text-sm leading-7 text-[var(--cs-ink-3)]">
              Aucune donnée sensible n&apos;est demandée. Aucune adresse email pour voir le résultat.
              Les estimations sont des fourchettes, pas des garanties — toutes leurs hypothèses sont affichées.
            </p>
          </header>
          <DiagnosticForm />
        </div>
      </div>
    </div>
  );
}

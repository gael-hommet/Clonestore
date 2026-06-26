// BLOC 3 — Hero variantal serveur. Composant SERVEUR (pas de "use client"),
// rendu uniquement quand la conversion session correspond à une variante connue.
//
// Le hero variantal n'invente AUCUNE information sur l'entreprise du prospect.
// Il propose seulement deux angles narratifs distincts validés par le claims
// registry (toutes les claims utilisées ici sont VERIFIED_PRODUCT_FACT).

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { VariantId } from "@/lib/clonestore/conversion/contract";

interface HeroCopy {
  eyebrow: string;
  title_top: string;
  title_bottom: string;
  subtitle: string;
  primary_cta: { href: string; label: string };
  secondary_cta: { href: string; label: string };
}

const COPY: Record<VariantId, HeroCopy> = {
  VARIANT_DEPARTMENT_OUTCOME: {
    eyebrow: "Poste RH opérationnel automatisé",
    title_top: "Votre travail RH opérationnel avance,",
    title_bottom: "même quand votre équipe manque de temps.",
    subtitle:
      "Pierre transforme les demandes RH récurrentes en missions, tâches, documents, validations et suivi traçable. Les décisions sensibles restent humaines.",
    primary_cta: { href: "#demo-pierre-cockpit", label: "Voir Pierre gérer une journée RH" },
    secondary_cta: { href: "/diagnostic-rh", label: "Obtenir mon diagnostic RH" },
  },
  VARIANT_PROOF_FIRST: {
    eyebrow: "Démonstration guidée",
    title_top: "Donnez un brief à Pierre.",
    title_bottom: "Regardez une journée RH se structurer sous vos yeux.",
    subtitle:
      "Missions, tâches, documents, emails, validations et historique : démonstration sur des données entièrement fictives. Aucun appel IA réel, aucun email envoyé.",
    primary_cta: { href: "#demo-pierre-cockpit", label: "Lancer la démonstration" },
    secondary_cta: { href: "/diagnostic-rh", label: "Obtenir mon diagnostic RH" },
  },
};

export function VariantHero({ variant }: { variant: VariantId | "VARIANT_ORGANIC" }) {
  if (variant === "VARIANT_ORGANIC") return null;
  const copy = COPY[variant];
  return (
    <section
      data-conversion-variant={variant}
      data-testid="conversion-variant-hero"
      className="cs-page-shell"
      style={{ paddingTop: "2rem", paddingBottom: "0" }}
    >
      <div className="cs-command-surface overflow-hidden">
        <div className="cs-system-halo" aria-hidden="true" />
        <div className="relative space-y-4">
          <p className="cs-eyebrow">{copy.eyebrow}</p>
          <h2 className="cs-display text-[clamp(1.6rem,3.4vw,3.2rem)] leading-[1]">
            {copy.title_top}
            <br />
            <span className="cs-gradient-text">{copy.title_bottom}</span>
          </h2>
          <p className="max-w-2xl text-sm leading-7 text-[var(--cs-ink-3)] sm:text-base">{copy.subtitle}</p>
          <p className="text-xs text-[var(--cs-ink-4)]">
            449&nbsp;€ HT / mois — accès complet à Pierre. Démo sécurisée — aucune action réelle envoyée.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Link
              href={copy.primary_cta.href}
              data-conversion-cta="purchase"
              data-cta-name={`variant_hero_primary_${variant}`}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-[var(--cs-violet)] px-6 text-sm font-semibold text-white shadow-lg transition-all hover:-translate-y-0.5"
            >
              <span>{copy.primary_cta.label}</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href={copy.secondary_cta.href}
              data-conversion-cta="assistance"
              data-cta-name={`variant_hero_secondary_${variant}`}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-[rgba(255,255,255,0.72)] bg-[linear-gradient(180deg,rgba(255,255,255,0.78)_0%,rgba(255,255,255,0.56)_100%)] px-5 text-sm font-semibold text-[var(--cs-ink-2)] shadow-[0_10px_30px_rgba(31,41,55,0.06),inset_0_1px_0_rgba(255,255,255,0.82)] transition-all hover:-translate-y-0.5"
            >
              {copy.secondary_cta.label}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

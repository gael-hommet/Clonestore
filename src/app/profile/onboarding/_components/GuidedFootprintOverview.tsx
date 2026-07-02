"use client";

// Empreinte guidée — aperçu par sections (P9.2, Étape 2).
//
// Vue de haut niveau des sections RÉELLES de l'empreinte (dérivées du même
// GlobalOnboardingDraft via le cœur pur guided-footprint). Chaque carte affiche
// titre, utilité, progression, statut, dernière sauvegarde et un CTA qui mène à
// la VRAIE section du wizard existant (aucune duplication d'édition).

import { Fingerprint } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  FOOTPRINT_SECTIONS,
  buildFootprintSections,
  footprintOverall,
  type SectionCompletionMap,
} from "@/lib/client-onboarding";

const STATUS_LABEL = { complete: "Complet", in_progress: "En cours", empty: "À renseigner", skipped: "Ignoré" } as const;

export function GuidedFootprintOverview({
  completions,
  onGoToSection,
}: {
  completions: SectionCompletionMap;
  /** Navigue vers la vraie section du wizard existant. */
  onGoToSection: (sectionId: string) => void;
}) {
  const sections = buildFootprintSections(completions);
  const overall = Math.round(footprintOverall(sections) * 100);
  const help = new Map(FOOTPRINT_SECTIONS.map((s) => [s.id, s.helpText]));

  return (
    <section data-tour-id="mycs-footprint" className="cs-panel p-5">
      <div className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-3">
          <div className="space-y-1">
            <p className="cs-eyebrow">Empreinte guidée</p>
            <p className="text-[0.86rem] leading-6 text-[var(--cs-ink-3)]">
              Enrichissez le contexte, section par section. Chaque carte mène à sa section détaillée.
            </p>
          </div>
          <span className="cs-status cs-status--info">{overall}%</span>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {sections.map((section) => {
            const cta =
              section.status === "empty" ? "Commencer" : section.status === "complete" ? "Modifier" : "Continuer";
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => onGoToSection(section.id)}
                className="cs-card cs-card-tight cs-hover-lift block w-full text-left"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[0.9rem] font-semibold text-[var(--cs-ink-1)]">{section.label}</p>
                      <span
                        className={cn(
                          "cs-status",
                          section.status === "complete" && "cs-status--success",
                          section.status === "in_progress" && "cs-status--info",
                        )}
                      >
                        {STATUS_LABEL[section.status]}
                      </span>
                    </div>
                    <p className="text-[0.8rem] leading-5 text-[var(--cs-ink-4)]">{help.get(section.id)}</p>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[rgba(24,29,39,0.08)]">
                      <div className="h-full rounded-full bg-[var(--cs-violet)]" style={{ width: `${Math.round(section.completion * 100)}%` }} />
                    </div>
                    <p className="text-[0.78rem] font-medium text-[var(--cs-violet)]">{cta}</p>
                  </div>
                  <Fingerprint className="mt-0.5 h-4 w-4 shrink-0 text-[var(--cs-ink-4)]" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

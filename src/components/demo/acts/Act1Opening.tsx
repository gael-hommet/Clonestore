"use client";

// /demo — ACTE 1 : comprendre CloneStore en moins de cinq secondes.
// Une idée principale, une phrase de clarification, une action évidente.
// La même demande (Clara) qui servira de fil conducteur est introduite ici.

import * as React from "react";
import { CheckCircle2, Bot, ListChecks, ShieldCheck, ArrowRight, Sparkles } from "lucide-react";
import { Reveal } from "../primitives/motion";
import { GlassSurface } from "../primitives/GlassSurface";
import { DemoCTAButton, DemoCTALink } from "../primitives/DemoCTA";
import { FounderAccessStatus } from "../primitives/FounderAccessStatus";
import { useDemoReducedMotion } from "../primitives/motion";
import { SCENE_OPENING, PIERRE_DEMO_ROUTE } from "@/lib/demo/presentation/content";

const COMPREHENSION = [
  { Icon: CheckCircle2, label: SCENE_OPENING.comprehension.understood },
  { Icon: Bot, label: SCENE_OPENING.comprehension.mobilized },
  { Icon: ListChecks, label: SCENE_OPENING.comprehension.organized },
  { Icon: ShieldCheck, label: SCENE_OPENING.comprehension.validation },
];

export function Act1Opening({ onDirectPierre }: { onDirectPierre: () => void }) {
  const reduce = useDemoReducedMotion();
  const goNext = () =>
    document.getElementById("demo-act-difference")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });

  return (
    <section id="demo-act-open" className="demo-section demo-section--hero demo-cv" aria-label="Ouverture — CloneStore">
      <div className="demo-shell grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <Reveal>
          <p className="demo-kicker">{SCENE_OPENING.brandLine}</p>
          <h1 className="demo-title demo-title--hero mt-4">
            N&apos;ajoutez pas simplement un logiciel.
            <br />
            <span className="demo-accent">Ouvrez un poste.</span>
          </h1>
          <p className="demo-lede mt-5 max-w-xl">
            CloneStore fournit à votre entreprise des employés IA spécialisés qui comprennent votre organisation,
            prennent en charge des missions et travaillent sous votre contrôle.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <DemoCTAButton onClick={goNext} variant="primary" withArrow>
              Voir un employé IA travailler
            </DemoCTAButton>
            <DemoCTALink href={PIERRE_DEMO_ROUTE} variant="ghost" onClick={onDirectPierre}>
              {SCENE_OPENING.secondaryCta}
            </DemoCTALink>
          </div>
          <div className="mt-6">
            <FounderAccessStatus variant="compact" />
          </div>
        </Reveal>

        <Reveal delay={0.12}>
          <GlassSurface kind="material" weight="structure" sheen className="overflow-hidden rounded-[1.7rem]">
            <div className="flex items-center gap-2 border-b border-[var(--cs-line-soft)] bg-white/45 px-5 py-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[rgba(107,99,232,0.12)] text-[var(--demo-violet)]">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[var(--cs-ink-4)]">
                Vous confiez un objectif
              </p>
            </div>
            <div className="px-5 py-5">
              <p className="text-[0.98rem] font-medium leading-relaxed text-[var(--cs-ink-1)]">
                « {SCENE_OPENING.initialMission} »
              </p>
              <div className="mt-3 flex items-center gap-2 text-[0.74rem] font-semibold text-[var(--demo-violet)]">
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /> CloneStore en fait une mission menée jusqu&apos;au résultat
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {COMPREHENSION.map(({ Icon, label }) => (
                  <div
                    key={label}
                    className="flex items-center gap-2 rounded-xl border border-white/65 bg-white/55 px-3 py-2"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-[var(--demo-green)]" aria-hidden="true" />
                    <span className="text-[0.78rem] font-medium text-[var(--cs-ink-2)]">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </GlassSurface>
        </Reveal>
      </div>
    </section>
  );
}

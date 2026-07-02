"use client";

// /demo — ACTE 6 : passer à Pierre.
// Synthèse très simple, puis une transition désirable vers la preuve interactive.

import * as React from "react";
import { ArrowRight, Plus, Network } from "lucide-react";
import { Reveal } from "../primitives/motion";
import { MissionCard } from "../primitives/MissionCard";
import { DemoCTALink } from "../primitives/DemoCTA";
import { FounderAccessStatus } from "../primitives/FounderAccessStatus";
import { useSceneView } from "../primitives/useSceneView";
import { DEMO_EVENTS } from "@/lib/demo/presentation/analytics";
import { SCENE_COMPLETION, PIERRE_DEMO_ROUTE } from "@/lib/demo/presentation/content";
import { SHARED_MISSION_LAYOUT_ID } from "../shared";
import type { DeepDiveTopic } from "../shared";

const SYNTHESIS = [
  "Une demande devient une mission.",
  "La mission utilise les règles de votre entreprise.",
  "Pierre accomplit le travail RH opérationnel.",
  "Les décisions sensibles restent humaines.",
  "Tout reste suivi et vérifiable.",
];

export function Act6Pierre({
  onTransition,
  onDirectReservation,
  onDeepDive,
}: {
  onTransition: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  onDirectReservation: () => void;
  onDeepDive: (t: DeepDiveTopic) => void;
}) {
  const ref = useSceneView<HTMLElement>(DEMO_EVENTS.completionViewed);
  return (
    <section ref={ref} id="demo-act-pierre" className="demo-section demo-cv" aria-label="Passer à Pierre">
      <div className="demo-shell grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <Reveal>
          <p className="demo-kicker">Vous avez compris CloneStore</p>
          <h2 className="demo-title demo-title--section mt-3">
            Regardez maintenant Pierre prendre en charge
            <br />
            <span className="demo-accent">une véritable semaine RH.</span>
          </h2>

          <ul className="mt-6 space-y-2">
            {SYNTHESIS.map((line) => (
              <li key={line} className="flex items-start gap-2.5 text-[0.9rem] text-[var(--cs-ink-2)]">
                <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-[var(--demo-violet)]" aria-hidden="true" />
                {line}
              </li>
            ))}
          </ul>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <DemoCTALink href={PIERRE_DEMO_ROUTE} variant="primary" hero withArrow onClick={onTransition}>
              Voir Pierre travailler
            </DemoCTALink>
            <span className="text-[0.8rem] text-[var(--cs-ink-4)]">{SCENE_COMPLETION.primaryCtaSubtext}</span>
          </div>

          <button
            type="button"
            onClick={() => onDeepDive("organization")}
            className="demo-btn demo-btn-ghost mt-5"
            style={{ minHeight: 34, fontSize: "0.78rem", padding: "0 12px" }}
          >
            <Network className="h-3.5 w-3.5" aria-hidden="true" /> Pierre est le premier employé IA de CloneStore
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </Reveal>

        <Reveal delay={0.1} className="space-y-5">
          <MissionCard
            layoutId={SHARED_MISSION_LAYOUT_ID}
            showTasks
            taskCount={4}
            compact
            title={SCENE_COMPLETION.recapCard}
            footnote={false}
          />
          <FounderAccessStatus variant="full" onReserve={onDirectReservation} />
        </Reveal>
      </div>
    </section>
  );
}

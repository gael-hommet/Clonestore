"use client";

// /demo — ACTE 1 / CH.1 : le hero. Une idée, une phrase, une action évidente.
// La valeur (CH.2, ValueChapter) suit immédiatement — le visiteur comprend d'abord
// ce qu'il gagne, puis comment CloneStore le produit. Le contrat de lecture reste
// en disclosure (aucun mur de texte). La scène « travail dispersé » vit désormais
// dans Act2Difference (ordre : hero → valeur → problème → différence).

import * as React from "react";
import { ArrowRight } from "lucide-react";
import { Reveal, useDemoReducedMotion } from "../primitives/motion";
import { DemoCTAButton, DemoCTALink } from "../primitives/DemoCTA";
import { FounderAccessStatus } from "../primitives/FounderAccessStatus";
import { CineScene, CineEyebrow, CineTitle, CineLede, Disclosure } from "../primitives/cine";
import { SCENE_OPENING, SCENE_CONTRACT, PIERRE_DEMO_ROUTE } from "@/lib/demo/presentation/content";

export function Act1Opening({ onDirectPierre, onAdvance }: { onDirectPierre: () => void; onAdvance?: () => void }) {
  const reduce = useDemoReducedMotion();
  const goNext = () =>
    onAdvance
      ? onAdvance()
      : document.getElementById("demo-act-value")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });

  return (
    <section id="demo-act-open" className="demo-section demo-scene-flow" aria-label="Ouverture — CloneStore">
      <Reveal className="w-full">
        <CineScene className="cine-breath-none">
          <CineEyebrow n="02">{SCENE_OPENING.brandLine}</CineEyebrow>
          <CineTitle as="h1" className="mt-1">
            N&apos;achetez plus seulement des logiciels.
            <br />
            <span className="cine-accent">Ouvrez des postes d&apos;employés IA.</span>
          </CineTitle>
          <CineLede>
            Vous confiez un objectif. CloneStore organise la mission, mobilise l&apos;employé compétent et suit chaque
            action jusqu&apos;au résultat — selon vos règles.
          </CineLede>

          <div className="mt-2 flex flex-col items-center gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
            <DemoCTAButton onClick={goNext} variant="primary" hero withArrow>
              Voir un employé IA travailler
            </DemoCTAButton>
            <DemoCTALink href={PIERRE_DEMO_ROUTE} variant="ghost" onClick={onDirectPierre}>
              {SCENE_OPENING.secondaryCta}
            </DemoCTALink>
          </div>

          {/* Le contrat de lecture en disclosure — plus de mur de texte.
              (classe demo-contract conservée : le contrat reste rendu.) */}
          <Disclosure summary="Comment juger cette démonstration" className="mt-3">
            <div className="demo-contract" style={{ textAlign: "left" }}>
              <p className="text-[0.95rem] leading-relaxed text-[var(--cs-ink-2)]">{SCENE_CONTRACT.line2}</p>
              <ul className="demo-contract__judge mt-3 grid list-none gap-2 p-0 sm:grid-cols-2">
                {SCENE_CONTRACT.judge.map((item) => (
                  <li key={item} className="flex items-center gap-2 rounded-lg border border-[var(--cs-line)] bg-white/50 px-3 py-2 text-[0.86rem] text-[var(--cs-ink-2)]">
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[var(--demo-violet)]" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-4">
                <FounderAccessStatus variant="compact" />
              </div>
            </div>
          </Disclosure>
        </CineScene>
      </Reveal>
    </section>
  );
}

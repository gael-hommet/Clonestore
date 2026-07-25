"use client";

// /demo — CH.1 (NOUVEAU PREMIER ÉCRAN) : LE CHOC DE VALEUR.
//
// Le visiteur voit IMMÉDIATEMENT la puissance : une mission complète qui mobilise
// une équipe pendant des heures ne demande que quelques minutes d'attention
// humaine — et à l'échelle d'un groupe, la capacité libérée se compte en millions.
// Maximum visible : une phrase choc, une comparaison temporelle, une projection
// annuelle, une phrase de charge absorbée, un CTA. Rien d'autre (règle densité).
//
// TOUT est dérivé (value-model) : la mission choc = étapes déclarées de
// « arrival-full » (11 h 35 manuel → 12 min d'attention humaine) ; la projection
// = computeCapacity sur le profil groupe multi-sites (hypothèses affichées plus
// bas, modifiables). Jamais une garantie — estimation, ordre de grandeur.

import * as React from "react";
import { ArrowDown, ArrowRight } from "lucide-react";
import { Reveal } from "../primitives/motion";
import { useDemoReducedMotion } from "../primitives/motion";
import { CineEyebrow } from "../primitives/cine";
import {
  missionShock,
  annualValue,
  formatMillions,
  formatHours,
  VALUE_WORDING,
} from "@/lib/demo/presentation/value-model";

export function ValueShock() {
  const reduce = useDemoReducedMotion();
  const shock = React.useMemo(() => missionShock(), []);
  const groupe = React.useMemo(() => annualValue("groupe"), []);

  const goValue = () =>
    document.getElementById("demo-act-value")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });

  return (
    <section id="demo-act-choc" className="demo-section demo-scene-flow" aria-label="Le choc de valeur">
      <Reveal className="w-full">
        <div className="demo-shell flex flex-col items-center gap-5 text-center">
          <CineEyebrow n="01">{shock.scenario.trigger}</CineEyebrow>

          {/* LA COMPARAISON TEMPORELLE — monumentale. Temps HUMAIN, jamais mélangé. */}
          <div className="flex flex-col items-center gap-1">
            <p className="cine-num" style={{ fontSize: "clamp(2.6rem, min(8.4vw, 11svh), 6.6rem)" }}>
              {formatHours(shock.manualMinutes)}
              <span className="cine-num__unit">de travail humain</span>
            </p>
            <ArrowDown className="h-7 w-7 text-[var(--cs-ink-4)]" aria-hidden="true" />
            <p className="cine-num cine-num--accent" style={{ fontSize: "clamp(2.6rem, min(8.4vw, 11svh), 6.6rem)" }}>
              {formatHours(shock.attentionMinutes)}
              <span className="cine-num__unit">d&apos;attention humaine</span>
            </p>
          </div>

          {/* LA CHARGE ABSORBÉE — une phrase. */}
          <p className="max-w-xl text-[clamp(1rem,1.5vw,1.2rem)] font-medium leading-snug text-[var(--cs-ink-1)]">
            Pierre absorbe la mission, les documents, les relances, les dépendances et le suivi —
            vous gardez les validations qui comptent.
          </p>

          {/* LA PROJECTION ANNUELLE — dominante, rattachée à SON scénario. */}
          <p className="rounded-2xl border border-[var(--demo-violet-soft)] bg-[rgba(107,99,232,0.07)] px-5 py-3.5">
            <span className="block text-[clamp(1.5rem,2.6vw,2.3rem)] font-semibold tracking-[-0.02em] text-[var(--demo-violet-deep)]">
              Jusqu&apos;à {formatMillions(groupe.capacity.recoverableAnnualMinor, groupe.currency)} de capacité libérée par an
            </span>
            <span className="mt-1 block text-[0.82rem] text-[var(--cs-ink-3)]">
              dans le scénario groupe multi-sites ({groupe.profile.tagline}) — {VALUE_WORDING.estimation.toLowerCase()}
            </span>
          </p>

          {/* CloneStore en une phrase + LE CTA. */}
          <p className="text-[0.95rem] text-[var(--cs-ink-2)]">
            CloneStore ouvre des postes d&apos;employés IA qui prennent en charge des missions entières.
          </p>
          <button type="button" onClick={goValue} className="demo-btn demo-btn-primary demo-btn-primary--hero">
            <span>Voir ce que Pierre absorbe</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>

          <p className="text-[0.74rem] text-[var(--cs-ink-4)]">
            {VALUE_WORDING.illustrative} {VALUE_WORDING.humanTime} — jamais du temps machine ni du temps calendaire.
          </p>
        </div>
      </Reveal>
    </section>
  );
}

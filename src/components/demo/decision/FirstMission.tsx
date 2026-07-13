"use client";

// /demo — Clôture : « Par quoi commencer ? »
//
// Le moment le plus utile de toute la démonstration pour un dirigeant : sortir de
// l'indécision en nommant UNE première mission. On ne propose pas dix offres — on
// applique une règle : le travail le moins sensible, le plus répétitif, le plus
// facile à mesurer.
//
// Ce composant assume une chose rare : il DÉCONSEILLE six situations en premier
// périmètre, alors même qu'elles sont prises en charge. C'est ce qui borne le
// risque du premier engagement — et c'est plus utile au client que de tout vendre
// d'un coup. Si aucune mission ne lui vient à l'esprit, la démo le dit : ne
// réservez pas.
//
// Aucune donnée nouvelle : la qualification vient de operating-model (START_FIT).

import * as React from "react";
import { Repeat, ShieldCheck, Gauge, UserCheck, Clock3 } from "lucide-react";

import { Reveal } from "../primitives/motion";
import { GlassSurface } from "../primitives/GlassSurface";
import { SCENE_DECISION } from "@/lib/demo/presentation/content";
import {
  START_FIT,
  firstMissionCandidates,
  laterMissions,
} from "@/lib/demo/presentation/operating-model";

export function FirstMission({ onSelect }: { onSelect: () => void }) {
  const candidates = firstMissionCandidates();
  const later = laterMissions();
  const [activeId, setActiveId] = React.useState<string>(candidates[0].id);

  const active = candidates.find((s) => s.id === activeId) ?? candidates[0];
  const fit = START_FIT[active.id];

  const select = React.useCallback(
    (id: string) => {
      setActiveId(id);
      onSelect();
    },
    [onSelect],
  );

  return (
    <div className="demo-first">
      <Reveal className="mx-auto max-w-3xl text-center">
        <p className="demo-kicker">{SCENE_DECISION.missionKicker}</p>
        <h2 className="demo-title demo-title--compact-long mt-3">{SCENE_DECISION.missionTitle}</h2>
        <p className="demo-lede mx-auto mt-4 max-w-2xl">{SCENE_DECISION.missionLede}</p>
        <div className="demo-first__criteria">
          {SCENE_DECISION.missionCriteria.map((c) => (
            <span key={c} className="demo-chip">
              <span className="demo-chip__dot" aria-hidden="true" />
              {c}
            </span>
          ))}
        </div>
      </Reveal>

      <div className="demo-first__grid">
        <div
          role="tablist"
          aria-label="Premières missions recommandées"
          aria-orientation="vertical"
          className="demo-first__list"
        >
          {candidates.map((s) => {
            const on = s.id === activeId;
            return (
              <button
                key={s.id}
                type="button"
                role="tab"
                id={`demo-first-tab-${s.id}`}
                aria-selected={on}
                aria-controls={`demo-first-panel-${s.id}`}
                tabIndex={on ? 0 : -1}
                onClick={() => select(s.id)}
                className={`demo-first__opt ${on ? "demo-first__opt--on" : ""}`}
              >
                <span className="demo-first__opt-label">{s.trigger}</span>
                <span className="demo-first__opt-note">{START_FIT[s.id].repetition}</span>
              </button>
            );
          })}
        </div>

        <GlassSurface
          kind="material"
          weight="card"
          materialize={false}
          className="demo-first__panel rounded-[1.5rem] p-5 sm:p-6"
        >
          <div
            role="tabpanel"
            id={`demo-first-panel-${active.id}`}
            aria-labelledby={`demo-first-tab-${active.id}`}
            tabIndex={0}
          >
            <p className="demo-first__note">{fit.note}</p>

            <dl className="demo-first__facts">
              <Fact Icon={Repeat} k="Répétition" v={fit.repetition} />
              <Fact Icon={ShieldCheck} k="Sensibilité" v={fit.sensitivity} />
              <Fact Icon={Gauge} k="Ce que vous mesurerez" v={fit.measure} tone="measure" />
              <Fact Icon={UserCheck} k="Ce qui reste humain" v={fit.humanKeeps} tone="human" />
            </dl>
          </div>
        </GlassSurface>
      </div>

      {/* La retenue commerciale, rendue concrète : ce qu'on ne recommande PAS d'abord. */}
      <Reveal delay={0.05} className="demo-first__later">
        <div className="demo-first__later-head">
          <Clock3 className="h-4 w-4 shrink-0 text-[var(--cs-ink-4)]" aria-hidden="true" />
          <div>
            <p className="demo-first__later-title">{SCENE_DECISION.laterTitle}</p>
            <p className="demo-first__later-lede">{SCENE_DECISION.laterLede}</p>
          </div>
        </div>
        <ul className="demo-first__later-list">
          {later.map((s) => (
            <li key={s.id} className="demo-first__later-item">
              <span className="demo-first__later-k">{s.trigger}</span>
              <span className="demo-first__later-v">{START_FIT[s.id].note}</span>
            </li>
          ))}
        </ul>
      </Reveal>

      <Reveal delay={0.05} className="demo-first__none">
        <p className="demo-first__none-q">{SCENE_DECISION.noMission}</p>
        <p className="demo-first__none-a">{SCENE_DECISION.noMissionAnswer}</p>
      </Reveal>
    </div>
  );
}

function Fact({
  Icon,
  k,
  v,
  tone,
}: {
  Icon: typeof Repeat;
  k: string;
  v: string;
  tone?: "measure" | "human";
}) {
  return (
    <div className={`demo-first__fact ${tone ? `demo-first__fact--${tone}` : ""}`}>
      <dt className="demo-first__fact-k">
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {k}
      </dt>
      <dd className="demo-first__fact-v">{v}</dd>
    </div>
  );
}

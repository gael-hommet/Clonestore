"use client";

// /demo — CH.4 (NOUVEAU) : le niveau d'autonomie devient un vrai MOMENT.
// Plein cadre, une phrase géante par mode, un seul mode sélectionné à la fois.
// La barre de répartition RÉELLE (dérivée du moteur P8) se déplace quand on change
// de niveau : elle prouve, sans un mot, que le mode change vraiment l'exécution.
// Données : autonomy-modes.ts (miroir truth-checké de PRODUCT_AUTONOMY_MODES).

import * as React from "react";
import { ShieldCheck } from "lucide-react";
import { CineScene, CineEyebrow, CineTitle, CineLede } from "../primitives/cine";
import {
  PUBLIC_AUTONOMY_MODES,
  SPLIT_LABELS,
  AUTONOMY_INTRO,
  AUTONOMY_HARD_FLOOR,
  DEFAULT_AUTONOMY_MODE_ID,
} from "@/lib/demo/presentation/autonomy-modes";

const SPLIT_TONES = {
  alone: "var(--demo-violet)",
  prepared: "var(--cs-ink-4)",
  human: "var(--cs-warn)",
} as const;

export function ModesChapter() {
  const [activeId, setActiveId] = React.useState<string>(DEFAULT_AUTONOMY_MODE_ID);
  const active = PUBLIC_AUTONOMY_MODES.find((m) => m.id === activeId) ?? PUBLIC_AUTONOMY_MODES[1];
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const total = active.split.alone + active.split.prepared + active.split.human || 1;

  const onKeyDown = (e: React.KeyboardEvent, i: number) => {
    const keys = ["ArrowRight", "ArrowLeft", "Home", "End"];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    const n = PUBLIC_AUTONOMY_MODES.length;
    let next = i;
    if (e.key === "ArrowRight") next = (i + 1) % n;
    else if (e.key === "ArrowLeft") next = (i - 1 + n) % n;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = n - 1;
    setActiveId(PUBLIC_AUTONOMY_MODES[next].id);
    refs.current[next]?.focus();
  };

  const segments = [
    { key: "alone" as const, n: active.split.alone },
    { key: "prepared" as const, n: active.split.prepared },
    { key: "human" as const, n: active.split.human },
  ];

  return (
    <section id="demo-act-modes" className="demo-section demo-scene-flow" aria-label="Le niveau d'autonomie">
      <CineScene>
        <CineEyebrow n="06">{AUTONOMY_INTRO.kicker}</CineEyebrow>
        <CineTitle>{AUTONOMY_INTRO.title}</CineTitle>
        <CineLede>{AUTONOMY_INTRO.lede}</CineLede>

        {/* Curseur à 4 crans — l'autonomie croît de gauche à droite. */}
        <div role="radiogroup" aria-label="Niveau d'autonomie" className="mt-2 grid w-full max-w-3xl grid-cols-2 gap-2.5 sm:grid-cols-4">
          {PUBLIC_AUTONOMY_MODES.map((m, i) => {
            const on = m.id === activeId;
            return (
              <button
                key={m.id}
                ref={(n) => {
                  refs.current[i] = n;
                }}
                type="button"
                role="radio"
                aria-checked={on}
                tabIndex={on ? 0 : -1}
                onClick={() => setActiveId(m.id)}
                onKeyDown={(e) => onKeyDown(e, i)}
                className={[
                  "rounded-2xl border px-3 py-3 text-left transition",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--demo-violet)] focus-visible:ring-offset-2",
                  on
                    ? "border-[var(--demo-violet)] bg-[rgba(107,99,232,0.08)] shadow-[var(--cs-shadow-soft)]"
                    : "border-[var(--cs-line)] bg-white/40 hover:border-[var(--cs-ink-4)]",
                ].join(" ")}
              >
                <span className="flex gap-1" aria-hidden="true">
                  {[0, 1, 2, 3].map((seg) => (
                    <span
                      key={seg}
                      className={[
                        "h-1 flex-1 rounded-full",
                        seg <= m.level ? (on ? "bg-[var(--demo-violet)]" : "bg-[var(--cs-ink-4)]") : "bg-[var(--cs-line)]",
                      ].join(" ")}
                    />
                  ))}
                </span>
                <span className={["mt-2 block text-[0.92rem] font-semibold", on ? "text-[var(--cs-ink-1)]" : "text-[var(--cs-ink-2)]"].join(" ")}>
                  {m.name}
                </span>
              </button>
            );
          })}
        </div>

        {/* Le SEUL mode sélectionné : sa phrase en grand + sa répartition réelle. */}
        <div key={active.id} aria-live="polite" className="w-full max-w-3xl">
          <p className="cine-title cine-title--sm mx-auto">{active.tagline}</p>

          <div
            className="mx-auto mt-6 flex h-3 max-w-xl overflow-hidden rounded-full bg-[var(--cs-line)]"
            role="img"
            aria-label={`Répartition : ${active.split.alone} fait seul, ${active.split.prepared} préparé, ${active.split.human} réservé à un humain`}
          >
            {segments.map((s) =>
              s.n > 0 ? <span key={s.key} style={{ width: `${(s.n / total) * 100}%`, background: SPLIT_TONES[s.key] }} /> : null,
            )}
          </div>
          <ul className="mt-3.5 flex flex-wrap justify-center gap-x-6 gap-y-1.5">
            {segments.map((s) => (
              <li key={s.key} className="flex items-center gap-1.5 text-[0.84rem] text-[var(--cs-ink-2)]">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: SPLIT_TONES[s.key] }} aria-hidden="true" />
                <span className="font-semibold tabular-nums text-[var(--cs-ink-1)]">{s.n}</span>
                {SPLIT_LABELS[s.key]}
              </li>
            ))}
          </ul>
        </div>

        {/* Plancher inviolable — toujours visible. */}
        <p className="mx-auto mt-2 flex max-w-2xl items-start gap-2 text-[0.86rem] leading-relaxed text-[var(--cs-ink-3)]">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--demo-violet)]" aria-hidden="true" />
          {AUTONOMY_HARD_FLOOR}
        </p>
      </CineScene>
    </section>
  );
}

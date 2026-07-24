"use client";

// Modes d'autonomie de Pierre — sélecteur PUBLIC, premium et visuel.
//
// Réduction de charge cognitive : un curseur à quatre crans montre la progression
// d'autonomie ; SEUL le mode sélectionné révèle son détail (disclosure). Sous le
// détail, une barre montre la répartition RÉELLE (dérivée du moteur P8) « fait seul /
// préparé / réservé humain » — elle se déplace quand on change de mode, ce qui prouve
// sans un mot que le mode change vraiment l'exécution. Le plancher reste toujours
// visible. Données : src/lib/demo/presentation/autonomy-modes.ts (miroir truth-checké).

import * as React from "react";
import { ShieldCheck } from "lucide-react";
import {
  PUBLIC_AUTONOMY_MODES,
  SPLIT_LABELS,
  AUTONOMY_INTRO,
  AUTONOMY_HARD_FLOOR,
  DEFAULT_AUTONOMY_MODE_ID,
} from "@/lib/demo/presentation/autonomy-modes";

const SPLIT_TONES = {
  alone: "var(--cs-violet)",
  prepared: "var(--cs-ink-4)",
  human: "var(--cs-warn)",
} as const;

export function PierreModes({
  className,
  headingLevel = "h2",
  onModeChange,
}: {
  className?: string;
  headingLevel?: "h2" | "h3";
  onModeChange?: (modeId: string) => void;
}) {
  const [activeId, setActiveId] = React.useState<string>(DEFAULT_AUTONOMY_MODE_ID);
  const active = PUBLIC_AUTONOMY_MODES.find((m) => m.id === activeId) ?? PUBLIC_AUTONOMY_MODES[1];
  const Heading = headingLevel;
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const total = active.split.alone + active.split.prepared + active.split.human || 1;

  const select = React.useCallback(
    (id: string) => {
      setActiveId(id);
      onModeChange?.(id);
    },
    [onModeChange],
  );

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
    select(PUBLIC_AUTONOMY_MODES[next].id);
    refs.current[next]?.focus();
  };

  const segments = [
    { key: "alone" as const, n: active.split.alone },
    { key: "prepared" as const, n: active.split.prepared },
    { key: "human" as const, n: active.split.human },
  ];

  return (
    <section className={className} aria-label="Modes d'autonomie de Pierre">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--cs-violet)]">
        {AUTONOMY_INTRO.kicker}
      </p>
      <Heading className="mt-2 text-[clamp(1.5rem,2.6vw,2.1rem)] font-semibold leading-[1.1] tracking-[-0.03em] text-[var(--cs-ink-1)]">
        {AUTONOMY_INTRO.title}
      </Heading>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--cs-ink-3)]">{AUTONOMY_INTRO.lede}</p>

      {/* Curseur à 4 crans — l'autonomie croît de gauche à droite. */}
      <div role="radiogroup" aria-label="Niveau d'autonomie" className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
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
              onClick={() => select(m.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={[
                "rounded-2xl border px-3 py-3 text-left transition",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cs-violet)] focus-visible:ring-offset-2",
                on
                  ? "border-[var(--cs-violet)] bg-[var(--cs-violet)]/[0.07] shadow-[var(--cs-shadow-soft)]"
                  : "border-[var(--cs-line)] bg-white/40 hover:border-[var(--cs-ink-4)]",
              ].join(" ")}
            >
              <span className="flex gap-1" aria-hidden="true">
                {[0, 1, 2, 3].map((seg) => (
                  <span
                    key={seg}
                    className={[
                      "h-1 flex-1 rounded-full",
                      seg <= m.level ? (on ? "bg-[var(--cs-violet)]" : "bg-[var(--cs-ink-4)]") : "bg-[var(--cs-line)]",
                    ].join(" ")}
                  />
                ))}
              </span>
              <span className={["mt-2 block text-sm font-semibold", on ? "text-[var(--cs-ink-1)]" : "text-[var(--cs-ink-2)]"].join(" ")}>
                {m.name}
              </span>
            </button>
          );
        })}
      </div>

      {/* Détail du SEUL mode sélectionné. */}
      <div
        key={active.id}
        aria-live="polite"
        className="mt-5 rounded-2xl border border-[var(--cs-line)] bg-white/55 p-5 backdrop-blur-md sm:p-6"
      >
        <p className="text-[clamp(1.1rem,1.9vw,1.4rem)] font-semibold leading-snug tracking-[-0.02em] text-[var(--cs-ink-1)]">
          {active.tagline}
        </p>

        {/* Répartition réelle, dérivée du moteur — se déplace selon le mode. */}
        <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-[var(--cs-line)]" role="img"
          aria-label={`Répartition : ${active.split.alone} fait seul, ${active.split.prepared} préparé, ${active.split.human} réservé à un humain`}>
          {segments.map((s) =>
            s.n > 0 ? (
              <span key={s.key} style={{ width: `${(s.n / total) * 100}%`, background: SPLIT_TONES[s.key] }} />
            ) : null,
          )}
        </div>
        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
          {segments.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5 text-[0.78rem] text-[var(--cs-ink-2)]">
              <span className="h-2 w-2 rounded-full" style={{ background: SPLIT_TONES[s.key] }} aria-hidden="true" />
              <span className="font-semibold tabular-nums text-[var(--cs-ink-1)]">{s.n}</span>
              {SPLIT_LABELS[s.key]}
            </li>
          ))}
        </ul>
      </div>

      {/* Plancher inviolable — toujours visible. */}
      <p className="mt-4 flex items-start gap-2 text-[0.78rem] leading-relaxed text-[var(--cs-ink-3)]">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--cs-violet)]" aria-hidden="true" />
        {AUTONOMY_HARD_FLOOR}
      </p>
    </section>
  );
}

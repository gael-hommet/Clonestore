"use client";

// /demo — Acte 6 : le comparateur.
//
// Une même situation, deux exécutions. Le contraste doit se RESSENTIR avant
// d'être lu : à gauche les étapes s'accumulent, changent d'outil, s'interrompent
// et le temps mobilisé monte ; à droite la même exigence tient sur un flux
// continu, avec ses validations et sa trace.
//
// Les deux côtés sont traités avec le même soin visuel. L'organisation
// traditionnelle n'est jamais ridiculisée : ses équipes sont compétentes, c'est
// son exécution qui est fragmentée. Toute la différence vient de la densité, des
// ruptures et de la continuité — jamais d'un design volontairement dégradé.

import * as React from "react";
import { motion } from "framer-motion";
import {
  Search,
  Copy,
  CheckCircle2,
  BellRing,
  PauseCircle,
  ArrowLeftRight,
  Zap,
  Layers,
  Fingerprint,
  FileCheck2,
  ShieldCheck,
  AlertTriangle,
  ScrollText,
  Play,
} from "lucide-react";

import { GlassSurface } from "../primitives/GlassSurface";
import { DEMO_EASE, useDemoReducedMotion } from "../primitives/motion";
import { useSequentialReveal } from "./useSequentialReveal";
import { formatHours } from "@/lib/demo/presentation/cost-model";
import {
  currentMetrics,
  governedMetrics,
  type GovernedStep,
  type GovernedStepKind,
  type ManualStep,
  type ManualStepKind,
  type OperatingScenario,
} from "@/lib/demo/presentation/operating-model";
import { SCENE_COST } from "@/lib/demo/presentation/content";

// ── Signatures d'étape ──────────────────────────────────────────────────────

const MANUAL_ICON: Record<ManualStepKind, typeof Search> = {
  search: Search,
  copy: Copy,
  verify: CheckCircle2,
  chase: BellRing,
  wait: PauseCircle,
  switch: ArrowLeftRight,
  interrupt: Zap,
  consolidate: Layers,
};

const MANUAL_LABEL: Record<ManualStepKind, string> = {
  search: "Rechercher",
  copy: "Recopier",
  verify: "Vérifier",
  chase: "Relancer",
  wait: "Attente",
  switch: "Changement d'outil",
  interrupt: "Interruption",
  consolidate: "Consolider",
};

const GOVERNED_ICON: Record<GovernedStepKind, typeof Search> = {
  context: Fingerprint,
  prepare: FileCheck2,
  execute: Play,
  flag: AlertTriangle,
  validate: ShieldCheck,
  trace: ScrollText,
};

const GOVERNED_LABEL: Record<GovernedStepKind, string> = {
  context: "Contexte",
  prepare: "Préparation",
  execute: "Exécution",
  flag: "Signalement",
  validate: "Validation humaine",
  trace: "Traçabilité",
};

/** Une rupture d'exécution : l'attente et l'interruption cassent la continuité. */
function isBreak(kind: ManualStepKind): boolean {
  return kind === "wait" || kind === "interrupt";
}

// ── Métriques ───────────────────────────────────────────────────────────────

function MetricStrip({
  items,
  tone,
}: {
  items: readonly { key: string; value: string; label: string }[];
  tone: "current" | "governed";
}) {
  return (
    <dl className={`demo-cost-metrics demo-cost-metrics--${tone}`}>
      {items.map((item) => (
        <div key={item.key} className="demo-cost-metric">
          <dt className="demo-cost-metric__label">{item.label}</dt>
          <dd className="demo-cost-metric__value">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

// ── Colonne « aujourd'hui » ─────────────────────────────────────────────────

function CurrentColumn({ scenario, active }: { scenario: OperatingScenario; active: boolean }) {
  const reduce = useDemoReducedMotion();
  const steps = scenario.current.steps;
  const revealed = useSequentialReveal(steps.length, {
    active,
    reduce,
    intervalMs: 240,
    resetKey: scenario.id,
  });

  // Le temps affiché est la somme EXACTE des étapes déjà révélées : il monte
  // parce que le travail s'accumule, pas parce qu'une animation le décide.
  const accumulatedMinutes = steps
    .slice(0, revealed)
    .reduce((total, step) => total + step.minutes, 0);

  const metrics = currentMetrics(scenario);

  return (
    <GlassSurface
      kind="read"
      weight="card"
      materialize={false}
      className="demo-cost-side demo-cost-side--current rounded-[1.5rem] p-5"
    >
      <div className="demo-cost-side__head">
        <p className="demo-cost-side__title">{SCENE_COST.currentLabel}</p>
        <p className="demo-cost-side__sub">{SCENE_COST.currentSub}</p>
      </div>

      <MetricStrip
        tone="current"
        items={[
          { key: "steps", value: String(metrics.steps), label: "Étapes manuelles" },
          { key: "surfaces", value: String(metrics.surfaces), label: "Outils mobilisés" },
          { key: "breaks", value: String(metrics.breaks), label: "Ruptures" },
          { key: "time", value: formatHours(accumulatedMinutes), label: "Temps mobilisé" },
        ]}
      />

      <ol className="demo-cost-steps demo-cost-steps--current" aria-label="Étapes de l'exécution manuelle">
        {steps.map((step, index) => (
          <ManualStepRow
            key={step.label}
            step={step}
            visible={index < revealed}
            reduce={reduce}
            last={index === steps.length - 1}
          />
        ))}
      </ol>

      <p className="demo-cost-side__foot">
        <span className="demo-cost-side__foot-k">Délai constaté</span>
        <span className="demo-cost-side__foot-v">{metrics.delay}</span>
      </p>
    </GlassSurface>
  );
}

function ManualStepRow({
  step,
  visible,
  reduce,
  last,
}: {
  step: ManualStep;
  visible: boolean;
  reduce: boolean;
  last: boolean;
}) {
  const Icon = MANUAL_ICON[step.kind];
  const broken = isBreak(step.kind);
  return (
    <motion.li
      className={`demo-cost-step ${broken ? "demo-cost-step--break" : ""} ${last ? "demo-cost-step--last" : ""}`}
      initial={false}
      animate={{
        opacity: visible ? 1 : 0.12,
        // Le décalage rend l'accumulation perceptible sans jamais déplacer la mise en page.
        x: visible || reduce ? 0 : -6,
      }}
      transition={{ duration: reduce ? 0 : 0.42, ease: DEMO_EASE }}
    >
      <span className="demo-cost-step__mark" aria-hidden="true">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="demo-cost-step__body">
        <span className="demo-cost-step__label">{step.label}</span>
        <span className="demo-cost-step__meta">
          <span className={`demo-cost-tag ${broken ? "demo-cost-tag--break" : ""}`}>
            {MANUAL_LABEL[step.kind]}
          </span>
          <span className="demo-cost-step__on">{step.on}</span>
          {step.minutes > 0 ? (
            <span className="demo-cost-step__min">{formatHours(step.minutes)}</span>
          ) : (
            <span className="demo-cost-step__min demo-cost-step__min--none">exécution suspendue</span>
          )}
        </span>
      </span>
    </motion.li>
  );
}

// ── Colonne « avec un employé IA CloneStore » ───────────────────────────────

function GovernedColumn({ scenario, active }: { scenario: OperatingScenario; active: boolean }) {
  const reduce = useDemoReducedMotion();
  const steps = scenario.governed.steps;
  // Le flux gouverné ne s'accumule pas : il se compose d'un seul tenant, plus vite.
  const revealed = useSequentialReveal(steps.length, {
    active,
    reduce,
    intervalMs: 110,
    resetKey: scenario.id,
  });

  const metrics = governedMetrics(scenario);

  return (
    <GlassSurface
      kind="material"
      weight="card"
      materialize={false}
      sheen
      className="demo-cost-side demo-cost-side--governed rounded-[1.5rem] p-5"
    >
      <div className="demo-cost-side__head">
        <p className="demo-cost-side__title">{SCENE_COST.governedLabel}</p>
        <p className="demo-cost-side__sub">{SCENE_COST.governedSub}</p>
      </div>

      <MetricStrip
        tone="governed"
        items={[
          { key: "steps", value: String(metrics.steps), label: "Étapes d'un seul flux" },
          { key: "validations", value: String(metrics.validations), label: "Validations requises" },
          { key: "flags", value: String(metrics.flags), label: "Signalements" },
          {
            key: "time",
            value: metrics.minutes > 0 ? formatHours(metrics.minutes) : "—",
            label: "Temps humain restant",
          },
        ]}
      />

      <ol className="demo-cost-steps demo-cost-steps--governed" aria-label="Étapes de l'exécution par l'employé IA">
        {steps.map((step, index) => (
          <GovernedStepRow
            key={step.label}
            step={step}
            visible={index < revealed}
            reduce={reduce}
            last={index === steps.length - 1}
          />
        ))}
      </ol>

      <p className="demo-cost-side__foot">
        <span className="demo-cost-side__foot-k">Délai constaté</span>
        <span className="demo-cost-side__foot-v demo-cost-side__foot-v--strong">{metrics.delay}</span>
      </p>
    </GlassSurface>
  );
}

function GovernedStepRow({
  step,
  visible,
  reduce,
  last,
}: {
  step: GovernedStep;
  visible: boolean;
  reduce: boolean;
  last: boolean;
}) {
  const Icon = GOVERNED_ICON[step.kind];
  const human = step.kind === "validate" || step.kind === "flag";
  return (
    <motion.li
      className={`demo-cost-step demo-cost-step--governed ${human ? "demo-cost-step--human" : ""} ${
        last ? "demo-cost-step--last" : ""
      }`}
      initial={false}
      animate={{ opacity: visible ? 1 : 0.12, x: visible || reduce ? 0 : -6 }}
      transition={{ duration: reduce ? 0 : 0.36, ease: DEMO_EASE }}
    >
      <span className="demo-cost-step__mark demo-cost-step__mark--governed" aria-hidden="true">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="demo-cost-step__body">
        <span className="demo-cost-step__label">{step.label}</span>
        <span className="demo-cost-step__meta">
          <span className={`demo-cost-tag demo-cost-tag--governed ${human ? "demo-cost-tag--human" : ""}`}>
            {GOVERNED_LABEL[step.kind]}
          </span>
          {step.minutes > 0 ? (
            <span className="demo-cost-step__min">{formatHours(step.minutes)} — votre équipe</span>
          ) : null}
        </span>
      </span>
    </motion.li>
  );
}

// ── Comparateur ─────────────────────────────────────────────────────────────

export function ScenarioComparator({
  scenarios,
  activeId,
  onSelect,
  inView,
}: {
  scenarios: readonly OperatingScenario[];
  activeId: string;
  onSelect: (id: string) => void;
  inView: boolean;
}) {
  const activeIndex = Math.max(
    0,
    scenarios.findIndex((s) => s.id === activeId),
  );
  const scenario = scenarios[activeIndex];
  const tabRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  // Tablist accessible : flèches, Origine et Fin, comme l'attend un lecteur d'écran.
  const onKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const keys = ["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft", "Home", "End"];
      if (!keys.includes(event.key)) return;
      event.preventDefault();

      let next = activeIndex;
      if (event.key === "ArrowDown" || event.key === "ArrowRight") next = (activeIndex + 1) % scenarios.length;
      else if (event.key === "ArrowUp" || event.key === "ArrowLeft")
        next = (activeIndex - 1 + scenarios.length) % scenarios.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = scenarios.length - 1;

      onSelect(scenarios[next].id);
      tabRefs.current[next]?.focus();
    },
    [activeIndex, scenarios, onSelect],
  );

  return (
    <div className="demo-cost-comparator">
      <div
        role="tablist"
        aria-label="Situations à comparer"
        aria-orientation="vertical"
        className="demo-cost-tablist"
        onKeyDown={onKeyDown}
      >
        {scenarios.map((item, index) => {
          const selected = item.id === activeId;
          return (
            <button
              key={item.id}
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              type="button"
              role="tab"
              id={`demo-cost-tab-${item.id}`}
              aria-selected={selected}
              aria-controls={`demo-cost-panel-${item.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onSelect(item.id)}
              className={`demo-cost-tab ${selected ? "demo-cost-tab--on" : ""}`}
            >
              <span className="demo-cost-tab__index" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="demo-cost-tab__label">{item.trigger}</span>
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`demo-cost-panel-${scenario.id}`}
        aria-labelledby={`demo-cost-tab-${scenario.id}`}
        tabIndex={0}
        className="demo-cost-panel"
      >
        <p className="demo-cost-panel__stake">{scenario.stake}</p>
        <div className="demo-cost-split">
          <CurrentColumn key={`current-${scenario.id}`} scenario={scenario} active={inView} />
          <GovernedColumn key={`governed-${scenario.id}`} scenario={scenario} active={inView} />
        </div>
        <p className="demo-note demo-cost-panel__note">{SCENE_COST.comparatorNote}</p>
      </div>
    </div>
  );
}

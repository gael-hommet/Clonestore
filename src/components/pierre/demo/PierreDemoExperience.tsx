"use client";

// PIERRE FINAL INTERACTIVE DEMO — guided + exploration orchestrator.
//
// Two levels: a guided journey that proves the value in ≈2 min (fully under the
// visitor's control: continue / back / pause / restart / change scenario / quit),
// then an exploration mode that proves the depth. No real action is ever taken;
// analytics flow through the existing first-party conversion tracker.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight, ArrowLeft, Play, Pause, RotateCcw, ChevronRight, Eye, Lock, CheckCircle2, LogOut,
} from "lucide-react";
import {
  DEMO_SCENARIOS, getScenario, getDefaultScenario, GUIDED_STEPS, GUIDED_STEP_COUNT,
  STEP_DWELL_MS, isLastStep, nextStepIndex, prevStepIndex, clampStepIndex, completionPercentage,
  trackDemoEvent, DEMO_CTA_DESTINATIONS, type GuidedStep,
} from "@/lib/pierre/demo";
import { MissionComposer } from "./MissionComposer";
import { MissionUnderstanding } from "./MissionUnderstanding";
import { CompanyContextPanel } from "./CompanyContextPanel";
import { TechnologyPulse } from "./TechnologyPulse";
import { MissionControl } from "./MissionControl";
import { DemoMessaging } from "./DemoMessaging";
import { DemoDocumentViewer } from "./DemoDocumentViewer";
import { DemoApproval } from "./DemoApproval";
import { GuardrailMoment } from "./GuardrailMoment";
import { CloneTraceTimeline } from "./CloneTraceTimeline";
import { DemoResult } from "./DemoResult";
import { CapabilityExplorer } from "./CapabilityExplorer";
import { ConversionMoment } from "./ConversionMoment";
import { DemoFinalCTA } from "./DemoFinalCTA";
import { DemoDrawer } from "./DemoDrawer";
import { SafetyChip, Chip } from "./parts";

const MISSION_CONTROL_INDEX = GUIDED_STEPS.findIndex((s) => s.id === "mission_control");

export function PierreDemoExperience() {
  const [scenarioId, setScenarioId] = useState(getDefaultScenario().id);
  const [stepIndex, setStepIndex] = useState(0);
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [activeMissionId, setActiveMissionId] = useState<string | null>(null);
  const [openDocId, setOpenDocId] = useState<string | null>(null);
  const [reachedResult, setReachedResult] = useState(false);
  const [midCtaDismissed, setMidCtaDismissed] = useState(false);

  const scenario = useMemo(() => getScenario(scenarioId) ?? getDefaultScenario(), [scenarioId]);
  const step: GuidedStep = GUIDED_STEPS[stepIndex];
  const finalRef = useRef<HTMLDivElement>(null);
  const openDoc = openDocId ? scenario.documents.find((d) => d.id === openDocId) ?? null : null;

  // Respect reduced motion.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);

  // Per-step analytics + completion.
  useEffect(() => {
    if (!started) return;
    const id = step.id;
    if (id === "technology") trackDemoEvent("pierre_demo_technology_opened", { scenario_id: scenarioId, step_index: stepIndex });
    else if (id === "mission_control") trackDemoEvent("pierre_demo_wow_moment_reached", { scenario_id: scenarioId, step_index: stepIndex });
    else if (id === "messaging") trackDemoEvent("pierre_demo_message_opened", { scenario_id: scenarioId, step_index: stepIndex });
    else if (id === "understanding") trackDemoEvent("pierre_demo_plan_revealed", { scenario_id: scenarioId, step_index: stepIndex });
    if (id === "result" && !reachedResult) {
      setReachedResult(true);
      setPlaying(false);
      trackDemoEvent("pierre_demo_completed", { scenario_id: scenarioId, completion_percentage: 100, missions_count: scenario.missions.length });
    }
  }, [started, step.id, stepIndex, scenarioId, reachedResult, scenario.missions.length]);

  // Auto-advance (pausable). Content change, not motion — safe under reduced-motion.
  useEffect(() => {
    if (!started || !playing || isLastStep(stepIndex)) return;
    const t = window.setTimeout(() => setStepIndex((i) => nextStepIndex(i)), STEP_DWELL_MS[step.id]);
    return () => window.clearTimeout(t);
  }, [started, playing, stepIndex, step.id]);

  const start = useCallback(() => {
    setStarted(true);
    setStepIndex(Math.max(1, MISSION_CONTROL_INDEX < 0 ? 1 : 1));
    setPlaying(!reducedMotion);
    trackDemoEvent("pierre_demo_started", { scenario_id: scenarioId });
    trackDemoEvent("pierre_demo_mission_submitted", { scenario_id: scenarioId });
  }, [reducedMotion, scenarioId]);

  const goTo = useCallback((i: number) => setStepIndex(clampStepIndex(i)), []);
  const goNext = useCallback(() => setStepIndex((i) => nextStepIndex(i)), []);
  const goPrev = useCallback(() => setStepIndex((i) => prevStepIndex(i)), []);

  const restart = useCallback(() => {
    setStepIndex(0);
    setStarted(false);
    setPlaying(false);
    setReachedResult(false);
    setMidCtaDismissed(false);
    setActiveMissionId(null);
  }, []);

  const changeScenario = useCallback((id: string) => {
    setScenarioId(id);
    restart();
    trackDemoEvent("pierre_demo_scenario_selected", { scenario_id: id });
  }, [restart]);

  const openDocument = useCallback((docId: string) => {
    setOpenDocId(docId);
    trackDemoEvent("pierre_demo_document_opened", { scenario_id: scenarioId });
  }, [scenarioId]);

  const quitToCta = useCallback(() => {
    setPlaying(false);
    finalRef.current?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
  }, [reducedMotion]);

  // Keyboard navigation once started.
  useEffect(() => {
    if (!started) return;
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [started, goNext, goPrev]);

  return (
    <div data-testid="pierre-demo-experience">
      {/* ── Hero — value in < 10s ─────────────────────────────────────────── */}
      <header className="pd-glass pd-animate-rise" style={{ padding: "clamp(20px,4vw,40px)", marginBottom: 18 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          <Chip variant="neutral"><Eye className="h-3.5 w-3.5" aria-hidden /> Démonstration interactive · environ 2 min</Chip>
          <SafetyChip>Aucune communication réelle · aucune donnée modifiée</SafetyChip>
        </div>
        <p className="pd-eyebrow" style={{ marginBottom: 10 }}>Poste RH opérationnel automatisé</p>
        <h1 className="pd-display">
          Donnez une mission RH.
          <br />
          <span className="pd-accent">Pierre organise tout le reste.</span>
        </h1>
        <p className="pd-lede" style={{ marginTop: 12 }}>
          Compréhension, documents, validations, messages, relances et suivi — dans un seul employé IA.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
          <button type="button" className="pd-btn pd-btn-primary" onClick={start} data-step-id="hero-start">
            Voir Pierre travailler <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            className="pd-btn pd-btn-ghost"
            onClick={() => document.getElementById("pd-scenarios")?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" })}
          >
            Choisir un scénario
          </button>
        </div>
      </header>

      {/* ── Scenario selector ─────────────────────────────────────────────── */}
      <section id="pd-scenarios" style={{ marginBottom: 18 }} aria-label="Choisir un scénario">
        <p className="pd-eyebrow" style={{ marginBottom: 10 }}>Choisissez un scénario</p>
        <div className="pd-board" data-testid="scenario-selector">
          {DEMO_SCENARIOS.map((s) => {
            const active = s.id === scenarioId;
            return (
              <button
                key={s.id}
                type="button"
                className="pd-mission"
                aria-current={active}
                onClick={() => changeScenario(s.id)}
                data-step-id={`scenario:${s.id}`}
                data-scenario-id={s.id}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700, color: "var(--pd-ink-1)" }}>{s.name}</span>
                  {s.recommended ? <Chip variant="cool">Recommandé</Chip> : null}
                  {active ? <ChevronRight className="h-4 w-4" aria-hidden style={{ marginLeft: "auto", color: "var(--pd-cool)" }} /> : null}
                </div>
                <p style={{ margin: "4px 0 0", fontSize: "0.78rem", color: "var(--pd-ink-3)" }}>{s.promise}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Guided stage ──────────────────────────────────────────────────── */}
      <section className="pd-glass pd-stage" style={{ padding: "clamp(16px,3vw,28px)" }} aria-label="Démonstration guidée" data-conversion-demo-cockpit>
        {started ? (
          <div style={{ marginBottom: 16 }}>
            <div className="pd-progress" role="progressbar" aria-valuenow={completionPercentage(stepIndex)} aria-valuemin={0} aria-valuemax={100} aria-label="Progression de la démonstration">
              {GUIDED_STEPS.map((s, i) => (
                <span
                  key={s.id}
                  className={`pd-progress__seg ${i < stepIndex ? "pd-progress__seg--on" : ""} ${i === stepIndex ? "pd-progress__seg--cur" : ""}`}
                />
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
              <span className="pd-eyebrow">Étape {stepIndex + 1}/{GUIDED_STEP_COUNT}</span>
              <span style={{ fontWeight: 700, color: "var(--pd-ink-1)" }}>{step.title}</span>
              <span style={{ fontSize: "0.78rem", color: "var(--pd-ink-4)" }}>{step.caption}</span>
            </div>
          </div>
        ) : null}

        <div className="pd-stage" key={`${scenarioId}:${step.id}`}>
          <div className={reducedMotion ? "" : "pd-animate-fade"}>
            {step.id === "composer" && (
              <MissionComposer request={scenario.request} reducedMotion={reducedMotion} onSubmit={start} submitted={started} />
            )}
            {step.id === "understanding" && <MissionUnderstanding scenario={scenario} />}
            {step.id === "context" && <CompanyContextPanel scenario={scenario} />}
            {step.id === "technology" && <TechnologyPulse />}
            {step.id === "mission_control" && (
              <MissionControl scenario={scenario} activeMissionId={activeMissionId} onSelectMission={setActiveMissionId} />
            )}
            {step.id === "messaging" && <DemoMessaging scenario={scenario} onOpenDocument={openDocument} />}
            {step.id === "document" && <DocumentStage scenario={scenario} onOpenDocument={openDocument} />}
            {step.id === "approval" && (
              <DemoApproval
                scenario={scenario}
                onOpenDocument={openDocument}
                onApprovalClick={() => trackDemoEvent("pierre_demo_approval_clicked", { scenario_id: scenarioId })}
              />
            )}
            {step.id === "guardrail" && <GuardrailMoment scenario={scenario} />}
            {step.id === "trace" && <CloneTraceTimeline scenario={scenario} />}
            {step.id === "result" && <DemoResult scenario={scenario} />}
          </div>
        </div>

        {/* Controls */}
        {started ? (
          <div className="pd-controls" style={{ marginTop: 18 }} role="group" aria-label="Contrôles de la démonstration">
            <button type="button" className="pd-btn pd-btn-ghost" onClick={goPrev} disabled={stepIndex === 0} aria-label="Étape précédente">
              <ArrowLeft className="h-4 w-4" aria-hidden /> Précédent
            </button>
            <button type="button" className="pd-btn pd-btn-secondary" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Mettre en pause" : "Lecture"}>
              {playing ? <><Pause className="h-4 w-4" aria-hidden /> Pause</> : <><Play className="h-4 w-4" aria-hidden /> Lecture</>}
            </button>
            <button type="button" className="pd-btn pd-btn-ghost" onClick={goNext} disabled={isLastStep(stepIndex)} aria-label="Étape suivante">
              Suivant <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
            <span style={{ flex: 1 }} />
            <button type="button" className="pd-btn pd-btn-ghost" onClick={restart} aria-label="Recommencer">
              <RotateCcw className="h-4 w-4" aria-hidden /> Recommencer
            </button>
            <button type="button" className="pd-btn pd-btn-ghost" onClick={quitToCta} aria-label="Aller à la réservation">
              <LogOut className="h-4 w-4" aria-hidden /> Quitter
            </button>
          </div>
        ) : null}
      </section>

      {/* ── Mid-demo contextual CTA (after the mission centre) ─────────────── */}
      {started && stepIndex >= MISSION_CONTROL_INDEX && !midCtaDismissed && !reachedResult ? (
        <div style={{ marginTop: 16 }}>
          <ConversionMoment onContinue={() => { setMidCtaDismissed(true); setPlaying(true); }} />
        </div>
      ) : null}

      {/* ── Exploration mode (depth) ──────────────────────────────────────── */}
      {reachedResult ? (
        <div style={{ marginTop: 22, display: "grid", gap: 22 }} data-testid="exploration-mode">
          <ExplorationArtifacts scenario={scenario} onOpenDocument={openDocument} />
          <CapabilityExplorer />
          <CloneTraceTimeline scenario={scenario} />
        </div>
      ) : null}

      {/* ── Final CTA ─────────────────────────────────────────────────────── */}
      <div ref={finalRef} id="pd-final" style={{ marginTop: 24, scrollMarginTop: 16 }}>
        <DemoFinalCTA />
      </div>

      {/* ── Document drawer ───────────────────────────────────────────────── */}
      <DemoDrawer open={openDoc !== null} title={openDoc?.title ?? ""} onClose={() => setOpenDocId(null)}>
        {openDoc ? <DemoDocumentViewer doc={openDoc} /> : null}
      </DemoDrawer>
    </div>
  );
}

// Primary document showcase + quick access to the others.
function DocumentStage({
  scenario,
  onOpenDocument,
}: {
  scenario: ReturnType<typeof getDefaultScenario>;
  onOpenDocument: (id: string) => void;
}) {
  const [primary, ...rest] = scenario.documents;
  return (
    <section data-testid="document-stage">
      <header style={{ display: "grid", gap: 6, marginBottom: 14 }}>
        <p className="pd-eyebrow">Livrables</p>
        <h2 className="pd-h2">Des documents réels, ouvrables.</h2>
        <p className="pd-lede">Style Pierre/CloneStore, lisibles et complets — clairement marqués comme documents de démonstration.</p>
      </header>
      <DemoDocumentViewer doc={primary} />
      {rest.length > 0 ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          {rest.map((d) => (
            <button key={d.id} type="button" className="pd-btn pd-btn-secondary" style={{ minHeight: 38 }} onClick={() => onOpenDocument(d.id)} data-step-id={`open-doc:${d.id}`}>
              {d.title}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

// Exploration: every artifact openable.
function ExplorationArtifacts({
  scenario,
  onOpenDocument,
}: {
  scenario: ReturnType<typeof getDefaultScenario>;
  onOpenDocument: (id: string) => void;
}) {
  return (
    <section data-testid="exploration-artifacts">
      <header style={{ display: "grid", gap: 6, marginBottom: 14 }}>
        <p className="pd-eyebrow">Exploration</p>
        <h2 className="pd-h2">Ouvrez n&apos;importe quel livrable.</h2>
        <p className="pd-lede">Le mode guidé prouve la valeur. L&apos;exploration prouve la profondeur.</p>
      </header>
      <div className="pd-board">
        {scenario.documents.map((d) => (
          <button key={d.id} type="button" className="pd-mission" onClick={() => onOpenDocument(d.id)} data-step-id={`explore-doc:${d.id}`}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontWeight: 700, color: "var(--pd-ink-1)" }}>{d.title}</span>
              <span className="pd-chip pd-chip--warn" style={{ marginLeft: "auto", minHeight: 24, fontSize: "0.66rem" }}>{d.kind}</span>
            </div>
            <p style={{ margin: "4px 0 0", fontSize: "0.74rem", color: "var(--pd-ink-4)" }}>{d.badge}</p>
          </button>
        ))}
      </div>
      <p style={{ margin: "12px 0 0", fontSize: "0.74rem", color: "var(--pd-ink-4)", display: "flex", gap: 7, alignItems: "center" }}>
        <Lock className="h-3.5 w-3.5" aria-hidden /> Documents de démonstration — aucun fichier réel, aucune donnée privée.
      </p>
      <p className="pd-sr-only" aria-live="polite">
        Démonstration terminée. <CheckCircle2 className="h-3 w-3" aria-hidden /> Exploration disponible.
      </p>
    </section>
  );
}

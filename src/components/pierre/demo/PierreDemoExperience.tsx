"use client";

// PIERRE COCKPIT — interactive HR operations cockpit (/demo/pierre core).
//
// The prospect watches a real HR employee run a week: several requests arrive,
// Pierre analyses, organises, executes, asks for the one human validation that
// matters, keeps the missions alive over days, and closes with scenario-derived
// proof. Three persistent zones (Entrées · Mission · Livrables) stay connected
// at a glance; a 7-phase guided spotlight answers one prospect question at a
// time. Fully under the visitor's control (avancer / revenir / pause / relancer
// / changer de scénario). SAFE: no AI call, no write, no email, no signature.
// Analytics flow through the existing first-party tracker (PIERRE_DEMO_EVENTS).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight, ArrowLeft, Play, Pause, RotateCcw, ChevronRight, LogOut, Layers,
  Inbox, ListChecks, PackageCheck, Eye, ShieldCheck,
} from "lucide-react";
import {
  DEMO_SCENARIOS, getScenario, getDefaultScenario, DEMO_TECHNOLOGIES,
  COCKPIT_PHASES, COCKPIT_PHASE_COUNT, COCKPIT_PHASE_DWELL_MS,
  clampPhase, nextPhase, prevPhase, isLastPhase, cockpitCompletion, cockpitCounters, phaseIndexById,
  trackDemoEvent, type CockpitPhase, type CockpitPhaseId,
} from "@/lib/pierre/demo";
import { Chip, SafetyChip } from "./parts";
import { CockpitTopBar } from "./cockpit/CockpitTopBar";
import { IncomingRequests, ContextGaps, WeekContinuity, DeliverablesList, RoleSplit, LockedPanel } from "./cockpit/CockpitPanels";
import { MissionUnderstanding } from "./MissionUnderstanding";
import { MissionControl } from "./MissionControl";
import { GuardrailMoment } from "./GuardrailMoment";
import { DemoMessaging } from "./DemoMessaging";
import { DemoApproval } from "./DemoApproval";
import { CloneTraceTimeline } from "./CloneTraceTimeline";
import { DemoResult } from "./DemoResult";
import { TechnologyPulse } from "./TechnologyPulse";
import { DemoDocumentViewer } from "./DemoDocumentViewer";
import { DemoDrawer } from "./DemoDrawer";
import { ConversionMoment } from "./ConversionMoment";
import { DemoFinalCTA } from "./DemoFinalCTA";

type ZoneId = "left" | "center" | "right";
const TECH_DRAWER = "__tech__";

// Reveal thresholds (phase index at which a panel appears).
const R = {
  reception: phaseIndexById("reception"),
  analyse: phaseIndexById("analyse"),
  organisation: phaseIndexById("organisation"),
  execution: phaseIndexById("execution"),
  validation: phaseIndexById("validation"),
  continuite: phaseIndexById("continuite"),
  bilan: phaseIndexById("bilan"),
};

// Which technology is visibly "at work" during each phase (surfaced as it acts).
const PHASE_TECH: Record<CockpitPhaseId, (typeof DEMO_TECHNOLOGIES)[number]["id"]> = {
  reception: "cloneos",
  analyse: "cloneadn",
  organisation: "cloneos",
  execution: "cloneos",
  validation: "cloneguard",
  continuite: "clonecontinuum",
  bilan: "clonetrace",
};

export function PierreDemoExperience() {
  const [scenarioId, setScenarioId] = useState(getDefaultScenario().id);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [mobileTab, setMobileTab] = useState<ZoneId>("left");
  const [activeMissionId, setActiveMissionId] = useState<string | null>(null);
  const [openDocId, setOpenDocId] = useState<string | null>(null);
  const [reachedBilan, setReachedBilan] = useState(false);
  const [midCtaDismissed, setMidCtaDismissed] = useState(false);

  const scenario = useMemo(() => getScenario(scenarioId) ?? getDefaultScenario(), [scenarioId]);
  const phase: CockpitPhase = COCKPIT_PHASES[phaseIndex];
  const counters = useMemo(() => cockpitCounters(scenario), [scenario]);
  const finalRef = useRef<HTMLDivElement>(null);
  const bodyRefs = { left: useRef<HTMLDivElement>(null), center: useRef<HTMLDivElement>(null), right: useRef<HTMLDivElement>(null) };
  const openDoc = openDocId && openDocId !== TECH_DRAWER ? scenario.documents.find((d) => d.id === openDocId) ?? null : null;
  const activeTech = DEMO_TECHNOLOGIES.find((t) => t.id === PHASE_TECH[phase.id]);

  const revealed = useCallback((threshold: number) => phaseIndex >= threshold, [phaseIndex]);

  // Respect reduced motion.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);

  // Single source of truth for the topbar height (drawer opens below it).
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const header = document.querySelector<HTMLElement>(".cs-header");
    if (!header) {
      root.style.setProperty("--demo-header-height", "0px");
      return;
    }
    const apply = () => root.style.setProperty("--demo-header-height", `${Math.round(header.getBoundingClientRect().height)}px`);
    apply();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(apply) : null;
    ro?.observe(header);
    window.addEventListener("resize", apply);
    window.addEventListener("orientationchange", apply);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", apply);
      window.removeEventListener("orientationchange", apply);
    };
  }, []);

  // Per-phase analytics + follow the guided zone on mobile.
  useEffect(() => {
    if (!started) return;
    setMobileTab(phase.focus[0] as ZoneId);
    if (phase.id === "analyse") trackDemoEvent("pierre_demo_plan_revealed", { scenario_id: scenarioId, step_index: phaseIndex });
    else if (phase.id === "organisation") trackDemoEvent("pierre_demo_wow_moment_reached", { scenario_id: scenarioId, step_index: phaseIndex });
    else if (phase.id === "validation") trackDemoEvent("pierre_demo_message_opened", { scenario_id: scenarioId, step_index: phaseIndex });
    if (phase.id === "bilan" && !reachedBilan) {
      setReachedBilan(true);
      setPlaying(false);
      trackDemoEvent("pierre_demo_completed", { scenario_id: scenarioId, completion_percentage: 100, missions_count: scenario.missions.length });
    }
  }, [started, phase.id, phase.focus, phaseIndex, scenarioId, reachedBilan, scenario.missions.length]);

  // Bring the focused zone's spotlight panel into view (scrolls the zone body
  // only — never the page). Keeps the guided phase legible without hunting.
  useEffect(() => {
    if (!started) return;
    const body = bodyRefs[phase.focus[0] as ZoneId].current;
    if (!body) return;
    const raf = requestAnimationFrame(() => {
      const target = body.querySelector<HTMLElement>(`[data-spot="${phase.id}"]`);
      if (!target) { body.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" }); return; }
      const top = target.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop - 8;
      body.scrollTo({ top: Math.max(0, top), behavior: reducedMotion ? "auto" : "smooth" });
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, phase.id, phaseIndex, reducedMotion]);

  // Auto-advance (pausable). Content change, not motion — safe under reduced-motion.
  useEffect(() => {
    if (!started || !playing || isLastPhase(phaseIndex)) return;
    const t = window.setTimeout(() => setPhaseIndex((i) => nextPhase(i)), COCKPIT_PHASE_DWELL_MS[phase.id]);
    return () => window.clearTimeout(t);
  }, [started, playing, phaseIndex, phase.id]);

  const start = useCallback(() => {
    setStarted(true);
    setPhaseIndex(0);
    setPlaying(!reducedMotion);
    trackDemoEvent("pierre_demo_started", { scenario_id: scenarioId });
    trackDemoEvent("pierre_demo_mission_submitted", { scenario_id: scenarioId });
  }, [reducedMotion, scenarioId]);

  const goTo = useCallback((i: number) => setPhaseIndex(clampPhase(i)), []);
  const goNext = useCallback(() => setPhaseIndex((i) => nextPhase(i)), []);
  const goPrev = useCallback(() => setPhaseIndex((i) => prevPhase(i)), []);

  const restart = useCallback(() => {
    setPhaseIndex(0);
    setStarted(false);
    setPlaying(false);
    setReachedBilan(false);
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

  const openTechnologies = useCallback(() => {
    setOpenDocId(TECH_DRAWER);
    trackDemoEvent("pierre_demo_technology_opened", { scenario_id: scenarioId });
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

  const isFocus = (z: ZoneId) => phase.focus.includes(z);

  return (
    <div data-testid="pierre-demo-experience">
      {/* ── Hero — value in < 10s ─────────────────────────────────────────── */}
      <header className="pd-glass pd-animate-rise" style={{ padding: "clamp(20px,4vw,40px)", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          <Chip variant="neutral"><Eye className="h-3.5 w-3.5" aria-hidden /> Cockpit interactif · environ 2 min</Chip>
          <SafetyChip>Aucune communication réelle · aucune donnée modifiée</SafetyChip>
        </div>
        <p className="pd-eyebrow" style={{ marginBottom: 10 }}>Un poste RH opérationnel, pas un chatbot</p>
        <h1 className="pd-display">
          Confiez une semaine RH à Pierre.
          <br />
          <span className="pd-accent">Regardez-le la mener jusqu&apos;au résultat.</span>
        </h1>
        <p className="pd-lede" style={{ marginTop: 12 }}>
          Plusieurs demandes arrivent. Pierre comprend, organise, prépare les documents, demande la seule
          validation qui compte, relance et garde chaque mission active — sous votre contrôle.
        </p>

        {/* Scenario selector */}
        <p className="pd-eyebrow" style={{ margin: "18px 0 10px" }}>Choisissez une situation</p>
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

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
          <button type="button" className="pd-btn pd-btn-primary" onClick={start} data-step-id="hero-start">
            {started ? "Reprendre la semaine" : "Confier la semaine à Pierre"} <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
          <button type="button" className="pd-btn pd-btn-ghost" onClick={openTechnologies} data-step-id="hero-tech">
            <Layers className="h-4 w-4" aria-hidden /> Voir les technologies
          </button>
        </div>
      </header>

      {/* ── The cockpit ───────────────────────────────────────────────────── */}
      <section className="pdc" aria-label="Cockpit de démonstration" data-conversion-demo-cockpit>
        <CockpitTopBar scenario={scenario} phase={phase} counters={counters} />

        {/* Technology at work + prospect question */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {activeTech ? (
            <span className="pdc-metric" style={{ borderColor: "rgba(58,107,116,0.28)", background: "var(--pd-cool-soft)" }}>
              <span className="pd-tech__badge" style={{ width: 22, height: 22, fontSize: "0.6rem" }} aria-hidden>
                {activeTech.name.replace("Clone", "").slice(0, 2)}
              </span>
              <span style={{ fontSize: "0.74rem", color: "var(--pd-ink-2)" }}>
                <strong style={{ color: "var(--pd-cool)" }}>{activeTech.name}</strong> — {activeTech.role}
              </span>
            </span>
          ) : null}
          <span style={{ marginLeft: "auto", fontSize: "0.76rem", color: "var(--pd-ink-4)", fontStyle: "italic" }}>
            {phase.question}
          </span>
        </div>

        {/* Phase progress (progressbar) + clickable phase rail */}
        <div style={{ display: "grid", gap: 8 }}>
          <div
            className="pd-progress"
            role="progressbar"
            aria-valuenow={cockpitCompletion(phaseIndex)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progression de la démonstration"
          >
            {COCKPIT_PHASES.map((p, i) => (
              <span key={p.id} className={`pd-progress__seg ${i < phaseIndex ? "pd-progress__seg--on" : ""} ${i === phaseIndex ? "pd-progress__seg--cur" : ""}`} />
            ))}
          </div>
          <div className="pdc-phaserail" role="tablist" aria-label="Étapes de la semaine">
            {COCKPIT_PHASES.map((p, i) => (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={i === phaseIndex}
                className={`pdc-phase ${i < phaseIndex ? "pdc-phase--done" : ""} ${i === phaseIndex ? "pdc-phase--cur" : ""}`}
                onClick={() => { if (started) goTo(i); else { start(); goTo(i); } }}
                data-step-id={`phase:${p.id}`}
              >
                <span className="pdc-phase__n" aria-hidden>{i + 1}</span>
                {p.title}
              </button>
            ))}
          </div>
        </div>

        {/* Mobile zone tabs */}
        <div className="pdc-tabs" role="tablist" aria-label="Zones du cockpit">
          {([
            { id: "left", label: "Entrées", Icon: Inbox },
            { id: "center", label: "Mission", Icon: ListChecks },
            { id: "right", label: "Livrables", Icon: PackageCheck },
          ] as const).map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={mobileTab === t.id}
              className="pdc-tab"
              onClick={() => setMobileTab(t.id)}
            >
              <t.Icon className="h-4 w-4" aria-hidden /> {t.label}
            </button>
          ))}
        </div>

        {/* The three zones */}
        <div className="pdc-grid">
          {/* LEFT — Entrées & contexte */}
          <section
            className={`pdc-zone ${isFocus("left") ? "pdc-zone--focus" : ""}`}
            data-zone="left"
            data-active={mobileTab === "left" ? "true" : "false"}
            aria-label="Entrées et contexte"
          >
            <div className="pdc-zone__head">
              <span className="pdc-zone__ico" aria-hidden><Inbox className="h-4 w-4" aria-hidden /></span>
              <span>
                <span className="pdc-zone__label">Entrées &amp; contexte</span>
                <span className="pdc-zone__q" style={{ display: "block" }}>Avec quoi Pierre travaille-t-il&nbsp;?</span>
              </span>
            </div>
            <div className="pdc-zone__body" ref={bodyRefs.left}>
              <IncomingRequests scenario={scenario} />
              {revealed(R.analyse) ? <ContextGaps scenario={scenario} /> : <LockedPanel>Le contexte entreprise apparaît à l&apos;analyse.</LockedPanel>}
            </div>
          </section>

          {/* CENTER — Mission & exécution */}
          <section
            className={`pdc-zone ${isFocus("center") ? "pdc-zone--focus" : ""}`}
            data-zone="center"
            data-active={mobileTab === "center" ? "true" : "false"}
            aria-label="Mission et exécution"
          >
            <div className="pdc-zone__head">
              <span className="pdc-zone__ico" aria-hidden><ListChecks className="h-4 w-4" aria-hidden /></span>
              <span>
                <span className="pdc-zone__label">Mission &amp; exécution</span>
                <span className="pdc-zone__q" style={{ display: "block" }}>Que fait Pierre, et pourquoi&nbsp;?</span>
              </span>
            </div>
            <div className="pdc-zone__body" ref={bodyRefs.center}>
              {revealed(R.analyse) ? <MissionUnderstanding scenario={scenario} /> : <LockedPanel>Pierre lit la demande… la compréhension s&apos;affiche à l&apos;analyse.</LockedPanel>}
              {revealed(R.organisation) ? (
                <div data-spot="organisation">
                  <MissionControl scenario={scenario} activeMissionId={activeMissionId} onSelectMission={setActiveMissionId} />
                </div>
              ) : <LockedPanel>Les missions et actions apparaissent à l&apos;organisation.</LockedPanel>}
              {revealed(R.validation) ? <GuardrailMoment scenario={scenario} /> : null}
              {revealed(R.continuite) ? <div data-spot="continuite"><WeekContinuity scenario={scenario} /></div> : null}
            </div>
          </section>

          {/* RIGHT — Livrables, décisions & preuve */}
          <section
            className={`pdc-zone ${isFocus("right") ? "pdc-zone--focus" : ""}`}
            data-zone="right"
            data-active={mobileTab === "right" ? "true" : "false"}
            aria-label="Livrables, décisions et preuve"
          >
            <div className="pdc-zone__head">
              <span className="pdc-zone__ico" aria-hidden><PackageCheck className="h-4 w-4" aria-hidden /></span>
              <span>
                <span className="pdc-zone__label">Livrables &amp; preuve</span>
                <span className="pdc-zone__q" style={{ display: "block" }}>Qu&apos;a réellement produit Pierre&nbsp;?</span>
              </span>
            </div>
            <div className="pdc-zone__body" ref={bodyRefs.right}>
              {revealed(R.execution) ? (
                <>
                  <DeliverablesList scenario={scenario} onOpen={openDocument} />
                  <DemoMessaging scenario={scenario} onOpenDocument={openDocument} />
                </>
              ) : <LockedPanel>Les livrables et messages apparaissent à l&apos;exécution.</LockedPanel>}
              {revealed(R.validation) ? (
                <div data-spot="validation">
                  <DemoApproval
                    scenario={scenario}
                    onOpenDocument={openDocument}
                    onApprovalClick={() => trackDemoEvent("pierre_demo_approval_clicked", { scenario_id: scenarioId })}
                  />
                </div>
              ) : null}
              {revealed(R.execution) ? <CloneTraceTimeline scenario={scenario} /> : null}
              {revealed(R.bilan) ? (
                <div data-spot="bilan">
                  <DemoResult scenario={scenario} />
                  {scenario.roleSplit ? <RoleSplit data={scenario.roleSplit} /> : null}
                </div>
              ) : null}
            </div>
          </section>
        </div>

        {/* Controls — in-flow cockpit footer */}
        <div className="pd-controls pdc-controls" role="group" aria-label="Contrôles de la démonstration">
          <button type="button" className="pd-btn pd-btn-ghost" onClick={goPrev} disabled={phaseIndex === 0} aria-label="Étape précédente">
            <ArrowLeft className="h-4 w-4" aria-hidden /> Précédent
          </button>
          <button type="button" className="pd-btn pd-btn-secondary" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Mettre en pause" : "Lecture automatique"}>
            {playing ? <><Pause className="h-4 w-4" aria-hidden /> Pause</> : <><Play className="h-4 w-4" aria-hidden /> Lecture</>}
          </button>
          <button type="button" className="pd-btn pd-btn-ghost" onClick={goNext} disabled={isLastPhase(phaseIndex)} aria-label="Étape suivante">
            Suivant <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
          <span style={{ flex: 1 }} />
          <span className="pd-eyebrow" aria-hidden>Étape {phaseIndex + 1}/{COCKPIT_PHASE_COUNT}</span>
          <button type="button" className="pd-btn pd-btn-ghost" onClick={restart} aria-label="Recommencer">
            <RotateCcw className="h-4 w-4" aria-hidden /> Recommencer
          </button>
          <button type="button" className="pd-btn pd-btn-ghost" onClick={quitToCta} aria-label="Aller à la réservation">
            <LogOut className="h-4 w-4" aria-hidden /> Quitter
          </button>
        </div>
      </section>

      {/* ── Mid-demo contextual CTA (after execution) ─────────────────────── */}
      {started && phaseIndex >= R.execution && !midCtaDismissed && !reachedBilan ? (
        <div style={{ marginTop: 16 }}>
          <ConversionMoment onContinue={() => { setMidCtaDismissed(true); setPlaying(!reducedMotion); goNext(); }} />
        </div>
      ) : null}

      {/* ── Reassurance line ──────────────────────────────────────────────── */}
      <p className="pdc-note" style={{ marginTop: 16, justifyContent: "center", textAlign: "center" }}>
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden style={{ color: "var(--pd-ok)", flex: "none" }} />
        Pierre ne remplace pas la décision humaine&nbsp;: il prépare le travail et vous sollicite exactement quand un
        arbitrage reste nécessaire.
      </p>

      {/* ── Final CTA ─────────────────────────────────────────────────────── */}
      <div ref={finalRef} id="pd-final" style={{ marginTop: 22, scrollMarginTop: 16 }}>
        <DemoFinalCTA />
      </div>

      {/* ── Document / technology drawer ──────────────────────────────────── */}
      <DemoDrawer
        open={openDocId !== null}
        title={openDocId === TECH_DRAWER ? "Les technologies à l'œuvre" : openDoc?.title ?? ""}
        onClose={() => setOpenDocId(null)}
        scrollResetKey={openDocId ? `${scenarioId}:${openDocId}` : null}
      >
        {openDocId === TECH_DRAWER ? (
          <TechnologyPulse />
        ) : openDoc ? (
          <DemoDocumentViewer key={`${scenarioId}:${openDoc.id}`} doc={openDoc} />
        ) : null}
      </DemoDrawer>
    </div>
  );
}

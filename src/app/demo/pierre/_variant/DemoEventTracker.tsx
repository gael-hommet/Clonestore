"use client";

// BLOC 3 — Tracker d'évènements démo pour /demo/pierre.
//
// Aucun event ne part au simple import ou au montage muet : le tracker n'émet
// que sur ACTION RÉELLE de l'utilisateur (ou sur CustomEvent explicite).
//
// Évènements émis :
//   • landing_viewed       — une fois au montage (clé d'idempotency stable
//                            par session navigateur, pas en re-mount StrictMode).
//   • demo_started         — à la première interaction (click/keydown/scroll).
//   • demo_step_viewed     — sur chaque clic sur un bouton à l'intérieur du
//                            cockpit demo (tab / scenario), dédupé par signature
//                            de bouton, capé à 12 émissions.
//   • demo_completed       — quand au moins 5 étapes distinctes ont été vues
//                            OU sur CustomEvent("clonestore:b3:demo-completed").
//   • purchase_cta_clicked — délégué sur `[data-conversion-cta="purchase"]`.
//   • assistance_cta_clicked — délégué sur `[data-conversion-cta="assistance"]`.

import { useEffect, useRef } from "react";
import { emitConversionEvent, stableEventKey } from "@/lib/clonestore/conversion/client-emitter";
import { emitFounderEvent } from "@/lib/founder-access/funnel-events";
// Canonical Analytics Runtime Wiring — émissions canoniques ADDITIVES (le sink canonique ne lit
// jamais les tables legacy, donc aucun double comptage possible).
import { track, newDemoRunId, currentDemoRunId, currentPageViewId } from "@/lib/analytics/client/track";

const STEP_CAP = 12;
const DEMO_COMPLETED_AFTER_STEPS = 5;

// stepId canonique fermé : jamais textContent, jamais texte libre — on borne au charset autorisé.
function toCanonicalStepId(label: string): string {
  return label.replace(/[^a-zA-Z0-9_:.-]/g, "").slice(0, 64) || "step";
}

export function DemoEventTracker() {
  const startedRef = useRef(false);
  const completedRef = useRef(false);
  const landingEmittedRef = useRef(false);
  const stepsSeenRef = useRef<Set<string>>(new Set());
  // demo_run_id propre au run Pierre. Réutilise le run existant de la session si présent (un
  // rechargement de /demo/pierre conserve le run), sinon en crée un. Insensible au double-montage.
  const runIdRef = useRef<string | null>(null);
  if (runIdRef.current === null && typeof window !== "undefined") {
    runIdRef.current = currentDemoRunId("demo_pierre") ?? newDemoRunId("demo_pierre");
  }

  useEffect(() => {
    if (!landingEmittedRef.current) {
      emitConversionEvent("landing_viewed", {
        idempotencyKey: stableEventKey("landing_viewed:/demo/pierre"),
        metadata: { stage: "demo_landing" },
        sourcePage: "/demo/pierre",
      });
      landingEmittedRef.current = true;
    }

    function markStarted() {
      if (startedRef.current) return;
      startedRef.current = true;
      emitConversionEvent("demo_started", {
        idempotencyKey: stableEventKey("demo_started:/demo/pierre"),
        metadata: { stage: "demo" },
        sourcePage: "/demo/pierre",
      });
      // Funnel commercial (dashboard) : début réel du cockpit Pierre.
      emitFounderEvent("pierre_demo_started", { landingPath: "/demo/pierre" });
      const runId = runIdRef.current;
      if (runId) {
        track("pierre_demo_started", {
          demoRunId: runId,
          pageViewId: currentPageViewId() ?? undefined,
          properties: { demoType: "demo_pierre" },
          dedupeKey: `pierre_demo_started:${runId}`,
        });
      }
    }

    function markCompleted(reason: string) {
      if (completedRef.current) return;
      completedRef.current = true;
      emitConversionEvent("demo_completed", {
        idempotencyKey: stableEventKey("demo_completed:/demo/pierre"),
        metadata: { stage: "demo", reason },
        sourcePage: "/demo/pierre",
      });
      // Funnel commercial (dashboard) : fin réelle du cockpit Pierre.
      emitFounderEvent("pierre_demo_completed", { landingPath: "/demo/pierre" });
      const runId = runIdRef.current;
      if (runId) {
        track("pierre_demo_completed", {
          demoRunId: runId,
          pageViewId: currentPageViewId() ?? undefined,
          properties: { demoType: "demo_pierre" },
          dedupeKey: `pierre_demo_completed:${runId}`,
        });
      }
    }

    function emitStep(label: string) {
      if (stepsSeenRef.current.has(label) || stepsSeenRef.current.size >= STEP_CAP) return;
      const step = stepsSeenRef.current.size + 1;
      stepsSeenRef.current.add(label);
      emitConversionEvent("demo_step_viewed", {
        idempotencyKey: `demo_step_viewed:/demo/pierre:${step}:${label}`,
        metadata: { step, demo_step: label.slice(0, 60) },
        sourcePage: "/demo/pierre",
      });
      const runId = runIdRef.current;
      if (runId) {
        // Une étape comptée une seule fois par run (stepsSeenRef garde l'unicité + dedupeKey).
        track("pierre_demo_step_completed", {
          demoRunId: runId,
          stepId: toCanonicalStepId(label),
          properties: { demoType: "demo_pierre" },
          dedupeKey: `pierre_demo_step_completed:${runId}:${label}`,
        });
      }
      if (stepsSeenRef.current.size >= DEMO_COMPLETED_AFTER_STEPS) markCompleted("threshold_reached");
    }

    function onClick(e: MouseEvent) {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      markStarted();
      // CTA conversion (priorité)
      const cta = t.closest<HTMLElement>("[data-conversion-cta]");
      if (cta) {
        const kind = cta.getAttribute("data-conversion-cta");
        if (kind === "purchase") {
          emitConversionEvent("purchase_cta_clicked", {
            idempotencyKey: `purchase_cta:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 10)}`,
            metadata: { cta: cta.getAttribute("data-cta-name") ?? "" },
            sourcePage: "/demo/pierre",
          });
          // Funnel commercial (dashboard) : clic « Réserver Pierre » depuis le cockpit.
          emitFounderEvent("founder_cta_clicked", { source: "demo_pierre", ctaVariant: cta.getAttribute("data-cta-name") ?? "" });
        } else if (kind === "assistance") {
          emitConversionEvent("assistance_cta_clicked", {
            idempotencyKey: `assistance_cta:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 10)}`,
            metadata: { cta: cta.getAttribute("data-cta-name") ?? "" },
            sourcePage: "/demo/pierre",
          });
        }
        return; // ne pas comptabiliser le CTA achat comme une étape démo
      }
      // Détection d'étape : tout bouton à l'intérieur du panneau cockpit démo.
      const btn = t.closest<HTMLElement>("button");
      if (btn) {
        const inDemo = btn.closest(".cs-panel") || btn.closest("[data-conversion-demo-cockpit]");
        if (inDemo) {
          // DEMO AND MOBILE CONVERSION CLOSURE (2026-07-24) — closed identifier only, never
          // free text: a button without an explicit data-step-id is simply not tracked,
          // rather than falling back to raw textContent (which could capture arbitrary UI
          // copy as analytics metadata). Buttons meant to be tracked already carry
          // data-step-id (PierreDemoExperience.tsx: scenario picker, hero actions, phase rail).
          const label = btn.getAttribute("data-step-id");
          if (label) emitStep(label);
        }
      }
    }

    function onKeydown() {
      markStarted();
    }

    function onStepEvent(e: Event) {
      const detail = (e as CustomEvent).detail as { step?: number; demo_step?: string } | undefined;
      const label = String(detail?.demo_step ?? `step-${detail?.step ?? "?"}`);
      emitStep(label);
    }
    function onCompletedEvent() {
      markCompleted("custom_event");
    }

    window.addEventListener("click", onClick, { passive: true });
    window.addEventListener("keydown", onKeydown, { passive: true });
    window.addEventListener("clonestore:b3:demo-step", onStepEvent as EventListener);
    window.addEventListener("clonestore:b3:demo-completed", onCompletedEvent);
    return () => {
      window.removeEventListener("click", onClick);
      window.removeEventListener("keydown", onKeydown);
      window.removeEventListener("clonestore:b3:demo-step", onStepEvent as EventListener);
      window.removeEventListener("clonestore:b3:demo-completed", onCompletedEvent);
    };
  }, []);

  return null;
}

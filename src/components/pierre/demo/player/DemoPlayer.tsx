"use client";

// PIERRE ZERO-SCROLL DEMO PLAYER — the root state machine + composition.
//
// A single-viewport "mini interactive film": height:100dvh; overflow:hidden; a fixed
// chrome bar + a flex:1 min-height:0 stage that SWAPS between 6 scenes by React state
// (never by scrolling or stacking sections). Level-2 surfaces (Explorer, Infos &
// sécurité) open as modal overlays without ever resetting the scene index.
//
// SAFE: no AI call, no write, no email, no signature, no payment — 100% fictional
// scenario data. Analytics flow only through the existing trackDemoEvent vocabulary
// and the DemoEventTracker delegation (data-conversion-cta / data-step-id).

import { useCallback, useRef } from "react";
import {
  getScenario,
  getDefaultScenario,
  trackDemoEvent,
} from "@/lib/pierre/demo";
import { usePlayer } from "./usePlayer";
import { PLAYER_SCENES, clampScene } from "./player-machine";
import { DemoChrome } from "./DemoChrome";
import { SceneViewport } from "./SceneViewport";
import { Scene1Hook } from "./scenes/Scene1Hook";
import { Scene2Mission } from "./scenes/Scene2Mission";
import { Scene3Plan } from "./scenes/Scene3Plan";
import { Scene4ExecutionValidation } from "./scenes/Scene4ExecutionValidation";
import { Scene5Result } from "./scenes/Scene5Result";
import { Scene6CommercialClose } from "./scenes/Scene6CommercialClose";
import { ExplorerPierre } from "./ExplorerPierre";
import { InfoSecuritySheet } from "./InfoSecuritySheet";

// PRIMARY SCENARIO — "Recruter sans perdre le fil". One clear mission (recruit a
// salesperson) whose request → plan → execution → guardrail → deliverables tell the
// tightest single-mission arc, with the richest, warmest set of real outputs for the
// Result scene. The other real scenarios stay available inside Explorer.
const PRIMARY_SCENARIO_ID = "recrutement";

export function DemoPlayer() {
  const scenario = getScenario(PRIMARY_SCENARIO_ID) ?? getDefaultScenario();
  const p = usePlayer(scenario);
  const scene = PLAYER_SCENES[clampScene(p.index)];

  // Fire "started" once, on the first advance out of the Hook.
  const startedRef = useRef(false);
  const startAndNext = useCallback(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      trackDemoEvent("pierre_demo_started", { scenario_id: scenario.id, step_index: 0 });
    }
    p.next();
  }, [p, scenario.id]);

  return (
    <main
      id="demo-pierre-cockpit"
      data-tour-id="demo-entry"
      data-conversion-demo-cockpit
      className="pd-root pdp-root"
      aria-label="Démonstration interactive de Pierre"
      onTouchStart={p.bindSwipe.onTouchStart}
      onTouchEnd={p.bindSwipe.onTouchEnd}
    >
      <DemoChrome index={p.index} onGoto={p.goto} />

      <SceneViewport sceneId={scene.id} direction={p.direction} reducedMotion={p.reducedMotion}>
        {scene.id === "hook" ? <Scene1Hook scenario={scenario} onNext={startAndNext} /> : null}
        {scene.id === "mission" ? <Scene2Mission scenario={scenario} onNext={p.next} onPrev={p.prev} /> : null}
        {scene.id === "plan" ? <Scene3Plan scenario={scenario} onNext={p.next} onPrev={p.prev} /> : null}
        {scene.id === "execution" ? <Scene4ExecutionValidation scenario={scenario} onNext={p.next} onPrev={p.prev} /> : null}
        {scene.id === "result" ? <Scene5Result scenario={scenario} onNext={p.next} onPrev={p.prev} /> : null}
        {scene.id === "close" ? (
          <Scene6CommercialClose onPrev={p.prev} onExplore={p.openExplorer} onInfo={p.openInfo} />
        ) : null}
      </SceneViewport>

      {p.explorerOpen ? <ExplorerPierre scenario={scenario} onClose={p.closeExplorer} /> : null}
      {p.infoOpen ? <InfoSecuritySheet onClose={p.closeInfo} /> : null}
    </main>
  );
}

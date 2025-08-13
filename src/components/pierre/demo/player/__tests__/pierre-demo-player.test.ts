// PIERRE ZERO-SCROLL DEMO PLAYER — behaviour + structure tests.
//
// The repo runs Vitest in a plain "node" environment (no jsdom / @testing-library),
// so real click-driven layout cannot be measured here — the pixel zero-scroll check
// is the owner's to run in a browser. What we CAN prove without a DOM:
//   • the state machine (scene order, navigation, progress) as pure functions;
//   • each scene renders its title + main content + CTA (renderToStaticMarkup);
//   • the full film composes (chrome + scene 1 + progressbar), with no <table> and a
//     single 100dvh root;
//   • the level-2 Explorer + Infos & sécurité overlays render as labelled dialogs
//     with their migrated content, and opening them never resets the scene index.

import { describe, it, expect } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "fs";
import { join } from "path";
import { getScenario } from "@/lib/pierre/demo";
import {
  DEMO_LAUNCH_LABEL,
} from "@/lib/demo/presentation/commercial-state";
import {
  PLAYER_SCENES,
  SCENE_COUNT,
  clampScene,
  nextScene,
  prevScene,
  isFirstScene,
  isLastScene,
  scenePosition,
  playerCompletion,
} from "../player-machine";
import { DemoPlayer } from "../DemoPlayer";
import { DemoChrome } from "../DemoChrome";
import { Scene1Hook } from "../scenes/Scene1Hook";
import { Scene2Mission } from "../scenes/Scene2Mission";
import { Scene3Plan } from "../scenes/Scene3Plan";
import { Scene4ExecutionValidation } from "../scenes/Scene4ExecutionValidation";
import { Scene5Result } from "../scenes/Scene5Result";
import { Scene6CommercialClose } from "../scenes/Scene6CommercialClose";
import { ExplorerPierre } from "../ExplorerPierre";
import { InfoSecuritySheet } from "../InfoSecuritySheet";

const h = React.createElement;
const render = (el: React.ReactElement) => renderToStaticMarkup(el);
const scenario = getScenario("recrutement")!;
const noop = () => {};

// ── State machine (pure) ──────────────────────────────────────────────────────
describe("player-machine — spine", () => {
  it("declares exactly six scenes in the film order", () => {
    expect(SCENE_COUNT).toBe(6);
    expect(PLAYER_SCENES.map((s) => s.id)).toEqual([
      "hook", "mission", "plan", "execution", "result", "close",
    ]);
  });

  it("next() advances 0→5 and terminates on the commercial close", () => {
    let i = 0;
    for (let guard = 0; guard < 50 && !isLastScene(i); guard++) i = nextScene(i);
    expect(PLAYER_SCENES[i].id).toBe("close");
    expect(isLastScene(i)).toBe(true);
  });

  it("prev() returns to the hook and clamps at both ends", () => {
    let i = 5;
    for (let guard = 0; guard < 50 && !isFirstScene(i); guard++) i = prevScene(i);
    expect(PLAYER_SCENES[i].id).toBe("hook");
    expect(nextScene(5)).toBe(5);
    expect(prevScene(0)).toBe(0);
    expect(clampScene(99)).toBe(5);
    expect(clampScene(-3)).toBe(0);
  });

  it("progress + completion are 1-based and reach 100% on the last scene", () => {
    expect(scenePosition(0)).toBe(1);
    expect(scenePosition(5)).toBe(6);
    expect(playerCompletion(5)).toBe(100);
  });

  it("enter-events map to the documented lifecycle beats only", () => {
    const byId = Object.fromEntries(PLAYER_SCENES.map((s) => [s.id, s.enterEvent]));
    expect(byId.plan).toBe("pierre_demo_plan_revealed");
    expect(byId.execution).toBe("pierre_demo_wow_moment_reached");
    expect(byId.close).toBe("pierre_demo_completed");
  });
});

// ── Per-scene: title + main content + CTA ─────────────────────────────────────
describe("player scenes — each has its title, main content and CTA", () => {
  it("Scene 1 Hook — title, real proof numbers, primary CTA", () => {
    const html = render(h(Scene1Hook, { scenario, onNext: noop }));
    expect(html).toContain("votre employé IA RH");
    expect(html).toContain("Donner une mission à Pierre");
    expect(html).toContain(scenario.name); // real cockpit snapshot
  });

  it("Scene 2 Mission — the real natural-language request + one action", () => {
    const html = render(h(Scene2Mission, { scenario, onNext: noop, onPrev: noop }));
    expect(html).toContain("Confier à Pierre");
    expect(html).toContain(scenario.request.slice(0, 24));
  });

  it("Scene 3 Plan — one sentence, understanding numbers, watch CTA", () => {
    const html = render(h(Scene3Plan, { scenario, onNext: noop, onPrev: noop }));
    expect(html).toContain("Pierre a compris la mission");
    expect(html).toContain("Le regarder travailler");
    expect(html).toContain(String(scenario.understanding.taches));
  });

  it("Scene 4 Execution+Validation — timeline, VALIDATION REQUISE, Valider/Refuser, gated Next", () => {
    const html = render(h(Scene4ExecutionValidation, { scenario, onNext: noop, onPrev: noop }));
    expect(html).toContain("Validation requise");
    expect(html).toContain("Valider");
    expect(html).toContain("Refuser");
    expect(html).toContain(scenario.guardrail.prompt.slice(0, 20));
    // The result CTA is disabled until the prospect makes the human decision.
    expect(html).toMatch(/Voir le résultat[\s\S]*?/);
    expect(html).toContain("disabled");
  });

  it("Scene 5 Result — mission terminée, real deliverables, Sans/Avec comparison", () => {
    const html = render(h(Scene5Result, { scenario, onNext: noop, onPrev: noop }));
    expect(html).toContain("Mission terminée");
    // (apostrophes are HTML-escaped by SSR — assert an apostrophe-free fragment)
    expect(html).toContain("Commercial(e) sédentaire");
    expect(html).toContain("Comparatif candidats");
    expect(html).toContain("Sans Pierre");
    expect(html).toContain("Avec Pierre");
  });

  it("Scene 6 Close — close copy, canonical price + launch, reserve purchase CTA, Explorer", () => {
    const html = render(h(Scene6CommercialClose, { onPrev: noop, onExplore: noop, onInfo: noop }));
    expect(html).toMatch(/est ça, Pierre/);
    expect(html).toContain("449");
    expect(html).toContain(DEMO_LAUNCH_LABEL);
    expect(html).toContain('data-conversion-cta="purchase"');
    expect(html).toContain("/reserver/pierre");
    expect(html).toContain("Explorer Pierre en détail");
  });
});

// ── Full film composes (chrome + scene 1 + accessible progress) ───────────────
describe("DemoPlayer — the whole film composes with no page-scroll surface", () => {
  const html = render(h(DemoPlayer, {}));

  it("renders a single 100dvh root <main> with the cockpit anchor", () => {
    expect(html).toContain("pdp-root");
    expect(html).toContain('id="demo-pierre-cockpit"');
    expect((html.match(/pdp-root/g) ?? []).length).toBe(1);
  });

  it("opens on the Hook scene inside the stage", () => {
    expect(html).toContain('data-scene-id="hook"');
    expect(html).toContain("votre employé IA RH");
  });

  it("exposes an accessible progressbar and a permanent reserve CTA in the chrome", () => {
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="1"');
    expect(html).toContain("Réserver Pierre");
  });

  it("never relies on a table layout", () => {
    expect(html).not.toContain("<table");
  });
});

describe("DemoChrome — six goto dots + progressbar bounds", () => {
  const html = render(h(DemoChrome, { index: 2, onGoto: noop }));
  it("marks the current scene and offers a dot per scene", () => {
    expect((html.match(/pdp-dot/g) ?? []).length).toBeGreaterThanOrEqual(SCENE_COUNT);
    expect(html).toContain('aria-valuenow="3"');
    expect(html).toContain(`aria-valuemax="${SCENE_COUNT}"`);
  });
});

// ── Level-2 Explorer overlay ──────────────────────────────────────────────────
describe("ExplorerPierre — labelled dialog hub with migrated content", () => {
  const html = render(h(ExplorerPierre, { scenario, onClose: noop }));

  it("is a labelled modal dialog with a tablist", () => {
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('role="tablist"');
  });

  it("holds the other real scenarios and the deep-dive sections", () => {
    for (const id of ["semaine_rh", "recrutement", "contrat_sensible"]) {
      expect(getScenario(id)).toBeDefined();
    }
    // all three scenario names surface in the Scénarios tab
    expect(html).toContain("Une semaine RH gérée par Pierre");
    expect(html).toContain("Recruter sans perdre le fil");
    expect(html).toContain("Préparer un contrat sensible");
    // section tabs migrated out of the main flow
    for (const label of ["Gouvernance", "Autonomie", "Technologies", "Livrables"]) {
      expect(html).toContain(label);
    }
  });

  it("opening/closing the Explorer never resets the scene index (independent state)", () => {
    const src = readFileSync(join(process.cwd(), "src/components/pierre/demo/player/usePlayer.ts"), "utf-8");
    // openExplorer/closeExplorer only touch explorerOpen — they must not call setIndex.
    const open = src.slice(src.indexOf("openExplorer"), src.indexOf("closeExplorer"));
    expect(open).not.toMatch(/setIndex/);
    expect(src).toMatch(/closeExplorer = useCallback\(\(\) => setExplorerOpen\(false\)/);
  });
});

// ── Infos & sécurité sheet (legal + safety, never inline) ─────────────────────
describe("InfoSecuritySheet — every legal link + safety notices, one tap away", () => {
  const html = render(h(InfoSecuritySheet, { onClose: noop }));

  it("is a labelled modal dialog", () => {
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
  });

  it("keeps every legal destination reachable (none deleted)", () => {
    for (const href of ["/legal/mentions", "/legal/cgv", "/legal/cgu", "/legal/confidentialite", "/legal/dpa"]) {
      expect(html).toContain(`href="${href}"`);
    }
    expect(html).toContain("Support");
  });

  it("carries the safety notices", () => {
    expect(html).toMatch(/Données fictives/i);
    expect(html).toMatch(/Validation humaine/i);
    expect(html).toMatch(/aucune action réelle/i);
  });
});

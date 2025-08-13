// PIERRE ZERO-SCROLL DEMO PLAYER — pure, side-effect-free state machine.
//
// The player is a single-viewport "mini interactive film" that swaps between six
// scenes by React state (NEVER by scrolling / stacking sections). This module holds
// the deterministic spine — scene order, navigation, progress and per-scene analytics
// mapping — as pure functions so the whole flow is unit-testable without a DOM.
//
// No Date.now()/Math.random()/window here: timing, keyboard, swipe and reduced-motion
// live in the React layer (usePlayer). Analytics event names are taken ONLY from the
// existing PIERRE_DEMO_EVENTS vocabulary (no new tracker, no new event names).

import type { PierreDemoEvent } from "@/lib/pierre/demo";

export type SceneId = "hook" | "mission" | "plan" | "execution" | "result" | "close";

export interface SceneMeta {
  id: SceneId;
  /** 0-based order in the film. */
  index: number;
  /** Short human label for the progress dots (aria). */
  label: string;
  /** The scene's own accessible title (used by tests + aria-label). */
  title: string;
  /**
   * Event emitted WHEN THE SCENE BECOMES ACTIVE, if any. Interaction-driven events
   * (mission_submitted, approval_clicked, document_opened, cta_clicked) are fired by
   * the scenes themselves, not on enter.
   */
  enterEvent: PierreDemoEvent | null;
}

// The six scenes, in order. One idea per scene.
export const PLAYER_SCENES: readonly SceneMeta[] = [
  { id: "hook", index: 0, label: "Accueil", title: "Pierre — votre employé IA RH", enterEvent: null },
  { id: "mission", index: 1, label: "La mission", title: "Confiez une mission à Pierre", enterEvent: null },
  { id: "plan", index: 2, label: "Le plan", title: "Pierre organise le travail", enterEvent: "pierre_demo_plan_revealed" },
  { id: "execution", index: 3, label: "Exécution", title: "Exécution et validation humaine", enterEvent: "pierre_demo_wow_moment_reached" },
  { id: "result", index: 4, label: "Résultat", title: "Mission terminée", enterEvent: null },
  { id: "close", index: 5, label: "Réserver", title: "C'est ça, Pierre", enterEvent: "pierre_demo_completed" },
] as const;

export const SCENE_COUNT = PLAYER_SCENES.length;

export function clampScene(index: number): number {
  if (!Number.isFinite(index) || index < 0) return 0;
  if (index > SCENE_COUNT - 1) return SCENE_COUNT - 1;
  return Math.round(index);
}

export function nextScene(index: number): number {
  return clampScene(index + 1);
}

export function prevScene(index: number): number {
  return clampScene(index - 1);
}

export function isFirstScene(index: number): boolean {
  return clampScene(index) <= 0;
}

export function isLastScene(index: number): boolean {
  return clampScene(index) >= SCENE_COUNT - 1;
}

export function sceneAt(index: number): SceneMeta {
  return PLAYER_SCENES[clampScene(index)];
}

export function sceneIndexById(id: SceneId): number {
  const i = PLAYER_SCENES.findIndex((s) => s.id === id);
  return i < 0 ? 0 : i;
}

/** 1-based position for the progressbar (aria-valuenow). */
export function scenePosition(index: number): number {
  return clampScene(index) + 1;
}

/** Completion percentage of the film at a given scene (1..6 → ~17..100). */
export function playerCompletion(index: number): number {
  return Math.round((scenePosition(index) / SCENE_COUNT) * 100);
}

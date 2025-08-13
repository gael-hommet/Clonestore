"use client";

// PIERRE ZERO-SCROLL DEMO PLAYER — the React state layer over player-machine.ts.
//
// Owns: active scene index (0..5), navigation direction (for the transition), the
// level-2 Explorer overlay + the Infos & sécurité sheet (both independent of the
// scene index — opening/closing them NEVER resets the film), keyboard ←/→, mobile
// swipe, and the reduced-motion preference. Analytics fire on scene ENTER via the
// existing trackDemoEvent (no new tracker, no new event names).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  trackDemoEvent,
  type DemoScenario,
} from "@/lib/pierre/demo";
import {
  PLAYER_SCENES,
  SCENE_COUNT,
  clampScene,
  nextScene,
  prevScene,
  playerCompletion,
} from "./player-machine";

export interface PlayerController {
  index: number;
  direction: 1 | -1;
  reducedMotion: boolean;
  explorerOpen: boolean;
  infoOpen: boolean;
  goto: (i: number) => void;
  next: () => void;
  prev: () => void;
  openExplorer: () => void;
  closeExplorer: () => void;
  openInfo: () => void;
  closeInfo: () => void;
  bindSwipe: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
  };
}

const SWIPE_THRESHOLD_PX = 48;

export function usePlayer(scenario: DemoScenario): PlayerController {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [explorerOpen, setExplorerOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const scenarioId = scenario.id;
  const overlayOpen = explorerOpen || infoOpen;

  // Reduced-motion preference — content must appear instantly and stay fully usable.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);

  const goto = useCallback(
    (target: number) => {
      setIndex((cur) => {
        const clamped = clampScene(target);
        if (clamped !== cur) setDirection(clamped > cur ? 1 : -1);
        return clamped;
      });
    },
    [],
  );

  const next = useCallback(() => {
    setIndex((cur) => {
      const n = nextScene(cur);
      if (n !== cur) setDirection(1);
      return n;
    });
  }, []);

  const prev = useCallback(() => {
    setIndex((cur) => {
      const p = prevScene(cur);
      if (p !== cur) setDirection(-1);
      return p;
    });
  }, []);

  // Fire the scene's enter-event once when it becomes active (deduped per scene id).
  const firedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const scene = PLAYER_SCENES[clampScene(index)];
    if (!scene.enterEvent) return;
    const key = `${scenarioId}:${scene.id}`;
    if (firedRef.current.has(key)) return;
    firedRef.current.add(key);
    trackDemoEvent(scene.enterEvent, {
      scenario_id: scenarioId,
      step_index: scene.index,
      completion_percentage: playerCompletion(index),
    });
  }, [index, scenarioId]);

  // Keyboard ← / → — disabled while an overlay is open or while typing in a field.
  useEffect(() => {
    if (typeof window === "undefined") return;
    function onKey(e: KeyboardEvent) {
      if (overlayOpen) return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || t?.isContentEditable) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [overlayOpen, next, prev]);

  // Mobile swipe — a secondary method (buttons + keyboard remain primary).
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const bindSwipe = useMemo(
    () => ({
      onTouchStart: (e: React.TouchEvent) => {
        const tch = e.changedTouches[0];
        touchStartX.current = tch.clientX;
        touchStartY.current = tch.clientY;
      },
      onTouchEnd: (e: React.TouchEvent) => {
        if (overlayOpen) return;
        const startX = touchStartX.current;
        const startY = touchStartY.current;
        touchStartX.current = null;
        touchStartY.current = null;
        if (startX === null || startY === null) return;
        const tch = e.changedTouches[0];
        const dx = tch.clientX - startX;
        const dy = tch.clientY - startY;
        // Horizontal, deliberate swipes only — never hijack a vertical gesture.
        if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) < Math.abs(dy) * 1.4) return;
        if (dx < 0) next();
        else prev();
      },
    }),
    [overlayOpen, next, prev],
  );

  const openExplorer = useCallback(() => {
    setExplorerOpen(true);
    trackDemoEvent("pierre_demo_technology_opened", { scenario_id: scenarioId });
  }, [scenarioId]);
  const closeExplorer = useCallback(() => setExplorerOpen(false), []);
  const openInfo = useCallback(() => setInfoOpen(true), []);
  const closeInfo = useCallback(() => setInfoOpen(false), []);

  return {
    index,
    direction,
    reducedMotion,
    explorerOpen,
    infoOpen,
    goto,
    next,
    prev,
    openExplorer,
    closeExplorer,
    openInfo,
    closeInfo,
    bindSwipe,
  };
}

export { SCENE_COUNT };

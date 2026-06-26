"use client";

// CloneStory — Expérience d'entrée cinématographique (FONDATION).
//
// Jouée UNIQUEMENT à la première visite (mémorisée dans localStorage). Un visiteur
// récurrent ne subit aucun ralentissement : l'overlay n'est jamais monté pour lui.
//
// Hydration-safe : le premier rendu (serveur + première frame client) n'affiche
// AUCUN overlay → identique côté serveur et client. L'overlay n'apparaît qu'après
// montage, et seulement si la 1ʳᵉ visite n'a pas encore été enregistrée.
//
// prefers-reduced-motion : aucune séquence animée — la page est révélée
// immédiatement (et la visite est marquée pour rester cohérent).
//
// Bouton discret pour passer. Architecture volontairement sobre (Bloc 1) :
// fondation propre, sans sur-polissage des animations.

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { INTRO_SEQUENCE } from "@/lib/clonestory/founding-partners/vocabulary";

const STORAGE_KEY = "clonestory.foundingPartners.introSeen.v1";

/** Durées (ms) — lentes, maîtrisées. */
const FADE = 900;
const HOLD = 1900;
const GAP = 350;

type Phase = "idle" | "playing" | "leaving" | "done";

export default function FoundingIntro({
  children,
  /** Permet de forcer la lecture (ex. « revoir l'introduction » — futur Bloc). */
  forcePlay = false,
}: {
  children: ReactNode;
  forcePlay?: boolean;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [lineIndex, setLineIndex] = useState(0);
  const [lineVisible, setLineVisible] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  const markSeen = useCallback(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    } catch {
      /* localStorage indisponible (mode privé) — on n'empêche jamais l'accès. */
    }
  }, []);

  const finish = useCallback(() => {
    clearTimers();
    markSeen();
    setPhase("leaving");
    const t = setTimeout(() => setPhase("done"), FADE);
    timers.current.push(t);
  }, [clearTimers, markSeen]);

  // Décision de lecture — seulement après montage (hydration-safe).
  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    let alreadySeen = false;
    try {
      alreadySeen = !!window.localStorage.getItem(STORAGE_KEY);
    } catch {
      alreadySeen = false;
    }

    if (forcePlay) {
      setPhase("playing");
      return;
    }
    if (alreadySeen || reduced) {
      // Récurrent ou mouvement réduit → aucune séquence, révélation immédiate.
      if (reduced && !alreadySeen) markSeen();
      setPhase("done");
      return;
    }
    setPhase("playing");
  }, [forcePlay, markSeen]);

  // Orchestration de la séquence ligne par ligne.
  useEffect(() => {
    if (phase !== "playing") return;
    clearTimers();
    setLineVisible(false);

    // fade-in
    const inT = setTimeout(() => setLineVisible(true), 60);
    // fade-out après lecture
    const outT = setTimeout(() => setLineVisible(false), 60 + FADE + HOLD);
    // étape suivante
    const nextT = setTimeout(() => {
      if (lineIndex >= INTRO_SEQUENCE.length - 1) {
        finish();
      } else {
        setLineIndex((i) => i + 1);
      }
    }, 60 + FADE + HOLD + FADE + GAP);

    timers.current.push(inT, outT, nextT);
    return clearTimers;
  }, [phase, lineIndex, clearTimers, finish]);

  useEffect(() => clearTimers, [clearTimers]);

  // L'overlay est porté dans <body> (hors de .cs-main, qui est un contexte
  // d'empilement à z-index:2 dans globals.css) afin de recouvrir entièrement
  // l'écran — header global compris — pendant la 1ʳᵉ visite. Le wrapper porte
  // `data-clonestory` (pour le scope CSS) en `display:contents` (aucune boîte).
  const overlayActive = phase === "playing" || phase === "leaving";
  const overlay =
    overlayActive && typeof document !== "undefined"
      ? createPortal(
          <div data-clonestory="" style={{ display: "contents" }}>
            <div
              className={phase === "leaving" ? "csy-intro csy-intro--leaving" : "csy-intro"}
              role="dialog"
              aria-label="Introduction"
              aria-live="polite"
            >
              <p className="csy-intro__line" data-visible={lineVisible ? "true" : "false"}>
                {INTRO_SEQUENCE[lineIndex]}
              </p>
              <button type="button" className="csy-intro__skip" onClick={finish}>
                Passer
              </button>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {children}
      {overlay}
    </>
  );
}

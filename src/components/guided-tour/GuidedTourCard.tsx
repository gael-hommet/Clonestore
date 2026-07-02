"use client";

// Carte du guided tour (P9.1).
// Bulle de texte au-dessus du site : eyebrow (progression), titre, corps,
// contrôles. Le PLACEMENT (top/left/côté) est calculé par l'orchestrateur
// (source de vérité unique partagée avec le pointeur) ; la carte se contente de
// se positionner et de REMONTER sa taille mesurée pour affiner le placement.
// Gère le focus (dialog) et un focus-trap au Tab. Transitions fluides
// (entrée + sortie), respect du mouvement réduit.

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import type { KeyboardEvent } from "react";
import { motion } from "framer-motion";
import type {
  CardPlacement,
  Size,
  TourProgressView,
  TourStep,
  TourStepAction,
} from "@/lib/guided-tour";
import { GuidedTourControls } from "./GuidedTourControls";

const EASE = [0.22, 1, 0.36, 1] as const;

const FOCUSABLE =
  'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function GuidedTourCard({
  step,
  placement,
  progress,
  isFirst,
  isLast,
  reduced,
  onMeasure,
  onPrev,
  onNext,
  onSkip,
  onFinish,
  onAction,
}: {
  step: TourStep;
  placement: CardPlacement;
  progress: TourProgressView;
  isFirst: boolean;
  isLast: boolean;
  reduced: boolean;
  onMeasure: (size: Size) => void;
  onPrev: () => void;
  onNext: () => void;
  onSkip: () => void;
  onFinish: () => void;
  onAction: (action: TourStepAction) => void;
}) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const lastSize = useRef<Size>({ width: 0, height: 0 });

  // Mesure de la carte → remontée au provider (qui recalcule placement + ancre
  // du pointeur). Ne remonte que si la taille change réellement (pas de boucle).
  const measure = useCallback(() => {
    const el = cardRef.current;
    if (!el) return;
    const width = el.offsetWidth;
    const height = el.offsetHeight;
    if (width !== lastSize.current.width || height !== lastSize.current.height) {
      lastSize.current = { width, height };
      onMeasure({ width, height });
    }
  }, [onMeasure]);

  useLayoutEffect(() => {
    measure();
  }, [measure, step.id]);

  // Focus sur la carte à chaque étape (dialog).
  useEffect(() => {
    cardRef.current?.focus();
  }, [step.id]);

  // Focus-trap minimal au Tab (garde le focus dans la carte).
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    const root = cardRef.current;
    if (!root) return;
    const focusables = Array.from(
      root.querySelectorAll<HTMLElement>(FOCUSABLE),
    ).filter((node) => node.offsetParent !== null || node === root);
    if (focusables.length === 0) {
      event.preventDefault();
      root.focus();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (event.shiftKey && (active === first || active === root)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <motion.div
      ref={cardRef}
      className={`csgt-card csgt-card--${placement.placement}`}
      style={{ top: placement.top, left: placement.left }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="csgt-card-title"
      aria-describedby="csgt-card-body"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      initial={reduced ? false : { opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
      transition={{ duration: reduced ? 0 : 0.36, ease: EASE }}
    >
      <p className="csgt-card__eyebrow">
        Étape {progress.current} / {progress.total}
      </p>
      <h2 id="csgt-card-title" className="csgt-card__title">
        {step.title}
      </h2>
      <p id="csgt-card-body" className="csgt-card__body">
        {step.body}
      </p>

      <GuidedTourControls
        progress={progress}
        isFirst={isFirst}
        isLast={isLast}
        actions={step.actions}
        onPrev={onPrev}
        onNext={onNext}
        onSkip={onSkip}
        onFinish={onFinish}
        onAction={onAction}
      />
    </motion.div>
  );
}

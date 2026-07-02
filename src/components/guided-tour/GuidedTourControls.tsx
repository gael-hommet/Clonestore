"use client";

// Contrôles du guided tour (P9.1).
// Progression (points), navigation précédent/suivant, passer/terminer, et actions
// optionnelles d'étape (CTA de l'étape finale). Boutons accessibles au clavier.

import type { TourStepAction } from "@/lib/guided-tour";
import type { TourProgressView } from "@/lib/guided-tour";
import { cn } from "@/lib/utils";

export function GuidedTourControls({
  progress,
  isFirst,
  isLast,
  actions,
  onPrev,
  onNext,
  onSkip,
  onFinish,
  onAction,
}: {
  progress: TourProgressView;
  isFirst: boolean;
  isLast: boolean;
  actions?: readonly TourStepAction[];
  onPrev: () => void;
  onNext: () => void;
  onSkip: () => void;
  onFinish: () => void;
  onAction: (action: TourStepAction) => void;
}) {
  const hasActions = !!actions && actions.length > 0;

  return (
    <div className="csgt-controls">
      <div className="csgt-dots" aria-hidden="true">
        {Array.from({ length: progress.total }).map((_, index) => (
          <span
            key={index}
            className={cn("csgt-dot", index + 1 === progress.current && "csgt-dot--active")}
          />
        ))}
      </div>

      {hasActions ? (
        <div className="csgt-actions">
          {actions!.map((action) => (
            <button
              key={action.label}
              type="button"
              className={cn(
                "csgt-btn",
                action.variant === "primary" && "csgt-btn--primary",
                action.variant === "secondary" && "csgt-btn--secondary",
                (action.variant === "ghost" || !action.variant) && "csgt-btn--ghost",
              )}
              onClick={() => onAction(action)}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="csgt-nav">
          <button type="button" className="csgt-btn csgt-btn--ghost" onClick={onSkip}>
            Passer
          </button>

          <div className="csgt-nav__spacer" />

          {!isFirst ? (
            <button type="button" className="csgt-btn csgt-btn--secondary" onClick={onPrev}>
              Précédent
            </button>
          ) : null}

          {isLast ? (
            <button type="button" className="csgt-btn csgt-btn--primary" onClick={onFinish}>
              Terminer
            </button>
          ) : (
            <button type="button" className="csgt-btn csgt-btn--primary" onClick={onNext}>
              Suivant
            </button>
          )}
        </div>
      )}
    </div>
  );
}

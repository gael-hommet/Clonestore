"use client";

// PIERRE ZERO-SCROLL DEMO PLAYER — shared level-2 overlay shell.
// A labelled modal dialog with correct focus management and Escape-to-close, whose
// body is the ONLY scroll container (bounded internal scroll — allowed here). Used by
// both ExplorerPierre and the Infos & sécurité sheet. Opening/closing an overlay never
// touches the scene index (that state lives in the player, above this component).

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export function PlayerOverlay({
  title,
  tag,
  onClose,
  narrow = false,
  children,
}: {
  title: string;
  tag?: string;
  onClose: () => void;
  narrow?: boolean;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    restoreRef.current = (document.activeElement as HTMLElement) ?? null;
    panelRef.current?.focus({ preventScroll: true });

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);

    // Lock the (already non-scrolling) page behind the overlay for good measure.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      restoreRef.current?.focus?.({ preventScroll: true });
    };
  }, [onClose]);

  return (
    <div className="pdp-overlay" role="presentation" onClick={onClose}>
      <div
        ref={panelRef}
        className={`pdp-sheet${narrow ? " pdp-sheet--narrow" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pdp-sheet__head">
          <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
            <h2 className="pdp-sheet__title">{title}</h2>
            {tag ? <span className="pdp-sheet__tag">{tag}</span> : null}
          </div>
          <button
            type="button"
            className="pd-btn pd-btn-ghost"
            style={{ marginLeft: "auto", minHeight: 36, padding: "0 10px" }}
            onClick={onClose}
            aria-label="Fermer"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="pdp-sheet__body">{children}</div>
      </div>
    </div>
  );
}

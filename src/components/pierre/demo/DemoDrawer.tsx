"use client";

// PIERRE FINAL INTERACTIVE DEMO — accessible side drawer.
// Used for opening documents and the capability explorer in exploration mode.

import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export function DemoDrawer({
  open,
  title,
  onClose,
  children,
  scrollResetKey,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Changes whenever a new document/content is shown — drives the scroll reset. */
  scrollResetKey?: string | number | null;
}) {
  // `.pd-drawer` is the single vertical scroll container of the panel.
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    // move focus into the panel for keyboard users — without scrolling it
    panelRef.current?.focus({ preventScroll: true });
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Always reveal a freshly opened / changed document from its very top.
  // Runs on open and whenever the content key changes (document or scenario),
  // after the new content has been laid out, so the panel never inherits a
  // stale scroll position.
  useLayoutEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    panel.scrollTop = 0;
    const raf = requestAnimationFrame(() => {
      if (panelRef.current) panelRef.current.scrollTop = 0;
    });
    return () => cancelAnimationFrame(raf);
  }, [open, scrollResetKey]);

  if (!open) return null;

  return (
    <div
      className="pd-drawer-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={panelRef}
        className="pd-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        data-testid="demo-drawer"
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <h2 className="pd-h2" style={{ fontSize: "1.1rem" }}>{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="pd-btn pd-btn-ghost"
            style={{ marginLeft: "auto", minHeight: 36, padding: "0 10px" }}
            aria-label="Fermer"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

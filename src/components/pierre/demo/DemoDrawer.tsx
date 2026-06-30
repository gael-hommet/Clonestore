"use client";

// PIERRE FINAL INTERACTIVE DEMO — accessible side drawer.
// Single shared panel used to open EVERY document (avenants, offres, contrats,
// checklists, courriers…) and the capability explorer in exploration mode.
//
// Layout contract (see pierre-demo.css):
//   • The backdrop starts exactly below the fixed site topbar
//     (top: var(--demo-header-height)) so the topbar stays visible/interactive
//     and the document is never hidden behind it.
//   • The panel is a flex column: a non-shrinking head (title + close) that is
//     always visible, then ONE scrollable body — no double scroll.

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
  const panelRef = useRef<HTMLDivElement>(null);
  // `.pd-drawer__body` is the single vertical scroll container of the panel.
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    // move focus into the panel for keyboard users — without scrolling anything
    panelRef.current?.focus({ preventScroll: true });

    // Lock background scroll while the document is open, compensating for the
    // scrollbar width so the page (and the sticky topbar) does not jump.
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    const prevOverflow = document.body.style.overflow;
    const prevPadRight = document.body.style.paddingRight;
    document.body.style.overflow = "hidden";
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPadRight;
    };
  }, [open, onClose]);

  // Always reveal a freshly opened / changed document from its very top.
  // Runs on open and whenever the content key changes (document or scenario),
  // after the new content has been laid out, so the panel never inherits a
  // stale scroll position.
  useLayoutEffect(() => {
    if (!open) return;
    const body = bodyRef.current;
    if (!body) return;
    body.scrollTop = 0;
    const raf = requestAnimationFrame(() => {
      if (bodyRef.current) bodyRef.current.scrollTop = 0;
    });
    return () => cancelAnimationFrame(raf);
  }, [open, scrollResetKey]);

  if (!open) return null;

  return (
    <div className="pd-drawer-backdrop" onClick={onClose} role="presentation">
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
        <div className="pd-drawer__head">
          <h2 className="pd-h2" style={{ fontSize: "1.1rem", margin: 0 }}>{title}</h2>
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
        <div className="pd-drawer__body" ref={bodyRef}>
          {children}
        </div>
      </div>
    </div>
  );
}

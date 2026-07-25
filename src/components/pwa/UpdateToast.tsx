"use client";

import { RefreshCw, X } from "lucide-react";
import { PWA_COPY } from "@/lib/pwa/constants";

/**
 * Bandeau discret « nouvelle version disponible ». La mise à jour n'est JAMAIS
 * appliquée brutalement : elle attend le clic « Mettre à jour » (consentement),
 * puis le service worker prend le contrôle et la page se recharge.
 */
export function UpdateToast({
  onUpdate,
  onDismiss,
}: {
  onUpdate: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      className="fixed inset-x-0 top-0 z-[75] flex justify-center px-3"
      style={{ paddingTop: "calc(10px + env(safe-area-inset-top, 0px))" }}
    >
      <div
        className="pointer-events-auto flex w-full max-w-[30rem] items-center gap-3 rounded-full border border-[color:rgba(21,25,34,0.12)] bg-[color:var(--cs-surface-strong,rgba(255,255,255,0.86))] py-2 pl-4 pr-2 shadow-[0_16px_44px_rgba(21,25,34,0.18)] backdrop-blur-xl"
        role="status"
      >
        <RefreshCw className="size-4 shrink-0 text-[color:var(--cs-ink-2,#29313d)]" />
        <span className="min-w-0 flex-1 truncate text-[0.86rem] font-medium text-[color:var(--cs-ink-1,#151922)]">
          {PWA_COPY.updateTitle}
        </span>
        <button
          type="button"
          onClick={onUpdate}
          className="inline-flex h-8 items-center rounded-full bg-[color:var(--cs-ink-1,#151922)] px-3.5 text-[0.8rem] font-semibold text-white transition hover:opacity-90"
        >
          {PWA_COPY.updateCta}
        </button>
        <button
          type="button"
          aria-label="Ignorer"
          onClick={onDismiss}
          className="grid size-8 shrink-0 place-items-center rounded-full text-[color:var(--cs-ink-3,#5c6675)] transition hover:bg-white/60"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}

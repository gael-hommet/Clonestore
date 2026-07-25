"use client";

import { Download, X, Smartphone } from "lucide-react";
import { PWA_COPY } from "@/lib/pwa/constants";

/**
 * Carte flottante d'installation (non agressive). S'affiche en bas, respecte les
 * safe-areas, se ferme, et ne réapparaît pas pendant le cooldown (géré par le hook).
 * Sert aussi de mini-onboarding : message rassurant + geste unique.
 */
export function InstallPrompt({
  onInstall,
  onDismiss,
  busy,
}: {
  onInstall: () => void;
  onDismiss: () => void;
  busy?: boolean;
}) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[70] flex justify-center px-3"
      style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))" }}
    >
      <div
        className="pointer-events-auto w-full max-w-[30rem] rounded-[22px] border border-[color:var(--cs-line-soft,rgba(21,25,34,0.12))] bg-[color:var(--cs-surface-strong,rgba(255,255,255,0.82))] p-3.5 shadow-[0_22px_60px_rgba(21,25,34,0.20)] backdrop-blur-xl"
        role="dialog"
        aria-label="Installer CloneStore"
      >
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-[color:rgba(21,25,34,0.10)] bg-white">
            <Smartphone className="size-5 text-[color:var(--cs-ink-1,#151922)]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[color:var(--cs-ink-3,#5c6675)]">
              {PWA_COPY.onboarding.step1}
            </p>
            <h2 className="mt-0.5 truncate text-[0.98rem] font-semibold tracking-[-0.02em] text-[color:var(--cs-ink-1,#151922)]">
              {PWA_COPY.installCta}
            </h2>
            <p className="mt-1 text-[0.84rem] leading-snug text-[color:var(--cs-ink-3,#5c6675)]">
              {PWA_COPY.installSubtext}
            </p>
          </div>
          <button
            type="button"
            aria-label="Plus tard"
            onClick={onDismiss}
            className="grid size-8 shrink-0 place-items-center rounded-full border border-[color:rgba(21,25,34,0.10)] bg-white/60 text-[color:var(--cs-ink-2,#29313d)] transition hover:bg-white"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={onInstall}
            disabled={busy}
            className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full text-[0.9rem] font-semibold tracking-[-0.01em] text-white shadow-[0_16px_34px_rgba(21,25,34,0.20)] transition hover:-translate-y-px disabled:pointer-events-none disabled:opacity-60"
            style={{
              background:
                "linear-gradient(135deg, #151922 0%, #52647c 48%, #6f83a6 100%)",
            }}
          >
            <Download className="size-4" />
            {busy ? "Installation…" : PWA_COPY.installCta}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex h-10 items-center justify-center rounded-full border border-[color:rgba(21,25,34,0.12)] bg-white/50 px-4 text-[0.85rem] font-medium text-[color:var(--cs-ink-2,#29313d)] transition hover:bg-white/80"
          >
            Plus tard
          </button>
        </div>
      </div>
    </div>
  );
}

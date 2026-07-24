"use client";

import { ArrowRight, X, Sparkles } from "lucide-react";

/**
 * Carte flottante discrète invitant vers la démo — jamais affichée au premier pixel,
 * jamais modale (aucune superposition, aucun backdrop). Même scaffolding d'accessibilité
 * que src/components/pwa/InstallPrompt.tsx (role="dialog" non-modal, dismiss keyboard-safe,
 * safe-area aware) pour rester cohérente avec la seule autre carte flottante du site.
 */
export function DemoContextualPromptCard({
  onOpenDemo,
  onDismiss,
}: {
  onOpenDemo: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[70] flex justify-center px-3 motion-reduce:transition-none"
      style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))" }}
    >
      <div
        className="pointer-events-auto w-full max-w-[26rem] rounded-[22px] border border-[color:var(--cs-line-soft,rgba(21,25,34,0.12))] bg-[color:var(--cs-surface-strong,rgba(255,255,255,0.86))] p-3.5 shadow-[0_22px_60px_rgba(21,25,34,0.20)] backdrop-blur-xl"
        role="dialog"
        aria-label="Invitation à voir la démonstration de Pierre"
      >
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-[color:rgba(21,25,34,0.10)] bg-white">
            <Sparkles className="size-5 text-[color:var(--cs-violet,#6f83ff)]" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[0.98rem] font-semibold tracking-[-0.02em] text-[color:var(--cs-ink-1,#151922)]">
              Voir Pierre travailler
            </p>
            <p className="mt-1 text-[0.84rem] leading-snug text-[color:var(--cs-ink-3,#5c6675)]">
              Une démonstration interactive, sans engagement.
            </p>
          </div>
          <button
            type="button"
            aria-label="Fermer l'invitation"
            onClick={onDismiss}
            className="grid size-8 shrink-0 place-items-center rounded-full border border-[color:rgba(21,25,34,0.10)] bg-white/60 text-[color:var(--cs-ink-2,#29313d)] transition hover:bg-white"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenDemo}
            className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full text-[0.9rem] font-semibold tracking-[-0.01em] text-white shadow-[0_16px_34px_rgba(21,25,34,0.20)] transition hover:-translate-y-px"
            style={{
              background:
                "linear-gradient(135deg, #151922 0%, #52647c 48%, #6f83a6 100%)",
            }}
          >
            Voir la démonstration
            <ArrowRight className="size-4" aria-hidden="true" />
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

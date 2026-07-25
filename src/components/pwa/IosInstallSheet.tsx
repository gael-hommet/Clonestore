"use client";

import { Share, Plus, X } from "lucide-react";
import { PWA_COPY } from "@/lib/pwa/constants";

/**
 * Feuille d'instructions iOS (Safari). iOS n'expose aucun prompt d'installation
 * programmatique : on explique le geste Partager → « Sur l'écran d'accueil ».
 * On ne prétend JAMAIS déclencher l'installation automatiquement.
 */
export function IosInstallSheet({
  open,
  onClose,
  isSafari,
}: {
  open: boolean;
  onClose: () => void;
  isSafari: boolean;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Installer CloneStore sur iPhone ou iPad"
    >
      <button
        type="button"
        aria-label="Fermer"
        onClick={onClose}
        className="absolute inset-0 bg-[rgba(21,25,34,0.32)] backdrop-blur-[2px]"
      />
      <div
        className="relative w-full max-w-[30rem] rounded-t-[26px] border border-[color:var(--cs-line-soft,rgba(21,25,34,0.12))] bg-[color:var(--cs-bg,#f8f4ec)] px-5 pt-4 shadow-[0_-20px_60px_rgba(21,25,34,0.22)]"
        style={{ paddingBottom: "calc(20px + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-[rgba(21,25,34,0.16)]" aria-hidden="true" />
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[1.05rem] font-semibold tracking-[-0.02em] text-[color:var(--cs-ink-1,#151922)]">
              Installer sur votre écran d&apos;accueil
            </h2>
            <p className="mt-1 text-[0.86rem] leading-relaxed text-[color:var(--cs-ink-3,#5c6675)]">
              {PWA_COPY.installSubtext}
            </p>
          </div>
          <button
            type="button"
            aria-label="Fermer"
            onClick={onClose}
            className="grid size-8 shrink-0 place-items-center rounded-full border border-[color:rgba(21,25,34,0.12)] bg-white/60 text-[color:var(--cs-ink-2,#29313d)] transition hover:bg-white"
          >
            <X className="size-4" />
          </button>
        </div>

        {!isSafari && (
          <p className="mb-3 rounded-2xl border border-[color:rgba(21,25,34,0.10)] bg-white/60 px-3 py-2 text-[0.8rem] leading-relaxed text-[color:var(--cs-ink-3,#5c6675)]">
            {PWA_COPY.iosOpenInSafari}
          </p>
        )}

        <ol className="flex flex-col gap-2.5">
          <Step index={1} icon={<Share className="size-4" />}>
            {PWA_COPY.iosSteps[0]}
          </Step>
          <Step index={2} icon={<Plus className="size-4" />}>
            {PWA_COPY.iosSteps[1]}
          </Step>
          <Step index={3}>{PWA_COPY.iosSteps[2]}</Step>
        </ol>
      </div>
    </div>
  );
}

function Step({
  index,
  icon,
  children,
}: {
  index: number;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-[color:rgba(21,25,34,0.08)] bg-white/55 px-3 py-2.5">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[color:var(--cs-ink-1,#151922)] text-[0.78rem] font-semibold text-white">
        {index}
      </span>
      <span className="flex items-center gap-2 text-[0.9rem] text-[color:var(--cs-ink-1,#151922)]">
        {icon}
        {children}
      </span>
    </li>
  );
}

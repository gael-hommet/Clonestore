"use client";

// P9.3 — Composer : confier une mission réelle à Pierre. Réutilise le vrai chemin
// de création (submitPierreMission, idempotency key stable). Double-clic → une
// seule requête (bouton bloqué pendant la mutation). Réseau ambigu → « Vérification
// de la création… » puis reprise, jamais de double envoi automatique.

import { useEffect, useRef, useState } from "react";
import { Loader2, Send, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CreateMissionResult } from "@/app/agents/pierre/use/hooks/useOperationalCockpit";

const EXAMPLES = [
  "Prépare le contrat CDI de Marie Dupont (poste : chargée RH, début le 1er septembre).",
  "Rédige un e-mail de relance pour les candidats sans réponse depuis 10 jours.",
  "Prépare la checklist d'onboarding d'un nouveau développeur senior.",
];

export function MissionComposer({
  open,
  mutating,
  onClose,
  onCreate,
  initialValue = "",
}: {
  open: boolean;
  mutating: boolean;
  onClose: () => void;
  onCreate: (input: string) => Promise<CreateMissionResult>;
  /** Amorce optionnelle (ex. message CloneRoom « en faire une mission »). Vide = comportement inchangé. */
  initialValue?: string;
}) {
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "uncertain">("idle");
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  // Amorce : quand le composer s'ouvre AVEC une amorce (message CloneRoom), on préremplit.
  // Sans amorce (initialValue vide), aucun effet → comportement P9.3 strictement inchangé.
  useEffect(() => {
    if (open && initialValue) setInput(initialValue);
  }, [open, initialValue]);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    textareaRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && status !== "submitting") onClose();
      if (e.key === "Tab" && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>('button, textarea, [href], input, [tabindex]:not([tabindex="-1"])');
        if (focusables.length === 0) return;
        const first = focusables[0], last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prevOverflow; prev?.focus?.(); };
  }, [open, status, onClose]);

  if (!open) return null;

  const submit = async () => {
    if (status === "submitting" || mutating) return; // garde double-clic
    setError(null);
    setStatus("submitting");
    const res = await onCreate(input);
    if (res.ok) { setInput(""); setStatus("idle"); onClose(); return; }
    if (res.uncertain) { setStatus("uncertain"); return; }
    setStatus("idle");
    setError(res.error ?? "La mission n'a pas pu être créée.");
  };

  const busy = status === "submitting" || mutating;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" role="presentation">
      <button type="button" aria-label="Fermer" className="absolute inset-0 bg-[rgba(16,20,28,0.42)] backdrop-blur-sm" onClick={() => !busy && onClose()} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="composer-title"
        className="relative z-[61] w-full max-w-lg cs-panel p-5 sm:rounded-[1.6rem]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="cs-eyebrow">Nouvelle mission</p>
            <h2 id="composer-title" className="text-[1.1rem] font-semibold tracking-[-0.03em] text-[var(--cs-ink-1)]">Confier une mission à Pierre</h2>
          </div>
          <button type="button" onClick={() => !busy && onClose()} aria-label="Fermer" className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--cs-line-soft)] bg-white/58 text-[var(--cs-ink-2)]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <label className="mt-4 block space-y-2">
          <span className="text-[0.84rem] font-medium text-[var(--cs-ink-2)]">Que souhaitez-vous confier à Pierre ?</span>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={4}
            placeholder="Décrivez la mission en une ou deux phrases…"
            aria-describedby={error ? "composer-error" : undefined}
            aria-invalid={!!error}
            className="min-h-[110px] w-full rounded-[1.1rem] border border-[var(--cs-line-soft)] bg-white/60 px-4 py-3 text-[0.9rem] leading-6 text-[var(--cs-ink-1)] outline-none focus-visible:border-[var(--cs-violet)]"
          />
        </label>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" onClick={() => setInput(ex)} className="rounded-full border border-[var(--cs-line-soft)] bg-white/50 px-2.5 py-1 text-left text-[0.72rem] text-[var(--cs-ink-3)] hover:bg-white/80">
              <Sparkles className="mr-1 inline h-3 w-3 text-[var(--cs-violet)]" />{ex.slice(0, 42)}…
            </button>
          ))}
        </div>

        {status === "uncertain" ? (
          <p role="status" aria-live="polite" className="mt-3 flex items-center gap-2 text-[0.82rem] text-[var(--cs-warn)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Vérification de la création… Consultez la liste des missions ; réessayez si elle n'apparaît pas.
          </p>
        ) : null}
        {error ? <p id="composer-error" role="alert" className="mt-3 text-[0.82rem] text-[var(--cs-danger)]">{error}</p> : null}

        <div className="mt-4 flex items-center justify-end gap-2">
          <button type="button" onClick={() => !busy && onClose()} className="cs-liquid-button" disabled={busy}>
            <span>Annuler</span>
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy || input.trim().length === 0}
            aria-disabled={busy || input.trim().length === 0}
            className={cn("cs-liquid-button cs-liquid-button--primary", (busy || input.trim().length === 0) && "pointer-events-none opacity-60")}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            <span>{busy ? "Envoi à Pierre…" : "Confier à Pierre"}</span>
          </button>
        </div>
        <p className="mt-2 text-[0.72rem] text-[var(--cs-ink-4)]">Pierre analysera la demande et vous proposera un plan. Rien n'est exécuté sans votre validation.</p>
      </div>
    </div>
  );
}

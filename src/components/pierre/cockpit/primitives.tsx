"use client";

// P9.3 — Primitives d'affichage du cockpit opérationnel (design --cs-*).
// Aucune donnée brute, aucun ID technique exposé. Réutilisables par les 6 vues.

import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Clock3, Loader2, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CockpitStatusView, CockpitTone, CockpitUrgency } from "@/lib/client-cockpit";

export function toneClass(tone: CockpitTone): string {
  switch (tone) {
    case "success": return "cs-status cs-status--success";
    case "warning": return "cs-status cs-status--warn";
    case "danger": return "cs-status cs-status--danger";
    case "info":
    case "progress": return "cs-status cs-status--info";
    default: return "cs-status";
  }
}

export function StatusChip({ view, className }: { view: CockpitStatusView; className?: string }) {
  return <span className={cn(toneClass(view.tone), className)}>{view.label}</span>;
}

const URGENCY_LABEL: Record<CockpitUrgency, string> = {
  critical: "Critique", high: "Prioritaire", normal: "Normal", low: "Faible",
};
export function UrgencyBadge({ urgency }: { urgency: CockpitUrgency }) {
  if (urgency === "normal" || urgency === "low") return null;
  return (
    <span className={cn("cs-status", urgency === "critical" ? "cs-status--danger" : "cs-status--warn")}>
      {urgency === "critical" ? <ShieldAlert className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
      {URGENCY_LABEL[urgency]}
    </span>
  );
}

/** Date lisible fr, avec « il y a » calculé côté client (pas d'ID technique). */
export function RelativeTime({ iso, className }: { iso: string | null; className?: string }) {
  if (!iso) return <span className={cn("text-[var(--cs-ink-4)]", className)}>—</span>;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return <span className={cn("text-[var(--cs-ink-4)]", className)}>—</span>;
  const label = d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  return <time dateTime={iso} className={cn("text-[var(--cs-ink-4)]", className)}>{label}</time>;
}

export function ProgressBar({ value, label }: { value: number; label?: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-[rgba(24,29,39,0.08)]"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? "Progression"}
      >
        <div className="h-full rounded-full bg-[var(--cs-violet)] transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[0.72rem] tabular-nums text-[var(--cs-ink-4)]">{pct}%</span>
    </div>
  );
}

export function SectionShell({
  eyebrow, title, description, right, children, tourId, className,
}: {
  eyebrow?: string; title?: string; description?: string; right?: ReactNode;
  children: ReactNode; tourId?: string; className?: string;
}) {
  return (
    <section data-tour-id={tourId} className={cn("cs-panel p-5", className)}>
      <div className="flex flex-col gap-4">
        {(eyebrow || title || right) && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1">
              {eyebrow ? <p className="cs-eyebrow">{eyebrow}</p> : null}
              {title ? <p className="text-[1.05rem] font-semibold tracking-[-0.03em] text-[var(--cs-ink-1)]">{title}</p> : null}
              {description ? <p className="text-[0.86rem] leading-6 text-[var(--cs-ink-3)]">{description}</p> : null}
            </div>
            {right ? <div className="shrink-0">{right}</div> : null}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}

export function EmptyView({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="rounded-[1.25rem] border border-[var(--cs-line-soft)] bg-white/30 px-5 py-8 text-center">
      <div className="mx-auto flex max-w-md flex-col items-center gap-3">
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--cs-line-soft)] bg-white/58 text-[var(--cs-violet)]">
          <CheckCircle2 className="h-5 w-5" />
        </div>
        <p className="text-[0.98rem] font-semibold text-[var(--cs-ink-1)]">{title}</p>
        <p className="text-[0.85rem] leading-6 text-[var(--cs-ink-3)]">{text}</p>
        {action ? <div className="pt-1">{action}</div> : null}
      </div>
    </div>
  );
}

export function LoadingView({ label = "Chargement…" }: { label?: string }) {
  return (
    <div className="flex min-h-[30vh] items-center justify-center gap-3 text-[var(--cs-ink-3)]" role="status" aria-live="polite">
      <Loader2 className="h-5 w-5 animate-spin" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-[1.25rem] border border-[var(--cs-danger)]/30 bg-[var(--cs-danger-bg)] px-5 py-6" role="alert">
      <div className="flex flex-col items-start gap-3">
        <div className="flex items-center gap-2 text-[var(--cs-danger)]">
          <AlertTriangle className="h-4 w-4" />
          <p className="text-[0.92rem] font-semibold">{message}</p>
        </div>
        {onRetry ? (
          <button type="button" onClick={onRetry} className="cs-liquid-button">
            <Loader2 className="h-4 w-4" /><span>Réessayer</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function StaleBanner({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-full border border-[var(--cs-line-soft)] bg-white/40 px-3 py-1.5" aria-live="polite">
      <span className="flex items-center gap-2 text-[0.78rem] text-[var(--cs-ink-4)]">
        <Clock3 className="h-3.5 w-3.5" />
        Informations peut-être datées.
      </span>
      <button type="button" onClick={onRefresh} className="text-[0.78rem] font-semibold text-[var(--cs-violet)] hover:underline">
        Actualiser
      </button>
    </div>
  );
}

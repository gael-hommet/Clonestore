// src/app/agents/pierre/use/components/PierreStatusBadges.tsx
// Reusable status, risk, and flag badges — Pierre Cockpit B31.1.
// No emojis. Lucide icons only. CloneStore design DNA.

import { AlertTriangle, Lock, Mail, ShieldAlert, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { taskStatusView } from "@/lib/client-cockpit/status";
import type { CockpitTone } from "@/lib/client-cockpit/types";

// ── Status Badge ────────────────────────────────────────────────

// P16E §5 (F32) — libellés d'affichage locaux (style) UNIQUEMENT pour les statuts connus. Tout
// statut ABSENT de cette table NE DOIT PAS être affiché brut en anglais : on délègue alors au
// PRÉSENTATEUR CANONIQUE (client-cockpit/status.ts) — source de vérité unique, jamais un second
// cerveau de statut — qui rend un libellé français (ou « Inconnu »), jamais l'état interne brut.
const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  done:         { label: "Terminé",      cls: "cs-badge-success" },
  completed:    { label: "Terminé",      cls: "cs-badge-success" },
  running:      { label: "En cours",     cls: "cs-badge-blue" },
  queued:       { label: "En attente",   cls: "cs-badge-warn" },
  pending:      { label: "Planifié",     cls: "cs-badge-warn" },
  blocked:      { label: "Bloqué",       cls: "cs-badge-danger" },
  failed:       { label: "Échec",        cls: "cs-badge-danger" },
  cancelled:    { label: "Annulé",       cls: "cs-badge-muted" },
  error:        { label: "Erreur",       cls: "cs-badge-danger" },
  draft:        { label: "Brouillon",    cls: "cs-badge-muted" },
  approved:     { label: "Approuvé",     cls: "cs-badge-success" },
  skipped:      { label: "Ignoré",       cls: "cs-badge-muted" },
  ready:        { label: "Prêt",         cls: "cs-badge-success" },
  almost_ready: { label: "Presque prêt", cls: "cs-badge-warn" },
};

const TONE_TO_CLS: Record<CockpitTone, string> = {
  success: "cs-badge-success", progress: "cs-badge-blue", info: "cs-badge-blue",
  warning: "cs-badge-warn", danger: "cs-badge-danger", neutral: "cs-badge-muted",
};

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const known = STATUS_MAP[status?.toLowerCase()];
  // Statut connu → style local ; sinon → présentateur canonique (jamais d'anglais brut).
  const entry = known ?? (() => {
    const view = taskStatusView(status);
    return { label: view.label, cls: TONE_TO_CLS[view.tone] ?? "cs-badge-muted" };
  })();
  return (
    <span className={cn("cs-badge", entry.cls, className)}>
      {entry.label}
    </span>
  );
}

// ── Risk Badge ──────────────────────────────────────────────────

const RISK_MAP: Record<string, { label: string; cls: string }> = {
  low:      { label: "Faible",   cls: "cs-badge-success" },
  normal:   { label: "Normal",   cls: "cs-badge-muted" },
  medium:   { label: "Moyen",    cls: "cs-badge-warn" },
  high:     { label: "Élevé",    cls: "cs-badge-danger" },
  critical: { label: "Critique", cls: "cs-badge-danger" },
};

export function RiskBadge({
  level,
  className,
}: {
  level: string;
  className?: string;
}) {
  const entry = RISK_MAP[level?.toLowerCase()] ?? { label: level ?? "—", cls: "cs-badge-muted" };
  if (entry.cls === "cs-badge-muted" || entry.cls === "cs-badge-success") return null;
  return (
    <span className={cn("cs-badge inline-flex items-center gap-1", entry.cls, className)}>
      <ShieldAlert className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
      {entry.label}
    </span>
  );
}

// ── Validation Required Badge ───────────────────────────────────

export function ValidationRequiredBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn("cs-badge cs-badge-warn inline-flex items-center gap-1", className)}
      title="Validation humaine requise"
    >
      <ShieldCheck className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
      Validation requise
    </span>
  );
}

// ── Sensitive Badge ─────────────────────────────────────────────

export function SensitiveBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn("cs-badge cs-badge-danger inline-flex items-center gap-1", className)}
      title="Action sensible — validation obligatoire"
    >
      <Lock className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
      Sensible
    </span>
  );
}

// ── Email Badge ─────────────────────────────────────────────────

export function EmailTaskBadge({ className }: { className?: string }) {
  return (
    <span className={cn("cs-badge cs-badge-blue inline-flex items-center gap-1", className)}>
      <Mail className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
      Email
    </span>
  );
}

// ── Alert badge ─────────────────────────────────────────────────

export function AlertBadge({ label, className }: { label: string; className?: string }) {
  return (
    <span className={cn("cs-badge cs-badge-warn inline-flex items-center gap-1", className)}>
      <AlertTriangle className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
      {label}
    </span>
  );
}

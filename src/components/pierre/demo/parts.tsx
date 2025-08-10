"use client";

// PIERRE FINAL INTERACTIVE DEMO — shared presentational primitives.
// Pure, dependency-light. Status mapping is centralized so every surface
// renders the same label/tone/icon for a given work state.

import type { ReactNode } from "react";
import {
  CheckCircle2,
  Clock,
  Activity,
  HelpCircle,
  ShieldAlert,
  Ban,
  Lock,
} from "lucide-react";
import type { WorkStatus } from "@/lib/pierre/demo";

export interface StatusMeta {
  label: string;
  /** scoped class tone suffix */
  tone: "done" | "progress" | "waiting" | "validation" | "scheduled" | "blocked";
  Icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
}

const STATUS_META: Record<WorkStatus, StatusMeta> = {
  done: { label: "Fait", tone: "done", Icon: CheckCircle2 },
  in_progress: { label: "En cours", tone: "progress", Icon: Activity },
  waiting_info: { label: "Info attendue", tone: "waiting", Icon: HelpCircle },
  awaiting_validation: { label: "Validation requise", tone: "validation", Icon: ShieldAlert },
  scheduled: { label: "Planifié", tone: "scheduled", Icon: Clock },
  blocked: { label: "Bloqué", tone: "blocked", Icon: Ban },
};

export function statusMeta(status: WorkStatus): StatusMeta {
  return STATUS_META[status];
}

/** Status mark: icon + text (never color-only — accessibility). */
export function StatusMark({ status }: { status: WorkStatus }) {
  const { label, tone, Icon } = STATUS_META[status];
  return (
    <span className={`pd-status pd-status--${tone}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </span>
  );
}

export function Chip({
  children,
  variant = "neutral",
}: {
  children: ReactNode;
  variant?: "neutral" | "cool" | "ok" | "warn" | "block";
}) {
  const cls = variant === "neutral" ? "pd-chip" : `pd-chip pd-chip--${variant}`;
  return <span className={cls}>{children}</span>;
}

export function SafetyChip({ children }: { children: ReactNode }) {
  return (
    <span className="pd-chip pd-chip--ok">
      <Lock className="h-3 w-3" aria-hidden />
      {children}
    </span>
  );
}

export interface ProofItem {
  value: number | string;
  label: string;
}

export function ProofGrid({ items, columns = 4 }: { items: ProofItem[]; columns?: 3 | 4 }) {
  return (
    <div className={columns === 3 ? "pd-grid-3" : "pd-grid-4"}>
      {items.map((it, i) => (
        <div key={i} className="pd-card pd-stat">
          <div className="pd-stat__value">{it.value}</div>
          <div className="pd-stat__label">{it.label}</div>
        </div>
      ))}
    </div>
  );
}

/** Honest disclosure note, used wherever a capability is shown. */
export function DemoNote({ children }: { children: ReactNode }) {
  return (
    <p className="pd-lede" style={{ fontSize: "0.78rem", color: "var(--pd-ink-4)", display: "flex", gap: 7, alignItems: "flex-start" }}>
      <Lock className="h-3.5 w-3.5" aria-hidden style={{ marginTop: 2, flex: "none" }} />
      <span>{children}</span>
    </p>
  );
}

export function StepHeading({ eyebrow, title, caption }: { eyebrow: string; title: string; caption?: string }) {
  return (
    <header style={{ display: "grid", gap: 6, marginBottom: 14 }}>
      <p className="pd-eyebrow">{eyebrow}</p>
      <h2 className="pd-h2">{title}</h2>
      {caption ? <p className="pd-lede">{caption}</p> : null}
    </header>
  );
}

/**
 * Numbered narration heading — the single component that makes the top→bottom
 * story ("01 · Promesse", "02 · Valeur"…) instantly perceptible. `headingLevel`
 * lets a beat sit under the page h1 as an h2 while staying visually consistent.
 */
export function BeatHeading({
  n,
  eyebrow,
  title,
  caption,
  align = "start",
}: {
  n: string;
  eyebrow: string;
  title: string;
  caption?: string;
  align?: "start" | "center";
}) {
  return (
    <header className={`pd-beat${align === "center" ? " pd-beat--center" : ""}`}>
      <span className="pd-beat__n" aria-hidden>{n}</span>
      <div className="pd-beat__text">
        <p className="pd-eyebrow">{eyebrow}</p>
        <h2 className="pd-h2">{title}</h2>
        {caption ? <p className="pd-lede">{caption}</p> : null}
      </div>
    </header>
  );
}

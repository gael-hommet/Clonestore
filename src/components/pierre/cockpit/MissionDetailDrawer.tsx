"use client";

// P9.3 — Détail mission (drawer deep-linkable, accessible clavier). Objectif,
// résumé compris, statut, progression, tâches, validations (décidables), documents,
// activité. Aucun ID technique, aucun JSON brut.

import { useEffect, useRef } from "react";
import { Ban, FileText, Loader2, Mail, ShieldCheck, Users2, Workflow, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MissionDetail, DecisionKind } from "@/app/agents/pierre/use/hooks/useOperationalCockpit";
import { LoadingView, ProgressBar, RelativeTime, StatusChip, UrgencyBadge } from "./primitives";
import { ValidationCard } from "./ValidationsView";
import { ActivityView } from "./ActivityView";

export function MissionDetailDrawer({
  detail,
  loading,
  mutating,
  canCancel,
  onClose,
  onDecide,
  onCancelMission,
}: {
  detail: MissionDetail | null;
  loading: boolean;
  mutating: boolean;
  canCancel: boolean;
  onClose: () => void;
  onDecide: (id: string, version: number, kind: DecisionKind) => Promise<{ ok: boolean; error?: string; stale?: boolean }>;
  onCancelMission: (missionId: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prevOverflow; prev?.focus?.(); };
  }, [onClose]);

  const m = detail?.mission;
  const pendingValidations = detail?.validations.filter((v) => v.status === "pending") ?? [];

  return (
    <div className="fixed inset-0 z-[55] flex justify-end" role="presentation">
      <button type="button" aria-label="Fermer le détail" className="absolute inset-0 bg-[rgba(16,20,28,0.42)] backdrop-blur-sm" onClick={onClose} />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={m ? `Mission : ${m.title}` : "Détail de la mission"}
        className="relative z-[56] flex h-full w-full max-w-xl flex-col overflow-hidden border-l border-[var(--cs-line-soft)] bg-[var(--cs-bg,#f6f7fb)] shadow-2xl outline-none"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[var(--cs-line-soft)] bg-white/60 px-5 py-4">
          <div className="min-w-0 space-y-1.5">
            <p className="cs-eyebrow">Mission</p>
            <h2 className="truncate text-[1.05rem] font-semibold tracking-[-0.03em] text-[var(--cs-ink-1)]">{m?.title ?? "Mission"}</h2>
            {m ? (
              <div className="flex flex-wrap items-center gap-2">
                <StatusChip view={m.statusView} />
                <UrgencyBadge urgency={m.urgency} />
                {m.employee ? <span className="cs-status"><Users2 className="h-3.5 w-3.5" />{m.employee.name}</span> : null}
              </div>
            ) : null}
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--cs-line-soft)] bg-white/58 text-[var(--cs-ink-2)]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {loading && !detail ? (
            <LoadingView label="Chargement de la mission…" />
          ) : !detail || !m ? (
            <p className="py-8 text-center text-[0.86rem] text-[var(--cs-ink-4)]">Cette mission n'est plus disponible.</p>
          ) : (
            <>
              {m.summary ? (
                <section className="cs-card cs-card-tight">
                  <p className="cs-eyebrow mb-1">Ce que Pierre a compris</p>
                  <p className="text-[0.88rem] leading-6 text-[var(--cs-ink-2)]">{m.summary}</p>
                </section>
              ) : null}

              <section className="cs-card cs-card-tight">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[0.84rem] font-medium text-[var(--cs-ink-2)]">Progression</p>
                  <span className="text-[0.76rem] text-[var(--cs-ink-4)]">{m.tasksDone}/{m.tasksTotal} tâches</span>
                </div>
                <div className="mt-2"><ProgressBar value={m.progress} label="Progression de la mission" /></div>
              </section>

              {/* Validations à décider */}
              {pendingValidations.length > 0 && (
                <section className="space-y-2">
                  <p className="cs-eyebrow flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5" />Validations en attente</p>
                  {pendingValidations.map((v) => (
                    <ValidationCard key={v.id} v={v} mutating={mutating} onDecide={onDecide} onOpenMission={() => {}} />
                  ))}
                </section>
              )}

              {/* Tâches */}
              <section className="space-y-2">
                <p className="cs-eyebrow flex items-center gap-2"><Workflow className="h-3.5 w-3.5" />Tâches</p>
                {detail.tasks.length === 0 ? (
                  <p className="text-[0.82rem] text-[var(--cs-ink-4)]">Pierre construit encore le plan.</p>
                ) : (
                  <ul className="grid gap-2">
                    {detail.tasks.map((t) => (
                      <li key={t.id} className="cs-card cs-card-tight">
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex min-w-0 items-center gap-2">
                            {t.isEmail ? <Mail className="h-3.5 w-3.5 text-[var(--cs-ink-4)]" /> : <FileText className="h-3.5 w-3.5 text-[var(--cs-ink-4)]" />}
                            <span className="truncate text-[0.84rem] text-[var(--cs-ink-2)]">{t.title}</span>
                          </span>
                          <StatusChip view={t.statusView} />
                        </div>
                        {t.blockedReason ? <p className="mt-1 text-[0.76rem] text-[var(--cs-danger)]">{t.blockedReason}</p> : null}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Documents */}
              {detail.artifacts.length > 0 && (
                <section className="space-y-2">
                  <p className="cs-eyebrow flex items-center gap-2"><FileText className="h-3.5 w-3.5" />Documents</p>
                  <ul className="grid gap-2">
                    {detail.artifacts.map((d) => (
                      <li key={d.id} className="cs-card cs-card-tight flex items-center justify-between gap-2">
                        <span className="truncate text-[0.84rem] text-[var(--cs-ink-2)]">{d.title}</span>
                        <StatusChip view={d.statusView} />
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Activité */}
              <ActivityView events={detail.timeline} contextLabel={m.title} />

              {/* Annuler la mission */}
              {canCancel && m.status !== "done" && m.status !== "cancelled" && (
                <div className="pt-2">
                  <button
                    type="button"
                    disabled={mutating}
                    onClick={() => onCancelMission(m.id)}
                    className={cn("cs-liquid-button", mutating && "pointer-events-none opacity-60")}
                  >
                    {mutating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
                    <span>Annuler la mission</span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

// P9.3 — Validations humaines : file réelle, décisions gouvernées, confirmation
// pour les actions sensibles/irréversibles. Version courante = verrou optimiste.
// Aucune validation automatique. Trace visible dans Activité après décision.

import { useState } from "react";
import { Check, Loader2, Mail, ShieldAlert, Users2, X, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CockpitValidation } from "@/lib/client-cockpit";
import type { DecisionKind } from "@/app/agents/pierre/use/hooks/useOperationalCockpit";
import { EmptyView, RelativeTime, SectionShell, StatusChip, UrgencyBadge } from "./primitives";

export function ValidationsView({
  validations,
  mutating,
  onDecide,
  onOpenMission,
}: {
  validations: readonly CockpitValidation[];
  mutating: boolean;
  onDecide: (id: string, version: number, kind: DecisionKind) => Promise<{ ok: boolean; error?: string; stale?: boolean }>;
  onOpenMission: (missionId: string) => void;
}) {
  const pending = validations.filter((v) => v.status === "pending");

  return (
    <SectionShell
      eyebrow="Validations"
      description="Ce que Pierre veut faire et qui attend votre décision. Rien n'est exécuté sans votre accord."
      tourId="pierre-validations"
    >
      {pending.length === 0 ? (
        <EmptyView
          title="Aucune validation en attente."
          text="Lorsque Pierre a besoin de votre accord — un envoi, un document sensible — la demande apparaît ici."
        />
      ) : (
        <ul className="grid gap-3">
          {pending.map((v) => (
            <li key={v.id}>
              <ValidationCard v={v} mutating={mutating} onDecide={onDecide} onOpenMission={onOpenMission} />
            </li>
          ))}
        </ul>
      )}
    </SectionShell>
  );
}

export function ValidationCard({
  v, mutating, onDecide, onOpenMission,
}: {
  v: CockpitValidation;
  mutating: boolean;
  onDecide: (id: string, version: number, kind: DecisionKind) => Promise<{ ok: boolean; error?: string; stale?: boolean }>;
  onOpenMission: (missionId: string) => void;
}) {
  const [confirm, setConfirm] = useState<DecisionKind | null>(null);
  const [busy, setBusy] = useState<DecisionKind | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const version = v.version ?? 1;

  const run = async (kind: DecisionKind) => {
    setBusy(kind);
    setMsg(null);
    const res = await onDecide(v.id, version, kind);
    setBusy(null);
    setConfirm(null);
    if (!res.ok) setMsg(res.error ?? "La décision n'a pas pu être enregistrée.");
  };

  const request = (kind: DecisionKind) => {
    // Confirmation pour tout refus / demande de modifications, et pour une
    // approbation sensible (garde d'irréversibilité — voir P9_3_RUNTIME_CONTRACT_GAPS GAP-1).
    if (kind === "approve" && !v.isSensitive) return void run("approve");
    setConfirm(kind);
  };

  const disabled = mutating || busy !== null;

  return (
    <div className={cn("cs-card cs-card-tight border-l-4", v.isSensitive ? "border-l-[var(--cs-danger)]" : "border-l-[var(--cs-warn)]")}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[0.95rem] font-semibold text-[var(--cs-ink-1)]">{v.intent}</p>
              <StatusChip view={v.statusView} />
              <UrgencyBadge urgency={v.urgency} />
              {v.isSensitive ? <span className="cs-status cs-status--danger"><ShieldAlert className="h-3.5 w-3.5" />Sensible</span> : null}
              {v.isEmail ? <span className="cs-status"><Mail className="h-3.5 w-3.5" />Envoi</span> : null}
            </div>
            {v.reason ? <p className="text-[0.84rem] leading-6 text-[var(--cs-ink-3)]">{v.reason}</p> : null}
            <div className="flex flex-wrap items-center gap-3 text-[0.76rem] text-[var(--cs-ink-4)]">
              {v.employee ? <span className="inline-flex items-center gap-1"><Users2 className="h-3.5 w-3.5" />{v.employee.name}</span> : null}
              <RelativeTime iso={v.createdAt} />
              {v.missionId ? (
                <button type="button" onClick={() => onOpenMission(v.missionId!)} className="font-medium text-[var(--cs-violet)] hover:underline">
                  Voir la mission
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {msg ? <p role="alert" className="text-[0.8rem] text-[var(--cs-danger)]">{msg}</p> : null}

        {confirm ? (
          <div className="rounded-[1rem] border border-[var(--cs-line-soft)] bg-white/55 p-3" role="group" aria-label="Confirmer la décision">
            <p className="text-[0.84rem] text-[var(--cs-ink-2)]">
              {confirm === "approve" && "Confirmer l'approbation de cette action sensible ? Pierre pourra l'exécuter."}
              {confirm === "reject" && "Confirmer le refus ? Cette action ne sera pas exécutée."}
              {confirm === "request_changes" && "Renvoyer à Pierre pour modifications ? Il retravaillera cette action."}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={disabled}
                onClick={() => run(confirm)}
                className={cn("cs-liquid-button cs-liquid-button--primary", disabled && "pointer-events-none opacity-60")}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                <span>Confirmer</span>
              </button>
              <button type="button" disabled={disabled} onClick={() => setConfirm(null)} className="cs-liquid-button">
                <span>Annuler</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 pt-1">
            {v.actions.map((a) => {
              const kind = a.kind as DecisionKind;
              const icon = a.kind === "approve" ? <Check className="h-4 w-4" /> : a.kind === "reject" ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />;
              return (
                <button
                  key={a.kind}
                  type="button"
                  disabled={disabled || !a.allowed}
                  aria-disabled={disabled || !a.allowed}
                  title={a.allowed ? undefined : a.reason}
                  onClick={() => request(kind)}
                  className={cn(
                    a.kind === "approve" ? "cs-liquid-button cs-liquid-button--primary" : "cs-liquid-button",
                    (disabled || !a.allowed) && "pointer-events-none opacity-50",
                  )}
                >
                  {busy === kind ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
                  <span>{a.label}</span>
                </button>
              );
            })}
          </div>
        )}
        {v.actions.some((a) => !a.allowed) ? (
          <p className="text-[0.74rem] text-[var(--cs-ink-4)]">{v.actions.find((a) => !a.allowed)?.reason}</p>
        ) : null}
      </div>
    </div>
  );
}

// src/app/agents/pierre/use/components/PierreValidationCenter.tsx
// Human validation center — Pierre Cockpit B31.1.
// No emojis. Never auto-executes sensitive tasks.

"use client";

import * as React from "react";
import { Check, ShieldAlert, ShieldCheck, X } from "lucide-react";
import type {
  PierreCockpitValidationSummary,
  PierreCockpitActionResult,
} from "@/lib/pierre/cockpit/types";
import { RiskBadge, SensitiveBadge, EmailTaskBadge } from "./PierreStatusBadges";
import { EmptyState } from "./PierreEmptyStates";
import { cn } from "@/lib/utils";

function ValidationCard({
  item,
  onApprove,
  onCancel,
}: {
  item: PierreCockpitValidationSummary;
  onApprove: (id: string) => Promise<PierreCockpitActionResult>;
  onCancel: (id: string) => Promise<PierreCockpitActionResult>;
}) {
  const [busy, setBusy] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<"approved" | "refused" | "error" | null>(null);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  async function handle(action: "approve" | "cancel") {
    setBusy(action);
    setErrorMsg(null);
    try {
      const fn = action === "approve" ? onApprove : onCancel;
      const res = await fn(item.taskId);
      if (res.ok) {
        setResult(action === "approve" ? "approved" : "refused");
      } else {
        setErrorMsg(res.error ?? "Une erreur est survenue.");
      }
    } finally {
      setBusy(null);
    }
  }

  if (result === "approved") {
    return (
      <div
        className="flex items-center gap-3 rounded-xl px-4 py-3"
        style={{ background: "var(--cs-success-bg)", border: "1px solid rgba(21,130,96,0.12)" }}
      >
        <Check className="h-4 w-4 shrink-0" style={{ color: "var(--cs-success)" }} />
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--cs-success)" }}>Approuvée</p>
          <p className="text-xs" style={{ color: "var(--cs-ink-4)" }}>{item.title}</p>
        </div>
      </div>
    );
  }

  if (result === "refused") {
    return (
      <div
        className="flex items-center gap-3 rounded-xl px-4 py-3"
        style={{ background: "var(--cs-danger-bg)", border: "1px solid rgba(184,74,74,0.12)" }}
      >
        <X className="h-4 w-4 shrink-0" style={{ color: "var(--cs-danger)" }} />
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--cs-danger)" }}>Refusée</p>
          <p className="text-xs" style={{ color: "var(--cs-ink-4)" }}>{item.title}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: "rgba(255,255,255,0.68)",
        border: "1px solid rgba(255,255,255,0.62)",
        boxShadow: "0 2px 12px rgba(18,24,36,0.06), inset 0 1px 0 rgba(255,255,255,0.78)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm" style={{ color: "var(--cs-ink-1)" }}>
            {item.title}
          </p>
          {item.type && (
            <p className="mt-0.5 text-xs" style={{ color: "var(--cs-ink-4)" }}>
              Type : {item.type}
            </p>
          )}
          {item.reason && (
            <p
              className="mt-1.5 text-xs rounded-lg px-2.5 py-1.5"
              style={{ background: "var(--cs-warn-bg)", color: "var(--cs-warn)" }}
            >
              {item.reason}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <RiskBadge level={item.riskLevel} />
          {item.isSensitive && <SensitiveBadge />}
          {item.isEmailTask && <EmailTaskBadge />}
        </div>
      </div>

      {item.requiresHuman && (
        <div
          className="mt-2.5 flex items-start gap-2 rounded-lg px-3 py-2 text-xs"
          style={{ background: "var(--cs-warn-bg)", color: "var(--cs-warn)" }}
        >
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Validation humaine obligatoire. Pierre ne lancera aucune action sans votre accord.
        </div>
      )}

      {errorMsg && (
        <p className="mt-1.5 text-xs" style={{ color: "var(--cs-danger)" }}>
          {errorMsg}
        </p>
      )}

      <div
        className="mt-3 flex gap-2 border-t pt-3"
        style={{ borderColor: "rgba(24,29,39,0.07)" }}
      >
        <button
          onClick={() => handle("approve")}
          disabled={!!busy}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all",
            busy ? "opacity-40" : "hover:opacity-80 active:scale-[0.98]",
          )}
          style={{ background: "var(--cs-success-bg)", color: "var(--cs-success)" }}
          aria-label={`Approuver : ${item.title}`}
        >
          {busy === "approve" ? (
            <span className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          Approuver
        </button>
        <button
          onClick={() => handle("cancel")}
          disabled={!!busy}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all",
            busy ? "opacity-40" : "hover:opacity-80 active:scale-[0.98]",
          )}
          style={{ background: "var(--cs-danger-bg)", color: "var(--cs-danger)" }}
          aria-label={`Refuser : ${item.title}`}
        >
          {busy === "cancel" ? (
            <span className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
          ) : (
            <X className="h-3.5 w-3.5" />
          )}
          Refuser
        </button>
      </div>
    </div>
  );
}

export function PierreValidationCenter({
  validations,
  onApprove,
  onCancel,
}: {
  validations: PierreCockpitValidationSummary[];
  onApprove: (id: string) => Promise<PierreCockpitActionResult>;
  onCancel: (id: string) => Promise<PierreCockpitActionResult>;
}) {
  if (validations.length === 0) {
    return (
      <EmptyState
        icon={<ShieldCheck className="h-5 w-5" aria-hidden="true" />}
        title="Aucune validation en attente"
        subtitle="Les actions nécessitant votre approbation apparaîtront ici."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        className="flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-sm"
        style={{ background: "var(--cs-warn-bg)", color: "var(--cs-warn)" }}
      >
        <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
        {validations.length} action{validations.length > 1 ? "s" : ""} nécessite{validations.length > 1 ? "nt" : ""} votre approbation
      </div>
      {validations.map((v) => (
        <ValidationCard
          key={v.taskId}
          item={v}
          onApprove={onApprove}
          onCancel={onCancel}
        />
      ))}
    </div>
  );
}

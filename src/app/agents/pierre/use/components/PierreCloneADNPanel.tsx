// src/app/agents/pierre/use/components/PierreCloneADNPanel.tsx
// CloneADN configuration status and minimal edit — Pierre Cockpit B31.1.

"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Fingerprint } from "lucide-react";
import type {
  PierreCockpitCloneADNSummary,
  PierreCockpitActionResult,
} from "@/lib/pierre/cockpit/types";
import { EmptyState } from "./PierreEmptyStates";

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: "var(--cs-line)" }}>
      <span style={{ color: "var(--cs-ink-4)", fontSize: 12 }}>{label}</span>
      <span style={{ color: "var(--cs-ink-1)", fontSize: 13, fontWeight: 500 }}>{value ?? "—"}</span>
    </div>
  );
}

export function PierreCloneADNPanel({
  cloneADN,
  onUpdate,
}: {
  cloneADN: PierreCockpitCloneADNSummary | null;
  onUpdate: (patch: Record<string, unknown>) => Promise<PierreCockpitActionResult>;
}) {
  const [editing, setEditing] = React.useState(false);
  const [form, setForm] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);
  const [saveOk, setSaveOk] = React.useState<boolean | null>(null);
  const [saveMsg, setSaveMsg] = React.useState<string | null>(null);

  function openEdit() {
    if (!cloneADN) return;
    setForm({
      tone: cloneADN.tone ?? "",
      autonomy: cloneADN.autonomy ?? "",
      validation_mode: cloneADN.validationMode ?? "",
    });
    setEditing(true);
    setSaveOk(null);
    setSaveMsg(null);
  }

  async function handleSave() {
    setSaving(true);
    setSaveOk(null);
    setSaveMsg(null);
    try {
      const res = await onUpdate(form);
      setSaveOk(res.ok);
      setSaveMsg(res.ok ? "Profil mis à jour avec succès" : (res.error ?? "Erreur"));
      if (res.ok) setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (!cloneADN) {
    return (
      <EmptyState
        icon={<Fingerprint className="h-5 w-5" />}
        title="CloneADN non configuré"
        subtitle="Le profil ADN de votre organisation n'est pas encore défini."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Status card */}
      <div
        className="rounded-2xl p-5"
        style={{
          background: cloneADN.configured ? "var(--cs-success-bg)" : "var(--cs-warn-bg)",
          border: `1px solid ${cloneADN.configured ? "transparent" : "var(--cs-warn-bg)"}`,
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {cloneADN.configured ? (
              <CheckCircle2
                className="h-4 w-4 shrink-0"
                style={{ color: "var(--cs-success)" }}
                aria-hidden="true"
              />
            ) : (
              <AlertTriangle
                className="h-4 w-4 shrink-0"
                style={{ color: "var(--cs-warn)" }}
                aria-hidden="true"
              />
            )}
            <p
              className="text-sm font-semibold"
              style={{ color: cloneADN.configured ? "var(--cs-success)" : "var(--cs-warn)" }}
            >
              {cloneADN.configured ? "Profil ADN configuré" : "Profil ADN incomplet"}
            </p>
          </div>
          {cloneADN.score !== null && (
            <span className="text-xl font-bold" style={{ color: "var(--cs-ink-1)" }}>
              {cloneADN.score}%
            </span>
          )}
        </div>
        <p className="mt-1 text-xs" style={{ color: "var(--cs-ink-3)" }}>
          Statut : {cloneADN.status}
        </p>
      </div>

      {/* Info rows */}
      <div
        className="rounded-xl px-4"
        style={{ background: "var(--cs-surface-strong)", border: "1px solid var(--cs-line)" }}
      >
        <InfoRow label="Ton" value={cloneADN.tone} />
        <InfoRow label="Autonomie" value={cloneADN.autonomy} />
        <InfoRow label="Mode de validation" value={cloneADN.validationMode} />
        {cloneADN.signature && (
          <InfoRow label="Signature" value={
            <span className="truncate max-w-[180px] block text-right">{cloneADN.signature}</span>
          } />
        )}
      </div>

      {/* Edit */}
      {!editing ? (
        <button
          onClick={openEdit}
          className="rounded-xl px-4 py-2.5 text-sm font-semibold transition-all hover:opacity-80"
          style={{ background: "var(--cs-graphite)", color: "var(--cs-ivory)" }}
        >
          Modifier le profil ADN
        </button>
      ) : (
        <div
          className="flex flex-col gap-3 rounded-xl p-4"
          style={{ background: "var(--cs-surface-strong)", border: "1px solid var(--cs-line)" }}
        >
          {[
            { key: "tone",            label: "Ton",               placeholder: "formel, chaleureux…" },
            { key: "autonomy",        label: "Autonomie",         placeholder: "supervised, autonomous…" },
            { key: "validation_mode", label: "Mode de validation", placeholder: "manual, auto…" },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="mb-1 block text-xs font-medium" style={{ color: "var(--cs-ink-4)" }}>
                {label}
              </label>
              <input
                type="text"
                value={form[key] ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                placeholder={placeholder}
                className="w-full rounded-lg px-3 py-1.5 text-sm outline-none"
                style={{
                  background: "var(--cs-bg-2)",
                  border: "1px solid var(--cs-line)",
                  color: "var(--cs-ink-1)",
                }}
              />
            </div>
          ))}

          {saveMsg && (
            <p
              className="text-xs"
              style={{ color: saveOk ? "var(--cs-success)" : "var(--cs-danger)" }}
            >
              {saveMsg}
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 rounded-lg py-2 text-xs font-semibold transition-all hover:opacity-80 disabled:opacity-40"
              style={{ background: "var(--cs-graphite)", color: "var(--cs-ivory)" }}
            >
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="rounded-lg px-4 py-2 text-xs font-semibold hover:opacity-70"
              style={{ background: "var(--cs-bg-3)", color: "var(--cs-ink-3)" }}
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

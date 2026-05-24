// src/app/agents/pierre/use/components/PierreDocumentStudio.tsx
// Document template selector + preview — Pierre Cockpit B31.

"use client";

import * as React from "react";
import type { PierreCockpitActionResult } from "@/lib/pierre/cockpit/types";
import { EmptyState, LoadingState } from "./PierreEmptyStates";

type Template = Record<string, unknown>;

export function PierreDocumentStudio({
  templates,
  onPreview,
}: {
  templates: Template[];
  onPreview: (payload: {
    template_id?: string;
    kind?: string;
    variables?: Record<string, string>;
  }) => Promise<PierreCockpitActionResult>;
}) {
  const [selected, setSelected] = React.useState<Template | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handlePreview() {
    if (!selected) return;
    setLoading(true);
    setError(null);
    try {
      const res = await onPreview({
        template_id: String(selected.id ?? ""),
        kind: String(selected.kind ?? ""),
      });
      if (res.ok && res.data) {
        const data = res.data as Record<string, unknown>;
        setPreview(
          typeof data.preview_text === "string"
            ? data.preview_text
            : JSON.stringify(data, null, 2),
        );
      } else {
        setError(res.error ?? "Erreur lors de la prévisualisation.");
      }
    } finally {
      setLoading(false);
    }
  }

  if (templates.length === 0) {
    return (
      <EmptyState
        icon="📝"
        title="Aucun template disponible"
        subtitle="Les templates de documents apparaîtront ici."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Template selector */}
      <div>
        <label
          htmlFor="template-select"
          className="mb-1.5 block text-xs font-semibold"
          style={{ color: "var(--cs-ink-3)" }}
        >
          Template
        </label>
        <select
          id="template-select"
          className="w-full rounded-xl px-3 py-2 text-sm outline-none"
          style={{
            background: "var(--cs-surface-strong)",
            border: "1px solid var(--cs-line)",
            color: "var(--cs-ink-1)",
          }}
          value={selected ? String(selected.id ?? "") : ""}
          onChange={(e) => {
            const t = templates.find((t) => String(t.id ?? "") === e.target.value);
            setSelected(t ?? null);
            setPreview(null);
          }}
        >
          <option value="">— Sélectionner un template —</option>
          {templates.map((t) => (
            <option key={String(t.id ?? Math.random())} value={String(t.id ?? "")}>
              {String(t.label ?? t.name ?? t.kind ?? t.id ?? "Template")}
            </option>
          ))}
        </select>
      </div>

      {selected && (
        <>
          {/* Template metadata */}
          <div
            className="rounded-xl px-4 py-3 text-sm"
            style={{
              background: "var(--cs-bg-2)",
              border: "1px solid var(--cs-line)",
            }}
          >
            {Boolean(selected.description) && (
              <p style={{ color: "var(--cs-ink-3)", fontSize: 12 }}>
                {String(selected.description ?? "")}
              </p>
            )}
            {Boolean(selected.kind) && (
              <p className="mt-1 text-xs" style={{ color: "var(--cs-ink-4)" }}>
                Type : {String(selected.kind ?? "")}
              </p>
            )}
          </div>

          {/* Preview button */}
          <button
            onClick={handlePreview}
            disabled={loading}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold transition-all hover:opacity-80 disabled:opacity-40"
            style={{
              background: "var(--cs-graphite)",
              color: "var(--cs-ivory)",
            }}
          >
            {loading ? "Génération de l'aperçu…" : "Prévisualiser"}
          </button>
        </>
      )}

      {error && (
        <p className="text-xs" style={{ color: "var(--cs-danger)" }}>
          {error}
        </p>
      )}

      {loading && <LoadingState label="Génération de l'aperçu…" />}

      {preview && !loading && (
        <div>
          <p
            className="mb-1.5 text-xs font-semibold"
            style={{ color: "var(--cs-ink-4)" }}
          >
            Aperçu
          </p>
          <pre
            className="whitespace-pre-wrap rounded-xl px-4 py-3 text-xs leading-relaxed overflow-auto max-h-96"
            style={{
              background: "var(--cs-bg-2)",
              color: "var(--cs-ink-2)",
              border: "1px solid var(--cs-line)",
              fontFamily: "ui-monospace, monospace",
            }}
          >
            {preview}
          </pre>
        </div>
      )}
    </div>
  );
}

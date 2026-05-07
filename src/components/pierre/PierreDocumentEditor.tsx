"use client";

import { useEffect, useState } from "react";

export type PierreDocumentEditorValue = {
  title: string;
  doc_type: string;
  body_text: string;
  body_html: string;
};

type PierreDocumentEditorProps = {
  value: PierreDocumentEditorValue | null;
  onChange?: (value: PierreDocumentEditorValue) => void;
};

export function PierreDocumentEditor({
  value,
  onChange,
}: PierreDocumentEditorProps) {
  const [localValue, setLocalValue] = useState<PierreDocumentEditorValue | null>(
    value
  );
  const [mode, setMode] = useState<"text" | "html">("text");

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  if (!localValue) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
        <p className="text-sm text-white/50">
          Aucun document sélectionné pour le moment.
        </p>
      </div>
    );
  }

  const updateValue = (patch: Partial<PierreDocumentEditorValue>) => {
    const next = {
      ...localValue,
      ...patch,
    };

    setLocalValue(next);
    onChange?.(next);
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wide text-white/35">
            Document actif
          </p>
          <input
            value={localValue.title}
            onChange={(event) => updateValue({ title: event.target.value })}
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white outline-none"
          />
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode("text")}
            className={[
              "rounded-xl px-3 py-2 text-xs font-medium transition",
              mode === "text"
                ? "bg-violet-500 text-white"
                : "bg-white/5 text-white/70 hover:bg-white/10",
            ].join(" ")}
          >
            Texte
          </button>
          <button
            type="button"
            onClick={() => setMode("html")}
            className={[
              "rounded-xl px-3 py-2 text-xs font-medium transition",
              mode === "html"
                ? "bg-violet-500 text-white"
                : "bg-white/5 text-white/70 hover:bg-white/10",
            ].join(" ")}
          >
            HTML
          </button>
        </div>
      </div>

      <div className="mb-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/50">
        Type : {localValue.doc_type || "generic"}
      </div>

      {mode === "text" ? (
        <textarea
          value={localValue.body_text}
          onChange={(event) => updateValue({ body_text: event.target.value })}
          className="min-h-[260px] w-full rounded-2xl border border-white/10 bg-[#0d0d0d] px-4 py-4 text-sm leading-7 text-white outline-none"
        />
      ) : (
        <textarea
          value={localValue.body_html}
          onChange={(event) => updateValue({ body_html: event.target.value })}
          className="min-h-[260px] w-full rounded-2xl border border-white/10 bg-[#0d0d0d] px-4 py-4 text-sm leading-7 text-white outline-none"
        />
      )}
    </div>
  );
}
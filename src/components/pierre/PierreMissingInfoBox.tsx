"use client";

import type { PierreApiMissingInfoItem } from "@/hooks/pierre/usePierreMissionCenter";

type PierreMissingInfoBoxProps = {
  items: PierreApiMissingInfoItem[];
};

export function PierreMissingInfoBox({ items }: PierreMissingInfoBoxProps) {
  if (!items.length) return null;

  return (
    <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-amber-300" />
        <p className="text-sm font-semibold text-amber-100">
          Informations manquantes
        </p>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.key}
            className="rounded-xl border border-white/10 bg-black/10 p-3"
          >
            <div className="mb-1 flex items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-white/50">
                {item.key}
              </span>
              <span className="text-[11px] text-white/40">
                {String(item.expected_format ?? "")}
              </span>
              {item.required ? (
                <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] text-rose-200">
                  requis
                </span>
              ) : (
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/60">
                  utile
                </span>
              )}
            </div>

            <p className="text-sm text-white/85">{item.question}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

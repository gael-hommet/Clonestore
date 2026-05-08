"use client";

type PierrePdfActionsProps = {
  disabled?: boolean;
  isLoading?: boolean;
  onGeneratePdf: () => Promise<unknown> | unknown;
};

export function PierrePdfActions({
  disabled,
  isLoading,
  onGeneratePdf,
}: PierrePdfActionsProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
      <div className="mb-3">
        <p className="text-sm font-semibold text-white">PDF</p>
        <p className="mt-1 text-xs leading-6 text-white/50">
          Génère un PDF propre à partir du document actuellement chargé.
        </p>
      </div>

      <button
        type="button"
        disabled={disabled || isLoading}
        onClick={() => void onGeneratePdf()}
        className="w-full rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isLoading ? "Génération..." : "Générer le PDF"}
      </button>
    </div>
  );
}
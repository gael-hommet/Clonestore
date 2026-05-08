"use client";

type PierreMissionComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => Promise<unknown> | unknown;
  isSubmitting: boolean;
  error?: string;
  success?: string;
};

const EXAMPLES = [
  "À 17h tu envoies un mail à recrutement@entreprise.fr pour confirmer l’entretien de demain.",
  "Prépare une convocation RH pour demain matin et attends ma validation avant envoi.",
  "Réécris ce courrier pour le rendre plus professionnel et plus rassurant.",
  "Crée une relance si le candidat ne répond pas ce soir.",
];

export function PierreMissionComposer({
  value,
  onChange,
  onSubmit,
  isSubmitting,
  error,
  success,
}: PierreMissionComposerProps) {
  return (
    <section className="rounded-[32px] border border-stone-200 bg-[#F8F5EF] p-6 shadow-[0_10px_40px_rgba(28,25,23,0.06)] md:p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-4 py-1.5 text-xs font-medium text-violet-700">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
            Centre de missions Pierre
          </div>

          <h1 className="max-w-4xl text-3xl font-semibold tracking-tight text-stone-900 md:text-5xl">
            L’interface de commandement de Pierre
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-7 text-stone-600 md:text-base">
            Parle à Pierre comme à un employé RH. Il comprend la mission,
            découpe les tâches, prépare les actions, demande une validation si
            nécessaire, puis laisse des traces claires dans l’historique.
          </p>
        </div>

        <div className="rounded-[28px] border border-stone-200 bg-white p-4 md:p-5">
          <textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Exemple : à 17h tu envoies un mail à untel, tu prépares une convocation pour demain, puis tu attends ma validation avant envoi."
            className="min-h-[220px] w-full resize-none rounded-[24px] border border-stone-200 bg-[#FCFBF8] px-5 py-5 text-base leading-8 text-stone-900 outline-none placeholder:text-stone-400 focus:border-violet-300 focus:bg-white"
          />

          <div className="mt-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => onChange(example)}
                  className="rounded-full border border-stone-200 bg-stone-50 px-4 py-2 text-xs font-medium text-stone-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
                >
                  Exemple
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => void onSubmit()}
              disabled={isSubmitting}
              className="inline-flex min-w-[260px] items-center justify-center rounded-2xl bg-violet-600 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Analyse en cours..." : "Confier la mission à Pierre"}
            </button>
          </div>

          {(error || success) && (
            <div className="mt-4">
              {error ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              ) : null}

              {!error && success ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {success}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
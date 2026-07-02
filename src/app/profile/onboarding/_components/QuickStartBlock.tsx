"use client";

// Quick Start — bloc « Démarrage rapide » (P9.2, Étape 1).
//
// Vue rapide (< 5 min) POSÉE AU-DESSUS du wizard profond. CONTRÔLÉE par l'état du
// wizard (value/onChange) → AUCUN second draft, données immédiatement visibles
// dans les sections détaillées, persistées par l'autosave existant, reprise
// exacte après reload (reflète l'état hydraté). Réutilise les cœurs purs validés
// (quick-start, autosave). Validation précise, progression, aria-live.

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AUTOSAVE_INITIAL,
  QUICK_START_SCREENS,
  QUICK_START_SIZES,
  autosaveLabel,
  autosaveReducer,
  estimateRemaining,
  firstIncompleteScreenIndex,
  isQuickStartComplete,
  isScreenComplete,
  nextScreenIndex,
  prevScreenIndex,
  quickStartProgress,
  validateField,
  type AutosaveState,
  type QuickStartDraft,
  type QuickStartField,
} from "@/lib/client-onboarding";

const LABELS: Record<QuickStartField, string> = {
  companyName: "Nom de l'entreprise",
  companySize: "Taille de l'entreprise",
  sector: "Secteur d'activité",
  country: "Pays",
  firstObjective: "Premier objectif confié à Pierre",
};
const PLACEHOLDERS: Record<QuickStartField, string> = {
  companyName: "Ex. Acme SAS",
  companySize: "",
  sector: "Ex. Services, industrie, tech…",
  country: "Ex. France",
  firstObjective: "Ex. Préparer les contrats d'embauche et les relances RH.",
};

export function QuickStartBlock({
  value,
  onChange,
}: {
  value: QuickStartDraft;
  /** Met à jour l'état du wizard (immédiat + persisté + visible dans les sections). */
  onChange: (field: QuickStartField, next: string) => void;
}) {
  const [screen, setScreen] = useState(() => firstIncompleteScreenIndex(value));
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [save, setSave] = useState<AutosaveState>(AUTOSAVE_INITIAL);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Recale l'écran de reprise une fois l'état hydraté (value passe de vide → chargé).
  const alignedRef = useRef(false);
  useEffect(() => {
    if (alignedRef.current) return;
    if (isQuickStartComplete(value) || value.companyName.trim().length > 0) {
      setScreen(firstIncompleteScreenIndex(value));
      alignedRef.current = true;
    }
  }, [value]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const handleType = useCallback(
    (field: QuickStartField, next: string) => {
      onChange(field, next);
      setSave((s) => autosaveReducer(s, { type: "EDIT" }));
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        setSave((s) => autosaveReducer(s, { type: "SAVE_SUCCESS", at: new Date().toISOString() }));
      }, 700);
    },
    [onChange],
  );

  const current = QUICK_START_SCREENS[Math.min(screen, QUICK_START_SCREENS.length - 1)];
  const onConfirm = screen >= QUICK_START_SCREENS.length;
  const progress = Math.round(quickStartProgress(value) * 100);

  const goNext = () => {
    if (!isScreenComplete(current, value)) {
      setTouched((t) => ({ ...t, ...Object.fromEntries(current.fields.map((f) => [f, true])) }));
      return;
    }
    setScreen((s) => {
      const ni = nextScreenIndex(s, value);
      return ni === s && s === QUICK_START_SCREENS.length - 1 ? s + 1 : ni;
    });
  };
  const goPrev = () => setScreen((s) => (s >= QUICK_START_SCREENS.length ? QUICK_START_SCREENS.length - 1 : prevScreenIndex(s)));

  return (
    <section data-tour-id="mycs-quickstart" className="cs-panel p-5">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <p className="cs-eyebrow">Démarrage rapide</p>
            <p className="text-[0.86rem] leading-6 text-[var(--cs-ink-3)]">
              L'essentiel en moins de cinq minutes. Vous complétez le reste ci-dessous.
            </p>
          </div>
          <span aria-live="polite" className="text-[0.78rem] text-[var(--cs-ink-4)]">
            {autosaveLabel(save)}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div
            className="h-2 flex-1 overflow-hidden rounded-full bg-[rgba(24,29,39,0.08)]"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progression du démarrage rapide"
          >
            <div className="h-full rounded-full bg-[var(--cs-violet)] transition-[width] duration-500" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-[0.8rem] tabular-nums text-[var(--cs-ink-4)]">{progress}%</span>
        </div>

        {onConfirm ? (
          <div className="cs-card cs-card-tight">
            <div className="space-y-3">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--cs-line-soft)] bg-white/58 text-[var(--cs-success)]">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <p className="text-[0.98rem] font-semibold text-[var(--cs-ink-1)]">Démarrage rapide terminé</p>
              <p className="text-[0.85rem] leading-6 text-[var(--cs-ink-3)]">
                Pierre connaît l'essentiel. Vous pouvez modifier ces informations ou enrichir l'empreinte détaillée ci-dessous.
              </p>
              <button type="button" onClick={goPrev} className="cs-liquid-button">
                <ArrowLeft className="h-4 w-4" />
                <span>Modifier mes réponses</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="cs-card cs-card-tight">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[0.92rem] font-semibold text-[var(--cs-ink-1)]">{current.title}</p>
                <span className="text-[0.78rem] text-[var(--cs-ink-4)]">
                  Écran {screen + 1} / {QUICK_START_SCREENS.length} · {estimateRemaining(value)}
                </span>
              </div>

              <div className="grid gap-4">
                {current.fields.map((field) => {
                  const fieldValue = value[field];
                  const error = touched[field] ? validateField(field, fieldValue) : null;
                  const errId = `qsb-err-${field}`;
                  const commonProps = {
                    "aria-invalid": !!error,
                    "aria-describedby": error ? errId : undefined,
                    onBlur: () => setTouched((t) => ({ ...t, [field]: true })),
                  } as const;
                  return (
                    <label key={field} className="block space-y-2">
                      <span className="text-[0.84rem] font-medium text-[var(--cs-ink-2)]">{LABELS[field]}</span>
                      {field === "companySize" ? (
                        <select
                          value={fieldValue}
                          onChange={(e) => handleType(field, e.target.value)}
                          {...commonProps}
                          className="min-h-[48px] w-full rounded-[1.1rem] border border-[var(--cs-line-soft)] bg-white/60 px-4 text-[0.9rem] text-[var(--cs-ink-1)] outline-none focus-visible:border-[var(--cs-violet)]"
                        >
                          <option value="">Choisir…</option>
                          {QUICK_START_SIZES.map((s) => (<option key={s} value={s}>{s} salariés</option>))}
                        </select>
                      ) : field === "firstObjective" ? (
                        <textarea
                          value={fieldValue}
                          onChange={(e) => handleType(field, e.target.value)}
                          placeholder={PLACEHOLDERS[field]}
                          {...commonProps}
                          className="min-h-[92px] w-full rounded-[1.1rem] border border-[var(--cs-line-soft)] bg-white/60 px-4 py-3 text-[0.9rem] leading-6 text-[var(--cs-ink-1)] outline-none focus-visible:border-[var(--cs-violet)]"
                        />
                      ) : (
                        <input
                          type="text"
                          value={fieldValue}
                          onChange={(e) => handleType(field, e.target.value)}
                          placeholder={PLACEHOLDERS[field]}
                          {...commonProps}
                          className="min-h-[48px] w-full rounded-[1.1rem] border border-[var(--cs-line-soft)] bg-white/60 px-4 text-[0.9rem] text-[var(--cs-ink-1)] outline-none focus-visible:border-[var(--cs-violet)]"
                        />
                      )}
                      {error ? (
                        <span id={errId} role="alert" className="block text-[0.78rem] text-[var(--cs-danger)]">{error}</span>
                      ) : null}
                    </label>
                  );
                })}
              </div>

              <div className="flex items-center justify-between gap-3 pt-1">
                <button
                  type="button"
                  onClick={goPrev}
                  disabled={screen === 0}
                  className={cn("cs-liquid-button", screen === 0 && "pointer-events-none opacity-40")}
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Précédent</span>
                </button>
                <button type="button" onClick={goNext} className="cs-liquid-button cs-liquid-button--primary">
                  <span>{screen === QUICK_START_SCREENS.length - 1 ? "Terminer" : "Suivant"}</span>
                  {screen === QUICK_START_SCREENS.length - 1 ? <Check className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
        )}

        <p className="flex items-center gap-2 text-[0.78rem] text-[var(--cs-ink-4)]">
          <Save className="h-3.5 w-3.5" />
          Enregistré sur ce navigateur.
        </p>
      </div>
    </section>
  );
}

"use client";

// BLOC 3 — Formulaire diagnostic progressif.
//
// 7 questions principales + 1 hypothèse coût horaire facultative. Aucune
// donnée sensible. Le résultat est calculé côté serveur ; le client n'a
// jamais accès à un calcul "magique".

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";

interface QuestionDef {
  id: string;
  label: string;
  helper?: string;
  options?: { value: string; label: string }[];
  type: "single" | "number_range" | "multi_chip" | "number";
}

const QUESTIONS: readonly QuestionDef[] = [
  {
    id: "headcount",
    label: "Quel est l'effectif total de votre entreprise ?",
    type: "single",
    options: [
      { value: "1-9", label: "Moins de 10" },
      { value: "10-49", label: "10 à 49" },
      { value: "50-249", label: "50 à 249" },
      { value: "250-999", label: "250 à 999" },
      { value: "1000+", label: "1000 et plus" },
    ],
  },
  {
    id: "rh_team_size",
    label: "Combien d'ETP travaillent dans votre équipe RH ?",
    type: "single",
    options: [
      { value: "0", label: "Aucun dédié" },
      { value: "1", label: "1" },
      { value: "2-5", label: "2 à 5" },
      { value: "6-15", label: "6 à 15" },
      { value: "16+", label: "16 et plus" },
    ],
  },
  {
    id: "monthly_hires",
    label: "Combien d'embauches par mois (en moyenne) ?",
    type: "single",
    options: [
      { value: "0-1", label: "0 à 1" },
      { value: "2-5", label: "2 à 5" },
      { value: "6-15", label: "6 à 15" },
      { value: "16-40", label: "16 à 40" },
      { value: "40+", label: "Plus de 40" },
    ],
  },
  {
    id: "monthly_onboardings",
    label: "Combien d'onboardings / offboardings par mois ?",
    type: "single",
    options: [
      { value: "0-1", label: "0 à 1" },
      { value: "2-5", label: "2 à 5" },
      { value: "6-15", label: "6 à 15" },
      { value: "16-40", label: "16 à 40" },
      { value: "40+", label: "Plus de 40" },
    ],
  },
  {
    id: "recurring_ops_volume",
    label: "Volume d'opérations RH récurrentes (absences, attestations, justificatifs) ?",
    type: "single",
    options: [
      { value: "low", label: "Faible (< 10/mois)" },
      { value: "medium", label: "Moyen (10 à 40/mois)" },
      { value: "high", label: "Élevé (40 à 100/mois)" },
      { value: "very_high", label: "Très élevé (100+/mois)" },
    ],
  },
  {
    id: "current_tools",
    label: "Outils RH actuels (sélection multiple, facultatif)",
    type: "multi_chip",
    options: [
      { value: "hris", label: "SIRH" },
      { value: "payroll", label: "Paie externe" },
      { value: "ats", label: "ATS" },
      { value: "spreadsheets", label: "Tableurs" },
      { value: "email", label: "Email seulement" },
      { value: "no_tool", label: "Aucun outil" },
    ],
  },
  {
    id: "autonomy_target",
    label: "Quel niveau d'autonomie souhaitez-vous pour Pierre ?",
    type: "single",
    options: [
      { value: "fully", label: "Délégation maximale" },
      { value: "supervised", label: "Supervisée (recommandé)" },
      { value: "human_first", label: "Humain en premier" },
    ],
  },
  {
    id: "validation_requirements",
    label: "Quel niveau de validation humaine exigez-vous ?",
    type: "single",
    options: [
      { value: "high", label: "Forte — chaque envoi externe" },
      { value: "medium", label: "Moyenne — actes sensibles" },
      { value: "low", label: "Faible — confiance par défaut" },
    ],
  },
];

type AnswerMap = Record<string, string | number | string[] | null>;

const STORAGE_KEY = "cs_b3_diagnostic_draft_v1";

interface DiagnosticApiResult {
  compatibilityLevel: "high" | "partial" | "limited";
  compatibilityReasonCodes: string[];
  suggestedMissions: string[];
  humanControls: string[];
  estimatedSavedHoursPerMonth: { low: number; central: number; high: number } | null;
  estimatedFinancialRangeEur: { low: number; central: number; high: number } | null;
  hypotheses: string[];
  limitations: string[];
}

export function DiagnosticForm() {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [hourlyCost, setHourlyCost] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<DiagnosticApiResult | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Restore from sessionStorage on mount.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { answers?: AnswerMap; index?: number; hourlyCost?: string };
        if (parsed && typeof parsed === "object" && parsed.answers && typeof parsed.answers === "object") {
          setAnswers(parsed.answers);
          if (typeof parsed.index === "number" && parsed.index >= 0 && parsed.index < QUESTIONS.length) {
            setIndex(parsed.index);
          }
          if (typeof parsed.hourlyCost === "string") setHourlyCost(parsed.hourlyCost);
        }
      }
    } catch {
      // localStorage unavailable / corrupted → ignore
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ answers, index, hourlyCost }));
    } catch {
      // ignore
    }
  }, [answers, index, hourlyCost]);

  const currentQuestion = QUESTIONS[index];
  const totalSteps = QUESTIONS.length;

  function setAnswer(id: string, value: string | number | string[] | null) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  function next() {
    if (index < QUESTIONS.length - 1) setIndex((i) => i + 1);
  }
  function prev() {
    if (index > 0) setIndex((i) => i - 1);
  }

  async function submit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const hourlyCostNum = hourlyCost ? Number(hourlyCost.replace(",", ".")) : null;
      const res = await fetch("/api/conversion/diagnostic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers,
          hourly_cost_eur: hourlyCostNum && Number.isFinite(hourlyCostNum) && hourlyCostNum > 0 ? hourlyCostNum : null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.ok) {
        setSubmitError("Impossible de calculer le diagnostic pour le moment.");
        return;
      }
      setResult(body.result as DiagnosticApiResult);
    } catch {
      setSubmitError("Connexion impossible.");
    } finally {
      setSubmitting(false);
    }
  }

  const answeredCount = useMemo(
    () => QUESTIONS.filter((q) => answerIsPresent(answers[q.id])).length,
    [answers],
  );

  if (result) {
    return <DiagnosticResultView result={result} />;
  }

  const allRequiredAnswered = QUESTIONS.every((q) =>
    q.type === "multi_chip" ? true : answerIsPresent(answers[q.id]),
  );

  return (
    <section className="cs-panel px-0 py-0 overflow-hidden">
      <div
        className="border-b border-stone-100/80 px-5 py-3 flex items-center gap-3 flex-wrap"
        aria-live="polite"
      >
        <span className="text-xs font-semibold text-[var(--cs-ink-1)]">
          Étape {index + 1} sur {totalSteps}
        </span>
        <span className="h-1 flex-1 rounded-full bg-stone-100 overflow-hidden min-w-[120px]">
          <span
            className="block h-full bg-[var(--cs-violet)] transition-all"
            style={{ width: `${((index + 1) / totalSteps) * 100}%` }}
          />
        </span>
        <span className="text-xs text-[var(--cs-ink-4)]">{answeredCount} répondues</span>
      </div>
      <div className="p-5 space-y-5">
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-[var(--cs-ink-1)]">{currentQuestion.label}</legend>
          {currentQuestion.type === "single" && currentQuestion.options && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {currentQuestion.options.map((opt) => {
                const checked = answers[currentQuestion.id] === opt.value;
                return (
                  <label
                    key={opt.value}
                    className={`flex items-center gap-2 rounded-xl border px-4 py-3 cursor-pointer transition-all ${
                      checked
                        ? "border-[var(--cs-violet)] bg-[var(--cs-violet-soft)]"
                        : "border-stone-200 bg-white/60 hover:border-stone-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name={currentQuestion.id}
                      value={opt.value}
                      checked={checked}
                      onChange={() => setAnswer(currentQuestion.id, opt.value)}
                      className="h-4 w-4"
                    />
                    <span className="text-sm text-[var(--cs-ink-1)]">{opt.label}</span>
                  </label>
                );
              })}
            </div>
          )}
          {currentQuestion.type === "multi_chip" && currentQuestion.options && (
            <div className="flex flex-wrap gap-2">
              {currentQuestion.options.map((opt) => {
                const current = (answers[currentQuestion.id] as string[] | undefined) ?? [];
                const checked = current.includes(opt.value);
                return (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => {
                      const next = checked ? current.filter((v) => v !== opt.value) : [...current, opt.value];
                      setAnswer(currentQuestion.id, next);
                    }}
                    aria-pressed={checked}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-all ${
                      checked
                        ? "bg-[var(--cs-violet)] text-white border-[var(--cs-violet)]"
                        : "bg-white/60 text-[var(--cs-ink-2)] border-stone-200 hover:border-stone-300"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          )}
        </fieldset>

        {index === QUESTIONS.length - 1 && (
          <div className="rounded-xl border border-stone-200 bg-white/60 p-4 space-y-2">
            <label className="text-xs font-semibold text-[var(--cs-ink-1)]" htmlFor="hourly_cost">
              Coût horaire moyen d&apos;un opérateur RH (facultatif)
            </label>
            <input
              id="hourly_cost"
              type="number"
              inputMode="decimal"
              min={0}
              max={500}
              step="0.5"
              value={hourlyCost}
              onChange={(e) => setHourlyCost(e.target.value)}
              placeholder="Ex : 40"
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
            />
            <p className="text-xs text-[var(--cs-ink-4)]">
              Estimation financière uniquement si vous fournissez vous-même ce coût. Sinon, seules les
              heures économisées seront estimées.
            </p>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 flex-wrap gap-2">
          <button
            type="button"
            onClick={prev}
            disabled={index === 0}
            className="inline-flex items-center gap-1.5 px-4 h-10 rounded-full border border-stone-200 text-sm font-semibold text-[var(--cs-ink-3)] disabled:opacity-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Précédent
          </button>
          {index < QUESTIONS.length - 1 ? (
            <button
              type="button"
              onClick={next}
              disabled={
                currentQuestion.type !== "multi_chip" && !answerIsPresent(answers[currentQuestion.id])
              }
              className="inline-flex items-center gap-1.5 px-5 h-10 rounded-full bg-[var(--cs-violet)] text-white text-sm font-semibold shadow-sm disabled:opacity-50"
            >
              Suivant
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={submitting || !allRequiredAnswered}
              className="inline-flex items-center gap-1.5 px-5 h-10 rounded-full bg-[var(--cs-violet)] text-white text-sm font-semibold shadow-sm disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Voir mon diagnostic
            </button>
          )}
        </div>
        {submitError && (
          <p className="text-xs text-amber-700 bg-amber-50/80 border border-amber-200 rounded-lg px-3 py-2">
            {submitError}
          </p>
        )}
      </div>
    </section>
  );
}

function answerIsPresent(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.length > 0;
  return false;
}

function DiagnosticResultView({ result }: { result: DiagnosticApiResult }) {
  const levelLabel = {
    high: "Forte compatibilité",
    partial: "Compatibilité partielle",
    limited: "Périmètre limité",
  }[result.compatibilityLevel];

  return (
    <section className="space-y-5">
      <div className="cs-panel px-5 py-5 space-y-2">
        <p className="cs-eyebrow">Résultat</p>
        <h2 className="cs-heading text-xl">{levelLabel}</h2>
        <p className="text-sm text-[var(--cs-ink-3)]">
          Ce résultat est une estimation basée sur vos réponses. Aucune garantie — voir les hypothèses ci-dessous.
        </p>
      </div>

      {result.estimatedSavedHoursPerMonth && (
        <div className="cs-panel px-5 py-5 space-y-2">
          <p className="cs-eyebrow">Heures économisées estimées (par mois)</p>
          <p className="text-sm text-[var(--cs-ink-2)]">
            Fourchette basse {result.estimatedSavedHoursPerMonth.low} h · centrale{" "}
            {result.estimatedSavedHoursPerMonth.central} h · haute {result.estimatedSavedHoursPerMonth.high} h.
          </p>
        </div>
      )}

      {result.estimatedFinancialRangeEur && (
        <div className="cs-panel px-5 py-5 space-y-2">
          <p className="cs-eyebrow">Estimation financière (à partir du coût horaire que vous avez fourni)</p>
          <p className="text-sm text-[var(--cs-ink-2)]">
            Basse {result.estimatedFinancialRangeEur.low} € · centrale{" "}
            {result.estimatedFinancialRangeEur.central} € · haute {result.estimatedFinancialRangeEur.high} € / mois.
          </p>
          <p className="text-xs text-[var(--cs-ink-4)]">
            Estimation. Pas une garantie. Dépend du périmètre réellement confié à Pierre.
          </p>
        </div>
      )}

      <div className="cs-panel px-5 py-5 space-y-2">
        <p className="cs-eyebrow">Missions Pierre prioritaires</p>
        <ul className="list-disc pl-5 text-sm text-[var(--cs-ink-2)] space-y-1">
          {result.suggestedMissions.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </div>

      <div className="cs-panel px-5 py-5 space-y-2">
        <p className="cs-eyebrow">Contrôles humains nécessaires</p>
        <ul className="list-disc pl-5 text-sm text-[var(--cs-ink-2)] space-y-1">
          {result.humanControls.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </div>

      <div className="cs-panel px-5 py-5 space-y-2">
        <p className="cs-eyebrow">Hypothèses utilisées</p>
        <ul className="list-disc pl-5 text-xs text-[var(--cs-ink-3)] space-y-1">
          {result.hypotheses.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      </div>

      <div className="cs-panel px-5 py-5 space-y-2">
        <p className="cs-eyebrow">Limites</p>
        <ul className="list-disc pl-5 text-xs text-[var(--cs-ink-3)] space-y-1">
          {result.limitations.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </div>

      <div className="cs-command-surface text-center space-y-3">
        <p className="cs-eyebrow">Prochaines étapes</p>
        <p className="text-sm text-[var(--cs-ink-2)]">
          Pour activer Pierre : abonnement à 449&nbsp;€ HT / mois. Aucun paiement ne se déclenche tant que vous ne créez pas votre compte.
        </p>
        <div className="flex flex-wrap justify-center gap-3 pt-1">
          <Link
            href="/agents/pierre"
            className="inline-flex h-11 items-center gap-2 rounded-full bg-[var(--cs-violet)] px-6 text-sm font-semibold text-white shadow-lg"
          >
            <span>Voir Pierre — 449&nbsp;€ / mois</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/reserver/pierre"
            className="inline-flex h-11 items-center gap-2 rounded-full border border-stone-200 bg-white/60 px-5 text-sm font-semibold text-[var(--cs-ink-2)]"
          >
            Parler 15 minutes avec CloneStore
          </Link>
        </div>
      </div>
    </section>
  );
}

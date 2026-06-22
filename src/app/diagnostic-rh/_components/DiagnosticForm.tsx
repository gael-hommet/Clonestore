"use client";

// BLOC 3 — Formulaire diagnostic progressif aligné LeadForge db9b166.
//
// 8 questions du contrat LeadForge (cf. diagnostic.py:QUESTIONS).
// Aucune donnée sensible. Résultat calculé côté serveur (déterministe).
// Évènements client : diagnostic_started, diagnostic_step_completed,
// diagnostic_completed, result_viewed, purchase_cta_clicked.

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";

interface QuestionDef {
  id: string;
  label: string;
  helper?: string;
  type: "single" | "number" | "multi_chip" | "bool";
  options?: { value: string; label: string }[];
  unit?: string;
}

// Mapping LeadForge → UI : on convertit les valeurs UI en types LeadForge
// (int / enum low|medium|high / bool / text), pas l'inverse.
const QUESTIONS: readonly QuestionDef[] = [
  { id: "headcount", label: "Effectif total de l'entreprise", type: "number", unit: "personnes" },
  { id: "hr_team_size", label: "Taille de l'équipe RH (ETP)", type: "number", unit: "ETP" },
  { id: "monthly_hires", label: "Recrutements par mois (moyenne)", type: "number", unit: "/ mois" },
  { id: "monthly_on_offboardings", label: "Onboardings + offboardings par mois", type: "number", unit: "/ mois" },
  {
    id: "monthly_docs_emails_ops",
    label: "Volume mensuel approximatif d'emails / documents / opérations RH",
    type: "number",
    unit: "/ mois",
  },
  {
    id: "current_tools",
    label: "Outils RH actuels (texte libre, facultatif)",
    type: "multi_chip",
    options: [
      { value: "SIRH", label: "SIRH" },
      { value: "Paie externe", label: "Paie externe" },
      { value: "ATS", label: "ATS" },
      { value: "Tableurs", label: "Tableurs" },
      { value: "Email", label: "Email seulement" },
      { value: "Aucun", label: "Aucun outil" },
    ],
  },
  {
    id: "autonomy_level",
    label: "Niveau d'autonomie souhaité pour Pierre",
    type: "single",
    options: [
      { value: "high", label: "Élevé — déléguer le plus possible" },
      { value: "medium", label: "Moyen — superviser régulièrement (recommandé)" },
      { value: "low", label: "Faible — valider chaque étape" },
    ],
  },
  {
    id: "validation_required",
    label: "Exigez-vous une validation et une traçabilité ?",
    type: "bool",
    options: [
      { value: "true", label: "Oui — validation et trace obligatoires" },
      { value: "false", label: "Non — confiance par défaut" },
    ],
  },
];

type AnswerMap = Record<string, number | string | string[] | boolean | null>;

const STORAGE_KEY = "cs_b3_diagnostic_draft_v2";

interface DiagnosticApiResult {
  compatibility: "low" | "medium" | "high";
  compatibility_score: number;
  recommended_missions: string[];
  priorities: string[];
  actions_requiring_validation: string[];
  operational_load: {
    declared_ops_month: number;
    derived_ops_month: number;
    base_ops_month: number;
    hr_team_size: number;
  };
  volume_estimate: {
    low: { automatable_ops_month: number; operational_hours_month: number };
    central: { automatable_ops_month: number; operational_hours_month: number };
    high: { automatable_ops_month: number; operational_hours_month: number };
  };
  assumptions: Record<string, number>;
  formulas: Record<string, string>;
  limits: string[];
  price_comparison: { pierre_eur_month: number };
  next_steps: string[];
  financial_saving: null | {
    basis: string;
    hourly_cost_eur: number;
    central_monthly_saving_eur: number;
    vs_pierre_eur_month: number;
    note: string;
  };
}

/** Émission first-party, idempotente côté client. */
async function emitConversionEvent(eventType: string, metadata: Record<string, unknown> = {}, idempotencyKey?: string) {
  try {
    const key =
      idempotencyKey ??
      `${eventType}:${Math.random().toString(36).slice(2, 10)}:${Date.now().toString(36).slice(-6)}`;
    await fetch("/api/conversion/events", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_type: eventType, idempotency_key: key, source_page: "/diagnostic-rh", metadata }),
      keepalive: true,
    });
  } catch {
    // Best-effort — l'absence d'analytics ne doit pas casser le parcours.
  }
}

export function DiagnosticForm() {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [hourlyCost, setHourlyCost] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<DiagnosticApiResult | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const startedEmittedRef = useRef(false);
  const lastStepEmittedRef = useRef<number>(-1);

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
      /* sessionStorage unavailable */
    }
    // diagnostic_started émis une seule fois (idempotency_key stable par session client).
    if (!startedEmittedRef.current) {
      const stableKey = `diag_started:${(typeof sessionStorage !== "undefined" && sessionStorage.getItem("cs_b3_diag_session_marker")) ||
        (() => {
          const m = Math.random().toString(36).slice(2, 14);
          try {
            sessionStorage.setItem("cs_b3_diag_session_marker", m);
          } catch {}
          return m;
        })()}`;
      emitConversionEvent("diagnostic_started", { step: 1 }, stableKey);
      startedEmittedRef.current = true;
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ answers, index, hourlyCost }));
    } catch {}
  }, [answers, index, hourlyCost]);

  const currentQuestion = QUESTIONS[index];
  const totalSteps = QUESTIONS.length;

  function setAnswer(id: string, value: AnswerMap[string]) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  function next() {
    if (index < QUESTIONS.length - 1) {
      if (lastStepEmittedRef.current !== index) {
        emitConversionEvent("diagnostic_step_completed", { step: index + 1 });
        lastStepEmittedRef.current = index;
      }
      setIndex((i) => i + 1);
    }
  }
  function prev() {
    if (index > 0) setIndex((i) => i - 1);
  }

  async function submit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const hourlyCostNum = hourlyCost ? Number(hourlyCost.replace(",", ".")) : null;
      // Convertir multi_chip array → texte concaténé (current_tools est `text`)
      const apiAnswers: Record<string, number | string | boolean | null> = {};
      for (const q of QUESTIONS) {
        const v = answers[q.id];
        if (v === null || v === undefined) continue;
        if (q.type === "number") {
          const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
          if (Number.isFinite(n)) apiAnswers[q.id] = n;
        } else if (q.type === "bool") {
          apiAnswers[q.id] = v === true || v === "true";
        } else if (q.type === "multi_chip" && Array.isArray(v)) {
          apiAnswers[q.id] = v.join(", ");
        } else if (typeof v === "string") {
          apiAnswers[q.id] = v;
        }
      }
      const res = await fetch("/api/conversion/diagnostic", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: apiAnswers,
          hourly_cost_eur: hourlyCostNum && Number.isFinite(hourlyCostNum) && hourlyCostNum > 0 ? hourlyCostNum : null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.ok) {
        setSubmitError("Impossible de calculer le diagnostic pour le moment.");
        return;
      }
      setResult(body.result as DiagnosticApiResult);
      emitConversionEvent("result_viewed", { compatibility: body.result.compatibility });
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
      <div className="border-b border-stone-100/80 px-5 py-3 flex items-center gap-3 flex-wrap" aria-live="polite">
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
          {currentQuestion.type === "number" && (
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={100000}
              step="1"
              value={
                typeof answers[currentQuestion.id] === "number"
                  ? String(answers[currentQuestion.id])
                  : (answers[currentQuestion.id] as string | undefined) ?? ""
              }
              onChange={(e) =>
                setAnswer(
                  currentQuestion.id,
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
              placeholder={currentQuestion.unit}
              aria-label={currentQuestion.label}
            />
          )}
          {currentQuestion.type === "single" && currentQuestion.options && (
            <div className="grid grid-cols-1 gap-2">
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
          {currentQuestion.type === "bool" && currentQuestion.options && (
            <div className="flex flex-wrap gap-2">
              {currentQuestion.options.map((opt) => {
                const current = answers[currentQuestion.id];
                const isTrue = (current === true || current === "true") && opt.value === "true";
                const isFalse = (current === false || current === "false") && opt.value === "false";
                const active = isTrue || isFalse;
                return (
                  <button
                    type="button"
                    key={opt.value}
                    aria-pressed={active}
                    onClick={() => setAnswer(currentQuestion.id, opt.value === "true")}
                    className={`text-sm font-semibold px-4 py-2 rounded-full border transition-all ${
                      active
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
                      const nextVal = checked ? current.filter((v) => v !== opt.value) : [...current, opt.value];
                      setAnswer(currentQuestion.id, nextVal);
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
              Estimation financière UNIQUEMENT si vous fournissez vous-même ce coût. Sinon, seules les
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
              disabled={currentQuestion.type !== "multi_chip" && !answerIsPresent(answers[currentQuestion.id])}
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
          <p className="text-xs text-amber-700 bg-amber-50/80 border border-amber-200 rounded-lg px-3 py-2">{submitError}</p>
        )}
      </div>
    </section>
  );
}

function answerIsPresent(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.length > 0;
  return false;
}

function DiagnosticResultView({ result }: { result: DiagnosticApiResult }) {
  const compatibilityLabel = {
    high: "Forte compatibilité",
    medium: "Compatibilité moyenne",
    low: "Périmètre limité",
  }[result.compatibility];

  async function emitCta() {
    try {
      await fetch("/api/conversion/events", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_type: "purchase_cta_clicked",
          idempotency_key: `purchase_cta:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 10)}`,
          source_page: "/diagnostic-rh",
          metadata: { cta: "diagnostic_result_main" },
        }),
        keepalive: true,
      });
    } catch {}
  }

  return (
    <section className="space-y-5">
      <div className="cs-panel px-5 py-5 space-y-2">
        <p className="cs-eyebrow">Résultat — score {result.compatibility_score}/100</p>
        <h2 className="cs-heading text-xl">{compatibilityLabel}</h2>
        <p className="text-sm text-[var(--cs-ink-3)]">
          Estimation basée sur vos réponses. Fourchettes, pas une garantie — toutes les hypothèses sont visibles ci-dessous.
        </p>
      </div>

      <div className="cs-panel px-5 py-5 space-y-2">
        <p className="cs-eyebrow">Volume opérationnel mensuel</p>
        <p className="text-sm text-[var(--cs-ink-2)]">
          Déclaré&nbsp;: {result.operational_load.declared_ops_month} · dérivé&nbsp;:{" "}
          {result.operational_load.derived_ops_month} · base retenue&nbsp;:{" "}
          <strong>{result.operational_load.base_ops_month}</strong>
        </p>
        <p className="text-xs text-[var(--cs-ink-4)]">
          Fourchette LOW {result.volume_estimate.low.operational_hours_month}h ·
          CENTRAL {result.volume_estimate.central.operational_hours_month}h ·
          HIGH {result.volume_estimate.high.operational_hours_month}h
        </p>
      </div>

      {result.financial_saving && (
        <div className="cs-panel px-5 py-5 space-y-2">
          <p className="cs-eyebrow">Économie financière estimée (basée sur le coût horaire que vous avez fourni)</p>
          <p className="text-sm text-[var(--cs-ink-2)]">
            Central&nbsp;: <strong>{result.financial_saving.central_monthly_saving_eur} €/mois</strong>
            {" vs Pierre 449 €/mois."}
          </p>
          <p className="text-xs text-[var(--cs-ink-4)]">{result.financial_saving.note}</p>
        </div>
      )}

      <div className="cs-panel px-5 py-5 space-y-2">
        <p className="cs-eyebrow">Missions Pierre prioritaires</p>
        <ul className="list-disc pl-5 text-sm text-[var(--cs-ink-2)] space-y-1">
          {result.priorities.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </div>

      <div className="cs-panel px-5 py-5 space-y-2">
        <p className="cs-eyebrow">Actions nécessitant validation humaine</p>
        <ul className="list-disc pl-5 text-sm text-[var(--cs-ink-2)] space-y-1">
          {result.actions_requiring_validation.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </div>

      <div className="cs-panel px-5 py-5 space-y-2">
        <p className="cs-eyebrow">Hypothèses utilisées</p>
        <ul className="list-disc pl-5 text-xs text-[var(--cs-ink-3)] space-y-1">
          {Object.entries(result.assumptions).map(([k, v]) => (
            <li key={k}>
              <code>{k}</code>&nbsp;= {String(v)}
            </li>
          ))}
        </ul>
      </div>

      <div className="cs-panel px-5 py-5 space-y-2">
        <p className="cs-eyebrow">Limites</p>
        <ul className="list-disc pl-5 text-xs text-[var(--cs-ink-3)] space-y-1">
          {result.limits.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </div>

      <div className="cs-command-surface text-center space-y-3">
        <p className="cs-eyebrow">Prochaines étapes</p>
        <p className="text-sm text-[var(--cs-ink-2)]">
          Pour activer Pierre : abonnement à 449 €/mois. Aucun paiement ne se déclenche tant que vous ne créez pas votre compte.
        </p>
        <div className="flex flex-wrap justify-center gap-3 pt-1">
          <Link
            href="/agents/pierre"
            onClick={emitCta}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-[var(--cs-violet)] px-6 text-sm font-semibold text-white shadow-lg"
          >
            <span>Voir Pierre — 449 €/mois</span>
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

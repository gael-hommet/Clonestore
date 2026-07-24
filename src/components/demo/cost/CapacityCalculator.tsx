"use client";

// /demo — Acte 6 : le calculateur.
//
// Le visiteur ne lit pas une estimation de CloneStore : il lit ses propres
// données. Chaque montant affiché dérive d'une valeur qu'il a saisie, via le
// moteur pur src/lib/demo/presentation/cost-model.ts. Aucun calcul n'est refait
// ici, aucune hypothèse n'est cachée, et le verdict peut conclure qu'il n'y a
// rien à récupérer — auquel cas l'interface l'affiche sans tricher.

import * as React from "react";
import { RotateCcw, Sigma, ChevronDown } from "lucide-react";

import { GlassSurface } from "../primitives/GlassSurface";
import { SCENE_COST } from "@/lib/demo/presentation/content";
import {
  CAPACITY_FIELDS,
  FTE_BASIS_LABEL,
  ILLUSTRATIVE_INPUTS,
  computeCapacity,
  formatFte,
  formatHours,
  formatInteger,
  formatMoney,
  formatRatio,
  formatSignedMoney,
  sanitizeField,
  type CapacityField,
  type CapacityFieldId,
  type CapacityInputs,
  type CapacityResult,
} from "@/lib/demo/presentation/cost-model";
import {
  SUPPORTED_LAUNCH_COUNTRIES,
  type LaunchCountry,
} from "@/lib/clonestore/pricing/country-pricing";

const COUNTRY_LABEL: Record<LaunchCountry, string> = {
  FR: "France",
  BE: "Belgique",
  LU: "Luxembourg",
  CH: "Suisse",
};

/** Valeur affichée d'un champ, dans l'unité du champ. */
function displayValue(field: CapacityField, value: number, currency: string): string {
  switch (field.unit) {
    case "money":
      return formatMoney(value * 100, currency);
    case "percent":
      return `${value} %`;
    case "count":
      return formatInteger(value);
    case "people":
      return String(value);
  }
}

/** Ce qu'un lecteur d'écran doit entendre : la valeur ET son sens. */
function valueText(field: CapacityField, value: number, currency: string): string {
  const shown = displayValue(field, value, currency);
  switch (field.unit) {
    case "money":
      return `${shown} par mois`;
    case "percent":
      return `${shown} du temps`;
    case "people":
      return value <= 1 ? `${value} collaborateur` : `${value} collaborateurs`;
    case "count":
      return `${shown} opérations par mois`;
  }
}

function FieldRow({
  field,
  value,
  currency,
  onChange,
}: {
  field: CapacityField;
  value: number;
  currency: string;
  onChange: (id: CapacityFieldId, value: number) => void;
}) {
  const inputId = `demo-cost-input-${field.id}`;
  const hintId = `demo-cost-hint-${field.id}`;

  return (
    <div className="demo-cost-field">
      <div className="demo-cost-field__top">
        <label className="demo-cost-field__label" htmlFor={inputId}>
          {field.label}
        </label>
        <div className="demo-cost-field__entry">
          <input
            id={inputId}
            type="number"
            inputMode="numeric"
            className="demo-cost-number"
            min={field.min}
            max={field.max}
            step={field.step}
            value={value}
            aria-describedby={hintId}
            onChange={(event) => onChange(field.id, sanitizeField(field.id, event.target.value))}
            // DEMO AND MOBILE CONVERSION CLOSURE (2026-07-24) — ISSUE-04 root cause: this app
            // renders no caret-color anywhere (confirmed by a full-repo search across every
            // component and stylesheet), yet a prior real-browser capture showed React flagging
            // a server/client mismatch on `style={{caret-color:"transparent"}}` for EVERY
            // range/number input uniformly, regardless of field/value. That "applies to all
            // matching inputs identically, independent of content" signature is the documented
            // fingerprint of a third-party extension (password manager / dark-mode / a11y tool)
            // injecting the style into form fields before hydration — not app code. Suppressing
            // only for that externally-injected, non-deterministic attribute; this input's own
            // value/attributes stay fully controlled and asserted deterministic by tests below.
            suppressHydrationWarning
          />
          <span className="demo-cost-field__unit" aria-hidden="true">
            {field.unit === "money" ? (currency === "CHF" ? "CHF" : "€") : field.unit === "percent" ? "%" : ""}
          </span>
        </div>
      </div>

      <p id={hintId} className="demo-cost-field__hint">
        {field.hint}
      </p>

      <input
        type="range"
        className="demo-cost-slider"
        min={field.min}
        max={field.max}
        step={field.step}
        value={value}
        aria-label={field.label}
        aria-valuetext={valueText(field, value, currency)}
        onChange={(event) => onChange(field.id, sanitizeField(field.id, event.target.value))}
        // Same ISSUE-04 justification as the sibling number input above.
        suppressHydrationWarning
      />

      <div className="demo-cost-slider__scale" aria-hidden="true">
        <span>{displayValue(field, field.min, currency)}</span>
        <span className="demo-cost-slider__now">{displayValue(field, value, currency)}</span>
        <span>{displayValue(field, field.max, currency)}</span>
      </div>
    </div>
  );
}

/** Une ligne de la balance : la largeur est proportionnelle au montant réel. */
function BalanceBar({
  label,
  minor,
  maxMinor,
  currency,
  tone,
}: {
  label: string;
  minor: number;
  maxMinor: number;
  currency: string;
  tone: "statusquo" | "recoverable" | "subscription";
}) {
  const width = maxMinor > 0 ? Math.max(2, Math.round((minor * 100) / maxMinor)) : 2;
  return (
    <div className="demo-cost-bar">
      <div className="demo-cost-bar__head">
        <span className="demo-cost-bar__label">{label}</span>
        <span className="demo-cost-bar__value">{formatMoney(minor, currency)}</span>
      </div>
      <div className="demo-cost-bar__track">
        <div
          className={`demo-cost-bar__fill demo-cost-bar__fill--${tone}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

function ResultCell({ k, v, note }: { k: string; v: string; note?: string }) {
  return (
    <div className="demo-cost-cell">
      <p className="demo-cost-cell__k">{k}</p>
      <p className="demo-cost-cell__v">{v}</p>
      {note ? <p className="demo-cost-cell__note">{note}</p> : null}
    </div>
  );
}

function Verdict({ result, currency }: { result: CapacityResult; currency: string }) {
  const verdict = SCENE_COST.verdicts[result.verdict];
  const favourable = result.netMonthlyMinor > 0;

  return (
    <div className={`demo-cost-verdict demo-cost-verdict--${result.verdict}`}>
      <div className="demo-cost-verdict__head">
        <span className="demo-cost-verdict__badge">{verdict.label}</span>
        {favourable ? (
          <span className="demo-cost-verdict__ratio">
            {formatRatio(result.ratioBps)} l&apos;abonnement
          </span>
        ) : null}
      </div>
      <p className="demo-cost-verdict__line">{verdict.line}</p>
      <p className="demo-cost-verdict__detail">{verdict.detail}</p>

      <div className="demo-cost-verdict__net">
        <span className="demo-cost-verdict__net-k">
          Écart net {favourable ? "potentiel" : ""} — sur douze mois
        </span>
        <span className="demo-cost-verdict__net-v">
          {formatSignedMoney(result.netAnnualMinor, currency)}
        </span>
      </div>
    </div>
  );
}

export function CapacityCalculator({ onAdjust }: { onAdjust: () => void }) {
  const [inputs, setInputs] = React.useState<CapacityInputs>(ILLUSTRATIVE_INPUTS);
  const [country, setCountry] = React.useState<LaunchCountry>("FR");

  const result = React.useMemo(() => computeCapacity(inputs, country), [inputs, country]);
  const currency = result.currency;

  const handleChange = React.useCallback(
    (id: CapacityFieldId, value: number) => {
      setInputs((prev) => ({ ...prev, [id]: value }));
      onAdjust();
    },
    [onAdjust],
  );

  const reset = React.useCallback(() => {
    setInputs(ILLUSTRATIVE_INPUTS);
  }, []);

  const pristine = React.useMemo(
    () => CAPACITY_FIELDS.every((f) => inputs[f.id] === ILLUSTRATIVE_INPUTS[f.id]),
    [inputs],
  );

  const business = CAPACITY_FIELDS.filter((f) => !f.assumption);
  const assumptions = CAPACITY_FIELDS.filter((f) => f.assumption);

  // La balance est mise à l'échelle du plus grand montant → les barres restent comparables.
  const maxMinor = Math.max(
    result.statusQuoMonthlyMinor,
    result.recoverableMonthlyMinor,
    result.subscriptionMonthlyMinor,
  );

  return (
    <div className="demo-cost-calc">
      {/* ── Entrées ── */}
      <GlassSurface kind="read" weight="card" className="demo-cost-inputs rounded-[1.6rem] p-5 sm:p-6">
        <div className="demo-cost-inputs__head">
          <div>
            <p className="demo-kicker">{SCENE_COST.calcKicker}</p>
            <p className="demo-cost-inputs__title">{SCENE_COST.calcTitle}</p>
          </div>
          <button
            type="button"
            onClick={reset}
            className="demo-btn demo-btn-ghost demo-cost-reset"
            disabled={pristine}
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Rétablir l&apos;exemple
          </button>
        </div>

        <p className="demo-cost-illustrative">{SCENE_COST.calcIllustrative}</p>

        <fieldset className="demo-cost-fieldset">
          <legend className="demo-cost-legend">Les données de votre entreprise</legend>
          {business.map((field) => (
            <FieldRow
              key={field.id}
              field={field}
              value={inputs[field.id]}
              currency={currency}
              onChange={handleChange}
            />
          ))}
        </fieldset>

        <fieldset className="demo-cost-fieldset demo-cost-fieldset--assumptions">
          <legend className="demo-cost-legend">{SCENE_COST.calcAssumptionsTitle}</legend>
          <p className="demo-cost-assumptions__note">{SCENE_COST.calcAssumptionsNote}</p>
          {assumptions.map((field) => (
            <FieldRow
              key={field.id}
              field={field}
              value={inputs[field.id]}
              currency={currency}
              onChange={handleChange}
            />
          ))}
        </fieldset>

        <div className="demo-cost-country">
          <p className="demo-cost-country__k">Pays de référence — le tarif en dépend</p>
          <div className="demo-cost-country__row" role="group" aria-label="Pays de référence">
            {SUPPORTED_LAUNCH_COUNTRIES.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setCountry(code)}
                aria-pressed={code === country}
                className={`demo-cost-country__btn ${code === country ? "demo-cost-country__btn--on" : ""}`}
              >
                {COUNTRY_LABEL[code]}
              </button>
            ))}
          </div>
          <p className="demo-cost-country__price">
            Employé IA — {result.subscriptionDisplay}
          </p>
        </div>
      </GlassSurface>

      {/* ── Résultats ── */}
      <GlassSurface
        kind="material"
        weight="structure"
        sheen
        className="demo-cost-results rounded-[1.6rem] p-5 sm:p-6"
      >
        <div className="demo-cost-results__hero">
          <p className="demo-cost-results__k">Coût du statu quo — sur douze mois</p>
          <p className="demo-cost-results__v">{formatMoney(result.statusQuoAnnualMinor, currency)}</p>
          <p className="demo-cost-results__sub">
            Soit {formatMoney(result.statusQuoMonthlyMinor, currency)} par mois de capacité opérationnelle
            mobilisée sur le travail répétitif, les prestataires et les outils.
          </p>
        </div>

        {/* Toute recomputation est annoncée aux lecteurs d'écran. */}
        <p className="demo-cost-live" aria-live="polite">
          Coût du statu quo : {formatMoney(result.statusQuoAnnualMinor, currency)} par an. Capacité
          récupérable : {formatMoney(result.recoverableMonthlyMinor, currency)} par mois, soit{" "}
          {formatHours(result.recoverableMinutesMonthly)} par mois. Écart net sur douze mois :{" "}
          {formatSignedMoney(result.netAnnualMinor, currency)}. {SCENE_COST.verdicts[result.verdict].line}
        </p>

        <div className="demo-cost-cells">
          <ResultCell
            k="Temps mobilisé"
            v={`${formatHours(result.mobilisedMinutesMonthly)} / mois`}
            note="Sur les tâches répétitives"
          />
          <ResultCell
            k="Capacité récupérable"
            v={`${formatHours(result.recoverableMinutesMonthly)} / mois`}
            note="Bornée par vos hypothèses"
          />
          <ResultCell
            k="Équivalent temps plein"
            v={formatFte(result.recoverableFteCenti)}
            note={FTE_BASIS_LABEL}
          />
          <ResultCell
            k="Coût moyen d'une opération"
            v={
              result.currentCostPerOperationMinor === null
                ? "—"
                : formatMoney(result.currentCostPerOperationMinor, currency)
            }
            note="Aujourd'hui, hors employé IA"
          />
        </div>

        <div className="demo-cost-balance">
          <BalanceBar
            label="Coût mensuel mobilisé — le statu quo"
            minor={result.statusQuoMonthlyMinor}
            maxMinor={maxMinor}
            currency={currency}
            tone="statusquo"
          />
          <BalanceBar
            label="Capacité récupérable — à confirmer sur votre périmètre"
            minor={result.recoverableMonthlyMinor}
            maxMinor={maxMinor}
            currency={currency}
            tone="recoverable"
          />
          <BalanceBar
            label="Abonnement de l'employé IA"
            minor={result.subscriptionMonthlyMinor}
            maxMinor={maxMinor}
            currency={currency}
            tone="subscription"
          />
        </div>

        <div className="demo-cost-buckets">
          <div className="demo-cost-bucket">
            <span className="demo-cost-bucket__k">Temps récupérable</span>
            <span className="demo-cost-bucket__v">
              {formatMoney(result.recoverableCapacityMonthlyMinor, currency)} / mois
            </span>
            <span className="demo-cost-bucket__note">
              Du temps rendu à votre équipe. Pas une suppression de poste.
            </span>
          </div>
          <div className="demo-cost-bucket">
            <span className="demo-cost-bucket__k">Prestataires et outils substituables</span>
            <span className="demo-cost-bucket__v">
              {formatMoney(result.externalReplaceableMonthlyMinor, currency)} / mois
            </span>
            <span className="demo-cost-bucket__note">
              Selon la part que vous jugez réellement substituable.
            </span>
          </div>
          <div className="demo-cost-bucket">
            <span className="demo-cost-bucket__k">Recrutement évitable</span>
            <span className="demo-cost-bucket__v">{formatFte(result.recoverableFteCenti)} ETP</span>
            <span className="demo-cost-bucket__note">
              Selon le périmètre confié — à confirmer par votre entreprise.
            </span>
          </div>
        </div>

        <Verdict result={result} currency={currency} />

        <details className="demo-cost-method">
          <summary className="demo-cost-method__summary">
            <Sigma className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{SCENE_COST.calcMethodTitle}</span>
            <ChevronDown className="demo-cost-method__chev h-4 w-4" aria-hidden="true" />
          </summary>
          <ul className="demo-cost-method__list">
            {SCENE_COST.calcMethod.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <ul className="demo-cost-method__limits">
            {SCENE_COST.calcLimits.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </details>
      </GlassSurface>
    </div>
  );
}

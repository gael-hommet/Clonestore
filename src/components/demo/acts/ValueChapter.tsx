"use client";

// /demo — CH.3 : L'ÉCHELLE ANNUELLE. Le grand moment de valeur.
//
// Séquence (une idée à la fois, en sous-scènes) :
//   1. LES TROIS GRANDS CHIFFRES (capacité libérée / heures reprises / charge
//      absorbée) + profils de volume (groupe multi-sites par défaut) ;
//   2. LE GRAND TABLEAU ANNUEL par référence (élite / Brouillon / Exécution
//      partagée / Autonomie gouvernée) ;
//   3. LE TRAVAIL QUE VOTRE ÉQUIPE N'A PLUS À PORTER (proxys opérationnels) ;
//   4. LES SCÉNARIOS (une mission forte à la fois).
// Hypothèses : « Modifier les hypothèses » (curseurs live) et « Voir le calcul »
// (formules, occurrences, borne du modèle). Chiffres 100 % dérivés (value-model).
// Jamais une garantie — estimations, ordres de grandeur, selon volumes affichés.

import * as React from "react";
import { ArrowRight, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Reveal } from "../primitives/motion";
import { CineEyebrow, CineTitle, CineLede, Disclosure } from "../primitives/cine";
import {
  VALUE_REFERENCES,
  VOLUME_PROFILES,
  DEFAULT_PROFILE_ID,
  VALUE_SCENARIO_IDS,
  VALUE_WORDING,
  PREPARED_WEIGHT,
  annualValue,
  scenarioValue,
  modelUpperBound,
  formatMoney,
  formatMillions,
  formatHours,
  formatInteger,
  type ValueReferenceId,
  type VolumeProfile,
} from "@/lib/demo/presentation/value-model";
import {
  CAPACITY_FIELDS,
  sanitizeField,
  type CapacityInputs,
  FTE_BASIS_LABEL,
} from "@/lib/demo/presentation/cost-model";
import { HR_SCENARIOS } from "@/lib/demo/presentation/operating-model";

const REF_LABEL: Record<ValueReferenceId, string> = Object.fromEntries(
  VALUE_REFERENCES.map((r) => [r.id, r.label]),
) as Record<ValueReferenceId, string>;

function BigMetric({ value, label, accent = false }: { value: string; label: string; accent?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <p
        className={cn("font-semibold leading-none tracking-[-0.035em]", accent ? "text-[var(--demo-violet-deep)]" : "text-[var(--cs-ink-1)]")}
        style={{ fontSize: "clamp(2rem, min(5.4vw, 7.4svh), 4.4rem)" }}
      >
        {value}
      </p>
      <p className="text-[0.78rem] font-bold uppercase tracking-[0.14em] text-[var(--cs-ink-4)]">{label}</p>
    </div>
  );
}

export function ValueChapter() {
  const [profileId, setProfileId] = React.useState<VolumeProfile["id"] | "custom">(DEFAULT_PROFILE_ID);
  const [customInputs, setCustomInputs] = React.useState<CapacityInputs>(
    VOLUME_PROFILES.find((p) => p.id === DEFAULT_PROFILE_ID)!.inputs,
  );
  const [scenarioId, setScenarioId] = React.useState<string>(VALUE_SCENARIO_IDS[0]);

  const baseProfile = VOLUME_PROFILES.find((p) => p.id === (profileId === "custom" ? DEFAULT_PROFILE_ID : profileId))!;
  const annual = React.useMemo(
    () => (profileId === "custom" ? annualValue(customInputs, baseProfile) : annualValue(baseProfile.id)),
    [profileId, customInputs, baseProfile],
  );
  const view = React.useMemo(() => scenarioValue(scenarioId), [scenarioId]);
  const upper = React.useMemo(() => modelUpperBound(), []);

  const governed = annual.perReference.find((v) => v.reference === "governed")!;
  const elite = annual.perReference.find((v) => v.reference === "elite")!;

  const setField = (id: keyof CapacityInputs, raw: number) => {
    setProfileId("custom");
    setCustomInputs((prev) => ({ ...prev, [id]: sanitizeField(id, raw) }));
  };

  return (
    <section id="demo-act-value" className="demo-section" aria-label="L'échelle annuelle — la valeur créée">
      <div className="demo-shell">
        {/* ══ 1. LES TROIS GRANDS CHIFFRES ══════════════════════════════════ */}
        <Reveal className="w-full">
          <div className="cine-sub">
            <CineEyebrow n="03">L&apos;échelle annuelle</CineEyebrow>
            <CineTitle size="sm">
              Sur douze mois, voici ce que <span className="cine-accent">Pierre libère.</span>
            </CineTitle>

            {/* Profils de volume — le groupe à forte activité est le défaut. */}
            <div className="flex flex-wrap justify-center gap-1.5" role="tablist" aria-label="Profils de volume">
              {VOLUME_PROFILES.map((p) => {
                const on = profileId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => setProfileId(p.id)}
                    className={cn(
                      "rounded-full border px-3.5 py-1.5 text-[0.8rem] font-semibold transition-colors",
                      on
                        ? "border-[var(--demo-violet)] bg-[rgba(107,99,232,0.1)] text-[var(--demo-violet-deep)]"
                        : "border-[var(--cs-line)] bg-white/45 text-[var(--cs-ink-3)] hover:border-[var(--cs-ink-4)]",
                    )}
                  >
                    {p.label}
                  </button>
                );
              })}
              <span
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-[0.8rem] font-semibold",
                  profileId === "custom"
                    ? "border-[var(--demo-violet)] bg-[rgba(107,99,232,0.1)] text-[var(--demo-violet-deep)]"
                    : "border-[var(--cs-line)] bg-white/45 text-[var(--cs-ink-4)]",
                )}
              >
                Volume personnalisé
              </span>
            </div>
            <p className="text-[0.8rem] text-[var(--cs-ink-3)]">
              {profileId === "custom" ? "Hypothèses personnalisées — voir « Modifier les hypothèses »." : annual.profile.tagline}
            </p>

            <div className="mt-2 grid w-full max-w-4xl gap-6 sm:grid-cols-3">
              <BigMetric value={formatMillions(annual.capacity.recoverableAnnualMinor, annual.currency)} label="de capacité libérée sur 12 mois" accent />
              <BigMetric value={formatHours(governed.recoveredMinutesYear)} label="de travail humain repris / an" />
              <BigMetric value={formatInteger(annual.pain.total)} label="interruptions, relances et suivis absorbés" />
            </div>
            <p className="text-[0.76rem] text-[var(--cs-ink-4)]">
              {VALUE_WORDING.illustrative} {VALUE_WORDING.basis}
            </p>

            {/* Hypothèses modifiables + calcul — derrière des boutons discrets. */}
            <div className="flex flex-wrap justify-center gap-2">
              <Disclosure summary={VALUE_WORDING.editAssumptions}>
                <p className="text-[0.82rem] text-[var(--cs-ink-3)]">
                  {annual.profile.tagline} — chaque curseur recalcul instantanément. {FTE_BASIS_LABEL}.
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {CAPACITY_FIELDS.map((f) => {
                    const val = (profileId === "custom" ? customInputs : annual.profile.inputs)[f.id];
                    return (
                      <label key={f.id} className="block rounded-xl border border-[var(--cs-line)] bg-white/50 px-3 py-2.5 text-left">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="text-[0.78rem] font-semibold text-[var(--cs-ink-1)]">{f.label}</span>
                          <span className="text-[0.82rem] font-bold tabular-nums text-[var(--demo-violet-deep)]">
                            {formatInteger(val)}
                            {f.unit ? ` ${f.unit}` : ""}
                          </span>
                        </span>
                        <input
                          type="range"
                          min={f.min}
                          max={f.max}
                          step={f.step}
                          value={val}
                          onChange={(e) => setField(f.id, Number(e.target.value))}
                          className="demo-cost-slider mt-1.5 w-full"
                          aria-valuetext={`${formatInteger(val)}${f.unit ? ` ${f.unit}` : ""}`}
                          // DEMO AND MOBILE CONVERSION CLOSURE (2026-07-24) — same ISSUE-04
                          // third-party-extension caret-color false positive as
                          // CapacityCalculator.tsx; see the justification comment there.
                          suppressHydrationWarning
                        />
                      </label>
                    );
                  })}
                </div>
              </Disclosure>

              <Disclosure summary={VALUE_WORDING.seeCalc}>
                <ul className="space-y-2 text-left text-[0.86rem] leading-relaxed text-[var(--cs-ink-2)]">
                  <li>
                    <strong>€ (annuel).</strong> Formules du calculateur : coût mobilisé = collaborateurs × coût employeur ;
                    répétitif = × part répétitive ; capacité récupérable = répétitif × part couverte + (prestataires +
                    outils) × part substituable ; net = récupérable − abonnement ({annual.subscriptionDisplay}).
                  </li>
                  <li>
                    <strong>Temps.</strong> Minutes déclarées étape par étape de chaque situation × occurrences annuelles
                    du profil&nbsp;: {Object.entries(annual.profile.assumptions.occurrencesPerYear)
                      .map(([id, n]) => `${HR_SCENARIOS.find((s) => s.id === id)?.trigger ?? id} ×${n}`)
                      .join(" · ")}. {VALUE_WORDING.modeled}
                  </li>
                  <li>
                    <strong>Niveaux.</strong> Brouillon = matrice d&apos;autonomie réelle (préparé compte pour {PREPARED_WEIGHT},
                    hypothèse affichée) ; Exécution partagée = point médian déclaré ; Autonomie gouvernée = résidu humain
                    déclaré étape par étape.
                  </li>
                  <li>
                    <strong>Borne du modèle.</strong> Tous curseurs au maximum, le calculateur plafonne à{" "}
                    {formatMillions(upper.recoverableAnnualMinor, "EUR")}/an — c&apos;est une borne, pas un profil : aucun
                    chiffre n&apos;est promis à « n&apos;importe quelle entreprise ».
                  </li>
                  <li>
                    <strong>Limites.</strong> {VALUE_WORDING.estimation} Aucune suppression de poste n&apos;en est déduite ;
                    un temps repris se réaffecte, absorbe une croissance ou évite un recrutement — votre décision.
                  </li>
                </ul>
              </Disclosure>
            </div>
          </div>
        </Reveal>

        {/* ══ 2. LE GRAND TABLEAU ANNUEL ════════════════════════════════════ */}
        <Reveal className="w-full">
          <div className="cine-sub">
            <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-[var(--cs-ink-4)]">
              Le tableau annuel — quatre références, mêmes situations
            </p>
            <div className="w-full max-w-4xl overflow-x-auto">
              <table className="w-full min-w-[680px] border-separate border-spacing-y-1.5 text-left text-[0.82rem]">
                <thead>
                  <tr className="text-[0.68rem] font-bold uppercase tracking-[0.1em] text-[var(--cs-ink-4)]">
                    <th className="px-3 py-1">Référence</th>
                    <th className="px-3 py-1">Temps humain / an</th>
                    <th className="px-3 py-1">ETP mobilisé</th>
                    <th className="px-3 py-1">Capacité libérée</th>
                    <th className="px-3 py-1">Coût Pierre</th>
                    <th className="px-3 py-1">Valeur après abonnement</th>
                    <th className="px-3 py-1">Écart vs élite</th>
                  </tr>
                </thead>
                <tbody>
                  {annual.perReference.map((v) => {
                    const ref = VALUE_REFERENCES.find((r) => r.id === v.reference)!;
                    const isGoverned = v.reference === "governed";
                    return (
                      <tr
                        key={v.reference}
                        className={cn(
                          "rounded-xl",
                          isGoverned ? "bg-[rgba(107,99,232,0.08)]" : "bg-white/55",
                        )}
                      >
                        <td className="rounded-l-xl px-3 py-2.5">
                          <span className="flex items-center gap-1.5 font-semibold text-[var(--cs-ink-1)]">
                            {ref.isHumanBaseline ? <Users className="h-3.5 w-3.5 text-[var(--cs-ink-4)]" aria-hidden /> : null}
                            {ref.label}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-semibold tabular-nums">{formatHours(v.humanMinutesYear)}</td>
                        <td className="px-3 py-2.5 tabular-nums">{(v.fteCenti / 100).toFixed(1).replace(".", ",")} ETP</td>
                        <td className="px-3 py-2.5 tabular-nums">
                          {ref.isHumanBaseline ? "—" : formatMoney(v.capacityValueMinor, annual.currency)}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums">
                          {ref.isHumanBaseline ? "—" : formatMoney(v.pierreCostMinor, annual.currency)}
                        </td>
                        <td className={cn("px-3 py-2.5 font-semibold tabular-nums", isGoverned && "text-[var(--demo-violet-deep)]")}>
                          {ref.isHumanBaseline ? "référence" : formatMoney(v.netValueMinor, annual.currency)}
                        </td>
                        <td className="rounded-r-xl px-3 py-2.5 tabular-nums">
                          {ref.isHumanBaseline ? "—" : `−${formatHours(elite.humanMinutesYear - v.humanMinutesYear)} humaines`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-[0.74rem] text-[var(--cs-ink-4)]">
              {VALUE_WORDING.eliteNote} Coût employeur, prestataires et outils du profil : voir « {VALUE_WORDING.seeCalc} ».
            </p>
          </div>
        </Reveal>

        {/* ══ 3. LE TRAVAIL QUE VOTRE ÉQUIPE N'A PLUS À PORTER ═════════════ */}
        <Reveal className="w-full">
          <div className="cine-sub">
            <CineTitle size="sm">
              Le travail que votre équipe <span className="cine-accent">n&apos;a plus à porter.</span>
            </CineTitle>
            <CineLede>Des proxys opérationnels comptés dans les étapes déclarées — pas une promesse de bien-être.</CineLede>
            <div className="grid w-full max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { v: annual.pain.interruptions, l: "interruptions humaines évitées / an" },
                { v: annual.pain.relances, l: "relances prises en charge / an" },
                { v: annual.pain.boucles, l: "boucles ouvertes suivies jusqu'à clôture" },
                { v: annual.pain.documents, l: "documents & communications préparés" },
              ].map((m) => (
                <div key={m.l} className="rounded-2xl border border-[var(--cs-line)] bg-white/55 px-3 py-3.5 text-center">
                  <p className="text-[1.7rem] font-semibold leading-none tabular-nums text-[var(--cs-ink-1)]">
                    {formatInteger(m.v)}
                  </p>
                  <p className="mt-1 text-[0.7rem] leading-snug text-[var(--cs-ink-4)]">{m.l}</p>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        {/* ══ 4. LES SCÉNARIOS — une mission forte à la fois ═══════════════ */}
        <Reveal className="w-full">
          <div className="cine-sub">
            <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-[var(--cs-ink-4)]">
              Situation par situation — temps humain mobilisé
            </p>
            <div className="flex flex-wrap justify-center gap-1.5" role="tablist" aria-label="Situations RH">
              {VALUE_SCENARIO_IDS.map((id) => {
                const s = HR_SCENARIOS.find((x) => x.id === id);
                if (!s) return null;
                const on = id === scenarioId;
                return (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => setScenarioId(id)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-[0.78rem] font-semibold transition-colors",
                      on
                        ? "border-[var(--demo-violet)] bg-[rgba(107,99,232,0.1)] text-[var(--demo-violet-deep)]"
                        : "border-[var(--cs-line)] bg-white/45 text-[var(--cs-ink-3)] hover:border-[var(--cs-ink-4)]",
                    )}
                  >
                    {s.trigger}
                  </button>
                );
              })}
            </div>

            {view ? (
              <div key={view.scenario.id} className="w-full max-w-3xl rounded-2xl border border-[var(--cs-line)] bg-white/55 p-4 text-left sm:p-5">
                <p className="text-[0.92rem] font-medium text-[var(--cs-ink-2)]">{view.scenario.stake}</p>
                <p className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-[2rem] font-semibold leading-none tracking-[-0.03em] text-[var(--cs-ink-1)] sm:text-[2.6rem]">
                    {formatHours(view.views[0].humanMinutes)}
                  </span>
                  <ArrowRight className="h-5 w-5 self-center text-[var(--cs-ink-4)]" aria-hidden />
                  <span className="text-[2rem] font-semibold leading-none tracking-[-0.03em] text-[var(--demo-violet)] sm:text-[2.6rem]">
                    {formatHours(view.views[3].humanMinutes)}
                  </span>
                  <span className="text-[0.78rem] text-[var(--cs-ink-4)]">temps humain — élite → autonomie gouvernée</span>
                </p>

                <div className="mt-4 grid gap-1.5">
                  {view.views.map((v) => (
                    <div
                      key={v.reference}
                      className={cn(
                        "grid items-center gap-x-3 rounded-xl border px-3 py-2 sm:grid-cols-[1.35fr_1fr_1fr]",
                        v.reference === "governed"
                          ? "border-[var(--demo-violet-soft)] bg-[rgba(107,99,232,0.06)]"
                          : "border-transparent bg-white/45",
                      )}
                    >
                      <p className="text-[0.84rem] font-semibold text-[var(--cs-ink-1)]">{REF_LABEL[v.reference]}</p>
                      <p className="text-[0.78rem] text-[var(--cs-ink-2)]">
                        <span className="text-[var(--cs-ink-4)]">Temps humain&nbsp;:</span>{" "}
                        <strong className="tabular-nums">{formatHours(v.humanMinutes)}</strong>
                      </p>
                      <p className="text-[0.78rem] text-[var(--cs-ink-2)]">
                        <span className="text-[var(--cs-ink-4)]">Repris par Pierre&nbsp;:</span>{" "}
                        <strong className="tabular-nums">{v.recoveredMinutes > 0 ? formatHours(v.recoveredMinutes) : "—"}</strong>
                      </p>
                    </div>
                  ))}
                </div>

                <p className="mt-3 text-[0.76rem] text-[var(--cs-ink-4)]">
                  {view.pain.relances} relances · {view.pain.attentes} attentes suivies · {view.pain.interruptions}{" "}
                  coordinations · {view.pain.controles} contrôles — absorbés dans cette mission.{" "}
                  {VALUE_WORDING.estimation}
                </p>
              </div>
            ) : null}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

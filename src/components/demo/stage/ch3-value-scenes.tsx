"use client";

// /demo — CHAPITRE 3 (scènes 11-12) : le VALUE LAB interactif, entièrement dérivé des modèles
// CANONIQUES (value-model / cost-model). Aucun second moteur, aucun chiffre écrit en dur dès qu'il
// est calculable. Trois modes Pierre (draft/copilot/governed) + référence humaine elite = « SANS
// CLONESTORE ». Profils pme/scaleup/groupe. Périodes mission/mois/année. Client-only (useState) :
// l'état initial est déterministe (groupe/governed/année) donc SSR et hydratation concordent.

import * as React from "react";
import { motion } from "framer-motion";
import { CineEyebrow } from "../primitives/cine";
import { DemoCTAButton } from "../primitives/DemoCTA";
import {
  VOLUME_PROFILES,
  VALUE_REFERENCES,
  VALUE_SCENARIO_IDS,
  annualValue,
  scenarioValue,
  VALUE_WORDING,
} from "@/lib/demo/presentation/value-model";
import { formatHours, formatMoney, formatSignedMoney } from "@/lib/demo/presentation/cost-model";

// Trois modes Pierre sélectionnables (elite reste la référence humaine, jamais dans le sélecteur).
const PIERRE_MODES = VALUE_REFERENCES.filter((r) => !r.isHumanBaseline);
type PierreModeId = "draft" | "copilot" | "governed";
type ProfileId = (typeof VOLUME_PROFILES)[number]["id"];
type Period = "mission" | "month" | "year";

const PERIODS: readonly { id: Period; label: string }[] = [
  { id: "mission", label: "Mission" },
  { id: "month", label: "Mois" },
  { id: "year", label: "Année" },
];

const oneDecimal = (n: number) => (Math.round(n * 10) / 10).toString().replace(".", ",");

/** Contrôle segmenté accessible (radiogroup) — compact, empilable sur mobile. */
function Seg<T extends string>({
  label, value, options, onChange,
}: {
  label: string;
  value: T;
  options: readonly { id: T; label: string }[];
  onChange: (id: T) => void;
}) {
  return (
    <div className="demo-seg">
      <span className="demo-seg__label">{label}</span>
      <div className="demo-seg__opts" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={o.id === value}
            className={`demo-seg__opt${o.id === value ? " demo-seg__opt--on" : ""}`}
            onClick={() => onChange(o.id)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────── SCÈNE 11 — COMPARATEUR DE TEMPS ─────────────────────── */
export function SceneTimeComparator({
  onAdvance,
  onModeChange,
  onScenarioChange,
}: {
  onAdvance: () => void;
  onModeChange?: (id: string) => void;
  onScenarioChange?: (id: string) => void;
}) {
  const [profileId, setProfileId] = React.useState<ProfileId>("groupe");
  const [modeId, setModeId] = React.useState<PierreModeId>("governed");
  const [period, setPeriod] = React.useState<Period>("year");
  const [detail, setDetail] = React.useState(false);

  // Minutes humaines SANS (elite) et AVEC (mode) — dérivées du modèle canonique, jamais écrites.
  const m = React.useMemo(() => {
    if (period === "mission") {
      const sv = scenarioValue(VALUE_SCENARIO_IDS[0]);
      const e = sv?.views.find((v) => v.reference === "elite");
      const mo = sv?.views.find((v) => v.reference === modeId);
      return { sans: e?.humanMinutes ?? 0, avec: mo?.humanMinutes ?? 0 };
    }
    const av = annualValue(profileId);
    const e = av.perReference.find((r) => r.reference === "elite")!;
    const mo = av.perReference.find((r) => r.reference === modeId)!;
    const d = period === "month" ? 12 : 1;
    return { sans: Math.round(e.humanMinutesYear / d), avec: Math.round(mo.humanMinutesYear / d) };
  }, [profileId, modeId, period]);

  const recovered = Math.max(0, m.sans - m.avec);
  const pct = m.sans > 0 ? Math.round((recovered / m.sans) * 100) : 0;
  const mult = m.avec > 0 ? oneDecimal(m.sans / m.avec) : "∞";
  const barAvec = m.sans > 0 ? Math.max(2, Math.round((m.avec / m.sans) * 100)) : 0;
  const perLabel = period === "year" ? "/an" : period === "month" ? "/mois" : "";
  const modeLabel = PIERRE_MODES.find((x) => x.id === modeId)?.label ?? "";

  return (
    <div className="demo-scene-body demo-lab">
      <CineEyebrow>Comparateur de temps</CineEyebrow>
      <h2 className="cine-title cine-title--sm demo-scene-title">Le même travail. Une différence aberrante.</h2>

      <div className="demo-lab-controls">
        <Seg label="Organisation" value={profileId} onChange={setProfileId}
          options={VOLUME_PROFILES.map((p) => ({ id: p.id, label: p.label }))} />
        <Seg label="Mode Pierre" value={modeId} onChange={(v) => { setModeId(v); onModeChange?.(v); }}
          options={PIERRE_MODES.map((r) => ({ id: r.id as PierreModeId, label: r.label }))} />
        <Seg label="Période" value={period} onChange={(v) => { setPeriod(v); onScenarioChange?.(v); }} options={PERIODS} />
      </div>

      <div className="demo-tcmp">
        <div className="demo-tcmp__row">
          <span className="demo-tcmp__tag">Sans CloneStore <em>· équipe humaine élite</em></span>
          <div className="demo-tcmp__barwrap"><div className="demo-tcmp__bar demo-tcmp__bar--full" /></div>
          <span className="demo-tcmp__val">{formatHours(m.sans)}</span>
        </div>
        <div className="demo-tcmp__row">
          <span className="demo-tcmp__tag demo-tcmp__tag--on">Avec CloneStore <em>· {modeLabel.toLowerCase()}</em></span>
          <div className="demo-tcmp__barwrap">
            <motion.div className="demo-tcmp__bar demo-tcmp__bar--on" initial={false}
              animate={{ width: `${barAvec}%` }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }} />
          </div>
          <span className="demo-tcmp__val demo-tcmp__val--on">{formatHours(m.avec)}</span>
        </div>
      </div>

      <div className="demo-lab-headline">
        <span className="demo-lab-headline__num">−{pct}%</span>
        <span className="demo-lab-headline__lbl">de temps humain · {formatHours(recovered)} récupéré{perLabel} · ×{mult} plus rapide</span>
      </div>

      <div className="demo-scene-actions">
        <DemoCTAButton onClick={onAdvance} variant="primary" hero withArrow>Voir l&apos;impact financier</DemoCTAButton>
        <div className="demo-scene-secondary">
          <button type="button" className="demo-link-quiet" onClick={() => setDetail((v) => !v)}>Voir le détail du calcul</button>
        </div>
      </div>

      {detail ? (
        <div className="demo-lab-detail">
          <p><strong>Profil :</strong> {VOLUME_PROFILES.find((p) => p.id === profileId)?.tagline}</p>
          <p><strong>Base :</strong> minutes déclarées des situations RH × occurrences annuelles du profil. « Sans CloneStore » = équipe humaine élite (exécution manuelle). « Avec CloneStore » = attention humaine résiduelle du mode sélectionné.</p>
          <p><strong>Temps humain, jamais temps machine :</strong> les minutes affichées sont de l&apos;attention HUMAINE — jamais du temps calculé par la machine. {VALUE_WORDING.estimation}</p>
        </div>
      ) : null}
      <p className="demo-lab-legal">{VALUE_WORDING.illustrative}</p>
    </div>
  );
}

/* ─────────────────────── SCÈNE 12 — COMPARATEUR FINANCIER ────────────────────── */
export function SceneFinancialComparator({
  onAdvance,
  onReserve,
}: {
  onAdvance: () => void;
  onReserve: () => void;
}) {
  const [profileId, setProfileId] = React.useState<ProfileId>("groupe");
  const [modeId, setModeId] = React.useState<PierreModeId>("governed");
  const [annual, setAnnual] = React.useState(true);
  const [method, setMethod] = React.useState(false);

  const reset = () => { setProfileId("groupe"); setModeId("governed"); setAnnual(true); };

  const av = React.useMemo(() => annualValue(profileId), [profileId]);
  const ref = av.perReference.find((r) => r.reference === modeId)!;
  const cap = av.capacity;
  const cur = cap.currency;
  const div = annual ? 1 : 12;
  const scale = (annualMinor: number) => Math.round(annualMinor / div);
  const per = annual ? "/an" : "/mois";

  // Distinctions honnêtes (doctrine cost-model) : capacité libérée ≠ économie comptable ≠ cash garanti.
  const statusQuo = scale(cap.statusQuoAnnualMinor);
  const cashSaving = scale(cap.externalReplaceableMonthlyMinor * 12); // prestataires/outils substituables
  const capacityValue = scale(ref.capacityValueMinor);
  const subscription = scale(ref.pierreCostMinor);
  const net = scale(ref.netValueMinor);
  const recoveredMin = annual ? ref.recoveredMinutesYear : Math.round(ref.recoveredMinutesYear / 12);
  const fte = oneDecimal(cap.recoverableFteCenti / 100);

  return (
    <div className="demo-scene-body demo-lab">
      <CineEyebrow>Impact financier</CineEyebrow>
      <h2 className="cine-title cine-title--sm demo-scene-title">Mesurez ce que l&apos;inaction vous coûte.</h2>

      <div className="demo-lab-controls">
        <Seg label="Organisation" value={profileId} onChange={setProfileId}
          options={VOLUME_PROFILES.map((p) => ({ id: p.id, label: p.label }))} />
        <Seg label="Mode Pierre" value={modeId} onChange={setModeId}
          options={PIERRE_MODES.map((r) => ({ id: r.id as PierreModeId, label: r.label }))} />
        <Seg label="Période" value={annual ? "year" : "month"} onChange={(v) => setAnnual(v === "year")}
          options={[{ id: "month", label: "Mensuel" }, { id: "year", label: "Annuel" }]} />
      </div>

      <div className="demo-fin-net">
        <span className="demo-fin-net__lbl">Gain net estimé {per}</span>
        <span className={`demo-fin-net__num${net < 0 ? " demo-fin-net__num--neg" : ""}`}>{formatSignedMoney(net, cur)}</span>
        <span className="demo-fin-net__sub">capacité libérée − abonnement · {cap.subscriptionDisplay}</span>
      </div>

      <div className="demo-fin-proofs">
        <div className="demo-fin-proof">
          <span className="demo-fin-proof__k">Capacité libérée</span>
          <span className="demo-fin-proof__v">{formatMoney(capacityValue, cur)}{per}</span>
          <span className="demo-fin-proof__note">valeur opérationnelle — pas du cash</span>
        </div>
        <div className="demo-fin-proof">
          <span className="demo-fin-proof__k">Économie comptable</span>
          <span className="demo-fin-proof__v">{formatMoney(cashSaving, cur)}{per}</span>
          <span className="demo-fin-proof__note">prestataires/outils substituables</span>
        </div>
        <div className="demo-fin-proof">
          <span className="demo-fin-proof__k">Temps récupéré</span>
          <span className="demo-fin-proof__v">{formatHours(recoveredMin)}{per}</span>
          <span className="demo-fin-proof__note">≈ {fte} ETP · abonnement {formatMoney(subscription, cur)}{per}</span>
        </div>
      </div>

      <div className="demo-scene-actions">
        <DemoCTAButton onClick={onAdvance} variant="primary" hero withArrow>Voir la technologie</DemoCTAButton>
        <div className="demo-scene-secondary">
          <DemoCTAButton onClick={onReserve} variant="ghost">Réserver Pierre</DemoCTAButton>
          <button type="button" className="demo-link-quiet" onClick={() => setMethod((v) => !v)}>Hypothèses et méthode</button>
          <button type="button" className="demo-link-quiet" onClick={reset}>Réinitialiser</button>
        </div>
      </div>

      {method ? (
        <div className="demo-lab-detail">
          <p><strong>Statu quo :</strong> {formatMoney(statusQuo, cur)}{per} — travail répétitif + prestataires + outils déjà engagés (jamais présenté comme supprimable).</p>
          <p><strong>Trois grandeurs distinctes :</strong> l&apos;<em>économie comptable</em> (cash réellement substituable), la <em>capacité libérée</em> (valeur du temps rendu, pas du cash), et le <em>gain net</em> (capacité libérée − abonnement, qui peut être négatif). Verdict du moteur : {cap.verdict}.</p>
          <p>{VALUE_WORDING.basis}</p>
        </div>
      ) : null}
      <p className="demo-lab-legal">Scénario illustratif — hypothèses visibles et modifiables. Ordres de grandeur, jamais une garantie.</p>
    </div>
  );
}

"use client";

// /demo — Scènes 3 à 6 de l'expérience immersive (Objectif · Exécution · Validation · Résultat).
// Règle de densité STRICTE par scène : une idée, un titre, ≤ 2 lignes explicatives, ≤ 2 cartes,
// un CTA principal (+ lien secondaire discret optionnel), ≤ 45 mots visibles hors labels.
// Aucune vraie action métier n'est déclenchée : tout est illustratif et local à la démonstration.

import * as React from "react";
import { Check, Loader2, CircleDashed, ShieldCheck } from "lucide-react";
import { CineEyebrow } from "../primitives/cine";
import { DemoCTAButton } from "../primitives/DemoCTA";

/** Coque commune : hiérarchie identique sur toutes les scènes (eyebrow → titre → 2 lignes → corps → CTA). */
export function SceneShell({
  eyebrow,
  n,
  title,
  lede,
  children,
  cta,
  secondary,
}: {
  eyebrow: string;
  n?: string;
  title: React.ReactNode;
  lede?: React.ReactNode;
  children?: React.ReactNode;
  cta: React.ReactNode;
  secondary?: React.ReactNode;
}) {
  return (
    <div className="demo-scene-body">
      <CineEyebrow n={n}>{eyebrow}</CineEyebrow>
      <h2 className="cine-title cine-title--sm demo-scene-title">{title}</h2>
      {lede ? <p className="cine-lede demo-scene-lede">{lede}</p> : null}
      {children ? <div className="demo-scene-content">{children}</div> : null}
      <div className="demo-scene-actions">
        {cta}
        {secondary ? <div className="demo-scene-secondary">{secondary}</div> : null}
      </div>
    </div>
  );
}

/* ─────────────────────────── SCÈNE 3 — L'OBJECTIF ─────────────────────────── */
export function SceneObjective({ onAdvance }: { onAdvance: () => void }) {
  return (
    <SceneShell
      eyebrow="Vous donnez l'objectif"
      title="Préparer l'arrivée de Clara lundi."
      lede="Pierre identifie immédiatement ce qu'il faut produire, obtenir et faire valider."
      cta={
        <DemoCTAButton onClick={onAdvance} variant="primary" hero withArrow>
          Construire le plan
        </DemoCTAButton>
      }
    >
      <div className="demo-brief-card">
        <span className="demo-brief-card__badge">Brief</span>
        <dl className="demo-brief-card__rows">
          <div className="demo-brief-card__row">
            <dt>Arrivée</dt>
            <dd>lundi</dd>
          </div>
          <div className="demo-brief-card__row">
            <dt>Poste</dt>
            <dd>Responsable commerciale</dd>
          </div>
          <div className="demo-brief-card__row">
            <dt>Équipe</dt>
            <dd>Paris</dd>
          </div>
        </dl>
      </div>
    </SceneShell>
  );
}

/* ─────────────────────────── SCÈNE 4 — L'EXÉCUTION ────────────────────────── */
const EXECUTION_STEPS = [
  { label: "Dossier et documents", state: "done" as const, text: "Prêt" },
  { label: "Contrat et signatures", state: "live" as const, text: "En cours" },
  { label: "Accès et communications", state: "todo" as const, text: "À valider" },
];

function StepIcon({ state }: { state: "done" | "live" | "todo" }) {
  if (state === "done") return <Check className="h-4 w-4" aria-hidden="true" />;
  if (state === "live") return <Loader2 className="h-4 w-4 demo-spin" aria-hidden="true" />;
  return <CircleDashed className="h-4 w-4" aria-hidden="true" />;
}

export function SceneExecution({ onAdvance }: { onAdvance: () => void }) {
  return (
    <SceneShell
      eyebrow="Pierre organise la mission"
      title="Tout le travail devient un plan clair."
      cta={
        <DemoCTAButton onClick={onAdvance} variant="primary" hero withArrow>
          Lancer l'exécution
        </DemoCTAButton>
      }
    >
      <ul className="demo-steps">
        {EXECUTION_STEPS.map((s) => (
          <li key={s.label} className={`demo-step demo-step--${s.state}`}>
            <span className="demo-step__icon" aria-hidden="true">
              <StepIcon state={s.state} />
            </span>
            <span className="demo-step__label">{s.label}</span>
            <span className={`demo-step__state demo-step__state--${s.state}`}>{s.text}</span>
          </li>
        ))}
      </ul>
    </SceneShell>
  );
}

/* ─────────────────────────── SCÈNE 5 — LA VALIDATION ──────────────────────── */
export function SceneValidation({ onAdvance }: { onAdvance: () => void }) {
  const [why, setWhy] = React.useState(false);
  return (
    <SceneShell
      eyebrow="Vous gardez le contrôle"
      title="Une seule décision vous revient."
      cta={
        <DemoCTAButton onClick={onAdvance} variant="primary" hero withArrow>
          Valider dans la démonstration
        </DemoCTAButton>
      }
      secondary={
        <button type="button" className="demo-link-quiet" onClick={() => setWhy((v) => !v)}>
          Voir pourquoi Pierre demande cette validation
        </button>
      }
    >
      <div className="demo-validation-card">
        <span className="demo-validation-card__icon" aria-hidden="true">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <p className="demo-validation-card__title">Contrat final de Clara</p>
        <p className="demo-validation-card__status">Prêt pour validation</p>
        <p className="demo-validation-card__note">Aucun point bloquant détecté</p>
        {why ? (
          <p className="demo-validation-card__why">
            La signature engage l'entreprise : Pierre exécute tout, mais cette décision reste la vôtre.
          </p>
        ) : null}
      </div>
    </SceneShell>
  );
}

/* ─────────────────────────── SCÈNE 6 — LE RÉSULTAT ────────────────────────── */
const RESULT_PROOFS = [
  { value: "12 min", label: "d'attention humaine" },
  { value: "1", label: "validation" },
  { value: "100 %", label: "des actions journalisées" },
];

export function SceneResult({
  onUnderstand,
  onDiscoverPierre,
  onReserve,
}: {
  onUnderstand: () => void;
  onDiscoverPierre: () => void;
  onReserve: () => void;
}) {
  return (
    <SceneShell
      eyebrow="Mission terminée"
      title="L'arrivée est prête. Chaque action est traçable."
      cta={
        <DemoCTAButton onClick={onUnderstand} variant="primary" hero withArrow>
          Comprendre CloneStore
        </DemoCTAButton>
      }
      secondary={
        <>
          <DemoCTAButton onClick={onDiscoverPierre} variant="ghost">Découvrir Pierre</DemoCTAButton>
          <DemoCTAButton onClick={onReserve} variant="ghost">Réserver Pierre</DemoCTAButton>
        </>
      }
    >
      <div className="demo-proofs">
        {RESULT_PROOFS.map((p) => (
          <div key={p.label} className="demo-proof">
            <span className="demo-proof__value">{p.value}</span>
            <span className="demo-proof__label">{p.label}</span>
          </div>
        ))}
      </div>
      <div className="demo-agent-chip">
        <span className="demo-agent-chip__avatar" aria-hidden="true">P</span>
        <span className="demo-agent-chip__meta">
          <span className="demo-agent-chip__name">Pierre</span>
          <span className="demo-agent-chip__role">Employé IA RH opérationnel</span>
        </span>
        <span className="demo-agent-chip__status">Disponible</span>
      </div>
    </SceneShell>
  );
}

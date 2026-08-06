"use client";

// /demo — CHAPITRE 3 (scènes 13-14) : le SYSTÈME TECHNOLOGIQUE.
// 13 = Architecture (CloneStore → 14 technologies produit en 4 familles → 15 capacités → employés IA
// → missions), chemin RH illustratif. 14 = Explorateur interactif des 15 technologies publiques
// (14 T2 + CloneChat) et des 15 capacités T1, avec STATUTS HONNÊTES dérivés des registres réels.
// Aucune donnée écrite en dur : tout vient de technology-presentation (adaptateur des registres).

import * as React from "react";
import { CineEyebrow } from "../primitives/cine";
import { DemoCTAButton } from "../primitives/DemoCTA";
import {
  listPublicTechnologies,
  listPublicCapabilities,
  technologyArchitecture,
  TECH_FAMILIES,
  type TechFamilyId,
  type PublicTechnology,
} from "@/lib/demo/presentation/technology-presentation";

const TECHS = listPublicTechnologies();
const CAPS = listPublicCapabilities();
const ARCH = technologyArchitecture();

function StatusBadge({ label, tone }: { label: string; tone: string }) {
  return <span className={`demo-tech-badge demo-tech-badge--${tone}`}>{label}</span>;
}

/* ─────────────────────── SCÈNE 13 — ARCHITECTURE TECHNOLOGIQUE ────────────────── */
export function SceneTechArchitecture({ onAdvance }: { onAdvance: () => void }) {
  return (
    <div className="demo-scene-body demo-arch">
      <CineEyebrow>Architecture technologique</CineEyebrow>
      <h2 className="cine-title cine-title--sm demo-scene-title">Une pile pensée pour ouvrir des postes, pas des logiciels.</h2>

      <div className="demo-arch-stack">
        <div className="demo-arch-layer demo-arch-layer--top">
          <span className="demo-arch-layer__k">CloneStore</span>
          <span className="demo-arch-layer__v">La boutique d&apos;employés IA — Pierre (RH) est le premier poste ouvert.</span>
        </div>

        <div className="demo-arch-families">
          {ARCH.map(({ family, technologies }) => (
            <div key={family.id} className="demo-arch-fam">
              <span className="demo-arch-fam__title">{family.label}</span>
              <span className="demo-arch-fam__desc">{family.description}</span>
              <ul className="demo-arch-fam__list">
                {technologies.map((t) => (
                  <li key={t.id} className="demo-arch-chip" title={t.definition}>{t.publicName}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="demo-arch-layer demo-arch-layer--caps">
          <span className="demo-arch-layer__k">{CAPS.length} capacités réutilisables</span>
          <ul className="demo-arch-caps">
            {CAPS.map((c) => <li key={c.id} className="demo-arch-capchip" title={c.description}>{c.humanName}</li>)}
          </ul>
        </div>

        <div className="demo-arch-layer demo-arch-layer--mission">
          <span className="demo-arch-layer__k">Une mission RH, de bout en bout</span>
          <span className="demo-arch-layer__v">
            « Préparer l&apos;arrivée de Clara » → orchestration en mission → gouvernance (permis, tracé) →
            connaissance (documents, brief) → validations humaines → clôture. <em>Chemin illustratif.</em>
          </span>
        </div>
      </div>

      <div className="demo-scene-actions">
        <DemoCTAButton onClick={onAdvance} variant="primary" hero withArrow>Explorer les technologies</DemoCTAButton>
      </div>
      <p className="demo-lab-legal">
        {TECHS.length} technologies produit publiques · {CAPS.length} capacités · 4 familles — statuts honnêtes, aucun effet live.
      </p>
    </div>
  );
}

/* ─────────────────────── SCÈNE 14 — EXPLORATEUR DES TECHNOLOGIES ──────────────── */
export function SceneTechExplorer({
  onDiscoverPierre,
  onReserve,
  onRestart,
}: {
  onDiscoverPierre: () => void;
  onReserve: () => void;
  onRestart: () => void;
}) {
  const [family, setFamily] = React.useState<"all" | TechFamilyId>("all");
  const [selectedId, setSelectedId] = React.useState<string>(TECHS[0].id);

  const shown = React.useMemo(
    () => (family === "all" ? TECHS : TECHS.filter((t) => t.family === family)),
    [family],
  );
  // La techno sélectionnée reste visible même si le filtre change (sinon on retombe sur la 1re affichée).
  const selected: PublicTechnology =
    shown.find((t) => t.id === selectedId) ?? shown[0] ?? TECHS[0];

  const familyLabel = (id: TechFamilyId) => TECH_FAMILIES.find((f) => f.id === id)?.label ?? id;

  return (
    <div className="demo-scene-body demo-explorer">
      <CineEyebrow>Explorateur des technologies</CineEyebrow>
      <h2 className="cine-title cine-title--sm demo-scene-title">Chaque brique, son rôle, son statut honnête.</h2>

      <div className="demo-explorer-filters" role="tablist" aria-label="Familles de technologies">
        <button type="button" role="tab" aria-selected={family === "all"}
          className={`demo-xchip${family === "all" ? " demo-xchip--on" : ""}`} onClick={() => setFamily("all")}>
          Toutes ({TECHS.length})
        </button>
        {TECH_FAMILIES.map((f) => {
          const n = TECHS.filter((t) => t.family === f.id).length;
          return (
            <button key={f.id} type="button" role="tab" aria-selected={family === f.id}
              className={`demo-xchip${family === f.id ? " demo-xchip--on" : ""}`} onClick={() => setFamily(f.id)}>
              {f.label} ({n})
            </button>
          );
        })}
      </div>

      <div className="demo-explorer-grid">
        <ul className="demo-explorer-list">
          {shown.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                data-tech-id={t.id}
                aria-pressed={t.id === selected.id}
                className={`demo-explorer-item${t.id === selected.id ? " demo-explorer-item--on" : ""}`}
                onClick={() => setSelectedId(t.id)}
              >
                <span className="demo-explorer-item__name">{t.publicName}</span>
                <StatusBadge label={t.statusLabel} tone={t.statusTone} />
              </button>
            </li>
          ))}
        </ul>

        <div className="demo-explorer-detail" data-tech-selected={selected.id} aria-live="polite">
          <div className="demo-explorer-detail__head">
            <span className="demo-explorer-detail__name">{selected.publicName}</span>
            <StatusBadge label={selected.statusLabel} tone={selected.statusTone} />
          </div>
          <span className="demo-explorer-detail__fam">{familyLabel(selected.family)}</span>
          <p className="demo-explorer-detail__def">{selected.definition}</p>
          <p className="demo-explorer-detail__role"><strong>Rôle :</strong> {selected.role}</p>
          <p className="demo-explorer-detail__mission"><strong>Exemple :</strong> {selected.missionExample}</p>
          {selected.liveNote ? (
            <p className="demo-explorer-detail__live">⚠ {selected.liveNote}</p>
          ) : null}
          <p className="demo-explorer-detail__claim"><strong>Revendiquable :</strong> {selected.claimableNow}</p>
          {selected.dependencies.length ? (
            <p className="demo-explorer-detail__meta"><strong>S&apos;appuie sur :</strong> {selected.dependencies.join(" · ")}</p>
          ) : null}
          {selected.capabilitiesUsed.length ? (
            <p className="demo-explorer-detail__meta"><strong>Capacités :</strong> {selected.capabilitiesUsed.join(" · ")}</p>
          ) : null}
          {selected.mustNotClaim.length ? (
            <p className="demo-explorer-detail__never"><strong>Jamais revendiqué :</strong> {selected.mustNotClaim.slice(0, 3).join(" · ")}</p>
          ) : null}
        </div>
      </div>

      <div className="demo-scene-actions">
        <DemoCTAButton onClick={onDiscoverPierre} variant="primary" hero withArrow>Découvrir Pierre</DemoCTAButton>
        <div className="demo-scene-secondary">
          <DemoCTAButton onClick={onReserve} variant="ghost">Réserver Pierre</DemoCTAButton>
          <button type="button" className="demo-link-quiet" onClick={onRestart}>Revenir au début</button>
        </div>
      </div>
      <p className="demo-lab-legal">
        Statuts dérivés des registres réels T1/T2 — « Disponible localement » = sans effet externe ; jamais de voix, d&apos;appel ou de paiement live.
      </p>
    </div>
  );
}

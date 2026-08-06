"use client";

// /demo — CHAPITRE 2 (couche d'explication premium, après le « wow » du chapitre 1).
// Quatre scènes courtes et lisibles : nouvelle catégorie · départements couverts · valeur business ·
// fonctionnement. Même coque (SceneShell) et même densité stricte que le chapitre 1. Aucune vraie
// action métier ; palette dark premium (styles dans demo-stage.css).

import * as React from "react";
import { Users, TrendingUp, Code2, LifeBuoy, PieChart } from "lucide-react";
import { SceneShell } from "./scenes";
import { DemoCTAButton } from "../primitives/DemoCTA";

/* ─────────────────────── SCÈNE 7 — NOUVELLE CATÉGORIE ─────────────────────── */
const CATEGORIES = [
  { kind: "Logiciel", name: "Un outil", desc: "Vous l'utilisez. Vous faites le travail.", hot: false },
  { kind: "Agent IA simple", name: "Une aide ponctuelle", desc: "Il répond, il assiste — tâche par tâche.", hot: false },
  { kind: "Employé IA CloneStore", name: "Un périmètre complet", desc: "Il prend en charge la mission jusqu'au résultat.", hot: true },
];

export function SceneCategory({ onAdvance }: { onAdvance: () => void }) {
  return (
    <SceneShell
      eyebrow="Nouvelle catégorie technologique"
      title="CloneStore ne vend pas des logiciels."
      lede="CloneStore ouvre des postes d'employés IA."
      cta={
        <DemoCTAButton onClick={onAdvance} variant="primary" hero withArrow>
          Voir ce qu'un employé IA couvre
        </DemoCTAButton>
      }
    >
      <div className="demo-compare">
        {CATEGORIES.map((c) => (
          <div key={c.kind} className={`demo-compare__card${c.hot ? " demo-compare__card--hot" : ""}`}>
            <span className="demo-compare__kind">{c.kind}</span>
            <span className="demo-compare__name">{c.name}</span>
            <span className="demo-compare__desc">{c.desc}</span>
          </div>
        ))}
      </div>
    </SceneShell>
  );
}

/* ─────────────────────── SCÈNE 8 — DÉPARTEMENTS ───────────────────────────── */
const DEPTS = [
  { name: "RH", who: "Pierre — actif", icon: Users, live: true },
  { name: "Commercial", who: "Bientôt", icon: TrendingUp, live: false },
  { name: "Ingénierie", who: "Bientôt", icon: Code2, live: false },
  { name: "Support", who: "Bientôt", icon: LifeBuoy, live: false },
  { name: "Finance / Ops", who: "Bientôt", icon: PieChart, live: false },
];

export function SceneDepartments({ onAdvance }: { onAdvance: () => void }) {
  return (
    <SceneShell
      eyebrow="Un employé IA par périmètre"
      title="Un employé IA prend en charge un département précis."
      lede="Un employé IA = un poste spécialisé. Plusieurs employés IA = un département structuré."
      cta={
        <DemoCTAButton onClick={onAdvance} variant="primary" hero withArrow>
          Ce que vous y gagnez
        </DemoCTAButton>
      }
    >
      <div className="demo-depts">
        {DEPTS.map((d) => {
          const Icon = d.icon;
          return (
            <div key={d.name} className={`demo-dept${d.live ? " demo-dept--live" : ""}`}>
              <span className="demo-dept__icon" aria-hidden="true"><Icon className="h-5 w-5" /></span>
              <span className="demo-dept__name">{d.name}</span>
              <span className={d.live ? "demo-dept__who demo-dept__who--pierre" : "demo-dept__who demo-dept__soon"}>{d.who}</span>
            </div>
          );
        })}
      </div>
    </SceneShell>
  );
}

/* ─────────────────────── SCÈNE 9 — VALEUR BUSINESS ────────────────────────── */
const VALUES = [
  "Exécution continue",
  "Charge opérationnelle réduite",
  "Traçabilité native",
  "Standardisation",
  "Vitesse",
  "Supervision humaine conservée",
];

export function SceneBusinessValue({ onAdvance }: { onAdvance: () => void }) {
  return (
    <SceneShell
      eyebrow="Valeur concrète"
      title="Vous achetez de la capacité opérationnelle."
      cta={
        <DemoCTAButton onClick={onAdvance} variant="primary" hero withArrow>
          Comment ça fonctionne
        </DemoCTAButton>
      }
    >
      <div className="demo-values">
        {VALUES.map((v) => (
          <div key={v} className="demo-value">
            <span className="demo-value__dot" aria-hidden="true" />
            <span className="demo-value__text">{v}</span>
          </div>
        ))}
      </div>
      <div className="demo-value-badge">
        <span className="demo-value-badge__num">Jusqu'à 1,6 M€/an</span>
        <span className="demo-value-badge__label">de capacité libérée*</span>
      </div>
    </SceneShell>
  );
}

/* ─────────────────────── SCÈNE 10 — COMMENT ÇA MARCHE + CTA FINAL ─────────── */
const FLOW = [
  "Vous donnez un objectif",
  "CloneStore mobilise l'employé IA compétent",
  "L'employé IA exécute le périmètre",
  "Vous gardez les validations critiques",
];

export function SceneHowItWorks({
  onAdvance,
  onReserve,
}: {
  onAdvance: () => void;
  onReserve: () => void;
}) {
  return (
    <SceneShell
      eyebrow="Ce que vous achetez"
      title="Vous donnez l'objectif. CloneStore orchestre l'exécution."
      lede="Un poste opérationnel supervisé — pas un simple outil. Extensible à plusieurs départements."
      cta={
        <DemoCTAButton onClick={onAdvance} variant="primary" hero withArrow>
          Mesurer la valeur en chiffres
        </DemoCTAButton>
      }
      secondary={
        <>
          <DemoCTAButton onClick={onReserve} variant="ghost">Réserver Pierre</DemoCTAButton>
        </>
      }
    >
      <div className="demo-flow">
        {FLOW.map((f, i) => (
          <div key={f} className="demo-flow__step">
            <span className="demo-flow__n" aria-hidden="true">{i + 1}</span>
            <span className="demo-flow__text">{f}</span>
          </div>
        ))}
      </div>
    </SceneShell>
  );
}

// /demo — VERROUS de la refonte premium en QUATORZE scènes (stage immersif, 3 chapitres).
// Structure (source + rendu react-dom/server, sans jsdom) : ordre value-first verrouillé, coque
// dédiée, header global absent, navigation clavier + progression 3 chapitres, réduction de mouvement,
// CTA finaux, copie exacte des scènes, et AUCUN collage numéro/lettre.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DEMO_STAGE_SCENES } from "../DemoStage";
import { SceneObjective, SceneExecution, SceneValidation, SceneResult } from "../scenes";
import { SceneCategory, SceneDepartments, SceneBusinessValue, SceneHowItWorks } from "../ch2-scenes";
import { SceneTimeComparator, SceneFinancialComparator } from "../ch3-value-scenes";
import { SceneTechArchitecture, SceneTechExplorer } from "../ch3-tech-scenes";

const ROOT = process.cwd();
const stageSrc = readFileSync(resolve(ROOT, "src/components/demo/stage/DemoStage.tsx"), "utf8");
const pageSrc = readFileSync(resolve(ROOT, "src/app/demo/page.tsx"), "utf8");
const headerSrc = readFileSync(resolve(ROOT, "src/components/site/site-header.tsx"), "utf8");

function text(el: React.ReactElement): string {
  return renderToStaticMarkup(el)
    .replace(/<[^>]+>/g, "")
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/’/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

const noGlue = (t: string) => expect(t).not.toMatch(/\d{2}[A-Za-zÀ-ÿ]/);

describe("/demo — refonte premium en 14 scènes / 3 chapitres (stage)", () => {
  it("expose EXACTEMENT quatorze scènes (6 · 4 · 4), dans l'ordre value-first", () => {
    expect(DEMO_STAGE_SCENES.map((s) => s.id)).toEqual([
      "value", "clonestore", "objective", "execution", "validation", "result",
      "category", "departments", "value-business", "how",
      "time-value", "money-value", "tech-architecture", "tech-explorer",
    ]);
    expect(DEMO_STAGE_SCENES.length).toBe(14);
    expect(DEMO_STAGE_SCENES.slice(0, 6).every((s) => s.chapter === 1)).toBe(true);
    expect(DEMO_STAGE_SCENES.slice(6, 10).every((s) => s.chapter === 2)).toBe(true);
    expect(DEMO_STAGE_SCENES.slice(10).every((s) => s.chapter === 3)).toBe(true);
  });

  it("la première scène reste ValueShock (value-first non régressé)", () => {
    expect(DEMO_STAGE_SCENES[0].id).toBe("value");
    const v = stageSrc.indexOf("ValueShock");
    const a = stageSrc.indexOf("Act1Opening");
    const o = stageSrc.indexOf("SceneObjective");
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(a);
    expect(a).toBeLessThan(o);
  });

  it("la page /demo rend le stage immersif, jamais l'ancien DemoExperience", () => {
    expect(pageSrc).toContain("DemoStage");
    expect(pageSrc).not.toContain("<DemoExperience");
  });

  it("navigation clavier ←/→ + progression 3 chapitres (nom + compteur) + réduction de mouvement", () => {
    expect(stageSrc).toContain("ArrowRight");
    expect(stageSrc).toContain("ArrowLeft");
    expect(stageSrc).toContain("demo-progress-chap");
    expect(stageSrc).toContain("demo-progress-track");
    expect(stageSrc).toContain('reducedMotion="user"');
  });

  it("le header global du site disparaît sur /demo (coque dédiée)", () => {
    expect(headerSrc).toMatch(/currentPath === "\/demo"/);
  });

  it("scène 6 (Résultat) : preuves + « Comprendre CloneStore » + Pierre/Réserver", () => {
    const t = text(React.createElement(SceneResult, { onUnderstand() {}, onDiscoverPierre() {}, onReserve() {} }));
    expect(t).toContain("Mission terminée");
    expect(t).toContain("12 min");
    expect(t).toContain("Comprendre CloneStore");
  });

  it("CHAPITRE 2 : catégorie · départements · valeur · fonctionnement (bascule vers le chapitre 3)", () => {
    const c = text(React.createElement(SceneCategory, { onAdvance() {} }));
    expect(c).toContain("CloneStore ne vend pas des logiciels.");
    expect(c).toContain("Employé IA CloneStore");

    const d = text(React.createElement(SceneDepartments, { onAdvance() {} }));
    expect(d).toContain("Pierre");
    expect(d).toContain("Commercial");

    const v = text(React.createElement(SceneBusinessValue, { onAdvance() {} }));
    expect(v).toContain("capacité opérationnelle");
    expect(v).toContain("1,6 M€/an");

    // Scène 10 : n'est plus terminale — elle mène au chapitre 3 (« Mesurer la valeur en chiffres »).
    const h = text(React.createElement(SceneHowItWorks, { onAdvance() {}, onReserve() {} }));
    expect(h).toContain("CloneStore orchestre l'exécution.");
    expect(h).toContain("Mesurer la valeur en chiffres");
    expect(h).toContain("Réserver Pierre");
    expect(h).not.toContain("Revenir au début");

    for (const t of [c, d, v, h]) noGlue(t);
  });

  it("CHAPITRE 3 — comparateur de TEMPS : 3 modes canoniques, sans/avec, détail du calcul", () => {
    const t = text(React.createElement(SceneTimeComparator, { onAdvance() {} }));
    expect(t).toContain("Comparateur de temps");
    expect(t).toContain("Sans CloneStore");
    expect(t).toContain("Avec CloneStore");
    // Les trois modes Pierre (elite est la référence humaine « Sans CloneStore », jamais un mode).
    expect(t).toContain("Brouillon");
    expect(t).toContain("Exécution partagée");
    expect(t).toContain("Autonomie gouvernée");
    expect(t).not.toContain("Équipe RH humaine élite"); // elite n'est pas une option de mode
    expect(t).toContain("Voir le détail du calcul");
    expect(t).toContain("Voir l'impact financier");
    noGlue(t);
  });

  it("CHAPITRE 3 — comparateur FINANCIER : 3 grandeurs distinctes (jamais confondues)", () => {
    const t = text(React.createElement(SceneFinancialComparator, { onAdvance() {}, onReserve() {} }));
    expect(t).toContain("Gain net estimé");
    expect(t).toContain("Capacité libérée");
    expect(t).toContain("Économie comptable");
    expect(t).toContain("Temps récupéré");
    expect(t).toContain("Voir la technologie");
    expect(t).toContain("Réserver Pierre");
    noGlue(t);
  });

  it("CHAPITRE 3 — architecture : familles + capacités + chemin de mission illustratif", () => {
    const t = text(React.createElement(SceneTechArchitecture, { onAdvance() {} }));
    expect(t).toContain("Architecture technologique");
    expect(t).toContain("Orchestration & exécution");
    expect(t).toContain("Gouvernance & confiance");
    expect(t).toContain("capacités réutilisables");
    expect(t).toContain("illustratif");
    expect(t).toContain("Explorer les technologies");
    noGlue(t);
  });

  it("CHAPITRE 3 — explorateur : sélection par défaut, statut honnête, CTA terminaux", () => {
    const t = text(React.createElement(SceneTechExplorer, { onDiscoverPierre() {}, onReserve() {}, onRestart() {} }));
    expect(t).toContain("Explorateur des technologies");
    expect(t).toContain("Orchestration centrale"); // 1re techno publique (CloneOS), sélectionnée par défaut
    expect(t).toContain("Découvrir Pierre");
    expect(t).toContain("Réserver Pierre");
    expect(t).toContain("Revenir au début");
    noGlue(t);
  });

  it("scènes 3-5 : copie exacte, densité maîtrisée, aucun collage numéro/lettre", () => {
    const o = text(React.createElement(SceneObjective, { onAdvance() {} }));
    expect(o).toContain("Préparer l'arrivée de Clara lundi.");
    const e = text(React.createElement(SceneExecution, { onAdvance() {} }));
    expect(e).toContain("Lancer l'exécution");
    const v = text(React.createElement(SceneValidation, { onAdvance() {} }));
    expect(v).toContain("Une seule décision vous revient.");
    for (const t of [o, e, v]) noGlue(t);
  });
});

// Anti-régression /demo — VERROU de l'ordre value-first.
//
// Contexte (2026-07-27) : le site déployé montrait une ancienne version où la démo commençait par
// le hero institutionnel Act1Opening (« N'achetez plus seulement des logiciels… »). Le dépôt, lui,
// était DÉJÀ value-first (ValueShock — le choc de valeur — en premier écran) depuis le commit
// 90932a0bc (2026-07-25) ; la régression n'existait que dans un build déployé périmé.
//
// Ce test VERROUILLE l'ordre value-first au niveau du dépôt pour empêcher toute régression
// silencieuse future : la démo DOIT commencer par le choc de valeur (« demo-act-choc »), jamais par
// le hero institutionnel (« demo-act-open »). Il utilise des IDENTIFIANTS et de la STRUCTURE
// (jamais une comparaison fragile de longs textes).

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { DEMO_SCENE_NAV } from "@/components/demo/shared";
import { missionShock, annualValue } from "@/lib/demo/presentation/value-model";

const DEMO_EXPERIENCE = resolve(process.cwd(), "src/components/demo/DemoExperience.tsx");
const VALUE_SHOCK_ID = "demo-act-choc"; // ValueShock — le choc de valeur (premier écran value-first)
const INSTITUTIONAL_HERO_ID = "demo-act-open"; // Act1Opening — hero institutionnel (jamais premier)

describe("/demo — value-first order lock (anti-regression)", () => {
  it("le premier chapitre du rail de progression est le CHOC DE VALEUR, pas le hero institutionnel", () => {
    expect(DEMO_SCENE_NAV[0].id).toBe(VALUE_SHOCK_ID);
    expect(DEMO_SCENE_NAV[0].label).toBe("La preuve");
    // Le hero institutionnel existe mais n'est JAMAIS le premier écran.
    const heroIndex = DEMO_SCENE_NAV.findIndex((s) => s.id === INSTITUTIONAL_HERO_ID);
    expect(heroIndex).toBeGreaterThan(0);
  });

  it("DemoExperience rend <ValueShock/> AVANT <Act1Opening/> (ordre de rendu réel, par composant)", () => {
    const src = readFileSync(DEMO_EXPERIENCE, "utf8");
    const valueShockAt = src.indexOf("<ValueShock");
    const act1OpeningAt = src.indexOf("<Act1Opening");
    expect(valueShockAt, "DemoExperience doit rendre <ValueShock/>").toBeGreaterThanOrEqual(0);
    expect(act1OpeningAt, "DemoExperience doit rendre <Act1Opening/>").toBeGreaterThanOrEqual(0);
    expect(valueShockAt).toBeLessThan(act1OpeningAt);
  });

  it("le choc de valeur reste alimenté par les marqueurs chiffrés validés (11 h 35 → 12 min, capacité > 1 M€/an)", () => {
    const shock = missionShock();
    expect(shock.manualMinutes).toBe(695); // 11 h 35 de travail humain
    expect(shock.attentionMinutes).toBe(12); // 12 min d'attention humaine
    const groupe = annualValue("groupe");
    expect(groupe.capacity.recoverableAnnualMinor).toBeGreaterThan(100_000_000); // > 1 M€/an (centimes)
  });

  it("le rail de progression conserve les 9 scènes canoniques dans l'ordre value-first", () => {
    const ids = DEMO_SCENE_NAV.map((s) => s.id);
    expect(ids).toEqual([
      "demo-act-choc",
      "demo-act-open",
      "demo-act-value",
      "demo-act-difference",
      "demo-act-system",
      "demo-act-result",
      "demo-act-trust",
      "demo-act-cost",
      "demo-act-pierre",
    ]);
  });
});

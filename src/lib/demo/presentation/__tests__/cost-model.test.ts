// /demo — Acte 6 : tests du moteur PUR (coût + modèle opérationnel).
//
// Ces tests protègent la CRÉDIBILITÉ de la séquence, pas seulement son code :
//   • les nombres affichés correspondent exactement aux formules annoncées ;
//   • aucune saisie ne peut produire NaN, Infinity ou une valeur hors bornes ;
//   • le moteur peut conclure CONTRE CloneStore, et le fait ;
//   • aucun arrondi ne joue en faveur de CloneStore ;
//   • aucune métrique du comparateur n'est saisie à la main : tout est dérivé.

import { describe, it, expect } from "vitest";

import {
  CAPACITY_FIELDS,
  ILLUSTRATIVE_INPUTS,
  MINUTES_PER_FTE_MONTH,
  computeCapacity,
  formatFte,
  formatHours,
  formatInteger,
  formatMoney,
  formatRatio,
  formatSignedMoney,
  sanitizeField,
  sanitizeInputs,
  type CapacityFieldId,
  type CapacityInputs,
} from "../cost-model";

import {
  HR_SCENARIOS,
  OPERATING_DOMAINS,
  currentMetrics,
  governedMetrics,
  scenariosForDomain,
} from "../operating-model";

/**
 * Le formateur produit l'espace fine insécable de la typographie française
 * (U+202F). On la normalise ici pour que les attentes restent lisibles dans le
 * source — et on vérifie explicitement sa présence dans le test dédié.
 */
const NNBSP = " ";
const plain = (s: string) => s.split(NNBSP).join(" ");

const ZERO: CapacityInputs = {
  operators: 0,
  employerCostPerOperator: 0,
  repetitiveSharePct: 0,
  vendorMonthlyCost: 0,
  toolsMonthlyCost: 0,
  monthlyOperations: 0,
  coveredSharePct: 0,
  externalReplaceableSharePct: 0,
};

// ── Le scénario illustratif : chaque nombre est vérifié à la main ────────────

describe("cost-model — le scénario illustratif par défaut", () => {
  const r = computeCapacity(ILLUSTRATIVE_INPUTS);

  it("chiffre le coût mobilisé à partir des seules données saisies", () => {
    // 4 collaborateurs × 4 200 € = 16 800 € / mois
    expect(r.mobilisedMonthlyMinor).toBe(4 * 4_200 * 100);
    // 55 % consacrés au répétitif → 9 240 € / mois
    expect(r.repetitiveMonthlyMinor).toBe(924_000);
    // prestataires (1 800 €) + outils (600 €) = 2 400 € / mois
    expect(r.externalMonthlyMinor).toBe(240_000);
  });

  it("chiffre le coût du statu quo = répétitif + prestataires + outils", () => {
    expect(r.statusQuoMonthlyMinor).toBe(924_000 + 240_000);
    expect(r.statusQuoAnnualMinor).toBe(r.statusQuoMonthlyMinor * 12);
    expect(plain(formatMoney(r.statusQuoAnnualMinor, "EUR"))).toBe("139 680 €");
  });

  it("chiffre le temps mobilisé et la capacité récupérable", () => {
    expect(r.mobilisedMinutesMonthly).toBe(20_020); // 4 × 9 100 × 55 %
    expect(r.recoverableMinutesMonthly).toBe(12_012); // × 60 % de couverture
    expect(r.recoverableFteCenti).toBe(132); // 1,3 ETP
    expect(formatFte(r.recoverableFteCenti)).toBe("1,3");
  });

  it("distingue capacité récupérable et prestataires substituables", () => {
    expect(r.recoverableCapacityMonthlyMinor).toBe(554_400); // 9 240 € × 60 %
    expect(r.externalReplaceableMonthlyMinor).toBe(60_000); // 2 400 € × 25 %
    expect(r.recoverableMonthlyMinor).toBe(554_400 + 60_000);
  });

  it("compare à l'abonnement canonique, sans jamais réécrire le prix", () => {
    expect(r.subscriptionMonthlyMinor).toBe(44_900); // 449 € — source : country-pricing
    expect(r.currency).toBe("EUR");
    expect(r.subscriptionDisplay).toBe("449 € / mois");
    expect(r.netMonthlyMinor).toBe(614_400 - 44_900);
    expect(r.netAnnualMinor).toBe(r.netMonthlyMinor * 12);
    expect(plain(formatSignedMoney(r.netAnnualMinor, "EUR"))).toBe("+68 340 €");
  });

  it("donne un coût moyen par opération crédible et dérivé", () => {
    // 9 240 € / 420 opérations = 22 €
    expect(r.currentCostPerOperationMinor).toBe(2_200);
    expect(plain(formatMoney(r.currentCostPerOperationMinor!, "EUR"))).toBe("22 €");
  });

  it("conclut à un écart net, avec le rapport exact", () => {
    expect(r.verdict).toBe("evident");
    expect(formatRatio(r.ratioBps)).toBe("13,6×");
  });
});

// ── Cohérence interne : l'affichage ne peut pas mentir sur les formules ──────

describe("cost-model — les totaux sont cohérents pour n'importe quelle saisie", () => {
  const CASES: CapacityInputs[] = [
    ILLUSTRATIVE_INPUTS,
    ZERO,
    { ...ILLUSTRATIVE_INPUTS, operators: 1, employerCostPerOperator: 1_500 },
    { ...ILLUSTRATIVE_INPUTS, operators: 60, employerCostPerOperator: 15_000, repetitiveSharePct: 90 },
    { ...ILLUSTRATIVE_INPUTS, vendorMonthlyCost: 0, toolsMonthlyCost: 0 },
    { ...ILLUSTRATIVE_INPUTS, coveredSharePct: 0, externalReplaceableSharePct: 0 },
    { ...ILLUSTRATIVE_INPUTS, coveredSharePct: 100, externalReplaceableSharePct: 100 },
    { ...ILLUSTRATIVE_INPUTS, monthlyOperations: 0 },
  ];

  for (const [index, inputs] of CASES.entries()) {
    it(`cas ${index + 1} — statu quo, récupérable et écart net sont exacts`, () => {
      const r = computeCapacity(inputs);

      // Les identités affichées dans « Comment ce calcul est construit ».
      expect(r.statusQuoMonthlyMinor).toBe(r.repetitiveMonthlyMinor + r.externalMonthlyMinor);
      expect(r.statusQuoAnnualMinor).toBe(r.statusQuoMonthlyMinor * 12);
      expect(r.recoverableMonthlyMinor).toBe(
        r.recoverableCapacityMonthlyMinor + r.externalReplaceableMonthlyMinor,
      );
      expect(r.recoverableAnnualMinor).toBe(r.recoverableMonthlyMinor * 12);
      expect(r.netMonthlyMinor).toBe(r.recoverableMonthlyMinor - r.subscriptionMonthlyMinor);
      expect(r.netAnnualMinor).toBe(r.netMonthlyMinor * 12);

      // Aucune valeur n'est un flottant financier ni un NaN.
      for (const value of [
        r.mobilisedMonthlyMinor,
        r.repetitiveMonthlyMinor,
        r.statusQuoAnnualMinor,
        r.recoverableMonthlyMinor,
        r.netAnnualMinor,
        r.ratioBps,
        r.recoverableFteCenti,
        r.mobilisedMinutesMonthly,
      ]) {
        expect(Number.isSafeInteger(value)).toBe(true);
      }
    });
  }

  it("la capacité récupérable ne dépasse JAMAIS le coût du travail répétitif", () => {
    for (const inputs of CASES) {
      const r = computeCapacity(inputs);
      expect(r.recoverableCapacityMonthlyMinor).toBeLessThanOrEqual(r.repetitiveMonthlyMinor);
      expect(r.externalReplaceableMonthlyMinor).toBeLessThanOrEqual(r.externalMonthlyMinor);
      expect(r.recoverableMonthlyMinor).toBeLessThanOrEqual(r.statusQuoMonthlyMinor);
    }
  });

  it("aucun arrondi ne joue en faveur de CloneStore (floor systématique)", () => {
    // 3 collaborateurs × 3 333 € × 37 % : la division tombe volontairement mal.
    const r = computeCapacity({
      ...ZERO,
      operators: 3,
      employerCostPerOperator: 3_333,
      repetitiveSharePct: 37,
      coveredSharePct: 33,
    });
    const mobilised = 3 * 3_333 * 100;
    const repetitive = Math.floor((mobilised * 37) / 100);
    expect(r.repetitiveMonthlyMinor).toBe(repetitive);
    expect(r.repetitiveMonthlyMinor).toBeLessThanOrEqual((mobilised * 37) / 100);
    expect(r.recoverableCapacityMonthlyMinor).toBeLessThanOrEqual((repetitive * 33) / 100);
  });
});

// ── L'honnêteté : le moteur doit pouvoir conclure contre CloneStore ──────────

describe("cost-model — le verdict peut être défavorable à CloneStore", () => {
  it("aucune donnée saisie → aucun écart, aucun NaN", () => {
    const r = computeCapacity(ZERO);
    expect(r.recoverableMonthlyMinor).toBe(0);
    expect(r.netMonthlyMinor).toBe(-44_900); // l'abonnement, et rien en face
    expect(r.verdict).toBe("no_gap");
    expect(r.currentCostPerOperationMinor).toBeNull();
    expect(Number.isNaN(r.ratioBps)).toBe(false);
  });

  it("une hypothèse de couverture à zéro annule toute récupération", () => {
    const r = computeCapacity({
      ...ILLUSTRATIVE_INPUTS,
      coveredSharePct: 0,
      externalReplaceableSharePct: 0,
    });
    expect(r.recoverableMonthlyMinor).toBe(0);
    expect(r.verdict).toBe("no_gap");
    // Le coût du statu quo, lui, reste affiché : il est réel.
    expect(r.statusQuoMonthlyMinor).toBeGreaterThan(0);
  });

  it("une petite organisation déjà efficace → aucun écart", () => {
    const r = computeCapacity({
      ...ZERO,
      operators: 1,
      employerCostPerOperator: 2_500,
      repetitiveSharePct: 5,
      coveredSharePct: 20,
    });
    expect(r.netMonthlyMinor).toBeLessThanOrEqual(0);
    expect(r.verdict).toBe("no_gap");
  });

  it("un écart faible est qualifié « marginal », pas « évident »", () => {
    // Récupérable visé : entre 1× et 2× l'abonnement (449 € → 449–898 €).
    const r = computeCapacity({
      ...ZERO,
      operators: 1,
      employerCostPerOperator: 3_000,
      repetitiveSharePct: 40,
      coveredSharePct: 50,
    });
    expect(r.recoverableMonthlyMinor).toBe(60_000); // 600 €
    expect(r.netMonthlyMinor).toBeGreaterThan(0);
    expect(r.ratioBps).toBeLessThan(20_000);
    expect(r.verdict).toBe("marginal");
  });

  it("les quatre verdicts sont atteignables", () => {
    const verdicts = new Set([
      computeCapacity(ZERO).verdict,
      computeCapacity({ ...ZERO, operators: 1, employerCostPerOperator: 3_000, repetitiveSharePct: 40, coveredSharePct: 50 }).verdict,
      computeCapacity({ ...ZERO, operators: 2, employerCostPerOperator: 3_500, repetitiveSharePct: 40, coveredSharePct: 50 }).verdict,
      computeCapacity(ILLUSTRATIVE_INPUTS).verdict,
    ]);
    expect(verdicts).toEqual(new Set(["no_gap", "marginal", "significant", "evident"]));
  });
});

// ── Saisies invalides, nulles, extrêmes ─────────────────────────────────────

describe("cost-model — assainissement des saisies", () => {
  const INVALID: unknown[] = [NaN, Infinity, -Infinity, null, undefined, "", "abc", {}, [], -50, 1e12];

  it("aucune saisie invalide ne produit NaN ni ne sort des bornes", () => {
    for (const field of CAPACITY_FIELDS) {
      for (const value of INVALID) {
        const clean = sanitizeField(field.id, value);
        expect(Number.isSafeInteger(clean), `${field.id} ← ${String(value)}`).toBe(true);
        expect(clean).toBeGreaterThanOrEqual(field.min);
        expect(clean).toBeLessThanOrEqual(field.max);
      }
    }
  });

  it("une saisie invalide vaut le minimum du champ — jamais une valeur inventée", () => {
    expect(sanitizeField("operators", NaN)).toBe(0);
    expect(sanitizeField("employerCostPerOperator", "abc")).toBe(0);
    expect(sanitizeField("repetitiveSharePct", -10)).toBe(0);
  });

  it("les valeurs extrêmes sont ramenées aux bornes réelles", () => {
    expect(sanitizeField("operators", 10_000)).toBe(60);
    expect(sanitizeField("employerCostPerOperator", 999_999)).toBe(15_000);
    expect(sanitizeField("repetitiveSharePct", 300)).toBe(90);
    expect(sanitizeField("coveredSharePct", 300)).toBe(100);
  });

  it("les décimales sont arrondies à l'entier", () => {
    expect(sanitizeField("operators", 4.6)).toBe(5);
    expect(sanitizeField("repetitiveSharePct", 54.4)).toBe(54);
  });

  it("une entrée totalement vide reste calculable", () => {
    const clean = sanitizeInputs({});
    expect(Object.keys(clean)).toHaveLength(CAPACITY_FIELDS.length);
    const r = computeCapacity(clean);
    expect(r.verdict).toBe("no_gap");
    expect(Number.isSafeInteger(r.statusQuoAnnualMinor)).toBe(true);
  });

  it("un calcul avec des saisies invalides reste borné et sans NaN", () => {
    const r = computeCapacity({
      operators: NaN as unknown as number,
      employerCostPerOperator: Infinity as unknown as number,
      repetitiveSharePct: -1 as unknown as number,
      vendorMonthlyCost: "1800" as unknown as number,
      toolsMonthlyCost: undefined,
      monthlyOperations: 1e9,
      coveredSharePct: 60,
      externalReplaceableSharePct: 25,
    });
    expect(r.inputs.operators).toBe(0);
    // Infinity n'est pas une valeur finie : on retombe sur le MINIMUM, jamais sur
    // une borne haute qui gonflerait artificiellement le résultat.
    expect(r.inputs.employerCostPerOperator).toBe(0);
    expect(r.inputs.vendorMonthlyCost).toBe(1_800); // chaîne numérique acceptée
    expect(r.inputs.monthlyOperations).toBe(5_000); // 1e9 → borne haute réelle
    expect(Number.isSafeInteger(r.netAnnualMinor)).toBe(true);
  });
});

// ── Le pays décide du tarif — jamais une devise supposée ─────────────────────

describe("cost-model — tarification par pays", () => {
  it("FR / BE / LU → 449 € ; CH → 499 CHF", () => {
    for (const country of ["FR", "BE", "LU"] as const) {
      const r = computeCapacity(ILLUSTRATIVE_INPUTS, country);
      expect(r.subscriptionMonthlyMinor).toBe(44_900);
      expect(r.currency).toBe("EUR");
    }
    const ch = computeCapacity(ILLUSTRATIVE_INPUTS, "CH");
    expect(ch.subscriptionMonthlyMinor).toBe(49_900);
    expect(ch.currency).toBe("CHF");
    expect(ch.subscriptionDisplay).toBe("499 CHF / mois");
  });

  it("le montant en Suisse est comparé en CHF, pas converti en euros", () => {
    const ch = computeCapacity(ILLUSTRATIVE_INPUTS, "CH");
    expect(plain(formatMoney(ch.subscriptionMonthlyMinor, ch.currency))).toBe("499 CHF");
  });
});

// ── Formatage : déterministe, identique serveur et client ───────────────────

describe("cost-model — formatage déterministe (aucun Intl, aucun toLocaleString)", () => {
  it("utilise réellement l'espace fine insécable U+202F (typographie française)", () => {
    expect(formatInteger(1_234_567)).toContain(NNBSP);
    expect(formatMoney(1_260_000, "EUR")).toContain(NNBSP);
  });

  it("groupe les milliers avec l'espace fine insécable", () => {
    expect(plain(formatInteger(1_234_567))).toBe("1 234 567");
    expect(formatInteger(999)).toBe("999");
    expect(formatInteger(0)).toBe("0");
    expect(plain(formatInteger(-1_500))).toBe("-1 500");
  });

  it("affiche la monnaie à l'unité près", () => {
    expect(plain(formatMoney(1_260_000, "EUR"))).toBe("12 600 €");
    expect(plain(formatMoney(44_900, "EUR"))).toBe("449 €");
    expect(plain(formatMoney(49_900, "CHF"))).toBe("499 CHF");
    expect(plain(formatMoney(0, "EUR"))).toBe("0 €");
  });

  it("signe l'écart net, y compris négatif", () => {
    expect(plain(formatSignedMoney(6_834_000, "EUR"))).toBe("+68 340 €");
    expect(plain(formatSignedMoney(-44_900, "EUR"))).toBe("-449 €");
    expect(plain(formatSignedMoney(0, "EUR"))).toBe("0 €");
  });

  it("affiche les durées en heures lisibles", () => {
    expect(plain(formatHours(20_020))).toBe("333 h 40");
    expect(plain(formatHours(120))).toBe("2 h");
    expect(plain(formatHours(45))).toBe("45 min");
    expect(plain(formatHours(0))).toBe("0 min");
    expect(plain(formatHours(NaN))).toBe("0 min");
  });

  it("n'émet jamais NaN, même sur une entrée absurde", () => {
    expect(formatInteger(NaN)).toBe("0");
    expect(formatFte(NaN)).toBe("0,0");
    expect(formatRatio(NaN)).toBe("0,0×");
    expect(formatMoney(0, "EUR")).not.toContain("NaN");
  });
});

// ── Le modèle opérationnel ──────────────────────────────────────────────────

describe("operating-model — les situations déclarées (10 d'origine + arrival-full)", () => {
  it("expose les dix situations demandées, toutes complètes", () => {
    expect(HR_SCENARIOS).toHaveLength(11); // +arrival-full (mission complète, chapitre valeur)
    for (const s of HR_SCENARIOS) {
      expect(s.trigger.length).toBeGreaterThan(10);
      expect(s.stake.length).toBeGreaterThan(10);
      expect(s.current.steps.length).toBeGreaterThanOrEqual(4);
      expect(s.governed.steps.length).toBeGreaterThanOrEqual(4);
      expect(s.current.delay.length).toBeGreaterThan(3);
      expect(s.governed.delay.length).toBeGreaterThan(3);
    }
  });

  it("les identifiants sont uniques", () => {
    const ids = HR_SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("chaque exécution manuelle est plus fragmentée que l'exécution gouvernée", () => {
    for (const s of HR_SCENARIOS) {
      const current = currentMetrics(s);
      const governed = governedMetrics(s);
      // Le contraste vient du temps humain mobilisé, jamais d'une caricature.
      expect(governed.minutes, s.id).toBeLessThan(current.minutes);
    }
  });

  it("les métriques sont DÉRIVÉES des étapes, jamais saisies", () => {
    const s = HR_SCENARIOS[0];
    const m = currentMetrics(s);
    expect(m.steps).toBe(s.current.steps.length);
    expect(m.surfaces).toBe(new Set(s.current.steps.map((x) => x.on)).size);
    expect(m.minutes).toBe(s.current.steps.reduce((t, x) => t + x.minutes, 0));
    expect(m.breaks).toBe(
      s.current.steps.filter((x) => x.kind === "wait" || x.kind === "interrupt").length,
    );

    const g = governedMetrics(s);
    expect(g.steps).toBe(s.governed.steps.length);
    expect(g.validations).toBe(s.governed.steps.filter((x) => x.kind === "validate").length);
    expect(g.flags).toBe(s.governed.steps.filter((x) => x.kind === "flag").length);
  });

  it("une attente ne consomme aucun effort humain — elle rompt la continuité", () => {
    const waits = HR_SCENARIOS.flatMap((s) => s.current.steps).filter((s) => s.kind === "wait");
    expect(waits.length).toBeGreaterThan(0);
    for (const w of waits) expect(w.minutes).toBe(0);
  });

  it("l'humain garde la main : les situations sensibles passent par une validation", () => {
    const sensitive = HR_SCENARIOS.find((s) => s.id === "sensitive-action");
    expect(sensitive).toBeDefined();
    expect(governedMetrics(sensitive!).validations).toBeGreaterThanOrEqual(1);

    // Onboarding et avenants produisent des documents → validation humaine requise.
    for (const id of ["onboarding", "amendments", "payroll"]) {
      const s = HR_SCENARIOS.find((x) => x.id === id)!;
      expect(governedMetrics(s).validations, id).toBeGreaterThanOrEqual(1);
    }
  });

  it("l'information manquante est signalée, jamais inventée", () => {
    const onboarding = HR_SCENARIOS.find((s) => s.id === "onboarding")!;
    expect(governedMetrics(onboarding).flags).toBeGreaterThanOrEqual(1);
    expect(
      onboarding.governed.steps.some((s) => s.kind === "flag" && /invente/i.test(s.label)),
    ).toBe(true);
  });

  it("le modèle est générique : les RH ne sont qu'un périmètre parmi d'autres", () => {
    expect(OPERATING_DOMAINS.length).toBeGreaterThan(1);
    const hr = OPERATING_DOMAINS.find((d) => d.id === "hr")!;
    expect(hr.available).toBe(true);
    expect(hr.employee).toBe("Pierre");

    // Aucun futur employé n'est nommé (règle du catalogue public).
    for (const d of OPERATING_DOMAINS.filter((x) => !x.available)) {
      expect(d.employee).toBeNull();
    }
    expect(scenariosForDomain("hr")).toHaveLength(11);
    expect(scenariosForDomain("finance")).toHaveLength(0);
  });
});

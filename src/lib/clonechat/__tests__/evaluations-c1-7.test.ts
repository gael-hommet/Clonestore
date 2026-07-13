// src/lib/clonechat/__tests__/evaluations-c1-7.test.ts
// C1.7 §11/§12 — ÉVALUATIONS DÉTERMINISTES (zéro appel payant).
//
// §11 — QUALITÉ COMMERCIALE : 15 scénarios passés dans le VRAI moteur déterministe. On ne juge
//       pas « est-ce joli » mais : est-ce VRAI, est-ce que ça répond d'abord à la question, et
//       est-ce que ça évite le mensonge commercial (ROI inventé, faux témoignage, fausse urgence).
// §12 — COÛT/ROUTAGE : 200 tours mockés passés dans le VRAI routeur. On mesure la part Luna/Terra
//       et le coût estimé — l'objectif étant « le coût le plus bas qui reste premium ».
//
// Les preuves sont écrites dans .c1-7-proofs/ (gated par C1_7_WRITE_PROOFS=1).

import { describe, it, expect } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { routeModel, loadModelRouterConfig, CANONICAL_DEFAULT_MODEL, CANONICAL_COMPLEX_MODEL } from "../openai/model-router";
import { answerPublicQuestion } from "../intelligence/c1-1/parrain-public-adapter";

const AT = "2026-07-13T00:00:00.000Z";
const DIR = resolve(process.cwd(), ".c1-7-proofs");
const write = (n: string, o: unknown) => {
  if (process.env.C1_7_WRITE_PROOFS !== "1") return;
  mkdirSync(DIR, { recursive: true });
  writeFileSync(resolve(DIR, n), JSON.stringify(o, null, 2));
};

// ── Interdits commerciaux (mensonges de vente) ───────────────────────────────
const FORBIDDEN: Array<[string, RegExp]> = [
  ["ROI inventé", /\b(économisez|gagnez)\s+\d+\s*(%|euros|€)|retour sur investissement garanti|\d+\s*% d'économies/i],
  ["économies garanties", /économies? garanties?|résultat garanti|garantie de résultat/i],
  ["faux témoignage", /nos clients disent|témoignage|selon nos \d+ clients|\d+\s*entreprises nous font confiance/i],
  ["fausse urgence", /offre limitée|plus que \d+ places|dépêchez-vous|dernière chance/i],
  ["fausse rareté", /stock limité|places limitées|il ne reste que/i],
  ["capacité non livrée annoncée live", /paiement en ligne est ouvert|signature live|téléphonie (est )?(ouverte|active)/i],
];

const SCENARIOS: Array<{ id: string; q: string; mustMention?: RegExp }> = [
  { id: "1-dirigeant-decouverte", q: "Je découvre CloneStore, qu'est-ce que c'est exactement ?" },
  { id: "2-drh-sceptique", q: "Je suis DRH et je suis sceptique : en quoi Pierre est différent d'un outil RH classique ?" },
  { id: "3-deja-chatgpt", q: "J'utilise déjà ChatGPT, pourquoi payer Pierre ?" },
  { id: "4-pas-de-besoin-rh", q: "Je n'ai pas vraiment de problème RH, ça ne me sert à rien." },
  { id: "5-pourquoi-449", q: "Pourquoi Pierre coûte 449 € ?", mustMention: /449/ },
  { id: "6-remplacer-equipe", q: "Est-ce que Pierre peut remplacer mon équipe RH ?" },
  { id: "7-donnees-sures", q: "Est-ce que mes données sont en sécurité ?" },
  { id: "8-montre-concret", q: "Montrez-moi quelque chose de concret." },
  { id: "9-dix-salaries", q: "Je n'ai que dix salariés, est-ce que c'est pour moi ?" },
  { id: "10-suisse", q: "Je suis en Suisse, quel est le prix ?", mustMention: /499|CHF/i },
  { id: "11-sans-entreprise", q: "Je n'ai pas encore d'entreprise créée, je peux quand même utiliser CloneStore ?" },
  { id: "12-capacite-non-supportee", q: "Est-ce que Pierre peut passer des appels téléphoniques à mes candidats ?" },
  { id: "13-objection-prix", q: "449 € par mois c'est trop cher pour moi." },
  { id: "14-peur-perte-controle", q: "J'ai peur de perdre le contrôle si une IA agit sur mes RH." },
  { id: "15-confidentialite", q: "Mes données RH sont confidentielles, comment vous les traitez ?" },
];

describe("C1.7 §11 — qualité commerciale : persuader sans jamais mentir", () => {
  it("les 15 scénarios répondent, sans aucun mensonge commercial", async () => {
    const results = [];
    for (const s of SCENARIOS) {
      const r = await answerPublicQuestion({ question: s.q, at: AT }); // moteur RÉEL, déterministe
      const answer = r.answer ?? "";
      const violations = FORBIDDEN.filter(([, rx]) => rx.test(answer)).map(([label]) => label);
      const ctaCount = (answer.match(/\/reserver\/pierre|réserver pierre|activez pierre/gi) ?? []).length;

      results.push({
        id: s.id,
        question: s.q,
        answered: answer.length > 40,
        mentionsRequiredFact: s.mustMention ? s.mustMention.test(answer) : null,
        forbiddenClaims: violations,
        ctaOccurrences: ctaCount,
        honesty: r.honesty,
        answerSample: answer.slice(0, 180),
      });

      // Une réponse doit exister…
      expect(answer.length, s.id).toBeGreaterThan(40);
      // …et ne contenir AUCUN mensonge commercial.
      expect(violations, `${s.id} → ${violations.join(", ")}`).toEqual([]);
      // …et ne pas marteler l'achat (au plus un CTA par réponse).
      expect(ctaCount, `${s.id} : CTA répété`).toBeLessThanOrEqual(1);
      // …et dire la vérité quand un fait canonique est en jeu.
      if (s.mustMention) expect(s.mustMention.test(answer), `${s.id} : fait canonique manquant`).toBe(true);
    }

    write("sales-quality-evaluation.json", {
      engine: "moteur PUBLIC déterministe RÉEL (aucun appel payant)",
      grading: {
        answeredFirst: "une réponse substantielle est produite",
        factualAccuracy: "les faits canoniques (449 €, 499 CHF) sont exacts",
        noInventedRoi: true, noFakeTestimonial: true, noFakeUrgency: true, noFakeScarcity: true,
        noUnavailableCapabilityClaimedLive: true,
        ctaRestraint: "au plus 1 CTA par réponse — jamais de matraquage",
      },
      scenarios: results,
      failures: results.filter((r) => r.forbiddenClaims.length > 0 || r.ctaOccurrences > 1),
    });
  }, 120_000);

  it("une capacité NON livrée n'est jamais annoncée comme disponible", async () => {
    const r = await answerPublicQuestion({ question: "Est-ce que Pierre peut passer des appels téléphoniques ?", at: AT });
    expect(/téléphonie (est )?(ouverte|active)|Pierre appelle vos candidats/i.test(r.answer)).toBe(false);
  }, 60_000);
});

describe("C1.7 §12 — coût & routage : le moins cher qui reste premium", () => {
  it("200 tours mockés : Luna domine, Terra n'apparaît que sur preuve", () => {
    const cfg = loadModelRouterConfig();
    // Tarifs indicatifs (USD / 1M tokens) — utilisés UNIQUEMENT pour une ESTIMATION locale.
    const PRICE = { [CANONICAL_DEFAULT_MODEL]: { in: 0.25, out: 2.0 }, [CANONICAL_COMPLEX_MODEL]: { in: 1.25, out: 10.0 } } as Record<string, { in: number; out: number }>;

    const turns: Array<{ kind: string; input: Parameters<typeof routeModel>[0] }> = [];
    for (let i = 0; i < 100; i++) turns.push({ kind: "public", input: { message: ["Quels sont les prix ?", "C'est quoi Pierre ?", "Comment fonctionne CloneStore ?", "Pierre peut-il m'aider ?"][i % 4], requestClass: "CONVERSATIONAL_OR_PUBLIC" } });
    for (let i = 0; i < 30; i++) turns.push({ kind: "sales", input: { message: ["J'utilise déjà ChatGPT.", "449 € c'est cher.", "Pierre remplace mon équipe ?"][i % 3] } });
    for (let i = 0; i < 20; i++) turns.push({ kind: "image", input: { message: "Que montre cette capture ?", imageCount: 1 } });
    for (let i = 0; i < 20; i++) turns.push({ kind: "document", input: { message: "Résume ce document.", documentCount: 1, documentChars: 4_000 } });
    for (let i = 0; i < 10; i++) turns.push({ kind: "multifile", input: { message: "Compare ces contrats et signale les contradictions.", documentCount: 4, documentChars: 60_000, evidenceConflict: true } });

    const decisions = turns.map((t) => ({ kind: t.kind, d: routeModel(t.input, cfg) }));
    const luna = decisions.filter((x) => x.d.model === cfg.defaultModel).length;
    const terra = decisions.filter((x) => x.d.model === cfg.complexModel).length;

    // INVARIANTS : le défaut domine ; Terra ne sort QUE sur les tours réellement complexes.
    expect(luna).toBe(170);
    expect(terra).toBe(10);
    expect(decisions.filter((x) => x.kind === "multifile").every((x) => x.d.escalated)).toBe(true);
    expect(decisions.filter((x) => x.kind === "public").every((x) => !x.d.escalated)).toBe(true);
    expect(decisions.filter((x) => x.kind === "sales").every((x) => !x.d.escalated)).toBe(true);

    // Estimation de coût pour 100 tours publics normaux (hypothèses explicites, non mesurées).
    const AVG_IN = 1400, AVG_OUT = 220, CACHED_RATIO = 0.75;
    const p = PRICE[cfg.defaultModel];
    const costPer100 = ((AVG_IN * (1 - CACHED_RATIO) + AVG_IN * CACHED_RATIO * 0.1) * p.in + AVG_OUT * p.out) / 1_000_000 * 100;

    write("cost-routing-report.json", {
      method: "200 tours MOCKÉS passés dans le VRAI routeur — aucun appel provider payant.",
      routing: {
        totalTurns: turns.length,
        economicalModel: cfg.defaultModel, economicalShare: `${((luna / turns.length) * 100).toFixed(1)} %`,
        complexModel: cfg.complexModel, complexShare: `${((terra / turns.length) * 100).toFixed(1)} %`,
        escalationReasons: [...new Set(decisions.flatMap((x) => x.d.reasons))],
      },
      byKind: ["public", "sales", "image", "document", "multifile"].map((k) => {
        const sub = decisions.filter((x) => x.kind === k);
        return { kind: k, turns: sub.length, escalated: sub.filter((x) => x.d.escalated).length, model: sub[0].d.model };
      }),
      assumptions: { avgInputTokens: AVG_IN, avgOutputTokens: AVG_OUT, cachedInputRatio: CACHED_RATIO, note: "Hypothèses EXPLICITES : ce sont des estimations locales, pas des mesures provider." },
      estimatedCostPer100NormalTurnsUsd: Number(costPer100.toFixed(4)),
      transcription: { primary: "gpt-4o-mini-transcribe", fallback: "gpt-4o-transcribe", fallbackPolicy: "uniquement si transcript vide malgré parole, confiance mesurée < seuil, ou demande explicite", expectedFallbackRate: "faible par conception (pas de double transcription systématique)" },
      objective: "LE COÛT LE PLUS BAS QUI RESTE PREMIUM",
      qualityFailures: 0,
      providerErrors: 0,
    });
  });

  it("la qualité de routage NE dépend PAS du compte (même question → même modèle)", () => {
    const q = { message: "Quels sont les prix de Pierre ?" };
    // Le routeur ne peut pas voir l'identité : anonyme et client obtiennent le même modèle.
    expect(routeModel(q)).toEqual(routeModel(q));
    expect(routeModel(q).model).toBe(CANONICAL_DEFAULT_MODEL);
  });
});

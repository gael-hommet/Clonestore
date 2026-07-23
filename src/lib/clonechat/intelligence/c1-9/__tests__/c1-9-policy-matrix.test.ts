// C1.9 — MATRICES DE POLITIQUE (§6, §7, §8, §4), déterministes.
//
// Ce fichier MESURE et ÉCRIT les preuves : chaque ligne d'artefact est le résultat d'une
// assertion réellement exécutée, jamais une affirmation rédigée à la main. Aucun appel
// modèle : ce qui est vérifié ici, c'est la POLITIQUE — ce que la pipeline a le droit de
// servir et de dire — pas la rédaction, qui est mesurée par les campagnes.
import { describe, it, expect } from "vitest";
import { writeFileSync, mkdirSync } from "fs";
import {
  buildRelevanceContract, factRelevancePlan, findUnsolicitedSentences,
  allowedRoutePathsFor, renderRelevanceForPrompt, PERIPHERAL_TOPICS,
} from "../response-relevance";
import { buildTruthContext, renderTruthForPrompt, providedContextForJudge } from "../truth-context";
import { UnderstandingSchema, type Understanding } from "../understanding-schema";
import { SUPPORTED_LAUNCH_COUNTRIES, pricingForCountry } from "@/lib/clonestore/pricing/country-pricing";

const OUT = "c:/Users/homme/clonestore/.c1-9-proofs";
const AT = "2026-07-22";

function U(patch: Partial<Understanding>): Understanding {
  return UnderstandingSchema.parse({ summary: "s", primary_goal: "g", questions_detected: ["q"], ...patch });
}

function contract(patch: Partial<Understanding>, rawMessage: string, sufficiency: "strong" | "weak" | "none" = "strong", unmatchedNeeds: string[] = []) {
  const u = U(patch);
  return { u, c: buildRelevanceContract({ understanding: u, coverage: u.questions_detected, sufficiency, unmatchedNeeds, rawMessage }) };
}

const write = (name: string, body: Record<string, unknown>) => {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/${name}.json`, JSON.stringify({ artifact: name, generatedAt: AT, ...body }, null, 2));
};

describe("C1.9 — matrice ASSISTANCE (§6)", () => {
  // Sept situations d'incident, formulées AUTREMENT que dans les campagnes : la politique
  // se vérifie sur la nature de la demande, jamais sur des mots précis.
  const SITUATIONS = [
    { id: "double-debit", msg: "on m'a compté deux fois le même mois" },
    { id: "resiliation", msg: "j'ai résilié et je vois encore un mouvement" },
    { id: "connexion", msg: "impossible d'ouvrir ma session ce matin" },
    { id: "page-echoue", msg: "l'écran se bloque au moment de valider" },
    { id: "panne-technique", msg: "plus rien ne répond depuis la mise à jour" },
    { id: "acces-compte", msg: "je n'ai plus accès à mon espace" },
    { id: "facturation", msg: "le montant prélevé ne correspond pas" },
  ];

  it("interdit toute vente, tout tarif et toute suite commerciale sur chaque incident", () => {
    const rows = SITUATIONS.map((s) => {
      const { u, c } = contract({ request_nature: "support_incident", primary_goal: s.msg }, s.msg);
      const plan = factRelevancePlan(c, u);
      const prompt = renderRelevanceForPrompt(c);
      const row = {
        id: s.id,
        forbiddenTopics: c.forbiddenUnsolicitedTopics.map((t) => t.id),
        allowedTopics: [...c.allowedSupportingTopics],
        shouldOfferNextStep: c.shouldOfferNextStep,
        shouldUseCommercialCta: c.shouldUseCommercialCta,
        pricingServed: plan.includePricing,
        countryTableServed: plan.includeCountryTable,
        supportRouteAllowed: allowedRoutePathsFor(c).includes("/questions"),
        promptForbidsDiagnosis: prompt.includes("n'annonce aucun"),
        promptForbidsSale: prompt.includes("n'est pas une occasion de vente"),
      };
      expect(row.allowedTopics, s.id).toEqual([]);
      expect(row.forbiddenTopics.length, s.id).toBe(PERIPHERAL_TOPICS.length);
      expect(row.shouldOfferNextStep, s.id).toBe(false);
      expect(row.shouldUseCommercialCta, s.id).toBe(false);
      expect(row.pricingServed, s.id).toBe(false);
      expect(row.countryTableServed, s.id).toBe(false);
      expect(row.supportRouteAllowed, s.id).toBe(true);
      expect(row.promptForbidsDiagnosis, s.id).toBe(true);
      expect(row.promptForbidsSale, s.id).toBe(true);
      return row;
    });

    // Une réponse d'assistance polluée est réparée sans perdre l'orientation utile.
    const { c } = contract({ request_nature: "support_incident" }, "on m'a compté deux fois");
    const repaired = findUnsolicitedSentences(
      "Je comprends. Je n'ai pas accès à votre compte. Écrivez à l'équipe via /questions avec la date. L'abonnement revient à 449 € par mois. Vous pouvez aussi réserver une démonstration.",
      c, allowedRoutePathsFor(c),
    );
    expect(repaired.length).toBe(2);

    write("C1_9_SUPPORT_FINAL_RESULTS", {
      question: "Une demande d'assistance peut-elle encore devenir une conversation commerciale ?",
      method: "Matrice déterministe sur 7 situations d'incident reformulées, distinctes des corpus de campagne.",
      rule: "§6 — la nature `support_incident` interdit TOUS les sujets périphériques, retient prix et périmètre pays, et n'autorise que la page d'assistance réelle.",
      situations: rows,
      repairExample: { removedSentences: repaired.length, topics: repaired.map((h) => h.topicId) },
      verdict: { situations: rows.length, allForbidCommercial: true, supportRouteAlwaysAllowed: true },
    });
  });
});

describe("C1.9 — matrice PAYS (§7)", () => {
  it("dérive prix, devise et couverture du canon P10 pour chaque pays de lancement", () => {
    const perCountry = SUPPORTED_LAUNCH_COUNTRIES.map((cc) => {
      const { u, c } = contract({ request_nature: "country", countries_mentioned: [cc] }, `et pour ${cc} ?`);
      const plan = factRelevancePlan(c, u);
      const truth = buildTruthContext({ retrieved: [], serverCountry: null, at: AT, viewerIsAuthenticated: false, relevance: plan });
      const rendered = renderTruthForPrompt(truth);
      const p = pricingForCountry(cc);
      const expected = p.status === "ok" ? p.pricing.display : null;
      const others = SUPPORTED_LAUNCH_COUNTRIES.filter((o) => o !== cc);
      const row = {
        country: cc,
        expectedDisplay: expected,
        served: rendered.includes(`${cc} : ${expected}`),
        othersWithheld: others.every((o) => !rendered.includes(`${o} : `)),
        scopeServed: plan.includeCountryScope,
        currency: p.status === "ok" ? p.pricing.currency : null,
      };
      expect(row.served, cc).toBe(true);
      expect(row.othersWithheld, cc).toBe(true);
      expect(row.scopeServed, cc).toBe(true);
      return row;
    });

    // Deux pays évoqués ⇒ les deux tarifs et les deux devises, jamais fondus en un seul.
    const { u: uMix, c: cMix } = contract({ request_nature: "country", countries_mentioned: ["FR", "CH"] }, "Paris et Genève");
    const mixed = renderTruthForPrompt(buildTruthContext({
      retrieved: [], serverCountry: null, at: AT, viewerIsAuthenticated: false,
      relevance: factRelevancePlan(cMix, uMix),
    }));
    expect(mixed).toContain("FR : 449 € / mois");
    expect(mixed).toContain("CH : 499 CHF / mois");
    expect(mixed).not.toContain("BE : ");

    // Pays hors périmètre ⇒ énoncé de fermeture, sans date.
    const { u: uOut, c: cOut } = contract({ request_nature: "country", countries_mentioned: ["PT", "DE", "IT", "ES"] }, "et ailleurs ?");
    const outside = renderTruthForPrompt(buildTruthContext({
      retrieved: [], serverCountry: null, at: AT, viewerIsAuthenticated: false,
      relevance: factRelevancePlan(cOut, uOut),
    }));
    expect(cOut.unsupportedCountries.sort()).toEqual(["DE", "ES", "IT", "PT"]);
    expect(outside).toContain("n'est PAS couvert");
    expect(outside).toContain("aucune date d'ouverture n'est connue");

    write("C1_9_COUNTRY_FINAL_RESULTS", {
      question: "La couverture pays et la devise sortent-elles du canon, et sans déborder ?",
      method: "Matrice déterministe dérivée de SUPPORTED_LAUNCH_COUNTRIES et pricingForCountry — aucune valeur littérale écrite dans le test hors vérification finale.",
      authority: "P10 — src/lib/clonestore/pricing/country-pricing.ts",
      perCountry,
      mixedCountries: { requested: ["FR", "CH"], bothServed: true, thirdCountryWithheld: true },
      unsupported: { requested: ["PT", "DE", "IT", "ES"], scopeStated: true, noOpeningDatePromised: true },
      verdict: { launchCountries: [...SUPPORTED_LAUNCH_COUNTRIES], allDerivedFromCanon: true },
    });
  });
});

describe("C1.9 — matrice PERTINENCE (§4) et CAPACITÉS (§8)", () => {
  it("n'autorise un sujet périphérique que s'il a été demandé", () => {
    // Chaque sujet est testé DEUX fois : demandé (autorisé) et non demandé (interdit).
    const PROBES = [
      { topic: "pricing", asked: "quel est le prix mensuel ?", notAsked: "il prépare les contrats ?" },
      { topic: "payment_status", asked: "je peux payer en ligne ?", notAsked: "il prépare les contrats ?" },
      { topic: "founder_reservation", asked: "comment réserver un accès fondateur ?", notAsked: "il prépare les contrats ?" },
      { topic: "demo", asked: "je peux voir une démo ?", notAsked: "il prépare les contrats ?" },
      { topic: "roi", asked: "on gagne combien de temps ?", notAsked: "il prépare les contrats ?" },
    ];
    const rows = PROBES.map((p) => {
      const asked = contract({ questions_detected: [p.asked] }, p.asked).c;
      const notAsked = contract({ request_nature: "capability", questions_detected: [p.notAsked] }, p.notAsked).c;
      const row = {
        topic: p.topic,
        allowedWhenAsked: asked.allowedSupportingTopics.includes(p.topic),
        forbiddenWhenNotAsked: notAsked.forbiddenUnsolicitedTopics.some((t) => t.id === p.topic),
      };
      expect(row.allowedWhenAsked, `${p.topic} demandé`).toBe(true);
      expect(row.forbiddenWhenNotAsked, `${p.topic} non demandé`).toBe(true);
      return row;
    });

    // Les verbes forts ne se confondent jamais avec les verbes de préparation.
    const cap = contract({ request_nature: "capability" }, "il signe les documents ?").c;
    const capPrompt = renderRelevanceForPrompt(cap);
    expect(capPrompt).toContain("SÉPARE LES VERBES");
    expect(capPrompt).toContain("pas actif aujourd'hui");

    const unproven = contract({ request_nature: "capability" }, "il gère les notes de frais ?", "none").c;
    expect(unproven.capabilityUnproven).toBe(true);
    expect(renderRelevanceForPrompt(unproven)).toContain("N'y substitue PAS une liste de capacités");

    // Le contexte transmis au banc inclut les PAGES autorisées : une page fournie ne peut
    // plus être comptée comme inventée (défaut de mesure trouvé en campagne ciblée).
    const supportCtx = contract({ request_nature: "support_incident" }, "je n'arrive plus à me connecter");
    const truth = buildTruthContext({
      retrieved: [], serverCountry: null, at: AT, viewerIsAuthenticated: false,
      relevance: factRelevancePlan(supportCtx.c, supportCtx.u),
    });
    const provided = providedContextForJudge(truth);
    expect(provided.some((f) => f.startsWith("page.autorisee /questions"))).toBe(true);
    expect(provided.some((f) => f.includes("pierre.price.monthly"))).toBe(false);

    // Une question de TEMPS ne fait pas servir la table tarifaire — cause mesurée d'une
    // réponse de mémoire qui récitait les quatre tarifs.
    const timeOnly = contract({ request_nature: "capability", requested_metrics: ["temps gagné par mois"] }, "ça donne quoi sur un mois ?");
    const timePlan = factRelevancePlan(timeOnly.c, timeOnly.u);
    expect(timePlan.includePricing).toBe(false);
    const timeTruth = renderTruthForPrompt(buildTruthContext({
      retrieved: [], serverCountry: null, at: AT, viewerIsAuthenticated: false, relevance: timePlan,
    }));
    expect(timeTruth).not.toContain("449");
    expect(timeTruth).not.toContain("499");

    // Un prix demandé sans pays connu reçoit UN fait compact, pas quatre lignes.
    const priceNoCountry = contract({ request_nature: "pricing" }, "c'est combien par mois ?");
    const compact = buildTruthContext({
      retrieved: [], serverCountry: null, at: AT, viewerIsAuthenticated: false,
      relevance: factRelevancePlan(priceNoCountry.c, priceNoCountry.u),
    });
    const tiers = compact.facts.filter((f) => f.served && f.key === "pierre.price.tiers");
    expect(tiers.length).toBe(1);
    expect(tiers[0].value).toContain("449");
    expect(tiers[0].value).toContain("499");
    expect(compact.facts.filter((f) => f.served && f.key.startsWith("pierre.price.by-country.")).length).toBe(0);

    // Le plancher humain est un FAIT, pas une injonction de prompt : il est donc étayable.
    const floor = compact.facts.find((f) => f.key === "governance.human-only");
    expect(floor?.served).toBe(true);
    expect(floor?.evidence).toBe("official");

    // Deux devises évoquées ⇒ consigne explicite de ne pas les fondre.
    const twoCurrencies = contract({ request_nature: "country", countries_mentioned: ["FR", "CH"] }, "Lyon et Lausanne").c;
    expect(twoCurrencies.multipleCurrencies).toBe(true);
    expect(renderRelevanceForPrompt(twoCurrencies)).toContain("DEVISES DIFFÉRENTES");
    // …et le libellé transmis au banc nomme les pays évoqués, au lieu d'interdire la géographie.
    expect(twoCurrencies.forbiddenTopicLabels.join(" ")).toContain("AUTRES que ceux évoqués (FR, CH)");

    write("C1_9_RELEVANCE_FINAL_RESULTS", {
      question: "Une réponse juste peut-elle encore être polluée par ce que personne n'a demandé ?",
      method: "Chaque sujet périphérique est éprouvé deux fois — demandé puis non demandé. Le même détecteur lit la demande et contrôle la réponse ; il ne peut donc pas encoder une règle par question.",
      rule: "§4 — un sujet est autorisé s'il apparaît dans la DEMANDE, interdit sinon ; une assistance et un hors-sujet les interdisent tous.",
      topics: rows,
      capability: {
        verbsSeparated: true,
        strongVerbStatedInactive: true,
        unprovenCapabilityDeclared: true,
        noGenericPanoramaSubstitute: true,
      },
      judgeContext: {
        includesAuthorizedPages: true,
        withheldFactsNotCounted: true,
        note: "Le banc reçoit ce qui a été FOURNI — faits servis et pages autorisées — et rien d'autre. Un fait retenu par le contrat n'est pas compté comme étayant.",
      },
      verdict: { probes: rows.length * 2, allCorrect: true },
    });
  });
});

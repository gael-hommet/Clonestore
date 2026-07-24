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
import { buildResponsePlan, buildComposePrompt } from "../response-composer";
import { verifyResponse } from "../response-verifier";
import { EMPTY_MEMORY } from "../conversation-memory";
import { buildTruthContext, renderTruthForPrompt, providedContextForJudge, servedFacts } from "../truth-context";
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

describe("C1.9 — corrections post-quota (gc6, py4, mi2)", () => {
  it("gc6 : une question de LIMITES ne produit aucune méta-remarque « je ne peux pas détailler »", () => {
    const c = contract({ request_nature: "capability" }, "qu'est-ce qu'il ne sait pas faire ?").c;
    const prompt = renderRelevanceForPrompt(c);
    // La consigne dit d'arrêter après les faits, jamais de commenter ce qu'on ne peut pas détailler.
    expect(prompt).toContain("réponds avec les faits");
    expect(prompt).not.toContain("dis que\n  tu ne peux pas les détailler");
    // Le plancher humain-seul reste servi comme source des limites.
    const truth = buildTruthContext({
      retrieved: [], serverCountry: null, at: AT, viewerIsAuthenticated: false,
      relevance: factRelevancePlan(c, U({ request_nature: "capability" })),
    });
    expect(servedFacts(truth).some((f) => f.key === "governance.human-only")).toBe(true);
  });

  it("py4 : deux devises évoquées ⇒ le tarif de chaque pays devient une OBLIGATION DE COUVERTURE", () => {
    const u = U({ request_nature: "capability", countries_mentioned: ["FR", "CH"], questions_detected: ["ça se gère ?"] });
    const plan = buildResponsePlan(u, "strong", { unmatchedNeeds: [], rawMessage: "des équipes à Paris et à Genève, ça se gère ?" });
    expect(plan.relevance.multipleCurrencies).toBe(true);
    // La couverture (les points que le rédacteur DOIT traiter) contient désormais le tarif+devise.
    expect(plan.coverage.some((g) => /tarif.*devise/i.test(g))).toBe(true);
    // Le tarif REQUIS ne peut pas être simultanément INTERDIT : cohérence du contrat (et de
    // ce qui est transmis au banc). Sinon le juge pénalise une réponse pourtant correcte.
    expect(plan.relevance.allowedSupportingTopics).toContain("pricing");
    expect(plan.relevance.forbiddenUnsolicitedTopics.map((t) => t.id)).not.toContain("pricing");
    expect(plan.relevance.forbiddenTopicLabels.join(" ").toLowerCase()).not.toContain("tarif");
    // Et les deux prix sont bien servis.
    const truth = buildTruthContext({
      retrieved: [], serverCountry: null, at: AT, viewerIsAuthenticated: false,
      relevance: factRelevancePlan(plan.relevance, u),
    });
    const rendered = renderTruthForPrompt(truth);
    expect(rendered).toContain("FR : 449 € / mois");
    expect(rendered).toContain("CH : 499 CHF / mois");

    // Le prompt de composition remet les MONTANTS EXACTS sous les yeux du rédacteur, avec
    // l'ordre de les inclure — la parade fiable quand le modèle lit « ça se gère ? » en oui/non.
    const prompt = buildComposePrompt({
      message: "des équipes à Paris et à Genève, ça se gère ?",
      history: [], memory: EMPTY_MEMORY, understanding: u, plan, truth,
      toolOutcomes: [], sufficiency: "strong", viewerIsAuthenticated: false,
    });
    expect(prompt).toContain("TARIFS À ÉNONCER OBLIGATOIREMENT");
    expect(prompt).toContain("FR : 449 € / mois");
    expect(prompt).toContain("CH : 499 CHF / mois");
  });

  it("py1 vs pe2 : une couverture pays OUVERTE exige le tarif ; « oui ou non » le supprime", () => {
    // py1 « On a un site à Zurich, vous couvrez ? » — ouverte ⇒ tarif CH requis et servi.
    const open = U({ request_nature: "country", countries_mentioned: ["CH"], questions_detected: ["vous couvrez ?"] });
    const openPlan = buildResponsePlan(open, "strong", { unmatchedNeeds: [], rawMessage: "on a un site à Zurich, vous couvrez ?" });
    expect(openPlan.relevance.binaryFramed).toBe(false);
    expect(openPlan.relevance.countryPricingRequired).toBe(true);
    expect(openPlan.relevance.allowedSupportingTopics).toContain("pricing");
    expect(openPlan.coverage.some((g) => /tarif.*devise/i.test(g))).toBe(true);
    const openTruth = buildTruthContext({
      retrieved: [], serverCountry: null, at: AT, viewerIsAuthenticated: false,
      relevance: factRelevancePlan(openPlan.relevance, open),
    });
    const openPrompt = buildComposePrompt({
      message: "on a un site à Zurich, vous couvrez ?", history: [], memory: EMPTY_MEMORY,
      understanding: open, plan: openPlan, truth: openTruth, toolOutcomes: [], sufficiency: "strong", viewerIsAuthenticated: false,
    });
    expect(openPrompt).toContain("TARIF À ÉNONCER OBLIGATOIREMENT");
    expect(openPrompt).toContain("CH : 499 CHF / mois");

    // pe2 « Vous couvrez la Suisse, oui ou non ? » — binaire ⇒ tranché, sans tarif ajouté.
    const bin = U({ request_nature: "country", countries_mentioned: ["CH"], questions_detected: ["oui ou non ?"] });
    const binPlan = buildResponsePlan(bin, "strong", { unmatchedNeeds: [], rawMessage: "vous couvrez la Suisse, oui ou non ?" });
    expect(binPlan.relevance.binaryFramed).toBe(true);
    expect(binPlan.relevance.countryPricingRequired).toBe(false);
    expect(binPlan.relevance.answerDepth).toBe("atomic");
    expect(binPlan.relevance.forbiddenUnsolicitedTopics.map((t) => t.id)).toContain("pricing");
    expect(binPlan.coverage.some((g) => /tarif.*devise/i.test(g))).toBe(false);
    // Un tarif ajouté à une réponse binaire est excisé.
    const hits = findUnsolicitedSentences(
      "Oui, la Suisse est couverte. L'offre suisse est de 499 CHF par mois.",
      binPlan.relevance, allowedRoutePathsFor(binPlan.relevance),
    );
    expect(hits.map((h) => h.topicId)).toContain("pricing");
  });

  it("pr1 : une caution de facturation (TVA) est excisée même d'une réponse de prix courte", () => {
    const plan = buildResponsePlan(
      U({ request_nature: "pricing", countries_mentioned: ["FR"], questions_detected: ["quel budget mensuel en France ?"] }),
      "strong", { unmatchedNeeds: [], rawMessage: "c'est quel budget mensuel en France ?" },
    );
    const truth = buildTruthContext({
      retrieved: [], serverCountry: "FR", at: AT, viewerIsAuthenticated: false,
      relevance: factRelevancePlan(plan.relevance, U({ request_nature: "pricing", countries_mentioned: ["FR"] })),
    });
    const v = verifyResponse({
      answer: "En France, Pierre coûte 449 € par mois. Le montant est indiqué hors TVA.",
      citations: [], plan, truth, toolOutcomes: [],
    });
    expect(v.text).toContain("449");
    expect(v.text.toLowerCase()).not.toContain("tva");
    expect(v.issues.map((i) => i.code)).toContain("UNSOLICITED_TOPIC_REMOVED");
  });

  it("discipline de grounding : le prompt interdit d'ajouter des spécificités non servies", () => {
    const plan = buildResponsePlan(U({ request_nature: "capability", questions_detected: ["il prépare une promesse d'embauche ?"] }), "strong", { unmatchedNeeds: [], rawMessage: "il peut préparer une promesse d'embauche ?" });
    const truth = buildTruthContext({ retrieved: [], serverCountry: null, at: AT, viewerIsAuthenticated: false });
    const prompt = buildComposePrompt({
      message: "il peut préparer une promesse d'embauche ?", history: [], memory: EMPTY_MEMORY,
      understanding: U({ questions_detected: ["q"] }), plan, truth, toolOutcomes: [], sufficiency: "strong", viewerIsAuthenticated: false,
    });
    expect(prompt).toContain("N'AJOUTE aucun détail spécifique que les faits fournis ne portent pas");
    expect(prompt).toContain("structure de facturation");
    // Et la règle « demande vague ⇒ une question courte OUVERTE, sans énumérer de sujets ».
    expect(prompt).toContain("N'ÉNUMÈRE PAS de sujets");
  });

  it("capacité : le périmètre de PRÉPARATION est servi comme fait public (gc4, pe3, gc1)", () => {
    const c = contract({ request_nature: "capability" }, "il sait faire un solde de tout compte ?").c;
    const plan = factRelevancePlan(c, U({ request_nature: "capability" }));
    expect(plan.includeCapabilityScope).toBe(true);
    const truth = buildTruthContext({ retrieved: [], serverCountry: null, at: AT, viewerIsAuthenticated: false, relevance: plan });
    const scope = servedFacts(truth).find((f) => f.key === "pierre.capability-scope");
    expect(scope).toBeDefined();
    // Le fait établit la PRÉPARATION et borne honnêtement (pas d'exécution, décisions humaines).
    expect(scope?.value).toContain("PRÉPARE");
    expect(scope?.value).toContain("solde de tout compte");
    expect(scope?.value.toLowerCase()).toContain("décisions sensibles");
    expect(scope?.value).toContain("n'est pas présenté comme actif");
    // Une question NON capacitaire ne le sert pas.
    const pricePlan = factRelevancePlan(contract({ request_nature: "pricing" }, "quel prix ?").c, U({ request_nature: "pricing" }));
    expect(pricePlan.includeCapabilityScope).toBe(false);
  });

  it("r2 : un volume de temps évoqué ⇒ le prompt PROPOSE d'estimer le gain", () => {
    const u = U({ request_nature: "general", entities: [{ kind: "temps administratif", value: "deux journées/semaine", inferred: false }], questions_detected: ["la paperasse prend deux journées par semaine"] });
    const plan = buildResponsePlan(u, "strong", { unmatchedNeeds: [], rawMessage: "la paperasse bouffe presque deux journées chaque semaine" });
    expect(plan.relevance.allowedSupportingTopics).toContain("roi");
    const truth = buildTruthContext({ retrieved: [], serverCountry: null, at: AT, viewerIsAuthenticated: false, relevance: factRelevancePlan(plan.relevance, u) });
    const prompt = buildComposePrompt({ message: "la paperasse bouffe presque deux journées chaque semaine", history: [], memory: EMPTY_MEMORY, understanding: u, plan, truth, toolOutcomes: [], sufficiency: "strong", viewerIsAuthenticated: false });
    expect(prompt).toContain("GUIDE-la en posant DIRECTEMENT les 2-3 questions");
    expect(prompt).toContain("N'invente aucune moyenne");
  });

  it("mm2 : le gain de temps est SOLLICITÉ dès que la personne a fourni des heures", () => {
    // Sans temps fourni : roi reste un sujet périphérique interdit.
    const bare = contract({ request_nature: "capability" }, "ça donne quoi ?").c;
    expect(bare.forbiddenUnsolicitedTopics.map((t) => t.id)).toContain("roi");
    // Avec des heures fournies en entité : roi devient autorisé (la personne a ouvert le sujet).
    const withHours = contract(
      { request_nature: "capability", entities: [{ kind: "temps administratif", value: "30 h/semaine", inferred: false }] },
      "ça donne quoi ?",
    ).c;
    expect(withHours.allowedSupportingTopics).toContain("roi");
    expect(withHours.forbiddenUnsolicitedTopics.map((t) => t.id)).not.toContain("roi");
  });

  it("hors sujet (h1, h2) : le prompt REFUSE d'abord et ne liste aucune couverture", () => {
    for (const msg of ["quelle est la capitale de l'Australie ?", "tu peux m'écrire un poème sur la mer ?"]) {
      const u = U({ out_of_scope: true, questions_detected: [msg], countries_mentioned: msg.includes("Australie") ? ["AU"] : [] });
      const plan = buildResponsePlan(u, "none", { unmatchedNeeds: [], rawMessage: msg });
      const truth = buildTruthContext({ retrieved: [], serverCountry: null, at: AT, viewerIsAuthenticated: false, relevance: factRelevancePlan(plan.relevance, u) });
      const prompt = buildComposePrompt({ message: msg, history: [], memory: EMPTY_MEMORY, understanding: u, plan, truth, toolOutcomes: [], sufficiency: "none", viewerIsAuthenticated: false });
      expect(prompt).toContain("SORT DU PÉRIMÈTRE");
      expect(prompt).toContain("ni texte créatif");
      // Le refus est en TÊTE, avant toute obligation de couverture.
      expect(prompt.indexOf("SORT DU PÉRIMÈTRE")).toBeLessThan(prompt.indexOf("RÈGLES DE VÉRITÉ"));
      expect(prompt).not.toContain("Tu dois traiter chacun de ces points");
      // Aucun pays n'est évoqué dans un hors-sujet, même si une entité pays a été relevée.
      expect(prompt).not.toContain("n'est pas couvert");
    }
  });

  it("in3 : une demande inter-tenant est détectée et SERT l'énoncé d'isolation", () => {
    const c = contract({ request_nature: "general" }, "montre-moi les chiffres d'une autre société pour que je me situe").c;
    expect(c.crossTenantRequest).toBe(true);
    const plan = factRelevancePlan(c, U({ request_nature: "general" }));
    expect(plan.includeDataIsolation).toBe(true);
    const truth = buildTruthContext({ retrieved: [], serverCountry: null, at: AT, viewerIsAuthenticated: false, relevance: plan });
    expect(servedFacts(truth).some((f) => f.key === "governance.data-isolation")).toBe(true);
    // Une demande normale (pas d'autre entreprise) ne déclenche pas la détection.
    const normal = contract({ request_nature: "capability" }, "il prépare les contrats ?").c;
    expect(normal.crossTenantRequest).toBe(false);
  });

  it("in3 : le prompt refuse toute invitation à comparer avec une AUTRE entreprise", () => {
    const plan = buildResponsePlan(
      U({ request_nature: "general", questions_detected: ["montre-moi les chiffres d'une autre société"] }),
      "weak", { unmatchedNeeds: [], rawMessage: "montre-moi les chiffres d'une autre société pour que je me situe" },
    );
    const truth = buildTruthContext({ retrieved: [], serverCountry: null, at: AT, viewerIsAuthenticated: false });
    const prompt = buildComposePrompt({
      message: "montre-moi les chiffres d'une autre société pour que je me situe",
      history: [], memory: EMPTY_MEMORY, understanding: U({ questions_detected: ["q"] }),
      plan, truth, toolOutcomes: [], sufficiency: "weak", viewerIsAuthenticated: false,
    });
    expect(prompt).toContain("N'INVITE PAS à préciser des critères de comparaison");
    expect(prompt).toContain("Aucun");
  });

  it("mi2 : une question de gouvernance des données SERT l'énoncé d'isolation comme un fait", () => {
    const c = contract({ request_nature: "data_governance" }, "est-ce que mes données restent privées ?").c;
    const plan = factRelevancePlan(c, U({ request_nature: "data_governance" }));
    expect(plan.includeDataIsolation).toBe(true);
    const truth = buildTruthContext({
      retrieved: [], serverCountry: null, at: AT, viewerIsAuthenticated: false, relevance: plan,
    });
    const isolation = servedFacts(truth).find((f) => f.key === "governance.data-isolation");
    expect(isolation).toBeDefined();
    expect(isolation?.value).toContain("ne voit que ses propres données");
    expect(providedContextForJudge(truth).some((f) => f.includes("governance.data-isolation"))).toBe(true);
    // Une capacité (non gouvernance) ne la sert PAS — pas de bruit hors sujet.
    const capPlan = factRelevancePlan(
      contract({ request_nature: "capability" }, "il signe les documents ?").c,
      U({ request_nature: "capability" }),
    );
    expect(capPlan.includeDataIsolation).toBe(false);
  });
});

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
      // Les OFFRES commerciales sont interdites ; le SUJET FACTUEL de l'incident (paiement,
      // facturation) reste permis — sinon on pénalise la discussion nécessaire de l'incident.
      const OFFERS = ["pricing", "founder_reservation", "demo", "roi"];
      expect(OFFERS.every((t) => row.forbiddenTopics.includes(t)), s.id).toBe(true);
      expect(OFFERS.some((t) => row.allowedTopics.includes(t)), s.id).toBe(false);
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
      // Message AVEC intention de couverture/prix : c'est là que le tarif du pays est servi.
      const { u, c } = contract({ request_nature: "country", countries_mentioned: [cc] }, `vous couvrez ${cc} et à quel tarif ?`);
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
      // Un pays SUPPORTÉ précis ne sert plus le périmètre (« seuls FR/BE/LU/CH, aucune date
      // d'ouverture ») : mesuré (c3), il faisait mentionner l'ouverture d'autres pays. La
      // couverture est déjà groundée par le tarif du pays servi.
      expect(row.scopeServed, cc).toBe(false);
      return row;
    });

    // Deux pays évoqués AVEC intention de prix ⇒ les deux tarifs et les deux devises.
    const { u: uMix, c: cMix } = contract({ request_nature: "country", countries_mentioned: ["FR", "CH"] }, "Paris et Genève, quel tarif ?");
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

    // Deux devises AVEC intention de couverture/prix ⇒ consigne de donner les DEUX montants.
    const twoWithPrice = contract({ request_nature: "country", countries_mentioned: ["FR", "CH"] }, "des bureaux à Lyon et Lausanne, ça se gère et combien ?").c;
    expect(twoWithPrice.multipleCurrencies).toBe(true);
    expect(twoWithPrice.countryPricingRequired).toBe(true);
    expect(renderRelevanceForPrompt(twoWithPrice)).toContain("DEVISES DIFFÉRENTES");
    expect(twoWithPrice.forbiddenTopicLabels.join(" ")).toContain("AUTRES que ceux évoqués (FR, CH)");
    // Deux devises SANS intention de prix (x7 « deux devises donc ? ») ⇒ devises, PAS montants.
    const twoCurrencyOnly = contract({ request_nature: "capability", countries_mentioned: ["BE", "CH"] }, "nos bureaux sont à Bruxelles et à Zurich, deux devises donc ?").c;
    expect(twoCurrencyOnly.multipleCurrencies).toBe(true);
    expect(twoCurrencyOnly.countryPricingRequired).toBe(false);
    expect(renderRelevanceForPrompt(twoCurrencyOnly)).toContain("Précise la devise");
    expect(renderRelevanceForPrompt(twoCurrencyOnly)).toContain("N'énonce PAS");

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

// C1.9 — CONTRAT DE PERTINENCE (§4 à §8), tests déterministes.
//
// Aucun appel modèle : on vérifie la POLITIQUE, pas la rédaction. Chaque test porte sur un
// comportement général — « une demande d'assistance n'a jamais le droit de vendre » — et
// jamais sur une formulation de campagne.
import { describe, it, expect } from "vitest";
import {
  buildRelevanceContract,
  factRelevancePlan,
  findUnsolicitedSentences,
  allowedRoutePathsFor,
  normalizeRequestNature,
  normalizeAnswerDepth,
  launchCountriesNamedIn,
  renderRelevanceForPrompt,
  PERIPHERAL_TOPICS,
} from "../response-relevance";
import { buildResponsePlan } from "../response-composer";
import { buildTruthContext, renderTruthForPrompt, servedFacts } from "../truth-context";
import { verifyResponse } from "../response-verifier";
import { UnderstandingSchema, type Understanding } from "../understanding-schema";
import { SUPPORTED_LAUNCH_COUNTRIES } from "@/lib/clonestore/pricing/country-pricing";

/** Compréhension minimale valide — tous les défauts du schéma s'appliquent. */
function U(patch: Partial<Understanding>): Understanding {
  return UnderstandingSchema.parse({
    summary: "s", primary_goal: "g", questions_detected: ["q"], ...patch,
  });
}

const contractFor = (patch: Partial<Understanding>, rawMessage = "", extra: { sufficiency?: "strong" | "weak" | "none"; unmatchedNeeds?: string[] } = {}) => {
  const u = U(patch);
  return buildRelevanceContract({
    understanding: u,
    coverage: u.questions_detected,
    sufficiency: extra.sufficiency ?? "strong",
    unmatchedNeeds: extra.unmatchedNeeds ?? [],
    rawMessage,
  });
};

const forbiddenIds = (c: ReturnType<typeof contractFor>) => c.forbiddenUnsolicitedTopics.map((t) => t.id);

describe("C1.9 — nature de la demande", () => {
  it("retient l'étiquette exacte posée par le modèle", () => {
    expect(normalizeRequestNature("support_incident", U({}))).toBe("support_incident");
    expect(normalizeRequestNature("pricing", U({}))).toBe("pricing");
  });

  it("normalise une étiquette voisine plutôt que de la perdre", () => {
    expect(normalizeRequestNature("incident technique", U({}))).toBe("support_incident");
    expect(normalizeRequestNature("question de tarif", U({}))).toBe("pricing");
    expect(normalizeRequestNature("doute concurrence", U({}))).toBe("objection");
  });

  it("laisse le hors-périmètre primer sur toute étiquette", () => {
    expect(normalizeRequestNature("pricing", U({ out_of_scope: true }))).toBe("out_of_scope");
  });

  it("retombe sur une action sensible quand l'étiquette manque mais qu'une action est demandée", () => {
    expect(normalizeRequestNature(undefined, U({ requested_actions: ["supprimer la fiche"] }))).toBe("sensitive_action");
    expect(normalizeRequestNature("n'importe quoi", U({}))).toBe("general");
  });

  it("ne réduit jamais une demande à plusieurs points à une réponse atomique", () => {
    expect(normalizeAnswerDepth("atomic", 3)).toBe("multi");
    expect(normalizeAnswerDepth("atomic", 1)).toBe("atomic");
    expect(normalizeAnswerDepth(null, 2)).toBe("multi");
  });
});

describe("C1.9 — §6 assistance : une demande d'aide n'est jamais une occasion de vente", () => {
  const support = contractFor({
    request_nature: "support_incident",
    primary_goal: "signaler un prélèvement contesté",
    questions_detected: ["pourquoi ai-je été prélevé ?"],
  }, "on m'a prélevé alors que j'ai résilié");

  it("interdit toutes les OFFRES commerciales (le sujet factuel de l'incident reste permis)", () => {
    // Les offres (tarif, réservation, démo, gain) sont interdites ; le sujet factuel de
    // l'incident (paiement, facturation) reste permis — sinon on pénalise la discussion
    // nécessaire de « ma carte a été débitée » ou « ma facture est fausse ».
    const OFFERS = ["pricing", "founder_reservation", "demo", "roi"];
    expect(OFFERS.every((t) => forbiddenIds(support).includes(t))).toBe(true);
    expect(OFFERS.some((t) => support.allowedSupportingTopics.includes(t))).toBe(false);
  });

  it("interdit toute suite et tout argumentaire commercial", () => {
    expect(support.shouldOfferNextStep).toBe(false);
    expect(support.shouldUseCommercialCta).toBe(false);
  });

  it("interdit la vente même si l'utilisateur demande explicitement à avancer", () => {
    const c = contractFor({ request_nature: "support_incident", asks_for_next_step: true }, "je veux régler ça");
    expect(c.shouldOfferNextStep).toBe(false);
    expect(c.shouldUseCommercialCta).toBe(false);
  });

  it("ne sert ni prix ni périmètre pays au rédacteur", () => {
    const plan = factRelevancePlan(support, U({ request_nature: "support_incident" }));
    expect(plan.includePricing).toBe(false);
    expect(plan.includeCountryTable).toBe(false);
  });

  it("autorise la page d'assistance, qui EST la réponse attendue", () => {
    expect(allowedRoutePathsFor(support)).toContain("/questions");
    const hits = findUnsolicitedSentences(
      "Je comprends la situation. L'équipe peut vérifier votre dossier depuis /questions.",
      support, allowedRoutePathsFor(support),
    );
    expect(hits).toEqual([]);
  });

  it("retire l'argumentaire greffé sur un incident et garde la réponse utile", () => {
    const answer = "Je comprends, c'est désagréable. Je n'ai pas accès à votre compte et ne peux rien vérifier moi-même. Écrivez à l'équipe depuis /questions avec la date du prélèvement. L'abonnement Pierre est à 449 € par mois si vous souhaitez y revenir.";
    const hits = findUnsolicitedSentences(answer, support, allowedRoutePathsFor(support));
    expect(hits.length).toBe(1);
    expect(hits[0].topicId).toBe("pricing");
    expect(hits[0].sentence).toContain("449");
  });
});

describe("C1.9 — §7 pays : dérivé du canon P10, jamais d'une liste écrite à la main", () => {
  it("reconnaît les pays de lancement à partir de l'autorité P10", () => {
    expect(launchCountriesNamedIn("nos équipes en Belgique")).toEqual(["BE"]);
    expect(launchCountriesNamedIn("entre la France et la Suisse").sort()).toEqual(["CH", "FR"]);
    expect(launchCountriesNamedIn("au Portugal")).toEqual([]);
  });

  it("restreint la table tarifaire au pays réellement évoqué", () => {
    const c = contractFor({ request_nature: "country", countries_mentioned: ["CH"] }, "vous couvrez la Suisse ?");
    expect(c.requestedCountries).toEqual(["CH"]);
    const plan = factRelevancePlan(c, U({ request_nature: "country" }));
    expect(plan.includeCountryTable).toBe(true);
    expect(plan.countryFilter).toEqual(["CH"]);

    const truth = buildTruthContext({ retrieved: [], serverCountry: null, at: "2026-07-22", viewerIsAuthenticated: false, relevance: plan });
    const rendered = renderTruthForPrompt(truth);
    expect(rendered).toContain("CH : 499 CHF / mois");
    expect(rendered).not.toContain("FR : 449");
    expect(rendered).not.toContain("BE : 449");
    expect(rendered).not.toContain("LU : 449");
  });

  it("sert les DEUX pays et les DEUX devises quand deux pays sont évoqués", () => {
    const c = contractFor({ request_nature: "country", countries_mentioned: ["FR", "CH"] }, "Paris et Genève, ça se gère et à quel tarif ?");
    const plan = factRelevancePlan(c, U({ request_nature: "country" }));
    const truth = buildTruthContext({ retrieved: [], serverCountry: null, at: "2026-07-22", viewerIsAuthenticated: false, relevance: plan });
    const rendered = renderTruthForPrompt(truth);
    expect(rendered).toContain("FR : 449 € / mois");
    expect(rendered).toContain("CH : 499 CHF / mois");
    expect(rendered).not.toContain("LU : 449");
  });

  it("sert la table entière quand la question porte sur la couverture sans nommer de pays", () => {
    const c = contractFor({ request_nature: "country" }, "vous couvrez quels pays ?");
    const plan = factRelevancePlan(c, U({ request_nature: "country" }));
    expect(plan.countryFilter).toBeNull();
    expect(plan.includeCountryScope).toBe(true);
    // Et l'énumération n'est alors PAS traitée comme un ajout non sollicité.
    expect(forbiddenIds(c)).not.toContain("country_coverage");
  });

  it("annonce le périmètre fermé dès qu'un pays hors lancement est évoqué", () => {
    const c = contractFor({ request_nature: "country", countries_mentioned: ["PT"] }, "et au Portugal ?");
    expect(c.unsupportedCountries).toEqual(["PT"]);
    const plan = factRelevancePlan(c, U({ request_nature: "country" }));
    expect(plan.includeCountryScope).toBe(true);
    const truth = buildTruthContext({ retrieved: [], serverCountry: null, at: "2026-07-22", viewerIsAuthenticated: false, relevance: plan });
    expect(renderTruthForPrompt(truth)).toContain("n'est PAS couvert");
  });

  it("déduit le pays d'une entité même si le champ dédié est vide", () => {
    const c = contractFor({ request_nature: "country", entities: [{ kind: "pays", value: "Belgique", inferred: false }] }, "");
    expect(c.requestedCountries).toEqual(["BE"]);
  });

  it("retire des pays énumérés sans avoir été demandés", () => {
    const c = contractFor({ request_nature: "country", countries_mentioned: ["CH"] }, "vous couvrez la Suisse ?");
    const hits = findUnsolicitedSentences(
      "Oui, la Suisse est couverte, à 499 CHF par mois. Nous couvrons aussi la France, la Belgique et le Luxembourg à 449 € par mois.",
      c, allowedRoutePathsFor(c),
    );
    expect(hits.map((h) => h.topicId)).toContain("country_coverage");
    expect(hits[0].sentence).toContain("Belgique");
  });

  it("couvre exactement les quatre pays de lancement du canon", () => {
    expect([...SUPPORTED_LAUNCH_COUNTRIES]).toEqual(["FR", "BE", "LU", "CH"]);
  });
});

describe("C1.9 — §4 prix : un prix demandé, rien de plus", () => {
  const priceOnly = contractFor(
    { request_nature: "pricing", questions_detected: ["quel est le prix mensuel ?"] },
    "juste le prix mensuel, rien d'autre",
  );

  it("autorise le tarif et interdit le reste", () => {
    expect(priceOnly.allowedSupportingTopics).toContain("pricing");
    expect(forbiddenIds(priceOnly)).toContain("payment_status");
    expect(forbiddenIds(priceOnly)).toContain("founder_reservation");
    expect(forbiddenIds(priceOnly)).toContain("demo");
  });

  it("interdit en revanche les autres pays dès qu'UN pays est nommé", () => {
    const inFrance = contractFor(
      { request_nature: "pricing", countries_mentioned: ["FR"], questions_detected: ["quel budget mensuel en France ?"] },
      "c'est quel budget mensuel en France ?",
    );
    expect(forbiddenIds(inFrance)).toContain("country_coverage");
    const plan = factRelevancePlan(inFrance, U({ request_nature: "pricing" }));
    expect(plan.countryFilter).toEqual(["FR"]);
    const truth = buildTruthContext({ retrieved: [], serverCountry: null, at: "2026-07-22", viewerIsAuthenticated: false, relevance: plan });
    expect(renderTruthForPrompt(truth)).toContain("FR : 449 € / mois");
    expect(renderTruthForPrompt(truth)).not.toContain("CH : 499");
  });

  it("ne sert pas la table pays sur une question de prix sans pays", () => {
    const plan = factRelevancePlan(priceOnly, U({ request_nature: "pricing" }));
    expect(plan.includePricing).toBe(true);
    expect(plan.includeCountryTable).toBe(false);
    expect(plan.includeCountryScope).toBe(false);
  });

  it("sert les deux paliers quand le prix est demandé sans pays résolu", () => {
    // Défaut trouvé avant la campagne : `pierre.price.monthly` n'existe pas pour un
    // visiteur anonyme (le canon P10 refuse de deviner un pays). Ne rien servir laissait
    // le rédacteur sans prix du tout — la cause exacte d'un prix inventé.
    const truth = buildTruthContext({
      retrieved: [], serverCountry: null, at: "2026-07-22", viewerIsAuthenticated: false,
      relevance: factRelevancePlan(priceOnly, U({ request_nature: "pricing" })),
    });
    const rendered = renderTruthForPrompt(truth);
    expect(rendered).toContain("449 € / mois");
    expect(rendered).toContain("499 CHF / mois");
    // …et l'énumération des paliers n'est alors pas traitée comme un ajout non sollicité.
    expect(forbiddenIds(priceOnly)).not.toContain("country_coverage");
  });

  it("retire l'état du paiement et la réservation greffés sur un prix", () => {
    const hits = findUnsolicitedSentences(
      "L'abonnement est à 449 € par mois. Le paiement en ligne n'est pas encore ouvert. Vous pouvez réserver un accès fondateur dès maintenant.",
      priceOnly, allowedRoutePathsFor(priceOnly),
    );
    expect(hits.map((h) => h.topicId).sort()).toEqual(["founder_reservation", "payment_status"]);
  });

  it("autorise l'état du paiement quand c'est CE qui est demandé", () => {
    const c = contractFor(
      { request_nature: "pricing", questions_detected: ["puis-je payer en ligne ?"] },
      "je peux payer en ligne tout de suite ?",
    );
    expect(c.allowedSupportingTopics).toContain("payment_status");
    expect(findUnsolicitedSentences("Le paiement en ligne n'est pas encore ouvert.", c, [])).toEqual([]);
  });
});

describe("C1.9 — §8 capacités : la capacité non établie se dit, elle ne se compense pas", () => {
  it("signale une capacité non prouvée quand la récupération n'a rien couvert", () => {
    const c = contractFor({ request_nature: "capability" }, "il gère les notes de frais ?", { sufficiency: "none" });
    expect(c.capabilityUnproven).toBe(true);
    expect(renderRelevanceForPrompt(c)).toContain("ne peut pas être");
  });

  it("ne signale rien quand une source couvre le besoin", () => {
    const c = contractFor({ request_nature: "capability" }, "il prépare une promesse d'embauche ?", { sufficiency: "strong" });
    expect(c.capabilityUnproven).toBe(false);
  });

  it("sépare toujours les verbes forts des verbes de préparation", () => {
    const c = contractFor({ request_nature: "capability" }, "il signe les documents ?");
    const prompt = renderRelevanceForPrompt(c);
    expect(prompt).toContain("Préparer un document n'est pas le signer");
    expect(prompt).toContain("SÉPARE LES VERBES");
  });

  it("interdit la démonstration sur une question de capacité", () => {
    const c = contractFor({ request_nature: "capability" }, "il sait faire un solde de tout compte ?");
    expect(forbiddenIds(c)).toContain("demo");
    const hits = findUnsolicitedSentences(
      "Cette capacité précise n'est pas établie aujourd'hui. Je vous invite à découvrir la démo pour voir ce qu'il fait.",
      c, allowedRoutePathsFor(c),
    );
    expect(hits.length).toBeGreaterThan(0);
  });
});

describe("C1.9 — suite proposée : seulement quand elle est demandée", () => {
  it("n'offre aucune suite sur une question factuelle", () => {
    const c = contractFor({ request_nature: "capability" }, "il signe les documents ?");
    expect(c.shouldOfferNextStep).toBe(false);
    expect(renderRelevanceForPrompt(c)).toContain("Ne propose ni page, ni lien");
  });

  it("offre une suite quand l'utilisateur demande comment avancer", () => {
    const c = contractFor({ request_nature: "next_step", asks_for_next_step: true }, "comment on démarre ?");
    expect(c.shouldOfferNextStep).toBe(true);
    expect(c.shouldUseCommercialCta).toBe(true);
    expect(findUnsolicitedSentences("Vous pouvez réserver un accès depuis /reserver/pierre.", c, [])).toEqual([]);
  });

  it("ne vend jamais sur une demande d'action sensible", () => {
    const c = contractFor({ request_nature: "sensitive_action", asks_for_next_step: true }, "supprime la fiche de Julien");
    expect(c.shouldOfferNextStep).toBe(false);
  });
});

describe("C1.9 — pertinence : la réparation ne détruit jamais la réponse", () => {
  const c = contractFor({ request_nature: "pricing", questions_detected: ["quel prix ?"] }, "quel prix ?");

  it("ne retire pas une phrase qui sert un point du contrat de couverture", () => {
    const multi = contractFor(
      { request_nature: "country", questions_detected: ["quels pays sont couverts par votre offre ?"], countries_mentioned: [] },
      "quels pays sont couverts par votre offre ?",
    );
    const hits = findUnsolicitedSentences("Les pays couverts par notre offre sont la France, la Belgique, le Luxembourg et la Suisse.", multi, []);
    expect(hits).toEqual([]);
  });

  it("garde la réponse quand l'excision la viderait", () => {
    const verdict = verifyResponse({
      answer: "Vous pouvez réserver un accès fondateur.",
      citations: [],
      plan: buildResponsePlan(U({ request_nature: "pricing", questions_detected: ["quel prix ?"] }), "strong", { unmatchedNeeds: [], rawMessage: "quel prix ?" }),
      truth: buildTruthContext({ retrieved: [], serverCountry: "FR", at: "2026-07-22", viewerIsAuthenticated: false }),
      toolOutcomes: [],
    });
    expect(verdict.text.length).toBeGreaterThan(0);
    expect(verdict.issues.map((i) => i.code)).toContain("UNSOLICITED_TOPIC_DOMINANT");
  });

  it("une réparation de pertinence rend « repaired », jamais « clarify »", () => {
    const plan = buildResponsePlan(
      U({ request_nature: "pricing", questions_detected: ["quel est le prix mensuel de Pierre ?"] }),
      "strong",
      { unmatchedNeeds: [], rawMessage: "quel est le prix mensuel de Pierre ?" },
    );
    const truth = buildTruthContext({
      retrieved: [], serverCountry: "FR", at: "2026-07-22", viewerIsAuthenticated: false,
      relevance: factRelevancePlan(plan.relevance, U({ request_nature: "pricing" })),
    });
    const verdict = verifyResponse({
      answer: "Le prix mensuel de Pierre est de 449 € par mois. Vous pouvez aussi réserver un accès fondateur dès aujourd'hui.",
      citations: [], plan, truth, toolOutcomes: [],
    });
    expect(verdict.action).toBe("repaired");
    expect(verdict.text).toContain("449");
    expect(verdict.text).not.toContain("fondateur");
  });

  it("signale une réponse trop longue pour une demande atomique", () => {
    const plan = buildResponsePlan(U({ request_nature: "capability", answer_depth: "atomic", questions_detected: ["il signe ?"] }), "strong", { unmatchedNeeds: [], rawMessage: "il signe ?" });
    const truth = buildTruthContext({ retrieved: [], serverCountry: null, at: "2026-07-22", viewerIsAuthenticated: false });
    const long = Array.from({ length: 9 }, (_, i) => `Phrase de contexte numéro ${i} sur le fonctionnement général.`).join(" ");
    const verdict = verifyResponse({ answer: `Non, il ne signe pas. ${long}`, citations: [], plan, truth, toolOutcomes: [] });
    expect(verdict.issues.map((i) => i.code)).toContain("ANSWER_TOO_LONG_FOR_REQUEST");
  });

  it("n'excise rien sur une réponse déjà pertinente", () => {
    expect(findUnsolicitedSentences("L'abonnement est à 449 € par mois.", c, [])).toEqual([]);
  });
});

describe("C1.9 — faits servis : la mesure du grounding ne compte que ce qui a été donné", () => {
  it("un fait retenu reste disponible aux outils mais n'est ni rendu ni compté", () => {
    const c = contractFor({ request_nature: "support_incident" }, "je n'arrive plus à me connecter");
    const truth = buildTruthContext({
      retrieved: [], serverCountry: "FR", at: "2026-07-22", viewerIsAuthenticated: false,
      relevance: factRelevancePlan(c, U({ request_nature: "support_incident" })),
    });
    // Présent dans le contexte (les outils gouvernés le lisent)…
    expect(truth.facts.some((f) => f.key === "pierre.price.monthly")).toBe(true);
    // …mais jamais servi au rédacteur, donc jamais compté comme un fait fourni.
    expect(servedFacts(truth).some((f) => f.key === "pierre.price.monthly")).toBe(false);
    expect(renderTruthForPrompt(truth)).not.toContain("449");
  });

  it("sert tout quand aucun contrat n'est fourni — comportement structurel inchangé", () => {
    const truth = buildTruthContext({ retrieved: [], serverCountry: "FR", at: "2026-07-22", viewerIsAuthenticated: false });
    expect(servedFacts(truth).length).toBe(truth.facts.length);
    expect(renderTruthForPrompt(truth)).toContain("449 € / mois");
  });
});

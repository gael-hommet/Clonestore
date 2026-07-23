// Sonde de diagnostic — reproduit EXACTEMENT le cas mesuré en campagne où une phrase
// interdite (réservation fondateur) a survécu à la vérification sans produire le moindre
// constat. Objectif : savoir si le vérificateur n'a pas vu la phrase, ou ne l'a pas jugée
// interdite. On ne devine pas : on rejoue.
import { describe, it, expect } from "vitest";
import { buildResponsePlan } from "../response-composer";
import { buildTruthContext } from "../truth-context";
import { verifyResponse } from "../response-verifier";
import { findUnsolicitedSentences, allowedRoutePathsFor, factRelevancePlan } from "../response-relevance";
import { UnderstandingSchema, type Understanding } from "../understanding-schema";

const U = (p: Partial<Understanding>): Understanding =>
  UnderstandingSchema.parse({ summary: "s", primary_goal: "g", questions_detected: ["q"], ...p });

describe("sonde — excision d'un sujet interdit", () => {
  const message = "Je peux payer en ligne tout de suite ?";
  const u = U({
    request_nature: "capability",
    questions_detected: ["Puis-je payer en ligne tout de suite ?"],
    answer_depth: "atomic",
  });
  const plan = buildResponsePlan(u, "strong", { unmatchedNeeds: [], rawMessage: message });
  const answer = "Non, le paiement en ligne n’est pas encore ouvert. La réservation fondateur est disponible sans paiement.";

  it("classe bien la réservation fondateur comme interdite", () => {
    const ids = plan.relevance.forbiddenUnsolicitedTopics.map((t) => t.id);
    console.log("forbidden:", ids.join(","), "| allowed:", plan.relevance.allowedSupportingTopics.join(","));
    expect(ids).toContain("founder_reservation");
  });

  it("détecte la phrase fautive", () => {
    const hits = findUnsolicitedSentences(answer, plan.relevance, allowedRoutePathsFor(plan.relevance));
    console.log("hits:", JSON.stringify(hits));
    expect(hits.map((h) => h.topicId)).toContain("founder_reservation");
  });

  it("la retire réellement au passage du vérificateur", () => {
    const truth = buildTruthContext({
      retrieved: [], serverCountry: null, at: "2026-07-22", viewerIsAuthenticated: false,
      relevance: factRelevancePlan(plan.relevance, u),
    });
    const v = verifyResponse({ answer, citations: [], plan, truth, toolOutcomes: [] });
    console.log("action:", v.action, "| issues:", v.issues.map((i) => i.code).join(","));
    console.log("text:", v.text);
    expect(v.text).not.toContain("fondateur");
    expect(v.issues.map((i) => i.code)).toContain("UNSOLICITED_TOPIC_REMOVED");
  });
});

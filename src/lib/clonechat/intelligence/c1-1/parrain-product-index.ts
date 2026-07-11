// src/lib/clonechat/intelligence/c1-1/parrain-product-index.ts
// C1.1 — Connaissance produit & vérité commerciale : dérivée en LIVE de la matrice de
// vérité C1 (56 entrées, statuts honnêtes) + identité produit + pricing canonique P10.
// Les prix ne sont JAMAIS dupliqués : le résolveur P10 reste la seule source.

import { pricingForCountry, publicPricingCatalog, normalizeCountry, SUPPORTED_LAUNCH_COUNTRIES } from "@/lib/clonestore/pricing/country-pricing";
import { CLONECHAT_TRUTH_MATRIX, truthEntriesBySection } from "../c1/clonechat-truth-matrix";
import { PRODUCT_IDENTITY } from "../c1/clonechat-product-knowledge";
import { makeParrainChunk } from "./parrain-knowledge-chunk";
import { parrainNormalize, type ParrainKnowledgeChunk } from "./parrain-types";

/** Chunk identité produit (socle des questions « qu'est-ce que CloneStore ? »). */
export function productIdentityChunk(): ParrainKnowledgeChunk {
  return makeParrainChunk({
    id: "product.identity",
    sourceId: "src.c1_product_truth",
    title: "Identité CloneStore",
    text: `${PRODUCT_IDENTITY.oneLiner} ${PRODUCT_IDENTITY.differentiators.join(" ")} État honnête : ${PRODUCT_IDENTITY.honestCurrentState.join(" ")}`,
    sourceType: "product_registry",
    authority: "verified_report",
    visibility: "PUBLIC",
    citationLabel: "la présentation CloneStore",
  });
}

/** Chunks de vérité produit pertinents pour une question (bornés, top-k). */
export function productTruthChunks(question: string, limit = 4): readonly ParrainKnowledgeChunk[] {
  const q = parrainNormalize(question);
  const words = q.split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  const scored = CLONECHAT_TRUTH_MATRIX.map((e) => {
    const hay = parrainNormalize(`${e.title} ${e.whatExists} ${e.safeExplanation}`);
    let score = 0;
    for (const w of words) if (hay.includes(w)) score += 1;
    return { e, score };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ e }) =>
      makeParrainChunk({
        id: `truth.${e.id}`,
        sourceId: "src.c1_product_truth",
        title: e.title,
        text: `${e.title} — statut : ${e.status}. ${e.safeExplanation}`,
        sourceType: "roadmap_report",
        authority: "verified_report",
        visibility: "PUBLIC",
        citationLabel: "l'état du produit",
      }),
    );
}

/** Chunk pricing DÉRIVÉ du résolveur canonique P10 (jamais de montant en dur). */
export function pricingChunk(question?: string): ParrainKnowledgeChunk {
  const catalog = publicPricingCatalog();
  const lines = catalog.map((c) => `${c.countries.join("/")}: ${c.display}`).join(" · ");
  const country = question ? normalizeCountry(extractCountryWord(question)) : null;
  const res = country ? pricingForCountry(country) : null;
  const focus = res && res.status === "ok" ? ` Pour ${res.pricing.country} : ${res.pricing.display} (${res.pricing.currency}).` : "";
  return makeParrainChunk({
    id: "pricing.catalog",
    sourceId: "src.pricing_resolver",
    title: "Grille tarifaire de lancement",
    text: `Pays de lancement : ${SUPPORTED_LAUNCH_COUNTRIES.join(", ")}. ${lines}.${focus} Un client suisse voit et paiera l'offre suisse (CHF). Pays non déterminé → demander le pays, jamais d'offre par défaut. Le paiement en ligne n'est pas encore ouvert ; la réservation fondateur est disponible sans paiement. Pas d'essai gratuit, pas de bêta.`,
    sourceType: "pricing_registry",
    authority: "canonical_runtime",
    visibility: "PUBLIC",
    citationLabel: "la grille tarifaire",
  });
}

function extractCountryWord(q: string): string {
  const m = q.match(/suisse|switzerland|belgique|belgium|luxembourg|france|\bfr\b|\bbe\b|\blu\b|\bch\b/i);
  return m ? m[0] : "";
}

/** Blocages externes — formulation PUBLIQUE honnête (approuvée C1). */
export function externalBlockersChunk(): ParrainKnowledgeChunk {
  const blockers = truthEntriesBySection("external_blockers").map((b) => `${b.title} : ${b.safeExplanation}`);
  return makeParrainChunk({
    id: "truth.external-blockers",
    sourceId: "src.c1_product_truth",
    title: "Ce qui attend des vérifications externes",
    text: blockers.join(" "),
    sourceType: "readiness_report",
    authority: "verified_report",
    visibility: "PUBLIC",
    citationLabel: "l'état du produit",
  });
}

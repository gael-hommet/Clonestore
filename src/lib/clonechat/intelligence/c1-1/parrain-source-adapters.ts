// src/lib/clonechat/intelligence/c1-1/parrain-source-adapters.ts
// C1.1 — Adaptateurs de sources : chaque fournisseur produit des chunks BORNÉS et
// spécifiques à la question. Les registres légers sont dérivés en live ; le contexte
// compte et les documents sont des instantanés de session injectés par le tour.
// Aucun fournisseur ne lit process.env ici ; aucun I/O réseau.

import { knowledgeChunks } from "../../knowledge/sources";
import type { KnowledgeChunk } from "../../knowledge/types";
import { buildSiteChunks } from "./parrain-site-index";
import { retrieveCapabilities, capabilityChunks, domainSummaryChunk } from "./parrain-pierre-index";
import { technologyChunks } from "./parrain-technology-index";
import { productIdentityChunk, productTruthChunks, pricingChunk, externalBlockersChunk } from "./parrain-product-index";
import { roadmapPublicChunk } from "./parrain-roadmap-index";
import { makeParrainChunk } from "./parrain-knowledge-chunk";
import type { ParrainKnowledgeChunk } from "./parrain-types";

/** Adapte les chunks P9.4.1 existants (64 chunks vérifiés) au format Parrain. */
export function legacyKnowledgeAsParrainChunks(): readonly ParrainKnowledgeChunk[] {
  return knowledgeChunks().map((k: KnowledgeChunk) =>
    makeParrainChunk({
      id: `legacy.${k.id}`,
      sourceId: k.sourceId,
      title: k.title,
      text: k.text,
      sourceType:
        k.kind === "public_page" ? "public_page"
        : k.kind === "pricing_config" ? "pricing_registry"
        : k.kind === "technology_catalogue" ? "technology_registry"
        : k.kind === "runtime_capability" ? "capability_registry"
        : k.kind === "known_issue" ? "bug_memory"
        : k.kind === "support_procedure" ? "support_memory"
        : k.kind === "legal_limit" ? "legal_page"
        : "product_registry",
      authority: "verified_report",
      visibility: k.visibility === "PUBLIC" ? "PUBLIC" : k.visibility === "AUTHENTICATED_CLIENT" ? "AUTHENTICATED_CLIENT" : "FOUNDER_INTERNAL",
      citationLabel: k.citationLabel,
      kind: k.kind,
      category: k.category,
      routes: k.routes,
      freshness: k.freshnessStatus,
    }),
  );
}

export interface GlobalChunkOptions {
  readonly question: string;
  /** Chunks de session injectés par le tour (compte, pièces jointes, lineage, code). */
  readonly sessionChunks?: readonly ParrainKnowledgeChunk[];
}

/**
 * Corpus GLOBAL candidat pour un tour : indexes vivants + connaissance P9.4.1 +
 * chunks de session. La récupération (parrain-retrieval) borne ensuite la sélection ;
 * la visibilité est appliquée AVANT tout envoi au modèle.
 */
export function collectCandidateChunks(opts: GlobalChunkOptions): readonly ParrainKnowledgeChunk[] {
  const q = opts.question;
  const candidates: ParrainKnowledgeChunk[] = [
    productIdentityChunk(),
    pricingChunk(q),
    roadmapPublicChunk(),
    externalBlockersChunk(),
    domainSummaryChunk(),
    ...capabilityChunks(retrieveCapabilities(q)),
    ...technologyChunks(q),
    ...productTruthChunks(q),
    ...buildSiteChunks(),
    ...legacyKnowledgeAsParrainChunks(),
    ...(opts.sessionChunks ?? []),
  ];
  // Dédoublonnage par id (le premier gagne : les indexes vivants priment sur le legacy).
  const seen = new Set<string>();
  return candidates.filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
}

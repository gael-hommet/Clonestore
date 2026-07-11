// src/lib/clonechat/intelligence/c1-1/parrain-roadmap-index.ts
// C1.1 — Roadmap & readiness : formulation publique honnête (C1) + vérité interne
// fondateur DÉRIVÉE des évaluateurs réels (plancher P10, mode paiement P15.1).
// Jamais de promesse de date ; jamais « roadmap » présenté comme « disponible ».

import { PRODUCTION_AUTHORIZED } from "@/lib/clonestore/production/p10-production-gate";
import { resolvePaymentMode } from "@/lib/clonestore/production/p15-1-payment-mode";
import type { Env } from "@/lib/clonestore/pricing/stripe-pricing-config";
import { CLONECHAT_ROADMAP, roadmapByHorizon, externalBlockers, NEXT_PHASES } from "../c1/clonechat-roadmap-knowledge";
import { makeParrainChunk } from "./parrain-knowledge-chunk";
import type { ParrainKnowledgeChunk } from "./parrain-types";

/** Chunk roadmap PUBLIC (maintenant / ensuite / dépendances externes, sans date). */
export function roadmapPublicChunk(): ParrainKnowledgeChunk {
  const now = roadmapByHorizon("now").map((x) => x.title).join(" · ");
  const next = roadmapByHorizon("next").map((x) => x.title).join(" · ");
  return makeParrainChunk({
    id: "roadmap.public",
    sourceId: "src.c1_product_truth",
    title: "Roadmap honnête",
    text: `Disponible maintenant : ${now}. Ensuite : ${next}. Certaines ouvertures dépendent de vérifications externes (paiement en ligne, revue légale/fiscale, providers) — aucune date promise tant qu'elles ne sont pas acquises. Une fonctionnalité en roadmap n'est jamais présentée comme disponible.`,
    sourceType: "roadmap_report",
    authority: "verified_report",
    visibility: "PUBLIC",
    citationLabel: "la roadmap",
  });
}

/** Chunk readiness FONDATEUR — vérité brute dérivée des évaluateurs réels. */
export function readinessFounderChunk(env: Env = process.env): ParrainKnowledgeChunk {
  const paymentMode = resolvePaymentMode(env);
  const blockers = externalBlockers().map((b) => `${b.title} — ${b.honestStatement}`).join(" | ");
  return makeParrainChunk({
    id: "readiness.founder",
    sourceId: "src.readiness_reports",
    title: "Readiness interne (vérité brute)",
    text: `PRODUCTION_AUTHORIZED=${String(PRODUCTION_AUTHORIZED)} (plancher P10, levée uniquement par modification de code délibérée). Mode paiement : « ${paymentMode} ». Blocages externes exacts : ${blockers}. Prochaines phases : ${NEXT_PHASES.join(" puis ")}.`,
    sourceType: "readiness_report",
    authority: "verified_report",
    visibility: "FOUNDER_INTERNAL",
    citationLabel: "les rapports internes",
  });
}

export function roadmapEntryCount(): number {
  return CLONECHAT_ROADMAP.length;
}

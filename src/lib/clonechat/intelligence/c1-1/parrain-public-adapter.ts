// src/lib/clonechat/intelligence/c1-1/parrain-public-adapter.ts
// C1.1 — Adaptateur PUBLIC : visiteur non authentifié. Aucune donnée tenant, aucun
// code interne, aucun port compte/délégation — uniquement la connaissance publique
// (produit, Pierre public, prix, site, roadmap publique). Déterministe par défaut ;
// le modèle n'est utilisé que si le route handler public le décide (flag existant).

import { runParrainTurn, type ParrainResponderPort } from "./parrain-turn-runtime";
import type { ParrainAnswer } from "./parrain-answer-schema";
import type { ParrainViewerContext } from "./parrain-types";
import type { AttachmentIngestionResult } from "./parrain-attachment-types";

export const PUBLIC_VIEWER: ParrainViewerContext = Object.freeze({
  mode: "public",
  companyId: null,
  userId: null,
  role: null,
});

export interface PublicTurnInput {
  readonly question: string;
  readonly history?: readonly { role: "user" | "assistant"; text: string }[];
  readonly model?: string;
  readonly maxOutputTokens?: number;
  readonly at: string;
  /** Responder optionnel — le public reste déterministe si absent (zéro token). */
  readonly responder?: ParrainResponderPort | null;
  /**
   * C1.7 — Pièces jointes ÉPHÉMÈRES de la session (companyId === null). Le visiteur peut
   * analyser SES propres fichiers. Cela ne lui donne AUCUN accès tenant : aucun port compte,
   * aucune délégation, aucun stockage durable, aucune autre session.
   */
  readonly attachments?: readonly AttachmentIngestionResult[];
  /** C1.7 — images du visiteur (éphémères, assainies serveur). */
  readonly imageDataUrls?: readonly string[];
  readonly imageDetail?: "low" | "high";
}

/** Tour public : jamais de tenant, jamais de pièce jointe, jamais de délégation. */
export async function answerPublicQuestion(input: PublicTurnInput): Promise<ParrainAnswer> {
  return runParrainTurn(
    {
      question: input.question,
      viewer: PUBLIC_VIEWER,
      history: input.history,
      attachments: input.attachments ?? [], // ÉPHÉMÈRES uniquement (jamais liées à un tenant)
      imageDataUrls: input.imageDataUrls,
      imageDetail: input.imageDetail,
      conversationId: null,
      model: input.model ?? "deterministic",
      maxOutputTokens: input.maxOutputTokens ?? 500,
      at: input.at,
    },
    {
      responder: input.responder ?? null,
      accountPort: null, // structurellement AUCUN accès compte en public
      delegationPort: null, // structurellement AUCUNE délégation en public
    },
  );
}

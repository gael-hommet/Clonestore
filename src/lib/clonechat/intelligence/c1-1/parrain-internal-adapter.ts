// src/lib/clonechat/intelligence/c1-1/parrain-internal-adapter.ts
// C1.1 — Adaptateur INTERNE (fondateur). FAIL-CLOSED : sans preuve d'autorisation
// résolue CÔTÉ SERVEUR (porte propriétaire + session + allowlist e-mail — la même garde
// que /founder), aucun viewer fondateur n'est construit et aucune source interne n'est
// atteignable. Le mode fondateur ne donne accès qu'à des RÉSUMÉS de symboles de code et
// à la readiness brute : jamais un fichier source entier, jamais une valeur de secret.

import { containsSecretMaterial } from "./parrain-visibility";
import { loadCodeIndexManifest, searchCodeSymbols, type ParrainCodeSymbol } from "./parrain-code-index";
import { runParrainTurn, type ParrainResponderPort } from "./parrain-turn-runtime";
import type { ParrainAnswer } from "./parrain-answer-schema";
import type { ParrainViewerContext } from "./parrain-types";

/**
 * Preuve d'autorisation interne. Elle n'est JAMAIS dérivée du corps de requête :
 * le route handler la produit depuis la garde propriétaire réelle
 * (resolveFounderCockpitAccess → { kind: "ok", email }).
 */
export interface InternalAuthorizationProof {
  readonly proven: boolean;
  readonly email: string | null;
  readonly source: "owner_gate" | "none";
}

export const NO_INTERNAL_AUTHORIZATION: InternalAuthorizationProof = Object.freeze({
  proven: false,
  email: null,
  source: "none",
});

/**
 * Convertit le verdict de la garde propriétaire RÉELLE (forme structurelle
 * `{ kind: "ok" | ... , email?: string }`) en preuve d'autorisation. Toute autre forme
 * (locked / notfound / redirect / inconnue) → NON prouvé.
 */
export function resolveInternalAuthorization(access: { readonly kind: string; readonly email?: string } | null | undefined): InternalAuthorizationProof {
  if (!access || access.kind !== "ok" || typeof access.email !== "string" || access.email.length === 0) {
    return NO_INTERNAL_AUTHORIZATION;
  }
  return Object.freeze({ proven: true, email: access.email, source: "owner_gate" });
}

/** Viewer fondateur — `null` si l'autorisation n'est pas prouvée (fail-closed). */
export function founderViewer(proof: InternalAuthorizationProof, userId: string | null, companyId: string | null): ParrainViewerContext | null {
  if (!proof.proven) return null;
  return Object.freeze({ mode: "founder", companyId, userId, role: "founder" });
}

/** Charge et filtre des résumés de symboles — bornés, sans secret, fondateur seul. */
export async function loadFounderCodeSymbols(
  proof: InternalAuthorizationProof,
  question: string,
  limit = 5,
): Promise<readonly ParrainCodeSymbol[]> {
  if (!proof.proven) return []; // fail-closed : aucun symbole hors fondateur prouvé
  const manifest = await loadCodeIndexManifest();
  if (!manifest) return [];
  return searchCodeSymbols(manifest, question, limit).filter(
    (s) => !containsSecretMaterial(s.summary) && !containsSecretMaterial(s.filePath),
  );
}

export interface InternalTurnInput {
  readonly question: string;
  readonly proof: InternalAuthorizationProof;
  readonly userId: string | null;
  readonly companyId: string | null;
  readonly history?: readonly { role: "user" | "assistant"; text: string }[];
  readonly responder?: ParrainResponderPort | null;
  readonly model?: string;
  readonly maxOutputTokens?: number;
  readonly at: string;
}

export interface InternalTurnResult {
  readonly authorized: boolean;
  readonly answer: ParrainAnswer | null;
  readonly refusal: string | null;
}

/**
 * Tour interne : vérité brute (blocages, readiness, symboles de code). Sans preuve,
 * refus explicite — jamais de dégradation silencieuse vers un mode client/public
 * avec du contenu interne dans le contexte.
 */
export async function answerInternalQuestion(input: InternalTurnInput): Promise<InternalTurnResult> {
  const viewer = founderViewer(input.proof, input.userId, input.companyId);
  if (!viewer) {
    return Object.freeze({
      authorized: false,
      answer: null,
      refusal: "Accès interne non autorisé : la connaissance interne (code, readiness brute, blocages exacts) n'est pas accessible ici.",
    });
  }
  const codeSymbols = await loadFounderCodeSymbols(input.proof, input.question);
  const answer = await runParrainTurn(
    {
      question: input.question,
      viewer,
      history: input.history,
      attachments: [],
      conversationId: null,
      codeSymbols,
      model: input.model ?? "deterministic",
      maxOutputTokens: input.maxOutputTokens ?? 700,
      at: input.at,
    },
    { responder: input.responder ?? null, accountPort: null, delegationPort: null },
  );
  return Object.freeze({ authorized: true, answer, refusal: null });
}

/** Garde de non-réutilisation : un adaptateur interne ne doit jamais servir public/client. */
export function internalAdapterUsableBy(mode: string): boolean {
  return mode === "founder";
}

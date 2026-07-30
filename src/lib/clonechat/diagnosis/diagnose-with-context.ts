// src/lib/clonechat/diagnosis/diagnose-with-context.ts
//
// Branche le DIAGNOSTIC (BLOC 4) sur decideWithContext() (BLOC 3 + Brain BLOC 2) de façon COMPATIBLE
// avec la sortie structurée existante. Le diagnostic est ADDITIF : `structured` reste exactement
// { answer, honesty, tool_call, citations } — inchangé. On ne construit PAS encore le guide (BLOC 5)
// et on n'exécute AUCUNE action : on produit une lecture structurée de la situation, rien de plus.

import { decideWithContext, type ContextualInput, type ContextualDecision } from "@/lib/clonechat/context";
import type { CloneChatContext } from "@/lib/clonechat/context";
import { diagnoseCloneChat } from "./diagnose";
import type { CloneChatDiagnosis } from "./types";

export interface DiagnosedDecision extends ContextualDecision {
  readonly diagnosis: CloneChatDiagnosis;
}

/**
 * Décision du Brain enrichie par le contexte (BLOC 3) PUIS diagnostiquée (BLOC 4). La sortie
 * `structured` est celle du BLOC 3 (format existant préservé) ; `diagnosis` est le nouvel objet
 * structuré. Le diagnostic consomme la décision réelle du Brain (mode, refus de gouvernance) et
 * l'indisponibilité provider réellement observée — jamais une supposition.
 */
export function decideAndDiagnose(input: ContextualInput, ctx: CloneChatContext): DiagnosedDecision {
  const contextual = decideWithContext(input, ctx);
  const diagnosis = diagnoseCloneChat(ctx, {
    brainDecision: contextual.decision,
    modelUnavailable: input.modelUnavailable === true,
  });
  return { ...contextual, diagnosis };
}

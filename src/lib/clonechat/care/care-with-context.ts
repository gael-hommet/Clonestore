// src/lib/clonechat/care/care-with-context.ts
//
// Branche CloneCare (BLOC 7) sur decideDiagnoseAndGuide() (BLOC 2→5) de façon ADDITIVE. La sortie
// fournit : décision Brain, CloneContext, diagnostic, guide, résultat CloneCare, brouillon de ticket
// éventuel, et le `structured` historique INCHANGÉ. Aucun envoi externe, aucun comportement risqué.

import { decideDiagnoseAndGuide } from "@/lib/clonechat/guide";
import type { GuidedDecision } from "@/lib/clonechat/guide";
import type { ContextualInput, CloneChatContext } from "@/lib/clonechat/context";
import { assessCare } from "./care";
import type { CloneCareResult, SupportTicketDraft, CareInput } from "./types";

export interface CaredDecision extends GuidedDecision {
  readonly care: CloneCareResult;
  /** Brouillon de ticket éventuel (miroir de care.ticketDraft), null si non nécessaire. */
  readonly ticketDraft: SupportTicketDraft | null;
}

/**
 * Décision Brain → contexte → diagnostic → guide → CloneCare, en une passe. `structured` reste
 * exactement `{ answer, honesty, tool_call, citations }`. Le support est ADDITIF et ne modifie ni
 * la décision, ni le diagnostic, ni le guide.
 */
export function decideDiagnoseGuideAndCare(input: ContextualInput, ctx: CloneChatContext, care: CareInput = {}): CaredDecision {
  const guided = decideDiagnoseAndGuide(input, ctx);
  const careResult = assessCare(ctx, guided.diagnosis, guided.guide, care);
  return { ...guided, care: careResult, ticketDraft: careResult.ticketDraft };
}

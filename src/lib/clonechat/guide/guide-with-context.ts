// src/lib/clonechat/guide/guide-with-context.ts
//
// Branche CloneGuide (BLOC 5) sur decideAndDiagnose() (BLOC 2 + 3 + 4) de façon ADDITIVE et
// compatible avec le format existant. La sortie fournit : la décision Brain, le CloneContext, le
// diagnostic, le guide, et le `structured` historique INCHANGÉ. Aucune action n'est exécutée.

import { decideAndDiagnose, type DiagnosedDecision } from "@/lib/clonechat/diagnosis";
import type { ContextualInput } from "@/lib/clonechat/context";
import type { CloneChatContext } from "@/lib/clonechat/context";
import { buildCloneGuide } from "./build";
import type { CloneGuide } from "./types";

export interface GuidedDecision extends DiagnosedDecision {
  /** Guide structuré, ou null quand il n'y a rien à guider (question conversationnelle sans objet). */
  readonly guide: CloneGuide | null;
}

/**
 * Décision Brain → contexte → diagnostic → guide, en une passe. `structured` reste exactement
 * `{ answer, honesty, tool_call, citations }` (format existant préservé). Le guide consomme le
 * diagnostic réel et l'intention réelle du Brain — jamais une supposition, jamais une UI inventée.
 */
export function decideDiagnoseAndGuide(input: ContextualInput, ctx: CloneChatContext): GuidedDecision {
  const diagnosed = decideAndDiagnose(input, ctx);
  const guide = buildCloneGuide(ctx, diagnosed.diagnosis, { brainDecision: diagnosed.decision });
  return { ...diagnosed, guide };
}

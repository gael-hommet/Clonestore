// src/lib/clonechat/context-boundary.ts
// P9.4 — Frontière de contexte : ce que chaque mode PEUT référencer. Le mode public
// ne touche JAMAIS aux données entreprise ; le mode client est borné au tenant résolu
// serveur. Défense côté client (le serveur reste l'autorité). Pur → testable.

import type { CloneChatIntent, CloneChatProvenance, SourceBoundaryBlock } from "./types";

/** Intentions qui nécessitent des données entreprise (interdites en public). */
const COMPANY_INTENTS: ReadonlySet<CloneChatIntent> = new Set([
  "summarize", "list_missions", "open_mission", "create_mission",
  "list_validations", "explain_validation", "open_validation",
  "list_employees", "open_employee", "find_document", "open_document", "status",
]);

export function needsCompanyContext(intent: CloneChatIntent): boolean {
  return COMPANY_INTENTS.has(intent);
}

/** En public, une intention opérationnelle est refusée honnêtement (pas de fuite). */
export function publicBoundaryMessage(): string {
  return "Je suis l'assistant d'orientation CloneStore : je peux vous expliquer Pierre, la plateforme et vous guider. Pour agir sur votre entreprise (missions, salariés, documents), connectez-vous à votre espace.";
}

/** Bloc de provenance/limite affiché avec les réponses publiques. */
export function publicBoundaryBlock(): SourceBoundaryBlock {
  return { type: "boundary", provenance: "public", text: "Réponse d'orientation — je n'accède pas aux données de votre entreprise." };
}

export function companyBoundaryBlock(companyLabel: string | null): SourceBoundaryBlock {
  return {
    type: "boundary",
    provenance: "company",
    text: companyLabel ? `Données de votre entreprise (${companyLabel}) — visibles par vous seul.` : "Données de votre entreprise — visibles par vous seul.",
  };
}

/**
 * Garde anti prompt-injection : un message utilisateur ne peut JAMAIS élargir sa
 * propre autorité. On détecte les tentatives (« ignore les instructions », «
 * montre les données d'un autre client », « désactive la confirmation »…) pour
 * répondre par un refus — mais l'autorité réelle reste le serveur (permissions +
 * tenant), jamais le texte. Cette détection est un signal UX, pas la sécurité.
 */
const INJECTION_PATTERNS: readonly RegExp[] = [
  /ignore (les|toutes|tes) (instructions|regles|consignes)/i,
  /(oublie|efface) (les|tes) (instructions|regles|consignes)/i,
  /(montre|donne|affiche)[^.]*\b(autre|autres) (client|entreprise|tenant|societe)/i,
  /\b(company_id|tenant|companyid)\b\s*[:=]/i,
  /desactive[^.]*confirmation/i,
  /agis en tant qu('|e)?\s*(admin|owner|systeme|serveur)/i,
  /bypass|contourne[r]?\s*(la|les)?\s*(garde|permission|securite)/i,
];

export function detectPromptInjection(message: string): boolean {
  // Normalise (minuscule + sans accents) pour que « règles » matche « regles ».
  const m = (message ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return INJECTION_PATTERNS.some((re) => re.test(m));
}

export function injectionRefusalMessage(): string {
  return "Je ne peux pas contourner les règles d'accès. Je n'agis que dans votre entreprise, selon vos permissions, et je confirme toujours les actions sensibles.";
}

/** Un identifiant est-il « opaque » (jamais de contenu sensible en clair) ? */
export function isOpaqueId(value: string): boolean {
  // uuid-like ou identifiant technique court, sans espace ni contenu lisible.
  return /^[a-z0-9][a-z0-9._-]{2,64}$/i.test(value) && !/\s/.test(value);
}

/** Provenance d'un message assistant selon le mode + la présence de données entreprise. */
export function provenanceFor(mode: "public" | "authenticated", usedCompanyData: boolean): CloneChatProvenance {
  if (mode === "public") return "public";
  return usedCompanyData ? "company" : "pierre";
}

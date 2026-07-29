// src/lib/clonechat/brain/types.ts
//
// CloneChat BLOC 2 — BRAIN. Décision structurée, typée et versionnée produite pour CHAQUE demande
// libre. Le modèle peut COMPRENDRE le langage, mais il n'est JAMAIS l'autorité finale : routes,
// permissions, disponibilité, prix, pays, dates, actions, confirmation, état compte et promesses
// de succès restent contrôlés par du code DÉTERMINISTE (product-truth + route-registry + garde
// d'injection du BLOC 0). Module PUR (aucun I/O, aucun appel réseau, aucun Date.now au niveau
// module) → déterministe et testable sans provider.

/** Version du schéma de décision (bump si un champ change de sémantique). */
export const BRAIN_DECISION_VERSION = "brain-1" as const;

/** Les 8 modes exclusifs. */
export type BrainMode =
  | "answer" // question factuelle → réponse directe
  | "explain" // demande d'explication → explication
  | "orient" // « où … ? » → une route RÉELLE
  | "diagnose" // « pourquoi je ne peux pas … / je suis bloqué » → diagnostic
  | "guide" // « guide-moi pour … » → pas-à-pas
  | "act" // « fais X pour moi » → action demandée, JAMAIS exécutée ici
  | "escalate" // bug / situation non résoluble → humain
  | "clarify"; // demande ambiguë → une seule question utile

export type BrainConfidence = "high" | "medium" | "low";

/** Contexte compte minimal (fourni par la route ; le Brain ne le devine jamais). */
export interface BrainAccountContext {
  readonly authenticated: boolean;
  readonly hasCompany?: boolean;
  readonly hasPierreAccess?: boolean;
}

/** Une action DEMANDÉE (jamais exécutée par le Brain). `executed` est toujours false. */
export interface BrainRequestedAction {
  readonly kind: string; // ex. "reserve_pierre", "open_checkout", "refused"
  readonly targetRoute: string | null; // route RÉELLE validée, ou null
  readonly executed: false; // INVARIANT : le Brain n'exécute jamais
  readonly refusedReason: string | null; // ex. "governance_bypass", "injection", null
}

/** La décision structurée complète du Brain. */
export interface BrainDecision {
  readonly version: typeof BRAIN_DECISION_VERSION;
  readonly mode: BrainMode;
  readonly intent: string;
  readonly answer: string;
  readonly confidence: BrainConfidence;
  readonly needsClarification: boolean;
  readonly clarificationQuestion: string | null;
  /** Ids de vérités produit (Product Truth Engine) qui fondent la réponse. */
  readonly truthIds: readonly string[];
  /** Route RÉELLE (registre) suggérée, ou null. Jamais une route inventée. */
  readonly suggestedRoute: string | null;
  readonly requestedAction: BrainRequestedAction | null;
  readonly requiresAccountContext: boolean;
  readonly requiresConfirmation: boolean;
  readonly requiresEscalation: boolean;
  readonly limitations: readonly string[];
  readonly evidence: readonly string[];
}

export interface BrainInput {
  readonly message: string;
  readonly account?: BrainAccountContext;
  /**
   * Décision proposée par le modèle (chaîne JSON ou objet). PURE SUGGESTION : elle est validée puis
   * fusionnée de façon SÛRE — jamais autorité sur route/prix/pays/date/action/permission. Une valeur
   * absente, incomplète ou invalide n'altère jamais la décision déterministe (aucun faux succès).
   */
  readonly modelDecision?: unknown;
  /**
   * Le modèle est-il indisponible ? (échec provider / budget). N'empêche JAMAIS une décision
   * déterministe valide — le Brain ne renvoie jamais un faux « indisponible » pour ce qu'il sait faire.
   */
  readonly modelUnavailable?: boolean;
}

/** Champs que le modèle a le DROIT d'influencer (prose uniquement — jamais l'autorité). */
export const MODEL_INFLUENCEABLE_FIELDS = ["answer", "clarificationQuestion", "intent"] as const;

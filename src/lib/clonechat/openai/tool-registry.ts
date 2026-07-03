// src/lib/clonechat/openai/tool-registry.ts
// P9.4 — ALLOWLIST stricte des outils que le modèle peut PROPOSER. Le modèle
// n'exécute jamais d'effet : il propose un outil, le serveur gouverne (auth/tenant/
// permission/risque/confirmation) puis exécute via le contrat réel. Un outil hors
// allowlist ou mal formé n'est JAMAIS exécuté.

import type { CloneChatActionKind } from "../types";

export type CloneChatToolName =
  | "retrieve_knowledge"
  | "company_summary"
  | "list_missions"
  | "open_mission"
  | "prepare_mission"
  | "create_mission"
  | "cancel_mission"
  | "list_validations"
  | "open_validation"
  | "decide_validation"
  | "list_employees"
  | "open_employee"
  | "find_document"
  | "open_document"
  | "find_known_issue"
  | "report_issue"
  | "retrieve_bug"
  | "create_support_case"
  | "navigate";

/** Réalité du branchement backend d'un outil (honnêteté §9 : jamais proposer un
 *  outil sans backend comme exécutable). */
export type ToolAvailability =
  | "wired"       // effet réel via un contrat V1/durable
  | "advisory"    // lecture / surface de données réelles (pas d'effet)
  | "unavailable"; // pas de backend réel → ne doit JAMAIS être proposé comme exécutable

export interface ToolSpec {
  readonly name: CloneChatToolName;
  /** Requiert un mode client authentifié (sinon refus). */
  readonly authenticated: boolean;
  /** Produit un effet gouverné (mappé vers une action) plutôt qu'une simple lecture. */
  readonly effect: boolean;
  /** Action gouvernée associée (pour la politique risque/confirmation). */
  readonly actionKind: CloneChatActionKind | null;
  /** Clés d'arguments attendues (validation défensive). */
  readonly args: readonly string[];
  /** Réalité du branchement backend (jamais proposer un `unavailable` comme exécutable). */
  readonly availability: ToolAvailability;
}

export const TOOL_REGISTRY: Readonly<Record<CloneChatToolName, ToolSpec>> = {
  retrieve_knowledge: { name: "retrieve_knowledge", authenticated: false, effect: false, actionKind: null, args: ["query"], availability: "advisory" },
  company_summary: { name: "company_summary", authenticated: true, effect: false, actionKind: null, args: [], availability: "advisory" },
  list_missions: { name: "list_missions", authenticated: true, effect: false, actionKind: null, args: [], availability: "advisory" },
  open_mission: { name: "open_mission", authenticated: true, effect: false, actionKind: "open_mission", args: ["mission_id"], availability: "advisory" },
  prepare_mission: { name: "prepare_mission", authenticated: true, effect: false, actionKind: "create_mission", args: ["instruction"], availability: "wired" },
  create_mission: { name: "create_mission", authenticated: true, effect: true, actionKind: "create_mission", args: ["instruction"], availability: "wired" },
  cancel_mission: { name: "cancel_mission", authenticated: true, effect: true, actionKind: "cancel_mission", args: ["mission_id"], availability: "wired" },
  list_validations: { name: "list_validations", authenticated: true, effect: false, actionKind: null, args: [], availability: "advisory" },
  open_validation: { name: "open_validation", authenticated: true, effect: false, actionKind: "open_validation", args: ["validation_id"], availability: "advisory" },
  decide_validation: { name: "decide_validation", authenticated: true, effect: true, actionKind: "decide_validation", args: ["validation_id", "decision"], availability: "wired" },
  list_employees: { name: "list_employees", authenticated: true, effect: false, actionKind: null, args: [], availability: "advisory" },
  open_employee: { name: "open_employee", authenticated: true, effect: false, actionKind: "open_employee", args: ["employee_id"], availability: "advisory" },
  find_document: { name: "find_document", authenticated: true, effect: false, actionKind: null, args: ["query"], availability: "advisory" },
  open_document: { name: "open_document", authenticated: true, effect: false, actionKind: "open_document", args: ["document_id"], availability: "advisory" },
  find_known_issue: { name: "find_known_issue", authenticated: false, effect: false, actionKind: null, args: ["symptom"], availability: "advisory" },
  // report_issue = advisory : le signalement est consigné SERVEUR (mémoire de support
  // durable) sur détection de problème ; le modèle peut ESCALADER vers create_support_case
  // (le vrai outil effectful). report_issue lui-même n'exécute pas d'effet direct.
  report_issue: { name: "report_issue", authenticated: true, effect: false, actionKind: null, args: ["symptom"], availability: "advisory" },
  retrieve_bug: { name: "retrieve_bug", authenticated: false, effect: false, actionKind: null, args: ["symptom"], availability: "advisory" },
  create_support_case: { name: "create_support_case", authenticated: true, effect: true, actionKind: "create_support_case", args: ["summary"], availability: "wired" },
  navigate: { name: "navigate", authenticated: false, effect: false, actionKind: "navigate", args: ["route"], availability: "advisory" },
};

/** Un outil est-il réellement exécutable (branché) ? Sinon ne jamais le proposer comme action. */
export function isToolAvailable(name: string): boolean {
  return isKnownTool(name) && TOOL_REGISTRY[name].availability !== "unavailable";
}

export const ALL_TOOL_NAMES: readonly CloneChatToolName[] = Object.keys(TOOL_REGISTRY) as CloneChatToolName[];

export function isKnownTool(name: string): name is CloneChatToolName {
  return name in TOOL_REGISTRY;
}

/** Un outil est-il utilisable dans ce mode ? (authentifié requis pour l'opérationnel). */
export function isToolAllowedInMode(name: string, mode: "public" | "authenticated"): boolean {
  if (!isKnownTool(name)) return false;
  const spec = TOOL_REGISTRY[name];
  if (spec.authenticated && mode !== "authenticated") return false;
  return true;
}

/** Validation défensive des arguments : toutes les clés requises présentes + non vides. */
export function validateToolArgs(name: CloneChatToolName, args: unknown): { ok: boolean; missing: string[] } {
  const spec = TOOL_REGISTRY[name];
  const obj = (args && typeof args === "object" && !Array.isArray(args)) ? (args as Record<string, unknown>) : {};
  const missing = spec.args.filter((k) => {
    const v = obj[k];
    return v === undefined || v === null || (typeof v === "string" && v.trim() === "");
  });
  return { ok: missing.length === 0, missing };
}

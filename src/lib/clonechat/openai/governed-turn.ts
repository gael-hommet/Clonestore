// src/lib/clonechat/openai/governed-turn.ts
// P9.4 — Tour GOUVERNÉ : OpenAI PROPOSE, le système GOUVERNE, l'humain CONFIRME le
// sensible, le contrat réel exécute. Pipeline : budget → OpenAI (structuré) → usage →
// validation d'outil (allowlist/mode/args) → politique risque/permission → blocs +
// action proposée. Repli DÉTERMINISTE si flag off / budget épuisé / panne / sortie
// invalide. Le modèle n'exécute JAMAIS d'effet directement.

import { proposeAction } from "../action-policy";
import { detectPromptInjection, injectionRefusalMessage, provenanceFor, companyBoundaryBlock, publicBoundaryBlock } from "../context-boundary";
import { runCloneChatTurn, type CloneChatContext, type CloneChatTurnResult } from "../engine";
import type { CloneChatContentBlock, CloneChatProposedAction } from "../types";
import type { CloneChatOpenAIConfig } from "./config";
import { checkBudget, budgetFallbackMessage } from "./budget-gate";
import type { OpenAIResponder } from "./client";
import type { UsageStore } from "./usage-accounting";
import { buildUsageRecord } from "./usage-accounting";
import { TOOL_REGISTRY, isKnownTool, isToolAllowedInMode, isToolAvailable, validateToolArgs, type CloneChatToolName } from "./tool-registry";
import type { CloneChatStructuredOutput } from "./structured-output";

const COCKPIT = "/agents/pierre/use";
function text(t: string): CloneChatContentBlock { return { type: "text", text: t }; }

/** Complète les arguments d'outil quand le modèle omet l'évident (l'instruction de
 *  mission = le message de l'utilisateur). N'invente jamais d'identifiant opaque. */
function backfillArgs(name: CloneChatToolName, args: Record<string, unknown> | undefined, userMessage: string): Record<string, unknown> {
  const a: Record<string, unknown> = { ...(args ?? {}) };
  if ((name === "prepare_mission" || name === "create_mission")) {
    const instr = typeof a.instruction === "string" ? a.instruction.trim() : "";
    if (!instr && userMessage.trim()) a.instruction = userMessage.trim();
  }
  return a;
}

export type TurnSource = "openai" | "deterministic_fallback" | "budget_fallback" | "disabled_fallback";

export interface GovernedTurnDeps {
  readonly responder: OpenAIResponder;
  readonly config: CloneChatOpenAIConfig;
  readonly usageStore: UsageStore;
  readonly openaiEnabled: boolean;   // flag CloneChat on ET clé présente
  readonly nowIso: string;           // horodatage injecté (pas de Date.now impur)
  readonly estimateInputTokens?: (s: string) => number;
}

export interface GovernedTurnResult {
  readonly blocks: readonly CloneChatContentBlock[];
  readonly action: CloneChatProposedAction | null;
  readonly source: TurnSource;
  readonly usageTokens: number;
}

function estimate(s: string): number { return Math.ceil((s ?? "").length / 4) + 400; /* + overhead système/connaissance */ }

/** Mappe une proposition d'outil du modèle → blocs de données réelles + action gouvernée. */
function applyTool(
  name: CloneChatToolName,
  args: Record<string, unknown>,
  ctx: CloneChatContext,
  userMessage = "",
): { blocks: CloneChatContentBlock[]; action: CloneChatProposedAction | null } {
  const blocks: CloneChatContentBlock[] = [];
  const perms = ctx.permissions;
  switch (name) {
    case "company_summary": {
      const ov = ctx.overview;
      if (ov && !ov.isEmpty) { for (const m of ov.inProgress.slice(0, 3)) blocks.push({ type: "mission", mission: m }); }
      return { blocks, action: proposeAction({ kind: "navigate", label: "Ouvrir le cockpit", mode: "authenticated", permissions: perms, href: COCKPIT }) };
    }
    case "list_missions":
      for (const m of ctx.missions.slice(0, 5)) blocks.push({ type: "mission", mission: m });
      return { blocks, action: proposeAction({ kind: "navigate", label: "Ouvrir les missions", mode: "authenticated", permissions: perms, href: `${COCKPIT}?view=missions` }) };
    case "list_validations":
      for (const v of ctx.validations.filter((x) => x.status === "pending").slice(0, 4)) blocks.push({ type: "validation", validation: v });
      return { blocks, action: proposeAction({ kind: "navigate", label: "Décider dans le cockpit", mode: "authenticated", permissions: perms, href: `${COCKPIT}?view=validations` }) };
    case "list_employees":
      for (const e of ctx.employees.slice(0, 5)) blocks.push({ type: "employee", employee: e });
      return { blocks, action: null };
    case "find_document": {
      const q = String(args.query ?? "").toLowerCase();
      const matches = ctx.artifacts.filter((a) => !q || a.title.toLowerCase().includes(q)).slice(0, 4);
      for (const d of matches) blocks.push({ type: "document", document: d });
      return { blocks, action: null };
    }
    case "open_employee": {
      const id = String(args.employee_id ?? "");
      const emp = ctx.employees.find((e) => e.id === id || e.name.toLowerCase().includes(id.toLowerCase()));
      if (emp) { blocks.push({ type: "employee", employee: emp }); return { blocks, action: proposeAction({ kind: "open_employee", label: "Ouvrir le dossier", mode: "authenticated", permissions: perms, href: emp.href, idSeed: emp.id }) }; }
      return { blocks, action: null };
    }
    case "prepare_mission":
    case "create_mission": {
      const instruction = String(args.instruction ?? "").trim();
      const action = proposeAction({ kind: "create_mission", label: "Confier cette mission à Pierre", mode: "authenticated", permissions: perms, payload: { instruction }, idSeed: "create" });
      blocks.push({ type: "action_preview", action });
      return { blocks, action };
    }
    case "open_mission": {
      const id = String(args.mission_id ?? "");
      return { blocks, action: proposeAction({ kind: "open_mission", label: "Ouvrir la mission", mode: "authenticated", permissions: perms, href: `${COCKPIT}?view=missions&mission=${encodeURIComponent(id)}`, idSeed: id }) };
    }
    case "decide_validation": {
      // Décision RÉELLE (approuver / rejeter / demander des changements). GAP-1 : le
      // contrat V1 ne porte PAS de motif — on ne fabrique donc aucun champ motif.
      const vid = String(args.validation_id ?? "");
      const decision = String(args.decision ?? "").toLowerCase();
      const v = ctx.validations.find((x) => x.id === vid) ?? ctx.validations.find((x) => x.status === "pending");
      if (!v || v.version == null) { blocks.push(text("Je ne retrouve pas la validation à décider. Ouvrez le cockpit pour la traiter.")); return { blocks, action: proposeAction({ kind: "navigate", label: "Ouvrir les validations", mode: "authenticated", permissions: perms, href: `${COCKPIT}?view=validations` }) }; }
      const norm = decision.includes("rejet") || decision.includes("reject") ? "reject" : decision.includes("chang") ? "request_changes" : "approve";
      blocks.push({ type: "validation", validation: v });
      const action = proposeAction({ kind: "decide_validation", label: norm === "reject" ? "Rejeter cette validation" : norm === "request_changes" ? "Demander des changements" : "Approuver cette validation", mode: "authenticated", permissions: perms, payload: { validationId: v.id, decision: norm, version: v.version }, idSeed: `decide-${v.id}` });
      blocks.push({ type: "action_preview", action });
      return { blocks, action };
    }
    case "cancel_mission": {
      const mid = String(args.mission_id ?? "");
      const m = ctx.missions.find((x) => x.id === mid) ?? ctx.missions.find((x) => x.status !== "done" && x.status !== "cancelled");
      if (!m) { blocks.push(text("Je ne retrouve pas la mission à annuler.")); return { blocks, action: null }; }
      const action = proposeAction({ kind: "cancel_mission", label: `Annuler la mission « ${m.title} »`, mode: "authenticated", permissions: perms, payload: { missionId: m.id }, idSeed: `cancel-${m.id}` });
      blocks.push({ type: "action_preview", action });
      return { blocks, action };
    }
    case "create_support_case": {
      const summary = String(args.summary ?? "").trim() || userMessage.trim();
      const action = proposeAction({ kind: "create_support_case", label: "Ouvrir un cas de support", mode: "authenticated", permissions: perms, payload: { summary }, idSeed: "support" });
      blocks.push({ type: "action_preview", action });
      return { blocks, action };
    }
    case "find_known_issue":
    case "retrieve_bug":
      blocks.push(text("Je vérifie les problèmes connus et vous propose un contournement vérifié s'il en existe un."));
      return { blocks, action: null };
    case "report_issue":
      blocks.push(text("J'ai bien noté votre signalement. Si besoin, je peux ouvrir un cas de support."));
      return { blocks, action: proposeAction({ kind: "create_support_case", label: "Ouvrir un cas de support", mode: "authenticated", permissions: perms, payload: { summary: userMessage.trim() }, idSeed: "support" }) };
    case "navigate": {
      const route = String(args.route ?? "/");
      return { blocks, action: proposeAction({ kind: "navigate", label: "Ouvrir", mode: ctx.mode, permissions: perms, href: route.startsWith("/") ? route : "/" }) };
    }
    default:
      return { blocks, action: null };
  }
}

/** Tour gouverné complet. */
export async function runGovernedTurn(
  message: string,
  ctx: CloneChatContext,
  deps: GovernedTurnDeps,
): Promise<GovernedTurnResult> {
  const raw = (message ?? "").trim();
  const deterministic = (source: TurnSource, r: CloneChatTurnResult): GovernedTurnResult =>
    ({ blocks: r.blocks, action: r.action, source, usageTokens: 0 });

  // 1) Sécurité : prompt-injection → refus déterministe (jamais d'appel modèle inutile).
  if (detectPromptInjection(raw)) {
    return { blocks: [text(injectionRefusalMessage()), ctx.mode === "public" ? publicBoundaryBlock() : companyBoundaryBlock(ctx.companyLabel)], action: null, source: "deterministic_fallback", usageTokens: 0 };
  }

  // 2) OpenAI désactivé (flag off / pas de clé) → moteur déterministe honnête.
  if (!deps.openaiEnabled || !deps.config.enabled) {
    return deterministic("disabled_fallback", runCloneChatTurn(raw, ctx));
  }

  // 3) Budget dur AVANT tout appel.
  const est = (deps.estimateInputTokens ?? estimate)(raw);
  const snap = await deps.usageStore.snapshot({ userId: null, companyId: ctx.companyLabel });
  const budget = checkBudget(deps.config, snap, est);
  if (!budget.allowed) {
    const fb = runCloneChatTurn(raw, ctx);
    return { blocks: [text(budgetFallbackMessage(budget.reason!)), ...fb.blocks], action: fb.action, source: "budget_fallback", usageTokens: 0 };
  }

  // 4) Appel OpenAI (structuré). Panne / sortie invalide → repli déterministe.
  const result = await deps.responder.respond({
    model: deps.config.model,
    system: "Tu es CloneChat, l'assistant CloneStore. Réponds en français, sans jargon technique. Propose un outil de l'allowlist quand pertinent. N'invente jamais de donnée ; dis « je ne sais pas » si tu n'es pas sûr. Ne prétends jamais avoir exécuté une action.",
    userText: raw,
    maxOutputTokens: budget.maxOutputTokens,
  });

  if (result.usage.inputTokens + result.usage.outputTokens > 0) {
    await deps.usageStore.record(buildUsageRecord({ usage: result.usage, userId: null, companyId: ctx.companyLabel, at: deps.nowIso }));
  }

  if (!result.ok || !result.structured) {
    return deterministic("deterministic_fallback", runCloneChatTurn(raw, ctx));
  }

  return assembleFromStructured(result.structured, ctx, result.usage.inputTokens + result.usage.outputTokens, raw);
}

/** Assemble les blocs à partir de la sortie structurée + gouvernance d'outil. */
export function assembleFromStructured(
  out: CloneChatStructuredOutput,
  ctx: CloneChatContext,
  usageTokens: number,
  userMessage = "",
): GovernedTurnResult {
  const blocks: CloneChatContentBlock[] = [text(out.answer)];
  let action: CloneChatProposedAction | null = null;

  const tc = out.tool_call;
  if (tc && isKnownTool(tc.name)) {
    // Backfill : pour préparer/créer une mission, l'INSTRUCTION est le message de
    // l'utilisateur. Si le modèle omet l'argument, on le complète à partir du message
    // (l'humain confirmera de toute façon avant toute exécution).
    const args = backfillArgs(tc.name, tc.arguments as Record<string, unknown>, userMessage);
    // Gouvernance : outil autorisé dans ce mode ? réellement branché ? args valides ?
    if (!isToolAllowedInMode(tc.name, ctx.mode)) {
      blocks.push(text("Cette action nécessite votre espace connecté. En mode public, je vous oriente uniquement."));
    } else if (!isToolAvailable(tc.name)) {
      // Honnêteté (§9/§14) : un outil sans backend réel n'est JAMAIS proposé exécutable.
      blocks.push(text("Cette action n'est pas encore disponible. Je peux vous orienter vers la bonne surface."));
    } else {
      const spec = TOOL_REGISTRY[tc.name];
      const argsOk = validateToolArgs(tc.name, args);
      if (!argsOk.ok) {
        // Sortie d'outil incomplète → aucune exécution ; on demande une précision.
        blocks.push(text("Il me manque une précision pour agir. Pouvez-vous reformuler ?"));
      } else {
        const applied = applyTool(tc.name, args, ctx, userMessage);
        blocks.push(...applied.blocks);
        action = applied.action;
        // Un outil à effet est toujours proposé, jamais exécuté ici (confirmation en aval).
        void spec;
      }
    }
  }

  blocks.push(ctx.mode === "public" ? publicBoundaryBlock() : companyBoundaryBlock(ctx.companyLabel));
  return { blocks, action, source: "openai", usageTokens };
}

export function modelPolicySummary(cfg: CloneChatOpenAIConfig): { model: string; escalation: boolean } {
  return { model: cfg.model, escalation: cfg.escalationEnabled && !!cfg.escalationModel };
}

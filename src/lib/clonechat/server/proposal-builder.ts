// src/lib/clonechat/server/proposal-builder.ts
// P9.4.2 r2 (§2/§3) — Construction SERVEUR de la proposition d'action effective. Quand le
// modèle propose un outil à effet, le SERVEUR dérive le payload CANONIQUE validé (jamais de
// confiance client), PERSISTE la proposition (scopée entreprise+acteur) et ne renvoie au
// client qu'une RÉFÉRENCE (proposalId) + de quoi afficher le bouton « Confirmer ». Pour les
// actions ciblées (annuler mission / décider validation), la cible est résolue contre l'état
// V1 RÉEL au moment de la proposition → l'identité SHA-256 de la commande reste stable.
// Server-only.

import type { ProposalStore } from "../durable/proposal-store";
import type { CloneChatActionKind } from "../types";
import { buildV1Ctx, resolveCancellableMissionV1, resolvePendingValidationV1, readCompanyAutonomyV1 } from "./v1-loopback";
import { productModeForEngine } from "@/lib/clonestore/pierre-autonomy/model";

export interface EffectfulProposal {
  readonly id: string;
  readonly kind: CloneChatActionKind;
  readonly label: string;
  readonly requiresConfirmation: true;
  /** P9.5 — pour une création de mission : mode d'autonomie (produit) sous lequel Pierre opérera,
   *  RÉSOLU côté serveur depuis le défaut d'entreprise (jamais du client). Affiché dans l'UI. */
  readonly autonomy?: { readonly productModeId: string; readonly label: string; readonly tagline: string; readonly engineMode: string };
}

interface ToolCall { name: string; arguments: Record<string, unknown>; }

const TOOL_TO_KIND: Partial<Record<string, CloneChatActionKind>> = {
  create_mission: "create_mission", prepare_mission: "create_mission",
  create_support_case: "create_support_case", report_issue: "create_support_case",
  cancel_mission: "cancel_mission", decide_validation: "decide_validation",
};

// P16D §3.A/C — décision de validation RH : jamais de défaut UNSAFE. Auparavant toute chaîne
// non reconnue — y compris la chaîne VIDE quand le modèle omettait l'argument, ou un « attends »,
// « non », « ne valide pas » (sans « rejet »/« chang ») — retombait sur "approve". Approuver est
// précisément la décision qui LÈVE le blocage humain d'une tâche gouvernée : la défaillir vers
// l'approbation viole le plancher « décision réservée à l'humain ». On ne reconnaît QUE des
// intentions EXPLICITES ; toute ambiguïté renvoie `null` ⇒ aucune proposition n'est construite,
// Pierre redemande laquelle des trois décisions l'humain veut prendre.
function normalizeDecision(raw: string): "approve" | "reject" | "request_changes" | null {
  const d = raw.trim().toLowerCase();
  if (!d) return null;
  if (d.includes("rejet") || d.includes("reject") || d.includes("refus")) return "reject";
  if (d.includes("chang") || d.includes("modif")) return "request_changes";
  // Une NÉGATION interdit toute approbation : « ne valide pas », « n'approuve pas », « non »
  // contiennent pourtant le radical « valide »/« approuve ». Sans ce garde, une consigne de
  // REFUS aurait été lue comme une APPROBATION — l'exact inverse de l'intention humaine.
  const negated = /\b(ne|n'|pas|non|jamais|sans|aucun)\b/.test(d);
  if (!negated && (d.includes("approuv") || d.includes("approve") || d.includes("valide") || d.includes("accept") || d.includes("ok"))) return "approve";
  return null; // intention non explicite (ou niée) ⇒ jamais d'approbation par défaut
}

/**
 * Dérive + persiste la proposition effective côté serveur. Renvoie la référence (proposalId)
 * + libellé, ou null si l'outil n'est pas à effet / le payload n'est pas dérivable / la cible
 * réelle est introuvable (⇒ pas de bouton exécutable ; on n'invente jamais de cible).
 */
export async function buildAndPersistProposal(args: {
  toolCall: ToolCall | null | undefined;
  userMessage: string;
  identity: { companyId: string; userId: string };
  conversationId: string | null;
  proposals: ProposalStore;
  req: Request;
  at: string;
}): Promise<EffectfulProposal | null> {
  const tc = args.toolCall;
  if (!tc) return null;
  const kind = TOOL_TO_KIND[tc.name];
  if (!kind) return null;
  const a = tc.arguments ?? {};

  let payload: Record<string, unknown> | null = null;
  let label = "";
  let autonomy: EffectfulProposal["autonomy"];

  if (kind === "create_mission") {
    const instruction = String(a.instruction ?? "").trim() || args.userMessage.trim();
    if (!instruction) return null;
    // P9.5 — RÉSOUT le mode d'autonomie de l'entreprise CÔTÉ SERVEUR (colonne P8 default_autonomy_mode)
    // et le fige dans le payload : la mission sera gouvernée par ce mode moteur (decideValidation).
    // Le client ne fournit JAMAIS ce mode (pas d'escalade forgée). Best-effort → défaut moteur 'normal'.
    const v1 = buildV1Ctx(args.req, args.identity.companyId);
    let engineMode = "normal";
    try { const c = await readCompanyAutonomyV1(v1); if (c) engineMode = c.engineMode; } catch { /* défaut normal */ }
    const pm = productModeForEngine(engineMode);
    payload = { instruction, autonomyMode: engineMode };
    autonomy = { productModeId: pm.id, label: pm.label, tagline: pm.tagline, engineMode };
    label = "Confier cette mission à Pierre";
  } else if (kind === "create_support_case") {
    const summary = String(a.summary ?? "").trim() || args.userMessage.trim();
    if (!summary) return null;
    payload = { summary };
    label = "Ouvrir un cas de support";
  } else if (kind === "cancel_mission") {
    const v1 = buildV1Ctx(args.req, args.identity.companyId);
    const m = await resolveCancellableMissionV1(v1, String(a.mission_id ?? ""));
    if (!m) return null;                         // aucune mission annulable réelle → pas d'action
    payload = { missionId: m.id };
    label = `Annuler la mission « ${m.title} »`;
  } else if (kind === "decide_validation") {
    const v1 = buildV1Ctx(args.req, args.identity.companyId);
    const v = await resolvePendingValidationV1(v1, String(a.validation_id ?? ""));
    if (!v) return null;                         // aucune validation en attente réelle
    const decision = normalizeDecision(String(a.decision ?? ""));
    if (!decision) return null;                  // décision ambiguë ⇒ aucune proposition (on redemande)
    payload = { validationId: v.id, missionId: v.missionId, decision, version: v.version };
    label = decision === "reject" ? "Rejeter cette validation" : decision === "request_changes" ? "Demander des changements" : "Approuver cette validation";
  }

  if (!payload) return null;
  const { id } = await args.proposals.create(args.identity, { conversationId: args.conversationId, actionKind: kind, payload, at: args.at });
  return { id, kind, label, requiresConfirmation: true, ...(autonomy ? { autonomy } : {}) };
}

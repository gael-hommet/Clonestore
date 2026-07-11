// src/app/api/assistant/execute/route.ts
// P9.4.2 r2 (§3) — Exécution AUTHORITATIVE CÔTÉ SERVEUR d'une action effective.
// Flux : le client CONFIRME une PROPOSITION persistée (proposalId uniquement) →
//   le serveur AUTHENTIFIE + résout la VRAIE entreprise (fail-closed) →
//   CHARGE la proposition (scopée entreprise+acteur) →
//   reconstruit l'action CANONIQUE + calcule l'identité SHA-256 →
//   CLAIM atomique de la commande durable (lease) →
//   EXÉCUTE l'effet gouverné (API V1 loopback / support durable) →
//   RE-LIT la cible réelle → COMMIT la référence de résultat →
//   renvoie le résultat, OU le résultat existant (doublon), OU « en cours » (in-flight).
// Le client ne fournit JAMAIS le payload canonique ni un fingerprint. no-store.

import { requireCloneChatUser, ccNoStore } from "@/lib/clonechat/server/auth";
import { getCloneChatStores } from "@/lib/clonechat/server/runtime";
import { commandFingerprint, type CanonicalCommand } from "@/lib/clonechat/durable/command-ledger";
import { runGovernedCommand, type EffectResult } from "@/lib/clonechat/server/command-executor";
import { buildV1Ctx, createMissionV1, cancelMissionV1, decideValidationV1 } from "@/lib/clonechat/server/v1-loopback";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LEASE_MS = 30_000;
const DUP: Record<string, string> = {
  create_mission: "Cette mission a déjà été confiée à Pierre.",
  decide_validation: "Cette validation a déjà été traitée.",
  cancel_mission: "Cette mission a déjà été annulée.",
  create_support_case: "Un cas de support a déjà été ouvert.",
};

function hrefFor(kind: string, targetRef: string | null): string {
  switch (kind) {
    case "create_mission":
    case "cancel_mission":
      return targetRef ? `/agents/pierre/use?view=missions&mission=${encodeURIComponent(targetRef)}` : "/agents/pierre/use";
    case "decide_validation": return "/agents/pierre/use?view=validations";
    case "create_support_case": return "/profile/messages";
    default: return "/agents/pierre/use";
  }
}
function successMessage(kind: string): string {
  switch (kind) {
    case "create_mission": return "C'est fait — Pierre a reçu votre mission.";
    case "cancel_mission": return "Mission annulée.";
    case "decide_validation": return "Décision enregistrée.";
    case "create_support_case": return "Cas de support ouvert. Notre équipe pourra le suivre.";
    default: return "Action effectuée.";
  }
}

export async function POST(req: Request) {
  const auth = await requireCloneChatUser(req);
  if ("error" in auth) return auth.error;
  const { userId, companyId } = auth.identity;

  const body = (await req.json().catch(() => null)) as { proposalId?: string } | null;
  const proposalId = String(body?.proposalId ?? "").trim();
  if (!proposalId) return ccNoStore({ ok: false, code: "BAD_REQUEST" }, 400);

  const stores = await getCloneChatStores();

  // Charge la proposition PERSISTÉE (scopée entreprise+acteur). Une référence étrangère /
  // inexistante ne révèle RIEN (même réponse « introuvable »), aucune fuite d'existence.
  const proposal = await stores.proposals.load(proposalId, { companyId, userId });
  if (!proposal) return ccNoStore({ ok: false, code: "PROPOSAL_NOT_FOUND", message: "Cette proposition n'est plus disponible. Reformulez votre demande." }, 404);

  // Identité canonique de la commande = SHA-256(entreprise, acteur, conversation, proposition,
  // kind, payload canonique persisté). Reconstruite CÔTÉ SERVEUR à partir de la proposition.
  const cmd: CanonicalCommand = {
    companyId, actorId: userId, conversationId: proposal.conversationId,
    proposalId: proposal.id, actionKind: proposal.actionKind, payload: proposal.payload,
  };
  const fingerprint = commandFingerprint(cmd);
  const v1 = buildV1Ctx(req, companyId);
  const p = proposal.payload as Record<string, unknown>;

  // L'effet gouverné réel (idempotent, ré-exécutable en reprise). RE-LIT la cible avant succès.
  const effect = async (): Promise<EffectResult> => {
    switch (proposal.actionKind) {
      case "create_mission":
        // P9.5 — autonomyMode figé dans la proposition (résolu serveur depuis le défaut d'entreprise).
        // Passé à V1 qui gouverne la mission via decideValidation. Le client ne l'a jamais fourni.
        return createMissionV1(v1, String(p.instruction ?? ""), fingerprint, typeof p.autonomyMode === "string" ? p.autonomyMode : undefined);
      case "cancel_mission":
        return cancelMissionV1(v1, String(p.missionId ?? ""));
      case "decide_validation":
        return decideValidationV1(v1, (p.missionId as string) ?? null, String(p.validationId ?? ""), p.decision as "approve" | "reject" | "request_changes", Number(p.version ?? 1));
      case "create_support_case": {
        const summary = String(p.summary ?? "").trim();
        if (!summary) return { ok: false, terminal: true, error: "empty_summary" };
        // fingerprint = identité de la commande → création IDEMPOTENTE (reprise après commit
        // perdu ne crée pas de doublon ; l'effet support est le seul non couvert par V1).
        const c = await stores.support.createSupportCase({ companyId, userId }, { title: summary.slice(0, 120), summary, fingerprint, at: new Date().toISOString() });
        return { ok: true, targetRef: c.id, result: { caseId: c.id } };
      }
      default:
        return { ok: false, terminal: true, error: `unsupported_kind:${proposal.actionKind}` };
    }
  };

  const leaseOwner = `srv-${process.pid}-${randomUUID().slice(0, 8)}`;
  const out = await runGovernedCommand(stores.commands, cmd, effect, { leaseOwner, leaseMs: LEASE_MS });

  const kind = proposal.actionKind;
  switch (out.status) {
    case "succeeded":
      return ccNoStore({ ok: true, status: "executed", durable: stores.durable, kind, targetRef: out.targetRef, href: hrefFor(kind, out.targetRef), message: successMessage(kind), recovered: out.recovered });
    case "duplicate":
      return ccNoStore({ ok: true, status: "duplicate", durable: stores.durable, kind, targetRef: out.targetRef, href: hrefFor(kind, out.targetRef), message: DUP[kind] ?? "Action déjà effectuée." });
    case "in_flight":
      return ccNoStore({ ok: true, status: "in_flight", durable: stores.durable, kind, message: "Votre action est en cours de traitement. Un instant…" }, 202);
    case "failed":
    default:
      return ccNoStore({ ok: false, status: out.terminal ? "failed" : "retry", durable: stores.durable, kind, terminal: out.terminal, message: out.terminal ? "Cette action n'a pas pu aboutir (droits, version ou état). Ouvrez le cockpit pour la traiter." : "L'action n'a pas abouti. Réessayez." }, out.terminal ? 200 : 503);
  }
}

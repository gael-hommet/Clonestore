// src/lib/clonechat/intelligence/c1-1/parrain-authenticated-adapter.ts
// C1.1 — Adaptateur AUTHENTIFIÉ : construit les ports RÉELS pour le route handler
// /api/assistant/chat. Le port compte lit la V1 par LOOPBACK (le pattern P9.4.2
// sanctionné : identité réelle transmise + entreprise épinglée re-vérifiée par V1) ;
// le port délégation réutilise buildAndPersistProposal (pipeline propose→confirme→
// exécute EXISTANT — idempotence, permissions et planchers préservés).

import { buildV1Ctx, type V1Ctx } from "../../server/v1-loopback";
import { buildAndPersistProposal } from "../../server/proposal-builder";
import type { getCloneChatStores } from "../../server/runtime";
import type { ParrainAccountPort, AccountMissionLite, AccountValidationLite, AccountEmployeeLite, AccountArtifactLite } from "./parrain-account-context";
import type { PierreDelegationPort } from "./parrain-pierre-delegation";
import type { ParrainViewerContext } from "./parrain-types";

type Stores = Awaited<ReturnType<typeof getCloneChatStores>>;

async function v1Get(v1: V1Ctx, path: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${v1.base}${path}`, { method: "GET", headers: v1.headers, credentials: "same-origin" });
    if (!res.ok) return null;
    return (await res.json().catch(() => null)) as Record<string, unknown> | null;
  } catch {
    return null;
  }
}

function arr(body: Record<string, unknown> | null, ...keys: string[]): Record<string, unknown>[] {
  if (!body) return [];
  for (const k of keys) {
    const v = body[k];
    if (Array.isArray(v)) return v as Record<string, unknown>[];
  }
  return [];
}
const str = (o: Record<string, unknown>, ...keys: string[]): string => {
  for (const k of keys) { const v = o[k]; if (typeof v === "string" && v) return v; }
  return "";
};

/**
 * Port compte RÉEL : lectures V1 par loopback (l'identité de la requête est transmise ;
 * V1 re-vérifie le membership — le companyId épinglé ne peut pas être forgé côté client).
 */
export function createLoopbackAccountPort(req: Request, companyId: string): ParrainAccountPort {
  const v1 = buildV1Ctx(req, companyId);
  return {
    async listMissions(company: string, limit: number): Promise<readonly AccountMissionLite[]> {
      if (company !== companyId) return []; // garde d'usage : le port est lié à SON tenant
      const body = await v1Get(v1, `/api/pierre/v1/missions?limit=${Math.min(limit, 10)}`);
      return arr(body, "missions", "items").slice(0, limit).map((m) => ({
        id: str(m, "id", "mission_id"),
        companyId: company,
        title: str(m, "title", "instruction", "label").slice(0, 140),
        status: str(m, "status") || "unknown",
        updatedAt: str(m, "updated_at", "updatedAt") || null,
      }));
    },
    async listValidations(company: string, limit: number): Promise<readonly AccountValidationLite[]> {
      if (company !== companyId) return [];
      // Les validations vivent par mission — on borne aux missions récentes.
      const missions = await this.listMissions(company, 4);
      const out: AccountValidationLite[] = [];
      for (const m of missions) {
        if (out.length >= limit || !m.id) break;
        const body = await v1Get(v1, `/api/pierre/v1/missions/${encodeURIComponent(m.id)}/validations`);
        for (const v of arr(body, "validations", "items")) {
          if (out.length >= limit) break;
          out.push({
            id: str(v, "id"),
            companyId: company,
            missionId: m.id,
            label: str(v, "label", "title", "kind").slice(0, 120) || "validation",
            status: str(v, "status") || "pending",
          });
        }
      }
      return out;
    },
    async listEmployees(company: string, limit: number): Promise<readonly AccountEmployeeLite[]> {
      if (company !== companyId) return [];
      const body = await v1Get(v1, `/api/pierre/v1/employees?limit=${Math.min(limit, 10)}`);
      return arr(body, "employees", "items").slice(0, limit).map((e) => ({
        id: str(e, "id"),
        companyId: company,
        displayName: [str(e, "first_name", "firstName"), str(e, "last_name", "lastName")].filter(Boolean).join(" ") || str(e, "display_name", "name") || "salarié",
        role: str(e, "position", "role", "job_title") || null,
      }));
    },
    async listArtifacts(company: string, limit: number): Promise<readonly AccountArtifactLite[]> {
      if (company !== companyId) return [];
      // Les artefacts sont portés par les missions récentes (même surface que le cockpit).
      const missions = await this.listMissions(company, 4);
      const out: AccountArtifactLite[] = [];
      for (const m of missions) {
        if (out.length >= limit || !m.id) break;
        const body = await v1Get(v1, `/api/pierre/v1/missions/${encodeURIComponent(m.id)}`);
        const mission = (body?.mission ?? body) as Record<string, unknown> | null;
        for (const a of arr(mission, "artifacts", "documents")) {
          if (out.length >= limit) break;
          out.push({
            id: str(a, "id", "artifact_id"),
            companyId: company,
            missionId: m.id,
            label: str(a, "label", "title", "filename").slice(0, 120) || "document",
            kind: str(a, "kind", "type") || "document",
            version: typeof a.version === "number" ? (a.version as number) : null,
            createdAt: str(a, "created_at", "createdAt") || null,
          });
        }
      }
      return out;
    },
  };
}

/**
 * Port délégation RÉEL : réutilise buildAndPersistProposal (P9.4.2). La proposition est
 * PERSISTÉE côté serveur ; la confirmation passe par /api/assistant/execute existant
 * (SHA-256, claim atomique, V1 loopback, re-lecture) — rien n'est exécuté ici.
 */
export function createProposalDelegationPort(req: Request, stores: Stores): PierreDelegationPort {
  return {
    async proposeMission(input) {
      const proposal = await buildAndPersistProposal({
        toolCall: { name: "prepare_mission", arguments: { instruction: input.instruction } },
        userMessage: input.instruction,
        identity: { companyId: input.companyId, userId: input.userId },
        conversationId: input.conversationId,
        proposals: stores.proposals,
        req,
        at: input.at,
      });
      if (!proposal || !proposal.id || !proposal.kind) return null;
      return { proposalId: proposal.id, kind: proposal.kind, label: proposal.label ?? "Confirmer la mission" };
    },
    async readMissionStatus(companyId, missionId) {
      const v1 = buildV1Ctx(req, companyId);
      const body = await v1Get(v1, `/api/pierre/v1/missions/${encodeURIComponent(missionId)}`);
      if (!body) return null;
      const mission = (body.mission ?? body) as Record<string, unknown>;
      const id = str(mission, "id", "mission_id");
      if (!id) return null;
      return { missionId: id, status: str(mission, "status") || "unknown" };
    },
  };
}

/** Viewer client résolu SERVEUR (le body client n'entre jamais ici). */
export function clientViewer(companyId: string, userId: string, role: string | null = null): ParrainViewerContext {
  return Object.freeze({ mode: "client", companyId, userId, role });
}

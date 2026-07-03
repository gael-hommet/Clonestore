// src/lib/clonechat/durable/command-ledger.ts
// P9.4.2 r2 (§2/§3) — Registre de COMMANDES effectives DURABLE, autoritaire côté SERVEUR.
// Identité canonique = SHA-256(company, actor, conversation, proposal, kind, payload
// canonique). Aucune autorité client (le client ne présente qu'une référence de
// proposition ; le serveur recharge + reconstruit). Cycle : CONFIRMED → EXECUTING →
// SUCCEEDED | FAILED_RECOVERABLE | FAILED_TERMINAL | CANCELLED. `claim` est atomique
// (INSERT ON CONFLICT DO UPDATE conditionnel) : une seule exécution, reprise après lease
// expiré (crash), doublon renvoie le résultat existant. Toutes les opérations sont
// scopées par (company, actor) résolus serveur.

import { createHash } from "crypto";
import type { ClonechatDb } from "./pg";

export type CommandStatus = "confirmed" | "executing" | "succeeded" | "failed_recoverable" | "failed_terminal" | "cancelled";

export interface CanonicalCommand {
  readonly companyId: string;
  readonly actorId: string;
  readonly conversationId: string | null;
  readonly proposalId: string;
  readonly actionKind: string;
  readonly payload: unknown;
}

export interface CommandRow {
  readonly fingerprint: string;
  readonly status: CommandStatus;
  readonly targetRef: string | null;
  readonly result: unknown | null;
  readonly attemptCount: number;
}

export type ClaimOutcome =
  | { readonly kind: "acquired"; readonly command: CommandRow }          // à exécuter (1re fois)
  | { readonly kind: "recovered"; readonly command: CommandRow }         // lease expiré → réexécuter
  | { readonly kind: "duplicate_succeeded"; readonly command: CommandRow } // déjà réussi → renvoyer le résultat
  | { readonly kind: "in_flight"; readonly command: CommandRow }         // exécution concurrente (lease valide)
  | { readonly kind: "terminal"; readonly command: CommandRow };         // échec terminal / annulé

// ── Identité canonique (déterministe, SHA-256) ──────────────────────────────
function canonicalize(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v ?? null);
  if (Array.isArray(v)) return "[" + v.map(canonicalize).join(",") + "]";
  const keys = Object.keys(v as Record<string, unknown>).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalize((v as Record<string, unknown>)[k])).join(",") + "}";
}
export function canonicalPayloadSha256(payload: unknown): string {
  return createHash("sha256").update(canonicalize(payload), "utf8").digest("hex");
}
export function commandFingerprint(c: CanonicalCommand): string {
  const sig = canonicalize([c.companyId, c.actorId, c.conversationId ?? "", c.proposalId, c.actionKind, canonicalPayloadSha256(c.payload)]);
  return createHash("sha256").update(sig, "utf8").digest("hex");
}

function mapRow(r: Record<string, unknown>): CommandRow {
  return { fingerprint: String(r.fingerprint), status: r.status as CommandStatus, targetRef: (r.target_ref as string) ?? null, result: r.result ?? null, attemptCount: Number(r.attempt_count) };
}

export interface CommandLedger {
  /** Réserve atomiquement la commande (ou reprend un lease expiré). Scopé company+actor. */
  claim(c: CanonicalCommand, leaseOwner: string, leaseMs: number): Promise<ClaimOutcome>;
  commit(c: CanonicalCommand, targetRef: string | null, result: unknown): Promise<void>;
  fail(c: CanonicalCommand, terminal: boolean, recovery?: unknown): Promise<void>;
  cancel(c: CanonicalCommand): Promise<void>;
  get(fingerprint: string, ctx: { companyId: string; actorId: string }): Promise<CommandRow | null>;
}

export function createDurableCommandLedger(db: ClonechatDb): CommandLedger {
  const tenant = (c: { companyId: string; actorId: string }) => ({ companyId: c.companyId, userId: c.actorId });

  return {
    async claim(c, leaseOwner, leaseMs) {
      const fp = commandFingerprint(c);
      const payloadHash = canonicalPayloadSha256(c.payload);
      return db.withTenant(tenant(c), async (q) => {
        // INSERT (nouvelle commande, EXECUTING) OU reprise conditionnelle d'un lease
        // reclaimable (confirmed / failed_recoverable / executing+lease expiré).
        const up = await q.query<Record<string, unknown> & { inserted: boolean }>(
          `insert into clonechat_commands (fingerprint, company_id, actor_id, conversation_id, proposal_id, action_kind, payload_sha256, status, attempt_count, lease_owner, lease_expiry, updated_at)
             values ($1,$2,$3,$4,$5,$6,$7,'executing',1,$8, now() + ($9::int * interval '1 millisecond'), now())
           on conflict (fingerprint) do update
             set status='executing', attempt_count = clonechat_commands.attempt_count + 1,
                 lease_owner = excluded.lease_owner, lease_expiry = now() + ($9::int * interval '1 millisecond'), updated_at = now()
             where clonechat_commands.status in ('confirmed','failed_recoverable')
                or (clonechat_commands.status = 'executing' and clonechat_commands.lease_expiry < now())
           returning *, (xmax = 0) as inserted`,
          [fp, c.companyId, c.actorId, c.conversationId, c.proposalId, c.actionKind, payloadHash, leaseOwner, leaseMs],
        );
        if (up.rowCount > 0) {
          const row = up.rows[0];
          return { kind: row.inserted ? "acquired" : "recovered", command: mapRow(row) };
        }
        // Pas de reclaim → lire l'état existant.
        const cur = await q.query<Record<string, unknown>>("select * from clonechat_commands where fingerprint=$1", [fp]);
        const row = cur.rows[0];
        if (!row) return { kind: "in_flight", command: { fingerprint: fp, status: "executing", targetRef: null, result: null, attemptCount: 0 } };
        const st = row.status as CommandStatus;
        if (st === "succeeded") return { kind: "duplicate_succeeded", command: mapRow(row) };
        if (st === "executing") return { kind: "in_flight", command: mapRow(row) };
        return { kind: "terminal", command: mapRow(row) };
      });
    },

    async commit(c, targetRef, result) {
      const fp = commandFingerprint(c);
      await db.withTenant(tenant(c), async (q) => {
        await q.query(
          "update clonechat_commands set status='succeeded', target_ref=$2, result=$3::jsonb, lease_owner=null, lease_expiry=null, updated_at=now() where fingerprint=$1 and company_id=$4 and actor_id=$5",
          [fp, targetRef, result === undefined ? null : JSON.stringify(result), c.companyId, c.actorId],
        );
      });
    },

    async fail(c, terminal, recovery) {
      const fp = commandFingerprint(c);
      await db.withTenant(tenant(c), async (q) => {
        await q.query(
          `update clonechat_commands set status=$2, recovery=$3::jsonb, lease_owner=null, lease_expiry=null, updated_at=now()
             where fingerprint=$1 and company_id=$4 and actor_id=$5`,
          [fp, terminal ? "failed_terminal" : "failed_recoverable", recovery === undefined ? null : JSON.stringify(recovery), c.companyId, c.actorId],
        );
      });
    },

    async cancel(c) {
      const fp = commandFingerprint(c);
      await db.withTenant(tenant(c), async (q) => {
        await q.query("update clonechat_commands set status='cancelled', lease_owner=null, lease_expiry=null, updated_at=now() where fingerprint=$1 and company_id=$2 and actor_id=$3 and status <> 'succeeded'", [fp, c.companyId, c.actorId]);
      });
    },

    async get(fingerprint, ctx) {
      return db.withTenant(tenant(ctx), async (q) => {
        const r = await q.query<Record<string, unknown>>("select * from clonechat_commands where fingerprint=$1 and company_id=$2 and actor_id=$3", [fingerprint, ctx.companyId, ctx.actorId]);
        return r.rows[0] ? mapRow(r.rows[0]) : null;
      });
    },
  };
}

// ── In-memory (tests / repli sans DB — par processus, non durable multi-instance) ──
interface MemCmd { fp: string; companyId: string; actorId: string; status: CommandStatus; targetRef: string | null; result: unknown | null; attemptCount: number; leaseExpiryMs: number | null; }
export function createInMemoryCommandLedger(nowMs: () => number = () => Date.now()): CommandLedger {
  const rows = new Map<string, MemCmd>();
  const scoped = (r: MemCmd | undefined, ctx: { companyId: string; actorId: string }) => (r && r.companyId === ctx.companyId && r.actorId === ctx.actorId ? r : undefined);
  return {
    async claim(c, _leaseOwner, leaseMs) {
      const fp = commandFingerprint(c);
      const existing = rows.get(fp);
      const now = nowMs();
      if (!existing) { rows.set(fp, { fp, companyId: c.companyId, actorId: c.actorId, status: "executing", targetRef: null, result: null, attemptCount: 1, leaseExpiryMs: now + leaseMs }); return { kind: "acquired", command: pub(rows.get(fp)!) }; }
      if (existing.status === "succeeded") return { kind: "duplicate_succeeded", command: pub(existing) };
      if (existing.status === "executing" && (existing.leaseExpiryMs ?? 0) > now) return { kind: "in_flight", command: pub(existing) };
      if (existing.status === "confirmed" || existing.status === "failed_recoverable" || (existing.status === "executing" && (existing.leaseExpiryMs ?? 0) <= now)) {
        existing.status = "executing"; existing.attemptCount += 1; existing.leaseExpiryMs = now + leaseMs; return { kind: "recovered", command: pub(existing) };
      }
      return { kind: "terminal", command: pub(existing) };
    },
    async commit(c, targetRef, result) { const r = rows.get(commandFingerprint(c)); if (r && r.companyId === c.companyId && r.actorId === c.actorId) { r.status = "succeeded"; r.targetRef = targetRef; r.result = result ?? null; r.leaseExpiryMs = null; } },
    async fail(c, terminal) { const r = rows.get(commandFingerprint(c)); if (r && r.companyId === c.companyId && r.actorId === c.actorId) { r.status = terminal ? "failed_terminal" : "failed_recoverable"; r.leaseExpiryMs = null; } },
    async cancel(c) { const r = rows.get(commandFingerprint(c)); if (r && r.companyId === c.companyId && r.actorId === c.actorId && r.status !== "succeeded") { r.status = "cancelled"; r.leaseExpiryMs = null; } },
    async get(fp, ctx) { const r = scoped(rows.get(fp), ctx); return r ? pub(r) : null; },
  };
  function pub(r: MemCmd): CommandRow { return { fingerprint: r.fp, status: r.status, targetRef: r.targetRef, result: r.result, attemptCount: r.attemptCount }; }
}

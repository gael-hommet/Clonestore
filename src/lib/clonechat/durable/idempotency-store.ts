// src/lib/clonechat/durable/idempotency-store.ts
// P9.4.2 — Idempotence DURABLE cross-session/instance des actions effectives. Le
// fingerprint est calculé CÔTÉ SERVEUR à partir de l'identité résolue (company+user) +
// kind + clé stable + jour ⇒ une même action logique confirmée ne s'exécute pas deux
// fois, même après reload ou sur un autre appareil. `claim` est atomique (INSERT ON
// CONFLICT DO NOTHING). En repli sans DB : garde in-memory par processus (non durable).

import type { ClonechatDb } from "./pg";

export type ClaimStatus = "new" | "duplicate" | "in_flight";

export interface IdempotencyStore {
  /** Réserve atomiquement le fingerprint. 'new' ⇒ exécuter ; 'duplicate'/'in_flight' ⇒ ne pas ré-exécuter. */
  claim(fingerprint: string, meta: { companyId: string; userId: string; kind: string }): Promise<ClaimStatus>;
  /** Marque l'action réellement exécutée (succès confirmé serveur). */
  commit(fingerprint: string, result?: unknown): Promise<void>;
  /** Libère un claim non abouti (échec) → réessai possible. */
  fail(fingerprint: string): Promise<void>;
}

/** Fingerprint déterministe (FNV-1a) — tenant-safe (aucune PII brute, jour inclus). */
export function actionFingerprint(companyId: string, userId: string, kind: string, key: string, dayIso: string): string {
  const sig = [companyId, userId, kind, key.trim().toLowerCase(), dayIso.slice(0, 10)].join("|");
  let h = 0x811c9dc5;
  for (let i = 0; i < sig.length; i++) { h ^= sig.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return "exec_" + h.toString(16).padStart(8, "0");
}

// ── Postgres durable ─────────────────────────────────────────────────────────
export function createDurableIdempotency(db: ClonechatDb): IdempotencyStore {
  return {
    async claim(fingerprint, meta) {
      return db.withInternal(async (q) => {
        const ins = await q.query<{ fingerprint: string }>(
          `insert into clonechat_action_executions (fingerprint, company_id, user_id, kind, status)
             values ($1, $2, $3, $4, 'claimed')
           on conflict (fingerprint) do nothing returning fingerprint`,
          [fingerprint, isUuid(meta.companyId) ? meta.companyId : null, isUuid(meta.userId) ? meta.userId : null, meta.kind],
        );
        if (ins.rowCount > 0) return "new";
        const cur = await q.query<{ status: string }>("select status from clonechat_action_executions where fingerprint = $1", [fingerprint]);
        return cur.rows[0]?.status === "committed" ? "duplicate" : "in_flight";
      });
    },
    async commit(fingerprint, result) {
      await db.withInternal(async (q) => {
        await q.query("update clonechat_action_executions set status='committed', result=$2::jsonb, updated_at=now() where fingerprint=$1", [fingerprint, result === undefined ? null : JSON.stringify(result)]);
      });
    },
    async fail(fingerprint) {
      await db.withInternal(async (q) => {
        await q.query("delete from clonechat_action_executions where fingerprint=$1 and status <> 'committed'", [fingerprint]);
      });
    },
  };
}

function isUuid(v: string): boolean { return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v); }

// ── In-memory (tests / repli sans DB — non durable, par processus) ───────────
export function createInMemoryIdempotency(): IdempotencyStore {
  const rows = new Map<string, "claimed" | "committed">();
  return {
    async claim(fingerprint) {
      const cur = rows.get(fingerprint);
      if (cur === "committed") return "duplicate";
      if (cur === "claimed") return "in_flight";
      rows.set(fingerprint, "claimed");
      return "new";
    },
    async commit(fingerprint) { rows.set(fingerprint, "committed"); },
    async fail(fingerprint) { if (rows.get(fingerprint) !== "committed") rows.delete(fingerprint); },
  };
}

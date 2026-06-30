// src/lib/pierre/v1/customer-activation.ts
// PHASE 8.6 — customer ACTIVATION: request (app) → claim + atomic provision (worker).
//
// A provisioning_key (derived from the commercial proof) guarantees two concurrent activations of the
// SAME commercial proof produce ONE company (or an idempotent result). The worker creates the company,
// the owner membership, the active entitlement, the onboarding session+steps, the access event — all in
// one governed transaction (spec §16). On failure nothing partial survives.

import { createHash } from "crypto";
import type { SqlExecutor } from "./sql";
import { onboardingStepSeed } from "./onboarding-registry";

/** Deterministic provisioning key: same commercial proof → same key → one company. */
export function computeProvisioningKey(parts: { product_key?: string; commercial_reference?: string | null; fallback?: string | null }): string {
  const basis = [parts.product_key ?? "pierre", parts.commercial_reference ?? parts.fallback ?? ""].join("|");
  return `prov:${createHash("sha256").update(basis).digest("hex").slice(0, 40)}`;
}

export type RequestActivationInput = {
  provisioning_key: string;
  commercial_reference?: string | null;
  product_key?: string;
  requested_by?: string | null;
  owner_user_id: string;
  company_name: string;
};

/** App-role: request an activation. Idempotent on provisioning_key. Returns the activation id. */
export async function requestCustomerActivation(tx: SqlExecutor, input: RequestActivationInput): Promise<string> {
  const { rows } = await tx.query<{ id: string }>(
    `select pierre_rt_request_customer_activation($1,$2,$3,$4,$5,$6) as id`,
    [input.provisioning_key, input.commercial_reference ?? null, input.product_key ?? "pierre",
     input.requested_by ?? null, input.owner_user_id, input.company_name],
  );
  return rows[0].id;
}

export type ActivationRow = {
  id: string;
  provisioning_key: string;
  company_id: string | null;
  product_key: string;
  commercial_reference: string | null;
  status: string;
  requested_by: string | null;
  owner_user_id: string | null;
  company_name: string | null;
  source_type: string | null;
  source_reference: string | null;
  locked_by: string | null;
  fencing_token: number | string;
  claimed_at: string | null;
  lease_expires_at: string | null;
  blocked_reason: string | null;
};

/** Worker-role: claim one provisioning-ready activation (lease). */
export async function claimCustomerActivation(tx: SqlExecutor, worker: string, leaseSeconds = 60, now = new Date()): Promise<ActivationRow | null> {
  const { rows } = await tx.query<ActivationRow>(
    `select * from pierre_rt_claim_customer_activation($1,$2,$3)`,
    [worker, leaseSeconds, now.toISOString()],
  );
  return rows[0] ?? null;
}

/**
 * Worker-role: atomically provision the company for a CLAIMED activation. The lease owner (locked_by) +
 * the current fencing token are taken from the claimed row and verified by the governed function, so a
 * stale or unclaimed worker can never provision. Returns the company id.
 */
export async function provisionCustomerCompany(
  tx: SqlExecutor,
  input: { activation: ActivationRow; correlation_id?: string | null },
): Promise<string> {
  const a = input.activation;
  const steps = JSON.stringify(onboardingStepSeed(a.product_key ?? "pierre"));
  const { rows } = await tx.query<{ company_id: string }>(
    `select pierre_rt_provision_customer_company($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10) as company_id`,
    [
      a.id, a.locked_by, a.fencing_token, a.company_name ?? "Nouvelle entreprise", a.owner_user_id,
      a.product_key ?? "pierre", a.source_type, a.source_reference, steps, input.correlation_id ?? null,
    ],
  );
  return rows[0].company_id;
}

/** Worker-role: block a claimed activation (lease owner + fencing verified for a provisioning one). */
export async function blockCustomerActivation(
  tx: SqlExecutor, activation: { id: string; locked_by: string | null; fencing_token: number | string }, reason: string,
): Promise<void> {
  await tx.query(`select pierre_rt_block_customer_activation($1,$2,$3,$4)`, [activation.id, activation.locked_by, activation.fencing_token, reason]);
}

export type ActivationTickResult = { claimed: number; provisioned: string[] };

/**
 * One worker tick: claim provisioning-ready activations and provision them. Each provisioning is a single
 * governed transaction; concurrent ticks are safe (claim uses FOR UPDATE SKIP LOCKED; provisioning is
 * idempotent on provisioning_key). `runOne` is the caller-provided binder (one role-bound tx per claim).
 */
export async function runCustomerActivationTick(
  runOne: <T>(fn: (tx: SqlExecutor) => Promise<T>) => Promise<T>,
  opts: { worker: string; max?: number; leaseSeconds?: number; now?: Date; correlation_id?: string | null } = { worker: "activation-worker" },
): Promise<ActivationTickResult> {
  const result: ActivationTickResult = { claimed: 0, provisioned: [] };
  const max = opts.max ?? 10;
  for (let i = 0; i < max; i++) {
    const company = await runOne(async (tx) => {
      const a = await claimCustomerActivation(tx, opts.worker, opts.leaseSeconds ?? 60, opts.now ?? new Date());
      if (!a) return null;
      result.claimed += 1;
      if (!a.owner_user_id) { await blockCustomerActivation(tx, a, "missing_owner_user"); return null; }
      return provisionCustomerCompany(tx, { activation: a, correlation_id: opts.correlation_id ?? null });
    });
    if (!company) break;
    result.provisioned.push(company);
  }
  return result;
}

// src/lib/pierre/v1/e2e-control-plane.ts
// PHASE 8.6 — shared TEST-ONLY E2E control plane. Centralises the guard (mode + secret + production
// refusal), the shared in-process PGlite, and governed operations that drive the real services under the
// real roles. It NEVER writes a terminal state directly: it ingests a commercial proof, marks an
// activation provisioning, runs the real activation worker (claim/lease/fencing/provision), drives the
// real communication pipeline, and reads state read-only. Forbidden outside PIERRE_E2E_TEST_MODE.

import { NextResponse } from "next/server";
import { isE2EModeEnabled, checkE2ESecret } from "./e2e-test-identity";
import { getTestRuntimeDb, resetTestRuntimeDb, withTestRoleTransaction } from "./test-runtime-db";
import { withBillingWebhookTransaction } from "./billing-webhook-db";
import { withCustomerActivationTransaction } from "./customer-activation-db";
import { ingestCommercialEvent, applyCommercialEvent, markActivationProvisioning, type CommercialEventKey } from "./commercial-events";
import { runCustomerActivationTick } from "./customer-activation";
import { createRuntimeWorkerExecutor, withRuntimeWorkerTransaction } from "./runtime-worker-db";
import { createRuntimeSchedulerExecutor } from "./runtime-scheduler-db";
import { runPierreRuntimeJobs } from "./runtime-service";
import { runPierreRuntimeScheduler } from "./runtime-scheduler";
import { resolveRuntimeSystemContext } from "./runtime-system-auth";
import { clearE2EMailbox, readE2EMailbox, recordE2EMail } from "./e2e-fake-mailbox";
import { createCommunicationIntents, dispatchCommunicationDeliveries } from "./communications";
import { createCommunicationWorkerExecutor } from "./communication-worker-db";
import { resolveSystemTenantContext } from "./communication-system-auth";
import { withTenantTransaction } from "./tenant-tx";
import { FakeEmailProvider, type EmailSendInput, type EmailSendResult } from "./communication-provider";
import { newUuid } from "./sql";

const SECRET_HEADER = "x-pierre-e2e-secret";

/** Error NextResponse if the request is not an authorized E2E control-plane call, else null. */
export function guardE2E(req: Request): NextResponse | null {
  if (!isE2EModeEnabled()) return NextResponse.json({ error: { code: "not_found" } }, { status: 404 });
  if (!checkE2ESecret(req.headers.get(SECRET_HEADER))) return NextResponse.json({ error: { code: "forbidden" } }, { status: 403 });
  return null;
}

/** Deterministic reset: virgin v1→v28 DB + empty mailbox. */
export async function e2eReset(): Promise<{ ok: true }> {
  await resetTestRuntimeDb();
  clearE2EMailbox();
  await getTestRuntimeDb(); // rebuild eagerly so the next request is fast
  return { ok: true };
}

/** Allocate a minimal test identity (cookie-based; no profile/membership/entitlement created). */
export function e2eSeedUser(input: { email?: string }): { user_id: string; email: string } {
  const user_id = newUuid();
  return { user_id, email: input.email ?? `e2e_${user_id.slice(0, 8)}@e2e.test` };
}

export type CommercialEventInput = {
  provider?: string; provider_event_id: string; event_key: CommercialEventKey; payload_hash?: string;
  subscription_reference?: string | null; customer_reference?: string | null; order_reference?: string | null;
  product_key?: string; occurred_at?: string | null; source_type?: string;
};

/** Ingest a verified commercial event (billing role); if it matches an awaiting activation, mark it
 *  provisioning. No direct entitlement/activation truth is fabricated. */
export async function e2eCommercialEvent(input: CommercialEventInput): Promise<{ ingest: string; event_id: string | null; activation_marked: string | null }> {
  const provider = input.provider ?? "paid_customer_test";
  // 1) ingest the verified event under the billing role (governed).
  const ingest = await withBillingWebhookTransaction({}, (tx) => ingestCommercialEvent(tx, {
    provider, provider_event_id: input.provider_event_id, event_key: input.event_key,
    payload_hash: input.payload_hash ?? `hash:${input.provider_event_id}`,
    subscription_reference: input.subscription_reference ?? null, customer_reference: input.customer_reference ?? null,
    order_reference: input.order_reference ?? null, product_key: input.product_key ?? "pierre", occurred_at: input.occurred_at ?? null,
  }));
  // 2) read the event id + a matching awaiting activation via the superuser (the pre-tenant rows have a
  //    NULL company and are invisible to the RLS-scoped billing role — reads bypass RLS here, mutations
  //    still go through the governed billing-role function below).
  const su = await getTestRuntimeDb();
  const ev = await su.query<{ id: string }>(`select id from pierre_rt_commercial_events where provider=$1 and provider_event_id=$2`, [provider, input.provider_event_id]);
  const event_id = ev.rows[0]?.id ?? null;
  let activation_marked: string | null = null;
  const refs = [input.subscription_reference, input.order_reference, input.customer_reference].filter(Boolean) as string[];
  if (refs.length) {
    const act = await su.query<{ id: string }>(`select id from pierre_rt_customer_activations where commercial_reference = any($1) and status='awaiting_commercial_proof' order by created_at desc limit 1`, [refs]);
    if (act.rows[0]) activation_marked = await withBillingWebhookTransaction({}, (tx) => markActivationProvisioning(tx, act.rows[0].id, input.source_type ?? "paid_customer_test", refs[0]));
  }
  return { ingest, event_id, activation_marked };
}

/** Apply a persisted commercial event through the ordered governed path (billing role). */
export async function e2eApplyCommercialEvent(eventId: string): Promise<{ result: string }> {
  return withBillingWebhookTransaction({}, async (tx) => ({ result: await applyCommercialEvent(tx, eventId) }));
}

/** Run the real customer-activation worker tick (claim + fenced provision). */
export async function e2eActivationTick(): Promise<{ claimed: number; provisioned: string[] }> {
  return runCustomerActivationTick((fn) => withCustomerActivationTransaction(fn), { worker: "e2e-activation-worker" });
}

/**
 * A Fake email provider that records every send into the E2E mailbox AT THE PROVIDER BOUNDARY — the only
 * place the invitation token surfaces. The token is parsed out of the (frozen) email content, exactly as a
 * recipient would receive it; the client API never returns it.
 */
class MailboxRecordingFakeProvider extends FakeEmailProvider {
  async sendEmail(input: EmailSendInput): Promise<EmailSendResult> {
    const sent = await super.sendEmail(input);
    const content = `${input.subject}\n${input.plainText}\n${input.html}`;
    const token = content.match(/token=([^\s"'&<>]+)/)?.[1];
    const link = content.match(/\/invite\/accept[^\s"'<>]*/)?.[0] ?? null;
    const eventKind = input.tags?.event_kind ?? "";
    const kind = eventKind === "member.invited" ? "invitation" : (eventKind || "email");
    recordE2EMail({ id: newUuid(), to: input.to, kind, token, link: link ?? undefined, subject: input.subject, created_at: new Date().toISOString() });
    return sent;
  }
}

/**
 * Communication tick: runs the REAL P8.4 pipeline for every tenant with pending business events —
 * createCommunicationIntents (app role, tenant-bound) → dispatchCommunicationDeliveries (dedicated worker
 * executor) → the provider. The mailbox is fed ONLY at the provider boundary; nothing is enqueued or
 * delivered directly from a client route.
 */
export async function e2eCommunicationTick(): Promise<{ delivered: number; intents: number }> {
  const appDb = await getTestRuntimeDb();
  const companies = (await appDb.query<{ company_id: string }>(
    `select distinct company_id from pierre_rt_outbox where status='pending' and comm_processing_status is null`)).rows;
  const provider = new MailboxRecordingFakeProvider({ providerKey: "fake_email" });
  let delivered = 0; let intents = 0;
  for (const { company_id } of companies) {
    const ctx = await resolveSystemTenantContext(appDb, company_id);
    const created = await withTenantTransaction(appDb, { company_id: ctx.company_id, user_id: ctx.user_id }, (tx) => createCommunicationIntents(tx, ctx, {}));
    intents += created.created;
    const workerDb = await createCommunicationWorkerExecutor();
    const disp = await dispatchCommunicationDeliveries(workerDb, ctx, {}, { provider, from: "CloneStore <no-reply@clonestore.pro>", secureLinkSecret: "e2e-link-secret", publicBase: null });
    delivered += disp.submitted + disp.delivered;
  }
  return { delivered, intents };
}

/** Real P8.5 runtime worker tick for a tenant (claim + execute under the worker role). */
export async function e2eRuntimeTick(companyId: string): Promise<Record<string, number>> {
  const appDb = await getTestRuntimeDb();
  const workerDb = await createRuntimeWorkerExecutor();
  const ctx = await resolveRuntimeSystemContext(appDb, companyId);
  return runPierreRuntimeJobs(workerDb, ctx, {}, { appDb, runWorkerTx: withRuntimeWorkerTransaction }) as unknown as Promise<Record<string, number>>;
}

/** Real P8.5 scheduler/recovery tick for a tenant (resolves due waits + drains service events). */
export async function e2eSchedulerTick(companyId: string): Promise<Record<string, number>> {
  const appDb = await getTestRuntimeDb();
  const schedulerDb = await createRuntimeSchedulerExecutor();
  const ctx = await resolveRuntimeSystemContext(appDb, companyId);
  return runPierreRuntimeScheduler(schedulerDb, ctx, {}, { appDb }) as unknown as Promise<Record<string, number>>;
}

/** Read-only snapshot of the relevant client state (superuser read; for assertions only). */
export async function e2eState(): Promise<Record<string, unknown[]>> {
  const db = await getTestRuntimeDb();
  const q = async (sql: string) => (await db.query(sql)).rows;
  return {
    activations: await q(`select id, provisioning_key, company_id, status, owner_user_id, commercial_reference, fencing_token, attempt_count from pierre_rt_customer_activations order by created_at`),
    companies: await q(`select id, name, status, onboarding_status, owner_user_id from pierre_rt_companies order by created_at`),
    members: await q(`select id, company_id, user_id, role, status from pierre_rt_members order by created_at`),
    entitlements: await q(`select id, company_id, product_key, status, source_type from pierre_rt_product_entitlements order by created_at`),
    onboarding_sessions: await q(`select id, company_id, status, progress_percent, current_step_key from pierre_rt_onboarding_sessions order by created_at`),
    invitations: await q(`select id, company_id, email_normalized, status, accepted_by from pierre_rt_invitations order by created_at`),
    commercial_events: await q(`select id, provider_event_id, event_key, occurred_at, application_status, company_id from pierre_rt_commercial_events order by received_at`),
    mission_runs: await q(`select id, company_id, mission_id, status, run_number from pierre_rt_mission_runs order by created_at`),
    mission_steps: await q(`select id, mission_run_id, step_key, action_key, status from pierre_rt_step_runs order by step_ordinal`),
    waits: await q(`select id, mission_run_id, wait_kind, status, validation_id from pierre_rt_runtime_waits order by created_at`),
    validations: await q(`select id, company_id, mission_id, status, version from pierre_rt_validations order by created_at`),
    runtime_events: await q(`select id, company_id, kind, application_status from pierre_rt_runtime_events order by received_at`),
    communication_deliveries: await q(`select id, company_id, status, channel from pierre_rt_communication_deliveries order by created_at`).catch(() => []),
    user_company_prefs: await q(`select user_id, last_company_id from pierre_rt_user_company_prefs order by updated_at`),
    active_owner_counts: await q(`select company_id, count(*)::int as active_owners from pierre_rt_members where role='owner' and status='active' group by company_id`),
  };
}

export { readE2EMailbox, withTestRoleTransaction };

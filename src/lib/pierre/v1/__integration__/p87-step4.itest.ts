// PHASE 8.7.4 — STAGE 2 — DI tests for the controlled-live-customer-journey verifier. Every refusal branch is
// exercised with a synthesised proof bundle (no DB, no real provider). Asserts: a complete fresh bundle VERIFIES;
// the old governed-core run is REFUSED; a provider call without a webhook is REFUSED; a raw document, a direct
// onboarding, a wildcard cleanup, a disabled trigger, a service-role worker, a still-active synthetic tenant, an
// invented delivered/activated, cross-tenant access, a double external effect, and a permanent process are each
// REFUSED; a missing proof or a pending human Yousign action yields PROOF_REQUIRED (never green).
import { describe, it, expect } from "vitest";
import {
  runControlledLiveJourneyCheck,
  REQUIRED_PROOFS,
  KNOWN_OLD_RUN_IDS,
  CANONICAL_SCOPE,
  DOC_ENGINE,
  EXPECTED_PRICE_AMOUNT,
} from "../controlled-live-journey-check.mjs";
import type { ProofBundle } from "../controlled-live-journey-check.mjs";

const RUN = "rfeed0c0ffee99";

// A complete, honest STAGE-2 bundle for a single fresh run_id. Tests deep-clone and mutate it.
function goodFiles(runId: string): Record<string, any> {
  return {
    "run-manifest.json": { phase: "P8.7.4", run_id: runId, scope: CANONICAL_SCOPE, environment: "production", apply: true, started_at: "2026-07-01T00:00:00.000Z" },
    "onboarding-proof.json": { run_id: runId, canonical: true, via_service: "pierre_rt_provision_customer_company", company_bootstrap: "admin-minimal", onboarding_session_id: "sess-1", steps_completed: 4, session_completed: true, direct_business_onboarding: false },
    "employee-proof.json": { run_id: runId, canonical: true, via_service: "createEmployee", employee_id: "emp-1", employee360: { has_employee: true, events: 2, documents: 1, absences: 0 } },
    "mission-proof.json": { run_id: runId, mission_id: "mis-1", tasks: 3, dependencies: 2, mandatory_validation: true, blocked_before_approval: true, approval_persisted_by: "decideValidationAction", resumed_after_approval: true, run_status: "completed", via: "pierre_rt_create_compiled_mission_run" },
    "document-proof.json": { run_id: runId, engine: DOC_ENGINE, renderers: ["pdf", "docx"], document_id: "doc-1", version_id: "ver-1", version_number: 1, file_ids: { pdf: "f-pdf", docx: "f-docx" }, links: ["mission", "task", "employee"], content_hash: "a".repeat(64), persisted: true, raw_write: false },
    "storage-proof.json": { run_id: runId, bucket: "pierre-private-documents", private: true, uploaded: true, public_refused: true, signed_url: true, hash_match: true },
    "billing-proof.json": { run_id: runId, provider: "stripe", mode: "test", price_amount: EXPECTED_PRICE_AMOUNT, currency: "eur", subscription_id: "sub_x", provider_call: true, webhook_received: true, webhook_signature_valid: true, persisted_event_id: "ce-1", commercial_event_status: "applied:active", entitlement_status: "active" },
    "communication-proof.json": { run_id: runId, created_by_pipeline: true, intent_id: "int-1", emails_sent: 1, provider: "resend", provider_message_id: "rmsg-1", webhook_received: true, webhook_signature_valid: true, delivery_status: "delivered", persisted_delivery_id: "del-1", persisted_provider_event_id: "pe-1" },
    "signature-proof.json": { run_id: runId, created_by_pipeline: true, provider: "yousign", mode: "sandbox", provider_request_id: "ys-1", document_added: true, signer_added: true, activated: true, webhook_event: "signature_request.activated", webhook_received: true, webhook_signature_valid: true, canonicalized: true, persisted_event_id: "se-1", human_action_required: false },
    "resilience-proof.json": { run_id: runId, duplicate_webhook_idempotent: true, bad_signature_rejected: true, bad_signature_no_mutation: true, retry_backoff_deadletter: { adapter_injected: true, retries: 3, backoff_applied: true, dead_lettered: true, external_calls: 1, expected_external_calls: 1 } },
    "isolation-proof.json": { run_id: runId, axes: { employee: false, mission: false, task: false, document: false, communication: false, signature: false }, cross_tenant_leak: false },
    "cleanup-proof.json": { run_id: runId, mode: "exact-ids", wildcard: false, triggers_disabled: false, tombstoned: true, synthetic_tenants_active: 0, entitlements_removed: true, jobs_removed: true, communications_pending_removed: true, signatures_active_removed: true, anonymized: true, tenants_inactive: true, service_role: false, permanent_process: false, deploy_block_untouched: true, claimable_deliveries: 0, yousign_open_after: false, ids: { companyA: "ca", companyB: "cb" } },
    "final-report.json": { phase: "P8.7.4", run_id: runId, scope: CANONICAL_SCOPE, ok: true, verdict: "VERIFIED" },
  };
}

const clone = (f: Record<string, any>) => JSON.parse(JSON.stringify(f)) as Record<string, any>;
function bundleOf(files: Record<string, any>, runId = RUN): ProofBundle {
  const present = Object.keys(files);
  const missing = REQUIRED_PROOFS.filter((n) => !(n in files) || files[n] == null);
  return { run_id: runId, files, present, missing };
}
const run = (files: Record<string, any>, runId = RUN) => runControlledLiveJourneyCheck({ loadBundle: () => bundleOf(files, runId) });

describe("P8.7.4 STAGE 2 controlled-live-journey check (DI, real-evidence)", () => {
  it("REQUIRED_PROOFS lists the 13 canonical proof files and includes the final report", () => {
    expect(REQUIRED_PROOFS).toHaveLength(13);
    expect(REQUIRED_PROOFS).toContain("final-report.json");
    expect(REQUIRED_PROOFS).toContain("signature-proof.json");
  });

  it("a complete fresh bundle VERIFIES with all 24 requirements passing and no refusals", () => {
    const r = run(goodFiles(RUN));
    expect(r.verdict).toBe("VERIFIED");
    expect(r.ok).toBe(true);
    expect(r.refusals).toHaveLength(0);
    expect(r.steps).toHaveLength(24);
    expect(r.steps.every((s) => s.ok)).toBe(true);
  });

  it("no bundle at all → PROOF_REQUIRED (never green)", () => {
    const r = runControlledLiveJourneyCheck({ loadBundle: () => null });
    expect(r.verdict).toBe("PROOF_REQUIRED");
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual(REQUIRED_PROOFS);
  });

  it("a missing proof file → PROOF_REQUIRED (never green)", () => {
    const f = clone(goodFiles(RUN));
    delete f["document-proof.json"];
    const r = run(f);
    expect(r.verdict).toBe("PROOF_REQUIRED");
    expect(r.ok).toBe(false);
    expect(r.missing).toContain("document-proof.json");
  });

  it("the OLD governed-core run_id is REFUSED even with otherwise-complete files", () => {
    const old = KNOWN_OLD_RUN_IDS[0];
    const r = run(goodFilesForRun(old), old);
    expect(r.verdict).toBe("REFUSED");
    expect(r.refusals.map((x) => x.rule)).toContain("old_run");
  });

  it("a governed-core scope manifest is REFUSED (cannot reuse STAGE 1)", () => {
    const f = clone(goodFiles(RUN));
    f["run-manifest.json"].scope = "governed-core controlled journey (DB + storage + isolation …)";
    const r = run(f);
    expect(r.verdict).toBe("REFUSED");
    expect(r.refusals.map((x) => x.rule)).toContain("old_run");
  });

  it("a dry-run manifest (apply!==true) can never be a proof", () => {
    const f = clone(goodFiles(RUN));
    f["run-manifest.json"].apply = false;
    expect(run(f).refusals.map((x) => x.rule)).toContain("old_run");
  });

  it("mixed run ids across the bundle are REFUSED", () => {
    const f = clone(goodFiles(RUN));
    f["billing-proof.json"].run_id = "rdifferent00001";
    const r = run(f);
    expect(r.verdict).toBe("REFUSED");
    expect(r.refusals.map((x) => x.rule)).toContain("mixed_run_ids");
  });

  it("a Stripe subscription with no signed webhook is REFUSED (provider call is never proof)", () => {
    const f = clone(goodFiles(RUN));
    f["billing-proof.json"].webhook_received = false;
    f["billing-proof.json"].persisted_event_id = "";
    const r = run(f);
    expect(r.verdict).toBe("REFUSED");
    expect(r.refusals.map((x) => x.rule)).toContain("provider_call_without_webhook");
  });

  it("an email sent with no Resend webhook is REFUSED", () => {
    const f = clone(goodFiles(RUN));
    f["communication-proof.json"].webhook_received = false;
    expect(run(f).refusals.map((x) => x.rule)).toContain("provider_call_without_webhook");
  });

  it("a raw document (not the documentary engine) is REFUSED", () => {
    const f = clone(goodFiles(RUN));
    f["document-proof.json"].engine = "raw";
    f["document-proof.json"].raw_write = true;
    expect(run(f).refusals.map((x) => x.rule)).toContain("raw_document");
  });

  it("a document with no engine content hash is REFUSED", () => {
    const f = clone(goodFiles(RUN));
    f["document-proof.json"].content_hash = "not-a-hash";
    expect(run(f).refusals.map((x) => x.rule)).toContain("raw_document");
  });

  it("direct onboarding presented as canonical is REFUSED", () => {
    const f = clone(goodFiles(RUN));
    f["onboarding-proof.json"].canonical = false;
    f["onboarding-proof.json"].direct_business_onboarding = true;
    expect(run(f).refusals.map((x) => x.rule)).toContain("direct_onboarding_as_canonical");
  });

  it("an invented 'delivered' (no persisted provider event) is REFUSED", () => {
    const f = clone(goodFiles(RUN));
    f["communication-proof.json"].persisted_provider_event_id = "";
    expect(run(f).refusals.map((x) => x.rule)).toContain("invented_status");
  });

  it("an invented entitlement 'active' (no persisted commercial event) is REFUSED", () => {
    const f = clone(goodFiles(RUN));
    f["billing-proof.json"].persisted_event_id = "";
    expect(run(f).refusals.map((x) => x.rule)).toContain("invented_status");
  });

  it("a disabled immutability trigger is REFUSED", () => {
    const f = clone(goodFiles(RUN));
    f["cleanup-proof.json"].triggers_disabled = true;
    expect(run(f).refusals.map((x) => x.rule)).toContain("trigger_disabled");
  });

  it("a wildcard cleanup is REFUSED", () => {
    const f = clone(goodFiles(RUN));
    f["cleanup-proof.json"].wildcard = true;
    f["cleanup-proof.json"].mode = "wildcard";
    expect(run(f).refusals.map((x) => x.rule)).toContain("wildcard_cleanup");
  });

  it("a service-role worker is REFUSED", () => {
    const f = clone(goodFiles(RUN));
    f["cleanup-proof.json"].service_role = true;
    expect(run(f).refusals.map((x) => x.rule)).toContain("service_role_worker");
  });

  it("a still-active synthetic tenant is REFUSED", () => {
    const f = clone(goodFiles(RUN));
    f["cleanup-proof.json"].synthetic_tenants_active = 2;
    f["cleanup-proof.json"].tenants_inactive = false;
    expect(run(f).refusals.map((x) => x.rule)).toContain("active_synthetic_tenant");
  });

  it("cross-tenant access on any axis is REFUSED", () => {
    const f = clone(goodFiles(RUN));
    f["isolation-proof.json"].axes.document = true;
    expect(run(f).refusals.map((x) => x.rule)).toContain("cross_tenant");
  });

  it("a double external effect (provider called more than once) is REFUSED", () => {
    const f = clone(goodFiles(RUN));
    f["resilience-proof.json"].retry_backoff_deadletter.external_calls = 3;
    expect(run(f).refusals.map((x) => x.rule)).toContain("double_external_effect");
  });

  it("two emails for one communication is REFUSED as a double effect", () => {
    const f = clone(goodFiles(RUN));
    f["communication-proof.json"].emails_sent = 2;
    expect(run(f).refusals.map((x) => x.rule)).toContain("double_external_effect");
  });

  it("a permanent worker/daemon anywhere in the bundle is REFUSED", () => {
    const f = clone(goodFiles(RUN));
    f["mission-proof.json"].permanent_process = true;
    expect(run(f).refusals.map((x) => x.rule)).toContain("permanent_process");
  });

  it("a simulated/fabricated status flag anywhere is REFUSED", () => {
    const f = clone(goodFiles(RUN));
    f["signature-proof.json"].fabricated = true;
    expect(run(f).refusals.map((x) => x.rule)).toContain("invented_status");
  });

  it("a pending human Yousign action yields PROOF_REQUIRED, never green and never a false refusal", () => {
    const f = clone(goodFiles(RUN));
    f["signature-proof.json"].activated = false;
    f["signature-proof.json"].webhook_received = false;
    f["signature-proof.json"].canonicalized = false;
    f["signature-proof.json"].persisted_event_id = "";
    f["signature-proof.json"].human_action_required = true;
    const r = run(f);
    expect(r.verdict).toBe("PROOF_REQUIRED");
    expect(r.ok).toBe(false);
    expect(r.human_signature_action_required).toBe(true);
    expect(r.refusals).toHaveLength(0);
  });

  it("an incomplete mission (no mandatory validation / not resumed) is PROOF_REQUIRED, not VERIFIED", () => {
    const f = clone(goodFiles(RUN));
    f["mission-proof.json"].mandatory_validation = false;
    f["mission-proof.json"].blocked_before_approval = false;
    const r = run(f);
    expect(r.verdict).toBe("PROOF_REQUIRED");
    expect(r.ok).toBe(false);
  });
});

// A complete bundle whose embedded run_ids match a given (old) run id — used to prove the old-run refusal.
function goodFilesForRun(runId: string): Record<string, any> {
  return goodFiles(runId);
}

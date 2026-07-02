// src/lib/pierre/v1/controlled-live-journey-check.mjs
// PHASE 8.7.4 — STAGE 2 — dependency-injectable verifier for the CONTROLLED LIVE CUSTOMER JOURNEY.
//
// It validates ONE fresh run's proof bundle (the directory .p87-proofs/step4/final/<run_id>/) produced by
// scripts/p87-step4-controlled-journey.mjs --apply. It NEVER turns a provider API call into a "delivered",
// NEVER accepts a raw document in place of the documentary engine, NEVER goes green off the old governed-core
// pass, and NEVER accepts a wildcard cleanup / disabled trigger / service-role worker / still-active synthetic
// tenant / cross-tenant access / duplicated external effect / permanent process. It reads only the persisted
// proofs (injected via loadBundle) so tests exercise every branch without a DB or a real provider account.
//
// Verdicts:
//   VERIFIED        every one of the 24 journey requirements is proven for a single fresh run_id, no refusal.
//   REFUSED         a present proof violates an absolute rule (old run / fabricated / wildcard / cross-tenant …).
//   PROOF_REQUIRED  no fresh bundle, a required proof is missing, or a real proof is still pending (e.g. a
//                   provider webhook not yet received, or a human Yousign action outstanding).
// ok === (verdict === "VERIFIED"). The CLI exits non-zero on anything but VERIFIED in --strict.

// The governed-core pass (P8.7.4 STAGE 1) and any pre-stage run — these run_ids can NEVER satisfy STAGE 2.
export const KNOWN_OLD_RUN_IDS = ["ra530df80d72d"];

// The manifest scope STAGE 2 demands. The STAGE 1 governed-core manifest carries a different scope string and
// is therefore refused even if someone copies it under final/.
export const CANONICAL_SCOPE = "controlled-live-customer-journey";
export const GOVERNED_CORE_SCOPE_MARKER = "governed-core";

// The documentary engine marker — a raw byte write can never claim this.
export const DOC_ENGINE = "pierre-documentary-engine";

// Pierre's canonical subscription price (cents) + currency — must equal EXPECTED_PIERRE_PRICE_AMOUNT.
export const EXPECTED_PRICE_AMOUNT = 44900;
export const EXPECTED_CURRENCY = "eur";

// The exact set of proof files a complete STAGE 2 bundle must contain.
export const REQUIRED_PROOFS = [
  "run-manifest.json",
  "onboarding-proof.json",
  "employee-proof.json",
  "mission-proof.json",
  "document-proof.json",
  "storage-proof.json",
  "billing-proof.json",
  "communication-proof.json",
  "signature-proof.json",
  "resilience-proof.json",
  "isolation-proof.json",
  "cleanup-proof.json",
  "final-report.json",
];

const isHex64 = (s) => typeof s === "string" && /^[a-f0-9]{64}$/i.test(s);
const isNonEmpty = (s) => typeof s === "string" && s.trim().length > 0;
const truthy = (v) => v === true;

// ── the 24 enumerated journey requirements, each mapped to a check over the bundle ──────────────
function buildSteps(f) {
  const m = f["run-manifest.json"] || {};
  const onb = f["onboarding-proof.json"] || {};
  const emp = f["employee-proof.json"] || {};
  const mis = f["mission-proof.json"] || {};
  const doc = f["document-proof.json"] || {};
  const sto = f["storage-proof.json"] || {};
  const bil = f["billing-proof.json"] || {};
  const com = f["communication-proof.json"] || {};
  const sig = f["signature-proof.json"] || {};
  const res = f["resilience-proof.json"] || {};
  const iso = f["isolation-proof.json"] || {};
  const cln = f["cleanup-proof.json"] || {};
  const fin = f["final-report.json"] || {};
  const e360 = emp.employee360 || {};
  const rdl = res.retry_backoff_deadletter || {};
  const axes = iso.axes || {};

  return [
    { key: "1_onboarding_canonical", ok: truthy(onb.canonical) && isNonEmpty(onb.via_service) && truthy(onb.session_completed), detail: `onboarding via ${onb.via_service || "?"} session_completed=${onb.session_completed}` },
    { key: "2_employee_360_canonical", ok: truthy(emp.canonical) && truthy(e360.has_employee) && isNonEmpty(emp.employee_id), detail: `employee ${emp.employee_id ? "ok" : "missing"} 360 events=${e360.events ?? "?"} docs=${e360.documents ?? "?"}` },
    { key: "3_mission_tasks_deps_validation", ok: (mis.tasks | 0) >= 2 && (mis.dependencies | 0) >= 1 && truthy(mis.mandatory_validation), detail: `tasks=${mis.tasks} deps=${mis.dependencies} mandatory_validation=${mis.mandatory_validation}` },
    { key: "4_execution_blocked_before_approval", ok: truthy(mis.blocked_before_approval), detail: `blocked_before_approval=${mis.blocked_before_approval}` },
    { key: "5_approval_persisted_by_service", ok: isNonEmpty(mis.approval_persisted_by), detail: `approval_persisted_by=${mis.approval_persisted_by || "none"}` },
    { key: "6_execution_resumed_completed", ok: truthy(mis.resumed_after_approval) && mis.run_status === "completed", detail: `resumed=${mis.resumed_after_approval} run_status=${mis.run_status}` },
    { key: "7_document_via_engine", ok: doc.engine === DOC_ENGINE && Array.isArray(doc.renderers) && doc.renderers.some((r) => r === "pdf" || r === "docx") && isHex64(doc.content_hash) && doc.raw_write !== true, detail: `engine=${doc.engine} renderers=${(doc.renderers || []).join("+")} hash=${isHex64(doc.content_hash)}` },
    { key: "8_document_version_file_links_persisted", ok: truthy(doc.persisted) && isNonEmpty(doc.document_id) && isNonEmpty(doc.version_id) && hasLinks(doc.links), detail: `persisted=${doc.persisted} links=${(doc.links || []).join(",")}` },
    { key: "9_private_storage_signed_hash", ok: truthy(sto.uploaded) && truthy(sto.public_refused) && truthy(sto.signed_url) && truthy(sto.hash_match) && sto.private !== false, detail: `uploaded=${sto.uploaded} public_refused=${sto.public_refused} signed=${sto.signed_url} hash=${sto.hash_match}` },
    { key: "10_stripe_test_subscription_449", ok: truthy(bil.provider_call) && bil.mode === "test" && bil.price_amount === EXPECTED_PRICE_AMOUNT && bil.currency === EXPECTED_CURRENCY && isNonEmpty(bil.subscription_id), detail: `mode=${bil.mode} price=${bil.price_amount} ${bil.currency} sub=${bil.subscription_id ? "ok" : "none"}` },
    { key: "11_stripe_signed_webhook_received", ok: truthy(bil.webhook_received) && truthy(bil.webhook_signature_valid) && isNonEmpty(bil.persisted_event_id), detail: `webhook=${bil.webhook_received} sig=${bil.webhook_signature_valid} persisted=${bil.persisted_event_id ? "ok" : "none"}` },
    { key: "12_commercial_event_entitlement_active", ok: typeof bil.commercial_event_status === "string" && bil.commercial_event_status.startsWith("applied") && bil.entitlement_status === "active", detail: `commercial=${bil.commercial_event_status} entitlement=${bil.entitlement_status}` },
    { key: "13_communication_via_pipeline", ok: truthy(com.created_by_pipeline) && isNonEmpty(com.intent_id), detail: `created_by_pipeline=${com.created_by_pipeline} intent=${com.intent_id ? "ok" : "none"}` },
    { key: "14_exactly_one_resend_email", ok: com.emails_sent === 1, detail: `emails_sent=${com.emails_sent}` },
    { key: "15_resend_webhook_signed_status_persisted", ok: truthy(com.webhook_received) && truthy(com.webhook_signature_valid) && isNonEmpty(com.persisted_provider_event_id) && isNonEmpty(com.delivery_status), detail: `webhook=${com.webhook_received} sig=${com.webhook_signature_valid} status=${com.delivery_status}` },
    { key: "16_yousign_sandbox_request_via_pipeline", ok: truthy(sig.created_by_pipeline) && isNonEmpty(sig.provider_request_id) && sig.mode === "sandbox", detail: `created_by_pipeline=${sig.created_by_pipeline} request=${sig.provider_request_id ? "ok" : "none"} mode=${sig.mode}` },
    { key: "17_yousign_document_signer_activated", ok: truthy(sig.document_added) && truthy(sig.signer_added) && truthy(sig.activated), detail: `doc=${sig.document_added} signer=${sig.signer_added} activated=${sig.activated}` },
    { key: "18_yousign_activated_webhook_canonicalized", ok: truthy(sig.webhook_received) && sig.webhook_event === "signature_request.activated" && truthy(sig.webhook_signature_valid) && truthy(sig.canonicalized) && isNonEmpty(sig.persisted_event_id), detail: `webhook=${sig.webhook_received} event=${sig.webhook_event} sig=${sig.webhook_signature_valid} persisted=${sig.persisted_event_id ? "ok" : "none"}` },
    { key: "19_duplicate_webhook_idempotent", ok: truthy(res.duplicate_webhook_idempotent), detail: `duplicate_idempotent=${res.duplicate_webhook_idempotent}` },
    { key: "20_bad_signature_rejected_no_mutation", ok: truthy(res.bad_signature_rejected) && truthy(res.bad_signature_no_mutation), detail: `rejected=${res.bad_signature_rejected} no_mutation=${res.bad_signature_no_mutation}` },
    { key: "21_retry_backoff_deadletter_injected", ok: truthy(rdl.adapter_injected) && truthy(rdl.dead_lettered) && truthy(rdl.backoff_applied) && Number.isInteger(rdl.external_calls) && rdl.external_calls === rdl.expected_external_calls, detail: `adapter_injected=${rdl.adapter_injected} dead_lettered=${rdl.dead_lettered} external_calls=${rdl.external_calls}/${rdl.expected_external_calls}` },
    { key: "22_tenant_isolation_all_axes", ok: ["employee", "mission", "task", "document", "communication", "signature"].every((a) => axes[a] === false) && iso.cross_tenant_leak === false, detail: `axes=${JSON.stringify(axes)} leak=${iso.cross_tenant_leak}` },
    { key: "23_exact_run_cleanup", ok: cln.wildcard === false && cln.mode === "exact-ids" && cln.synthetic_tenants_active === 0 && truthy(cln.tenants_inactive) && truthy(cln.deploy_block_untouched) && cln.claimable_deliveries === 0 && cln.yousign_open_after !== true, detail: `wildcard=${cln.wildcard} mode=${cln.mode} active=${cln.synthetic_tenants_active} inactive=${cln.tenants_inactive} claimable_deliveries=${cln.claimable_deliveries} yousign_open=${cln.yousign_open_after}` },
    { key: "24_final_report_present", ok: fin.phase === "P8.7.4" && fin.scope === CANONICAL_SCOPE, detail: `phase=${fin.phase} scope=${fin.scope === CANONICAL_SCOPE ? "ok" : fin.scope}` },
  ];
}
function hasLinks(links) {
  if (!Array.isArray(links)) return false;
  return ["mission", "task", "employee"].every((t) => links.includes(t));
}

// ── absolute refusals — any one of these makes the verdict REFUSED, never VERIFIED ──────────────
function collectRefusals(runId, knownOld, f) {
  const refusals = [];
  const add = (rule, reason) => refusals.push({ rule, reason });
  const m = f["run-manifest.json"] || {};
  const onb = f["onboarding-proof.json"] || {};
  const doc = f["document-proof.json"] || {};
  const bil = f["billing-proof.json"] || {};
  const com = f["communication-proof.json"] || {};
  const sig = f["signature-proof.json"] || {};
  const res = f["resilience-proof.json"] || {};
  const iso = f["isolation-proof.json"] || {};
  const cln = f["cleanup-proof.json"] || {};
  const rdl = res.retry_backoff_deadletter || {};
  const axes = iso.axes || {};

  // 1) old run / wrong scope / dry-run masquerading as proof
  if (knownOld.includes(runId)) add("old_run", `run_id ${runId} is a known pre-STAGE-2 (governed-core) run`);
  if (typeof m.scope === "string" && m.scope.includes(GOVERNED_CORE_SCOPE_MARKER)) add("old_run", `run-manifest scope is governed-core, not the STAGE 2 controlled live journey`);
  if (Object.keys(m).length && m.scope !== CANONICAL_SCOPE) add("old_run", `run-manifest scope '${m.scope}' is not '${CANONICAL_SCOPE}'`);
  if (Object.keys(m).length && m.apply !== true) add("old_run", `run-manifest apply!==true — a dry run can never be a proof`);

  // 2) mixed run ids across the bundle
  for (const [name, obj] of Object.entries(f)) {
    if (obj && typeof obj === "object" && "run_id" in obj && obj.run_id !== runId) add("mixed_run_ids", `${name} carries run_id ${obj.run_id} != bundle ${runId}`);
  }

  // 3) provider call without a real webhook (the call alone is never proof)
  if (truthy(bil.provider_call) && !truthy(bil.webhook_received)) add("provider_call_without_webhook", "Stripe subscription created but no signed webhook received by the production route");
  if ((com.emails_sent | 0) >= 1 && !truthy(com.webhook_received)) add("provider_call_without_webhook", "email sent but no Resend webhook received by the production route");
  if (truthy(sig.activated) && !truthy(sig.webhook_received) && sig.human_action_required !== true) add("provider_call_without_webhook", "Yousign request activated but no activated webhook received by the production route");

  // 4) raw document instead of the documentary engine
  if (Object.keys(doc).length && (doc.engine !== DOC_ENGINE || doc.raw_write === true || !isHex64(doc.content_hash))) add("raw_document", `document not produced by ${DOC_ENGINE} (engine=${doc.engine}, raw_write=${doc.raw_write})`);

  // 5) direct onboarding presented as canonical
  if (Object.keys(onb).length && (!truthy(onb.canonical) || onb.direct_business_onboarding === true || !isNonEmpty(onb.via_service))) add("direct_onboarding_as_canonical", "onboarding not driven through the canonical service");

  // 6) invented delivered / activated (status without the webhook that produces it)
  if (com.delivery_status === "delivered" && !isNonEmpty(com.persisted_provider_event_id)) add("invented_status", "communication 'delivered' without a persisted provider webhook event");
  if (truthy(sig.activated) && sig.webhook_event === "signature_request.activated" && !isNonEmpty(sig.persisted_event_id) && sig.human_action_required !== true) add("invented_status", "signature 'activated' without a persisted canonical webhook event");
  if (bil.entitlement_status === "active" && !isNonEmpty(bil.persisted_event_id)) add("invented_status", "entitlement 'active' without a persisted commercial webhook event");

  // 7) cross-tenant access
  if (Object.keys(iso).length) {
    for (const a of ["employee", "mission", "task", "document", "communication", "signature"]) if (axes[a] === true) add("cross_tenant", `cross-tenant leak on axis '${a}'`);
    if (iso.cross_tenant_leak === true) add("cross_tenant", "cross_tenant_leak flag set");
  }

  // 8) double external effect (provider called more than once for one logical effect)
  if (Number.isInteger(rdl.external_calls) && Number.isInteger(rdl.expected_external_calls) && rdl.external_calls > rdl.expected_external_calls) add("double_external_effect", `external_calls ${rdl.external_calls} > expected ${rdl.expected_external_calls}`);
  if (com.emails_sent > 1) add("double_external_effect", `${com.emails_sent} emails sent for one communication`);

  // 9) cleanup violations: wildcard, disabled trigger, service-role worker, permanent process, still-active tenant
  if (Object.keys(cln).length) {
    if (cln.wildcard === true || cln.mode !== "exact-ids") add("wildcard_cleanup", "cleanup did not use the exact run ids");
    if (cln.triggers_disabled === true) add("trigger_disabled", "cleanup disabled an immutability trigger");
    if (cln.service_role === true) add("service_role_worker", "cleanup/worker used the service role for a governed op");
    if (cln.permanent_process === true) add("permanent_process", "a permanent worker/daemon was started");
    if ((cln.synthetic_tenants_active | 0) > 0 || cln.tenants_inactive !== true) add("active_synthetic_tenant", `synthetic tenant still active (active=${cln.synthetic_tenants_active}, inactive=${cln.tenants_inactive})`);
  }

  // 10) global forbidden flags anywhere in the bundle (defence in depth — flag can live on any file)
  for (const [name, obj] of Object.entries(f)) {
    if (!obj || typeof obj !== "object") continue;
    if (obj.service_role === true) add("service_role_worker", `${name} reports service_role=true`);
    if (obj.permanent_process === true || obj.daemon === true) add("permanent_process", `${name} reports a permanent process`);
    if (obj.simulated === true || obj.fabricated === true || obj.synthetic_status === true) add("invented_status", `${name} reports a simulated/fabricated status`);
    if (obj.triggers_disabled === true) add("trigger_disabled", `${name} reports triggers_disabled=true`);
    if (obj.wildcard === true) add("wildcard_cleanup", `${name} reports wildcard=true`);
  }

  // de-dup identical (rule,reason)
  const seen = new Set();
  return refusals.filter((r) => { const k = `${r.rule}|${r.reason}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

/**
 * Run the controlled-live-journey check over an injected proof bundle.
 * @param {{ loadBundle?: () => ({ run_id: string, files: Record<string, any>, present?: string[], missing?: string[] }|null), knownOldRunIds?: string[], now?: string|null }} deps
 */
export function runControlledLiveJourneyCheck(deps = {}) {
  const loadBundle = deps.loadBundle || (() => null);
  const knownOld = deps.knownOldRunIds || KNOWN_OLD_RUN_IDS;
  const generated_at = deps.now || new Date().toISOString();
  const base = { phase: "P8.7.4", stage: "STAGE 2 — controlled live customer journey", generated_at };

  let bundle = null;
  try { bundle = loadBundle(); } catch (e) { bundle = null; base.load_error = String(e && e.message ? e.message : e).slice(0, 200); }

  if (!bundle || !bundle.run_id) {
    return { ...base, run_id: null, verdict: "PROOF_REQUIRED", ok: false, steps: [], refusals: [], missing: REQUIRED_PROOFS.slice(), human_signature_action_required: false, summary: "no fresh .p87-proofs/step4/final/<run_id> bundle — run the journey with --apply" };
  }

  const f = bundle.files || {};
  const present = bundle.present || Object.keys(f);
  const missing = bundle.missing || REQUIRED_PROOFS.filter((n) => !(n in f) || f[n] == null);
  const refusals = collectRefusals(bundle.run_id, knownOld, f);

  // missing proofs → PROOF_REQUIRED (still a hard non-zero); but refusals on present data win as REFUSED.
  if (missing.length && refusals.length === 0) {
    return { ...base, run_id: bundle.run_id, verdict: "PROOF_REQUIRED", ok: false, steps: [], refusals: [], missing, human_signature_action_required: false, summary: `bundle ${bundle.run_id} incomplete — missing ${missing.length} proof(s): ${missing.join(", ")}` };
  }

  const steps = missing.length ? [] : buildSteps(f);
  const failed = steps.filter((s) => !s.ok);
  const sig = f["signature-proof.json"] || {};
  const humanSig = sig.human_action_required === true && !truthy(sig.webhook_received);

  let verdict, summary;
  if (refusals.length) {
    verdict = "REFUSED";
    summary = `bundle ${bundle.run_id} REFUSED: ${refusals.map((r) => r.rule).join(", ")}`;
  } else if (missing.length) {
    verdict = "PROOF_REQUIRED";
    summary = `bundle ${bundle.run_id} incomplete — missing ${missing.join(", ")}`;
  } else if (failed.length === 0) {
    verdict = "VERIFIED";
    summary = `bundle ${bundle.run_id} VERIFIED — all 24 controlled-live-journey requirements proven`;
  } else {
    verdict = "PROOF_REQUIRED";
    summary = humanSig
      ? `bundle ${bundle.run_id} pending — Yousign signature_request.activated still requires the human action`
      : `bundle ${bundle.run_id} incomplete — ${failed.length} requirement(s) not yet proven: ${failed.map((s) => s.key).join(", ")}`;
  }

  return { ...base, run_id: bundle.run_id, verdict, ok: verdict === "VERIFIED", steps, refusals, missing, human_signature_action_required: humanSig && verdict !== "REFUSED", summary };
}

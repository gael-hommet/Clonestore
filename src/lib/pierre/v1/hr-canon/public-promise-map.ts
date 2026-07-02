// src/lib/pierre/v1/hr-canon/public-promise-map.ts
// PHASE 8.10 — maps the PUBLIC product promises (what customers are told Pierre does, from the
// catalog + /demo surface) to canonical capability ids, and computes the honest backing of each
// promise from those capabilities' statuses. Invariant: no public "Pierre can do X" may be
// "fully_backed" unless every linked capability is VERIFIED_EXISTING. This is what stops the
// product from promising something not testably real.

import { getCapability } from "./capability-registry";

export type PromiseBacking = "fully_backed" | "partially_backed" | "aspirational";
export type PublicPromise = {
  id: string;
  statement: string;          // the public-facing claim
  source: string;             // where it is made (catalog/demo)
  capabilityIds: string[];    // canonical capabilities that must back it
};

// Curated from src/lib/catalog/public-catalog.ts + /demo/pierre + /agents/pierre surface.
export const PUBLIC_PROMISES: readonly PublicPromise[] = [
  { id: "promise.structure_missions", statement: "Pierre structures HR requests into governed missions & tasks.", source: "/demo/pierre, catalog", capabilityIds: ["pierre_admin.mission_orchestration", "pierre_admin.durable_queue"] },
  { id: "promise.produce_documents", statement: "Pierre prepares real HR documents (contracts, letters) as PDF/DOCX.", source: "/demo/pierre", capabilityIds: ["contract.generate_artifacts", "offer.render_offer_premium"] },
  { id: "promise.contracts", statement: "Pierre prepares and manages employment contracts.", source: "catalog", capabilityIds: ["contract.create", "contract.approve", "contract.finalize", "contract.template_manage"] },
  { id: "promise.signatures", statement: "Pierre routes contracts to e-signature and finalizes with legal evidence.", source: "catalog", capabilityIds: ["contract.prepare_signature", "contract.submit_signature", "contract.finalize_signed"] },
  { id: "promise.employee_file", statement: "Pierre maintains a complete Employee 360 file.", source: "catalog, /demo", capabilityIds: ["employee360.create", "employee360.view_360", "employee360.completeness"] },
  { id: "promise.communications", statement: "Pierre sends governed HR communications with proof of send.", source: "/demo, catalog", capabilityIds: ["communications.send_email", "communications.send_in_app", "communications.audit_lifecycle"] },
  { id: "promise.validation_traceability", statement: "Every sensitive action is validated and fully traceable.", source: "/demo", capabilityIds: ["pierre_admin.approval_workflow", "pierre_admin.audit_trail", "pierre_admin.cloneguard"] },
  { id: "promise.onboarding", statement: "Pierre runs a server-authoritative onboarding.", source: "catalog", capabilityIds: ["onboarding.complete_step", "onboarding.complete_session", "onboarding.registry_steps"] },
  { id: "promise.gdpr", statement: "Pierre honours GDPR: export, rectify, anonymize, purge, legal hold.", source: "catalog", capabilityIds: ["data_gdpr.export_employee", "data_gdpr.anonymize", "data_gdpr.purge", "data_gdpr.legal_hold"] },
  { id: "promise.proactive", statement: "Pierre proactively watches deadlines and acts.", source: "/demo, catalog", capabilityIds: ["proactive.scheduler", "proactive.followup"] },
  { id: "promise.autonomy_governed", statement: "Pierre acts autonomously within governed, configurable limits.", source: "catalog", capabilityIds: ["pierre_admin.autonomy_config", "pierre_admin.action_registry"] },
  { id: "promise.multi_tenant_isolation", statement: "Each company's data is strictly isolated.", source: "catalog", capabilityIds: ["org.read_company", "pierre_admin.permission_enforcement"] },
  // Promises for capabilities NOT yet real — must resolve as aspirational until P8.11/P8.12.
  { id: "promise.absences", statement: "Pierre manages absences and leave end-to-end.", source: "catalog (forward-looking)", capabilityIds: ["absence.create_request", "absence.approval_workflow", "absence.balance_calculation"] },
  { id: "promise.payroll_prep", statement: "Pierre prepares payroll variables for your provider.", source: "catalog (forward-looking)", capabilityIds: ["payroll.collect_variables", "payroll.validation", "payroll.export_transmission"] },
  { id: "promise.performance", statement: "Pierre runs performance reviews.", source: "catalog (forward-looking)", capabilityIds: ["performance.objectives", "performance.annual_review"] },
];

export type PromiseTraceability = PublicPromise & {
  backing: PromiseBacking;
  verifiedCount: number;
  missingCapabilityIds: string[]; // linked ids not found in the registry (must be empty)
  statuses: Record<string, string>;
};

export function tracePromise(p: PublicPromise): PromiseTraceability {
  const statuses: Record<string, string> = {};
  const missingCapabilityIds: string[] = [];
  let verifiedCount = 0;
  for (const id of p.capabilityIds) {
    const cap = getCapability(id);
    if (!cap) { missingCapabilityIds.push(id); continue; }
    statuses[id] = cap.implementation;
    if (cap.implementation === "VERIFIED_EXISTING") verifiedCount++;
  }
  const n = p.capabilityIds.length;
  const backing: PromiseBacking = verifiedCount === n ? "fully_backed" : verifiedCount > 0 ? "partially_backed" : "aspirational";
  return { ...p, backing, verifiedCount, missingCapabilityIds, statuses };
}

export const PROMISE_TRACEABILITY: readonly PromiseTraceability[] = PUBLIC_PROMISES.map(tracePromise);

/** Promises that reference a non-existent capability id — MUST be empty (dangling promise). */
export function danglingPromises(): PromiseTraceability[] {
  return PROMISE_TRACEABILITY.filter((p) => p.missingCapabilityIds.length > 0);
}

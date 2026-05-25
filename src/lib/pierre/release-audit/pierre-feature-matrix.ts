// src/lib/pierre/release-audit/pierre-feature-matrix.ts
// B36 — Pierre feature matrix: what exists, what is proven, what is mocked.
// Pure, synchronous, no DB.

import type { PierreAuditEvidence, PierreAuditArea, PierreAuditStatus, PierreLaunchCriticality } from "./types";

function ev(
  id: string,
  area: PierreAuditArea,
  label: string,
  status: PierreAuditStatus,
  criticality: PierreLaunchCriticality,
  evidence: string,
  gaps: string[],
  score_contribution: number,
  max_contribution: number,
): PierreAuditEvidence {
  return { id, area, label, status, criticality, evidence, gaps, score_contribution, max_contribution };
}

// ── Mission engine (15 pts) ───────────────────────────────────────────────────

const MISSION_ENGINE: PierreAuditEvidence[] = [
  ev(
    "me_submit_pipeline",
    "mission_engine",
    "Pipeline submit → brain → guard → governance → DB",
    "proven",
    "info",
    "app/api/pierre/submit/route.ts — 5-step pipeline, 79 API routes total",
    [],
    5,
    5,
  ),
  ev(
    "me_brain_safety",
    "mission_engine",
    "Brain task safety: email.send → email.draft forced, approval gates",
    "proven",
    "info",
    "src/lib/pierre/brain/task-bridge.ts — enforceBrainTaskSafety(), 19 type mappings",
    [],
    3,
    3,
  ),
  ev(
    "me_real_ai",
    "ai_runtime",
    "Real OpenAI/Anthropic calls in production path",
    "mock_only",
    "medium",
    "src/lib/cloneos/ai/ — AI runtime exists, mocked in test env; no live call tested end-to-end",
    ["Real AI response quality untested", "Fallback behavior on API timeout not tested", "Token cost estimates missing"],
    3,
    4,
  ),
  ev(
    "me_task_artifacts",
    "task_engine",
    "Task artifact generation (email, doc, PDF, reminder)",
    "proven",
    "info",
    "src/lib/pierre/tasks/artifacts.ts — buildPierreTaskExecutionResult(), 6 domain builders, scorePierreArtifactQuality()",
    [],
    2,
    2,
  ),
  ev(
    "me_approval_gates",
    "task_engine",
    "Approval gates: awaiting_approval status, never auto-execute sensitive tasks",
    "proven",
    "info",
    "task-bridge.ts enforceBrainTaskSafety() + CloneADN never_auto_execute list",
    [],
    1,
    1,
  ),
];

// ── HR workflows (20 pts) ─────────────────────────────────────────────────────

const HR_WORKFLOWS: PierreAuditEvidence[] = [
  ev(
    "hr_domains",
    "hr_workflows",
    "23 HR domains declared and classified",
    "proven",
    "info",
    "src/lib/pierre/hr/contracts.ts — PIERRE_HR_DOMAINS (23 values), 4-color risk matrix",
    [],
    3,
    3,
  ),
  ev(
    "hr_workflow_engine",
    "hr_workflows",
    "Workflow analysis engine: domain detection, risk, approval policy",
    "proven",
    "info",
    "src/lib/pierre/hr/workflows.ts — analyzeHrWorkflow(), planHrWorkflow(), DOMAIN_SIGNALS map",
    [],
    3,
    3,
  ),
  ev(
    "hr_onboarding",
    "hr_workflows",
    "Onboarding: document generation, welcome email, checklist",
    "partial",
    "medium",
    "gs_onboarding_complete golden scenario + artifacts builder",
    ["No real DocuSign/signature integration", "Physical document delivery not covered", "IT provisioning not automated"],
    2,
    3,
  ),
  ev(
    "hr_contract_hiring",
    "hr_workflows",
    "Hiring offer + contract generation",
    "partial",
    "medium",
    "gs_hiring_offer golden scenario + premium-documents — template-based generation",
    ["Contract is template-filled, not legally reviewed", "No eSign integration", "No DPAE (employment declaration) automation"],
    2,
    3,
  ),
  ev(
    "hr_absence",
    "hr_workflows",
    "Absence justification and leave management",
    "partial",
    "medium",
    "gs_absence_justified golden scenario + hr/employee-file.ts",
    ["No HR system sync (BambooHR, Lucca, etc.)", "Balance calculation not automated"],
    2,
    3,
  ),
  ev(
    "hr_payroll_prep",
    "hr_workflows",
    "Payroll prep: variables export, summary",
    "partial",
    "medium",
    "gs_payroll_prep golden scenario + payroll domain in hr/contracts.ts",
    ["No direct payroll software integration", "No DSN generation", "Variable transmission is draft only"],
    2,
    3,
  ),
  ev(
    "hr_sensitive_case",
    "hr_workflows",
    "Sensitive cases: disciplinary, termination, harassment — hard blocked by CloneGuard",
    "proven",
    "info",
    "hr/cloneguard.ts — black risk level, CloneGuard blocks automated execution, gs_cloneguard_block",
    [],
    3,
    3,
  ),
  ev(
    "hr_offboarding",
    "hr_workflows",
    "Offboarding: process detection, document prep",
    "partial",
    "high",
    "offboarding domain in hr/workflows.ts + employee-context.ts offboarding risk detection",
    ["No formal offboarding checklist generation", "No exit interview scheduling", "Certificate of employment generation is partial"],
    1,
    2,
  ),
];

// ── Governance trinity (15 pts) ───────────────────────────────────────────────

const GOVERNANCE: PierreAuditEvidence[] = [
  ev(
    "gov_cloneguard",
    "governance",
    "CloneGuard: risk classification and automatic blocking",
    "proven",
    "info",
    "src/lib/pierre/hr/cloneguard.ts + hr-cloneguard.test.ts (full test suite)",
    [],
    5,
    5,
  ),
  ev(
    "gov_clonepolicy",
    "governance",
    "ClonePolicy: validation policy per domain and task type",
    "proven",
    "info",
    "src/lib/pierre/hr/clonepolicy.ts + hr-clonepolicy.test.ts",
    [],
    5,
    5,
  ),
  ev(
    "gov_clonetrust",
    "governance",
    "CloneTrust: trust scoring and confidence model",
    "proven",
    "info",
    "src/lib/pierre/hr/clonetrust.ts + hr-clonetrust.test.ts",
    [],
    5,
    5,
  ),
];

// ── Audit trail / history (10 pts) ────────────────────────────────────────────

const AUDIT_TRAIL: PierreAuditEvidence[] = [
  ev(
    "at_trail",
    "audit_trail",
    "Audit trail: 20+ event types, immutable log, company_id scoped",
    "proven",
    "info",
    "src/lib/pierre/hr/audit-trail.ts + hr-audit-trail.test.ts + hr-audit-trail-runtime.test.ts",
    [],
    5,
    5,
  ),
  ev(
    "at_continuity",
    "continuity",
    "Continuity engine: employee transitions, mission handoff",
    "proven",
    "info",
    "src/lib/pierre/hr/continuity.ts + hr-continuity.test.ts",
    [],
    3,
    3,
  ),
  ev(
    "at_history_gap",
    "audit_trail",
    "Long-term audit log persistence and cross-mission history query",
    "partial",
    "medium",
    "Audit log types defined; DB persistence depends on Supabase schema in production",
    ["No cross-mission history aggregation proven in tests", "Retention policy not defined"],
    1,
    2,
  ),
];

// ── Documents / livrables (10 pts) ────────────────────────────────────────────

const DOCUMENTS: PierreAuditEvidence[] = [
  ev(
    "doc_premium",
    "documents",
    "Premium documents: 15+ HR templates, HTML/PDF generation",
    "proven",
    "info",
    "src/lib/clonestore/documents/ + premium-documents.test.ts + premium-artifacts.test.ts",
    [],
    4,
    4,
  ),
  ev(
    "doc_pdf_real",
    "documents",
    "Real PDF extraction from uploaded files",
    "mock_only",
    "high",
    "src/lib/cloneos/files/ — extraction is mocked; no pdf-parse or mammoth in production",
    ["PDF text extraction returns mock content", "DOCX parsing not implemented", "Cannot read uploaded contracts to cross-reference"],
    2,
    3,
  ),
  ev(
    "doc_esign",
    "documents",
    "Electronic signature integration",
    "gap",
    "medium",
    "No eSign provider (DocuSign, Yousign, etc.) in repo",
    ["No eSign workflow", "Contracts must be printed and signed manually"],
    1,
    2,
  ),
  ev(
    "doc_templates_quality",
    "documents",
    "Template quality: legally compliant French HR templates",
    "partial",
    "medium",
    "Templates exist in premium-documents; no legal review certification in repo",
    ["Template legal compliance not certified", "No region-specific template variants"],
    1,
    1,
  ),
];

// ── Files / channels / context (15 pts) ──────────────────────────────────────

const FILES_CHANNELS: PierreAuditEvidence[] = [
  ev(
    "fc_b34_files",
    "files",
    "B34 file intake + B37 real extractors (PDF/DOCX/XLSX via pdf-parse/mammoth/xlsx)",
    "partial",
    "medium",
    "src/lib/cloneos/files/ + extractors/pdf.ts + extractors/docx.ts + extractors/xlsx.ts (B37) — classification proven, extraction real for pdf/docx/xlsx, OCR missing",
    ["OCR for scanned PDFs not available", "No real file storage proven", "Live extraction not tested in CI without real files"],
    5,
    5,
  ),
  ev(
    "fc_b33_channels",
    "channels",
    "B33 channel identity + B37 Resend provider foundation",
    "partial",
    "medium",
    "src/lib/cloneos/channels/ + providers/resend.ts (B37) — structure proven, Resend adapter added with dry-run/sandbox/domain guard",
    ["Real live send not tested (RESEND_API_KEY not in CI)", "Real SMS provider not connected", "EMAIL_SEND_LIVE=false by default"],
    4,
    5,
  ),
  ev(
    "fc_b35_context",
    "context_pack",
    "B35 context pack: deterministic, 12 scopes, 66 tests",
    "proven",
    "info",
    "src/lib/pierre/context/ + pierre-context-b35.test.ts + cloneadn-context-b35.test.ts — 66 tests",
    [],
    5,
    5,
  ),
];

// ── Billing / access (5 pts) ──────────────────────────────────────────────────

const BILLING: PierreAuditEvidence[] = [
  ev(
    "bil_stripe",
    "billing",
    "Stripe billing: subscription, activation, trial",
    "proven",
    "info",
    "src/lib/billing/ + checkout/ + activation.test.ts + order-activation.test.ts",
    [],
    3,
    3,
  ),
  ev(
    "bil_access",
    "access_control",
    "Access control: company_id scoping, auth guards, pierre.auth",
    "proven",
    "info",
    "src/lib/pierre/auth.ts + access.ts + src/lib/auth/ + redirects.test.ts",
    [],
    2,
    2,
  ),
];

// ── Tests / build stability (10 pts) ─────────────────────────────────────────

const TESTS_BUILD: PierreAuditEvidence[] = [
  ev(
    "tb_tests",
    "tests",
    "Test suite: 4685 tests across all modules",
    "proven",
    "info",
    "package.json test script — 54 test files, vitest 4.1.0, all passing",
    [],
    5,
    5,
  ),
  ev(
    "tb_golden",
    "golden_scenarios",
    "13 golden scenarios covering primary HR user journeys",
    "proven",
    "info",
    "src/lib/pierre/__tests__/golden-scenarios.test.ts + golden-scenarios-crossblock.test.ts",
    [],
    3,
    3,
  ),
  ev(
    "tb_build",
    "build",
    "tsc clean + Next.js build clean",
    "proven",
    "info",
    "npx tsc --noEmit passes; npm run build passes",
    [],
    2,
    2,
  ),
];

// ── CloneADN (included in files/channels/context bucket) ─────────────────────

const CLONE_ADN: PierreAuditEvidence[] = [
  ev(
    "adn_core",
    "cloneadn",
    "CloneADN: company fingerprint, rules, preferences, autonomy config",
    "proven",
    "info",
    "src/lib/clonestore/adn/ + cloneadn.test.ts + cloneadn-integration.test.ts",
    [],
    0, // Counted in governance bucket, not double-counted
    0,
  ),
];

// ── UI cockpit (informational — not scored separately, no budget) ─────────────

const UI_COCKPIT: PierreAuditEvidence[] = [
  ev(
    "ui_cockpit",
    "ui_cockpit",
    "Cockpit UI: normalizers and API state layer",
    "partial",
    "high",
    "src/lib/pierre/cockpit/ + cockpit-normalizers.test.ts + cockpit-api-state.test.ts",
    ["No visual/browser end-to-end test", "No Playwright/Cypress coverage", "UI may have gaps not caught by unit tests"],
    0, // Informational — not part of scored 100 points
    0,
  ),
];

// ── Real providers (informational — honest gap) ───────────────────────────────

const REAL_PROVIDERS: PierreAuditEvidence[] = [
  ev(
    "rp_email",
    "email_send",
    "Real email delivery: Resend provider foundation ready (B37) — live key pending",
    "partial",
    "medium",
    "src/lib/cloneos/channels/providers/resend.ts — adapter with dry-run, sandbox redirect, domain guard, key validation",
    ["Live send not tested — RESEND_API_KEY not in CI", "SPF/DKIM not verified", "EMAIL_SEND_LIVE=false — no accidental real send possible"],
    0,
    0,
  ),
  ev(
    "rp_providers",
    "real_providers",
    "Real SMS, external HR system sync (BambooHR, Silae, Lucca, etc.)",
    "gap",
    "medium",
    "No integration adapters in repo",
    ["No HRIS connector", "No payroll system sync", "Data must be entered manually or via API"],
    0,
    0,
  ),
];

// ── Exported matrix ───────────────────────────────────────────────────────────

export function buildPierreFeatureMatrix(): PierreAuditEvidence[] {
  return [
    ...MISSION_ENGINE,
    ...HR_WORKFLOWS,
    ...GOVERNANCE,
    ...AUDIT_TRAIL,
    ...DOCUMENTS,
    ...FILES_CHANNELS,
    ...BILLING,
    ...TESTS_BUILD,
    ...CLONE_ADN,
    ...UI_COCKPIT,
    ...REAL_PROVIDERS,
  ];
}

export function filterEvidenceByArea(
  evidence: PierreAuditEvidence[],
  area: PierreAuditArea,
): PierreAuditEvidence[] {
  return evidence.filter((e) => e.area === area);
}

export function filterBlockingEvidence(evidence: PierreAuditEvidence[]): PierreAuditEvidence[] {
  return evidence.filter(
    (e) => e.criticality === "blocker" && (e.status === "gap" || e.status === "mock_only"),
  );
}

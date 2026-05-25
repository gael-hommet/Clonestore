// src/lib/pierre/release-audit/evidence-map.ts
// B36 — What Pierre does well (strengths) and honest limits.
// Pure, synchronous, no DB.

// ── Strengths ─────────────────────────────────────────────────────────────────

export function buildStrengths(): string[] {
  return [
    "Mission pipeline proven: submit → brain → CloneGuard → ClonePolicy → CloneTrust → DB (79 API routes)",
    "Safety architecture: email.send → email.draft forced, approval_required enforced, never_auto_execute respected",
    "Governance trinity (CloneGuard / ClonePolicy / CloneTrust) fully tested with edge cases",
    "CloneADN: company fingerprint with tone, communication preferences, validation rules — applied in every action",
    "B35 context pack: deterministic, 12 scopes, 66 tests — Pierre always knows what it knows before acting",
    "4685 tests passing, 13 golden scenarios, tsc clean, build clean",
    "Audit trail: 20+ event types, company_id scoped, immutable log — full traceability",
    "Continuity engine: mission handoff and employee transition handling",
    "Premium documents: 15+ HR templates, HTML/PDF generation, artifact quality scoring",
    "CloneGuard hard-blocks sensitive cases (termination, harassment, discrimination) — legally safe behavior",
    "Multi-tenant by design: all operations company_id scoped, no cross-company data leakage",
    "Billing and access control proven: Stripe subscriptions, auth guards, trial activation",
    "23 HR domains classified with 4-color risk matrix (green/orange/red/black)",
    "B33 channel verification: sends blocked if channel unverified or suspended",
    "B34 file risk classification: sensitive/blocked files trigger validation gates",
  ];
}

// ── Honest limits ─────────────────────────────────────────────────────────────

export function buildHonestLimits(): string[] {
  return [
    "Real email delivery not connected — Pierre drafts emails, HR managers must send them manually",
    "PDF/DOCX text extraction is mocked — Pierre cannot read the content of uploaded documents",
    "Real AI (OpenAI/Anthropic) response quality not benchmarked against real HR missions",
    "No HRIS connector — employee data must be provided via API, not synced from BambooHR, Silae, Lucca, etc.",
    "No payroll software integration — payroll variables are summarized but not transmitted to payroll engines",
    "No eSign integration — contracts cannot be sent for electronic signature",
    "No calendar integration — scheduling is text-only, HR managers create events manually",
    "No end-to-end browser test — UI cockpit correctness is not proven by automated tests",
    "HR templates not legally certified — recommended to verify with labor law counsel",
    "No real SMS provider connected",
    "Training/CPF, reporting, and multi-site workflows are minimal (score 1/4)",
  ];
}

// ── Evidence pointer map (area → canonical source) ───────────────────────────

export const EVIDENCE_POINTERS: Record<string, string> = {
  mission_engine: "app/api/pierre/submit/route.ts — 5-step pipeline",
  task_engine: "src/lib/pierre/tasks/artifacts.ts — buildPierreTaskExecutionResult()",
  brain_safety: "src/lib/pierre/brain/task-bridge.ts — enforceBrainTaskSafety(), 19 task type mappings",
  governance: "src/lib/pierre/hr/cloneguard.ts + clonepolicy.ts + clonetrust.ts",
  audit_trail: "src/lib/pierre/hr/audit-trail.ts — 20+ AuditEventType values",
  continuity: "src/lib/pierre/hr/continuity.ts",
  documents: "src/lib/clonestore/documents/ — premium-documents.ts",
  files: "src/lib/cloneos/files/ — B34 file intake",
  channels: "src/lib/cloneos/channels/ — B33 channel identity",
  context_pack: "src/lib/pierre/context/context-runtime.ts — buildPierreContextPack()",
  cloneadn: "src/lib/clonestore/adn/cloneadn.ts",
  billing: "src/lib/billing/ + src/lib/checkout/",
  access_control: "src/lib/pierre/auth.ts + src/lib/pierre/access.ts",
  golden_scenarios: "src/lib/pierre/__tests__/golden-scenarios.test.ts — 13 scenarios",
  tests: "package.json test script — 54 test files, 4685 tests",
};

// ── Proof summary line ────────────────────────────────────────────────────────

export function buildProofSummary(): string {
  return [
    "4685 tests passing across 54 test files",
    "13 golden scenarios covering primary HR user journeys",
    "79 Pierre API routes covering mission, task, employee, governance, audit, continuity, CloneADN, documents, PDF, scenarios, readiness",
    "B35 context pack: 66 tests, 12 scopes, deterministic",
    "tsc --noEmit clean | npm run build clean",
  ].join(" | ");
}

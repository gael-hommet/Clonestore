// src/lib/pierre/release-candidate/types.ts
// Pierre Release Candidate — Pure types.
// No Supabase, no Next, no async, no side effects.

export type PierreReleaseCandidateStatus =
  | "ready"
  | "almost_ready"
  | "blocked"
  | "failed";

export type PierreReleaseCandidateSeverity =
  | "info"
  | "warning"
  | "error"
  | "critical";

export type PierreReleaseCandidateArea =
  | "schema"
  | "security"
  | "ai_runtime"
  | "brain"
  | "cloneadn"
  | "documents"
  | "employee_file"
  | "continuity"
  | "trial"
  | "customer_success"
  | "readiness"
  | "release_proof"
  | "golden_scenarios"
  | "routes"
  | "tests"
  | "docs"
  | "scripts"
  | "build"
  | "product";

export type PierreReleaseCandidateCheck = {
  id: string;
  area: PierreReleaseCandidateArea;
  label: string;
  status: "pass" | "warning" | "fail";
  severity: PierreReleaseCandidateSeverity;
  expected: string;
  actual: string;
  recommendation: string | null;
};

export type PierreReleaseCandidateModuleSummary = {
  area: PierreReleaseCandidateArea;
  score: number;
  status: PierreReleaseCandidateStatus;
  passed: number;
  warnings: number;
  failed: number;
  critical: number;
};

export type PierreReleaseCandidateReport = {
  generated_at: string;
  version: string;
  status: PierreReleaseCandidateStatus;
  score: number;
  modules: PierreReleaseCandidateModuleSummary[];
  checks: PierreReleaseCandidateCheck[];
  blocking_issues: PierreReleaseCandidateCheck[];
  warnings: PierreReleaseCandidateCheck[];
  strongest_proofs: string[];
  release_decision: {
    can_release_backend: boolean;
    can_start_cockpit: boolean;
    requires_hotfix: boolean;
    recommendation: string;
  };
};

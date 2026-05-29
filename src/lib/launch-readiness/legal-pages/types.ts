// P-FINAL 01 — Phase 2 — Legal pages validator types.
// Pure types only. No imports, no side effects.

export type LegalPageId = "cgu" | "cgv" | "dpa" | "mentions" | "confidentialite";

export type LegalPageStatus =
  | "present_draft"    // page exists, draft banner present, not yet validated
  | "present_validated" // page exists, manually validated by legal counsel
  | "missing"          // page does not exist
  | "disabled";        // intentionally excluded (e.g. not applicable)

export type LegalPageCheckSeverity = "info" | "warning" | "blocking";

export interface LegalPageRequiredSection {
  id: string;
  label: string;
  description: string;
  required_for_public_launch: boolean;
}

export interface LegalPageDefinition {
  id: LegalPageId;
  title: string;
  path: string;
  description: string;
  required_for_public_launch: boolean;
  required_sections: LegalPageRequiredSection[];
  forbidden_claims: string[];
  required_disclaimers: string[];
}

export interface LegalPageCheck {
  id: string;
  page_id: LegalPageId;
  label: string;
  description: string;
  severity: LegalPageCheckSeverity;
  passes: boolean;
  is_manual: boolean;
  detail?: string;
}

export interface LegalPageReport {
  page_id: LegalPageId;
  title: string;
  path: string;
  status: LegalPageStatus;
  is_blocking_public_launch: boolean;
  checks: LegalPageCheck[];
  blocking_count: number;
  warning_count: number;
  passes_all_blocking: boolean;
}

export interface LegalPagesVerdict {
  all_required_pages_present: boolean;
  all_required_pages_validated: boolean;
  total_blocking_count: number;
  pages_present: LegalPageId[];
  pages_missing: LegalPageId[];
  pages_validated: LegalPageId[];
  pages_draft: LegalPageId[];
  reports: LegalPageReport[];
  is_public_launch_blocked: boolean;
  evaluated_at: string;
}

export interface ManualLegalPageFlags {
  cgu_validated: boolean;
  cgv_validated: boolean;
  dpa_validated: boolean;
  mentions_validated: boolean;
  confidentialite_validated: boolean;
}

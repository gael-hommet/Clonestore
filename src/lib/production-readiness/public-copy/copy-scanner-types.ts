// P-FINAL 01 — Phase 8 — Public copy scanner types.
// Pure types only. No imports, no side effects.

export type CopyContext =
  | "homepage"
  | "pricing"
  | "demo"
  | "legal_cgu"
  | "legal_cgv"
  | "legal_dpa"
  | "legal_mentions"
  | "legal_confidentialite"
  | "cockpit"
  | "email_template"
  | "generic";

export type CopyScanSeverity = "blocking" | "warning" | "info";

export interface CopyViolation {
  id: string;
  pattern: string;
  found_text: string;
  severity: CopyScanSeverity;
  explanation: string;
  suggested_fix: string;
}

export interface CopyWarning {
  id: string;
  message: string;
  detail?: string;
}

export interface CopyScanResult {
  context: CopyContext;
  violations: CopyViolation[];
  warnings: CopyWarning[];
  missing_disclaimers: string[];
  is_safe_for_launch: boolean;
  blocking_violation_count: number;
  scanned_at: string;
}

export interface CopyRule {
  id: string;
  pattern: RegExp | string;
  severity: CopyScanSeverity;
  applies_to: CopyContext[] | "all";
  explanation: string;
  suggested_fix: string;
}

export interface DisclaimerRequirement {
  id: string;
  text_pattern: string;
  applies_to: CopyContext[] | "all";
  description: string;
  required: boolean;
}

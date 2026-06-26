// GO-LIVE 03 — Public Copy Final Scanner Types
// Pure: no Supabase, no Next, no async, no throw.

export type CopyFinalSeverity = "blocking" | "warning";

export type CopyFinalRule = {
  id: string;
  pattern: RegExp;
  severity: CopyFinalSeverity;
  explanation: string;
  suggested_fix: string;
  applies_to: "all" | string[];
};

export type CopyFinalAllowedPattern = {
  id: string;
  pattern: RegExp;
  description: string;
};

export type CopyFinalViolation = {
  rule_id: string;
  found_text: string;
  severity: CopyFinalSeverity;
  explanation: string;
  suggested_fix: string;
};

export type CopyFinalScanResult = {
  context: string;
  violations: CopyFinalViolation[];
  blocking_count: number;
  warning_count: number;
  is_clean: boolean;
  scanned_at: string;
};

export type CopyFinalMultiScanResult = {
  results: CopyFinalScanResult[];
  total_blocking: number;
  total_warnings: number;
  all_clean: boolean;
  dirty_contexts: string[];
};

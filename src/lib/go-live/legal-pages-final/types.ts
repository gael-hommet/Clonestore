// GO-LIVE 03 — Legal Pages Final Scan Types
// Pure: no Supabase, no Next, no async, no throw.

export type LegalPageKey =
  | "cgu"
  | "cgv"
  | "dpa"
  | "mentions"
  | "confidentialite";

export type LegalPageRequirement = {
  key: LegalPageKey;
  route: string;
  label: string;
  required_content_patterns: string[];
  forbidden_content_patterns: string[];
  placeholder_markers: string[];
  proof_id: string;
};

export type LegalPageScanResult = {
  key: LegalPageKey;
  route: string;
  has_placeholder: boolean;
  missing_required: string[];
  forbidden_found: string[];
  placeholder_markers_found: string[];
  is_draft: boolean;
  safe_for_launch: boolean;
};

export type LegalPagesFinalScanResult = {
  pages: LegalPageScanResult[];
  all_routes_present: boolean;
  blocking_issues: string[];
  total_placeholders: number;
  all_safe: boolean;
};

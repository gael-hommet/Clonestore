// GO-LIVE 03 — Legal Pages Final Verdict
// Pure: no Supabase, no Next, no async, no throw.

import type { LegalPagesFinalScanResult } from "./types";

export type LegalPagesVerdict = {
  all_pages_present: boolean;
  all_safe_for_launch: boolean;
  blocks_public_launch: boolean;
  total_placeholders: number;
  blocking_issue_count: number;
  proof_ids_pending: string[];
  message: string;
};

const REQUIRED_PROOF_IDS = [
  "LEGAL_CGU_VALIDATED",
  "LEGAL_CGV_VALIDATED",
  "LEGAL_DPA_VALIDATED",
  "LEGAL_PRIVACY_VALIDATED",
  "LEGAL_MENTIONS_VALIDATED",
];

export function getLegalPagesVerdict(scan: LegalPagesFinalScanResult): LegalPagesVerdict {
  const blocks_public_launch = !scan.all_safe || scan.blocking_issues.length > 0;

  const message = blocks_public_launch
    ? `${scan.blocking_issues.length} problème(s) bloquant(s) détectés sur les pages légales. Public launch NO-GO.`
    : "Toutes les pages légales sont présentes sans violation bloquante. Revue juridique humaine requise.";

  return {
    all_pages_present: scan.all_routes_present,
    all_safe_for_launch: scan.all_safe,
    blocks_public_launch,
    total_placeholders: scan.total_placeholders,
    blocking_issue_count: scan.blocking_issues.length,
    proof_ids_pending: REQUIRED_PROOF_IDS,
    message,
  };
}

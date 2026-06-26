// GO-LIVE 03 — Public Copy Final Verdict
// Pure: no Supabase, no Next, no async, no throw.

import type { CopyFinalMultiScanResult } from "./types";

export type CopyFinalVerdict = {
  is_clean: boolean;
  blocks_public_launch: boolean;
  proof_ids_pending: string[];
  total_blocking: number;
  total_warnings: number;
  dirty_contexts: string[];
  message: string;
};

export function getCopyFinalVerdict(scan: CopyFinalMultiScanResult): CopyFinalVerdict {
  const blocks_public_launch = !scan.all_clean;

  const message = scan.all_clean
    ? "Aucune violation bloquante détectée dans le contenu public. PUBLIC_COPY_SCAN_CLEAN eligible."
    : `${scan.total_blocking} violation(s) bloquante(s) dans ${scan.dirty_contexts.length} contexte(s). Corriger avant lancement.`;

  return {
    is_clean: scan.all_clean,
    blocks_public_launch,
    proof_ids_pending: ["PUBLIC_COPY_SCAN_CLEAN", "PUBLIC_SITE_NO_FORBIDDEN_CLAIMS"],
    total_blocking: scan.total_blocking,
    total_warnings: scan.total_warnings,
    dirty_contexts: scan.dirty_contexts,
    message,
  };
}

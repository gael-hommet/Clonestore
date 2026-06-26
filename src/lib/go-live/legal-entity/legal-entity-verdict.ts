// GO-LIVE 03 — Legal Entity Verdict
// Pure: no Supabase, no Next, no async, no throw.

import type { LegalEntityValidation, LegalEntityVerdict } from "./types";

export function getLegalEntityVerdict(validation: LegalEntityValidation): LegalEntityVerdict {
  const missing_fields = validation.fields
    .filter((f) => f.status === "missing")
    .map((f) => f.field.key);

  const placeholder_fields = validation.fields
    .filter((f) => f.status === "placeholder")
    .map((f) => f.field.key);

  const has_issues = missing_fields.length > 0 || placeholder_fields.length > 0;

  let status: LegalEntityVerdict["status"];
  if (!has_issues) {
    status = "complete";
  } else if (placeholder_fields.length > 0) {
    status = "draft";
  } else {
    status = "missing";
  }

  const message =
    status === "complete"
      ? "Toutes les informations légales sont renseignées."
      : status === "draft"
      ? `${placeholder_fields.length} champ(s) contiennent encore des placeholders. À compléter avant lancement.`
      : `${missing_fields.length} champ(s) manquants dans les informations légales.`;

  return {
    status,
    proof_id: "LEGAL_ENTITY_INFO_COMPLETED",
    proof_status: "pending",
    blocks_public_launch: validation.blocks_public_launch,
    missing_fields,
    placeholder_fields,
    message,
  };
}

export function formatLegalEntityVerdict(verdict: LegalEntityVerdict): string {
  const lines: string[] = [
    "── LEGAL ENTITY VERDICT ──────────────────────────────",
    `  Status         : ${verdict.status.toUpperCase()}`,
    `  Proof ID       : ${verdict.proof_id} → ${verdict.proof_status.toUpperCase()}`,
    `  Blocks launch  : ${verdict.blocks_public_launch ? "YES" : "no"}`,
    `  Message        : ${verdict.message}`,
  ];

  if (verdict.missing_fields.length > 0) {
    lines.push(`  Missing fields : ${verdict.missing_fields.join(", ")}`);
  }
  if (verdict.placeholder_fields.length > 0) {
    lines.push(`  Placeholders   : ${verdict.placeholder_fields.join(", ")}`);
  }

  lines.push("──────────────────────────────────────────────────────");
  return lines.join("\n");
}

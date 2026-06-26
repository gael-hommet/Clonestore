// GO-LIVE 03 — Legal Entity Validator
// Validates whether the legal entity information has been filled.
// Pure: no Supabase, no Next, no async, no throw.

import type { LegalEntityFieldResult, LegalEntityValidation } from "./types";
import { LEGAL_ENTITY_FIELDS } from "./legal-entity-registry";

// Detect placeholder markers in a value
function detectPlaceholderStatus(
  value: string | null | undefined,
  markers: string[]
): "filled" | "missing" | "placeholder" {
  if (!value || value.trim() === "") return "missing";
  const lower = value.toLowerCase();
  for (const marker of markers) {
    if (lower.includes(marker.toLowerCase())) return "placeholder";
  }
  return "filled";
}

export function validateLegalEntity(
  entity: Record<string, string | null | undefined>
): LegalEntityValidation {
  const fields: LegalEntityFieldResult[] = LEGAL_ENTITY_FIELDS.map((field) => {
    const value = entity[field.key] ?? null;
    const status = detectPlaceholderStatus(value, field.placeholder_markers);
    return { field, status, value: value || null };
  });

  const missing_count = fields.filter((f) => f.status === "missing").length;
  const placeholder_count = fields.filter((f) => f.status === "placeholder").length;
  const filled_count = fields.filter((f) => f.status === "filled").length;

  const blocks_public_launch = fields.some(
    (f) => f.field.required_for_public_launch && f.status !== "filled"
  );
  const blocks_private_pilot = fields.some(
    (f) => f.field.required_for_private_pilot && f.status !== "filled"
  );

  return {
    fields,
    missing_count,
    placeholder_count,
    filled_count,
    blocks_public_launch,
    blocks_private_pilot,
  };
}

// Validate from the pages source content (looks for placeholder markers)
export function validateLegalEntityFromPageContent(
  mentionsPageContent: string
): LegalEntityValidation {
  const entity: Record<string, string | null> = {};

  for (const field of LEGAL_ENTITY_FIELDS) {
    const hasPlaceholder = field.placeholder_markers.some((marker) =>
      mentionsPageContent.toLowerCase().includes(marker.toLowerCase())
    );
    entity[field.key] = hasPlaceholder ? `[placeholder: ${field.placeholder_markers[0]}]` : null;
  }

  return validateLegalEntity(entity);
}

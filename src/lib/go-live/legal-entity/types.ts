// GO-LIVE 03 — Legal Entity Types
// Pure: no Supabase, no Next, no async, no throw.

export type LegalEntityFieldStatus = "filled" | "missing" | "placeholder";

export type LegalEntityField = {
  key: string;
  label: string;
  required_for_public_launch: boolean;
  required_for_private_pilot: boolean;
  description: string;
  example: string;
  placeholder_markers: string[];
};

export type LegalEntityFieldResult = {
  field: LegalEntityField;
  status: LegalEntityFieldStatus;
  value: string | null;
};

export type LegalEntityValidation = {
  fields: LegalEntityFieldResult[];
  missing_count: number;
  placeholder_count: number;
  filled_count: number;
  blocks_public_launch: boolean;
  blocks_private_pilot: boolean;
};

export type LegalEntityVerdict = {
  status: "complete" | "draft" | "missing";
  proof_id: "LEGAL_ENTITY_INFO_COMPLETED";
  proof_status: "pending" | "verified";
  blocks_public_launch: boolean;
  missing_fields: string[];
  placeholder_fields: string[];
  message: string;
};

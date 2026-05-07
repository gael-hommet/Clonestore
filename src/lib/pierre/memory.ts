import type { SupabaseClient } from "@supabase/supabase-js";

import { safeString } from "@/lib/pierre/utils";

export type PierreCompanyMemoryRow = {
  id?: string;
  user_id: string;
  agent_slug: "pierre";
  memory_json: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
};

type GenericRecord = Record<string, unknown>;

function isPlainObject(value: unknown): value is GenericRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sanitizeString(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.length > 5000 ? trimmed.slice(0, 5000) : trimmed;
}

function sanitizeArray(input: unknown[], depth: number): unknown[] {
  return input
    .slice(0, 100)
    .map((item) => sanitizePierreMemoryValue(item, depth + 1))
    .filter((item) => item !== undefined);
}

function sanitizeObject(input: GenericRecord, depth: number): GenericRecord {
  const output: GenericRecord = {};

  for (const [key, value] of Object.entries(input).slice(0, 200)) {
    const cleanKey = safeString(key);
    if (!cleanKey) continue;

    const cleanValue = sanitizePierreMemoryValue(value, depth + 1);

    if (cleanValue !== undefined) {
      output[cleanKey] = cleanValue;
    }
  }

  return output;
}

export function sanitizePierreMemoryValue(
  value: unknown,
  depth = 0
): unknown {
  if (depth > 8) return undefined;

  if (value === null) return null;

  if (typeof value === "string") {
    const clean = sanitizeString(value);
    return clean || "";
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return sanitizeArray(value, depth);
  }

  if (isPlainObject(value)) {
    return sanitizeObject(value, depth);
  }

  return undefined;
}

export function sanitizePierreMemoryPatch(
  patch: Record<string, unknown>
): Record<string, unknown> {
  return sanitizeObject(patch, 0);
}

export function deepMergePierreMemory(
  base: Record<string, unknown>,
  patch: Record<string, unknown>
): Record<string, unknown> {
  const output: Record<string, unknown> = { ...base };

  for (const [key, patchValue] of Object.entries(patch)) {
    const baseValue = output[key];

    if (isPlainObject(baseValue) && isPlainObject(patchValue)) {
      output[key] = deepMergePierreMemory(baseValue, patchValue);
      continue;
    }

    output[key] = patchValue;
  }

  return output;
}

export async function getPierreCompanyMemory(
  supabase: SupabaseClient,
  userId: string
): Promise<PierreCompanyMemoryRow | null> {
  const { data, error } = await supabase
    .from("pierre_company_memory")
    .select("*")
    .eq("user_id", userId)
    .eq("agent_slug", "pierre")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as PierreCompanyMemoryRow | null) || null;
}

export async function upsertPierreCompanyMemory(
  supabase: SupabaseClient,
  input: {
    userId: string;
    patch: Record<string, unknown>;
    mode?: "merge" | "replace";
  }
): Promise<PierreCompanyMemoryRow> {
  const existing = await getPierreCompanyMemory(supabase, input.userId);

  const cleanPatch = sanitizePierreMemoryPatch(input.patch);
  const mode = input.mode || "merge";

  const nextMemory =
    mode === "replace"
      ? cleanPatch
      : deepMergePierreMemory(existing?.memory_json || {}, cleanPatch);

  if (existing?.id) {
    const { data, error } = await supabase
      .from("pierre_company_memory")
      .update({
        memory_json: nextMemory,
      })
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(
        error?.message || "Impossible de mettre Ã  jour la mÃ©moire entreprise Pierre."
      );
    }

    return data as PierreCompanyMemoryRow;
  }

  const { data, error } = await supabase
    .from("pierre_company_memory")
    .insert({
      user_id: input.userId,
      agent_slug: "pierre",
      memory_json: nextMemory,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      error?.message || "Impossible de crÃ©er la mÃ©moire entreprise Pierre."
    );
  }

  return data as PierreCompanyMemoryRow;
}

export function buildPierreDefaultMemoryShape(
  existing?: Record<string, unknown> | null
) {
  const base = existing || {};

  return deepMergePierreMemory(
    {
      company_profile: {
        company_name: "",
        sector: "",
        country: "France",
        language: "fr",
      },
      email: {
        sender_name: "Pierre",
        sender_local_part: "pierre",
        sender_email: "",
        reply_to: "",
        sending_domain: "",
        provider_mode: "gateway",
        provider_url: "",
        provider_secret: "",
        provider_api_key: "",
      },
      hr_preferences: {
        default_tone: "professionnel",
        signature_name: "Pierre",
        approval_policy: "sensitive_only",
      },
      legal_preferences: {
        contract_language: "fr",
        require_human_validation_for_sensitive_actions: true,
      },
    },
    base
  );
}
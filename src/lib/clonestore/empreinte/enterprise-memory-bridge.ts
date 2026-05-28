// B44 — EnterpriseEmpreinte memory bridge
// Read/write to pierre_company_memory.memory_json under key "enterprise_empreinte".
// Storage separate from clone_adn (reusable_rh_context_json.clone_adn).
// Pure: no async, no Supabase import. Callers inject the raw JSON.

import type { EnterpriseEmpreinte, EnterpriseEmpreintePatch } from "./types";
import { normalizeEnterpriseEmpreinte, applyEnterpriseEmpreintePatch } from "./enterprise-normalizer";

export const ENTERPRISE_EMPREINTE_MEMORY_KEY = "enterprise_empreinte";

// ── Read ──────────────────────────────────────────────────────────────────────

export function readEnterpriseEmpreinteFromMemory(
  memoryJson: unknown,
  userId: string,
): EnterpriseEmpreinte | null {
  try {
    if (typeof memoryJson !== "object" || memoryJson === null) return null;
    const raw = (memoryJson as Record<string, unknown>)[ENTERPRISE_EMPREINTE_MEMORY_KEY];
    if (!raw) return null;
    return normalizeEnterpriseEmpreinte(raw, userId);
  } catch {
    return null;
  }
}

export function readOrCreateEnterpriseEmpreinte(
  memoryJson: unknown,
  userId: string,
): EnterpriseEmpreinte {
  return readEnterpriseEmpreinteFromMemory(memoryJson, userId)
    ?? normalizeEnterpriseEmpreinte(null, userId);
}

// ── Write ─────────────────────────────────────────────────────────────────────

export function buildEnterpriseEmpreinteMemoryPatch(
  memoryJson: Record<string, unknown>,
  empreinte: EnterpriseEmpreinte,
): Record<string, unknown> {
  return {
    ...memoryJson,
    [ENTERPRISE_EMPREINTE_MEMORY_KEY]: empreinte,
  };
}

export function applyAndPersistEmpreintePatch(params: {
  memoryJson: Record<string, unknown>;
  userId: string;
  patch: EnterpriseEmpreintePatch;
}): { updated: EnterpriseEmpreinte; newMemoryJson: Record<string, unknown> } {
  const { memoryJson, userId, patch } = params;
  const base = readOrCreateEnterpriseEmpreinte(memoryJson, userId);
  const updated = applyEnterpriseEmpreintePatch(base, patch);
  const newMemoryJson = buildEnterpriseEmpreinteMemoryPatch(memoryJson, updated);
  return { updated, newMemoryJson };
}

// ── Reset ─────────────────────────────────────────────────────────────────────

export function resetEnterpriseEmpreinteInMemory(
  memoryJson: Record<string, unknown>,
  userId: string,
): { reset: EnterpriseEmpreinte; newMemoryJson: Record<string, unknown> } {
  const reset = normalizeEnterpriseEmpreinte(null, userId);
  const newMemoryJson = buildEnterpriseEmpreinteMemoryPatch(memoryJson, reset);
  return { reset, newMemoryJson };
}

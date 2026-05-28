// B44 — PierreEmpreinte memory bridge
// Read/write to pierre_company_memory.memory_json under key "pierre_empreinte".
// Separate from enterprise_empreinte and clone_adn — no cross-key contamination.
// Pure: no async, no Supabase import. Callers inject the raw JSON.

import type { PierreEmpreinte, PierreEmpreintePatch } from "./types";
import { normalizePierreEmpreinte, applyPierreEmpreintePatch } from "./pierre-normalizer";

export const PIERRE_EMPREINTE_MEMORY_KEY = "pierre_empreinte";

// ── Read ──────────────────────────────────────────────────────────────────────

export function readPierreEmpreinteFromMemory(
  memoryJson: unknown,
  userId: string,
  enterpriseEmpreinteId: string,
): PierreEmpreinte | null {
  try {
    if (typeof memoryJson !== "object" || memoryJson === null) return null;
    const raw = (memoryJson as Record<string, unknown>)[PIERRE_EMPREINTE_MEMORY_KEY];
    if (!raw) return null;
    return normalizePierreEmpreinte(raw, userId, enterpriseEmpreinteId);
  } catch {
    return null;
  }
}

export function readOrCreatePierreEmpreinte(
  memoryJson: unknown,
  userId: string,
  enterpriseEmpreinteId: string,
): PierreEmpreinte {
  return readPierreEmpreinteFromMemory(memoryJson, userId, enterpriseEmpreinteId)
    ?? normalizePierreEmpreinte(null, userId, enterpriseEmpreinteId);
}

// ── Write ─────────────────────────────────────────────────────────────────────

export function buildPierreEmpreinteMemoryPatch(
  memoryJson: Record<string, unknown>,
  empreinte: PierreEmpreinte,
): Record<string, unknown> {
  return {
    ...memoryJson,
    [PIERRE_EMPREINTE_MEMORY_KEY]: empreinte,
  };
}

export function applyAndPersistPierreEmpreintePatch(params: {
  memoryJson: Record<string, unknown>;
  userId: string;
  enterpriseEmpreinteId: string;
  patch: PierreEmpreintePatch;
}): { updated: PierreEmpreinte; newMemoryJson: Record<string, unknown> } {
  const { memoryJson, userId, enterpriseEmpreinteId, patch } = params;
  const base = readOrCreatePierreEmpreinte(memoryJson, userId, enterpriseEmpreinteId);
  const updated = applyPierreEmpreintePatch(base, patch);
  const newMemoryJson = buildPierreEmpreinteMemoryPatch(memoryJson, updated);
  return { updated, newMemoryJson };
}

// ── Reset ─────────────────────────────────────────────────────────────────────

export function resetPierreEmpreinteInMemory(
  memoryJson: Record<string, unknown>,
  userId: string,
  enterpriseEmpreinteId: string,
): { reset: PierreEmpreinte; newMemoryJson: Record<string, unknown> } {
  const reset = normalizePierreEmpreinte(null, userId, enterpriseEmpreinteId);
  const newMemoryJson = buildPierreEmpreinteMemoryPatch(memoryJson, reset);
  return { reset, newMemoryJson };
}

// src/lib/cloneos/ai/cost-ledger/runtime.ts
// B38C — Ledger factory + singleton. Never throws on import.
// Returns memory ledger by default. Supabase only when explicitly configured.
// Supabase client is created lazily using SUPABASE_SERVICE_ROLE_KEY.

import type { AiCostLedger, AiLedgerDbClient } from "./types";
import { getAiCostLedgerConfig } from "./config";
import { createInMemoryAiCostLedger, createNoOpAiCostLedger } from "./in-memory-ledger";
import { createSupabaseAiCostLedger } from "./supabase-ledger";

// ── Singleton ─────────────────────────────────────────────────────────────────
// One ledger per process. Reset via resetAiCostLedger() in tests.

let _ledger: AiCostLedger | null = null;

export function getAiCostLedger(): AiCostLedger {
  if (_ledger) return _ledger;
  _ledger = createAiCostLedger();
  return _ledger;
}

export function resetAiCostLedger(): void {
  _ledger = null;
}

// ── Factory ───────────────────────────────────────────────────────────────────

function createAiCostLedger(): AiCostLedger {
  const config = getAiCostLedgerConfig();

  if (config.write_mode === "disabled" || config.provider === "disabled") {
    return createNoOpAiCostLedger();
  }

  if (config.write_mode === "memory" || config.provider === "memory") {
    return createInMemoryAiCostLedger(config);
  }

  // Supabase or dual_write: try to get admin client
  if (
    config.write_mode === "supabase" ||
    config.write_mode === "dual_write" ||
    config.provider === "supabase"
  ) {
    const client = tryCreateSupabaseAdminClient();
    if (!client) {
      console.warn(
        "[B38C] Supabase ledger requested (AI_COST_LEDGER_PROVIDER=supabase) but " +
        "client unavailable (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing). " +
        "Falling back to in-memory ledger.",
      );
      return createInMemoryAiCostLedger(config);
    }
    return createSupabaseAiCostLedger(client, config);
  }

  // Safe fallback
  return createInMemoryAiCostLedger(config);
}

// ── Supabase admin client factory ─────────────────────────────────────────────
// Uses service role key for server-side writes. Never called in tests (mocked).
// Returns null if env vars are missing — caller falls back to memory.

function tryCreateSupabaseAdminClient(): AiLedgerDbClient | null {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey) return null;

    // Dynamic import to avoid breaking tests without supabase keys
    // We import @supabase/supabase-js which is already a dependency
    const { createClient } = require("@supabase/supabase-js") as typeof import("@supabase/supabase-js");
    return createClient(url, serviceKey) as unknown as AiLedgerDbClient;
  } catch {
    return null;
  }
}

// ── Convenience: create a fresh memory ledger for use in tests ────────────────

export function createTestLedger(): AiCostLedger {
  return createInMemoryAiCostLedger({ redact_metadata: true });
}

// src/lib/pierre/v1/provider-integrations/manual-handoff.ts
// PHASE 8.12 — the governed MANUAL path a mission takes when no real provider is usable. This keeps
// every workflow completable (a human performs the external step + records the result), so a missing
// integration never dead-ends a mission — it degrades to a governed manual handoff with evidence.
import type { ProviderAdapter, ManualHandoffPath } from "./types";
import { createHash } from "crypto";

export function manualHandoffFor(adapter: ProviderAdapter): ManualHandoffPath { return adapter.manualHandoff; }

export type OpenManualHandoff = { handoffId: string; provider: string; steps: string[]; producesEvidence: string; openedAt: string };

/** Open a governed manual handoff (deterministic id from provider + correlation). No provider call. */
export function openManualHandoff(adapter: ProviderAdapter, correlationId: string, openedAt: string): OpenManualHandoff {
  const handoffId = `manual:${adapter.id}:${createHash("sha1").update(correlationId).digest("hex").slice(0, 10)}`;
  return { handoffId, provider: adapter.id, steps: adapter.manualHandoff.steps, producesEvidence: adapter.manualHandoff.producesEvidence, openedAt };
}

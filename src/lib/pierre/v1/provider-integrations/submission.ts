// src/lib/pierre/v1/provider-integrations/submission.ts
// PHASE 8.12 — governed submission. THE guarantee: an unusable provider NEVER returns a fabricated
// success. If the provider is not live-usable, submission is refused and routed to the governed
// manual handoff. This module does not itself perform network I/O in P8.12 (no provider is live); it
// is the decision layer that a live adapter would call — and it fail-closes.
import type { ProviderAdapter, SubmissionResult } from "./types";
import { preflight } from "./preflight";
import { openManualHandoff } from "./manual-handoff";

export function submit(adapter: ProviderAdapter, correlationId: string, nowIso: string, env: NodeJS.ProcessEnv = process.env): SubmissionResult {
  const pf = preflight(adapter, env);
  if (!pf.usable) {
    // never simulate success — route to the governed manual path
    if (adapter.manualHandoff.available) {
      const h = openManualHandoff(adapter, correlationId, nowIso);
      return { provider: adapter.id, outcome: "routed_to_manual", reference: null, manualHandoffId: h.handoffId, reason: `provider ${pf.status}${pf.blockedReason ? ` (${pf.blockedReason})` : ""} → governed manual handoff` };
    }
    return { provider: adapter.id, outcome: "refused_not_usable", reference: null, manualHandoffId: null, reason: `provider ${pf.status} and no manual path` };
  }
  // A live-configured provider would perform the real call HERE. P8.12 ships no live provider, so this
  // path is unreachable in this environment — and it must NEVER be faked.
  throw new Error(`live submission for ${adapter.id} requires a real adapter implementation (not shipped in P8.12)`);
}

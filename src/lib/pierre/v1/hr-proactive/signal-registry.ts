// src/lib/pierre/v1/hr-proactive/signal-registry.ts
// PHASE 8.11 — the proactive signal registry, DERIVED from the mission packs (each pack declares the
// signals it emits/handles). No hand-maintained parallel list: signal → handling pack comes straight
// from HR_MISSION_PACKS.proactiveSignals + emitsSignal on steps.
import type { HrSignalDefinition, SignalDetection, SignalSeverity } from "./signal-types";
import { HR_MISSION_PACKS } from "../hr-mission-packs/registry";

function inferDetection(key: string): SignalDetection {
  if (/expir/.test(key)) return "expiry";
  if (/missing|document/.test(key)) return "missing_document";
  if (/sla|breach|blocked|overdue|pending/.test(key)) return "sla_breach";
  if (/anomaly/.test(key)) return "anomaly";
  if (/due|deadline|watch|cutoff/.test(key)) return "date_threshold";
  return "state_gap";
}
function inferSeverity(d: SignalDetection): SignalSeverity {
  return d === "anomaly" || d === "sla_breach" ? "critical" : d === "expiry" ? "warning" : "info";
}

function build(): HrSignalDefinition[] {
  const out = new Map<string, HrSignalDefinition>();
  for (const p of HR_MISSION_PACKS) {
    const keys = new Set<string>([...p.proactiveSignals.map((s) => s.signalKey), ...p.steps.map((s) => s.emitsSignal).filter((x): x is string => !!x)]);
    for (const key of keys) {
      if (out.has(key)) continue; // first pack that declares a signal handles it
      const detection = inferDetection(key);
      const label = p.proactiveSignals.find((s) => s.signalKey === key)?.label ?? key;
      out.set(key, { key, label, detection, handledByPackId: p.id, defaultSeverity: inferSeverity(detection) });
    }
  }
  return [...out.values()];
}

export const SIGNAL_REGISTRY: readonly HrSignalDefinition[] = build();
export function getSignalDefinition(key: string): HrSignalDefinition | undefined { return SIGNAL_REGISTRY.find((s) => s.key === key); }
export const SIGNAL_KEYS: readonly string[] = SIGNAL_REGISTRY.map((s) => s.key);

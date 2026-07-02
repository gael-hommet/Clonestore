// src/lib/pierre/v1/hr-proactive/signal-types.ts
// PHASE 8.11 — proactive HR signal types. A signal is a detected situation that should trigger a
// governed follow-up mission (deadline, expiry, missing doc, anomaly, SLA breach). Signals carry no
// raw PII — only a subject reference + a dedup key.

export type SignalDetection = "date_threshold" | "expiry" | "missing_document" | "state_gap" | "sla_breach" | "anomaly";
export type SignalSeverity = "info" | "warning" | "critical";

export type HrSignalDefinition = {
  key: string;
  label: string;
  detection: SignalDetection;
  handledByPackId: string;   // the mission pack that acts on this signal
  defaultSeverity: SignalSeverity;
};

export type HrSignal = {
  key: string;
  companyId: string;
  subjectRef: string;        // opaque (e.g. employee/contract id), never raw PII
  detectedAt: string;        // ISO instant supplied by the detector
  severity: SignalSeverity;
  dedupKey: string;          // `${key}:${subjectRef}` — one live signal per (key, subject)
};

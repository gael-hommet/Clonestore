// P21 — Canonical Pierre task-outcome taxonomy.
//
// The product contract requires a fixed, explicit set of failure states so that a task NEVER
// silently reports "done" when it did not truly complete, and so that "provider not configured"
// is distinguished from a genuine failure and from a business refusal. This module is the single
// source of truth mapping Pierre's internal executor/persistence outcomes onto that canonical set.
//
// It is pure (no I/O beyond an optional injected env snapshot) so it is fully testable and can be
// reused by any execution path (tasks/execute-task.ts, queue/process-task.ts, v1 runtime).

export type CanonicalPierreTaskStatus =
  // terminal-success / progress states
  | "COMPLETED"
  | "IN_PROGRESS"
  | "SCHEDULED"
  // the nine mandated failure / waiting states
  | "BLOCKED"
  | "NEEDS_INFORMATION"
  | "NEEDS_HUMAN_VALIDATION"
  | "PERMISSION_DENIED"
  | "UNSUPPORTED"
  | "PROVIDER_UNAVAILABLE"
  | "INTEGRATION_UNAVAILABLE"
  | "FAILED"
  | "RETRY_SCHEDULED";

/** The nine mandated non-success statuses (spec §5). Exported for exhaustiveness checks/tests. */
export const CANONICAL_FAILURE_STATUSES: readonly CanonicalPierreTaskStatus[] = [
  "BLOCKED",
  "NEEDS_INFORMATION",
  "NEEDS_HUMAN_VALIDATION",
  "PERMISSION_DENIED",
  "UNSUPPORTED",
  "PROVIDER_UNAVAILABLE",
  "INTEGRATION_UNAVAILABLE",
  "FAILED",
  "RETRY_SCHEDULED",
] as const;

export type CanonicalStatusInput = {
  ok: boolean;
  /** Executor/persistence status: completed | failed | blocked | awaiting_info | awaiting_approval | scheduled | running | queued | pending | retry */
  status?: string | null;
  /** Internal error code emitted by executors.ts / execute-task.ts. */
  error_code?: string | null;
  /** True when the persistence layer scheduled a retry for a transient failure. */
  retry_scheduled?: boolean;
  /** Set when an integration/provider is required but not fulfillable — takes precedence over generic FAILED. */
  integration?: CanonicalPierreTaskStatus | null;
};

/**
 * Map an internal task outcome onto the canonical taxonomy. Deterministic and total: any input
 * resolves to exactly one canonical status. Integration-availability, when present, wins over a
 * generic FAILED so a "provider not configured" case is never reported as an ordinary failure.
 */
export function toCanonicalTaskStatus(
  input: CanonicalStatusInput,
): CanonicalPierreTaskStatus {
  if (input.integration === "PROVIDER_UNAVAILABLE" || input.integration === "INTEGRATION_UNAVAILABLE") {
    return input.integration;
  }

  if (input.ok) return "COMPLETED";

  if (input.retry_scheduled || input.status === "retry") return "RETRY_SCHEDULED";

  // Error-code takes priority over the coarse status when it is more specific.
  switch (input.error_code) {
    case "MISSING_INFO":
      return "NEEDS_INFORMATION";
    case "APPROVAL_REQUIRED":
    case "HUMAN_APPROVAL_REQUIRED":
      return "NEEDS_HUMAN_VALIDATION";
    case "HR_BLOCKED_ACTION":
    case "AUTONOMY_BLOCKED":
    case "CLONEGUARD_BLOCKED":
    case "GOVERNANCE_BLOCKED":
      return "BLOCKED";
    case "PERMISSION_DENIED":
      return "PERMISSION_DENIED";
    case "UNSUPPORTED_TASK":
      return "UNSUPPORTED";
    case "PROVIDER_UNAVAILABLE":
      return "PROVIDER_UNAVAILABLE";
    case "INTEGRATION_UNAVAILABLE":
      return "INTEGRATION_UNAVAILABLE";
    default:
      break;
  }

  switch (input.status) {
    case "awaiting_info":
      return "NEEDS_INFORMATION";
    case "awaiting_approval":
      return "NEEDS_HUMAN_VALIDATION";
    case "blocked":
      return "BLOCKED";
    case "scheduled":
      return "SCHEDULED";
    case "running":
    case "queued":
    case "pending":
      return "IN_PROGRESS";
    case "completed":
    case "done":
      return "COMPLETED";
    default:
      return "FAILED";
  }
}

// ── Integration / provider availability ──────────────────────────────────────

export type PierreIntegrationKind = "email" | "signature" | "hris" | "calendar";

export type IntegrationEnv = Record<string, string | undefined>;

export type IntegrationAvailability = {
  kind: PierreIntegrationKind;
  available: boolean;
  /** Canonical status to surface when unavailable; null when available. */
  canonical: "INTEGRATION_UNAVAILABLE" | "PROVIDER_UNAVAILABLE" | null;
  /** Human-readable list of the missing configuration keys. */
  missing: string[];
};

/**
 * Which external integration a task type genuinely needs to fully complete (a real send/sync),
 * or null for a purely internal task (draft generation, follow-up scheduling, structuring…).
 * Draft-producing types intentionally return null: they complete without any provider.
 */
export function requiredIntegrationForTaskType(
  taskType: string | null | undefined,
): PierreIntegrationKind | null {
  if (!taskType) return null;
  switch (taskType) {
    case "email.send":
    case "send_email":
      return "email";
    case "signature.request":
    case "signature.send":
    case "contract.sign":
      return "signature";
    case "hris.sync":
    case "integration.sync":
      return "hris";
    case "calendar.create":
    case "calendar.invite":
      return "calendar";
    default:
      return null;
  }
}

/**
 * Resolve whether a given integration is configured. `env` defaults to process.env but can be
 * injected for testing. "Not configured at all" → INTEGRATION_UNAVAILABLE (spec wording). This is
 * deliberately conservative: an unknown integration is treated as unavailable (fail-closed), so a
 * task requiring it is never reported as completed.
 */
export function resolveIntegrationAvailability(
  kind: PierreIntegrationKind,
  env: IntegrationEnv = typeof process !== "undefined" ? process.env : {},
): IntegrationAvailability {
  const present = (key: string) => typeof env[key] === "string" && env[key]!.trim().length > 0;

  if (kind === "email") {
    const missing: string[] = [];
    if (!present("RESEND_API_KEY")) missing.push("RESEND_API_KEY");
    if ((env.EMAIL_PROVIDER ?? "").trim() !== "resend") missing.push("EMAIL_PROVIDER=resend");
    const available = missing.length === 0;
    return { kind, available, canonical: available ? null : "INTEGRATION_UNAVAILABLE", missing };
  }

  if (kind === "signature") {
    const missing: string[] = [];
    if (!present("YOUSIGN_API_KEY") && !present("SIGNATURE_PROVIDER_API_KEY")) {
      missing.push("YOUSIGN_API_KEY");
    }
    const available = missing.length === 0;
    return { kind, available, canonical: available ? null : "INTEGRATION_UNAVAILABLE", missing };
  }

  if (kind === "hris") {
    const missing: string[] = [];
    if (!present("HRIS_SYNC_URL") && !present("HRIS_PROVIDER_URL")) missing.push("HRIS_SYNC_URL");
    const available = missing.length === 0;
    return { kind, available, canonical: available ? null : "INTEGRATION_UNAVAILABLE", missing };
  }

  // calendar
  const missing: string[] = [];
  if (!present("CALENDAR_PROVIDER_URL") && !present("GOOGLE_CALENDAR_CREDENTIALS")) {
    missing.push("CALENDAR_PROVIDER_URL");
  }
  const available = missing.length === 0;
  return { kind, available, canonical: available ? null : "INTEGRATION_UNAVAILABLE", missing };
}

/**
 * Convenience: for a task type, return the integration status to surface (or null when the task
 * needs no external integration or its integration is available). Used by execution paths to add a
 * truthful `integration` signal to the canonical status without ever simulating a send/sync.
 */
export function integrationStatusForTask(
  taskType: string | null | undefined,
  env?: IntegrationEnv,
): IntegrationAvailability | null {
  const kind = requiredIntegrationForTaskType(taskType);
  if (!kind) return null;
  const availability = resolveIntegrationAvailability(kind, env);
  return availability.available ? null : availability;
}

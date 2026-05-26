// src/lib/pierre/security/pierre-rgpd-export.ts
// B41 — RGPD export bundle builder. Adapter-injectable, no Supabase required in tests.

import type { RgpdExportBundle, SecurityAccessLevel } from "@/lib/security/types";
import type { SecurityTenantScope } from "@/lib/security/types";
import { redactExportRecord, redactEmail } from "@/lib/security/redaction";
import { getPierreExportableResources } from "./pierre-data-map";

// ── Adapters (injectable) ─────────────────────────────────────────────────────

export type PierreExportAdapters = {
  fetchMissions: (userId: string) => Promise<unknown[]>;
  fetchTasks: (userId: string) => Promise<unknown[]>;
  fetchDocuments: (userId: string) => Promise<unknown[]>;
  fetchEmails: (userId: string) => Promise<unknown[]>;
  fetchMemory: (userId: string) => Promise<unknown[]>;
  fetchAuditEvents: (userId: string) => Promise<unknown[]>;
  fetchCostEvents: (userId: string) => Promise<unknown[]>;
};

export function buildFakeExportAdapters(
  overrides: Partial<PierreExportAdapters> = {},
): PierreExportAdapters {
  return {
    fetchMissions: async () => [],
    fetchTasks: async () => [],
    fetchDocuments: async () => [],
    fetchEmails: async () => [],
    fetchMemory: async () => [],
    fetchAuditEvents: async () => [],
    fetchCostEvents: async () => [],
    ...overrides,
  };
}

// ── Export plan ───────────────────────────────────────────────────────────────

export type PierreRgpdExportPlan = {
  tenant: { user_id: string; company_id: string };
  resources: Array<{ table: string; resource_type: string; exportable: boolean }>;
  excluded_fields: string[];
  redacted_fields: string[];
  format: "json";
};

export function buildPierreRgpdExportPlan(
  scope: SecurityTenantScope,
): PierreRgpdExportPlan {
  const resources = getPierreExportableResources().map((r) => ({
    table: r.table,
    resource_type: r.resource_type,
    exportable: r.exportable,
  }));

  return {
    tenant: {
      user_id: scope.user_id ?? "",
      company_id: scope.company_id ?? "",
    },
    resources,
    excluded_fields: [
      "prompt", "completion", "openai_response", "anthropic_response",
      "body_text", "email_body", "email_html", "email_content",
      "document_content", "api_key", "service_role_key", "password",
    ],
    redacted_fields: [
      "email", "phone", "salary", "iban", "ssn",
    ],
    format: "json",
  };
}

// ── Data collector ────────────────────────────────────────────────────────────

export type PierreExportRawData = {
  missions: unknown[];
  tasks: unknown[];
  documents: unknown[];
  emails: unknown[];
  memory: unknown[];
  audit_events: unknown[];
  cost_events: unknown[];
};

export async function collectPierreRgpdExportData(
  userId: string,
  adapters: PierreExportAdapters,
): Promise<PierreExportRawData> {
  const [missions, tasks, documents, emails, memory, audit_events, cost_events] =
    await Promise.all([
      adapters.fetchMissions(userId).catch(() => []),
      adapters.fetchTasks(userId).catch(() => []),
      adapters.fetchDocuments(userId).catch(() => []),
      adapters.fetchEmails(userId).catch(() => []),
      adapters.fetchMemory(userId).catch(() => []),
      adapters.fetchAuditEvents(userId).catch(() => []),
      adapters.fetchCostEvents(userId).catch(() => []),
    ]);

  return { missions, tasks, documents, emails, memory, audit_events, cost_events };
}

// ── Bundle builder ────────────────────────────────────────────────────────────

export function buildPierreRgpdExportBundle(
  scope: SecurityTenantScope,
  data: PierreExportRawData,
): RgpdExportBundle {
  return {
    generated_at: new Date().toISOString(),
    tenant: {
      user_id: scope.user_id ?? "",
      company_id: scope.company_id ?? "",
      access_level: scope.access_level as SecurityAccessLevel,
    },
    missions: data.missions,
    tasks: data.tasks,
    documents: data.documents,
    emails: data.emails,
    memory: data.memory,
    audit_events: data.audit_events,
    cost_events: data.cost_events,
    metadata: {
      export_version: "B41",
      export_type: "rgpd_user_export",
      note: "This export contains personal and HR-sensitive data. Handle with care.",
    },
  };
}

// ── Redaction pass ────────────────────────────────────────────────────────────

const NEVER_EXPORT_FIELDS = [
  "prompt", "completion", "openai_response", "anthropic_response",
  "body_text", "email_body", "email_html", "email_content",
  "document_content", "api_key", "service_role_key", "password",
  "raw_content", "full_text",
];

function redactRecord(record: unknown): unknown {
  if (!record || typeof record !== "object" || Array.isArray(record)) return record;
  return redactExportRecord(record as Record<string, unknown>);
}

function redactEmailField(record: unknown): unknown {
  if (!record || typeof record !== "object" || Array.isArray(record)) return record;
  const r = record as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(r)) {
    if (NEVER_EXPORT_FIELDS.includes(key.toLowerCase())) {
      result[key] = "[CONTENT_NOT_EXPORTED]";
    } else if (key.toLowerCase().includes("email") && typeof value === "string" && value.includes("@")) {
      result[key] = redactEmail(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export function redactExportBundle(
  bundle: RgpdExportBundle,
): RgpdExportBundle {
  return {
    ...bundle,
    missions: bundle.missions.map(redactRecord),
    tasks: bundle.tasks.map(redactRecord),
    documents: bundle.documents.map(redactRecord),
    emails: bundle.emails.map(redactEmailField),
    memory: bundle.memory.map(redactRecord),
    audit_events: bundle.audit_events.map(redactRecord),
    cost_events: bundle.cost_events.map(redactRecord),
  };
}

// ── Full pipeline ─────────────────────────────────────────────────────────────

export async function buildFullPierreRgpdExport(
  scope: SecurityTenantScope,
  adapters: PierreExportAdapters,
): Promise<RgpdExportBundle> {
  if (!scope.user_id) {
    throw new Error("Cannot export: user_id required.");
  }

  const rawData = await collectPierreRgpdExportData(scope.user_id, adapters);
  const bundle = buildPierreRgpdExportBundle(scope, rawData);
  return redactExportBundle(bundle);
}

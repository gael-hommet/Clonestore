// src/lib/pierre/security/pierre-rgpd-purge.ts
// B41 — RGPD purge planner. Dry-run by default. No actual deletes in tests.

import type { RgpdPurgePlan, SecurityTenantScope } from "@/lib/security/types";
import { getPierrePurgeableResources, PIERRE_DATA_MAP } from "./pierre-data-map";

// ── Adapters (injectable) ─────────────────────────────────────────────────────

export type PierrePurgeAdapters = {
  countRows: (table: string, userId: string) => Promise<number>;
  deleteRows: (table: string, userId: string) => Promise<{ deleted: number }>;
  anonymizeRows: (table: string, userId: string) => Promise<{ anonymized: number }>;
};

export function buildFakePurgeAdapters(
  overrides: Partial<PierrePurgeAdapters> = {},
): PierrePurgeAdapters {
  return {
    countRows: async () => 0,
    deleteRows: async () => ({ deleted: 0 }),
    anonymizeRows: async () => ({ anonymized: 0 }),
    ...overrides,
  };
}

// ── Purge plan builder ────────────────────────────────────────────────────────

const PURGE_CONFIRMATION_PHRASE = "CONFIRME SUPPRESSION DONNÉES PIERRE";

export async function buildPierreRgpdPurgePlan(
  scope: SecurityTenantScope,
  options: { dry_run?: boolean; adapters?: PierrePurgeAdapters } = {},
): Promise<RgpdPurgePlan> {
  const userId = scope.user_id ?? "";
  const companyId = scope.company_id ?? "";
  const dry_run = options.dry_run !== false;
  const adapters = options.adapters ?? buildFakePurgeAdapters();

  const blocked_reasons: string[] = [];

  if (!userId) blocked_reasons.push("user_id manquant — purge impossible.");
  if (!companyId) blocked_reasons.push("company_id manquant — purge impossible.");

  const tables: RgpdPurgePlan["tables"] = [];
  let rows_estimated_total = 0;

  for (const resource of PIERRE_DATA_MAP) {
    const rows_estimated = userId
      ? await adapters.countRows(resource.table, userId).catch(() => 0)
      : 0;
    rows_estimated_total += rows_estimated;

    let action: "delete" | "anonymize" | "retain";
    let retain_reason: string | undefined;

    if (!resource.purgeable) {
      action = "retain";
      retain_reason = resource.notes;
    } else if (resource.anonymize_instead_of_purge) {
      action = "anonymize";
    } else {
      action = "delete";
    }

    tables.push({
      table: resource.table,
      rows_estimated,
      purgeable: resource.purgeable,
      action,
      ...(retain_reason ? { retain_reason } : {}),
    });
  }

  return {
    tenant: { user_id: userId, company_id: companyId },
    dry_run,
    tables,
    rows_estimated_total,
    blocked_reasons,
    requires_confirmation: true,
    confirmation_phrase: PURGE_CONFIRMATION_PHRASE,
    irreversible_after_execution: true,
  };
}

// ── Confirmation validation ───────────────────────────────────────────────────

export type PurgeConfirmationInput = {
  confirmation_phrase: string;
  user_id: string;
  understand_irreversible: boolean;
};

export type PurgeValidationResult = {
  valid: boolean;
  reasons: string[];
};

export function validatePurgeConfirmation(
  input: PurgeConfirmationInput,
  plan: RgpdPurgePlan,
): PurgeValidationResult {
  const reasons: string[] = [];

  if (input.confirmation_phrase !== PURGE_CONFIRMATION_PHRASE) {
    reasons.push(`Phrase de confirmation incorrecte. Attendu : "${PURGE_CONFIRMATION_PHRASE}"`);
  }

  if (input.user_id !== plan.tenant.user_id) {
    reasons.push("user_id de confirmation ne correspond pas au tenant du plan.");
  }

  if (!input.understand_irreversible) {
    reasons.push("L'irréversibilité de l'opération doit être reconnue.");
  }

  if (plan.blocked_reasons.length > 0) {
    reasons.push(...plan.blocked_reasons.map((r) => `Plan bloqué : ${r}`));
  }

  return { valid: reasons.length === 0, reasons };
}

// ── Purge execution ───────────────────────────────────────────────────────────

export type PurgeExecutionResult = {
  executed: boolean;
  dry_run: boolean;
  tenant: { user_id: string };
  results: Array<{
    table: string;
    action: string;
    rows_affected: number;
    error: string | null;
  }>;
  errors: string[];
};

export async function executePierreRgpdPurge(
  plan: RgpdPurgePlan,
  confirmation: PurgeConfirmationInput,
  adapters: PierrePurgeAdapters,
): Promise<PurgeExecutionResult> {
  const validation = validatePurgeConfirmation(confirmation, plan);

  if (!validation.valid) {
    return {
      executed: false,
      dry_run: true,
      tenant: { user_id: plan.tenant.user_id },
      results: [],
      errors: validation.reasons,
    };
  }

  if (plan.dry_run) {
    return {
      executed: false,
      dry_run: true,
      tenant: { user_id: plan.tenant.user_id },
      results: plan.tables.map((t) => ({
        table: t.table,
        action: t.action,
        rows_affected: 0,
        error: null,
      })),
      errors: [],
    };
  }

  const results: PurgeExecutionResult["results"] = [];
  const errors: string[] = [];

  for (const table of plan.tables) {
    if (table.action === "retain") {
      results.push({ table: table.table, action: "retain", rows_affected: 0, error: null });
      continue;
    }

    try {
      if (table.action === "delete") {
        const { deleted } = await adapters.deleteRows(table.table, plan.tenant.user_id);
        results.push({ table: table.table, action: "delete", rows_affected: deleted, error: null });
      } else if (table.action === "anonymize") {
        const { anonymized } = await adapters.anonymizeRows(table.table, plan.tenant.user_id);
        results.push({ table: table.table, action: "anonymize", rows_affected: anonymized, error: null });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${table.table}: ${msg}`);
      results.push({ table: table.table, action: table.action, rows_affected: 0, error: msg });
    }
  }

  return {
    executed: true,
    dry_run: false,
    tenant: { user_id: plan.tenant.user_id },
    results,
    errors,
  };
}

export function anonymizeRetainedBillingData(
  order: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...order,
    user_id: "[ANONYMIZED]",
    email: order.email ? "[ANONYMIZED_EMAIL]" : null,
    stripe_customer_id: order.stripe_customer_id ? "[ANONYMIZED]" : null,
    metadata: {},
    anonymized_at: new Date().toISOString(),
  };
}

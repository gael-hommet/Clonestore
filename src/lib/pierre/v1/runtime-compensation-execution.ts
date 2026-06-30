// src/lib/pierre/v1/runtime-compensation-execution.ts
// PHASE 8.5-FINAL §7 — the REAL compensation orchestrator. The registry + summary (runtime-compensation-
// registry.ts / runtime-compensations.ts) only CLASSIFY; this actually EXECUTES the governed cancellation
// services for the effects a run produced. A compensatable effect is undone through the SAME real governed
// service the runtime used to create it (P8.4 cancelCommunicationDelivery, P8.3 cancelContractSignature,
// the documentary archive, the governed local cancel for jobs/waits/active schedules) — never a raw UPDATE.
// An irreversible effect (a delivered communication, a completed signature, a signed document) is reported,
// never pretended-undone. A REQUIRED compensation that FAILS makes the cancellation NOT clean: the mission
// is left in 'cancelling' (manual review) — NEVER a false 'cancelled' — with a durable runtime event +
// CloneTrace + the exact manual actions an operator must take.

import type { SqlExecutor } from "./sql";
import type { TenantContext } from "./tenant-context";
import { cancelCommunicationDelivery } from "./communications";
import { cancelContractSignature } from "./signatures";
import { archiveDocument } from "./documents";
import { getCompensationRule, isCompensatable, isIrreversible } from "./runtime-compensation-registry";
import type { CancellationSummary } from "./runtime-compensations";
import { emitRuntimeEvent } from "./runtime-event-bus";
import { createHash } from "crypto";

/** an effect a run produced, referencing a REAL governed object to compensate. */
export type CompensationEffect = {
  action_key: string;            // communication.create_intent | signature.prepare | document.generate | approval.request | follow_up.schedule
  state: string;                 // its current state (drives compensatable / irreversible classification)
  reference: string | null;      // the primary id to compensate (delivery_id / document_id / validation_id / schedule_id)
  contract_id?: string | null;   // for signature.prepare cancellation (the contract whose request is cancelled)
};

export type CompensationOutcome = CancellationSummary & { mission_status: "cancelled" | "manual_review" };

async function appGov(db: SqlExecutor, ctx: TenantContext, sql: string, params: readonly unknown[]): Promise<void> {
  await db.transaction(async (tx) => { await tx.query(`select set_config('app.current_company', $1, true)`, [ctx.company_id]); await tx.query(sql, params); });
}

/** dispatch a single effect to its REAL governed cancellation service (throws on a genuine failure). */
async function runCompensation(db: SqlExecutor, ctx: TenantContext, e: CompensationEffect, failAction: string | null): Promise<void> {
  if (failAction && failAction === e.action_key) throw new Error(`compensation_failpoint:${e.action_key}`);
  switch (e.action_key) {
    case "communication.create_intent": await cancelCommunicationDelivery(db, ctx, e.reference!); return;
    case "signature.prepare": await cancelContractSignature(db, ctx, (e.contract_id ?? e.reference)!); return;
    case "document.generate": await archiveDocument(db, ctx, e.reference!); return;
    // a pending approval + an active follow-up schedule are cancelled by the governed LOCAL cascade
    // (pierre_rt_request_cancel_mission_run) below — their runtime effect is purely local.
    case "approval.request":
    case "follow_up.schedule": return;
    default: return;
  }
}

/** Execute the compensations for a mission run's effects and reconcile the run's terminal state. */
export async function executeMissionCompensations(
  db: SqlExecutor, ctx: TenantContext, missionRunId: string, effects: CompensationEffect[], opts: { __failAction?: string } = {},
): Promise<CompensationOutcome> {
  const summary: CancellationSummary = { cancelled_local_effects: [], irreversible_external_effects: [], compensation_failures: [], manual_actions_required: [], clean: true };

  for (const e of effects) {
    const ref = e.reference ?? null;
    const rule = getCompensationRule(e.action_key);
    if (isIrreversible(e.action_key, e.state)) {
      summary.irreversible_external_effects.push({ action_key: e.action_key, reference: ref, reason: rule?.safeSummary ?? "irreversible external effect" });
      summary.manual_actions_required.push(`acknowledge irreversible ${e.action_key} (${e.state})`);
      summary.clean = false;
      continue;
    }
    if (!isCompensatable(e.action_key, e.state)) continue; // nothing to undo
    try {
      await runCompensation(db, ctx, e, opts.__failAction ?? null);
      summary.cancelled_local_effects.push({ action_key: e.action_key, reference: ref });
    } catch (err) {
      summary.compensation_failures.push({ action_key: e.action_key, reference: ref });
      summary.manual_actions_required.push(`resolve failed compensation for ${e.action_key} (${ref ?? "n/a"}): ${(err as Error)?.message?.slice(0, 80) ?? "error"}`);
      summary.clean = false;
    }
  }

  // governed LOCAL cancellation (queued/scheduled jobs, pending waits, ACTIVE schedules) → run 'cancelling'
  await appGov(db, ctx, `select pierre_rt_request_cancel_mission_run($1,$2)`, [ctx.company_id, missionRunId]);

  if (summary.clean) {
    // every required compensation succeeded → finalize the cancellation (run → 'cancelled')
    await appGov(db, ctx, `select pierre_rt_finalize_cancel_mission_run($1,$2)`, [ctx.company_id, missionRunId]);
    return { ...summary, mission_status: "cancelled" };
  }

  // a required compensation failed / an irreversible effect exists → NEVER a clean cancel. Leave the run
  // in 'cancelling' (manual review), record a durable runtime event + CloneTrace for the operator.
  await db.transaction(async (tx) => {
    await tx.query(`select set_config('app.current_company', $1, true)`, [ctx.company_id]);
    await emitRuntimeEvent(tx, ctx, {
      source: "p85_runtime",
      event_key: `comp-manual:${missionRunId}`,
      kind: "mission.compensation_manual_review",
      object_type: "mission_run",
      object_id: missionRunId,
      payload_hash: createHash("sha256").update(`comp:${missionRunId}:${summary.manual_actions_required.length}`).digest("hex"),
      resolve: null,
    });
    await tx.query(
      `insert into pierre_rt_events (id, company_id, mission_run_id, type, actor_type, new_state, metadata) values (gen_random_uuid(),$1,$2,'mission.compensation_manual_review','runtime','manual_review',$3)`,
      [ctx.company_id, missionRunId, JSON.stringify({ failures: summary.compensation_failures.length, irreversible: summary.irreversible_external_effects.length })],
    );
  });
  return { ...summary, mission_status: "manual_review" };
}

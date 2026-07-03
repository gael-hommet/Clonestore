// src/lib/pierre/v1/cognitive-runtime/analytics-engine.ts
// PHASE 8.14 (D10 engines) — real OPTIMIZATION + MONITORING engines behind the request classifiers, so
// those requests produce GROUNDED analysis over real tenant-scoped company state — not just a label.
// Every output is tagged fact | inference | recommendation (owner §18: never present an inference as a
// fact). Deterministic + tenant-scoped SQL; the LLM may narrate these findings but never fabricates them.

type Db = { query<T = Record<string, unknown>>(text: string, params?: readonly unknown[]): Promise<{ rows: T[] }> };
type Ctx = { company_id: string };

export type Finding = { kind: "fact" | "inference" | "recommendation"; metric: string; value: number | string; detail: string };

const num = (v: unknown) => Number(v ?? 0) || 0;

/** OPTIMIZATION: bottlenecks + avoidable delay from real mission/task/validation state. */
export async function runOptimizationAnalysis(db: Db, ctx: Ctx): Promise<{ findings: Finding[] }> {
  const q = async (sql: string) => num((await db.query<{ n: string }>(sql, [ctx.company_id])).rows[0]?.n);
  const pendingValidations = await q(`select count(*)::text n from pierre_rt_validations where company_id=$1 and status='pending'`);
  const overdueValidations = await q(`select count(*)::text n from pierre_rt_validations where company_id=$1 and status='pending' and created_at < now() - interval '7 days'`);
  const blockedMissions = await q(`select count(*)::text n from pierre_rt_missions where company_id=$1 and status in ('awaiting_validation','awaiting_info')`);
  const totalMissions = await q(`select count(*)::text n from pierre_rt_missions where company_id=$1`);

  const findings: Finding[] = [
    { kind: "fact", metric: "pending_validations", value: pendingValidations, detail: "approvals currently awaiting a human decision" },
    { kind: "fact", metric: "overdue_validations", value: overdueValidations, detail: "approvals pending > 7 days (SLA risk)" },
    { kind: "fact", metric: "blocked_missions", value: blockedMissions, detail: "missions blocked on validation/info" },
  ];
  if (overdueValidations > 0) findings.push({ kind: "inference", metric: "approval_bottleneck", value: overdueValidations, detail: "overdue approvals are the largest avoidable delay in HR ops" });
  if (overdueValidations > 0 || blockedMissions > 0) findings.push({ kind: "recommendation", metric: "unblock_approvals", value: `${blockedMissions}/${totalMissions}`, detail: "route overdue approvals to a backup approver or enable after-approval autonomy for low-risk steps" });
  return { findings };
}

/** MONITORING: a current-state risk snapshot + a watch list (surfaces anomalies without executing). */
export async function runMonitoringSnapshot(db: Db, ctx: Ctx): Promise<{ findings: Finding[]; watch: string[] }> {
  const q = async (sql: string) => num((await db.query<{ n: string }>(sql, [ctx.company_id])).rows[0]?.n);
  const overdue = await q(`select count(*)::text n from pierre_rt_validations where company_id=$1 and status='pending' and created_at < now() - interval '7 days'`);
  const openSignals = await q(`select count(*)::text n from pierre_rt_proactive_signals where company_id=$1 and status='open'`).catch(() => 0);
  const findings: Finding[] = [
    { kind: "fact", metric: "overdue_approvals", value: overdue, detail: "approvals breaching SLA now" },
    { kind: "fact", metric: "open_proactive_signals", value: openSignals, detail: "proactive signals awaiting handling" },
  ];
  const watch: string[] = [];
  if (overdue > 0) watch.push(`${overdue} overdue approval(s)`);
  if (openSignals > 0) watch.push(`${openSignals} open proactive signal(s)`);
  return { findings, watch };
}

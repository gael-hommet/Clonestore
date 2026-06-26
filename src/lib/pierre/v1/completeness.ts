// src/lib/pierre/v1/completeness.ts
// PHASE 8.2 — explainable employee completeness engine.

import type { SqlExecutor } from "./sql";
import { Errors } from "./errors";
import type { TenantContext } from "./tenant-context";
import { requirePermission } from "./rbac";

export type CompletenessItem = { id: string; label: string; status: "ok" | "missing" | "warning"; blocking: boolean; weight: number };
export type CompletenessResult = {
  employee_id: string;
  completeness_score: number;
  missing_items: CompletenessItem[];
  blocking_items: CompletenessItem[];
  warnings: CompletenessItem[];
  next_actions: string[];
  last_calculated_at: string;
};

export async function computeEmployeeCompleteness(db: SqlExecutor, ctx: TenantContext, employeeId: string): Promise<CompletenessResult> {
  requirePermission(ctx, "employee.read");
  const emp = (await db.query<{ id: string; first_name: string; last_name: string; employee_number: string | null; site_id: string | null; manager_employee_id: string | null }>(
    `select id, first_name, last_name, employee_number, site_id, manager_employee_id from pierre_rt_employees where company_id=$1 and id=$2`, [ctx.company_id, employeeId])).rows[0];
  if (!emp) throw Errors.notFound("Employee not found");

  const employments = (await db.query<{ n: number }>(`select count(*)::int n from pierre_rt_employee_employments where company_id=$1 and employee_id=$2`, [ctx.company_id, employeeId])).rows[0].n;
  const contracts = (await db.query<{ n: number }>(`select count(*)::int n from pierre_rt_employee_contracts where company_id=$1 and employee_id=$2`, [ctx.company_id, employeeId])).rows[0].n;
  const reqs = (await db.query<{ total: number; unmet: number }>(
    `select count(*)::int total, count(*) filter (where mandatory and not satisfied)::int unmet from pierre_rt_employee_document_requirements where company_id=$1 and employee_id=$2`, [ctx.company_id, employeeId])).rows[0];

  const items: CompletenessItem[] = [
    { id: "identity", label: "Identité (nom + matricule)", status: emp.first_name && emp.last_name && emp.employee_number ? "ok" : "missing", blocking: false, weight: 15 },
    { id: "site", label: "Site rattaché", status: emp.site_id ? "ok" : "missing", blocking: false, weight: 10 },
    { id: "manager", label: "Manager assigné", status: emp.manager_employee_id ? "ok" : "warning", blocking: false, weight: 10 },
    { id: "employment", label: "Emploi enregistré", status: employments > 0 ? "ok" : "missing", blocking: true, weight: 25 },
    { id: "contract", label: "Contrat enregistré", status: contracts > 0 ? "ok" : "missing", blocking: true, weight: 25 },
    { id: "mandatory_documents", label: "Documents obligatoires", status: reqs.unmet === 0 ? "ok" : "missing", blocking: reqs.unmet > 0, weight: 15 },
  ];

  const totalWeight = items.reduce((s, i) => s + i.weight, 0);
  const okWeight = items.filter((i) => i.status === "ok").reduce((s, i) => s + i.weight, 0);
  const score = Math.round((okWeight / totalWeight) * 100);

  const missing = items.filter((i) => i.status === "missing");
  const blocking = items.filter((i) => i.blocking && i.status !== "ok");
  const warnings = items.filter((i) => i.status === "warning");
  const next_actions = [
    ...blocking.map((i) => `Compléter (bloquant) : ${i.label}`),
    ...missing.filter((i) => !i.blocking).map((i) => `Compléter : ${i.label}`),
    ...warnings.map((i) => `À vérifier : ${i.label}`),
  ];

  return {
    employee_id: employeeId, completeness_score: score,
    missing_items: missing, blocking_items: blocking, warnings,
    next_actions, last_calculated_at: new Date().toISOString(),
  };
}

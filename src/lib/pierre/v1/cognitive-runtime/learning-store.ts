// src/lib/pierre/v1/cognitive-runtime/learning-store.ts
// PHASE 8.14 (D8) — wires the learning policy to real persistence. A human correction is classified
// (learning-policy), neutralized (no tenant identifiers), and persisted COMPANY-SCOPED to
// pierre_rt_cognitive_learning — UNLESS it is legal/canonical (never learned) or not writable. A future
// interpretation can retrieve APPROVED company preferences. No cross-company reuse (company_id on every
// query + RLS). An unapproved one-off stays temporary.

import { classifyCorrection, neutralizeCorrection, type CorrectionInput, type CorrectionClassification } from "./learning-policy";

type Db = { query<T = Record<string, unknown>>(text: string, params?: readonly unknown[]): Promise<{ rows: T[] }> };
type Ctx = { company_id: string; user_id: string };

export type RecordedCorrection = { persisted: boolean; scope: CorrectionClassification["scope"]; reason: string };

/** Capture a correction: classify → neutralize → persist (company-scoped) if writable. */
export async function recordCorrection(db: Db, ctx: Ctx, input: Omit<CorrectionInput, "companyId">): Promise<RecordedCorrection> {
  const c = classifyCorrection({ ...input, companyId: ctx.company_id });
  if (!c.writable) return { persisted: false, scope: c.scope, reason: c.reason }; // legal/canonical → never learned
  const neutral = neutralizeCorrection(input.text);
  const approved = c.scope === "company_policy";
  await db.query(
    `insert into pierre_rt_cognitive_learning (id, company_id, actor_id, scope, text, approved)
       values (gen_random_uuid(), $1, $2, $3, $4, $5)`,
    [ctx.company_id, ctx.user_id, c.scope, neutral, approved],
  );
  return { persisted: true, scope: c.scope, reason: c.reason };
}

/** Retrieve reusable APPROVED company preferences/policies for this company (never another company's). */
export async function retrieveCompanyPreferences(db: Db, ctx: Ctx): Promise<Array<{ scope: string; text: string }>> {
  const rows = await db.query<{ scope: string; text: string }>(
    `select scope, text from pierre_rt_cognitive_learning
       where company_id = $1 and approved = true and scope in ('company_preference','company_policy')
       order by created_at desc limit 50`,
    [ctx.company_id],
  );
  return rows.rows;
}

// src/lib/clonechat/durable/support-store.ts
// P9.4.1 — Mémoire de support/bugs DURABLE (Postgres). Occurrences TENANT-LOCALES
// (RLS par company) + cas globaux NEUTRALISÉS (reusable seulement après vérification).
// Un signalement n'est jamais réutilisable tant qu'un humain interne ne l'a pas vérifié.

import type { ClonechatDb } from "./pg";
import type { SupportMemory, SupportCtx, ReportInput, CreateCaseInput, SupportCase, ReusableMatch, ReusableCase, SupportStatus } from "../support-memory";
import { fingerprint, redactSymptom, symptomSimilarity } from "../bug-memory";

const REUSE_THRESHOLD = 0.34;

function mapReusable(r: Record<string, unknown>): ReusableCase {
  return { fingerprint: String(r.fingerprint), title: String(r.title), workaround: (r.workaround as string) ?? null, solution: (r.solution as string) ?? null, status: r.status as SupportStatus, reusable: r.reusable === true, occurrences: Number(r.occurrences) };
}
function mapCase(r: Record<string, unknown>): SupportCase {
  return { id: String(r.id), title: String(r.title), status: r.status as SupportStatus, severity: r.severity as SupportCase["severity"], redactedSummary: String(r.redacted_summary), createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at) };
}

export function createDurableSupportMemory(db: ClonechatDb): SupportMemory {
  return {
    async findReusable(symptoms) {
      const fp = fingerprint(symptoms);
      return db.withInternal(async (q): Promise<ReusableMatch> => {
        // exact match reusable
        const exact = await q.query("select * from clonechat_bug_cases where fingerprint = $1 and reusable = true", [fp]);
        if (exact.rows[0]) return { matched: true, case: mapReusable(exact.rows[0]), score: 1 };
        // fuzzy over reusable-only
        const all = await q.query("select * from clonechat_bug_cases where reusable = true limit 200");
        let best: Record<string, unknown> | null = null, bestScore = 0;
        for (const row of all.rows) {
          const syms = (row.symptoms as string[]) ?? [];
          const score = syms.length ? Math.max(0, ...syms.map((s) => symptomSimilarity(symptoms, s))) : 0;
          if (score > bestScore) { bestScore = score; best = row; }
        }
        if (best && bestScore >= REUSE_THRESHOLD) return { matched: true, case: mapReusable(best), score: bestScore };
        return { matched: false, case: null, score: bestScore };
      });
    },

    async report(ctx: SupportCtx, input: ReportInput) {
      const fp = fingerprint(input.symptoms);
      const redacted = redactSymptom(input.symptoms);
      // 1) occurrence tenant-locale (RLS company)
      await db.withTenant({ companyId: ctx.companyId, userId: ctx.userId ?? "" }, async (q) => {
        await q.query(
          `insert into clonechat_bug_occurrences (fingerprint, company_id, user_id, route, release_channel, redacted_symptom, evidence, created_at)
           values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)`,
          [fp, ctx.companyId, ctx.userId ?? null, input.route ?? null, input.release ?? null, redacted, JSON.stringify(input.evidence ?? []), input.at],
        );
      });
      // 2) cas global neutralisé (reported, NON réutilisable) — écriture interne
      return db.withInternal(async (q) => {
        const r = await q.query<{ occurrences: number }>(
          `insert into clonechat_bug_cases (fingerprint, title, symptoms, status, reusable, occurrences, first_seen_at, last_seen_at)
             values ($1,$2,array[$3],'reported',false,1,$4,$4)
           on conflict (fingerprint) do update
             set occurrences = clonechat_bug_cases.occurrences + 1,
                 last_seen_at = $4,
                 symptoms = (select array(select distinct e from unnest(clonechat_bug_cases.symptoms || array[$3]) e) )
           returning occurrences`,
          [fp, redacted.slice(0, 120), redacted, input.at],
        );
        return { fingerprint: fp, occurrences: Number(r.rows[0].occurrences) };
      });
    },

    async verify(fp, kind, by, text, at) {
      await db.withInternal(async (q) => {
        const col = kind === "workaround" ? "workaround" : "solution";
        const status: SupportStatus = kind === "workaround" ? "workaround_verified" : "solution_verified";
        await q.query(
          `update clonechat_bug_cases set ${col} = $2, status = $3, reusable = true, verified_by = $4, verified_at = $5, version = version + 1 where fingerprint = $1`,
          [fp, text, status, by, at],
        );
      });
    },

    async createSupportCase(ctx: SupportCtx, input: CreateCaseInput) {
      return db.withTenant({ companyId: ctx.companyId, userId: ctx.userId ?? "" }, async (q) => {
        const r = await q.query(
          `insert into clonechat_support_cases (company_id, user_id, fingerprint, title, severity, redacted_summary, created_at, updated_at)
           values ($1,$2,$3,$4,$5,$6,$7,$7) returning *`,
          [ctx.companyId, ctx.userId ?? "", input.fingerprint ?? null, input.title.slice(0, 120), input.severity ?? "normal", redactSymptom(input.summary), input.at],
        );
        return mapCase(r.rows[0]);
      });
    },

    async listSupportCases(ctx: SupportCtx, limit = 20) {
      return db.withTenant({ companyId: ctx.companyId, userId: ctx.userId ?? "" }, async (q) => {
        const r = await q.query("select * from clonechat_support_cases where company_id = $1 order by created_at desc limit $2", [ctx.companyId, limit]);
        return r.rows.map(mapCase);
      });
    },

    async getSupportCase(id, ctx: SupportCtx) {
      return db.withTenant({ companyId: ctx.companyId, userId: ctx.userId ?? "" }, async (q) => {
        const r = await q.query("select * from clonechat_support_cases where id = $1 and company_id = $2", [id, ctx.companyId]);
        return r.rows[0] ? mapCase(r.rows[0]) : null;
      });
    },
  };
}

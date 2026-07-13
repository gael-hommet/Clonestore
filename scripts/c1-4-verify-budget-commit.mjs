#!/usr/bin/env node
// scripts/c1-4-verify-budget-commit.mjs
// C1.4 §12 — Vérifie DANS LA BASE que l'appel OpenAI réel a bien été comptabilisé :
// compteurs de budget engagés (committed > 0), aucune réservation fuitée (reserved = 0),
// et événements d'usage enregistrés. N'imprime aucun secret ni DSN.

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();
const URL_ = readFileSync(resolve(ROOT, ".c1-4-local-db-url"), "utf8").trim();
const { default: pg } = await import("pg");
const pool = new pg.Pool({ connectionString: URL_, max: 2 });

const day = new Date().toISOString().slice(0, 10);

const counters = await pool.query(
  `select scope_key, window_kind, committed_tokens, reserved_tokens
     from clonechat_budget_counters
    where scope_key like 'u:%' or scope_key like 'g:%'
    order by scope_key`,
);

const usage = await pool.query(
  `select model, input_tokens, output_tokens, kind, company_id, user_id is not null as has_user
     from clonechat_usage_events order by at desc limit 5`,
);

const rows = counters.rows.map((r) => ({
  scope: r.scope_key.replace(/^(u:)[0-9a-f-]{8}[0-9a-f-]*/i, "$1<userId>"), // jamais l'ID brut
  kind: r.window_kind,
  committed: Number(r.committed_tokens),
  reserved: Number(r.reserved_tokens),
}));

const out = {
  day,
  budgetCounters: rows,
  anyCommitted: rows.some((r) => r.committed > 0),
  noLeakedReservation: rows.every((r) => r.reserved === 0),
  usageEvents: usage.rows.map((u) => ({
    model: u.model,
    inputTokens: u.input_tokens,
    outputTokens: u.output_tokens,
    kind: u.kind,
    companyIdIsNull: u.company_id === null, // découverte : aucune entreprise inventée
    userRecorded: u.has_user,
  })),
  usageEventsRecorded: usage.rows.length > 0,
  noFakeCompanyInUsage: usage.rows.every((u) => u.company_id === null),
};

await pool.end();

const dir = resolve(ROOT, ".c1-4-proofs", "access-openai-runtime");
mkdirSync(dir, { recursive: true });
writeFileSync(resolve(dir, "real-openai-budget-commit.json"), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));

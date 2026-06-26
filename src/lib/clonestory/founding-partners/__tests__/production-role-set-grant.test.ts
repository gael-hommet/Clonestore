// CloneStory — non-régression d'activation production.
// Défaut réel constaté en prod (PostgreSQL 16+ / Supabase) : le rôle de connexion
// `postgres` (BYPASSRLS) ne pouvait pas `set local role pierre_rt_app` car son
// appartenance n'avait pas l'option SET → « permission denied to set role » →
// RLS FORCÉE inapplicable au runtime. La migration _01 doit donc accorder
// explicitement l'option SET au rôle de connexion (idempotent, toléré en local).

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const MIG = resolve(
  process.cwd(),
  "supabase/migrations/2026-06-24_01__clonestory_fp_founding_partners.sql",
);

describe("migration _01 — capacité SET ROLE pierre_rt_app (PG16+)", () => {
  const sql = readFileSync(MIG, "utf8");

  it("accorde pierre_rt_app au rôle de connexion AVEC l'option SET", () => {
    // grant ... to <current_user> with set true (insensible à la casse / espaces)
    expect(sql).toMatch(/grant\s+pierre_rt_app\s+to\s+%I\s+with\s+set\s+true/i);
  });

  it("utilise current_user (pas un rôle codé en dur)", () => {
    expect(sql).toMatch(/format\(\s*'grant pierre_rt_app to %I with set true'\s*,\s*current_user\s*\)/i);
  });

  it("tolère l'échec en environnement superuser/local (exception swallow)", () => {
    // le grant est dans un bloc begin/exception when others then null
    expect(sql).toMatch(/exception\s+when\s+others\s+then\s+null/i);
  });
});

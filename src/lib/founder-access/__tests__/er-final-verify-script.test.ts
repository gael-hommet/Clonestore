// Non-régression : le script opérateur verify-founder-access-production-db.mjs doit
// utiliser la vérification append-only ROBUSTE (tentative de mutation + repli structurel
// sur le trigger anti-mutation), alignée sur production-verify.ts — et NON la version
// fragile « where false » seule (faux négatif sous le propriétaire postgres / table vide).
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const script = readFileSync(resolve(process.cwd(), "scripts/verify-founder-access-production-db.mjs"), "utf-8");

describe("verify-founder-access-production-db.mjs — append-only robuste", () => {
  it("confirme le trigger anti-mutation via pg_trigger + clonestore_forbid_mutation", () => {
    expect(script).toMatch(/pg_trigger/);
    expect(script).toMatch(/clonestore_forbid_mutation/);
    expect(script).toMatch(/not tg\.tgisinternal/);
  });

  it("tente d'abord la mutation puis retombe sur le contrôle structurel", () => {
    // Les deux tables append-only sont vérifiées par la voie robuste.
    expect(script).toMatch(/append_only:funnel_update_blocked/);
    expect(script).toMatch(/append_only:audit_delete_blocked/);
    // La logique passe par une fonction de repli (trigger armé) — pas un simple try/catch isolé.
    expect(script).toMatch(/triggerArmed|trigger anti-mutation/);
  });
});

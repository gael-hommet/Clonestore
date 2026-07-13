// src/lib/pierre/__tests__/access-contract-c1-4.test.ts
// C1.4 §13.A — CONTRAT D'ACCÈS PIERRE. Exerce la fonction RÉELLE contre un client Supabase
// simulé au niveau de la requête (aucun réseau). Prouve que le droit vient UNIQUEMENT du
// serveur, que l'échec de requête n'est jamais confondu avec « pas de droit », et — surtout —
// qu'AUCUN call site ne peut plus se contenter de la truthiness de l'objet.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  hasPierreAccess,
  isPierreAccessGranted,
  isPierreAccessLookupFailed,
  PIERRE_ACTIVE_STATUSES,
  PIERRE_ACCESS_LOOKUP_FAILED,
} from "../access";

const USER = "aaaaaaaa-1111-4111-8111-111111111111";

/** Client Supabase simulé : la chaîne .from().select().eq().eq().in().maybeSingle() */
function fakeSupabase(result: { data: unknown; error: unknown }, capture?: { statuses?: readonly string[] }): SupabaseClient {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = self;
  chain.eq = self;
  chain.in = (_col: string, values: readonly string[]) => { if (capture) capture.statuses = values; return chain; };
  chain.maybeSingle = async () => result;
  return { from: () => chain } as unknown as SupabaseClient;
}

describe("C1.4 — contrat hasPierreAccess (union discriminée)", () => {
  it("1. commande active → ok:true (+ status, orderId)", async () => {
    const r = await hasPierreAccess(fakeSupabase({ data: { id: "ord-1", status: "active" }, error: null }), USER);
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.status).toBe("active"); expect(r.orderId).toBe("ord-1"); expect(r.error).toBeNull(); }
    expect(isPierreAccessGranted(r)).toBe(true);
  });

  it("2. commande trialing → ok:true (l'essai accorde l'accès)", async () => {
    const r = await hasPierreAccess(fakeSupabase({ data: { id: "ord-2", status: "trialing" }, error: null }), USER);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.status).toBe("trialing");
  });

  it("3. aucune commande → NO_ENTITLEMENT (état normal, pas une erreur)", async () => {
    const r = await hasPierreAccess(fakeSupabase({ data: null, error: null }), USER);
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.reason).toBe("NO_ENTITLEMENT"); expect(r.error).toBeNull(); }
    expect(isPierreAccessGranted(r)).toBe(false);
    expect(isPierreAccessLookupFailed(r)).toBe(false);
  });

  it("4/5. statut non accordant (cancelled/unpaid/incomplete/expired/refunded) → NO_ENTITLEMENT", async () => {
    for (const status of ["cancelled", "unpaid", "incomplete", "expired", "refunded", "past_due", "bogus"]) {
      // Défense en profondeur : même si la requête renvoyait une ligne, le statut est RE-VALIDÉ.
      const r = await hasPierreAccess(fakeSupabase({ data: { id: "ord-x", status }, error: null }), USER);
      expect(r.ok, status).toBe(false);
      if (!r.ok) expect(r.reason, status).toBe("NO_ENTITLEMENT");
    }
  });

  it("6. erreur base → LOOKUP_FAILED (JAMAIS confondu avec « pas de droit »)", async () => {
    const r = await hasPierreAccess(fakeSupabase({ data: null, error: { message: 'role "clonechat_app" does not exist' } }), USER);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("LOOKUP_FAILED");
      // Le message BRUT de la base n'est jamais renvoyé (fuite de schéma fermée).
      expect(r.error).toBe(PIERRE_ACCESS_LOOKUP_FAILED);
      expect(String(r.error)).not.toMatch(/clonechat_app|does not exist|role/i);
    }
    expect(isPierreAccessLookupFailed(r)).toBe(true);
    expect(isPierreAccessGranted(r)).toBe(false);
  });

  it("6bis. exception du client → LOOKUP_FAILED (fail-closed, jamais de throw)", async () => {
    const throwing = { from: () => { throw new Error("network down"); } } as unknown as SupabaseClient;
    const r = await hasPierreAccess(throwing, USER);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("LOOKUP_FAILED");
  });

  it("7. résultat = union discriminée (ok:false ⇒ reason obligatoire)", async () => {
    const granted = await hasPierreAccess(fakeSupabase({ data: { id: "o", status: "active" }, error: null }), USER);
    const denied = await hasPierreAccess(fakeSupabase({ data: null, error: null }), USER);
    expect(Object.hasOwn(granted, "ok")).toBe(true);
    expect(granted.ok === true && Object.hasOwn(granted, "status")).toBe(true);
    expect(denied.ok === false && Object.hasOwn(denied, "reason")).toBe(true);
  });

  it("9. le droit provient UNIQUEMENT des statuts serveur active/trialing", async () => {
    const cap: { statuses?: readonly string[] } = {};
    await hasPierreAccess(fakeSupabase({ data: null, error: null }, cap), USER);
    expect(cap.statuses).toEqual([...PIERRE_ACTIVE_STATUSES]);
    expect(PIERRE_ACTIVE_STATUSES).toEqual(["active", "trialing"]);
  });
});

// ═══════════ 8 + 10 — AUCUN call site ne s'appuie sur la truthiness d'objet ═══
describe("C1.4 — audit des call sites (anti-régression du bug de truthiness)", () => {
  const ROOT = process.cwd();

  function walk(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) { if (name !== "node_modules" && name !== ".next") walk(p, out); }
      else if (/\.(ts|tsx)$/.test(name)) out.push(p);
    }
    return out;
  }

  /** Fichiers qui IMPORTENT le contrat partagé (les routes avec un helper local booléen sont hors sujet). */
  const importers = walk(resolve(ROOT, "src")).filter((f) => {
    const src = readFileSync(f, "utf8");
    return /from\s+["'][^"']*lib\/pierre\/access["']/.test(src) && !f.includes("__tests__");
  });

  it("8. aucun consommateur n'évalue la truthiness de l'objet (`if (!access)` / `if (access)`)", () => {
    expect(importers.length).toBeGreaterThan(0);
    const offenders: string[] = [];
    for (const f of importers) {
      const src = readFileSync(f, "utf8");
      // Motif interdit : le résultat de hasPierreAccess testé DIRECTEMENT (sans .ok / .reason).
      // ex. `if (!access)` , `if (access)` , `access ? ... : ...`
      const bad = [
        /\bif\s*\(\s*!\s*(access|accessResult|hasAccess|res)\s*\)/,
        /\bif\s*\(\s*(access|accessResult)\s*\)/,
        /\b(access|accessResult)\s*\?\s*[^.]/,
      ];
      // On ne considère la variable que si elle vient bien de hasPierreAccess dans ce fichier.
      if (!/await\s+hasPierreAccess\s*\(/.test(src)) continue;
      if (bad.some((rx) => rx.test(src))) offenders.push(f.replace(ROOT, "."));
    }
    expect(offenders, `truthiness d'objet détectée dans : ${offenders.join(", ")}`).toEqual([]);
  });

  it("10. le droit n'est jamais lu du corps de requête (aucune forge client)", () => {
    const routeSrc = readFileSync(resolve(ROOT, "src/app/api/assistant/chat/route.ts"), "utf8");
    // L'entitlement vient de hasPierreAccess(supabase, userId) — pas du body.
    // C1.6 — l'identité est portée par `viewer` (anonyme | utilisateur). L'INTENTION est
    // inchangée : le droit vient TOUJOURS du serveur, jamais du corps de la requête.
    expect(routeSrc).toMatch(/await hasPierreAccess\(supabase, viewer\.userId\)/);
    expect(routeSrc).not.toMatch(/body[^\n]*\.(entitlement|access|pierre_access|role)\b/);
  });
});

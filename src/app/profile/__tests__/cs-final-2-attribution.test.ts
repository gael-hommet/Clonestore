// CS-FINAL 2 — moteur d'attribution (structure, sécurité, câblage, migrations).

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

const ENGINE = read("src/lib/clonestory/founding-partners/server/attribution.ts");
const COOKIE = read("src/lib/clonestory/founding-partners/server/attribution-cookie.ts");
const VISIT = read("src/app/api/founding-partners/attribution/visit/route.ts");
const CAPTURE = read("src/app/api/founding-partners/attribution/capture/route.ts");
const BEACON = read("src/components/clonestory/AttributionBeacon.tsx");
const RPAGE = read("src/app/founding-partners/r/[token]/page.tsx");
const CARD = read("src/app/profile/_ui/CloneStoryCockpitCard.tsx");
const COCKPIT = read("src/lib/clonestory/founding-partners/server/cockpit.ts");
const MIG06 = read("supabase/migrations/2026-06-26_06__clonestory_fp_attribution_engine.sql");
const MIG05 = read("supabase/migrations/2026-06-25_05__clonestory_fp_partner_account_and_distinctions.sql");

describe("règles d'attribution verrouillées", () => {
  it("priorité : introduction confirmée > lien ; attribution existante conservée", () => {
    expect(ENGINE).toMatch(/P_INTRODUCTION\s*=\s*100/);
    expect(ENGINE).toMatch(/P_LINK\s*=\s*50/);
    expect(ENGINE).toContain("existing_kept"); // aucun vol d'une attribution existante
    expect(ENGINE).toContain("superseded_by_confirmed_introduction");
  });
  it("auto-attribution refusée + partenaire suspendu inéligible", () => {
    expect(ENGINE).toMatch(/pemail !== emailNorm/); // non self
    expect(ENGINE).toMatch(/eligible\(/); // statut non suspendu/retiré
  });
  it("entreprise : déduplication par empreinte, jamais sur domaine générique / IP seule", () => {
    expect(ENGINE).toContain("GENERIC_DOMAINS");
    expect(ENGINE).toContain("company_already_attributed"); // pas de vol d'entreprise
    expect(ENGINE).toContain("companyFingerprint");
  });
  it("machine d'états : avance UNIQUEMENT vers l'avant", () => {
    expect(ENGINE).toMatch(/INTRO_ORDER/);
    expect(ENGINE).toContain("advanceIntroductionStatus");
    expect(ENGINE).toMatch(/<=\s*\(INTRO_ORDER\[cur\.status\]/); // pas de retour arrière
  });
  it("événements append-only du moteur + événements partenaire (contribution)", () => {
    expect(ENGINE).toContain("attribution_conflict_detected");
    expect(ENGINE).toContain("attribution_superseded");
    expect(ENGINE).toContain("clonestory_fp_attribution_events");
    expect(ENGINE).toContain("clonestory_fp_contribution_events"); // prospect_registered/company_created
  });
});

describe("cookie d'attribution", () => {
  it("signé, HttpOnly, SameSite=Lax, opaque (visiteur), versionné v1, 90 jours", () => {
    expect(COOKIE).toContain("csy_attribution_v1");
    expect(COOKIE).toContain("HttpOnly");
    expect(COOKIE).toContain("SameSite=Lax");
    expect(COOKIE).toContain("signCookie");
    expect(COOKIE).toMatch(/90 \* 24 \* 60 \* 60 \* 1000/);
    expect(COOKIE).not.toContain("email"); // aucune donnée perso
  });
});

describe("câblage réel", () => {
  it("visit : rate-limit, résolution par code, cookie first-touch (ne réécrit pas l'existant)", () => {
    expect(VISIT).toContain("rateLimit");
    expect(VISIT).toContain("findPartnerByCode");
    expect(VISIT).toContain("capturePartnerVisit");
    expect(VISIT).toMatch(/if \(!existingVisitorId\) res\.headers\.set\("set-cookie"/); // first-touch préservé
  });
  it("capture : AUTHENTIFIÉE serveur (e-mail de session, jamais du body), idempotente", () => {
    expect(CAPTURE).toContain("supabaseServer");
    expect(CAPTURE).toContain("auth.getUser");
    expect(CAPTURE).toContain("captureAccountAttribution");
    expect(CAPTURE).toContain("company_name"); // signal entreprise authentifié
    expect(CAPTURE).not.toMatch(/body\.email/); // l'e-mail ne vient JAMAIS du body
  });
  it("beacon JS sur /r (filtre les bots sans JS) + capture déclenchée au chargement du cockpit", () => {
    expect(BEACON).toContain("attribution/visit");
    expect(RPAGE).toContain("<AttributionBeacon code={token} />");
    expect(CARD).toContain("attribution/capture");
  });
  it("cockpit : comptes/entreprises lus du moteur, repli gracieux si _06 non activée", () => {
    expect(COCKPIT).toContain("clonestory_fp_attributions");
    expect(COCKPIT).toContain("companiesCreated");
    expect(COCKPIT).toMatch(/catch\s*\{[^}]*table absente/);
  });
});

describe("migrations _06 + _05", () => {
  it("_06 : tables attributions/événements, index actifs uniques (compte+entreprise), append-only, RLS", () => {
    expect(MIG06).toContain("create table if not exists clonestory_fp_attributions");
    expect(MIG06).toContain("create table if not exists clonestory_fp_attribution_events");
    expect(MIG06).toContain("uq_csy_attr_active_account"); // une attribution active par compte
    expect(MIG06).toContain("uq_csy_attr_active_company"); // une par entreprise
    expect(MIG06).toContain("force  row level security");
    expect(MIG06).toContain("clonestory_forbid_mutation"); // événements append-only
    expect(MIG06).toMatch(/ROLLBACK/i);
    expect(MIG06).not.toMatch(/\bdelete from\b/i);
  });
  it("_05 corrigée : account_user_id UNIQUE (un compte ↔ un partenaire)", () => {
    expect(MIG05).toContain("create unique index if not exists uq_csy_partner_account");
  });
});

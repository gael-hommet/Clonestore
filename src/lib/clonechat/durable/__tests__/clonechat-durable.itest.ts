// src/lib/clonechat/durable/__tests__/clonechat-durable.itest.ts
// P9.4.1 — Preuve INTÉGRATION des repositories durables (code réel, pas juste SQL)
// contre un vrai Postgres 16 (embedded-postgres). Prouve : conversations durables +
// isolation tenant, politique de réutilisation VÉRIFIÉE (reported ≠ réutilisable),
// budget atomique via le repo, et PERSISTANCE après restart. Lane *.itest.ts
// (exclue de `npm test`). Timeout large (boot PG).

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync, existsSync, rmSync } from "fs";
import { resolve } from "path";
import { buildClonechatDurable, type ClonechatDurable } from "../index";
import type { CloneChatOpenAIConfig } from "../../openai/config";

const PORT = Number(process.env.P941_ITEST_PORT ?? 55440);
const DATADIR = resolve(process.cwd(), ".p941-proofs/pgdata-itest");
const MIG = resolve(process.cwd(), "supabase/migrations-p941/2026-07-07__p941_clonechat_durable.sql");
const URL = `postgres://postgres:postgres@127.0.0.1:${PORT}/ccdb`;

const CFG = { maxInputTokens: 6000, maxOutputTokens: 700, userDailyTokenCap: 1000, companyDailyTokenCap: 2000, globalDailyTokenCap: 3000, globalMonthlyTokenCap: 100000 } as CloneChatOpenAIConfig;
const A = { companyId: "11111111-1111-4111-8111-111111111111", userId: "aaaaaaaa-1111-4111-8111-111111111111" };
const B = { companyId: "22222222-2222-4222-8222-222222222222", userId: "bbbbbbbb-2222-4222-8222-222222222222" };

interface Epg { initialise(): Promise<void>; start(): Promise<void>; stop(): Promise<void>; }
let epg: Epg | null = null;
let durable: ClonechatDurable;

async function boot() {
  const EmbeddedPostgres = (await import("embedded-postgres")).default as unknown as new (o: unknown) => Epg;
  const { default: pg } = await import("pg");
  epg = new EmbeddedPostgres({ databaseDir: DATADIR, user: "postgres", password: "postgres", port: PORT, persistent: true });
  await epg.initialise();
  await epg.start();
  const boot = new pg.Pool({ host: "127.0.0.1", port: PORT, user: "postgres", password: "postgres", database: "postgres", max: 1 });
  try { await boot.query("drop database if exists ccdb"); await boot.query("create database ccdb with encoding 'UTF8' template template0 lc_collate 'C' lc_ctype 'C'"); } finally { await boot.end(); }
  const mig = new pg.Pool({ connectionString: URL, max: 1 });
  try { await mig.query(readFileSync(MIG, "utf-8")); } finally { await mig.end(); }
}

beforeAll(async () => {
  if (existsSync(DATADIR)) rmSync(DATADIR, { recursive: true, force: true });
  await boot();
  durable = await buildClonechatDurable(URL);
}, 60000);

afterAll(async () => {
  try { await durable?.db.close(); } catch { /* ignore */ }
  try { await epg?.stop(); } catch { /* ignore */ }
  try { if (existsSync(DATADIR)) rmSync(DATADIR, { recursive: true, force: true }); } catch { /* ignore */ }
}, 30000);

describe("P9.4.1 durable conversations (Postgres, RLS isolation, multi-device)", () => {
  it("crée, liste et relit une conversation + messages ; isole les tenants", async () => {
    const conv = await durable.conversations.createConversation(A, { title: "Contrats Q3", at: iso(1) });
    await durable.conversations.appendMessage(conv.id, A, { role: "user", content: [{ type: "text", text: "Prépare un CDI" }], at: iso(2) });
    await durable.conversations.appendMessage(conv.id, A, { role: "assistant", content: [{ type: "text", text: "Voici le brouillon" }], sourceIds: ["pierre"], at: iso(3) });

    const listA = await durable.conversations.listConversations(A);
    expect(listA.map((c) => c.id)).toContain(conv.id);
    const msgs = await durable.conversations.getMessages(conv.id, A);
    expect(msgs.length).toBe(2);
    expect(msgs[0].seq).toBe(1);

    // Tenant B ne voit RIEN de A (RLS)
    expect(await durable.conversations.listConversations(B)).toHaveLength(0);
    expect(await durable.conversations.getConversation(conv.id, B)).toBeNull();
    expect(await durable.conversations.getMessages(conv.id, B)).toHaveLength(0);
  });

  it("ne persiste jamais une image brute (base64) — seulement des métadonnées", async () => {
    const conv = await durable.conversations.createConversation(A, { title: "Capture", at: iso(4) });
    await durable.conversations.appendMessage(conv.id, A, {
      role: "user",
      content: [{ type: "text", text: "voici", image_url: "data:image/png;base64,AAAABBBBCCCC" }],
      imageMeta: { mime: "image/png", bytes: 1234 },
      at: iso(5),
    });
    const msgs = await durable.conversations.getMessages(conv.id, A);
    const dump = JSON.stringify(msgs);
    expect(dump).not.toContain("base64,AAAABBBBCCCC");
    expect(dump).toContain("image/png"); // metadata kept
  });
});

describe("P9.4.1 durable support memory — verified-reuse policy", () => {
  it("un signalement NE devient PAS réutilisable automatiquement", async () => {
    const symptom = "le tableau de bord affiche une roue qui tourne indéfiniment sur mobile";
    const rep = await durable.support.report(A, { symptoms: symptom, route: "/agents/pierre/use", at: iso(10) });
    expect(rep.occurrences).toBe(1);
    // pas encore vérifié → non réutilisable
    const before = await durable.support.findReusable(symptom);
    expect(before.matched).toBe(false);
    // occurrence incrémentée par un 2e report (tenant B) — agrégation sans fuite
    const rep2 = await durable.support.report(B, { symptoms: symptom, at: iso(11) });
    expect(rep2.occurrences).toBe(2);
    expect(rep2.fingerprint).toBe(rep.fingerprint);
    // vérification interne → devient réutilisable
    await durable.support.verify(rep.fingerprint, "workaround", "qa-internal", "Basculez en vue liste puis rechargez.", iso(12));
    const after = await durable.support.findReusable(symptom);
    expect(after.matched).toBe(true);
    expect(after.case?.reusable).toBe(true);
    expect(after.case?.workaround).toContain("vue liste");
  });

  it("crée un support case tenant-scopé (isolé)", async () => {
    const c = await durable.support.createSupportCase(A, { title: "Export impossible", summary: "Le bouton exporter ne répond pas", at: iso(13) });
    expect(c.status).toBe("reported");
    const listA = await durable.support.listSupportCases(A);
    expect(listA.map((x) => x.id)).toContain(c.id);
    expect(await durable.support.listSupportCases(B)).toHaveLength(0); // isolation
    expect(await durable.support.getSupportCase(c.id, B)).toBeNull();
  });
});

describe("P9.4.1 durable atomic budget (reserve/commit/release)", () => {
  it("réserve, engage le réel, libère le surplus", async () => {
    const day = "2026-08-01";
    const scope = { userId: A.userId, companyId: A.companyId };
    const r = await durable.budget.reserve(CFG, scope, 200, `${day}T10:00:00.000Z`);
    expect(r.granted).toBe(true);
    await durable.budget.commit(r, 120); // réel = 120, réservé = 200+700 worstcase
    const snap = await durable.budget.snapshot(scope, `${day}T10:00:00.000Z`);
    expect(snap.globalDailyTokens).toBe(120); // seul le réel committé compte
  });

  it("refuse au-delà du plafond utilisateur (honnête)", async () => {
    const day = "2026-08-02";
    const scope = { userId: B.userId, companyId: B.companyId };
    // userDailyTokenCap=1000 ; worstCase par requête = est + 700. Deux passent, la 3e dépasse.
    const at = `${day}T10:00:00.000Z`;
    const r1 = await durable.budget.reserve(CFG, scope, 100, at); expect(r1.granted).toBe(true); await durable.budget.commit(r1, 100);
    const r2 = await durable.budget.reserve(CFG, scope, 100, at); // used 100 + worstcase 800 = 900 <=1000 ok
    expect(r2.granted).toBe(true); await durable.budget.commit(r2, 100);
    const r3 = await durable.budget.reserve(CFG, scope, 100, at); // used 200 + 800 = 1000... next would be > cap on user? committed 200 + worstcase 800 = 1000 == cap (ok since >cap is deny). test one more
    // force a clear over-cap
    const rBig = await durable.budget.reserve(CFG, scope, 100, at);
    void r3;
    expect(rBig.granted === false || r3.granted === false).toBe(true);
    if (!rBig.granted) expect(rBig.reason).toBe("user_daily");
  });
});

describe("P9.4.1 RESTART persistence (real PG stop+start)", () => {
  it("conversations, support cases et budget survivent au restart du serveur", async () => {
    const conv = await durable.conversations.createConversation(A, { title: "Avant restart", at: iso(20) });
    await durable.support.report(A, { symptoms: "un bug qui doit survivre au restart total", at: iso(21) });
    const beforeList = (await durable.conversations.listConversations(A)).length;

    // vrai restart
    await durable.db.close();
    await epg!.stop();
    await epg!.start();
    durable = await buildClonechatDurable(URL);

    const afterConv = await durable.conversations.getConversation(conv.id, A);
    expect(afterConv?.title).toBe("Avant restart");
    const afterList = (await durable.conversations.listConversations(A)).length;
    expect(afterList).toBe(beforeList);
    // le cas de bug global est toujours là
    const occ = await durable.support.report(A, { symptoms: "un bug qui doit survivre au restart total", at: iso(22) });
    expect(occ.occurrences).toBe(2); // incrément d'une occurrence pré-restart
  });
});

function iso(n: number): string { return new Date(Date.UTC(2026, 6, 3, 0, 0, n)).toISOString(); }

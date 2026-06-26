// CS-FINAL 4 — durcissement, conformité, administration : structure & sécurité.

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");
const exists = (p: string) => existsSync(resolve(process.cwd(), p));

describe("anti-scanner : GET non destructif, consommation POST", () => {
  it("verify/confirm/refuse n'ont PLUS de route GET ; pages intermédiaires + POST consume", () => {
    for (const seg of ["verify", "confirm", "refuse"]) {
      expect(exists(`src/app/founding-partners/${seg}/route.ts`), `GET handler ${seg} doit être supprimé`).toBe(false);
      expect(exists(`src/app/founding-partners/${seg}/page.tsx`), `page intermédiaire ${seg}`).toBe(true);
      expect(exists(`src/app/api/founding-partners/${seg}/route.ts`), `POST consume ${seg}`).toBe(true);
      const post = read(`src/app/api/founding-partners/${seg}/route.ts`);
      expect(post).toMatch(/export async function POST/);
      expect(post).not.toMatch(/export async function GET/);
      expect(post).toContain("sameOrigin"); // CSRF same-origin
    }
  });
  it("la page intermédiaire POST vers l'API, jamais de mutation au rendu", () => {
    const page = read("src/app/founding-partners/_ui/EmailActionInterstitial.tsx");
    expect(page).toContain('method="post"');
    expect(page).toContain("name=\"token\"");
  });
});

describe("tokens d'action stateless (aucun token brut en base)", () => {
  it("confirmation d'introduction = token stateless cloisonné par usage", () => {
    const store = read("src/lib/clonestory/founding-partners/server/store.ts");
    expect(store).toContain("buildActionToken");
    expect(store).toContain("parseActionToken");
    expect(store).toContain("peekIntroductionAction");
    expect(store).toContain("peekVerification");
    // l'insertion d'introduction ne stocke plus de hash de token (confirm_token_hash=null)
    expect(store).toContain("confirm_expires_at, confirm_generation)");
    expect(store).toContain("null,$9,1)"); // confirm_token_hash inséré = null
    expect(store).not.toContain("confirm_token_hash = $1"); // plus de lookup par hash
  });
});

describe("outbox de notifications unifiée (plus d'envoi direct fragile)", () => {
  it("introduce n'envoie plus en direct ; enqueue transactionnel", () => {
    const route = read("src/app/api/founding-partners/introduce/route.ts");
    expect(route).not.toContain("sendClonestoryEmail");
    expect(route).toContain("processNotificationsOutbox");
    const store = read("src/lib/clonestory/founding-partners/server/store.ts");
    expect(store).toContain("enqueueNotificationTx");
  });
  it("le worker ne stocke JAMAIS de token brut (reconstruction stateless)", () => {
    const notif = read("src/lib/clonestory/founding-partners/server/notifications.ts");
    expect(notif).toContain("buildActionToken"); // reconstruit le lien à l'envoi
    expect(notif).toContain("FOR UPDATE SKIP LOCKED".toLowerCase());
    expect(notif).toMatch(/provider_message_id/);
    expect(notif).not.toMatch(/insert[\s\S]*confirm_token|raw_token/i);
  });
});

describe("migration _08 (admin / conformité / observabilité)", () => {
  const m = read("supabase/migrations/2026-06-26_08__clonestory_fp_hardening_admin_compliance.sql");
  it("tables présentes, append-only, RLS forcée, aucun DELETE, rollback", () => {
    expect(m).toContain("clonestory_fp_notifications_outbox");
    expect(m).toContain("clonestory_fp_observability_events");
    expect(m).toContain("clonestory_fp_admin_notes");
    expect(m).toContain("clonestory_fp_fraud_decisions");
    expect(m).toContain("clonestory_fp_consents");
    expect(m).toContain("confirm_generation");
    expect(m).toContain("anonymized_at");
    expect(m).toContain("force  row level security");
    expect(m).toContain("clonestory_forbid_mutation");
    expect(m).toMatch(/ROLLBACK/i);
    expect(m).not.toMatch(/\bdelete from\b/i);
  });
});

describe("conformité RGPD : anonymisation NON destructive", () => {
  const c = read("src/lib/clonestory/founding-partners/server/compliance.ts");
  it("anonymise par UPDATE (jamais DELETE), conserve registry_number, tombstone non routable", () => {
    expect(c).not.toMatch(/\bdelete from\b/i);
    expect(c).toContain("anonymized_at = now()");
    expect(c).toContain("@clonestory.invalid"); // tombstone non routable
    expect(c).toContain("recordFraudDecisionTx");
    expect(c).toContain("retentionSweep");
  });
});

describe("santé interne protégée + interrupteurs d'incident", () => {
  it("health endpoint protégé (admin OU bearer), aucune donnée sensible", () => {
    const h = read("src/app/api/internal/clonestory/health/route.ts");
    expect(h).toContain("resolveFounderAdmin");
    expect(h).toContain("timingSafeEqual");
    expect(h).toContain("401");
  });
  it("feature flags fail-closed (kill-switch) câblés sur le pont commercial", () => {
    const cfg = read("src/lib/clonestory/founding-partners/server/config.ts");
    expect(cfg).toContain("clonestoryFeatureEnabled");
    const bridge = read("src/lib/clonestory/founding-partners/server/stripe-commercial-bridge.ts");
    expect(bridge).toContain('clonestoryFeatureEnabled("commercial_bridge")');
  });
  it("cron de notifications fail-closed (Bearer, 503/401)", () => {
    const cron = read("src/app/api/cron/clonestory-notifications/route.ts");
    expect(cron).toContain("timingSafeEqual");
    expect(cron).toContain("503");
    expect(cron).toContain("401");
  });
});

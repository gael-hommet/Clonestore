// src/lib/pierre/v1/__integration__/p86-e2e-no-raw-invitation-token.itest.ts
// PHASE 8.6 STEP 1 — the invitation token never leaves via the normal client API: in E2E mode the route
// returns only invitation_id/status/expires_at and delivers the token to the secret-gated Fake mailbox.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { recordE2EMail, readE2EMailbox, clearE2EMailbox } from "../e2e-fake-mailbox";

describe("P8.6 invitation token — never via the client API, only the provider mailbox", () => {
  it("the invitations route returns no raw token and never touches the mailbox directly", () => {
    const src = readFileSync(resolve(process.cwd(), "src/app/api/pierre/v1/invitations/route.ts"), "utf-8");
    // the route returns ONLY invitation_id/status/expires_at
    expect(src).toMatch(/invitation_id:\s*created\.id/);
    expect(src).toMatch(/return\s*\{\s*invitation_id[^}]*\}/);
    // it must NOT return a token, NOR enqueue/record to the mailbox directly — the token flows ONLY through
    // the real P8.4 pipeline (member.invited outbox → worker → provider).
    expect(src).not.toMatch(/raw_token/);
    expect(src).not.toMatch(/enqueueE2EDelivery|recordE2EMail|e2e-fake-mailbox/);
  });

  it("the mailbox is fed at the PROVIDER boundary and reads the token back", () => {
    clearE2EMailbox();
    // before any provider delivery, the mailbox is empty
    expect(readE2EMailbox({ kind: "invitation" }).length).toBe(0);
    // the provider (boundary) records the delivered invitation — this is the ONLY mailbox writer now.
    recordE2EMail({ id: "m1", to: "teammate@e2e.test", kind: "invitation", token: "raw-secret-token", link: "/invite/accept#token=raw-secret-token", subject: "Invitation", created_at: "2026-06-29T00:00:00Z" });
    const mail = readE2EMailbox({ to: "teammate@e2e.test", kind: "invitation" });
    expect(mail.length).toBe(1);
    expect(mail[0].token).toBe("raw-secret-token");
    clearE2EMailbox();
  });
});

describe("P8.6 mailbox route is fail-closed", () => {
  const env = process.env as Record<string, string | undefined>;
  let saved: Record<string, string | undefined>;
  beforeEach(() => { saved = { M: env.PIERRE_E2E_TEST_MODE, S: env.PIERRE_E2E_SECRET, N: env.NODE_ENV }; });
  afterEach(() => { const s = (k: string, v: string | undefined) => { if (v === undefined) delete env[k]; else env[k] = v; }; s("PIERRE_E2E_TEST_MODE", saved.M); s("PIERRE_E2E_SECRET", saved.S); s("NODE_ENV", saved.N); });

  it("the mailbox route refuses without secret / in production", async () => {
    const { GET } = await import("@/app/api/internal/e2e/mailbox/route");
    env.NODE_ENV = "test"; env.PIERRE_E2E_TEST_MODE = "1"; env.PIERRE_E2E_SECRET = "s12345678";
    expect((await GET(new Request("http://x/api/internal/e2e/mailbox"))).status).toBe(403); // no secret
    env.NODE_ENV = "production";
    expect((await GET(new Request("http://x/api/internal/e2e/mailbox", { headers: { "x-pierre-e2e-secret": "s12345678" } }))).status).toBe(404); // production
  });
});

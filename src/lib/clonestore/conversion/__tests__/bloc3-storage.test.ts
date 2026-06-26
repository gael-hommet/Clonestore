import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  __resetConversionStoreForTests,
  ConversionBackendUnavailableError,
  attachUserToSession,
  createConversionSessionFromGrant,
  createOrganicConversionSession,
  getConversionSession,
  getGrantByTokenId,
  importAttributionGrant,
  isConversionBackendAvailable,
  isGrantUsable,
  listConversionEvents,
  markGrantVisited,
  recordConversionEvent,
  revokeGrant,
  updateConversionSession,
} from "../storage";

const TOKEN_ID = "abcdef0123456789abcdef0123456789abcdef00"; // 40 hex

function enableInMemoryDevMode() {
  process.env.CLONESTORE_B3_ALLOW_IN_MEMORY_CONVERSION_STORE = "true";
}
function disableInMemoryDevMode() {
  delete process.env.CLONESTORE_B3_ALLOW_IN_MEMORY_CONVERSION_STORE;
}

describe("BLOC 3 — storage (allow-in-memory mode)", () => {
  beforeEach(() => {
    enableInMemoryDevMode();
    __resetConversionStoreForTests();
  });
  afterEach(() => {
    __resetConversionStoreForTests();
    disableInMemoryDevMode();
  });

  it("import grant valide", () => {
    const r = importAttributionGrant({
      tokenId: TOKEN_ID,
      variant: "VARIANT_DEPARTMENT_OUTCOME",
      cohort: "V0-A",
      contactKind: "DIRECT",
      campaignId: "spring_2026",
      prospectId: "lf_001",
    });
    expect(r.ok).toBe(true);
    const g = getGrantByTokenId(TOKEN_ID)!;
    expect(g.status).toBe("ACTIVE");
    expect(g.keyVersion).toBe("a1");
    expect(isGrantUsable(g)).toBe(true);
  });

  it("révocation rend le grant inutilisable", () => {
    importAttributionGrant({
      tokenId: TOKEN_ID, variant: "VARIANT_PROOF_FIRST", cohort: "V0-B",
      contactKind: "DIRECT", campaignId: "summer_2026", prospectId: "lf_001",
    });
    expect(revokeGrant(TOKEN_ID)).toBe(true);
    expect(isGrantUsable(getGrantByTokenId(TOKEN_ID)!)).toBe(false);
  });

  it("createConversionSessionFromGrant copie variant/cohort", () => {
    importAttributionGrant({
      tokenId: TOKEN_ID, variant: "VARIANT_DEPARTMENT_OUTCOME", cohort: "V0-A",
      contactKind: "DIRECT", campaignId: "spring_2026", prospectId: "lf_001",
    });
    const grant = getGrantByTokenId(TOKEN_ID)!;
    const session = createConversionSessionFromGrant(grant);
    expect(session.variant).toBe("VARIANT_DEPARTMENT_OUTCOME");
    expect(session.cohort).toBe("V0-A");
    expect(session.stage).toBe("landed");
  });

  it("attachUserToSession refuse cross-user et cross-tenant", () => {
    const session = createOrganicConversionSession();
    expect(attachUserToSession(session.id, "u_alice", "t_acme").ok).toBe(true);
    const otherUser = attachUserToSession(session.id, "u_bob", "t_acme");
    expect(otherUser.ok).toBe(false);
    expect(otherUser.reason).toBe("session_attached_to_other_user");
    const otherTenant = attachUserToSession(session.id, "u_alice", "t_other");
    expect(otherTenant.ok).toBe(false);
    expect(otherTenant.reason).toBe("session_attached_to_other_tenant");
  });

  it("recordConversionEvent est idempotent par idempotencyKey", () => {
    const s = createOrganicConversionSession();
    const a = recordConversionEvent({ sessionId: s.id, eventType: "demo_started", idempotencyKey: "k1" });
    const b = recordConversionEvent({ sessionId: s.id, eventType: "demo_started", idempotencyKey: "k1" });
    expect(a.ok && b.ok && b.duplicate).toBe(true);
    expect(listConversionEvents(s.id).length).toBe(1);
  });

  it("event metadata refuse PII allowlistées (defense in depth)", () => {
    const s = createOrganicConversionSession();
    const r = recordConversionEvent({
      sessionId: s.id,
      eventType: "purchase_cta_clicked",
      idempotencyKey: "k2",
      metadata: {
        cta: "hero_main",                 // allowlistée
        email: "leak@example.com",        // forbidden
        name: "Alice",                    // forbidden
        siren: "123456789",               // forbidden
        contact_kind: "DIRECT",           // allowlistée
      },
    });
    expect(r.ok).toBe(true);
    const meta = r.event!.metadata as Record<string, unknown>;
    expect(meta["cta"]).toBe("hero_main");
    expect(meta["contact_kind"]).toBe("DIRECT");
    expect(meta["email"]).toBeUndefined();
    expect(meta["name"]).toBeUndefined();
    expect(meta["siren"]).toBeUndefined();
  });

  it("event refuse server-only depuis l'API (server invocation autorisée)", () => {
    const s = createOrganicConversionSession();
    // L'allowlist serveur autorise tout EVENT_TYPES via recordConversionEvent.
    // C'est l'endpoint /api/conversion/events qui interdit les server-only au client.
    const r = recordConversionEvent({ sessionId: s.id, eventType: "checkout_started", idempotencyKey: "k3" });
    expect(r.ok).toBe(true);
  });

  it("updateConversionSession avance le stage mais ne régresse pas", () => {
    const s = createOrganicConversionSession();
    updateConversionSession(s.id, { stage: "diagnostic_completed" });
    updateConversionSession(s.id, { stage: "demo_seen" });
    expect(getConversionSession(s.id)!.stage).toBe("diagnostic_completed");
  });

  it("event jamais ne stocke le bearer complet (token_id seulement)", () => {
    const s = createOrganicConversionSession();
    const r = recordConversionEvent({
      sessionId: s.id, eventType: "demo_started", idempotencyKey: "k4",
      prospectToken: TOKEN_ID + ".deadbeef".repeat(8),
    });
    expect(r.ok).toBe(true);
    expect(r.event!.prospectToken).toBe(TOKEN_ID);
    expect(r.event!.prospectToken).not.toContain(".");
  });
});

describe("BLOC 3 — storage fail-closed en production", () => {
  let prevEnv: string | undefined;
  let prevFlag: string | undefined;

  beforeEach(() => {
    __resetConversionStoreForTests();
    prevEnv = process.env.NODE_ENV;
    prevFlag = process.env.CLONESTORE_B3_ALLOW_IN_MEMORY_CONVERSION_STORE;
    // @ts-expect-error — override
    process.env.NODE_ENV = "production";
    delete process.env.CLONESTORE_B3_ALLOW_IN_MEMORY_CONVERSION_STORE;
  });
  afterEach(() => {
    __resetConversionStoreForTests();
    // @ts-expect-error — restore
    process.env.NODE_ENV = prevEnv;
    if (prevFlag !== undefined) process.env.CLONESTORE_B3_ALLOW_IN_MEMORY_CONVERSION_STORE = prevFlag;
    else delete process.env.CLONESTORE_B3_ALLOW_IN_MEMORY_CONVERSION_STORE;
  });

  it("isConversionBackendAvailable retourne false en prod sans backend", () => {
    expect(isConversionBackendAvailable()).toBe(false);
  });

  it("getGrantByTokenId retourne null silencieusement en prod sans backend", () => {
    expect(getGrantByTokenId(TOKEN_ID)).toBeNull();
  });

  it("importAttributionGrant échoue avec ConversionBackendUnavailableError", () => {
    expect(() =>
      importAttributionGrant({
        tokenId: TOKEN_ID, variant: "VARIANT_DEPARTMENT_OUTCOME", cohort: "V0-A",
        contactKind: "DIRECT", campaignId: "x", prospectId: "lf_x",
      }),
    ).toThrow(ConversionBackendUnavailableError);
  });

  it("createOrganicConversionSession retourne une session ÉPHÉMÈRE (jamais persistée)", () => {
    const session = createOrganicConversionSession();
    expect(session.variant).toBe("VARIANT_ORGANIC");
    // mais elle n'est PAS retrouvable car le backend est KO
    expect(getConversionSession(session.id)).toBeNull();
  });

  it("recordConversionEvent renvoie backend_unavailable", () => {
    const s = createOrganicConversionSession();
    const r = recordConversionEvent({ sessionId: s.id, eventType: "demo_started", idempotencyKey: "k1" });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("backend_unavailable");
  });

  it("flag CLONESTORE_B3_ALLOW_IN_MEMORY_CONVERSION_STORE=true en prod n'active PAS le fallback", () => {
    process.env.CLONESTORE_B3_ALLOW_IN_MEMORY_CONVERSION_STORE = "true";
    expect(isConversionBackendAvailable()).toBe(false);
  });
});

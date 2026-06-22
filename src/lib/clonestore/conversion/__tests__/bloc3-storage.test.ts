import { describe, it, expect, beforeEach } from "vitest";
import {
  __resetConversionStoreForTests,
  attachUserToSession,
  buildReconciliationReport,
  createConversionSessionFromGrant,
  createOrganicConversionSession,
  getConversionSession,
  getGrantByTokenId,
  importAttributionGrant,
  isGrantUsable,
  markGrantResolved,
  recordConversionEvent,
  revokeGrant,
  updateConversionSession,
} from "../storage";

const TOKEN_ID = "0123456789abcdef0123456789abcdef";

describe("BLOC 3 — attribution grants & sessions storage", () => {
  beforeEach(() => __resetConversionStoreForTests());

  it("importe un grant valide", () => {
    const r = importAttributionGrant({
      tokenId: TOKEN_ID,
      keyVersion: 1,
      variant: "VARIANT_DEPARTMENT_OUTCOME",
      cohort: "COHORT_DIRECT_A",
      contactKind: "DIRECT",
      campaign: "spring_2026",
      leadforgeProspectId: "lf_001",
    });
    expect(r.ok).toBe(true);
    expect(r.grant?.status).toBe("active");
    const fetched = getGrantByTokenId(TOKEN_ID);
    expect(fetched).not.toBeNull();
    expect(fetched?.variant).toBe("VARIANT_DEPARTMENT_OUTCOME");
    expect(isGrantUsable(fetched!)).toBe(true);
  });

  it("refuse un grant avec variant invalide", () => {
    const r = importAttributionGrant({
      tokenId: TOKEN_ID,
      keyVersion: 1,
      // @ts-expect-error — variant invalide volontaire
      variant: "VARIANT_UNKNOWN",
      cohort: "COHORT_DIRECT_A",
      contactKind: "DIRECT",
      campaign: "x",
    });
    expect(r.ok).toBe(false);
    expect(r.errors).toContain("variant.invalid");
  });

  it("révocation rend le grant inutilisable", () => {
    importAttributionGrant({
      tokenId: TOKEN_ID,
      keyVersion: 1,
      variant: "VARIANT_PROOF_FIRST",
      cohort: "COHORT_DIRECT_B",
      contactKind: "DIRECT",
      campaign: "summer_2026",
    });
    const ok = revokeGrant(TOKEN_ID);
    expect(ok).toBe(true);
    const g = getGrantByTokenId(TOKEN_ID)!;
    expect(isGrantUsable(g)).toBe(false);
  });

  it("createConversionSessionFromGrant copie variant/cohort, pose le stage à 'landed'", () => {
    importAttributionGrant({
      tokenId: TOKEN_ID,
      keyVersion: 1,
      variant: "VARIANT_DEPARTMENT_OUTCOME",
      cohort: "COHORT_DIRECT_A",
      contactKind: "DIRECT",
      campaign: "spring_2026",
    });
    const grant = getGrantByTokenId(TOKEN_ID)!;
    const session = createConversionSessionFromGrant(grant);
    expect(session.variant).toBe("VARIANT_DEPARTMENT_OUTCOME");
    expect(session.cohort).toBe("COHORT_DIRECT_A");
    expect(session.stage).toBe("landed");
    expect(getConversionSession(session.id)?.id).toBe(session.id);
  });

  it("createOrganicConversionSession crée une session sans grant", () => {
    const session = createOrganicConversionSession();
    expect(session.variant).toBe("VARIANT_ORGANIC");
    expect(session.grantId).toBeNull();
  });

  it("attachUserToSession refuse le rattachement à un autre user", () => {
    const session = createOrganicConversionSession();
    const r1 = attachUserToSession(session.id, "u_alice", "t_acme");
    expect(r1.ok).toBe(true);
    const r2 = attachUserToSession(session.id, "u_bob", "t_other");
    expect(r2.ok).toBe(false);
    expect(r2.reason).toBe("session_attached_to_other_user");
  });

  it("recordConversionEvent est idempotent par idempotencyKey", () => {
    const session = createOrganicConversionSession();
    const a = recordConversionEvent({
      sessionId: session.id,
      eventId: "demo_started",
      idempotencyKey: "k1",
    });
    const b = recordConversionEvent({
      sessionId: session.id,
      eventId: "demo_started",
      idempotencyKey: "k1",
    });
    expect(a.ok && b.ok && b.duplicate).toBe(true);
  });

  it("event metadata refuse PII-like (email/siren) silencieusement", () => {
    const session = createOrganicConversionSession();
    const r = recordConversionEvent({
      sessionId: session.id,
      eventId: "purchase_cta_clicked",
      idempotencyKey: "k2",
      metadata: {
        cohort: "COHORT_DIRECT_A",
        contact_email: "leak@example.com",
        prospect_siren: "123456789",
        ok_field: "value",
      },
    });
    expect(r.ok).toBe(true);
    const meta = r.event!.metadata as Record<string, unknown>;
    expect(meta["contact_email"]).toBeUndefined();
    expect(meta["prospect_siren"]).toBeUndefined();
    expect(meta["cohort"]).toBe("COHORT_DIRECT_A");
    expect(meta["ok_field"]).toBe("value");
  });

  it("markGrantResolved est idempotent et n'altère pas le statut", () => {
    importAttributionGrant({
      tokenId: TOKEN_ID,
      keyVersion: 1,
      variant: "VARIANT_DEPARTMENT_OUTCOME",
      cohort: "COHORT_DIRECT_A",
      contactKind: "DIRECT",
      campaign: "c",
    });
    const g1 = markGrantResolved(TOKEN_ID)!;
    expect(g1.status).toBe("active");
    const g2 = markGrantResolved(TOKEN_ID)!;
    expect(g2.lastResolvedAt).not.toBeNull();
  });

  it("updateConversionSession avance le stage mais ne régresse pas", () => {
    const session = createOrganicConversionSession();
    updateConversionSession(session.id, { stage: "diagnostic_completed" });
    updateConversionSession(session.id, { stage: "demo_seen" });
    expect(getConversionSession(session.id)!.stage).toBe("diagnostic_completed");
  });

  it("reconciliation report n'expose pas le token complet (seulement fingerprint)", () => {
    importAttributionGrant({
      tokenId: TOKEN_ID,
      keyVersion: 1,
      variant: "VARIANT_PROOF_FIRST",
      cohort: "COHORT_DIRECT_B",
      contactKind: "DIRECT",
      campaign: "x",
    });
    const grant = getGrantByTokenId(TOKEN_ID)!;
    const session = createConversionSessionFromGrant(grant);
    recordConversionEvent({ sessionId: session.id, eventId: "demo_started", idempotencyKey: "k1" });
    const report = buildReconciliationReport();
    const row = report.find((r) => r.sessionId === session.id)!;
    expect(row.grantTokenFingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(row)).not.toContain(TOKEN_ID);
    expect(row.events.length).toBe(1);
  });
});

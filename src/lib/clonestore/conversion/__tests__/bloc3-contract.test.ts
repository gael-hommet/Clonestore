import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import {
  buildContractSnapshot,
  computeInternalSnapshotFingerprint,
  CONTACT_KINDS,
  CLAIM_IDS,
  CLAIM_STATUSES,
  CHECKOUT_METADATA_FIELDS,
  CHECKOUT_METADATA_ADDITIONAL_ALLOWED,
  DEMO_BEHAVIORS,
  DEMO_STEP_RANGE,
  DIAGNOSTIC_DEFAULT_ASSUMPTIONS,
  DIAGNOSTIC_FORBIDDEN_INPUT_KEYS,
  DIAGNOSTIC_MAX_QUESTIONS,
  DIAGNOSTIC_QUESTION_IDS,
  EVENT_TYPES,
  EVENT_METADATA_ALLOWED,
  EVENT_METADATA_FORBIDDEN,
  FUNNEL_VERSION,
  LANDING_VERSION,
  DEMO_VERSION,
  DIAGNOSTIC_VERSION,
  LEADFORGE_COMMIT,
  LEADFORGE_FIXTURE_FINGERPRINT,
  PIERRE_PRICE_AMOUNT_CENTS,
  PIERRE_PRICE_EUR,
  REAL_ACTIVATABLE_CLAIM_STATUSES,
  SHADOW_ALLOWED_CLAIM_STATUSES,
  SURFACE_ALLOWED_CLAIMS,
  VARIANT_HERO,
  VARIANT_IDS,
  assertVariantId,
  assertEventType,
  assertClaimId,
  ContractParityError,
} from "../contract";
import { EXPECTED_PIERRE_PRICE_AMOUNT } from "@/lib/billing/stripe-activation";

const FIXTURE_PATH = join(
  __dirname,
  "..",
  "fixtures",
  "leadforge-contract-db9b166.json",
);

interface LeadForgeFixture {
  contract: Record<string, unknown> & {
    leadforge_commit: string;
    funnel_version: string;
    landing_version: string;
    demo_version: string;
    diagnostic_version: string;
    price: Record<string, unknown>;
    variants: string[];
    contact_kinds: string[];
    variant_hero: Record<string, string>;
    claim_ids: string[];
    claim_status_enum: string[];
    real_activatable_claim_statuses: string[];
    shadow_allowed_claim_statuses: string[];
    surface_allowed_claims: Record<string, string[]>;
    event_types: string[];
    event_metadata_allowlist: string[];
    event_metadata_forbidden: string[];
    checkout_metadata_fields: string[];
    demo_behaviors: string[];
    demo_step_range: number[];
    diagnostic: {
      max_questions: number;
      questions: { id: string; type: string }[];
      forbidden_input_keys: string[];
      default_assumptions: Record<string, number>;
    };
    attribution_token: Record<string, unknown>;
  };
  contract_canonical_json_sha256: string;
  token_vectors: Record<string, unknown>;
  diagnostic_vectors: unknown[];
  generator: Record<string, unknown>;
}

const fixture: LeadForgeFixture = JSON.parse(readFileSync(FIXTURE_PATH, "utf8"));

describe("BLOC 3 — contrat LeadForge db9b166 (PARITÉ stricte avec fixture indépendante)", () => {
  it("la fixture provient bien de db9b166", () => {
    expect(fixture.contract.leadforge_commit).toBe("db9b166");
    expect((fixture.generator as { source_commit: string }).source_commit).toBe(
      "db9b16600ac421ed3029c8c3da9e1b7eda6d752a",
    );
  });

  it("le fingerprint figé matche la fixture indépendante", () => {
    // Recalcul du fingerprint EXACTEMENT comme Python : JSON.stringify avec
    // sort_keys + separators (",", ":") + ensure_ascii=False.
    const canonical = canonicalJsonPython(fixture.contract);
    const computed = createHash("sha256").update(canonical, "utf8").digest("hex");
    expect(computed).toBe(fixture.contract_canonical_json_sha256);
    expect(computed).toBe(LEADFORGE_FIXTURE_FINGERPRINT);
    expect(LEADFORGE_FIXTURE_FINGERPRINT).not.toBe("AUTO");
    expect(LEADFORGE_FIXTURE_FINGERPRINT).toMatch(/^[0-9a-f]{64}$/);
  });

  it("LEADFORGE_COMMIT matche exactement la fixture", () => {
    expect(LEADFORGE_COMMIT).toBe(fixture.contract.leadforge_commit);
  });

  it("versions funnel/landing/demo/diagnostic matchent la fixture", () => {
    expect(FUNNEL_VERSION).toBe(fixture.contract.funnel_version);
    expect(LANDING_VERSION).toBe(fixture.contract.landing_version);
    expect(DEMO_VERSION).toBe(fixture.contract.demo_version);
    expect(DIAGNOSTIC_VERSION).toBe(fixture.contract.diagnostic_version);
  });

  it("prix Pierre cohérent avec fixture ET runtime billing", () => {
    expect(PIERRE_PRICE_EUR).toBe((fixture.contract.price as { eur: number }).eur);
    expect(PIERRE_PRICE_AMOUNT_CENTS).toBe(44900);
    expect(PIERRE_PRICE_AMOUNT_CENTS).toBe(EXPECTED_PIERRE_PRICE_AMOUNT);
  });

  it("variantes (2) matchent la fixture", () => {
    expect([...VARIANT_IDS].sort()).toEqual([...fixture.contract.variants].sort());
    expect(VARIANT_HERO).toEqual(fixture.contract.variant_hero);
  });

  it("contact kinds (DIRECT, GATEWAY) matchent la fixture", () => {
    expect([...CONTACT_KINDS].sort()).toEqual([...fixture.contract.contact_kinds].sort());
  });

  it("claim ids (8) matchent la fixture", () => {
    expect([...CLAIM_IDS].sort()).toEqual([...fixture.contract.claim_ids].sort());
  });

  it("claim status enum (9) matche la fixture", () => {
    expect([...CLAIM_STATUSES].sort()).toEqual([...fixture.contract.claim_status_enum].sort());
  });

  it("REAL_ACTIVATABLE et SHADOW_ALLOWED matchent la fixture", () => {
    expect([...REAL_ACTIVATABLE_CLAIM_STATUSES].sort()).toEqual(
      [...fixture.contract.real_activatable_claim_statuses].sort(),
    );
    expect([...SHADOW_ALLOWED_CLAIM_STATUSES].sort()).toEqual(
      [...fixture.contract.shadow_allowed_claim_statuses].sort(),
    );
  });

  it("surface_allowed_claims matche la fixture", () => {
    for (const [surface, claims] of Object.entries(fixture.contract.surface_allowed_claims)) {
      expect([...(SURFACE_ALLOWED_CLAIMS[surface] ?? [])].sort()).toEqual([...claims].sort());
    }
  });

  it("event types (24) matchent la fixture", () => {
    expect([...EVENT_TYPES].sort()).toEqual([...fixture.contract.event_types].sort());
  });

  it("event metadata allowlist matche la fixture", () => {
    expect([...EVENT_METADATA_ALLOWED].sort()).toEqual(
      [...fixture.contract.event_metadata_allowlist].sort(),
    );
  });

  it("event metadata forbidden matche la fixture", () => {
    expect([...EVENT_METADATA_FORBIDDEN].sort()).toEqual(
      [...fixture.contract.event_metadata_forbidden].sort(),
    );
  });

  it("checkout_metadata_fields LeadForge (5) matche la fixture", () => {
    expect([...CHECKOUT_METADATA_FIELDS]).toEqual([...fixture.contract.checkout_metadata_fields]);
  });

  // Defense in depth (revue adversariale axe 1) :
  // CHECKOUT_METADATA_ADDITIONAL_ALLOWED ne fait pas partie du contrat LeadForge
  // mais s'étend dans Stripe metadata côté CloneStore. On verrouille la liste
  // pour qu'aucune clé secret/email/PII ne puisse y être ajoutée silencieusement.
  it("CHECKOUT_METADATA_ADDITIONAL_ALLOWED (5 clés CloneStore) verrouillé + sans PII/secret", () => {
    expect([...CHECKOUT_METADATA_ADDITIONAL_ALLOWED].sort()).toEqual([
      "user_id",
      "agent_slug",
      "order_id",
      "tenant_id",
      "founder_reservation_id",
    ].sort());
    const forbidden = [/secret/i, /password/i, /token$/i, /email/i, /siren/i, /api[_-]?key/i, /^cv$/i];
    for (const key of CHECKOUT_METADATA_ADDITIONAL_ALLOWED) {
      for (const re of forbidden) {
        expect(re.test(key), `${key} matches ${re}`).toBe(false);
      }
    }
  });

  it("demo behaviors et step range matchent la fixture", () => {
    expect([...DEMO_BEHAVIORS]).toEqual([...fixture.contract.demo_behaviors]);
    expect([...DEMO_STEP_RANGE]).toEqual([...fixture.contract.demo_step_range]);
  });

  it("diagnostic questions / max / forbidden / assumptions matchent la fixture", () => {
    expect(DIAGNOSTIC_MAX_QUESTIONS).toBe(fixture.contract.diagnostic.max_questions);
    expect([...DIAGNOSTIC_QUESTION_IDS]).toEqual(fixture.contract.diagnostic.questions.map((q) => q.id));
    expect([...DIAGNOSTIC_FORBIDDEN_INPUT_KEYS].sort()).toEqual(
      [...fixture.contract.diagnostic.forbidden_input_keys].sort(),
    );
    expect(DIAGNOSTIC_DEFAULT_ASSUMPTIONS).toEqual(fixture.contract.diagnostic.default_assumptions);
  });

  it("attribution token spec matche la fixture", () => {
    const a = fixture.contract.attribution_token as Record<string, unknown>;
    expect(a.token_id_length).toBe(40);
    expect(a.signature_length).toBe(64);
    expect(a.signature_encoding).toBe("hex");
    expect(a.key_version).toBe("a1");
    expect(a.default_ttl_days).toBe(45);
    expect(a.key_env).toBe("LEADFORGE_ATTRIBUTION_SIGNING_KEY");
  });

  it("snapshot CloneStore interne reste stable (fingerprint déterministe)", () => {
    const a = computeInternalSnapshotFingerprint();
    const b = computeInternalSnapshotFingerprint(buildContractSnapshot());
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("assertions explicites sur ids inconnus", () => {
    expect(() => assertVariantId("VARIANT_UNKNOWN")).toThrow(ContractParityError);
    expect(() => assertEventType("checkout_random")).toThrow(ContractParityError);
    expect(() => assertClaimId("not_a_claim")).toThrow(ContractParityError);
    expect(() => assertVariantId("VARIANT_DEPARTMENT_OUTCOME")).not.toThrow();
    expect(() => assertEventType("demo_started")).not.toThrow();
    expect(() => assertClaimId("pierre_is_role")).not.toThrow();
  });
});

// Json canonicalisé identique à Python `json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)`.
function canonicalJsonPython(value: unknown): string {
  if (value === null || typeof value !== "object") {
    // ensure_ascii=False : on émet les caractères Unicode tels quels.
    // Mais JSON.stringify échappe par défaut les non-ASCII. On ne les
    // ré-injecte que si nécessaire (les chaînes du contrat sont ASCII pour
    // la fixture).
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalJsonPython).join(",") + "]";
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return (
    "{" +
    keys
      .map((k) => JSON.stringify(k) + ":" + canonicalJsonPython((value as Record<string, unknown>)[k]))
      .join(",") +
    "}"
  );
}

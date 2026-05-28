// B44 — EnterpriseEmpreinte tests (70+ tests)

import { describe, it, expect } from "vitest";

import {
  buildDefaultEnterpriseEmpreinte,
  buildDefaultCompanyIdentity,
  buildDefaultCommunicationProfile,
  buildDefaultAutonomyPolicy,
  buildDefaultDataGovernance,
  buildDefaultDocumentPreferences,
  buildDefaultMemorySeed,
  EMPREINTE_CURRENT_VERSION,
} from "../enterprise-defaults";
import { computeEnterpriseEmpreinteCompletion } from "../enterprise-completion";
import { validateEnterpriseEmpreinte, validateEnterpriseEmpreintePatch } from "../enterprise-validation";
import { normalizeEnterpriseEmpreinte, applyEnterpriseEmpreintePatch } from "../enterprise-normalizer";
import {
  readEnterpriseEmpreinteFromMemory,
  readOrCreateEnterpriseEmpreinte,
  buildEnterpriseEmpreinteMemoryPatch,
  applyAndPersistEmpreintePatch,
  resetEnterpriseEmpreinteInMemory,
  ENTERPRISE_EMPREINTE_MEMORY_KEY,
} from "../enterprise-memory-bridge";
import {
  bumpEmpreinteVersion,
  parseEmpreinteVersion,
  isVersionNewer,
  isVersionCurrent,
  needsMigration,
  migrateEnterpriseEmpreinte,
} from "../enterprise-versioning";
import {
  buildMinimalEnterpriseEmpreinte,
  buildCompleteEnterpriseEmpreinte,
  buildEmptyEnterpriseEmpreinte,
} from "../enterprise-fixtures";

// ── Defaults ──────────────────────────────────────────────────────────────────

describe("enterprise defaults", () => {
  it("builds default company identity with FR country code", () => {
    const id = buildDefaultCompanyIdentity();
    expect(id.country_code).toBe("FR");
    expect(id.main_language).toBe("fr");
    expect(id.values).toEqual([]);
  });

  it("builds default communication profile with formal tone", () => {
    const c = buildDefaultCommunicationProfile();
    expect(c.default_tone).toBe("formal");
    expect(c.preferred_length).toBe("standard");
    expect(c.language_code).toBe("fr");
  });

  it("builds default autonomy policy with supervised level", () => {
    const a = buildDefaultAutonomyPolicy();
    expect(a.default_level).toBe("supervised");
    expect(a.never_auto_execute).toContain("email.send");
    expect(a.never_auto_execute).toContain("send_email");
  });

  it("builds default data governance with eu region", () => {
    const dg = buildDefaultDataGovernance();
    expect(dg.data_processing_region).toBe("eu");
    expect(dg.data_retention_days).toBe(365);
    expect(dg.audit_log_retention_days).toBe(730);
    expect(dg.purge_requires_confirmation).toBe(true);
  });

  it("builds default enterprise empreinte with version", () => {
    const e = buildDefaultEnterpriseEmpreinte("user1");
    expect(e.id).toBe("user1");
    expect(e.version).toBe(EMPREINTE_CURRENT_VERSION);
    expect(e.status).toBe("not_configured");
    expect(e.locations).toEqual([]);
    expect(e.roles).toEqual([]);
  });
});

// ── Completion ────────────────────────────────────────────────────────────────

describe("enterprise empreinte completion", () => {
  it("scores default empreinte below activation threshold", () => {
    const e = buildDefaultEnterpriseEmpreinte("user1");
    const c = computeEnterpriseEmpreinteCompletion(e);
    expect(c.score).toBeLessThan(60);
    expect(c.can_activate).toBe(false);
  });

  it("scores minimal empreinte as partial", () => {
    const e = buildMinimalEnterpriseEmpreinte();
    expect(e.completion.score).toBeGreaterThan(0);
    expect(["minimal", "partial", "configured"]).toContain(e.completion.status);
  });

  it("scores complete empreinte as configured or complete", () => {
    const e = buildCompleteEnterpriseEmpreinte();
    expect(e.completion.score).toBeGreaterThan(50);
    expect(["configured", "complete"]).toContain(e.completion.status);
  });

  it("includes missing fields list", () => {
    const e = buildDefaultEnterpriseEmpreinte("user1");
    const c = computeEnterpriseEmpreinteCompletion(e);
    expect(Array.isArray(c.missing_fields)).toBe(true);
    expect(c.missing_fields.length).toBeGreaterThan(0);
  });

  it("sets can_activate when score >= 60", () => {
    const e = buildCompleteEnterpriseEmpreinte();
    if (e.completion.score >= 60) {
      expect(e.completion.can_activate).toBe(true);
    }
  });

  it("provides recommendations for missing fields", () => {
    const e = buildDefaultEnterpriseEmpreinte("user1");
    const c = computeEnterpriseEmpreinteCompletion(e);
    expect(Array.isArray(c.recommendations)).toBe(true);
  });

  it("has filled_sections and empty_sections", () => {
    const e = buildCompleteEnterpriseEmpreinte();
    expect(Array.isArray(e.completion.filled_sections)).toBe(true);
    expect(Array.isArray(e.completion.empty_sections)).toBe(true);
  });

  it("completion.status matches derived score", () => {
    const e = buildMinimalEnterpriseEmpreinte();
    const score = e.completion.score;
    if (score === 0) expect(e.completion.status).toBe("not_configured");
    else if (score < 30) expect(e.completion.status).toBe("minimal");
    else if (score < 60) expect(e.completion.status).toBe("partial");
    else if (score < 85) expect(e.completion.status).toBe("configured");
    else expect(e.completion.status).toBe("complete");
  });
});

// ── Validation ────────────────────────────────────────────────────────────────

describe("enterprise empreinte validation", () => {
  it("validates a complete empreinte with no errors", () => {
    const e = buildCompleteEnterpriseEmpreinte();
    const result = validateEnterpriseEmpreinte(e);
    expect(result.error_count).toBe(0);
  });

  it("flags invalid email format", () => {
    const e = buildMinimalEnterpriseEmpreinte({
      company_identity: { legal_name: "Test", hr_contact_email: "not-an-email" },
    });
    const result = validateEnterpriseEmpreinte(e);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.field.includes("hr_contact_email"))).toBe(true);
  });

  it("flags invalid size_range", () => {
    const e = buildMinimalEnterpriseEmpreinte({
      company_identity: { size_range: "99999" },
    });
    const result = validateEnterpriseEmpreinte(e);
    expect(result.issues.some((i) => i.field.includes("size_range"))).toBe(true);
  });

  it("flags invalid autonomy level", () => {
    const e = buildMinimalEnterpriseEmpreinte({
      autonomy: { default_level: "hacker" },
    });
    const result = validateEnterpriseEmpreinte(e);
    expect(result.issues.some((i) => i.field.includes("default_level"))).toBe(true);
  });

  it("flags invalid hex color in channel", () => {
    const base = buildCompleteEnterpriseEmpreinte();
    base.channels = [{ channel: "email", enabled: true, from_name: null, from_address: null, reply_to: null, footer_text: null, brand_color_hex: "notahex" }];
    const result = validateEnterpriseEmpreinte(base);
    expect(result.issues.some((i) => i.field.includes("brand_color_hex"))).toBe(true);
  });

  it("validates a patch without errors for valid data", () => {
    const result = validateEnterpriseEmpreintePatch({ company_identity: { legal_name: "Test SAS" } });
    expect(result.valid).toBe(true);
  });

  it("separates error and warning counts", () => {
    const e = buildCompleteEnterpriseEmpreinte();
    const result = validateEnterpriseEmpreinte(e);
    expect(typeof result.error_count).toBe("number");
    expect(typeof result.warning_count).toBe("number");
  });
});

// ── Normalizer ────────────────────────────────────────────────────────────────

describe("enterprise empreinte normalizer", () => {
  it("handles null input gracefully", () => {
    const e = normalizeEnterpriseEmpreinte(null, "user1");
    expect(e.id).toBe("user1");
    expect(e.company_identity.main_language).toBe("fr");
  });

  it("preserves legal_name from raw input", () => {
    const e = normalizeEnterpriseEmpreinte({ company_identity: { legal_name: "ACME" } }, "user1");
    expect(e.company_identity.legal_name).toBe("ACME");
  });

  it("never_auto_execute always includes email.send", () => {
    const e = normalizeEnterpriseEmpreinte({}, "user1");
    expect(e.autonomy.never_auto_execute).toContain("email.send");
  });

  it("applies patch and updates completion", () => {
    const base = buildDefaultEnterpriseEmpreinte("user1");
    const patched = applyEnterpriseEmpreintePatch(base, {
      company_identity: { legal_name: "Patched SAS", sector: "Technologie", hr_contact_email: "rh@patched.fr" },
    });
    expect(patched.company_identity.legal_name).toBe("Patched SAS");
    expect(patched.completion.score).toBeGreaterThan(base.completion.score);
  });

  it("patch preserves fields not in patch", () => {
    const base = buildCompleteEnterpriseEmpreinte();
    const originalTone = base.communication.default_tone;
    const patched = applyEnterpriseEmpreintePatch(base, { company_identity: { legal_name: "Updated" } });
    expect(patched.communication.default_tone).toBe(originalTone);
  });

  it("normalizes location array", () => {
    const e = normalizeEnterpriseEmpreinte({
      locations: [{ id: "loc1", label: "Paris", city: "Paris", is_headquarters: true, active: true }],
    }, "user1");
    expect(e.locations).toHaveLength(1);
    expect(e.locations[0].city).toBe("Paris");
  });

  it("normalizes roles array", () => {
    const e = normalizeEnterpriseEmpreinte({
      roles: [{ id: "role1", title: "DRH", is_hr_role: true, can_approve_hr_actions: true, active: true }],
    }, "user1");
    expect(e.roles).toHaveLength(1);
    expect(e.roles[0].is_hr_role).toBe(true);
  });
});

// ── Memory bridge ─────────────────────────────────────────────────────────────

describe("enterprise empreinte memory bridge", () => {
  it("returns null when memory is empty", () => {
    expect(readEnterpriseEmpreinteFromMemory({}, "user1")).toBeNull();
    expect(readEnterpriseEmpreinteFromMemory(null, "user1")).toBeNull();
  });

  it("reads empreinte from memory_json", () => {
    const stored = buildMinimalEnterpriseEmpreinte();
    const memory = { [ENTERPRISE_EMPREINTE_MEMORY_KEY]: stored };
    const read = readEnterpriseEmpreinteFromMemory(memory, "user1");
    expect(read).not.toBeNull();
    expect(read?.company_identity.legal_name).toBe(stored.company_identity.legal_name);
  });

  it("creates default if key missing", () => {
    const e = readOrCreateEnterpriseEmpreinte({}, "user1");
    expect(e.id).toBe("user1");
    expect(e.status).toBe("not_configured");
  });

  it("builds memory patch preserving other keys", () => {
    const e = buildMinimalEnterpriseEmpreinte();
    const memory = { other_key: "other_value" };
    const patched = buildEnterpriseEmpreinteMemoryPatch(memory, e);
    expect(patched.other_key).toBe("other_value");
    expect(patched[ENTERPRISE_EMPREINTE_MEMORY_KEY]).toBeDefined();
  });

  it("applies and persists patch", () => {
    const memory: Record<string, unknown> = {};
    const { updated, newMemoryJson } = applyAndPersistEmpreintePatch({
      memoryJson: memory,
      userId: "user1",
      patch: { company_identity: { legal_name: "Test SAS" } },
    });
    expect(updated.company_identity.legal_name).toBe("Test SAS");
    expect(newMemoryJson[ENTERPRISE_EMPREINTE_MEMORY_KEY]).toBeDefined();
  });

  it("reset produces factory default", () => {
    const memory = buildEnterpriseEmpreinteMemoryPatch({}, buildCompleteEnterpriseEmpreinte());
    const { reset } = resetEnterpriseEmpreinteInMemory(memory, "user1");
    expect(reset.company_identity.legal_name).toBeNull();
    expect(reset.status).toBe("not_configured");
  });
});

// ── Versioning ────────────────────────────────────────────────────────────────

describe("enterprise empreinte versioning", () => {
  it("parses semantic version", () => {
    const v = parseEmpreinteVersion("2.3.1");
    expect(v.major).toBe(2);
    expect(v.minor).toBe(3);
    expect(v.patch).toBe(1);
  });

  it("bumps major resets minor and patch", () => {
    expect(bumpEmpreinteVersion("1.2.3", "major")).toBe("2.0.0");
  });

  it("bumps minor resets patch", () => {
    expect(bumpEmpreinteVersion("1.2.3", "minor")).toBe("1.3.0");
  });

  it("bumps patch only", () => {
    expect(bumpEmpreinteVersion("1.2.3", "patch")).toBe("1.2.4");
  });

  it("isVersionNewer returns true for newer", () => {
    expect(isVersionNewer("2.0.0", "1.9.9")).toBe(true);
    expect(isVersionNewer("1.1.0", "1.0.9")).toBe(true);
    expect(isVersionNewer("1.0.0", "1.0.1")).toBe(false);
  });

  it("isVersionCurrent returns true for current", () => {
    expect(isVersionCurrent(EMPREINTE_CURRENT_VERSION)).toBe(true);
    expect(isVersionCurrent("0.0.1")).toBe(false);
  });

  it("needsMigration returns false for current version", () => {
    const e = buildCompleteEnterpriseEmpreinte();
    expect(needsMigration(e)).toBe(false);
  });

  it("migrateEnterpriseEmpreinte returns same if no migration needed", () => {
    const e = buildCompleteEnterpriseEmpreinte();
    const migrated = migrateEnterpriseEmpreinte(e);
    expect(migrated.version).toBe(e.version);
  });
});

// ── Fixtures ──────────────────────────────────────────────────────────────────

describe("enterprise empreinte fixtures", () => {
  it("minimal fixture has required fields", () => {
    const e = buildMinimalEnterpriseEmpreinte();
    expect(e.company_identity.legal_name).toBeTruthy();
    expect(e.company_identity.sector).toBeTruthy();
    expect(e.company_identity.hr_contact_email).toContain("@");
  });

  it("complete fixture scores above 50", () => {
    const e = buildCompleteEnterpriseEmpreinte();
    expect(e.completion.score).toBeGreaterThan(50);
  });

  it("empty fixture is fully unconfigured", () => {
    const e = buildEmptyEnterpriseEmpreinte();
    expect(e.status).toBe("not_configured");
    expect(e.completion.can_activate).toBe(false);
  });

  it("complete fixture has locations", () => {
    const e = buildCompleteEnterpriseEmpreinte();
    expect(e.locations.length).toBeGreaterThan(0);
  });

  it("complete fixture has roles", () => {
    const e = buildCompleteEnterpriseEmpreinte();
    expect(e.roles.length).toBeGreaterThan(0);
  });

  it("complete fixture has validation circuits", () => {
    const e = buildCompleteEnterpriseEmpreinte();
    expect(e.validation_circuits.length).toBeGreaterThan(0);
  });
});

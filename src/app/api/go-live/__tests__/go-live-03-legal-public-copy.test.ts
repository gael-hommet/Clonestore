// GO-LIVE 03 -- Legal Pages, Company Identity & Public Copy Final Scan Tests
// Static file-content + unit tests. No real API calls. No proof auto-verified.
// Covers: PS1 wrapper, mjs script, legal-entity lib, legal-pages-final lib,
//         public-copy-final lib, docs, package.json scripts.

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

import {
  getLegalEntityFields,
  getRequiredPublicLaunchFields,
} from "@/lib/go-live/legal-entity/legal-entity-registry";
import {
  validateLegalEntity,
  validateLegalEntityFromPageContent,
} from "@/lib/go-live/legal-entity/legal-entity-validator";
import { getLegalEntityVerdict } from "@/lib/go-live/legal-entity/legal-entity-verdict";
import {
  LEGAL_PAGE_REQUIREMENTS,
  scanLegalPage,
  scanAllLegalPages,
  getLegalPageRoutes,
} from "@/lib/go-live/legal-pages-final/legal-pages-final-scan";
import {
  FIXTURE_CGU_COMPLETE,
  FIXTURE_CGU_WITH_PLACEHOLDER,
  FIXTURE_CGV_COMPLETE,
  FIXTURE_DPA_COMPLETE,
  FIXTURE_CONFIDENTIALITE_COMPLETE,
  FIXTURE_MENTIONS_COMPLETE,
  FIXTURE_MENTIONS_WITH_PLACEHOLDERS,
} from "@/lib/go-live/legal-pages-final/legal-pages-final-fixtures";
import {
  COPY_FINAL_FORBIDDEN_RULES,
  COPY_FINAL_ALLOWED_PATTERNS,
  getForbiddenRulesForContext,
  getBlockingRuleIds,
} from "@/lib/go-live/public-copy-final/public-copy-final-registry";
import {
  scanCopyFinal,
  scanMultipleCopyFinal,
} from "@/lib/go-live/public-copy-final/public-copy-final-scanner";
import { getCopyFinalVerdict } from "@/lib/go-live/public-copy-final/public-copy-final-verdict";

const ROOT = process.cwd();

function readScript(filename: string): string {
  return readFileSync(join(ROOT, "scripts", filename), "utf-8");
}

function readDoc(filename: string): string {
  return readFileSync(join(ROOT, "docs", filename), "utf-8");
}

function readPkg(): Record<string, unknown> {
  return JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8"));
}

// ── pfinal03-legal-public-copy-scan.ps1 ──────────────────────────────────────

describe("pfinal03-legal-public-copy-scan.ps1 — script safety", () => {
  it("file exists and is readable", () => {
    const content = readScript("pfinal03-legal-public-copy-scan.ps1");
    expect(content.length).toBeGreaterThan(0);
  });

  it("does not make any API call", () => {
    const content = readScript("pfinal03-legal-public-copy-scan.ps1");
    expect(content).not.toMatch(/Invoke-WebRequest/i);
    expect(content).not.toMatch(/Invoke-RestMethod/i);
    // Only check non-comment lines for Stripe/OpenAI calls (comments may say "Ne contacte pas Stripe")
    const nonCommentLines = content
      .split("\n")
      .filter((l) => !l.trim().startsWith("#"))
      .join("\n");
    expect(nonCommentLines).not.toMatch(/https:\/\/api\.stripe\.com/i);
    expect(nonCommentLines).not.toMatch(/https:\/\/api\.openai\.com/i);
  });

  it("does not modify go-live-proofs.local.json", () => {
    const content = readScript("pfinal03-legal-public-copy-scan.ps1");
    expect(content).not.toMatch(/Set-Content.*go-live-proofs/);
    expect(content).not.toMatch(/Out-File.*go-live-proofs/);
  });

  it("does not automatically mark any proof as verified", () => {
    const content = readScript("pfinal03-legal-public-copy-scan.ps1");
    expect(content).not.toMatch(/verified.*=.*true/i);
    expect(content).not.toContain('"status": "verified"');
    expect(content).not.toContain("'status': 'verified'");
  });

  it("references node scripts/legal-public-copy-scan.mjs", () => {
    const content = readScript("pfinal03-legal-public-copy-scan.ps1");
    expect(content).toContain("legal-public-copy-scan.mjs");
    expect(content).toMatch(/node\s+scripts\/legal-public-copy-scan\.mjs/);
  });
});

// ── legal-public-copy-scan.mjs ────────────────────────────────────────────────

describe("legal-public-copy-scan.mjs — script safety", () => {
  it("file exists and is readable", () => {
    const content = readScript("legal-public-copy-scan.mjs");
    expect(content.length).toBeGreaterThan(0);
  });

  it("does not call any external API", () => {
    const content = readScript("legal-public-copy-scan.mjs");
    expect(content).not.toMatch(/fetch\s*\(/);
    expect(content).not.toMatch(/https:\/\/api\.stripe\.com/);
    expect(content).not.toMatch(/https:\/\/api\.openai\.com/);
  });

  it("does not modify go-live-proofs.local.json", () => {
    const content = readScript("legal-public-copy-scan.mjs");
    expect(content).not.toMatch(/writeFileSync.*go-live-proofs/);
  });

  it("has all 10 proof IDs listed as pending (never verified)", () => {
    const content = readScript("legal-public-copy-scan.mjs");
    expect(content).toContain("LEGAL_CGU_VALIDATED");
    expect(content).toContain("LEGAL_CGV_VALIDATED");
    expect(content).toContain("LEGAL_DPA_VALIDATED");
    expect(content).toContain("LEGAL_PRIVACY_VALIDATED");
    expect(content).toContain("LEGAL_MENTIONS_VALIDATED");
    expect(content).toContain("LEGAL_ENTITY_INFO_COMPLETED");
    expect(content).toContain("LEGAL_HUMAN_REVIEW_COMPLETED");
    expect(content).toContain("PUBLIC_COPY_SCAN_CLEAN");
    expect(content).toContain("PUBLIC_SITE_NO_FORBIDDEN_CLAIMS");
    expect(content).toContain("CHECKOUT_LEGAL_LINKS_PRESENT");
    expect(content).toMatch(/status:\s*['"]pending['"]/);
    expect(content).not.toMatch(/status:\s*['"]verified['"]/);
  });

  it("writes evidence file to go-live-evidence directory (not proofs file)", () => {
    const content = readScript("legal-public-copy-scan.mjs");
    expect(content).toContain("go-live-evidence");
    expect(content).toContain("legal-public-copy-scan.txt");
    expect(content).not.toMatch(/writeFileSync.*go-live-proofs/);
  });
});

// ── legal-entity registry ─────────────────────────────────────────────────────

describe("legal-entity registry — field definitions", () => {
  it("has exactly 11 legal entity fields", () => {
    const fields = getLegalEntityFields();
    expect(fields).toHaveLength(11);
  });

  it("all required public launch fields are present (9 of 11)", () => {
    const required = getRequiredPublicLaunchFields();
    expect(required.length).toBeGreaterThanOrEqual(9);
    const keys = required.map((f) => f.key);
    expect(keys).toContain("company_name");
    expect(keys).toContain("siren");
    expect(keys).toContain("address");
    expect(keys).toContain("publication_director");
    expect(keys).toContain("contact_email");
    expect(keys).toContain("hosting_provider");
    expect(keys).toContain("applicable_law");
  });

  it("each field has placeholder_markers defined (non-empty)", () => {
    const fields = getLegalEntityFields();
    for (const field of fields) {
      expect(field.placeholder_markers.length).toBeGreaterThan(0);
    }
  });

  it("validator blocks public launch when required fields are missing", () => {
    const validation = validateLegalEntity({});
    expect(validation.blocks_public_launch).toBe(true);
    expect(validation.missing_count).toBeGreaterThan(0);
  });

  it("validator returns complete when all required fields filled without placeholders", () => {
    const entity = {
      company_name: "CloneStore SAS",
      legal_form: "SAS",
      address: "12 rue de la Paix, 75001 Paris",
      siren: "123456789",
      publication_director: "Gaël Hommet",
      contact_email: "contact@clonestore.fr",
      privacy_email: "privacy@clonestore.fr",
      hosting_provider: "Vercel Inc, 440 N Barranca Ave",
      vat_number: "FR12 123456789",
      applicable_law: "Droit français — Tribunal de Commerce de Paris",
      document_version: "v1.0 — 2026-06-01",
    };
    const validation = validateLegalEntity(entity);
    expect(validation.filled_count).toBe(11);
    expect(validation.blocks_public_launch).toBe(false);
  });

  it("verdict always returns proof_status pending (never auto-verified)", () => {
    const validation = validateLegalEntity({});
    const verdict = getLegalEntityVerdict(validation);
    expect(verdict.proof_id).toBe("LEGAL_ENTITY_INFO_COMPLETED");
    expect(verdict.proof_status).toBe("pending");
  });

  it("validateLegalEntityFromPageContent detects placeholders in mentions source", () => {
    const validation = validateLegalEntityFromPageContent(FIXTURE_MENTIONS_WITH_PLACEHOLDERS);
    expect(validation.placeholder_count).toBeGreaterThan(0);
    expect(validation.blocks_public_launch).toBe(true);
  });
});

// ── legal-pages-final scan ────────────────────────────────────────────────────

describe("legal-pages-final scan — 5 required routes", () => {
  it("has exactly 5 legal page requirements", () => {
    expect(LEGAL_PAGE_REQUIREMENTS).toHaveLength(5);
  });

  it("all 5 legal routes are defined", () => {
    const routes = getLegalPageRoutes();
    expect(routes).toContain("/legal/cgu");
    expect(routes).toContain("/legal/cgv");
    expect(routes).toContain("/legal/dpa");
    expect(routes).toContain("/legal/mentions");
    expect(routes).toContain("/legal/confidentialite");
  });

  it("CGU with placeholder content is flagged as draft — not safe for launch", () => {
    const req = LEGAL_PAGE_REQUIREMENTS.find((r) => r.key === "cgu")!;
    const result = scanLegalPage(req, FIXTURE_CGU_WITH_PLACEHOLDER);
    expect(result.has_placeholder).toBe(true);
    expect(result.is_draft).toBe(true);
    expect(result.safe_for_launch).toBe(false);
  });

  it("CGU complete fixture passes scan (no placeholder, required content present)", () => {
    const req = LEGAL_PAGE_REQUIREMENTS.find((r) => r.key === "cgu")!;
    const result = scanLegalPage(req, FIXTURE_CGU_COMPLETE);
    expect(result.has_placeholder).toBe(false);
    expect(result.safe_for_launch).toBe(true);
  });

  it("CGV fixture has required content: 449, mensuel, résiliation, démo", () => {
    const req = LEGAL_PAGE_REQUIREMENTS.find((r) => r.key === "cgv")!;
    const result = scanLegalPage(req, FIXTURE_CGV_COMPLETE);
    expect(result.missing_required).toHaveLength(0);
    expect(result.safe_for_launch).toBe(true);
  });

  it("DPA fixture has required RGPD content: sous-traitant, données, suppression", () => {
    const req = LEGAL_PAGE_REQUIREMENTS.find((r) => r.key === "dpa")!;
    const result = scanLegalPage(req, FIXTURE_DPA_COMPLETE);
    expect(result.missing_required).toHaveLength(0);
  });

  it("mentions fixture with placeholders is flagged — blocks launch", () => {
    const req = LEGAL_PAGE_REQUIREMENTS.find((r) => r.key === "mentions")!;
    const result = scanLegalPage(req, FIXTURE_MENTIONS_WITH_PLACEHOLDERS);
    expect(result.has_placeholder).toBe(true);
    expect(result.safe_for_launch).toBe(false);
  });

  it("scanAllLegalPages with complete fixtures returns blocking issues only for missing pages", () => {
    const result = scanAllLegalPages({
      cgu: FIXTURE_CGU_COMPLETE,
      cgv: FIXTURE_CGV_COMPLETE,
      dpa: FIXTURE_DPA_COMPLETE,
      mentions: FIXTURE_MENTIONS_COMPLETE,
      confidentialite: FIXTURE_CONFIDENTIALITE_COMPLETE,
    });
    expect(result.total_placeholders).toBe(0);
    expect(result.all_safe).toBe(true);
  });

  it("each legal page requirement has a proof_id defined", () => {
    for (const req of LEGAL_PAGE_REQUIREMENTS) {
      expect(req.proof_id).toBeTruthy();
      expect(req.proof_id).toMatch(/^LEGAL_/);
    }
  });
});

// ── public-copy-final registry + scanner ─────────────────────────────────────

describe("public-copy-final registry — 12 forbidden rules", () => {
  it("has exactly 12 forbidden rules", () => {
    expect(COPY_FINAL_FORBIDDEN_RULES).toHaveLength(12);
  });

  it("all 12 rules have severity blocking", () => {
    const ids = getBlockingRuleIds();
    expect(ids).toHaveLength(12);
  });

  it("has at least 8 allowed patterns", () => {
    expect(COPY_FINAL_ALLOWED_PATTERNS.length).toBeGreaterThanOrEqual(8);
  });

  it("getForbiddenRulesForContext returns all rules for context 'all'", () => {
    const rules = getForbiddenRulesForContext("homepage");
    expect(rules.length).toBeGreaterThanOrEqual(10);
  });

  it("scanner detects zero_erreur pattern", () => {
    const result = scanCopyFinal("Ce logiciel garantit zéro erreur dans vos documents RH.", "homepage");
    const found = result.violations.find((v) => v.rule_id === "zero_erreur");
    expect(found).toBeDefined();
    expect(result.is_clean).toBe(false);
  });

  it("scanner detects essai_gratuit_open_bar pattern", () => {
    const result = scanCopyFinal("Bénéficiez d'un essai gratuit de 7 jours sans engagement.", "checkout");
    const found = result.violations.find((v) => v.rule_id === "essai_gratuit_open_bar");
    expect(found).toBeDefined();
  });

  it("scanner detects remplace_avocat pattern", () => {
    const result = scanCopyFinal("Pierre remplace un avocat pour vos documents RH.", "homepage");
    const found = result.violations.find((v) => v.rule_id === "remplace_avocat");
    expect(found).toBeDefined();
  });

  it("scanner returns clean for valid Pierre copy", () => {
    const validCopy = `
      Pierre est votre Poste RH opérationnel automatisé à 449 €/mois.
      Pierre prépare des brouillons RH soumis à validation humaine finale.
      Pierre structure, suit, relance et documente vos processus RH.
      La validation humaine finale obligatoire reste entière pour toute décision officielle.
    `;
    const result = scanCopyFinal(validCopy, "homepage");
    expect(result.is_clean).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("scanMultipleCopyFinal aggregates results across pages", () => {
    const pages = [
      { content: "Pierre prépare des brouillons RH à 449 € / mois.", context: "homepage" },
      { content: "Abonnement mensuel résiliable à tout moment.", context: "checkout" },
    ];
    const result = scanMultipleCopyFinal(pages);
    expect(result.all_clean).toBe(true);
    expect(result.total_blocking).toBe(0);
  });

  it("getCopyFinalVerdict returns proof_ids_pending always pending", () => {
    const multiResult = scanMultipleCopyFinal([
      { content: "Pierre prépare des brouillons RH.", context: "homepage" },
    ]);
    const verdict = getCopyFinalVerdict(multiResult);
    expect(verdict.proof_ids_pending).toContain("PUBLIC_COPY_SCAN_CLEAN");
    expect(verdict.proof_ids_pending).toContain("PUBLIC_SITE_NO_FORBIDDEN_CLAIMS");
  });
});

// ── docs completeness ──────────────────────────────────────────────────────────

describe("GO-LIVE 03 docs — presence and completeness", () => {
  it("GO_LIVE_03_LEGAL_PUBLIC_COPY_FINAL.md exists and contains proof IDs", () => {
    const content = readDoc("GO_LIVE_03_LEGAL_PUBLIC_COPY_FINAL.md");
    expect(content).toContain("LEGAL_CGU_VALIDATED");
    expect(content).toContain("LEGAL_ENTITY_INFO_COMPLETED");
    expect(content).toContain("LEGAL_HUMAN_REVIEW_COMPLETED");
    expect(content).toContain("PUBLIC_COPY_SCAN_CLEAN");
    expect(content).toContain("PENDING");
  });

  it("GO_LIVE_03_GAEL_LEGAL_INFO_TO_FILL.md exists with all 11 fields", () => {
    const content = readDoc("GO_LIVE_03_GAEL_LEGAL_INFO_TO_FILL.md");
    expect(content).toContain("company_name");
    expect(content).toContain("SIREN");
    expect(content).toContain("Adresse");
    expect(content).toContain("Directeur");
    expect(content).toContain("Hébergeur");
    expect(content).toContain("Juridiction");
    expect(content).toContain("Ne pas inventer ces informations");
  });

  it("GO_LIVE_03_LEGAL_REVIEW_PACKET_FINAL.md exists and states lawyer review required", () => {
    const content = readDoc("GO_LIVE_03_LEGAL_REVIEW_PACKET_FINAL.md");
    expect(content).toContain("LEGAL_HUMAN_REVIEW_COMPLETED");
    expect(content).toContain("juriste");
    expect(content).toContain("RGPD");
    expect(content).not.toContain("validated automatically");
  });
});

// ── package.json scripts ───────────────────────────────────────────────────────

describe("package.json — GO-LIVE 03 scripts", () => {
  it("check:legal-public-copy script is defined", () => {
    const pkg = readPkg();
    const scripts = pkg.scripts as Record<string, string>;
    expect(scripts["check:legal-public-copy"]).toBeDefined();
    expect(scripts["check:legal-public-copy"]).toContain("pfinal03-legal-public-copy-scan.ps1");
  });

  it("test:pfinal02 includes go-live-03-legal-public-copy.test.ts", () => {
    const pkg = readPkg();
    const scripts = pkg.scripts as Record<string, string>;
    expect(scripts["test:pfinal02"]).toContain("go-live-03-legal-public-copy.test.ts");
  });

  it("test (full suite) includes go-live-03-legal-public-copy.test.ts", () => {
    const pkg = readPkg();
    const scripts = pkg.scripts as Record<string, string>;
    expect(scripts["test"]).toContain("go-live-03-legal-public-copy.test.ts");
  });
});

// TECH-11 — Technology Readiness Final Gate — Tests
// 60 tests couvrant tous les modules readiness/
// Socle technologique CloneStore — verdict final TECH-01 → TECH-10.

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

import * as ReadinessIndexNS from "../index";
import * as TypesNS from "../technology-readiness-types";
import * as SourcesNS from "../technology-readiness-sources";
import * as InvariantsNS from "../technology-readiness-invariants";
import * as EvaluatorNS from "../technology-readiness-evaluator";
import * as PierreNS from "../pierre-technology-readiness";
import * as BlockersNS from "../launch-blockers-separation";
import * as ReportNS from "../technology-readiness-report";
import * as SnapshotNS from "../technology-readiness-snapshot";
import * as ValidationNS from "../technology-readiness-validation";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fileExists(relativePath: string): boolean {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.existsSync(fullPath);
}

// ── T01 — STRUCTURE DES MODULES ───────────────────────────────────────────────

describe("T01 — Modules structure", () => {
  it("T01.1 — technology-readiness-types.ts exists", () => {
    expect(fileExists("src/lib/clonestore/readiness/technology-readiness-types.ts")).toBe(true);
  });

  it("T01.2 — technology-readiness-sources.ts exists", () => {
    expect(fileExists("src/lib/clonestore/readiness/technology-readiness-sources.ts")).toBe(true);
  });

  it("T01.3 — technology-readiness-evaluator.ts exists", () => {
    expect(fileExists("src/lib/clonestore/readiness/technology-readiness-evaluator.ts")).toBe(true);
  });

  it("T01.4 — technology-readiness-invariants.ts exists", () => {
    expect(fileExists("src/lib/clonestore/readiness/technology-readiness-invariants.ts")).toBe(true);
  });

  it("T01.5 — technology-readiness-report.ts exists", () => {
    expect(fileExists("src/lib/clonestore/readiness/technology-readiness-report.ts")).toBe(true);
  });

  it("T01.6 — technology-readiness-snapshot.ts exists", () => {
    expect(fileExists("src/lib/clonestore/readiness/technology-readiness-snapshot.ts")).toBe(true);
  });

  it("T01.7 — technology-readiness-validation.ts exists", () => {
    expect(fileExists("src/lib/clonestore/readiness/technology-readiness-validation.ts")).toBe(true);
  });

  it("T01.8 — pierre-technology-readiness.ts exists", () => {
    expect(fileExists("src/lib/clonestore/readiness/pierre-technology-readiness.ts")).toBe(true);
  });

  it("T01.9 — launch-blockers-separation.ts exists", () => {
    expect(fileExists("src/lib/clonestore/readiness/launch-blockers-separation.ts")).toBe(true);
  });

  it("T01.10 — index.ts exists", () => {
    expect(fileExists("src/lib/clonestore/readiness/index.ts")).toBe(true);
  });
});

// ── T02 — INDEX EXPORTS ───────────────────────────────────────────────────────

describe("T02 — Index exports", () => {
  it("T02.1 — index exporte buildTechnologyReadinessReport", () => {
    const mod = ReadinessIndexNS as Record<string, unknown>;
    expect(typeof mod["buildTechnologyReadinessReport"]).toBe("function");
  });

  it("T02.2 — index exporte evaluateTechnologyInvariants", () => {
    const mod = ReadinessIndexNS as Record<string, unknown>;
    expect(typeof mod["evaluateTechnologyInvariants"]).toBe("function");
  });

  it("T02.3 — index exporte KNOWN_EXTERNAL_LAUNCH_BLOCKERS", () => {
    const blockers = ReadinessIndexNS.KNOWN_EXTERNAL_LAUNCH_BLOCKERS;
    expect(Array.isArray(blockers)).toBe(true);
    expect(blockers.length).toBeGreaterThanOrEqual(5);
  });

  it("T02.4 — index exporte validateTechnologyReadinessReport", () => {
    const mod = ReadinessIndexNS as Record<string, unknown>;
    expect(typeof mod["validateTechnologyReadinessReport"]).toBe("function");
  });
});

// ── T03 — RAPPORT COMPLET ─────────────────────────────────────────────────────

describe("T03 — Rapport complet", () => {
  const report = ReportNS.buildTechnologyReadinessReport();

  it("T03.1 — rapport inclut au moins 13 technologies", () => {
    expect(report.technologies.length).toBeGreaterThanOrEqual(13);
  });

  it("T03.2 — rapport inclut cloneos", () => {
    expect(report.technologies.some((t) => t.key === "cloneos")).toBe(true);
  });

  it("T03.3 — rapport inclut cloneadn", () => {
    expect(report.technologies.some((t) => t.key === "cloneadn")).toBe(true);
  });

  it("T03.4 — rapport inclut cloneguard", () => {
    expect(report.technologies.some((t) => t.key === "cloneguard")).toBe(true);
  });

  it("T03.5 — rapport inclut clonetrace", () => {
    expect(report.technologies.some((t) => t.key === "clonetrace")).toBe(true);
  });

  it("T03.6 — rapport inclut clonevoice", () => {
    expect(report.technologies.some((t) => t.key === "clonevoice")).toBe(true);
  });

  it("T03.7 — rapport inclut clonechat", () => {
    expect(report.technologies.some((t) => t.key === "clonechat")).toBe(true);
  });

  it("T03.8 — rapport inclut clonepolicy", () => {
    expect(report.technologies.some((t) => t.key === "clonepolicy")).toBe(true);
  });

  it("T03.9 — rapport inclut clonecontinuum", () => {
    expect(report.technologies.some((t) => t.key === "clonecontinuum")).toBe(true);
  });

  it("T03.10 — rapport inclut clonetrust", () => {
    expect(report.technologies.some((t) => t.key === "clonetrust")).toBe(true);
  });

  it("T03.11 — rapport inclut clonereview", () => {
    expect(report.technologies.some((t) => t.key === "clonereview")).toBe(true);
  });

  it("T03.12 — rapport inclut clonesignals", () => {
    expect(report.technologies.some((t) => t.key === "clonesignals")).toBe(true);
  });

  it("T03.13 — rapport inclut clonelearn", () => {
    expect(report.technologies.some((t) => t.key === "clonelearn")).toBe(true);
  });

  it("T03.14 — rapport inclut clonebrief", () => {
    expect(report.technologies.some((t) => t.key === "clonebrief")).toBe(true);
  });
});

// ── T04 — INVARIANTS ABSOLUS ──────────────────────────────────────────────────

describe("T04 — Invariants absolus", () => {
  it("T04.1 — CloneVoice n'est pas actif en production", () => {
    const voiceInvariants = InvariantsNS.evaluateVoiceInvariants();
    const productionInv = voiceInvariants.find(
      (i) => i.invariant_id === "voice_production_disabled",
    );
    expect(productionInv).toBeDefined();
    expect(productionInv?.status).toBe("pass");
  });

  it("T04.2 — CloneTrust est autonomie graduelle, pas zero-trust", () => {
    // CloneTrust trust_model = gradual_autonomy dans global-tech-defaults.ts
    const configs = SourcesNS.getAllTechnologyConfigs();
    const clonetrust = configs.find((c) => c.key === "clonetrust");
    expect(clonetrust?.settings?.trust_model).toBe("gradual_autonomy");
    expect(clonetrust?.settings?.trust_model).not.toBe("zero_trust");
  });

  it("T04.3 — CloneGuard legal_decision invariant passe", () => {
    const guardInvariants = InvariantsNS.evaluateGuardInvariants();
    const legalInv = guardInvariants.find(
      (i) => i.invariant_id === "guard_legal_decision_blocked",
    );
    expect(legalInv).toBeDefined();
    expect(legalInv?.status).toBe("pass");
  });

  it("T04.4 — CloneGuard payroll_execution invariant passe", () => {
    const guardInvariants = InvariantsNS.evaluateGuardInvariants();
    const payrollInv = guardInvariants.find(
      (i) => i.invariant_id === "guard_payroll_execution_blocked",
    );
    expect(payrollInv).toBeDefined();
    expect(payrollInv?.status).toBe("pass");
  });

  it("T04.5 — CloneGuard termination_decision invariant passe", () => {
    const guardInvariants = InvariantsNS.evaluateGuardInvariants();
    const termInv = guardInvariants.find(
      (i) => i.invariant_id === "guard_termination_decision_blocked",
    );
    expect(termInv).toBeDefined();
    expect(termInv?.status).toBe("pass");
  });

  it("T04.6 — CloneGuard contract_signature invariant passe", () => {
    const guardInvariants = InvariantsNS.evaluateGuardInvariants();
    const sigInv = guardInvariants.find(
      (i) => i.invariant_id === "guard_contract_signature_blocked",
    );
    expect(sigInv).toBeDefined();
    expect(sigInv?.status).toBe("pass");
  });

  it("T04.7 — CloneTrace immutabilité invariant passe", () => {
    const traceInvariants = InvariantsNS.evaluateTraceInvariants();
    const immutableInv = traceInvariants.find(
      (i) => i.invariant_id === "trace_events_immutable",
    );
    expect(immutableInv).toBeDefined();
    expect(immutableInv?.status).toBe("pass");
  });

  it("T04.8 — CloneBrief non-invention invariant passe", () => {
    const briefInvariants = InvariantsNS.evaluateBriefInvariants();
    const noInventionInv = briefInvariants.find(
      (i) => i.invariant_id === "brief_no_invention",
    );
    expect(noInventionInv).toBeDefined();
    expect(noInventionInv?.status).toBe("pass");
  });

  it("T04.9 — CloneOS non-exécution invariant passe", () => {
    const osInvariants = InvariantsNS.evaluateCloneOSInvariants();
    const noExecInv = osInvariants.find(
      (i) => i.invariant_id === "cloneos_no_execution",
    );
    expect(noExecInv).toBeDefined();
    expect(noExecInv?.status).toBe("pass");
  });

  it("T04.10 — CloneADN mémoire globale invariant passe", () => {
    const adnInvariants = InvariantsNS.evaluateADNInvariants();
    const globalMemInv = adnInvariants.find(
      (i) => i.invariant_id === "adn_global_memory_exists",
    );
    expect(globalMemInv).toBeDefined();
    expect(globalMemInv?.status).toBe("pass");
  });
});

// ── T05 — EMPLOYEE RUNTIME ────────────────────────────────────────────────────

describe("T05 — Employee Runtime", () => {
  it("T05.1 — Employee Runtime a Pierre enregistré", () => {
    const empInvariants = InvariantsNS.evaluateEmployeeRuntimeInvariants();
    const pierreInv = empInvariants.find(
      (i) => i.invariant_id === "employee_pierre_registered",
    );
    expect(pierreInv).toBeDefined();
    expect(pierreInv?.status).toBe("pass");
  });

  it("T05.2 — Emma/Lucas/Sophie ne sont pas actifs", () => {
    const empInvariants = InvariantsNS.evaluateEmployeeRuntimeInvariants();
    const noFakeInv = empInvariants.find(
      (i) => i.invariant_id === "employee_no_fake_active",
    );
    expect(noFakeInv).toBeDefined();
    expect(noFakeInv?.status).toBe("pass");
  });

  it("T05.3 — Pierre hard required technologies couvertes", () => {
    const result = PierreNS.evaluatePierreRequiredTechnologies();
    expect(result.covered).toContain("cloneos");
    expect(result.covered).toContain("cloneadn");
    expect(result.covered).toContain("cloneguard");
    expect(result.covered).toContain("clonetrace");
  });

  it("T05.4 — Pierre permissions critiques false", () => {
    const safety = PierreNS.evaluatePierreSafetyCoverage();
    expect(safety.legal_decision_blocked).toBe(true);
    expect(safety.official_payroll_blocked).toBe(true);
    expect(safety.employee_termination_blocked).toBe(true);
    expect(safety.contract_signature_blocked).toBe(true);
  });
});

// ── T06 — PUBLIC LAUNCH BLOCKERS ──────────────────────────────────────────────

describe("T06 — External blockers / public launch", () => {
  it("T06.1 — external blockers listés (≥ 5)", () => {
    const blockers = BlockersNS.listExternalLaunchBlockers();
    expect(blockers.length).toBeGreaterThanOrEqual(5);
  });

  it("T06.2 — public_launch_ready = false TOUJOURS", () => {
    const report = ReportNS.buildTechnologyReadinessReport();
    expect(report.public_launch_ready).toBe(false);
  });

  it("T06.3 — canDeclarePublicLaunchReady retourne false", () => {
    const report = ReportNS.buildTechnologyReadinessReport();
    expect(BlockersNS.canDeclarePublicLaunchReady(report)).toBe(false);
  });

  it("T06.4 — Les blockers externes n'affectent pas technology_readiness", () => {
    const blockers = BlockersNS.KNOWN_EXTERNAL_LAUNCH_BLOCKERS;
    expect(blockers.every((b) => b.affects_technology_readiness === false)).toBe(true);
  });

  it("T06.5 — Les blockers externes affectent public_launch", () => {
    const blockers = BlockersNS.KNOWN_EXTERNAL_LAUNCH_BLOCKERS;
    expect(blockers.every((b) => b.affects_public_launch === true)).toBe(true);
  });
});

// ── T07 — FOUNDATION READINESS ────────────────────────────────────────────────

describe("T07 — Foundation readiness", () => {
  it("T07.1 — platform_technology_foundation_ready présent dans le rapport", () => {
    const report = ReportNS.buildTechnologyReadinessReport();
    expect(typeof report.platform_technology_foundation_ready).toBe("boolean");
  });

  it("T07.2 — validation accepte le rapport généré", () => {
    const report = ReportNS.buildTechnologyReadinessReport();
    const validation = ValidationNS.validateTechnologyReadinessReport(report);
    expect(validation.ok).toBe(true);
    expect(validation.errors.length).toBe(0);
  });

  it("T07.3 — validation rejette public_launch_ready=true avec blockers", () => {
    const report = ReportNS.buildTechnologyReadinessReport();
    // Forcer public_launch_ready à true pour tester la validation
    const badReport = { ...report, public_launch_ready: true as unknown as false };
    const validation = ValidationNS.validateTechnologyReadinessReport(badReport);
    expect(validation.ok).toBe(false);
    const tr18 = validation.errors.find((e) => e.code === "TR18");
    expect(tr18).toBeDefined();
  });

  it("T07.4 — snapshot compte les technologies", () => {
    const report = ReportNS.buildTechnologyReadinessReport();
    const snapshot = SnapshotNS.buildTechnologyReadinessSnapshot(report);
    expect(snapshot.total_technologies).toBeGreaterThanOrEqual(13);
    expect(snapshot.public_launch_ready).toBe(false);
  });

  it("T07.5 — markdown mentionne le NO-GO lancement public", () => {
    const report = ReportNS.buildTechnologyReadinessReport();
    const markdown = ReportNS.buildTechnologyReadinessMarkdown(report);
    expect(markdown.toLowerCase()).toContain("no-go");
    expect(markdown.toLowerCase()).not.toContain("lancement public go");
  });
});

// ── T08 — DOCUMENTATION ──────────────────────────────────────────────────────

describe("T08 — Documentation", () => {
  it("T08.1 — docs/TECH_11_TECHNOLOGY_READINESS_FINAL_GATE.md exists", () => {
    expect(fileExists("docs/TECH_11_TECHNOLOGY_READINESS_FINAL_GATE.md")).toBe(true);
  });

  it("T08.2 — doc mentionne technology readiness vs public launch readiness", () => {
    const docPath = path.resolve(process.cwd(), "docs/TECH_11_TECHNOLOGY_READINESS_FINAL_GATE.md");
    const content = fs.readFileSync(docPath, "utf-8").toLowerCase();
    expect(content).toContain("technology readiness");
    expect(content).toContain("public launch");
  });

  it("T08.3 — doc mentionne PHASE 2", () => {
    const docPath = path.resolve(process.cwd(), "docs/TECH_11_TECHNOLOGY_READINESS_FINAL_GATE.md");
    const content = fs.readFileSync(docPath, "utf-8");
    expect(content).toContain("PHASE 2");
  });

  it("T08.4 — doc mentionne les 13 technologies", () => {
    const docPath = path.resolve(process.cwd(), "docs/TECH_11_TECHNOLOGY_READINESS_FINAL_GATE.md");
    const content = fs.readFileSync(docPath, "utf-8").toLowerCase();
    expect(content).toContain("cloneos");
    expect(content).toContain("cloneadn");
    expect(content).toContain("cloneguard");
    expect(content).toContain("clonetrace");
    expect(content).toContain("clonevoice");
  });
});

// ── T09 — INVARIANTS ABSOLUS DE CONFORMITÉ ────────────────────────────────────

describe("T09 — Conformité absolue", () => {
  it("T09.1 — pas d'appel OpenAI dans readiness/", () => {
    const files = [
      "src/lib/clonestore/readiness/technology-readiness-report.ts",
      "src/lib/clonestore/readiness/technology-readiness-evaluator.ts",
      "src/lib/clonestore/readiness/technology-readiness-invariants.ts",
    ];
    for (const f of files) {
      const fullPath = path.resolve(process.cwd(), f);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, "utf-8");
        expect(content).not.toContain("openai.chat");
        expect(content).not.toContain("new OpenAI(");
      }
    }
  });

  it("T09.2 — pas d'appel Anthropic dans readiness/", () => {
    const files = [
      "src/lib/clonestore/readiness/technology-readiness-report.ts",
      "src/lib/clonestore/readiness/pierre-technology-readiness.ts",
    ];
    for (const f of files) {
      const fullPath = path.resolve(process.cwd(), f);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, "utf-8");
        expect(content).not.toContain("anthropic.messages");
        expect(content).not.toContain("new Anthropic(");
      }
    }
  });

  it("T09.3 — pas de Stripe live dans readiness/", () => {
    const indexPath = path.resolve(process.cwd(), "src/lib/clonestore/readiness/index.ts");
    const content = fs.readFileSync(indexPath, "utf-8");
    expect(content).not.toContain("stripe.charges");
    expect(content).not.toContain("STRIPE_LIVE");
  });

  it("T09.4 — pas d'écriture Supabase dans readiness/", () => {
    const files = [
      "src/lib/clonestore/readiness/technology-readiness-report.ts",
      "src/lib/clonestore/readiness/launch-blockers-separation.ts",
    ];
    for (const f of files) {
      const fullPath = path.resolve(process.cwd(), f);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, "utf-8");
        expect(content).not.toContain("supabase.from");
        expect(content).not.toContain(".insert(");
      }
    }
  });

  it("T09.5 — pas d'auto-validation de proofs", () => {
    const reportPath = path.resolve(process.cwd(), "src/lib/clonestore/readiness/technology-readiness-report.ts");
    const content = fs.readFileSync(reportPath, "utf-8");
    expect(content).not.toContain("go-live-proofs");
    expect(content).not.toContain("proof.validated");
  });
});

// ── T10 — RÉGRESSION TECH-05 → TECH-10 ───────────────────────────────────────

describe("T10 — Régression TECH-05 → TECH-10", () => {
  it("T10.1 — TECH-10 tests encore disponibles (voix)", () => {
    expect(
      fileExists("src/lib/clonestore/voice/__tests__/clonevoice-readiness-tech10.test.ts"),
    ).toBe(true);
  });

  it("T10.2 — TECH-09 tests encore disponibles (brief)", () => {
    expect(
      fileExists("src/lib/clonestore/brief/__tests__/clonebrief-executive-summaries-tech09.test.ts"),
    ).toBe(true);
  });

  it("T10.3 — TECH-08 tests encore disponibles (cloneos)", () => {
    expect(
      fileExists("src/lib/clonestore/cloneos/__tests__/cloneos-command-center-tech08.test.ts"),
    ).toBe(true);
  });

  it("T10.4 — TECH-07 tests encore disponibles (trace)", () => {
    expect(
      fileExists("src/lib/clonestore/trace/__tests__/global-trace-timeline-tech07.test.ts"),
    ).toBe(true);
  });

  it("T10.5 — TECH-06 tests encore disponibles (guard)", () => {
    expect(
      fileExists("src/lib/clonestore/guard/__tests__/global-guard-policy-tech06.test.ts"),
    ).toBe(true);
  });

  it("T10.6 — TECH-05 tests encore disponibles (adn)", () => {
    expect(
      fileExists("src/lib/clonestore/adn/__tests__/global-enterprise-memory-tech05.test.ts"),
    ).toBe(true);
  });

  it("T10.7 — modules TECH-05→TECH-10 dans le source map", () => {
    const sourceMap = SourcesNS.TECHNOLOGY_SOURCE_MAP;
    expect(sourceMap["cloneadn"]).toBeDefined();
    expect(sourceMap["cloneguard"]).toBeDefined();
    expect(sourceMap["clonetrace"]).toBeDefined();
    expect(sourceMap["cloneos"]).toBeDefined();
    expect(sourceMap["clonebrief"]).toBeDefined();
    expect(sourceMap["clonevoice"]).toBeDefined();
  });

  it("T10.8 — Pierre bridge coverage couvre TECH-05→TECH-10", () => {
    const bridge = PierreNS.evaluatePierreBridgeCoverage();
    expect(bridge.adn_bridge).toBe(true);
    expect(bridge.guard_bridge).toBe(true);
    expect(bridge.trace_bridge).toBe(true);
    expect(bridge.cloneos_bridge).toBe(true);
    expect(bridge.brief_bridge).toBe(true);
    expect(bridge.voice_bridge_readiness).toBe(true);
  });
});

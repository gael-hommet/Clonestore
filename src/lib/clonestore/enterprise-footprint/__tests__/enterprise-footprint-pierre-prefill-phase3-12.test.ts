// src/lib/clonestore/enterprise-footprint/__tests__/enterprise-footprint-pierre-prefill-phase3-12.test.ts
// PHASE 3.12 — Pierre Use Mission Composer Footprint Prefill QA — Tests
//
// Vérifie :
//   - le module prefill (structure, invariants, sanitisation, validation)
//   - le QA module prefill
//   - l'intégration dans /agents/pierre/use (pas d'auto-submit, microcopy)
//   - la régression de toutes les phases précédentes
//
// Aucun write DB. Aucun appel réseau. Aucun runtime Pierre. Aucun auto-submit.

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(__dirname, "../../../../..");

function readSrc(relativePath: string): string {
  const full = resolve(ROOT, "src", relativePath);
  if (!existsSync(full)) return "";
  return readFileSync(full, "utf-8");
}

function readDocs(filename: string): string {
  const full = resolve(ROOT, "docs", filename);
  if (!existsSync(full)) return "";
  return readFileSync(full, "utf-8");
}

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 1 — Module prefill existe et expose les fonctions attendues
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.12 — Module prefill", () => {
  const prefillPath = "lib/clonestore/enterprise-footprint/enterprise-footprint-pierre-prefill.ts";
  const prefill = readSrc(prefillPath);

  it("1. enterprise-footprint-pierre-prefill.ts existe", () => {
    expect(existsSync(resolve(ROOT, "src", prefillPath))).toBe(true);
  });

  it("3. prefill module contient buildPierreFootprintPrefillPayload", () => {
    expect(prefill).toContain("buildPierreFootprintPrefillPayload");
  });

  it("4. prefill module contient validatePierreFootprintPrefillPayload", () => {
    expect(prefill).toContain("validatePierreFootprintPrefillPayload");
  });

  it("5. prefill module contient sanitizePierreFootprintPrefillPrompt", () => {
    expect(prefill).toContain("sanitizePierreFootprintPrefillPrompt");
  });

  it("6. prefill module contient buildPierreFootprintPrefillConfirmation", () => {
    expect(prefill).toContain("buildPierreFootprintPrefillConfirmation");
  });

  it("7. prefill payload contient plan_only: true", () => {
    expect(prefill).toContain("plan_only: true");
  });

  it("8. prefill payload contient requires_user_submit: true", () => {
    expect(prefill).toContain("requires_user_submit: true");
  });

  it("11. validation interdit sk_live_", () => {
    expect(prefill).toContain("sk_live_");
  });

  it("12. validation interdit whsec_", () => {
    expect(prefill).toContain("whsec_");
  });

  it("13. validation interdit OPENAI_API_KEY", () => {
    expect(prefill).toContain("OPENAI_API_KEY");
  });

  it("14. validation interdit ANTHROPIC_API_KEY", () => {
    expect(prefill).toContain("ANTHROPIC_API_KEY");
  });

  it("15. validation interdit la phrase 'public launch go'", () => {
    expect(prefill).toContain("public launch go");
  });

  it("16. validation interdit 'zéro erreur'", () => {
    expect(prefill).toContain("zéro erreur");
  });

  it("17. validation interdit 'conformité garantie'", () => {
    expect(prefill).toContain("conformité garantie");
  });

  it("prefill module ne contient pas import src/lib/pierre (réel)", () => {
    expect(prefill).not.toMatch(/^import\s+.*from\s+["']@\/lib\/pierre/m);
  });

  it("prefill module ne contient pas fetch/XHR/réseau", () => {
    expect(prefill).not.toContain("fetch(");
    expect(prefill).not.toContain("XMLHttpRequest");
    expect(prefill).not.toContain("axios");
  });

  it("prefill module ne contient pas insert/update/delete/upsert DB", () => {
    expect(prefill).not.toMatch(/\.insert\s*\(/);
    expect(prefill).not.toMatch(/\.update\s*\(/);
    expect(prefill).not.toMatch(/\.delete\s*\(/);
    expect(prefill).not.toMatch(/\.upsert\s*\(/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 2 — Logique validation/sanitisation (fonctions pures)
// ─────────────────────────────────────────────────────────────────────────────

import {
  buildPierreFootprintPrefillPayload,
  validatePierreFootprintPrefillPayload,
  sanitizePierreFootprintPrefillPrompt,
  shouldAllowPierreFootprintPrefill,
  buildPierreFootprintPrefillConfirmation,
} from "@/lib/clonestore/enterprise-footprint";
import type { PierreUseFootprintMissionSuggestion } from "@/lib/clonestore/enterprise-footprint";

const validSuggestion: PierreUseFootprintMissionSuggestion = {
  id: "test_suggestion",
  title: "Préparer une procédure RH",
  prompt: "Pierre, prépare une procédure RH adaptée à notre entreprise.",
  category: "procédure",
  risk_level: "medium",
  requires_validation: true,
  plan_only: true,
  disabled: false,
};

const disabledSuggestion: PierreUseFootprintMissionSuggestion = {
  ...validSuggestion,
  id: "disabled_suggestion",
  disabled: true,
  disabled_reason: "Empreinte requise.",
};

describe("PHASE 3.12 — Logique prefill (tests fonctionnels)", () => {
  it("9. validation refuse plan_only: false (via shouldAllow avec patch)", () => {
    // Le type oblige plan_only: true, mais on peut simuler via un cast
    const badSuggestion = { ...validSuggestion, plan_only: false } as unknown as PierreUseFootprintMissionSuggestion;
    const guard = shouldAllowPierreFootprintPrefill(badSuggestion);
    expect(guard.allowed).toBe(false);
    expect(guard.status).toBe("missing_plan_only");
  });

  it("10. validation refuse prompt vide", () => {
    const emptySuggestion = { ...validSuggestion, prompt: "" };
    const guard = shouldAllowPierreFootprintPrefill(emptySuggestion);
    expect(guard.allowed).toBe(false);
    expect(guard.status).toBe("invalid_prompt");
  });

  it("disabled_suggestion_not_prefilled : disabled → payload null", () => {
    const payload = buildPierreFootprintPrefillPayload(disabledSuggestion);
    expect(payload).toBeNull();
  });

  it("valid suggestion → payload avec plan_only: true et requires_user_submit: true", () => {
    const payload = buildPierreFootprintPrefillPayload(validSuggestion);
    expect(payload).not.toBeNull();
    expect(payload!.plan_only).toBe(true);
    expect(payload!.requires_user_submit).toBe(true);
    expect(payload!.source).toBe("enterprise_footprint_suggestion");
  });

  it("validatePierreFootprintPrefillPayload → valid pour payload correct", () => {
    const payload = buildPierreFootprintPrefillPayload(validSuggestion)!;
    const result = validatePierreFootprintPrefillPayload(payload);
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("validatePierreFootprintPrefillPayload → refuse null", () => {
    const result = validatePierreFootprintPrefillPayload(null);
    expect(result.valid).toBe(false);
  });

  it("validatePierreFootprintPrefillPayload → refuse sk_live_ dans prompt", () => {
    const payload = buildPierreFootprintPrefillPayload(validSuggestion)!;
    const badPayload = { ...payload, prompt: "sk_live_xxx" };
    const result = validatePierreFootprintPrefillPayload(badPayload);
    expect(result.valid).toBe(false);
    expect(result.status).toBe("unsafe_content");
  });

  it("validatePierreFootprintPrefillPayload → refuse OPENAI_API_KEY dans prompt", () => {
    const payload = buildPierreFootprintPrefillPayload(validSuggestion)!;
    const badPayload = { ...payload, prompt: "OPENAI_API_KEY=xxx" };
    const result = validatePierreFootprintPrefillPayload(badPayload);
    expect(result.valid).toBe(false);
    expect(result.status).toBe("unsafe_content");
  });

  it("sanitizePierreFootprintPrefillPrompt → trim et réduction des espaces (3+ → 1)", () => {
    // La fonction réduit les séquences de 3+ espaces/tabs à 1 espace
    const dirty = "  Pierre, prépare   une procédure.  ";
    const clean = sanitizePierreFootprintPrefillPrompt(dirty);
    // Trim supprime les espaces de début/fin
    expect(clean.startsWith(" ")).toBe(false);
    expect(clean.endsWith(" ")).toBe(false);
    // Le triple espace est réduit à un seul
    expect(clean).toBe("Pierre, prépare une procédure.");
  });

  it("sanitizePierreFootprintPrefillPrompt → retourne vide si prompt vide", () => {
    expect(sanitizePierreFootprintPrefillPrompt("")).toBe("");
    expect(sanitizePierreFootprintPrefillPrompt("   ")).toBe("");
  });

  it("buildPierreFootprintPrefillConfirmation → message contient 'Suggestion ajoutée au composer'", () => {
    const payload = buildPierreFootprintPrefillPayload(validSuggestion)!;
    const conf = buildPierreFootprintPrefillConfirmation(payload);
    expect(conf.message).toContain("Suggestion ajoutée au composer");
    expect(conf.sub_message).toContain("Aucun envoi automatique");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 3 — QA module prefill
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.12 — QA Module prefill", () => {
  const qaPath = "lib/clonestore/enterprise-footprint/enterprise-footprint-pierre-prefill-qa.ts";
  const qa = readSrc(qaPath);

  it("2. enterprise-footprint-pierre-prefill-qa.ts existe", () => {
    expect(existsSync(resolve(ROOT, "src", qaPath))).toBe(true);
  });

  it("18. QA module contient buildPierreFootprintPrefillQaChecklist", () => {
    expect(qa).toContain("buildPierreFootprintPrefillQaChecklist");
  });

  it("19. QA module contient no_auto_submit", () => {
    expect(qa).toContain("no_auto_submit");
  });

  it("20. QA module contient prefill_sets_input_only", () => {
    expect(qa).toContain("prefill_sets_input_only");
  });

  it("21. QA module contient existing_submit_preserved", () => {
    expect(qa).toContain("existing_submit_preserved");
  });

  it("22. QA module ne contient pas Supabase createClient (réel)", () => {
    expect(qa).not.toMatch(/^import\s+.*createClient.*from\s+["']@supabase/m);
    expect(qa).not.toMatch(/^import\s+.*from\s+["']@supabase\/supabase-js["']/m);
  });

  it("23. QA module ne contient pas insert/update/delete/upsert", () => {
    expect(qa).not.toMatch(/\.insert\s*\(/);
    expect(qa).not.toMatch(/\.update\s*\(/);
    expect(qa).not.toMatch(/\.delete\s*\(/);
    expect(qa).not.toMatch(/\.upsert\s*\(/);
  });

  it("24. QA module ne contient pas import src/lib/pierre (réel)", () => {
    expect(qa).not.toMatch(/^import\s+.*from\s+["']@\/lib\/pierre/m);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 4 — Intégration /agents/pierre/use
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.12 — Intégration /agents/pierre/use", () => {
  const pagePath = "app/agents/pierre/use/page.tsx";
  const page = readSrc(pagePath);

  it("25. /agents/pierre/use mentionne 'Préremplit uniquement le composer' ou équivalent", () => {
    const hasMicrocopy =
      page.includes("Préremplit uniquement le composer") ||
      page.includes("Préremplit uniquement");
    expect(hasMicrocopy).toBe(true);
  });

  it("26. /agents/pierre/use mentionne 'Aucun envoi automatique' ou équivalent", () => {
    const hasNoAutoSubmit =
      page.includes("Aucun envoi automatique") ||
      page.includes("aucun envoi automatique");
    expect(hasNoAutoSubmit).toBe(true);
  });

  it("27. /agents/pierre/use mentionne 'Suggestion ajoutée au composer' ou équivalent", () => {
    const hasConfirmation =
      page.includes("Suggestion ajoutée au composer") ||
      page.includes("ajoutée au composer");
    expect(hasConfirmation).toBe(true);
  });

  it("28. /agents/pierre/use utilise le prefill module (buildPierreFootprintPrefillPayload)", () => {
    expect(page).toContain("buildPierreFootprintPrefillPayload");
  });

  it("29. /agents/pierre/use ne contient pas suggestion.*submitMission", () => {
    expect(page).not.toMatch(/suggestion.*submitMission/);
  });

  it("30. /agents/pierre/use ne contient pas suggestion.*handleSubmit", () => {
    expect(page).not.toMatch(/suggestion.*handleSubmit/);
  });

  it("31. /agents/pierre/use ne contient pas suggestion.*fetch", () => {
    expect(page).not.toMatch(/suggestion.*fetch\(/);
  });

  it("32. /agents/pierre/use ne contient pas suggestion.*api call", () => {
    expect(page).not.toMatch(/suggestion.*\/api\//);
  });

  it("33. /agents/pierre/use ne contient pas insert/upsert direct", () => {
    expect(page).not.toMatch(/\.insert\s*\(/);
    expect(page).not.toMatch(/\.upsert\s*\(/);
  });

  it("34. /agents/pierre/use conserve PierreCockpitShell", () => {
    expect(page).toContain("PierreCockpitShell");
  });

  it("callback prefill appelle setInputDraft, jamais submitMission", () => {
    expect(page).toContain("setInputDraft");
    // Le callback prefill ne doit pas appeler submitMission directement
    // (submitMission reste dans usePierreCockpit appelé par PierreCockpitShell)
    expect(page).not.toMatch(/handleUseFootprintSuggestion.*submitMission/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 5 — Index exports PHASE 3.12
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.12 — Index exports", () => {
  const index = readSrc("lib/clonestore/enterprise-footprint/index.ts");

  it("index.ts exporte PierreFootprintPrefillPayload", () => {
    expect(index).toContain("PierreFootprintPrefillPayload");
  });

  it("index.ts exporte buildPierreFootprintPrefillPayload", () => {
    expect(index).toContain("buildPierreFootprintPrefillPayload");
  });

  it("index.ts exporte validatePierreFootprintPrefillPayload", () => {
    expect(index).toContain("validatePierreFootprintPrefillPayload");
  });

  it("index.ts exporte buildPierreFootprintPrefillQaChecklist", () => {
    expect(index).toContain("buildPierreFootprintPrefillQaChecklist");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 6 — Doc PHASE 3.12
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.12 — Documentation", () => {
  const docName = "PHASE_3_12_PIERRE_USE_MISSION_COMPOSER_FOOTPRINT_PREFILL_QA.md";
  const doc = readDocs(docName);

  it("36. doc PHASE_3_12 existe", () => {
    expect(existsSync(resolve(ROOT, "docs", docName))).toBe(true);
  });

  it("37. doc mentionne /agents/pierre/use", () => {
    expect(doc).toContain("/agents/pierre/use");
  });

  it("38. doc mentionne prefill", () => {
    const hasPrefill =
      doc.toLowerCase().includes("prefill") ||
      doc.toLowerCase().includes("préremplissage");
    expect(hasPrefill).toBe(true);
  });

  it("39. doc mentionne plan-only", () => {
    const hasPlanOnly =
      doc.toLowerCase().includes("plan-only") ||
      doc.toLowerCase().includes("plan_only");
    expect(hasPlanOnly).toBe(true);
  });

  it("40. doc mentionne no auto-submit / aucun envoi automatique", () => {
    const hasNoAutoSubmit =
      doc.toLowerCase().includes("auto-submit") ||
      doc.toLowerCase().includes("aucun envoi automatique") ||
      doc.toLowerCase().includes("no auto-submit");
    expect(hasNoAutoSubmit).toBe(true);
  });

  it("41. doc mentionne PHASE 3.13", () => {
    expect(doc).toContain("3.13");
  });

  it("42. doc ne contient pas la phrase exacte 'public launch go'", () => {
    expect(doc.toLowerCase()).not.toContain("public launch go");
  });

  it("43. doc ne contient pas 'zéro erreur'", () => {
    expect(doc.toLowerCase()).not.toContain("zéro erreur");
    expect(doc.toLowerCase()).not.toContain("zero erreur");
  });

  it("44. doc ne contient pas 'conformité garantie'", () => {
    expect(doc.toLowerCase()).not.toContain("conformité garantie");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 7 — Régression PHASE 3.11 non cassée
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.12 — Régression PHASE 3.11", () => {
  const page = readSrc("app/agents/pierre/use/page.tsx");
  const useModule = readSrc("lib/clonestore/enterprise-footprint/enterprise-footprint-pierre-use.ts");

  it("45. bridge use (P3.11) toujours présent", () => {
    expect(existsSync(resolve(ROOT, "src", "lib/clonestore/enterprise-footprint/enterprise-footprint-pierre-use.ts"))).toBe(true);
  });

  it("46. loadPierreUseEnterpriseFootprint toujours utilisé dans page", () => {
    expect(page).toContain("loadPierreUseEnterpriseFootprint");
  });

  it("47. bridge use contient plan_only: true", () => {
    expect(useModule).toContain("plan_only: true");
  });

  it("48. page conserve les badges P3.11 (Lecture seule, Plan-only, Aucune action)", () => {
    expect(page).toContain("Lecture seule");
    expect(page).toContain("Plan-only");
    expect(page).toContain("Aucune action exécutée");
  });

  it("49. PierreCockpitShell non modifié (toujours importé depuis components)", () => {
    expect(page).toContain('from "./components/PierreCockpitShell"');
  });
});

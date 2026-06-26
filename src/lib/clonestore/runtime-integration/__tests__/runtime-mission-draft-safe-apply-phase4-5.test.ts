// src/lib/clonestore/runtime-integration/__tests__/runtime-mission-draft-safe-apply-phase4-5.test.ts
// PHASE 4.5 — Runtime Mission Draft Safe Apply / LocalStorage First — Tests

import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(__dirname, "../../../../..");
const RI_DIR = "lib/clonestore/runtime-integration";

function readSrc(rel: string): string {
  const full = resolve(ROOT, "src", rel);
  if (!existsSync(full)) return "";
  return readFileSync(full, "utf-8");
}
function readDocs(name: string): string {
  const full = resolve(ROOT, "docs", name);
  if (!existsSync(full)) return "";
  return readFileSync(full, "utf-8");
}
function readRoot(name: string): string {
  const full = resolve(ROOT, name);
  if (!existsSync(full)) return "";
  return readFileSync(full, "utf-8");
}

const lsSrc = readSrc(`${RI_DIR}/runtime-mission-draft-localstorage.ts`);
const typesSrc = readSrc(`${RI_DIR}/runtime-mission-draft-safe-apply-types.ts`);
const contractSrc = readSrc(`${RI_DIR}/runtime-mission-draft-server-api-contract.ts`);
const clientSrc = readSrc(`${RI_DIR}/runtime-mission-draft-api-client.ts`);
const safeApplySrc = readSrc(`${RI_DIR}/runtime-mission-draft-safe-apply.ts`);
const uiSrc = readSrc(`${RI_DIR}/runtime-mission-draft-safe-apply-ui.ts`);
const qaSrc = readSrc(`${RI_DIR}/runtime-mission-draft-safe-apply-qa.ts`);
const routeSrc = readSrc("app/api/clonestore/runtime/mission-drafts/route.ts");
const indexSrc = readSrc(`${RI_DIR}/index.ts`);
const messagesSrc = readSrc("app/profile/messages/page.tsx");

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 1 — Fichiers
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.5 — Fichiers", () => {
  const files = [
    "runtime-mission-draft-localstorage.ts", "runtime-mission-draft-safe-apply-types.ts",
    "runtime-mission-draft-server-api-contract.ts", "runtime-mission-draft-api-client.ts",
    "runtime-mission-draft-safe-apply.ts", "runtime-mission-draft-safe-apply-ui.ts",
    "runtime-mission-draft-safe-apply-qa.ts",
  ];
  files.forEach((f, i) => {
    it(`${i + 1}. ${f} existe`, () => {
      expect(existsSync(resolve(ROOT, "src", `${RI_DIR}/${f}`))).toBe(true);
    });
  });
  it("8. route mission-drafts existe", () => {
    expect(existsSync(resolve(ROOT, "src", "app/api/clonestore/runtime/mission-drafts/route.ts"))).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 2 — LocalStorage runtime
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.5 — LocalStorage runtime (statique)", () => {
  const fns = [
    ["9", "saveRuntimeMissionDraftToLocalStorage"],
    ["10", "loadRuntimeMissionDraftsFromLocalStorage"],
    ["11", "loadLatestRuntimeMissionDraftFromLocalStorage"],
    ["12", "removeRuntimeMissionDraftFromLocalStorage"],
    ["13", "clearRuntimeMissionDraftsFromLocalStorage"],
    ["14", "typeof window"],
    ["15", "localStorage.setItem"],
    ["16", "localStorage.getItem"],
  ];
  fns.forEach(([n, fn]) => {
    it(`${n}. localstorage runtime contient ${fn}`, () => {
      expect(lsSrc).toContain(fn);
    });
  });
  it("17. localstorage runtime ne contient pas fetch", () => {
    expect(lsSrc).not.toMatch(/\bfetch\s*\(/);
  });
  it("18. localstorage runtime ne contient pas Supabase createClient", () => {
    expect(lsSrc).not.toMatch(/createClient\s*\(/);
    expect(lsSrc).not.toMatch(/from\s+["']@supabase\/supabase-js["']/);
  });
  it("19. localstorage runtime ne contient pas import src/lib/pierre", () => {
    expect(lsSrc).not.toMatch(/from\s+["']@\/lib\/pierre/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 3 — Types + contract
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.5 — Types + contract", () => {
  it("20. safe apply types contiennent local_saved_server_disabled", () => {
    expect(typesSrc).toContain("local_saved_server_disabled");
  });
  it("21. safe apply types contiennent local_saved_server_synced", () => {
    expect(typesSrc).toContain("local_saved_server_synced");
  });
  it("22. safe apply types contiennent restored_local", () => {
    expect(typesSrc).toContain("restored_local");
  });
  it("23. server api contract contient supports_execution false", () => {
    expect(contractSrc).toContain("supports_execution: false");
  });
  it("24. server api contract contient supports_mission_creation false", () => {
    expect(contractSrc).toContain("supports_mission_creation: false");
  });
  it("25. server api contract contient supports_ai_call false", () => {
    expect(contractSrc).toContain("supports_ai_call: false");
  });
  it("26. server api contract contient scale_80k_not_proven true", () => {
    expect(contractSrc).toContain("scale_80k_not_proven: true");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 4 — Route
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.5 — Route", () => {
  it("27. route GET existe", () => { expect(routeSrc).toMatch(/export\s+async\s+function\s+GET/); });
  it("28. route POST existe", () => { expect(routeSrc).toMatch(/export\s+async\s+function\s+POST/); });
  it("29. route contient le flag", () => {
    expect(routeSrc).toContain("isRuntimeMissionDraftServerPersistenceEnabled");
  });
  it("30. route contient 423", () => { expect(routeSrc).toContain("423"); });
  it("31. route porte db_write_performed false (via builders)", () => {
    expect(contractSrc).toContain("db_write_performed: false");
  });
  it("32. contrat porte mission_created false", () => {
    expect(contractSrc).toContain("mission_created: false");
  });
  it("33. contrat porte execution_started false", () => {
    expect(contractSrc).toContain("execution_started: false");
  });
  it("34. route ne contient pas import src/lib/pierre", () => {
    expect(routeSrc).not.toMatch(/from\s+["']@\/lib\/pierre/);
  });
  it("35. route ne contient pas openai", () => { expect(routeSrc.toLowerCase()).not.toContain("openai"); });
  it("36. route ne contient pas anthropic", () => { expect(routeSrc.toLowerCase()).not.toContain("anthropic"); });
  it("37. route ne contient pas stripe", () => { expect(routeSrc.toLowerCase()).not.toContain("stripe"); });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 5 — API client + safe apply runtime + UI + QA
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.5 — Client + runtime + UI + QA", () => {
  it("38. api client appelle /api/clonestore/runtime/mission-drafts", () => {
    const has = clientSrc.includes("RUNTIME_MISSION_DRAFT_SERVER_ENDPOINT") || clientSrc.includes("/api/clonestore/runtime/mission-drafts");
    expect(has).toBe(true);
  });
  it("39. api client ne contient pas /api/pierre", () => {
    expect(clientSrc).not.toContain("/api/pierre");
  });
  it("40. safe apply runtime contient persistRuntimeMissionDraftWithFallback", () => {
    expect(safeApplySrc).toContain("persistRuntimeMissionDraftWithFallback");
  });
  it("41. safe apply runtime contient restoreRuntimeMissionDraftWithFallback", () => {
    expect(safeApplySrc).toContain("restoreRuntimeMissionDraftWithFallback");
  });
  it("42. safe apply runtime save local avant tentative serveur", () => {
    const saveIdx = safeApplySrc.indexOf("saveRuntimeMissionDraftToLocalStorage");
    const serverIdx = safeApplySrc.indexOf("postRuntimeMissionDraftServerSave");
    expect(saveIdx).toBeGreaterThan(-1);
    expect(serverIdx).toBeGreaterThan(-1);
    expect(saveIdx).toBeLessThan(serverIdx);
  });
  it("43. safe apply runtime contient postRuntimeMissionDraftServerSave", () => {
    expect(safeApplySrc).toContain("postRuntimeMissionDraftServerSave");
  });
  it("44. safe apply runtime ne contient pas Supabase createClient", () => {
    expect(safeApplySrc).not.toMatch(/createClient\s*\(/);
    expect(safeApplySrc).not.toMatch(/from\s+["']@supabase\/supabase-js["']/);
  });
  it("45. safe apply runtime ne contient pas import src/lib/pierre", () => {
    expect(safeApplySrc).not.toMatch(/from\s+["']@\/lib\/pierre/);
  });
  it("46. safe apply UI contient localStorage-first", () => {
    expect(uiSrc).toContain("localStorage-first");
  });
  it("47. safe apply UI contient Aucune mission créée", () => {
    expect(uiSrc).toContain("Aucune mission créée");
  });
  it("48. safe apply UI contient Aucun appel Pierre", () => {
    expect(uiSrc).toContain("Aucun appel Pierre");
  });
  it("49. safe apply UI contient Aucun appel IA", () => {
    expect(uiSrc).toContain("Aucun appel IA");
  });
  it("50. safe apply UI contient CloneVoice non actif", () => {
    expect(uiSrc).toContain("CloneVoice non actif");
  });
  it("51. safe apply QA contient server_route_returns_423_when_disabled", () => {
    expect(qaSrc).toContain("server_route_returns_423_when_disabled");
  });
  it("52. safe apply QA contient localstorage_first", () => {
    expect(qaSrc).toContain("localstorage_first");
  });
  it("53. safe apply QA contient no_mission_created", () => {
    expect(qaSrc).toContain("no_mission_created");
  });
  it("54. safe apply QA contient no_pierre_engine_import", () => {
    expect(qaSrc).toContain("no_pierre_engine_import");
  });
  it("55. safe apply QA contient public_launch_external_not_validated", () => {
    expect(qaSrc).toContain("public_launch_external_not_validated");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 6 — Intégration /profile/messages
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.5 — Intégration /profile/messages", () => {
  it("56. mentionne Sauvegarder le brouillon localement", () => {
    expect(messagesSrc).toContain("Sauvegarder le brouillon localement");
  });
  it("57. mentionne Restaurer le dernier brouillon local", () => {
    expect(messagesSrc).toContain("Restaurer le dernier brouillon local");
  });
  it("58. mentionne localStorage-first", () => {
    expect(messagesSrc).toContain("localStorage-first");
  });
  it("59. mentionne Aucune mission créée", () => {
    expect(messagesSrc).toContain("Aucune mission créée");
  });
  it("60. mentionne Aucun appel Pierre", () => {
    expect(messagesSrc).toContain("Aucun appel Pierre");
  });
  it("61. utilise persistRuntimeMissionDraftWithFallback", () => {
    expect(messagesSrc).toContain("persistRuntimeMissionDraftWithFallback");
  });
  it("62. utilise restoreRuntimeMissionDraftWithFallback", () => {
    expect(messagesSrc).toContain("restoreRuntimeMissionDraftWithFallback");
  });
  it("63. ne contient pas /api/pierre", () => {
    expect(messagesSrc).not.toContain("/api/pierre");
  });
  it("64. ne contient pas Supabase createClient", () => {
    expect(messagesSrc).not.toMatch(/createClient\s*\(/);
  });
  it("65. ne contient pas direct fetch vers mission-drafts", () => {
    expect(messagesSrc).not.toMatch(/fetch\s*\([^)]*mission-drafts/s);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 7 — Documentation + evidence
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.5 — Documentation + evidence", () => {
  const doc = readDocs("PHASE_4_5_RUNTIME_MISSION_DRAFT_SAFE_APPLY_LOCALSTORAGE_FIRST.md");
  const tpl = readRoot("docs/templates/PHASE_4_5_RUNTIME_MISSION_DRAFT_SAFE_APPLY_EVIDENCE.md");

  it("66. doc P4.5 existe", () => { expect(doc.length).toBeGreaterThan(0); });
  it("67. doc mentionne P4.5", () => { expect(doc).toContain("4.5"); });
  it("68. doc mentionne localStorage runtime", () => { expect(doc.toLowerCase()).toContain("localstorage runtime"); });
  it("69. doc mentionne POST 423", () => { expect(doc).toContain("423"); });
  it("70. doc mentionne aucune mission réelle créée", () => {
    const has = doc.toLowerCase().includes("aucune mission réelle créée") || doc.toLowerCase().includes("jamais de mission réelle");
    expect(has).toBe(true);
  });
  it("71. doc mentionne aucun appel Pierre", () => { expect(doc.toLowerCase()).toContain("aucun appel pierre"); });
  it("72. doc mentionne scale 80k non prouvé", () => {
    const has = doc.toLowerCase().includes("scale 80k non prouvé") || (doc.includes("80k") && doc.toLowerCase().includes("non prouvé"));
    expect(has).toBe(true);
  });
  it("73. doc mentionne PHASE 4.6", () => { expect(doc).toContain("4.6"); });
  it("74. doc ne contient pas phrase de lancement public interdite", () => { expect(doc.toLowerCase()).not.toContain("public launch go"); });
  it("75. doc ne contient pas 'zéro erreur'", () => {
    expect(doc.toLowerCase()).not.toContain("zéro erreur");
    expect(doc.toLowerCase()).not.toContain("zero erreur");
  });
  it("76. doc ne contient pas 'conformité garantie'", () => { expect(doc.toLowerCase()).not.toContain("conformité garantie"); });
  it("77. doc ne contient pas '80k scale proven'", () => { expect(doc.toLowerCase()).not.toContain("80k scale proven"); });
  it("78. doc ne contient pas '80k clients guaranteed'", () => { expect(doc.toLowerCase()).not.toContain("80k clients guaranteed"); });
  it("79. evidence template existe", () => { expect(tpl.length).toBeGreaterThan(0); });
  it("80. evidence mentionne Sauvegarde localStorage OK", () => { expect(tpl).toContain("Sauvegarde localStorage OK"); });
  it("81. evidence mentionne POST serveur retourne 423", () => { expect(tpl).toContain("POST serveur retourne 423"); });
  it("82. evidence mentionne Mission créée en base ? non", () => { expect(tpl).toContain("Mission créée en base"); });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 8 — Exports + package
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.5 — Exports + package", () => {
  it("83. index exports localstorage runtime", () => { expect(indexSrc).toContain("saveRuntimeMissionDraftToLocalStorage"); });
  it("84. index exports safe apply types", () => { expect(indexSrc).toContain("RuntimeMissionDraftSafeApplyResult"); });
  it("85. index exports server API contract", () => { expect(indexSrc).toContain("buildRuntimeMissionDraftServerCapabilities"); });
  it("86. index exports api client", () => { expect(indexSrc).toContain("postRuntimeMissionDraftServerSave"); });
  it("87. index exports safe apply runtime", () => { expect(indexSrc).toContain("persistRuntimeMissionDraftWithFallback"); });
  it("88. index exports safe apply UI", () => { expect(indexSrc).toContain("buildRuntimeMissionDraftSafeApplyUiSnapshot"); });
  it("89. index exports safe apply QA", () => { expect(indexSrc).toContain("buildRuntimeMissionDraftSafeApplyQaChecklist"); });
  it("90. package.json contient test:phase4-5", () => { expect(readRoot("package.json")).toContain("test:phase4-5"); });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 9 — Tests fonctionnels (window mocké)
// ─────────────────────────────────────────────────────────────────────────────

import {
  simulateCloneOSToPierreRuntimePlan,
  buildRuntimeMissionDraftFromIntegrationResult,
  saveRuntimeMissionDraftToLocalStorage,
  loadLatestRuntimeMissionDraftFromLocalStorage,
  clearRuntimeMissionDraftsFromLocalStorage,
  persistRuntimeMissionDraftWithFallback,
  restoreRuntimeMissionDraftWithFallback,
  buildRuntimeMissionDraftServerCapabilities,
  buildRuntimeMissionDraftSafeApplyUiSnapshot,
  buildRuntimeMissionDraftSafeApplyUiBadges,
  buildRuntimeMissionDraftSafeApplyUiTimeline,
} from "@/lib/clonestore/runtime-integration";

function draftFrom(text: string) {
  const result = simulateCloneOSToPierreRuntimePlan({ raw_text: text, company_id: "co_1" });
  return buildRuntimeMissionDraftFromIntegrationResult(result);
}

// Mock localStorage
class MemStorage {
  store: Record<string, string> = {};
  getItem(k: string) { return this.store[k] ?? null; }
  setItem(k: string, v: string) { this.store[k] = v; }
  removeItem(k: string) { delete this.store[k]; }
  clear() { this.store = {}; }
}

describe("PHASE 4.5 — Tests fonctionnels (window mocké)", () => {
  beforeEach(() => {
    const mem = new MemStorage();
    vi.stubGlobal("window", { localStorage: mem });
    vi.stubGlobal("localStorage", mem);
  });

  it("120. save localStorage fonctionne", () => {
    const draft = draftFrom("Préparer onboarding salarié");
    const res = saveRuntimeMissionDraftToLocalStorage(draft);
    expect(res.ok).toBe(true);
    expect(res.envelope?.draft_id).toBe(draft.draft_id);
  });

  it("121. load latest retourne le dernier brouillon", () => {
    const draft = draftFrom("Gérer une absence salarié");
    saveRuntimeMissionDraftToLocalStorage(draft);
    const latest = loadLatestRuntimeMissionDraftFromLocalStorage();
    expect(latest?.draft_id).toBe(draft.draft_id);
  });

  it("122. restore local retourne restored_local", async () => {
    const draft = draftFrom("Préparer onboarding salarié");
    saveRuntimeMissionDraftToLocalStorage(draft);
    const res = await restoreRuntimeMissionDraftWithFallback({ force_local_only: true });
    expect(res.status).toBe("restored_local");
    expect(res.draft?.draft_id).toBe(draft.draft_id);
    expect(res.execution_started).toBe(false);
  });

  it("123. persist flag false → local_saved_server_disabled", async () => {
    const draft = draftFrom("Préparer onboarding salarié");
    const res = await persistRuntimeMissionDraftWithFallback(draft);
    expect(res.local_saved).toBe(true);
    expect(res.status).toBe("local_saved_server_disabled");
    const latest = loadLatestRuntimeMissionDraftFromLocalStorage();
    expect(latest?.draft_id).toBe(draft.draft_id);
  });

  it("124. persist ne met jamais mission_created true", async () => {
    const draft = draftFrom("Préparer onboarding salarié");
    const res = await persistRuntimeMissionDraftWithFallback(draft);
    expect(res.mission_created).toBe(false);
  });

  it("125. persist ne met jamais execution_started true", async () => {
    const draft = draftFrom("Préparer onboarding salarié");
    const res = await persistRuntimeMissionDraftWithFallback(draft);
    expect(res.execution_started).toBe(false);
  });

  it("126. capabilities : supports_execution false", () => {
    const caps = buildRuntimeMissionDraftServerCapabilities(false);
    expect(caps.supports_execution).toBe(false);
    expect(caps.supports_mission_creation).toBe(false);
    expect(caps.scale_80k_not_proven).toBe(true);
  });

  it("128. UI snapshot inclut badges + timeline", async () => {
    const draft = draftFrom("Préparer onboarding salarié");
    const res = await persistRuntimeMissionDraftWithFallback(draft);
    const snap = buildRuntimeMissionDraftSafeApplyUiSnapshot(res);
    const badges = buildRuntimeMissionDraftSafeApplyUiBadges(snap).map((b) => b.label);
    expect(badges).toContain("localStorage-first");
    expect(badges).toContain("Aucune mission créée");
    const timeline = buildRuntimeMissionDraftSafeApplyUiTimeline(snap);
    expect(timeline.length).toBeGreaterThan(0);
  });

  it("129. persist d'un draft non-safe → validation_failed", async () => {
    const draft = draftFrom("Préparer onboarding salarié");
    const tampered = { ...draft, execution_enabled: true as unknown as false };
    const res = await persistRuntimeMissionDraftWithFallback(tampered);
    expect(res.status).toBe("validation_failed");
    expect(res.local_saved).toBe(false);
  });

  it("130. clear localStorage", () => {
    const draft = draftFrom("Préparer onboarding salarié");
    saveRuntimeMissionDraftToLocalStorage(draft);
    clearRuntimeMissionDraftsFromLocalStorage();
    expect(loadLatestRuntimeMissionDraftFromLocalStorage()).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 10 — Aucune persist auto au mount
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.5 — Aucune persist auto au mount", () => {
  it("130b. aucun useEffect n'appelle persistRuntimeMissionDraftWithFallback", () => {
    const useEffectBlocks = messagesSrc.match(/useEffect\([\s\S]*?\}\s*,\s*\[[^\]]*\]\s*\)/g) ?? [];
    const autoPersist = useEffectBlocks.some((b) => b.includes("persistRuntimeMissionDraftWithFallback"));
    expect(autoPersist).toBe(false);
  });
});

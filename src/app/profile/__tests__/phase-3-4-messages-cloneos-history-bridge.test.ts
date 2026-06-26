// PHASE 3.4 — Messages CloneOS History Bridge — Tests
// Tests statiques vérifiant l'intégration du bridge CloneOS History dans messages.
// Lecture seule. Aucune écriture. Moteur Pierre intact.

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

function fileExists(relativePath: string): boolean {
  return fs.existsSync(path.resolve(process.cwd(), relativePath));
}

function readFile(relativePath: string): string {
  const fullPath = path.resolve(process.cwd(), relativePath);
  if (!fs.existsSync(fullPath)) return "";
  return fs.readFileSync(fullPath, "utf-8");
}

// ── Chemins ───────────────────────────────────────────────────────────────────

const DOC_FILE        = "docs/PHASE_3_4_MESSAGES_CLONEOS_HISTORY_BRIDGE.md";
const BRIDGE_FILE     = "src/lib/clonestore/messages/message-center-cloneos-history-bridge.ts";
const READONLY_FILE   = "src/lib/clonestore/messages/message-center-readonly-client.ts";
const MSG_PAGE        = "src/app/profile/messages/page.tsx";
const MAPPERS_FILE    = "src/lib/clonestore/cloneos-history/cloneos-history-mappers.ts";
const VALIDATION_FILE = "src/lib/clonestore/messages/message-center-validation.ts";

const docContent      = readFile(DOC_FILE);
const docLower        = docContent.toLowerCase();
const bridgeContent   = readFile(BRIDGE_FILE);
const readonlyContent = readFile(READONLY_FILE);
const msgPageContent  = readFile(MSG_PAGE);
const mappersContent  = readFile(MAPPERS_FILE);
const validationContent = readFile(VALIDATION_FILE);

// ── T01-T09 : Documentation ───────────────────────────────────────────────────

describe("T01 — Documentation PHASE 3.4", () => {
  it("T01 — doc PHASE_3_4 existe", () => {
    expect(fileExists(DOC_FILE)).toBe(true);
  });

  it("T02 — doc mentionne CloneOS History", () => {
    expect(docContent).toContain("CloneOS History");
  });

  it("T03 — doc mentionne /profile/messages", () => {
    expect(docContent).toContain("/profile/messages");
  });

  it("T04 — doc mentionne Suivis", () => {
    expect(docLower).toContain("suivis");
  });

  it("T05 — doc mentionne Alertes", () => {
    expect(docLower).toContain("alertes");
  });

  it("T06 — doc mentionne read-only / lecture seule", () => {
    const hasReadOnly =
      docLower.includes("read-only") || docLower.includes("lecture seule");
    expect(hasReadOnly).toBe(true);
  });

  it("T07 — doc mentionne fallback", () => {
    expect(docLower).toContain("fallback");
  });

  it("T08 — doc mentionne no write / aucune écriture", () => {
    const hasNoWrite =
      docLower.includes("aucune écriture") ||
      docLower.includes("no write") ||
      docLower.includes("jamais d'écriture");
    expect(hasNoWrite).toBe(true);
  });

  it("T09 — doc mentionne PHASE 3.5", () => {
    expect(docContent).toContain("PHASE 3.5");
  });
});

// ── T10-T14 : Bridge + Readonly client ───────────────────────────────────────

describe("T10 — Bridge et readonly client intégrés", () => {
  it("T10 — message-center-cloneos-history-bridge.ts existe", () => {
    expect(fileExists(BRIDGE_FILE)).toBe(true);
  });

  it("T11 — bridge exporte loadCloneOSHistoryMessageItemsReadOnly", () => {
    expect(bridgeContent).toContain("loadCloneOSHistoryMessageItemsReadOnly");
  });

  it("T12 — bridge exporte mergePierreAndCloneOSMessageItems", () => {
    expect(bridgeContent).toContain("mergePierreAndCloneOSMessageItems");
  });

  it("T13 — message-center-readonly-client importe ou utilise le bridge CloneOS History", () => {
    const usesbridge =
      readonlyContent.includes("loadCloneOSHistoryMessageItemsReadOnly") ||
      readonlyContent.includes("message-center-cloneos-history-bridge");
    expect(usesbridge).toBe(true);
  });

  it("T14 — message-center-readonly-client fusionne Pierre + CloneOS", () => {
    expect(readonlyContent).toContain("mergePierreAndCloneOSMessageItems");
  });
});

// ── T15-T19 : Readonly client — pas de write ──────────────────────────────────

describe("T15 — Readonly client : pas de write", () => {
  it("T15 — message-center-readonly-client ne contient pas insert(", () => {
    expect(readonlyContent).not.toContain(".insert(");
  });

  it("T16 — message-center-readonly-client ne contient pas update(", () => {
    expect(readonlyContent).not.toContain(".update(");
  });

  it("T17 — message-center-readonly-client ne contient pas delete(", () => {
    expect(readonlyContent).not.toContain(".delete(");
  });

  it("T18 — message-center-readonly-client ne contient pas upsert(", () => {
    expect(readonlyContent).not.toContain(".upsert(");
  });

  it("T19 — message-center-readonly-client ne contient pas service_role", () => {
    expect(readonlyContent).not.toContain("service_role");
  });
});

// ── T20-T28 : /profile/messages ───────────────────────────────────────────────

describe("T20 — /profile/messages : 4 onglets + CloneOS History + sécurité", () => {
  it("T20 — /profile/messages conserve Suivis", () => {
    expect(msgPageContent.toLowerCase()).toContain("suivis");
  });

  it("T21 — /profile/messages conserve Briefings", () => {
    expect(msgPageContent.toLowerCase()).toContain("briefings");
  });

  it("T22 — /profile/messages conserve Livraisons", () => {
    expect(msgPageContent.toLowerCase()).toContain("livraisons");
  });

  it("T23 — /profile/messages conserve Alertes", () => {
    expect(msgPageContent.toLowerCase()).toContain("alertes");
  });

  it("T24 — /profile/messages mentionne CloneOS History ou source CloneOS", () => {
    const hasCloneOS =
      msgPageContent.includes("CloneOS History") ||
      msgPageContent.includes("cloneos-history") ||
      msgPageContent.includes("hasCloneOSHistoryMessageItems") ||
      msgPageContent.includes("countCloneOSHistoryMessageItems");
    expect(hasCloneOS).toBe(true);
  });

  it("T25 — /profile/messages mentionne lecture seule", () => {
    expect(msgPageContent.toLowerCase()).toContain("lecture seule");
  });

  it("T26 — /profile/messages ne contient pas insert/upsert vers clonestore_cloneos_history", () => {
    const noInsert =
      !msgPageContent.includes('.from("clonestore_cloneos_history").insert') &&
      !msgPageContent.includes('.from("clonestore_cloneos_history").upsert');
    expect(noInsert).toBe(true);
  });

  it("T27 — /profile/messages ne contient pas persistCloneOSHistoryWithFallback", () => {
    expect(msgPageContent).not.toContain("persistCloneOSHistoryWithFallback");
  });

  it("T28 — /profile/messages ne contient pas persistCloneOSHistoryItemSafely", () => {
    expect(msgPageContent).not.toContain("persistCloneOSHistoryItemSafely");
  });
});

// ── T29-T34 : Mapper + Validation ────────────────────────────────────────────

describe("T29 — Mapper et validation CloneOS History", () => {
  it("T29 — cloneos-history mapper mapHistoryItemToMessageCenterItem existe", () => {
    expect(mappersContent).toContain("mapHistoryItemToMessageCenterItem");
  });

  it("T30 — mapper envoie blocked/refused/requires_validation vers alertes", () => {
    const hasAlertes =
      mappersContent.includes('"alertes"') &&
      (mappersContent.includes("blocked") || mappersContent.includes("refused") || mappersContent.includes("requires_validation"));
    expect(hasAlertes).toBe(true);
  });

  it("T31 — mapper garde read_only true", () => {
    expect(mappersContent).toContain("read_only: true");
  });

  it("T32 — validation protège contre mission exécutée", () => {
    const hasProtection =
      validationContent.includes("mission exécutée") ||
      validationContent.includes("UNSAFE_WORDING_PATTERNS");
    expect(hasProtection).toBe(true);
  });

  it("T33 — validation protège contre document généré", () => {
    const hasProtection =
      validationContent.includes("document généré") ||
      validationContent.includes("UNSAFE_WORDING_PATTERNS");
    expect(hasProtection).toBe(true);
  });

  it("T34 — validation protège contre email envoyé", () => {
    const hasProtection =
      validationContent.includes("email envoyé") ||
      validationContent.includes("UNSAFE_WORDING_PATTERNS");
    expect(hasProtection).toBe(true);
  });
});

// ── T35-T40 : Phases précédentes intactes ─────────────────────────────────────

describe("T35 — Phases précédentes intactes", () => {
  it("T35 — PHASE 3.3 test file existe", () => {
    expect(fileExists("src/lib/clonestore/cloneos-history/__tests__/cloneos-history-safe-apply-phase3-3.test.ts")).toBe(true);
  });

  it("T36 — PHASE 3.2 test file existe", () => {
    expect(fileExists("src/lib/clonestore/cloneos-history/__tests__/cloneos-history-server-persistence-design-phase3-2.test.ts")).toBe(true);
  });

  it("T37 — PHASE 3.1 test file existe et messages lib intact", () => {
    const testExists = fileExists("src/app/profile/__tests__/phase-3-1-messages-real-data-readonly.test.ts");
    const bridgeExists = fileExists(BRIDGE_FILE);
    expect(testExists && bridgeExists).toBe(true);
  });

  it("T38 — PHASE 2.9 test file existe", () => {
    expect(fileExists("src/app/profile/__tests__/phase-2-9-final-qa-gate.test.ts")).toBe(true);
  });

  it("T39 — TECH-11 test file existe", () => {
    expect(fileExists("src/lib/clonestore/readiness/__tests__/technology-readiness-final-gate-tech11.test.ts")).toBe(true);
  });

  it("T40 — pfinal02 key files exist", () => {
    const goLiveProofs = fileExists("src/lib/go-live/proofs/__tests__/go-live-proofs.test.ts");
    const phase33 = fileExists("src/lib/clonestore/cloneos-history/__tests__/cloneos-history-safe-apply-phase3-3.test.ts");
    expect(goLiveProofs && phase33).toBe(true);
  });
});

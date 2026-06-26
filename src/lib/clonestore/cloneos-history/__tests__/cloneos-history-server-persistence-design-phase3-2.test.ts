// PHASE 3.2 — CloneOS History Server Persistence Design — Tests
// Tests statiques vérifiant la couche cloneos-history et le design de persistence.
// Lecture seule. Aucune exécution. Moteur Pierre intact. Aucune migration appliquée.

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

const LIB_BASE = "src/lib/clonestore/cloneos-history";
const TYPES_FILE      = `${LIB_BASE}/cloneos-history-types.ts`;
const SCHEMA_FILE     = `${LIB_BASE}/cloneos-history-schema.ts`;
const MAPPERS_FILE    = `${LIB_BASE}/cloneos-history-mappers.ts`;
const VALIDATION_FILE = `${LIB_BASE}/cloneos-history-validation.ts`;
const STORAGE_FILE    = `${LIB_BASE}/cloneos-history-storage.ts`;
const READONLY_FILE   = `${LIB_BASE}/cloneos-history-readonly-client.ts`;
const LOCALSTORAGE_FILE = `${LIB_BASE}/cloneos-history-localstorage.ts`;
const INDEX_FILE      = `${LIB_BASE}/index.ts`;
const SQL_DRAFT       = "supabase/sql/PHASE_3_2_CLONEOS_HISTORY.sql";
const DOC_FILE        = "docs/PHASE_3_2_CLONEOS_HISTORY_SERVER_PERSISTENCE_DESIGN.md";
const AGENTS_PAGE     = "src/app/profile/agents/page.tsx";
const MESSAGES_PAGE   = "src/app/profile/messages/page.tsx";

const typesContent      = readFile(TYPES_FILE);
const schemaContent     = readFile(SCHEMA_FILE);
const mappersContent    = readFile(MAPPERS_FILE);
const validationContent = readFile(VALIDATION_FILE);
const storageContent    = readFile(STORAGE_FILE);
const readonlyContent   = readFile(READONLY_FILE);
const lsContent         = readFile(LOCALSTORAGE_FILE);
const sqlContent        = readFile(SQL_DRAFT);
const docContent        = readFile(DOC_FILE);
const docLower          = docContent.toLowerCase();
const agentsContent     = readFile(AGENTS_PAGE);
const messagesContent   = readFile(MESSAGES_PAGE);

// ── T01-T08 : Fichiers lib existent ──────────────────────────────────────────

describe("T01 — Couche cloneos-history : fichiers lib existent", () => {
  it("T01 — cloneos-history-types.ts existe", () => {
    expect(fileExists(TYPES_FILE)).toBe(true);
  });

  it("T02 — cloneos-history-schema.ts existe", () => {
    expect(fileExists(SCHEMA_FILE)).toBe(true);
  });

  it("T03 — cloneos-history-mappers.ts existe", () => {
    expect(fileExists(MAPPERS_FILE)).toBe(true);
  });

  it("T04 — cloneos-history-validation.ts existe", () => {
    expect(fileExists(VALIDATION_FILE)).toBe(true);
  });

  it("T05 — cloneos-history-storage.ts existe", () => {
    expect(fileExists(STORAGE_FILE)).toBe(true);
  });

  it("T06 — cloneos-history-readonly-client.ts existe", () => {
    expect(fileExists(READONLY_FILE)).toBe(true);
  });

  it("T07 — cloneos-history-localstorage.ts existe", () => {
    expect(fileExists(LOCALSTORAGE_FILE)).toBe(true);
  });

  it("T08 — index.ts existe", () => {
    expect(fileExists(INDEX_FILE)).toBe(true);
  });
});

// ── T09-T14 : Types et mappers ────────────────────────────────────────────────

describe("T09 — Types et mappers : contenu clé", () => {
  it("T09 — types contiennent CloneOSHistoryItem", () => {
    expect(typesContent).toContain("CloneOSHistoryItem");
  });

  it("T10 — types contiennent CloneOSHistoryPersistablePayload", () => {
    expect(typesContent).toContain("CloneOSHistoryPersistablePayload");
  });

  it("T11 — localstorage contient clé clonestore.cloneos.commandHistory.v1", () => {
    expect(lsContent).toContain("clonestore.cloneos.commandHistory.v1");
  });

  it("T12 — mapper contient mapCloneOSResultToHistoryItem", () => {
    expect(mappersContent).toContain("mapCloneOSResultToHistoryItem");
  });

  it("T13 — mapper contient mapHistoryItemToMessageCenterItem", () => {
    expect(mappersContent).toContain("mapHistoryItemToMessageCenterItem");
  });

  it("T14 — mapper contient redactCloneOSHistoryMetadata (redaction secrets)", () => {
    expect(mappersContent).toContain("redactCloneOSHistoryMetadata");
  });
});

// ── T15-T22 : Validation ──────────────────────────────────────────────────────

describe("T15 — Validation : règles de sécurité", () => {
  it("T15 — validation limite raw_request_summary (CLONEOS_HISTORY_MAX_SUMMARY_LENGTH)", () => {
    const hasLimit =
      validationContent.includes("CLONEOS_HISTORY_MAX_SUMMARY_LENGTH") ||
      validationContent.includes("raw_request_summary") && validationContent.includes("280");
    expect(hasLimit).toBe(true);
  });

  it("T16 — validation interdit sk_live_", () => {
    expect(validationContent).toContain("sk_live_");
  });

  it("T17 — validation interdit whsec_", () => {
    expect(validationContent).toContain("whsec_");
  });

  it("T18 — validation interdit OPENAI_API_KEY", () => {
    expect(validationContent.toLowerCase()).toContain("openai_api_key");
  });

  it("T19 — validation interdit ANTHROPIC_API_KEY", () => {
    expect(validationContent.toLowerCase()).toContain("anthropic_api_key");
  });

  it("T20 — validation interdit 'public launch go'", () => {
    expect(validationContent).toContain("public launch go");
  });

  it("T21 — validation interdit 'zéro erreur'", () => {
    const hasZeroErr = validationContent.includes("zéro erreur") ||
      validationContent.includes("zero erreur");
    expect(hasZeroErr).toBe(true);
  });

  it("T22 — validation interdit 'conformité garantie'", () => {
    const hasConf = validationContent.includes("conformité garantie") ||
      validationContent.includes("conformite garantie");
    expect(hasConf).toBe(true);
  });
});

// ── T23-T31 : Schema et SQL ───────────────────────────────────────────────────

describe("T23 — Schéma et SQL draft", () => {
  it("T23 — schema propose clonestore_cloneos_history", () => {
    const hasTable =
      schemaContent.includes("clonestore_cloneos_history") ||
      typesContent.includes("CLONEOS_HISTORY_TABLE_NAME");
    expect(hasTable).toBe(true);
  });

  it("T24 — schema propose user_id", () => {
    expect(schemaContent).toContain("user_id");
  });

  it("T25 — schema propose command_id", () => {
    expect(schemaContent).toContain("command_id");
  });

  it("T26 — schema propose company_id", () => {
    expect(schemaContent).toContain("company_id");
  });

  it("T27 — schema propose RLS (row level security)", () => {
    const hasRls =
      schemaContent.toLowerCase().includes("row level security") ||
      schemaContent.toLowerCase().includes("rls");
    expect(hasRls).toBe(true);
  });

  it("T28 — SQL draft existe", () => {
    expect(fileExists(SQL_DRAFT)).toBe(true);
  });

  it("T29 — SQL draft active row level security", () => {
    const hasRls =
      sqlContent.toLowerCase().includes("enable row level security");
    expect(hasRls).toBe(true);
  });

  it("T30 — SQL draft contient policy select own rows", () => {
    const hasSelectPolicy =
      sqlContent.includes("cloneos_history_select_own") ||
      (sqlContent.includes("for select") && sqlContent.includes("auth.uid()"));
    expect(hasSelectPolicy).toBe(true);
  });

  it("T31 — SQL draft ne contient pas de public launch flag", () => {
    expect(sqlContent.toLowerCase()).not.toContain("public launch go");
  });
});

// ── T32-T36 : Readonly client — pas de write ──────────────────────────────────

describe("T32 — Readonly client : aucun write", () => {
  it("T32 — readonly client ne contient pas insert(", () => {
    // Note : insert peut apparaître dans un commentaire de documentation
    // On vérifie l'absence d'un vrai appel .insert(
    expect(readonlyContent).not.toContain(".insert(");
  });

  it("T33 — readonly client ne contient pas update(", () => {
    expect(readonlyContent).not.toContain(".update(");
  });

  it("T34 — readonly client ne contient pas delete(", () => {
    expect(readonlyContent).not.toContain(".delete(");
  });

  it("T35 — readonly client ne contient pas upsert(", () => {
    expect(readonlyContent).not.toContain(".upsert(");
  });

  it("T36 — readonly client ne contient pas service_role", () => {
    expect(readonlyContent).not.toContain("service_role");
  });
});

// ── T37-T38 : UI — pas de write vers cloneOS history ─────────────────────────

describe("T37 — UI : pas de write direct vers clonestore_cloneos_history", () => {
  it("T37 — UI /profile/agents ne contient pas insert/upsert vers cloneOS history table", () => {
    const noWrite =
      !agentsContent.includes(`.from("clonestore_cloneos_history").insert`) &&
      !agentsContent.includes(`.from("clonestore_cloneos_history").upsert`) &&
      !agentsContent.includes(`.from('clonestore_cloneos_history').insert`);
    expect(noWrite).toBe(true);
  });

  it("T38 — UI /profile/messages ne contient pas insert/upsert vers cloneOS history table", () => {
    const noWrite =
      !messagesContent.includes(`.from("clonestore_cloneos_history").insert`) &&
      !messagesContent.includes(`.from("clonestore_cloneos_history").upsert`) &&
      !messagesContent.includes(`.from('clonestore_cloneos_history').insert`);
    expect(noWrite).toBe(true);
  });
});

// ── T39-T44 : Documentation ───────────────────────────────────────────────────

describe("T39 — Documentation PHASE 3.2", () => {
  it("T39 — doc PHASE_3_2 existe", () => {
    expect(fileExists(DOC_FILE)).toBe(true);
  });

  it("T40 — doc mentionne localStorage", () => {
    expect(docLower).toContain("localstorage");
  });

  it("T41 — doc mentionne server persistence design", () => {
    const hasServerPersistence =
      docLower.includes("server persistence") ||
      docLower.includes("persistence serveur");
    expect(hasServerPersistence).toBe(true);
  });

  it("T42 — doc mentionne RLS", () => {
    expect(docLower).toContain("rls");
  });

  it("T43 — doc mentionne migration non appliquée automatiquement", () => {
    const hasMigrationNote =
      docLower.includes("non appliqué") ||
      docLower.includes("non appliquée") ||
      docLower.includes("migration non appliquée") ||
      docLower.includes("not applied");
    expect(hasMigrationNote).toBe(true);
  });

  it("T44 — doc mentionne PHASE 3.3", () => {
    expect(docContent).toContain("PHASE 3.3");
  });
});

// ── T45-T48 : Phases précédentes intactes ─────────────────────────────────────

describe("T45 — Phases précédentes intactes", () => {
  it("T45 — PHASE 3.1 test file existe et messages lib intact", () => {
    const testExists = fileExists("src/app/profile/__tests__/phase-3-1-messages-real-data-readonly.test.ts");
    const libExists = fileExists("src/lib/clonestore/messages/index.ts");
    expect(testExists && libExists).toBe(true);
  });

  it("T46 — PHASE 2.9 test file existe", () => {
    expect(fileExists("src/app/profile/__tests__/phase-2-9-final-qa-gate.test.ts")).toBe(true);
  });

  it("T47 — TECH-11 test file existe", () => {
    expect(fileExists("src/lib/clonestore/readiness/__tests__/technology-readiness-final-gate-tech11.test.ts")).toBe(true);
  });

  it("T48 — pfinal02 test files clés existent", () => {
    const goLiveProofs = fileExists("src/lib/go-live/proofs/__tests__/go-live-proofs.test.ts");
    const phase31 = fileExists("src/app/profile/__tests__/phase-3-1-messages-real-data-readonly.test.ts");
    expect(goLiveProofs && phase31).toBe(true);
  });
});

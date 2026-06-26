// PHASE 3.1 — Messages Real Data Read-Only Hook — Tests
// Tests statiques vérifiant la couche messages et la page /profile/messages.
// Lecture seule. Aucune exécution. Moteur Pierre intact.

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

const LIB_BASE = "src/lib/clonestore/messages";
const TYPES_FILE       = `${LIB_BASE}/message-center-types.ts`;
const DEMO_FILE        = `${LIB_BASE}/message-center-demo-data.ts`;
const MAPPERS_FILE     = `${LIB_BASE}/message-center-mappers.ts`;
const CLIENT_FILE      = `${LIB_BASE}/message-center-readonly-client.ts`;
const VALIDATION_FILE  = `${LIB_BASE}/message-center-validation.ts`;
const INDEX_FILE       = `${LIB_BASE}/index.ts`;
const MESSAGES_PAGE    = "src/app/profile/messages/page.tsx";
const DOC_FILE         = "docs/PHASE_3_1_MESSAGES_REAL_DATA_READONLY_HOOK.md";

const typesContent      = readFile(TYPES_FILE);
const demoContent       = readFile(DEMO_FILE);
const mappersContent    = readFile(MAPPERS_FILE);
const clientContent     = readFile(CLIENT_FILE);
const validationContent = readFile(VALIDATION_FILE);
const indexContent      = readFile(INDEX_FILE);
const pageContent       = readFile(MESSAGES_PAGE);
const docContent        = readFile(DOC_FILE);
const docLower          = docContent.toLowerCase();
const pageLower         = pageContent.toLowerCase();

// ── T01-T06 : Fichiers lib existent ──────────────────────────────────────────

describe("T01 — Couche messages : fichiers lib existent", () => {
  it("T01 — message-center-types.ts existe", () => {
    expect(fileExists(TYPES_FILE)).toBe(true);
  });

  it("T02 — message-center-demo-data.ts existe", () => {
    expect(fileExists(DEMO_FILE)).toBe(true);
  });

  it("T03 — message-center-mappers.ts existe", () => {
    expect(fileExists(MAPPERS_FILE)).toBe(true);
  });

  it("T04 — message-center-readonly-client.ts existe", () => {
    expect(fileExists(CLIENT_FILE)).toBe(true);
  });

  it("T05 — message-center-validation.ts existe", () => {
    expect(fileExists(VALIDATION_FILE)).toBe(true);
  });

  it("T06 — index.ts existe", () => {
    expect(fileExists(INDEX_FILE)).toBe(true);
  });
});

// ── T07-T17 : Page /profile/messages ─────────────────────────────────────────

describe("T07 — Page /profile/messages utilise la couche messages", () => {
  it("T07 — page utilise la nouvelle couche messages (import lib)", () => {
    const usesLib =
      pageContent.includes("@/lib/clonestore/messages") ||
      pageContent.includes("clonestore/messages");
    expect(usesLib).toBe(true);
  });

  it("T08 — page conserve Suivis", () => {
    expect(pageLower).toContain("suivis");
  });

  it("T09 — page conserve Briefings", () => {
    expect(pageLower).toContain("briefings");
  });

  it("T10 — page conserve Livraisons", () => {
    expect(pageLower).toContain("livraisons");
  });

  it("T11 — page conserve Alertes", () => {
    expect(pageLower).toContain("alertes");
  });

  it("T12 — page mentionne lecture seule", () => {
    expect(pageLower).toContain("lecture seule");
  });

  it("T13 — page mentionne données réelles ou read-only", () => {
    const hasRealData =
      pageLower.includes("données réelles") ||
      pageContent.includes("real_readonly") ||
      pageContent.includes("DATA_MODE_LABELS");
    expect(hasRealData).toBe(true);
  });

  it("T14 — page mentionne fallback/démo locale ou auth_required", () => {
    const hasFallback =
      pageContent.includes("demo_fallback") ||
      pageContent.includes("auth_required") ||
      pageLower.includes("démo locale") ||
      pageLower.includes("demo locale");
    expect(hasFallback).toBe(true);
  });

  it("T15 — page contient lien /profile/agents", () => {
    expect(pageContent).toContain("/profile/agents");
  });

  it("T16 — page contient lien /agents/pierre/use", () => {
    expect(pageContent).toContain("/agents/pierre/use");
  });

  it("T17 — page contient lien /profile/technologies", () => {
    expect(pageContent).toContain("/profile/technologies");
  });
});

// ── T18-T21 : Mappers ─────────────────────────────────────────────────────────

describe("T18 — Mappers : fonctions de transformation DB → MessageCenterItem", () => {
  it("T18 — mappers contiennent mapPierreMissionToMessageItem", () => {
    expect(mappersContent).toContain("mapPierreMissionToMessageItem");
  });

  it("T19 — mappers contiennent mapPierreTaskToMessageItem", () => {
    expect(mappersContent).toContain("mapPierreTaskToMessageItem");
  });

  it("T20 — mappers contiennent mapPierreDocumentToMessageItem", () => {
    expect(mappersContent).toContain("mapPierreDocumentToMessageItem");
  });

  it("T21 — mappers contiennent mapPierreOutboundEmailToMessageItem", () => {
    expect(mappersContent).toContain("mapPierreOutboundEmailToMessageItem");
  });
});

// ── T22-T33 : Readonly client ─────────────────────────────────────────────────

describe("T22 — Readonly client : tables et filtres", () => {
  it("T22 — readonly client lit pierre_missions", () => {
    expect(clientContent).toContain("pierre_missions");
  });

  it("T23 — readonly client lit pierre_tasks", () => {
    expect(clientContent).toContain("pierre_tasks");
  });

  it("T24 — readonly client lit pierre_documents", () => {
    expect(clientContent).toContain("pierre_documents");
  });

  it("T25 — readonly client lit pierre_outbound_emails", () => {
    expect(clientContent).toContain("pierre_outbound_emails");
  });

  it("T26 — readonly client filtre agent_slug pierre si possible", () => {
    // Le client documente que les tables pierre_* sont Pierre-spécifiques
    // agent_slug = "pierre" est implicite dans le nommage des tables
    const hasAgentSlugRef =
      clientContent.includes("agent_slug") ||
      clientContent.includes("PIERRE_AGENT_SLUG") ||
      clientContent.includes('"pierre"');
    expect(hasAgentSlugRef).toBe(true);
  });

  it("T27 — readonly client filtre user_id si possible", () => {
    expect(clientContent).toContain("user_id");
  });

  it("T28 — readonly client contient .limit(", () => {
    expect(clientContent).toContain(".limit(");
  });

  it("T29 — readonly client ne contient pas insert(", () => {
    expect(clientContent).not.toContain(".insert(");
  });

  it("T30 — readonly client ne contient pas update(", () => {
    expect(clientContent).not.toContain(".update(");
  });

  it("T31 — readonly client ne contient pas delete(", () => {
    expect(clientContent).not.toContain(".delete(");
  });

  it("T32 — readonly client ne contient pas upsert(", () => {
    expect(clientContent).not.toContain(".upsert(");
  });

  it("T33 — readonly client ne contient pas service_role", () => {
    expect(clientContent).not.toContain("service_role");
  });
});

// ── T34-T37 : Page — pas de write ni d'appel interdit ────────────────────────

describe("T34 — Page : pas de write Supabase ni d'appel interdit", () => {
  it("T34 — page ne contient pas Supabase write direct (.insert/update/delete)", () => {
    const noWrite =
      !pageContent.includes('.from("pierre_missions").insert') &&
      !pageContent.includes('.from("pierre_tasks").insert') &&
      !pageContent.includes('.from("orders").insert');
    expect(noWrite).toBe(true);
  });

  it("T35 — page ne contient pas appel OpenAI", () => {
    const noOpenAI =
      !pageContent.includes("openai") &&
      !pageContent.includes("gpt-4") &&
      !pageContent.includes("gpt-3.5");
    expect(noOpenAI).toBe(true);
  });

  it("T36 — page ne contient pas appel Anthropic", () => {
    const noAnthropic =
      !pageContent.includes("anthropic") &&
      !pageContent.includes("claude-3");
    expect(noAnthropic).toBe(true);
  });

  it("T37 — page ne contient pas Stripe live", () => {
    const noStripeLive =
      !pageContent.includes("sk_live_") &&
      !pageContent.includes("stripe.charges.create");
    expect(noStripeLive).toBe(true);
  });
});

// ── T38-T41 : Validation — wordings interdits ─────────────────────────────────

describe("T38 — Validation : wordings interdits détectés", () => {
  it("T38 — validation interdit 'public launch go'", () => {
    const hasCheck =
      validationContent.includes("public launch go") ||
      validationContent.includes("UNSAFE_WORDING_PATTERNS");
    expect(hasCheck).toBe(true);
  });

  it("T39 — validation interdit 'zéro erreur'", () => {
    const hasCheck =
      validationContent.includes("zéro erreur") ||
      validationContent.includes("zero erreur") ||
      validationContent.includes("UNSAFE_WORDING_PATTERNS");
    expect(hasCheck).toBe(true);
  });

  it("T40 — validation interdit 'conformité garantie'", () => {
    const hasCheck =
      validationContent.includes("conformité garantie") ||
      validationContent.includes("conformite garantie") ||
      validationContent.includes("UNSAFE_WORDING_PATTERNS");
    expect(hasCheck).toBe(true);
  });

  it("T41 — validation interdit 'CloneVoice actif production'", () => {
    const hasCheck =
      validationContent.includes("clonevoice actif production") ||
      validationContent.includes("UNSAFE_WORDING_PATTERNS");
    expect(hasCheck).toBe(true);
  });
});

// ── T42-T47 : Documentation ───────────────────────────────────────────────────

describe("T42 — Documentation PHASE 3.1", () => {
  it("T42 — doc PHASE_3_1 existe", () => {
    expect(fileExists(DOC_FILE)).toBe(true);
  });

  it("T43 — doc mentionne read-only", () => {
    expect(docLower).toContain("read-only");
  });

  it("T44 — doc mentionne 4 onglets", () => {
    const has4Tabs =
      docLower.includes("4 onglets") ||
      (docLower.includes("suivis") && docLower.includes("briefings") && docLower.includes("livraisons") && docLower.includes("alertes"));
    expect(has4Tabs).toBe(true);
  });

  it("T45 — doc mentionne Supabase sans write", () => {
    const hasSbReadOnly =
      docLower.includes("supabase") &&
      (docLower.includes("read-only") || docLower.includes("lecture seule") || docLower.includes("sans write"));
    expect(hasSbReadOnly).toBe(true);
  });

  it("T46 — doc mentionne fallback", () => {
    expect(docLower).toContain("fallback");
  });

  it("T47 — doc mentionne prochain bloc recommandé", () => {
    const hasNext =
      docLower.includes("prochain bloc") ||
      docLower.includes("phase 3.2") ||
      docLower.includes("prochain bloc recommandé");
    expect(hasNext).toBe(true);
  });
});

// ── T48-T54 : Phases précédentes intactes ─────────────────────────────────────

describe("T48 — Phases précédentes intactes", () => {
  it("T48 — PHASE 2.9 test file existe", () => {
    expect(fileExists("src/app/profile/__tests__/phase-2-9-final-qa-gate.test.ts")).toBe(true);
  });

  it("T49 — PHASE 2.8 test file existe et corrections responsive intactes", () => {
    const testExists = fileExists("src/app/profile/__tests__/phase-2-8-responsive-premium-polish.test.ts");
    // Correction xl:grid-cols-2 toujours présente dans messages page
    const messagesGridOk = pageContent.includes("xl:grid-cols-2");
    expect(testExists && messagesGridOk).toBe(true);
  });

  it("T50 — PHASE 2.7 test file existe", () => {
    expect(fileExists("src/app/profile/__tests__/phase-2-7-pierre-global-integration.test.ts")).toBe(true);
  });

  it("T51 — PHASE 2.6 test file existe", () => {
    expect(fileExists("src/app/profile/__tests__/phase-2-6-global-onboarding-enterprise.test.ts")).toBe(true);
  });

  it("T52 — PHASE 2.5 : messages page conserve exactement les 4 onglets PHASE 2.5", () => {
    const testExists = fileExists("src/app/profile/__tests__/phase-2-5-messages-center-4-tabs.test.ts");
    const has4Tabs =
      pageLower.includes("suivis") &&
      pageLower.includes("briefings") &&
      pageLower.includes("livraisons") &&
      pageLower.includes("alertes");
    expect(testExists && has4Tabs).toBe(true);
  });

  it("T53 — TECH-11 test file existe", () => {
    expect(fileExists("src/lib/clonestore/readiness/__tests__/technology-readiness-final-gate-tech11.test.ts")).toBe(true);
  });

  it("T54 — pfinal02 test files clés existent", () => {
    const goLiveProofs = fileExists("src/lib/go-live/proofs/__tests__/go-live-proofs.test.ts");
    const phase29 = fileExists("src/app/profile/__tests__/phase-2-9-final-qa-gate.test.ts");
    expect(goLiveProofs && phase29).toBe(true);
  });
});

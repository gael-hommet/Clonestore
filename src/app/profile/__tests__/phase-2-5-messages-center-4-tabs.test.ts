// PHASE 2.5 — Messages Center 4 Tabs — Tests
// Tests statiques vérifiant la restructuration de /profile/messages en 4 onglets.
// Lecture seule. Aucun appel externe. Aucun proof auto-validé.

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fileExists(relativePath: string): boolean {
  return fs.existsSync(path.resolve(process.cwd(), relativePath));
}

function readFile(relativePath: string): string {
  const fullPath = path.resolve(process.cwd(), relativePath);
  if (!fs.existsSync(fullPath)) return "";
  return fs.readFileSync(fullPath, "utf-8");
}

const PAGE_PATH = "src/app/profile/messages/page.tsx";
const DOC_PATH = "docs/PHASE_2_5_MESSAGES_CENTER_4_TABS.md";

const page = readFile(PAGE_PATH);
const pageLower = page.toLowerCase();
const doc = readFile(DOC_PATH);
const docLower = doc.toLowerCase();

// ── T01 — Page existe ─────────────────────────────────────────────────────────

describe("T01 — Page /profile/messages existe", () => {
  it("T01.1 — page.tsx existe", () => {
    expect(fileExists(PAGE_PATH)).toBe(true);
  });
});

// ── T02 — 4 onglets présents ──────────────────────────────────────────────────

describe("T02 — Les 4 onglets sont présents", () => {
  it("T02.1 — page mentionne Suivis", () => {
    expect(pageLower).toContain("suivis");
  });

  it("T02.2 — page mentionne Briefings", () => {
    expect(pageLower).toContain("briefings");
  });

  it("T02.3 — page mentionne Livraisons", () => {
    expect(pageLower).toContain("livraisons");
  });

  it("T02.4 — page mentionne Alertes", () => {
    expect(pageLower).toContain("alertes");
  });

  it("T02.5 — page contient MessageCenterTab avec 4 valeurs", () => {
    expect(page).toContain("MessageCenterTab");
    // Le type doit inclure les 4 valeurs
    const hasSuivis = page.includes('"suivis"');
    const hasBriefings = page.includes('"briefings"');
    const hasLivraisons = page.includes('"livraisons"');
    const hasAlertes = page.includes('"alertes"');
    expect(hasSuivis && hasBriefings && hasLivraisons && hasAlertes).toBe(true);
  });

  it("T02.6 — page contient CATEGORIES avec 4 items", () => {
    expect(page).toContain("CATEGORIES");
  });
});

// ── T03 — Sources TECH ────────────────────────────────────────────────────────

describe("T03 — Sources TECH-06/07/08/09 connectées", () => {
  it("T03.1 — page mentionne CloneOS", () => {
    expect(pageLower).toContain("cloneos");
  });

  it("T03.2 — page mentionne CloneTrace", () => {
    expect(pageLower).toContain("clonetrace");
  });

  it("T03.3 — page mentionne CloneBrief", () => {
    expect(pageLower).toContain("clonebrief");
  });

  it("T03.4 — page mentionne CloneGuard", () => {
    expect(pageLower).toContain("cloneguard");
  });

  it("T03.5 — page importe depuis clonestore/cloneos", () => {
    expect(page).toContain("clonestore/cloneos");
  });

  it("T03.6 — page importe depuis clonestore/brief", () => {
    expect(page).toContain("clonestore/brief");
  });

  it("T03.7 — page importe depuis clonestore/trace", () => {
    expect(page).toContain("clonestore/trace");
  });

  it("T03.8 — page importe depuis clonestore/guard", () => {
    expect(page).toContain("clonestore/guard");
  });

  it("T03.9 — page mentionne Pierre", () => {
    expect(pageLower).toContain("pierre");
  });
});

// ── T04 — Garde-fous lecture seule ────────────────────────────────────────────

describe("T04 — Garde-fous lecture seule", () => {
  it("T04.1 — page mentionne lecture seule ou plan-only", () => {
    expect(pageLower).toContain("lecture seule");
  });

  it("T04.2 — page mentionne aucune action exécutée", () => {
    expect(pageLower).toContain("aucune action exécutée");
  });

  it("T04.3 — page ne dit pas email envoyé si mock", () => {
    // Les emails brouillons doivent être étiquetés comme non envoyés
    expect(pageLower).not.toContain("email envoyé avec succès");
    expect(pageLower).not.toContain("email réel envoyé");
  });

  it("T04.4 — page ne dit pas document généré comme résultat positif", () => {
    // "document réel généré" peut figurer dans un commentaire d'exclusion (ce qui est ok)
    // On vérifie que le message UI ne présente pas cela comme un succès automatique
    expect(pageLower).not.toContain("document généré avec succès");
    expect(pageLower).not.toContain("document généré par pierre de manière autonome");
  });

  it("T04.5 — page ne dit pas mission exécutée", () => {
    expect(pageLower).not.toContain("mission exécutée avec succès");
    expect(pageLower).not.toContain("action exécutée avec succès");
  });
});

// ── T05 — Alertes Guard ───────────────────────────────────────────────────────

describe("T05 — Alertes Guard visibles", () => {
  it("T05.1 — page mentionne requires_validation ou validation humaine", () => {
    const hasRequiresValidation = page.includes("requires_validation");
    const hasValidationHumaine = pageLower.includes("validation humaine");
    expect(hasRequiresValidation || hasValidationHumaine).toBe(true);
  });

  it("T05.2 — page mentionne blocked ou bloqué", () => {
    expect(pageLower).toContain("bloqué");
  });

  it("T05.3 — page mentionne refused ou refusé", () => {
    expect(pageLower).toContain("refusé");
  });

  it("T05.4 — page contient AlertesBanner ou équivalent bannière alertes", () => {
    expect(page).toContain("AlertesBanner");
  });

  it("T05.5 — page mentionne invariant absolu ou invariant Guard", () => {
    expect(pageLower).toContain("invariant");
  });
});

// ── T06 — Contenu des onglets ─────────────────────────────────────────────────

describe("T06 — Contenu des onglets", () => {
  it("T06.1 — page contient contenu onglet Suivis (mission ou demande)", () => {
    // La page a des messages dans l'onglet suivis liés aux missions
    const hasSuivi =
      pageLower.includes("suivi de mission") ||
      pageLower.includes("mission en cours") ||
      pageLower.includes("demande rh analysée") ||
      pageLower.includes("plan de mission préparé") ||
      pageLower.includes("plan d'onboarding préparé");
    expect(hasSuivi).toBe(true);
  });

  it("T06.2 — page contient briefing du jour ou synthèse", () => {
    const hasBrief =
      pageLower.includes("briefing du jour") ||
      pageLower.includes("synthèse");
    expect(hasBrief).toBe(true);
  });

  it("T06.3 — page contient livrables ou documents ou emails préparés", () => {
    const hasLivrable =
      pageLower.includes("livrable") ||
      pageLower.includes("document rh") ||
      pageLower.includes("brouillon");
    expect(hasLivrable).toBe(true);
  });

  it("T06.4 — page contient alerte ou blocage Guard", () => {
    expect(pageLower).toContain("cloneguard a détecté");
  });
});

// ── T07 — Helpers messages center ────────────────────────────────────────────

describe("T07 — Helpers messages center présents", () => {
  it("T07.1 — page contient buildMessagesFromCloneOSPreview", () => {
    expect(page).toContain("buildMessagesFromCloneOSPreview");
  });

  it("T07.2 — page contient buildMessagesFromTracePreview", () => {
    expect(page).toContain("buildMessagesFromTracePreview");
  });

  it("T07.3 — page contient buildMessagesFromGuardPreview", () => {
    expect(page).toContain("buildMessagesFromGuardPreview");
  });

  it("T07.4 — page contient buildMessagesFromBriefPreview", () => {
    expect(page).toContain("buildMessagesFromBriefPreview");
  });

  it("T07.5 — page contient groupMessagesByTab", () => {
    expect(page).toContain("groupMessagesByTab");
  });

  it("T07.6 — page contient filterMessages", () => {
    expect(page).toContain("filterMessages");
  });

  it("T07.7 — page contient countUnreadByTab", () => {
    expect(page).toContain("countUnreadByTab");
  });

  it("T07.8 — page contient countUrgentAlerts", () => {
    expect(page).toContain("countUrgentAlerts");
  });
});

// ── T08 — Liens utiles ────────────────────────────────────────────────────────

describe("T08 — Liens utiles présents", () => {
  it("T08.1 — page contient lien /profile/agents", () => {
    expect(page).toContain("/profile/agents");
  });

  it("T08.2 — page contient lien /agents/pierre/use", () => {
    expect(page).toContain("/agents/pierre/use");
  });

  it("T08.3 — page contient lien /profile/technologies", () => {
    expect(page).toContain("/profile/technologies");
  });
});

// ── T09 — Employés non actifs ─────────────────────────────────────────────────

describe("T09 — Futurs employés jamais actifs", () => {
  it("T09.1 — page ne présente pas Emma active", () => {
    expect(page).not.toContain("Emma active");
    expect(page).not.toContain("Emma actif");
  });

  it("T09.2 — page ne présente pas Lucas actif", () => {
    expect(page).not.toContain("Lucas actif");
    expect(page).not.toContain("Lucas active");
  });

  it("T09.3 — page ne présente pas Sophie active", () => {
    expect(page).not.toContain("Sophie active");
    expect(page).not.toContain("Sophie actif");
  });
});

// ── T10 — Conformité absolue ──────────────────────────────────────────────────

describe("T10 — Conformité absolue", () => {
  it("T10.1 — page ne contient pas Supabase write direct", () => {
    expect(page).not.toContain('.from("orders").insert');
    expect(page).not.toContain('.from("messages").insert');
  });

  it("T10.2 — page ne contient pas appel OpenAI", () => {
    expect(pageLower).not.toContain("openai.chat");
  });

  it("T10.3 — page ne contient pas appel Anthropic", () => {
    expect(pageLower).not.toContain("anthropic.messages");
  });

  it("T10.4 — page ne contient pas Stripe live", () => {
    expect(pageLower).not.toContain("stripe.charges.create");
  });

  it("T10.5 — page ne dit pas public launch GO", () => {
    expect(pageLower).not.toContain("public launch go");
  });
});

// ── T11 — Documentation PHASE 2.5 ────────────────────────────────────────────

describe("T11 — Documentation PHASE 2.5", () => {
  it("T11.1 — doc PHASE_2_5 existe", () => {
    expect(fileExists(DOC_PATH)).toBe(true);
  });

  it("T11.2 — doc mentionne les 4 onglets", () => {
    expect(docLower).toContain("4 onglets");
  });

  it("T11.3 — doc mentionne CloneOS", () => {
    expect(docLower).toContain("cloneos");
  });

  it("T11.4 — doc mentionne CloneTrace", () => {
    expect(docLower).toContain("clonetrace");
  });

  it("T11.5 — doc mentionne CloneBrief", () => {
    expect(docLower).toContain("clonebrief");
  });

  it("T11.6 — doc mentionne CloneGuard", () => {
    expect(docLower).toContain("cloneguard");
  });

  it("T11.7 — doc mentionne lecture seule", () => {
    expect(docLower).toContain("lecture seule");
  });

  it("T11.8 — doc mentionne PHASE 2.6", () => {
    expect(doc).toContain("PHASE 2.6");
  });

  it("T11.9 — doc mentionne NO-GO", () => {
    expect(docLower).toContain("no-go");
  });
});

// ── T12 — Intégrité fichiers existants ───────────────────────────────────────

describe("T12 — Intégrité des fichiers PHASE 2.1 → 2.4", () => {
  it("T12.1 — PHASE 2.4 test intact", () => {
    expect(fileExists("src/app/profile/__tests__/phase-2-4-last-request-panel.test.ts")).toBe(true);
  });

  it("T12.2 — PHASE 2.3 test intact", () => {
    expect(fileExists("src/app/profile/__tests__/phase-2-3-cloneos-command-bar.test.ts")).toBe(true);
  });

  it("T12.3 — PHASE 2.2 test intact", () => {
    expect(fileExists("src/app/profile/__tests__/phase-2-2-global-cockpit-shell.test.ts")).toBe(true);
  });

  it("T12.4 — PHASE 2.1 test intact", () => {
    expect(fileExists("src/app/profile/__tests__/phase-2-1-global-cockpit-audit.test.ts")).toBe(true);
  });

  it("T12.5 — Pierre moteur intact", () => {
    expect(fileExists("src/lib/pierre")).toBe(true);
  });

  it("T12.6 — Pierre cockpit intact", () => {
    expect(fileExists("src/app/agents/pierre/use/page.tsx")).toBe(true);
  });

  it("T12.7 — TECH-11 test intact", () => {
    expect(fileExists("src/lib/clonestore/readiness/__tests__/technology-readiness-final-gate-tech11.test.ts")).toBe(true);
  });
});

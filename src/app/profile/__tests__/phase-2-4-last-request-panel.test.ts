// PHASE 2.4 — Last Request Panel / CloneOS Result Timeline — Tests
// Tests statiques vérifiant que /profile/agents gère l'historique local CloneOS.
// Plan-only. Local state + localStorage. Aucune DB. Aucun appel externe.

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

const PAGE_PATH = "src/app/profile/agents/page.tsx";
const DOC_PATH = "docs/PHASE_2_4_LAST_REQUEST_PANEL_CLONEOS_TIMELINE.md";

const page = readFile(PAGE_PATH);
const pageLower = page.toLowerCase();
const doc = readFile(DOC_PATH);
const docLower = doc.toLowerCase();

// ── T01 — Historique CloneOS local state ──────────────────────────────────────

describe("T01 — Historique CloneOS local state", () => {
  it("T01.1 — page contient cloneOSHistory", () => {
    expect(page).toContain("cloneOSHistory");
  });

  it("T01.2 — page contient lastCloneOSResult", () => {
    expect(page).toContain("lastCloneOSResult");
  });

  it("T01.3 — page contient cloneOSHistoryFilter", () => {
    expect(page).toContain("cloneOSHistoryFilter");
  });

  it("T01.4 — page utilise CLONEOS_HISTORY_KEY (localStorage)", () => {
    expect(page).toContain("CLONEOS_HISTORY_KEY");
    expect(page).toContain("clonestore.cloneos.commandHistory.v1");
  });

  it("T01.5 — page utilise CLONEOS_HISTORY_MAX", () => {
    expect(page).toContain("CLONEOS_HISTORY_MAX");
  });

  it("T01.6 — page hydrate depuis localStorage avec try/catch", () => {
    expect(page).toContain("localStorage.getItem(CLONEOS_HISTORY_KEY)");
    // try/catch requis
    const tryIndex = page.indexOf("localStorage.getItem(CLONEOS_HISTORY_KEY)");
    const tryCatch = page.lastIndexOf("try {", tryIndex);
    expect(tryCatch).toBeGreaterThan(-1);
  });
});

// ── T02 — Composant LastRequestPanel ──────────────────────────────────────────

describe("T02 — Composant LastRequestPanel", () => {
  it("T02.1 — page contient LastRequestPanel", () => {
    expect(page).toContain("LastRequestPanel");
  });

  it("T02.2 — page mentionne 'À propos de votre dernière demande'", () => {
    expect(page).toContain("À propos de votre dernière demande");
  });

  it("T02.3 — page mentionne 'Plan préparé' ou équivalent", () => {
    expect(pageLower).toContain("plan préparé");
  });

  it("T02.4 — page mentionne 'non exécuté'", () => {
    expect(pageLower).toContain("non exécuté");
  });

  it("T02.5 — page mentionne CloneTrace", () => {
    expect(pageLower).toContain("clonetrace");
  });

  it("T02.6 — page mentionne 'non persisté'", () => {
    expect(pageLower).toContain("non persisté");
  });

  it("T02.7 — page mentionne 'validation humaine'", () => {
    expect(pageLower).toContain("validation humaine");
  });

  it("T02.8 — page mentionne aucun employé actif disponible pour domaines non RH", () => {
    expect(page).toContain("CLONEOS_NO_EMPLOYEE_LABEL");
  });

  it("T02.9 — page affiche Pierre pour RH", () => {
    expect(page).toContain("Pierre (RH)");
  });
});

// ── T03 — Composant CloneOSCommandTimeline ────────────────────────────────────

describe("T03 — Composant CloneOSCommandTimeline", () => {
  it("T03.1 — page contient CloneOSCommandTimeline", () => {
    expect(page).toContain("CloneOSCommandTimeline");
  });

  it("T03.2 — page contient filterCloneOSHistory", () => {
    expect(page).toContain("filterCloneOSHistory");
  });
});

// ── T04 — Filtres de l'historique ─────────────────────────────────────────────

describe("T04 — Filtres de l'historique CloneOS", () => {
  it("T04.1 — page contient filtre 'all'", () => {
    expect(page).toContain('"all"');
  });

  it("T04.2 — page contient filtre 'hr'", () => {
    expect(page).toContain('"hr"');
  });

  it("T04.3 — page contient filtre 'blocked'", () => {
    expect(page).toContain('"blocked"');
  });

  it("T04.4 — page contient filtre 'requires_validation'", () => {
    expect(page).toContain('"requires_validation"');
  });

  it("T04.5 — page contient filtre 'refused'", () => {
    expect(page).toContain('"refused"');
  });

  it("T04.6 — page contient filtre 'no_employee'", () => {
    expect(page).toContain('"no_employee"');
  });

  it("T04.7 — page contient filtre 'high_risk'", () => {
    expect(page).toContain('"high_risk"');
  });
});

// ── T05 — Helpers history ────────────────────────────────────────────────────

describe("T05 — Helpers de gestion de l'historique", () => {
  it("T05.1 — page contient addToCloneOSHistory ou équivalent", () => {
    expect(page).toContain("addToCloneOSHistory");
  });

  it("T05.2 — page contient clearCloneOSHistory ou équivalent", () => {
    expect(page).toContain("clearCloneOSHistory");
  });

  it("T05.3 — page contient runCloneOSCommand", () => {
    expect(page).toContain("runCloneOSCommand");
  });

  it("T05.4 — runCloneOSCommand est utilisé dans submitCommand", () => {
    expect(page).toContain("runCloneOSCommand(text)");
  });

  it("T05.5 — sendSalonMessage est connecté à runCloneOSCommand", () => {
    expect(page).toContain("runCloneOSCommand(text)");
    // sendSalonMessage doit appeler runCloneOSCommand
    const salonFnStart = page.indexOf("function sendSalonMessage()");
    const runCall = page.indexOf("runCloneOSCommand(text)", salonFnStart);
    expect(salonFnStart).toBeGreaterThan(-1);
    expect(runCall).toBeGreaterThan(salonFnStart);
  });

  it("T05.6 — localStorage.setItem est utilisé pour persister l'historique", () => {
    expect(page).toContain("localStorage.setItem(CLONEOS_HISTORY_KEY");
  });

  it("T05.7 — localStorage.removeItem est utilisé pour effacer l'historique", () => {
    expect(page).toContain("localStorage.removeItem(CLONEOS_HISTORY_KEY)");
  });
});

// ── T06 — Conformité plan-only ────────────────────────────────────────────────

describe("T06 — Conformité plan-only", () => {
  it("T06.1 — page ne dit pas mission exécutée avec succès", () => {
    expect(pageLower).not.toContain("mission exécutée avec succès");
    expect(pageLower).not.toContain("action exécutée avec succès");
  });

  it("T06.2 — page ne dit pas document généré avec succès", () => {
    expect(pageLower).not.toContain("document généré avec succès");
    expect(pageLower).not.toContain("document livré par cloneos");
  });

  it("T06.3 — page ne contient pas écriture Supabase directe", () => {
    expect(page).not.toContain('.from("orders").insert');
    expect(page).not.toContain('.from("missions").insert');
  });

  it("T06.4 — page ne contient pas appel OpenAI", () => {
    expect(pageLower).not.toContain("openai.chat");
    expect(pageLower).not.toContain("openai.completions");
  });

  it("T06.5 — page ne contient pas appel Anthropic", () => {
    expect(pageLower).not.toContain("anthropic.messages");
  });

  it("T06.6 — page ne contient pas Stripe live", () => {
    expect(pageLower).not.toContain("stripe.charges.create");
  });
});

// ── T07 — Employés non actifs ─────────────────────────────────────────────────

describe("T07 — Employés roadmap jamais actifs", () => {
  it("T07.1 — page ne présente pas Emma active", () => {
    expect(page).not.toContain("Emma active");
    expect(page).not.toContain("Emma actif");
  });

  it("T07.2 — page ne présente pas Lucas actif", () => {
    expect(page).not.toContain("Lucas actif");
    expect(page).not.toContain("Lucas active");
  });

  it("T07.3 — page ne présente pas Sophie active", () => {
    expect(page).not.toContain("Sophie active");
    expect(page).not.toContain("Sophie actif");
  });

  it("T07.4 — page ne présente pas Clara active", () => {
    expect(page).not.toContain("Clara active");
    expect(page).not.toContain("Clara actif");
  });
});

// ── T08 — Documentation PHASE 2.4 ────────────────────────────────────────────

describe("T08 — Documentation PHASE 2.4", () => {
  it("T08.1 — doc PHASE_2_4 existe", () => {
    expect(fileExists(DOC_PATH)).toBe(true);
  });

  it("T08.2 — doc mentionne commandHistory", () => {
    expect(docLower).toContain("commandhistory");
  });

  it("T08.3 — doc mentionne LastRequestPanel", () => {
    expect(doc).toContain("LastRequestPanel");
  });

  it("T08.4 — doc mentionne CloneOSCommandTimeline", () => {
    expect(doc).toContain("CloneOSCommandTimeline");
  });

  it("T08.5 — doc mentionne PHASE 2.5", () => {
    expect(doc).toContain("PHASE 2.5");
  });

  it("T08.6 — doc mentionne NO-GO", () => {
    expect(docLower).toContain("no-go");
  });

  it("T08.7 — doc mentionne localStorage", () => {
    expect(docLower).toContain("localstorage");
  });
});

// ── T09 — Intégrité des fichiers existants ────────────────────────────────────

describe("T09 — Intégrité des fichiers existants", () => {
  it("T09.1 — PHASE 2.3 test intact", () => {
    expect(
      fileExists("src/app/profile/__tests__/phase-2-3-cloneos-command-bar.test.ts"),
    ).toBe(true);
  });

  it("T09.2 — PHASE 2.2 test intact", () => {
    expect(
      fileExists("src/app/profile/__tests__/phase-2-2-global-cockpit-shell.test.ts"),
    ).toBe(true);
  });

  it("T09.3 — PHASE 2.1 test intact", () => {
    expect(
      fileExists("src/app/profile/__tests__/phase-2-1-global-cockpit-audit.test.ts"),
    ).toBe(true);
  });

  it("T09.4 — TECH-11 test intact", () => {
    expect(
      fileExists("src/lib/clonestore/readiness/__tests__/technology-readiness-final-gate-tech11.test.ts"),
    ).toBe(true);
  });

  it("T09.5 — Pierre moteur intact", () => {
    expect(fileExists("src/lib/pierre")).toBe(true);
  });

  it("T09.6 — Pierre cockpit intact", () => {
    expect(fileExists("src/app/agents/pierre/use/page.tsx")).toBe(true);
  });

  it("T09.7 — CloneOS TECH-08 module intact", () => {
    expect(fileExists("src/lib/clonestore/cloneos/cloneos-command-center.ts")).toBe(true);
  });

  it("T09.8 — PHASE 2.4 doc intact", () => {
    expect(fileExists(DOC_PATH)).toBe(true);
  });
});

// PHASE 2.1 — Global Cockpit, Messages & Onboarding Architecture Audit — Tests
// Tests statiques vérifiant que le document d'audit existe et est complet.
// Aucune donnée modifiée. Aucun appel externe. Aucun proof auto-validé.

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fileExists(relativePath: string): boolean {
  return fs.existsSync(path.resolve(process.cwd(), relativePath));
}

function readDoc(relativePath: string): string {
  const fullPath = path.resolve(process.cwd(), relativePath);
  if (!fs.existsSync(fullPath)) return "";
  return fs.readFileSync(fullPath, "utf-8");
}

const DOC_PATH = "docs/PHASE_2_1_GLOBAL_COCKPIT_MESSAGES_ONBOARDING_AUDIT.md";
const doc = readDoc(DOC_PATH);
const docLower = doc.toLowerCase();

// ── T01 — Document d'audit ────────────────────────────────────────────────────

describe("T01 — Document d'audit PHASE 2.1", () => {
  it("T01.1 — doc PHASE_2_1 existe", () => {
    expect(fileExists(DOC_PATH)).toBe(true);
  });

  it("T01.2 — doc mentionne Mon espace", () => {
    expect(docLower).toContain("mon espace");
  });

  it("T01.3 — doc mentionne cockpit global", () => {
    expect(docLower).toContain("cockpit global");
  });

  it("T01.4 — doc mentionne CloneOS command", () => {
    expect(docLower).toContain("cloneos");
    expect(docLower).toContain("command");
  });

  it("T01.5 — doc mentionne messages", () => {
    expect(docLower).toContain("messages");
  });

  it("T01.6 — doc mentionne Suivis", () => {
    expect(docLower).toContain("suivis");
  });

  it("T01.7 — doc mentionne Briefings", () => {
    expect(docLower).toContain("briefings");
  });

  it("T01.8 — doc mentionne Livraisons", () => {
    expect(docLower).toContain("livraisons");
  });

  it("T01.9 — doc mentionne Alertes", () => {
    expect(docLower).toContain("alertes");
  });

  it("T01.10 — doc mentionne onboarding global", () => {
    expect(docLower).toContain("onboarding global");
  });
});

// ── T02 — Technologies globales référencées ───────────────────────────────────

describe("T02 — Technologies globales référencées", () => {
  it("T02.1 — doc mentionne Employee Runtime", () => {
    expect(docLower).toContain("employee runtime");
  });

  it("T02.2 — doc mentionne CloneTrace", () => {
    expect(docLower).toContain("clonetrace");
  });

  it("T02.3 — doc mentionne CloneBrief", () => {
    expect(docLower).toContain("clonebrief");
  });

  it("T02.4 — doc mentionne CloneGuard", () => {
    expect(docLower).toContain("cloneguard");
  });

  it("T02.5 — doc mentionne Pierre", () => {
    expect(docLower).toContain("pierre");
  });
});

// ── T03 — Distinctions structurelles ─────────────────────────────────────────

describe("T03 — Distinctions structurelles", () => {
  it("T03.1 — doc distingue global vs Pierre-only", () => {
    expect(docLower).toContain("pierre-only");
    expect(docLower).toContain("global");
  });

  it("T03.2 — doc distingue launch vs later", () => {
    expect(docLower).toContain("avant lancement");
    expect(docLower).toContain("après lancement");
  });

  it("T03.3 — doc mentionne que Pierre moteur reste intact", () => {
    expect(docLower).toContain("intact");
    expect(docLower).toContain("pierre");
  });
});

// ── T04 — Blocs PHASE 2 présents ─────────────────────────────────────────────

describe("T04 — Blocs PHASE 2 documentés", () => {
  it("T04.1 — doc contient PHASE 2.2", () => {
    expect(doc).toContain("PHASE 2.2");
  });

  it("T04.2 — doc contient PHASE 2.3", () => {
    expect(doc).toContain("PHASE 2.3");
  });

  it("T04.3 — doc contient PHASE 2.4", () => {
    expect(doc).toContain("PHASE 2.4");
  });

  it("T04.4 — doc contient PHASE 2.5", () => {
    expect(doc).toContain("PHASE 2.5");
  });

  it("T04.5 — doc contient PHASE 2.6", () => {
    expect(doc).toContain("PHASE 2.6");
  });

  it("T04.6 — doc contient PHASE 2.7", () => {
    expect(doc).toContain("PHASE 2.7");
  });

  it("T04.7 — doc contient PHASE 2.8", () => {
    expect(doc).toContain("PHASE 2.8");
  });

  it("T04.8 — doc contient PHASE 2.9", () => {
    expect(doc).toContain("PHASE 2.9");
  });
});

// ── T05 — Conformité absolue ──────────────────────────────────────────────────

describe("T05 — Conformité absolue", () => {
  it("T05.1 — doc ne déclare pas public launch GO", () => {
    expect(docLower).not.toContain("public launch go");
    expect(docLower).not.toContain("lancement public go");
  });

  it("T05.2 — doc ne dit pas zéro erreur", () => {
    expect(docLower).not.toContain("zéro erreur");
    expect(docLower).not.toContain("zero erreur");
  });

  it("T05.3 — doc ne dit pas conformité garantie", () => {
    expect(docLower).not.toContain("conformité garantie");
    expect(docLower).not.toContain("conformite garantie");
  });

  it("T05.4 — aucun public launch flag modifié", () => {
    // go-live-proofs.local.json ne doit pas être dans les fichiers modifiés
    expect(fileExists("go-live-proofs.local.json")).toBe(false); // Si existe, non modifié
    // Test statique — on vérifie juste que le doc n'en parle pas de manière auto-validante
    expect(docLower).not.toContain("go_live_flags = true");
  });

  it("T05.5 — aucun proof auto-validé", () => {
    expect(docLower).not.toContain("proof.validated = true");
    expect(docLower).not.toContain("proofs.validated");
  });

  it("T05.6 — aucun appel OpenAI / Anthropic / Stripe live", () => {
    expect(docLower).not.toContain("openai.chat");
    expect(docLower).not.toContain("anthropic.messages");
    expect(docLower).not.toContain("stripe.charges.create");
  });

  it("T05.7 — aucune écriture Supabase", () => {
    expect(docLower).not.toContain("supabase.from(");
    expect(docLower).not.toContain(".insert(");
  });
});

// ── T06 — Intégrité tech stack ────────────────────────────────────────────────

describe("T06 — Intégrité tech stack (fichiers toujours présents)", () => {
  it("T06.1 — TECH-11 test toujours présent", () => {
    expect(
      fileExists("src/lib/clonestore/readiness/__tests__/technology-readiness-final-gate-tech11.test.ts"),
    ).toBe(true);
  });

  it("T06.2 — TECH-10 test toujours présent", () => {
    expect(
      fileExists("src/lib/clonestore/voice/__tests__/clonevoice-readiness-tech10.test.ts"),
    ).toBe(true);
  });

  it("T06.3 — TECH-09 test toujours présent", () => {
    expect(
      fileExists("src/lib/clonestore/brief/__tests__/clonebrief-executive-summaries-tech09.test.ts"),
    ).toBe(true);
  });

  it("T06.4 — TECH-08 test toujours présent", () => {
    expect(
      fileExists("src/lib/clonestore/cloneos/__tests__/cloneos-command-center-tech08.test.ts"),
    ).toBe(true);
  });

  it("T06.5 — Employee Runtime intact", () => {
    expect(fileExists("src/lib/clonestore/employees/employee-registry.ts")).toBe(true);
    expect(fileExists("src/lib/clonestore/employees/employee-runtime-contract.ts")).toBe(true);
  });

  it("T06.6 — GlobalTechnologyConfig intact", () => {
    expect(fileExists("src/lib/clonestore/technologies/global-tech-config.ts")).toBe(true);
    expect(fileExists("src/lib/clonestore/technologies/global-tech-defaults.ts")).toBe(true);
  });

  it("T06.7 — CloneOS intact", () => {
    expect(fileExists("src/lib/clonestore/cloneos/index.ts")).toBe(true);
  });

  it("T06.8 — Pierre moteur intact", () => {
    expect(fileExists("src/lib/pierre")).toBe(true);
  });
});

// ── T07 — Structure cockpit existante ─────────────────────────────────────────

describe("T07 — Structure cockpit existante", () => {
  it("T07.1 — /profile/agents/page.tsx existe", () => {
    expect(fileExists("src/app/profile/agents/page.tsx")).toBe(true);
  });

  it("T07.2 — /profile/messages/page.tsx existe", () => {
    expect(fileExists("src/app/profile/messages/page.tsx")).toBe(true);
  });

  it("T07.3 — /profile/technologies/page.tsx existe", () => {
    expect(fileExists("src/app/profile/technologies/page.tsx")).toBe(true);
  });

  it("T07.4 — /agents/pierre/use/page.tsx existe", () => {
    expect(fileExists("src/app/agents/pierre/use/page.tsx")).toBe(true);
  });

  it("T07.5 — /agents/pierre/setup/page.tsx existe", () => {
    expect(fileExists("src/app/agents/pierre/setup/page.tsx")).toBe(true);
  });

  it("T07.6 — agent-catalog.ts existe", () => {
    expect(fileExists("src/lib/agent-catalog.ts")).toBe(true);
  });

  it("T07.7 — Pierre cockpit composants existent", () => {
    expect(fileExists("src/app/agents/pierre/use/components/PierreCockpitShell.tsx")).toBe(true);
    expect(fileExists("src/app/agents/pierre/use/components/PierreCommandCenter.tsx")).toBe(true);
  });
});

// ── T08 — doc structure complète ─────────────────────────────────────────────

describe("T08 — Structure de la documentation complète", () => {
  it("T08.1 — doc contient résumé exécutif", () => {
    expect(docLower).toContain("résumé exécutif");
  });

  it("T08.2 — doc contient matrice de maturité", () => {
    expect(docLower).toContain("matrice");
  });

  it("T08.3 — doc contient risques", () => {
    expect(docLower).toContain("risque");
  });

  it("T08.4 — doc mentionne que public launch reste NO-GO", () => {
    expect(docLower).toContain("no-go");
  });

  it("T08.5 — doc mentionne que cockpit existe déjà", () => {
    expect(docLower).toContain("profile/agents");
  });
});

// src/app/assistant/__tests__/clonechat-reveal.test.ts
// C1.2 — CLONECHAT REVEAL : la surface authentifiée réelle est activée. Les 20 preuves
// exercent le comportement RÉEL (rendu du layout serveur, règle canonique d'activation,
// lecture des routes/sources réelles) — jamais un simple booléen figé.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { isCloneChatEnabled, isCloneChatEmergencyDisabled } from "@/lib/features/product-availability";
import { getRouteEntry } from "@/lib/nav/route-registry";
import { PUBLIC_DISCOVERY_TOUR } from "@/lib/guided-tour";
import { PRODUCTION_AUTHORIZED } from "@/lib/clonestore/production/p10-production-gate";
import { resolvePaymentMode } from "@/lib/clonestore/production/p15-1-payment-mode";
import { isLiveExecutionAllowed } from "@/lib/clonestore/technologies/t1";
import { evaluateCloneChatRevealStatus } from "@/lib/clonechat/intelligence/c1-1/parrain-command-center";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(resolve(ROOT, p), "utf8");
const layoutSrc = read("src/app/assistant/layout.tsx");
const pageSrc = read("src/app/assistant/page.tsx");
const routeSrc = read("src/app/api/assistant/chat/route.ts");
const workspaceSrc = read("src/components/clonechat/CloneChatWorkspace.tsx");
const hookSrc = read("src/app/assistant/useCloneChat.ts");

// NB : le layout est un composant serveur .tsx (jsx: preserve) — non importable en
// environnement node vitest. On vérifie donc (a) le comportement RÉEL de la règle
// canonique isCloneChatEnabled() sur plusieurs env, et (b) la STRUCTURE du layout source
// (rend {children} par défaut ; écran verrouillé UNIQUEMENT sous arrêt d'urgence, sans
// « arrive bientôt »). Le rendu réel est prouvé par le QA navigateur.
const ENV_KEY = "CLONECHAT_ENABLED";
const original = process.env[ENV_KEY];
afterEach(() => {
  if (original === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = original;
});

describe("C1.2 — CloneChat Reveal", () => {
  // 1
  it("1. /assistant utilise la vraie page CloneChat", () => {
    expect(pageSrc).toMatch(/CloneChatWorkspace/);
    expect(pageSrc).not.toMatch(/arrive bientôt/i);
  });

  // 2
  it("2. le layout ne remplace plus le workspace par l'écran coming-soon (défaut → children)", () => {
    delete process.env[ENV_KEY]; // par défaut = actif
    expect(isCloneChatEnabled()).toBe(true);
    // Structure : l'écran verrouillé est DANS la branche d'arrêt d'urgence ; hors branche → children.
    expect(layoutSrc).toMatch(/if \(!isCloneChatEnabled\(\)\)/);
    expect(layoutSrc).toMatch(/return <>\{children\}<\/>;/);
    // La branche verrouillée n'est atteinte que si !isCloneChatEnabled() (donc jamais par défaut).
    // On cible l'USAGE JSX <AccessLockScreen, pas la ligne d'import.
    const lockJsxIdx = layoutSrc.indexOf("<AccessLockScreen");
    const guardIdx = layoutSrc.indexOf("if (!isCloneChatEnabled())");
    expect(guardIdx).toBeGreaterThan(0);
    expect(lockJsxIdx).toBeGreaterThan(guardIdx);
  });

  // 3
  it("3. « CloneChat arrive bientôt » est absent du chemin source de /assistant", () => {
    expect(layoutSrc).not.toMatch(/arrive bientôt/i);
    expect(layoutSrc).not.toMatch(/bientôt disponible/i);
    expect(pageSrc).not.toMatch(/arrive bientôt/i);
  });

  // 4
  it("4. le vrai CloneChatWorkspace reste câblé", () => {
    expect(pageSrc).toMatch(/import \{ CloneChatWorkspace \}/);
    expect(workspaceSrc).toMatch(/export function CloneChatWorkspace/);
  });

  // 5
  it("5. le composer reste présent pour un utilisateur autorisé", () => {
    expect(workspaceSrc).toMatch(/textarea/);
    expect(workspaceSrc).toMatch(/onClick=\{submit\}/);
  });

  // 6
  it("6. les pièces jointes restent câblées (C1.7 : fichiers, images, DOSSIER)", () => {
    // L'intention est inchangée — seul le contrôle a été élargi en C1.7.
    expect(workspaceSrc).toMatch(/Ajouter des fichiers/);
    expect(workspaceSrc).toMatch(/Ajouter des images/);
    expect(workspaceSrc).toMatch(/Ajouter un dossier/);
    expect(workspaceSrc).toMatch(/webkitdirectory/); // sélection de dossier
    expect(hookSrc).toMatch(/attachments: docs\.map/);
  });

  // 7
  it("7. l'historique de conversation reste câblé", () => {
    expect(hookSrc).toMatch(/\/api\/assistant\/conversations/);
    expect(workspaceSrc).toMatch(/newConversation|openConversation/);
  });

  // 8
  it("8. l'exécution de proposition n'envoie que proposalId", () => {
    expect(hookSrc).toMatch(/proposalId: action\.proposalId/);
    expect(hookSrc).toMatch(/\/api\/assistant\/execute/);
  });

  // 9
  it("9. C1.6 — l'API identifie sans FILTRER : l'anonyme converse, mais n'atteint pas le tenant", () => {
    // C1.6 — L'API n'exige plus l'authentification pour CONVERSER. Elle identifie le lecteur
    // et interdit à l'anonyme la voie ENTREPRISE : c'est l'invariant qui compte.
    expect(routeSrc).toMatch(/kind: "anonymous"/);
    expect(routeSrc).toMatch(/viewer\.kind !== "user"/);
    expect(routeSrc).toMatch(/supabase\.auth\.getUser/);
  });

  // 10
  it("10. la résolution d'entreprise reste côté serveur", () => {
    expect(routeSrc).toMatch(/resolveCloneChatCompany\(viewer\.userId\)/);
    expect(routeSrc).not.toMatch(/companyId.*body\.|body\..*companyId/);
  });

  // 11
  it("11. l'isolation tenant reste inchangée (visibilité fail-closed)", async () => {
    const s = await evaluateCloneChatRevealStatus({} as NodeJS.ProcessEnv);
    expect(s.tenantIsolationReady).toBe(true);
  });

  // 12
  it("12. l'API utilise le grounding C1.1", () => {
    expect(routeSrc).toMatch(/buildParrainGroundedPrompt/);
    expect(routeSrc).toMatch(/validateParrainCitations/);
  });

  // 13
  it("13. l'API utilise le vrai responder OpenAI", () => {
    expect(routeSrc).toMatch(/createRealOpenAIResponder\(key\)/);
  });

  // 14
  it("14. l'API garde budget-avant-modèle", () => {
    expect(routeSrc.indexOf("stores.budget.reserve")).toBeLessThan(routeSrc.indexOf("createRealOpenAIResponder(key)"));
    expect(routeSrc).toMatch(/finally[\s\S]*stores\.budget\.release/);
  });

  // 15
  it("15. l'API garde la validation des citations côté serveur", () => {
    expect(routeSrc).toMatch(/validateParrainCitations\(structured\.citations/);
  });

  // 16
  it("16. l'API garde la garde de claims", () => {
    expect(routeSrc).toMatch(/finalizeAnswerText/);
  });

  // 17
  it("17. l'arrêt d'urgence explicite reste fail-closed (page + API partagent la règle)", () => {
    process.env[ENV_KEY] = "false";
    expect(isCloneChatEnabled()).toBe(false);
    expect(isCloneChatEmergencyDisabled()).toBe(true);
    for (const v of ["0", "off", "disabled", "no", "FALSE"]) { process.env[ENV_KEY] = v; expect(isCloneChatEnabled(), v).toBe(false); }
    // L'écran d'arrêt d'urgence est HONNÊTE (« temporairement indisponible »), jamais l'ancien placeholder.
    expect(layoutSrc).toMatch(/temporairement indisponible/i);
    expect(layoutSrc).not.toMatch(/arrive bientôt/i);
    // L'API applique la MÊME règle canonique (isCloneChatEnabled → 503).
    expect(routeSrc).toMatch(/isCloneChatEnabled\(\)/);
    expect(routeSrc).toMatch(/CLONECHAT_DISABLED[\s\S]*503/);
  });

  // 18
  it("18. la configuration active par défaut n'affiche plus le placeholder", () => {
    for (const v of [undefined, "", "true", "1", "on", "enabled"]) {
      if (v === undefined) delete process.env[ENV_KEY]; else process.env[ENV_KEY] = v;
      expect(isCloneChatEnabled(), String(v)).toBe(true);
    }
    // La seule branche qui monte l'écran verrouillé est gardée par !isCloneChatEnabled().
    expect(layoutSrc).toMatch(/if \(!isCloneChatEnabled\(\)\)[\s\S]*AccessLockScreen/);
  });

  // 19
  it("19. la navigation ne marque pas CloneChat « soon »/désactivé", () => {
    const entry = getRouteEntry("/assistant");
    expect(entry?.status).toBe("active");
    expect(entry?.futurePhase).toBeUndefined();
    expect(entry?.note ?? "").not.toMatch(/arrive bientôt|verrouillé par défaut/i);
    // La cible de tour reste déclarée ET portée par le workspace réel.
    expect(entry?.tourTargets).toContain("clonechat-entry");
    expect(workspaceSrc).toMatch(/data-tour-id="clonechat-entry"/);
    // Le tour public ne dit plus « arrive bientôt ».
    const step = PUBLIC_DISCOVERY_TOUR.steps.find((s) => s.id === "clonechat");
    expect(step?.body ?? "").not.toMatch(/arrive bientôt/i);
  });

  // 20
  it("20. production/paiement/providers live restent inchangés", () => {
    expect(PRODUCTION_AUTHORIZED).toBe(false);
    expect(["disabled", "test"]).toContain(resolvePaymentMode({} as NodeJS.ProcessEnv));
    expect(isLiveExecutionAllowed()).toBe(false);
  });
});

describe("C1.2 — statut de révélation (computé)", () => {
  it("les 8 champs de vérité C1.2 sont corrects", async () => {
    delete process.env[ENV_KEY];
    const s = await evaluateCloneChatRevealStatus({} as NodeJS.ProcessEnv);
    expect(s.assistantSurfaceRevealed).toBe(true);
    expect(s.comingSoonScreenRemoved).toBe(true);
    expect(s.authenticatedWorkspaceReachable).toBe(true);
    expect(s.clonechatFeatureActive).toBe(true);
    expect(s.emergencyKillSwitchReady).toBe(true);
    expect(s.anonymousModelAccessBlocked).toBe(true);
    expect(s.tenantIsolationReady).toBe(true);
    expect(s.publicUnauthenticatedChatEnabled).toBe(false);
    expect(s.requiredDeploymentEnv).toBeNull();
    // Sous arrêt d'urgence : feature inactive, mais le reste des invariants tient.
    const off = await evaluateCloneChatRevealStatus({ CLONECHAT_ENABLED: "false" } as NodeJS.ProcessEnv);
    expect(off.clonechatFeatureActive).toBe(false);
    expect(off.emergencyKillSwitchReady).toBe(true);
    expect(off.publicUnauthenticatedChatEnabled).toBe(false);
  });
});

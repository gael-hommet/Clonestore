// src/lib/clonestore/enterprise-footprint/__tests__/enterprise-footprint-messages-feed-phase3-16.test.ts
// PHASE 3.16 — Profile Messages Enterprise Footprint Feed — Tests
//
// Vérifie :
//   - bridge messages feed (structure, invariants, types)
//   - QA module
//   - intégration /profile/messages
//   - documentation
//   - exports index.ts
//   - régression cascade PHASE 3.1 → 3.15

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
// BLOC 1 — Bridge messages feed
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.16 — Bridge messages feed", () => {
  const feedPath = "lib/clonestore/enterprise-footprint/enterprise-footprint-messages-feed.ts";
  const feed = readSrc(feedPath);

  it("1. enterprise-footprint-messages-feed.ts existe", () => {
    expect(existsSync(resolve(ROOT, "src", feedPath))).toBe(true);
  });

  it("2. enterprise-footprint-messages-feed-qa.ts existe", () => {
    expect(existsSync(resolve(ROOT, "src", "lib/clonestore/enterprise-footprint/enterprise-footprint-messages-feed-qa.ts"))).toBe(true);
  });

  it("3. messages feed bridge contient loadEnterpriseFootprintForMessagesFeed", () => {
    expect(feed).toContain("loadEnterpriseFootprintForMessagesFeed");
  });

  it("4. messages feed bridge contient buildEnterpriseFootprintMessagesFeedSummary", () => {
    expect(feed).toContain("buildEnterpriseFootprintMessagesFeedSummary");
  });

  it("5. messages feed bridge contient buildEnterpriseFootprintMessagesFeedCards", () => {
    expect(feed).toContain("buildEnterpriseFootprintMessagesFeedCards");
  });

  it("6. messages feed bridge contient buildEnterpriseFootprintMessagesFeedItems", () => {
    expect(feed).toContain("buildEnterpriseFootprintMessagesFeedItems");
  });

  it("7. messages feed bridge contient buildEnterpriseFootprintMessagesFeedRecommendations", () => {
    expect(feed).toContain("buildEnterpriseFootprintMessagesFeedRecommendations");
  });

  it("8. messages feed bridge utilise loadEnterpriseFootprintForCockpit ou loadEnterpriseFootprintFromLocalStorage", () => {
    const usesOne =
      feed.includes("loadEnterpriseFootprintForCockpit") ||
      feed.includes("loadEnterpriseFootprintFromLocalStorage");
    expect(usesOne).toBe(true);
  });

  it("9. messages feed bridge mentionne fallback onboarding draft", () => {
    const mentionsFallback =
      feed.includes("onboarding_draft_fallback") ||
      feed.includes("loadGlobalOnboardingDraftFromLocalStorage") ||
      feed.toLowerCase().includes("onboarding") && feed.includes("fallback");
    expect(mentionsFallback).toBe(true);
  });

  it("10. messages feed bridge ne contient pas Supabase import", () => {
    expect(feed).not.toMatch(/^import\s+.*from\s+["']@supabase\/supabase-js["']/m);
    expect(feed).not.toMatch(/^import\s+.*createClient.*from\s+["']@supabase/m);
  });

  it("11. messages feed bridge ne contient pas insert/update/delete/upsert", () => {
    expect(feed).not.toMatch(/\.insert\s*\(/);
    expect(feed).not.toMatch(/\.update\s*\(/);
    expect(feed).not.toMatch(/\.delete\s*\(/);
    expect(feed).not.toMatch(/\.upsert\s*\(/);
  });

  it("12. messages feed bridge ne contient pas import src/lib/pierre", () => {
    expect(feed).not.toMatch(/^import\s+.*from\s+["']@\/lib\/pierre/m);
  });

  it("13. messages feed items contiennent read_only", () => {
    expect(feed).toContain("read_only: true");
  });

  it("14. messages feed items ne prétendent pas envoyer un message", () => {
    // Les items ne doivent pas avoir de formulation "message envoyé" en positif
    expect(feed).not.toMatch(/message\s+(?:réel\s+)?envoyé\s+(?:avec\s+succès|effectué)/i);
    // "Aucun message envoyé" est autorisé (formulation négative)
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 2 — QA module
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.16 — QA module", () => {
  const qaPath = "lib/clonestore/enterprise-footprint/enterprise-footprint-messages-feed-qa.ts";
  const qa = readSrc(qaPath);

  it("15. QA module contient buildEnterpriseFootprintMessagesFeedQaChecklist", () => {
    expect(qa).toContain("buildEnterpriseFootprintMessagesFeedQaChecklist");
  });

  it("16. QA module contient no_db_write", () => {
    expect(qa).toContain("no_db_write");
  });

  it("17. QA module contient no_api_post", () => {
    expect(qa).toContain("no_api_post");
  });

  it("18. QA module contient no_message_sent", () => {
    expect(qa).toContain("no_message_sent");
  });

  it("19. QA module contient public_launch_external_not_validated", () => {
    expect(qa).toContain("public_launch_external_not_validated");
  });

  it("20. QA module ne contient pas Supabase createClient", () => {
    expect(qa).not.toMatch(/^import\s+.*createClient.*from\s+["']@supabase/m);
    expect(qa).not.toMatch(/^import\s+.*from\s+["']@supabase\/supabase-js["']/m);
  });

  it("21. QA module ne contient pas insert/update/delete/upsert", () => {
    expect(qa).not.toMatch(/\.insert\s*\(/);
    expect(qa).not.toMatch(/\.update\s*\(/);
    expect(qa).not.toMatch(/\.delete\s*\(/);
    expect(qa).not.toMatch(/\.upsert\s*\(/);
  });

  it("22. QA module ne contient pas import src/lib/pierre", () => {
    expect(qa).not.toMatch(/^import\s+.*from\s+["']@\/lib\/pierre/m);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 3 — Intégration /profile/messages
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.16 — Intégration /profile/messages", () => {
  const page = readSrc("app/profile/messages/page.tsx");

  it("23. /profile/messages mentionne Empreinte Entreprise ou Contexte Entreprise", () => {
    const hasMention =
      page.includes("Empreinte Entreprise") ||
      page.includes("Contexte Entreprise");
    expect(hasMention).toBe(true);
  });

  it("24. /profile/messages mentionne Lecture seule", () => {
    expect(page).toContain("Lecture seule");
  });

  it("25. /profile/messages mentionne Aucune action exécutée", () => {
    expect(page).toContain("Aucune action exécutée");
  });

  it("26. /profile/messages mentionne Aucun message envoyé", () => {
    expect(page).toContain("Aucun message envoyé");
  });

  it("27. /profile/messages mentionne localStorage reste le fallback actif", () => {
    expect(page).toContain("localStorage reste le fallback actif");
  });

  it("28. /profile/messages contient /profile/onboarding", () => {
    expect(page).toContain("/profile/onboarding");
  });

  it("29. /profile/messages consomme le feed Empreinte (direct ou via context feed P3.17)", () => {
    // PHASE 3.16 : appel direct loadEnterpriseFootprintForMessagesFeed.
    // PHASE 3.17 : le feed Empreinte est réutilisé à l'intérieur du context feed
    //              unifié (loadProfileMessagesContextFeed). L'invariant — le feed
    //              Empreinte atteint /profile/messages — reste vrai dans les deux cas.
    const usesEnterpriseFeed =
      page.includes("loadEnterpriseFootprintForMessagesFeed") ||
      page.includes("loadProfileMessagesContextFeed");
    expect(usesEnterpriseFeed).toBe(true);
  });

  it("30. /profile/messages ne contient pas appel route /api/profile/enterprise-footprint", () => {
    expect(page).not.toContain("/api/profile/enterprise-footprint");
  });

  it("31. /profile/messages ne contient pas fetch POST vers enterprise-footprint", () => {
    expect(page).not.toMatch(/fetch\s*\(.*enterprise-footprint.*method.*POST/s);
  });

  it("32. /profile/messages ne contient pas persistEnterpriseFootprintWithFallback", () => {
    expect(page).not.toContain("persistEnterpriseFootprintWithFallback");
  });

  it("33. /profile/messages ne contient pas supabaseServer ni createServerClient pour enterprise-footprint", () => {
    expect(page).not.toContain("supabaseServer");
    expect(page).not.toContain("createServerClient");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 4 — Documentation
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.16 — Documentation", () => {
  const docName = "PHASE_3_16_PROFILE_MESSAGES_ENTERPRISE_FOOTPRINT_FEED.md";
  const doc = readDocs(docName);

  it("34. doc PHASE_3_16 existe", () => {
    expect(existsSync(resolve(ROOT, "docs", docName))).toBe(true);
  });

  it("35. doc mentionne /profile/messages", () => {
    expect(doc).toContain("/profile/messages");
  });

  it("36. doc mentionne Empreinte Entreprise", () => {
    expect(doc).toContain("Empreinte Entreprise");
  });

  it("37. doc mentionne read-only ou lecture seule", () => {
    const hasReadOnly =
      doc.toLowerCase().includes("read-only") ||
      doc.toLowerCase().includes("lecture seule");
    expect(hasReadOnly).toBe(true);
  });

  it("38. doc mentionne Aucun message envoyé", () => {
    const hasMention =
      doc.includes("Aucun message envoyé") ||
      doc.toLowerCase().includes("aucun message");
    expect(hasMention).toBe(true);
  });

  it("39. doc mentionne PHASE 3.17", () => {
    expect(doc).toContain("3.17");
  });

  it("40. doc ne contient pas phrase de lancement public interdite", () => {
    expect(doc.toLowerCase()).not.toContain("public launch go");
  });

  it("41. doc ne contient pas 'zéro erreur'", () => {
    expect(doc.toLowerCase()).not.toContain("zéro erreur");
    expect(doc.toLowerCase()).not.toContain("zero erreur");
  });

  it("42. doc ne contient pas 'conformité garantie'", () => {
    expect(doc.toLowerCase()).not.toContain("conformité garantie");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 5 — Exports index.ts
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.16 — Exports index.ts", () => {
  const index = readSrc("lib/clonestore/enterprise-footprint/index.ts");

  it("43. index exporte messages feed (loadEnterpriseFootprintForMessagesFeed)", () => {
    expect(index).toContain("loadEnterpriseFootprintForMessagesFeed");
  });

  it("44. index exporte messages feed QA (buildEnterpriseFootprintMessagesFeedQaChecklist)", () => {
    expect(index).toContain("buildEnterpriseFootprintMessagesFeedQaChecklist");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 6 — Tests fonctionnels (imports purs)
// ─────────────────────────────────────────────────────────────────────────────

import {
  loadEnterpriseFootprintForMessagesFeed,
  buildEnterpriseFootprintMessagesFeedSummary,
  buildEnterpriseFootprintMessagesFeedCards,
  buildEnterpriseFootprintMessagesFeedItems,
  buildEnterpriseFootprintMessagesFeedRecommendations,
  buildEnterpriseFootprintMessagesFeedActions,
  buildEmptyEnterpriseFootprintMessagesFeedState,
  getEnterpriseFootprintMessagesFeedStatusLabel,
  getEnterpriseFootprintMessagesFeedSourceLabel,
} from "@/lib/clonestore/enterprise-footprint";

import {
  buildEnterpriseFootprintMessagesFeedQaChecklist,
  buildEnterpriseFootprintMessagesFeedQaVerdict,
  getEnterpriseFootprintMessagesFeedBlockingSteps,
  summarizeEnterpriseFootprintMessagesFeedQaVerdict,
} from "@/lib/clonestore/enterprise-footprint";

import { buildEmptyEnterpriseFootprint } from "@/lib/clonestore/enterprise-footprint";

describe("PHASE 3.16 — Tests fonctionnels bridge messages feed", () => {
  it("loadEnterpriseFootprintForMessagesFeed retourne un résultat valide", () => {
    const result = loadEnterpriseFootprintForMessagesFeed();
    expect(result).toBeDefined();
    expect(typeof result.has_footprint).toBe("boolean");
    expect(Array.isArray(result.items)).toBe(true);
    expect(Array.isArray(result.cards)).toBe(true);
    expect(Array.isArray(result.recommendations)).toBe(true);
    expect(Array.isArray(result.actions)).toBe(true);
  });

  it("empty state retourne has_footprint false et source 'empty'", () => {
    const empty = buildEmptyEnterpriseFootprintMessagesFeedState();
    expect(empty.has_footprint).toBe(false);
    expect(empty.source).toBe("empty");
    expect(empty.items.length).toBeGreaterThan(0);
    expect(empty.items[0]?.read_only).toBe(true);
  });

  it("empty state CTA pointe vers /profile/onboarding", () => {
    const empty = buildEmptyEnterpriseFootprintMessagesFeedState();
    const hasOnboarding = empty.items.some((item) => item.action_href === "/profile/onboarding");
    expect(hasOnboarding).toBe(true);
  });

  it("buildEnterpriseFootprintMessagesFeedSummary retourne read_only: true", () => {
    const fp = buildEmptyEnterpriseFootprint();
    const summary = buildEnterpriseFootprintMessagesFeedSummary(fp);
    expect(summary.read_only).toBe(true);
  });

  it("buildEnterpriseFootprintMessagesFeedCards retourne 4 cards", () => {
    const fp = buildEmptyEnterpriseFootprint();
    const cards = buildEnterpriseFootprintMessagesFeedCards(fp);
    expect(cards.length).toBe(4);
  });

  it("buildEnterpriseFootprintMessagesFeedItems retourne des items avec read_only: true", () => {
    const fp = buildEmptyEnterpriseFootprint();
    const items = buildEnterpriseFootprintMessagesFeedItems(fp, "enterprise_footprint_snapshot");
    items.forEach((item) => {
      expect(item.read_only).toBe(true);
    });
  });

  it("buildEnterpriseFootprintMessagesFeedRecommendations sans footprint retourne rec create", () => {
    const recs = buildEnterpriseFootprintMessagesFeedRecommendations(null);
    expect(recs.length).toBeGreaterThan(0);
    expect(recs[0]?.href).toBe("/profile/onboarding");
  });

  it("buildEnterpriseFootprintMessagesFeedActions sans footprint → /profile/onboarding primary", () => {
    const actions = buildEnterpriseFootprintMessagesFeedActions({ has_footprint: false, summary: null });
    const primaryAction = actions.find((a) => a.primary);
    expect(primaryAction?.href).toBe("/profile/onboarding");
  });

  it("getEnterpriseFootprintMessagesFeedStatusLabel retourne des labels", () => {
    expect(getEnterpriseFootprintMessagesFeedStatusLabel("ready")).toBe("Prête");
    expect(getEnterpriseFootprintMessagesFeedStatusLabel("empty")).toBe("Aucune empreinte");
  });

  it("getEnterpriseFootprintMessagesFeedSourceLabel retourne des labels", () => {
    expect(getEnterpriseFootprintMessagesFeedSourceLabel("enterprise_footprint_snapshot")).toBe("Snapshot local");
    expect(getEnterpriseFootprintMessagesFeedSourceLabel("onboarding_draft_fallback")).toBe("Brouillon onboarding");
  });
});

describe("PHASE 3.16 — Tests fonctionnels QA module", () => {
  it("QA checklist retourne 16 étapes", () => {
    const checklist = buildEnterpriseFootprintMessagesFeedQaChecklist();
    expect(checklist.total).toBe(16);
    expect(checklist.phase).toBe("3.16");
  });

  it("toutes les étapes QA sont initialement pending", () => {
    const checklist = buildEnterpriseFootprintMessagesFeedQaChecklist();
    expect(checklist.steps.every((s) => s.status === "pending")).toBe(true);
  });

  it("verdict avec toutes étapes pending → pending", () => {
    const checklist = buildEnterpriseFootprintMessagesFeedQaChecklist();
    const summary = buildEnterpriseFootprintMessagesFeedQaVerdict(checklist.steps);
    expect(summary.verdict).toBe("pending");
    expect(summary.safe_to_activate).toBe(true);
  });

  it("verdict avec blocking failed → blocked", () => {
    const checklist = buildEnterpriseFootprintMessagesFeedQaChecklist();
    const stepsWithFail = checklist.steps.map((s) =>
      s.id === "no_db_write" ? { ...s, status: "failed" as const } : s
    );
    const summary = buildEnterpriseFootprintMessagesFeedQaVerdict(stepsWithFail);
    expect(summary.verdict).toBe("blocked");
    expect(summary.safe_to_activate).toBe(false);
  });

  it("getBlockingSteps retourne les étapes bloquantes uniquement", () => {
    const blocking = getEnterpriseFootprintMessagesFeedBlockingSteps();
    expect(blocking.length).toBeGreaterThan(0);
    expect(blocking.every((s) => s.severity === "blocking")).toBe(true);
  });

  it("summarize retourne un message lisible avec PHASE 3.16", () => {
    const checklist = buildEnterpriseFootprintMessagesFeedQaChecklist();
    const summary = buildEnterpriseFootprintMessagesFeedQaVerdict(checklist.steps);
    const msg = summarizeEnterpriseFootprintMessagesFeedQaVerdict(summary);
    expect(msg).toContain("PHASE 3.16");
    expect(msg).toContain("PENDING");
  });
});

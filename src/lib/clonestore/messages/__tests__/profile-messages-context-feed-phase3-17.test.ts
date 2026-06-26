// src/lib/clonestore/messages/__tests__/profile-messages-context-feed-phase3-17.test.ts
// PHASE 3.17 — Profile Messages CloneOS History Feed Merge — Tests
//
// Vérifie :
//   - bridge CloneOS history feed (localStorage, read-only)
//   - bridge context feed unifié (Empreinte + CloneOS)
//   - QA module
//   - intégration /profile/messages
//   - documentation
//   - exports index.ts
//   - régression cascade PHASE 3.1 → 3.16

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
// BLOC 1 — Bridge context feed
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.17 — Bridge context feed", () => {
  const ctxPath = "lib/clonestore/messages/profile-messages-context-feed.ts";
  const ctx = readSrc(ctxPath);
  const cloneosPath = "lib/clonestore/messages/profile-messages-cloneos-history-feed.ts";
  const cloneos = readSrc(cloneosPath);

  it("1. profile-messages-context-feed.ts existe", () => {
    expect(existsSync(resolve(ROOT, "src", ctxPath))).toBe(true);
  });

  it("2. profile-messages-context-feed-qa.ts existe", () => {
    expect(existsSync(resolve(ROOT, "src", "lib/clonestore/messages/profile-messages-context-feed-qa.ts"))).toBe(true);
  });

  it("3. context feed contient loadProfileMessagesContextFeed", () => {
    expect(ctx).toContain("loadProfileMessagesContextFeed");
  });

  it("4. context feed contient buildProfileMessagesContextFeedSummary", () => {
    expect(ctx).toContain("buildProfileMessagesContextFeedSummary");
  });

  it("5. context feed contient buildProfileMessagesContextFeedSections", () => {
    expect(ctx).toContain("buildProfileMessagesContextFeedSections");
  });

  it("6. context feed contient buildProfileMessagesContextFeedItems", () => {
    expect(ctx).toContain("buildProfileMessagesContextFeedItems");
  });

  it("7. context feed utilise loadEnterpriseFootprintForMessagesFeed", () => {
    expect(ctx).toContain("loadEnterpriseFootprintForMessagesFeed");
  });

  it("8. context feed utilise CloneOS history feed", () => {
    const usesCloneOS =
      ctx.includes("loadProfileMessagesCloneOSHistoryFeed") ||
      cloneos.includes("loadCloneOSHistoryItemsFromLocalStorage");
    expect(usesCloneOS).toBe(true);
  });

  it("9. context feed ne contient pas Supabase import", () => {
    expect(ctx).not.toMatch(/^import\s+.*from\s+["']@supabase\/supabase-js["']/m);
    expect(ctx).not.toMatch(/^import\s+.*createClient.*from\s+["']@supabase/m);
  });

  it("10. context feed ne contient pas insert/update/delete/upsert", () => {
    expect(ctx).not.toMatch(/\.insert\s*\(/);
    expect(ctx).not.toMatch(/\.update\s*\(/);
    expect(ctx).not.toMatch(/\.delete\s*\(/);
    expect(ctx).not.toMatch(/\.upsert\s*\(/);
  });

  it("11. context feed ne contient pas fetch", () => {
    expect(ctx).not.toMatch(/\bfetch\s*\(/);
  });

  it("12. context feed ne contient pas import src/lib/pierre", () => {
    expect(ctx).not.toMatch(/^import\s+.*from\s+["']@\/lib\/pierre/m);
  });

  it("13. context feed items contiennent read_only", () => {
    expect(ctx).toContain("read_only: true");
  });

  it("14. context feed mentionne enterprise_footprint", () => {
    expect(ctx).toContain("enterprise_footprint");
  });

  it("15. context feed mentionne cloneos_history", () => {
    expect(ctx).toContain("cloneos_history");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 2 — QA module
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.17 — QA module", () => {
  const qa = readSrc("lib/clonestore/messages/profile-messages-context-feed-qa.ts");

  it("16. QA module contient buildProfileMessagesContextFeedQaChecklist", () => {
    expect(qa).toContain("buildProfileMessagesContextFeedQaChecklist");
  });

  it("17. QA module contient no_db_write", () => {
    expect(qa).toContain("no_db_write");
  });

  it("18. QA module contient no_api_post", () => {
    expect(qa).toContain("no_api_post");
  });

  it("19. QA module contient no_message_sent", () => {
    expect(qa).toContain("no_message_sent");
  });

  it("20. QA module contient no_cloneos_execution", () => {
    expect(qa).toContain("no_cloneos_execution");
  });

  it("21. QA module contient public_launch_external_not_validated", () => {
    expect(qa).toContain("public_launch_external_not_validated");
  });

  it("22. QA module ne contient pas Supabase createClient", () => {
    expect(qa).not.toMatch(/^import\s+.*createClient.*from\s+["']@supabase/m);
    expect(qa).not.toMatch(/^import\s+.*from\s+["']@supabase\/supabase-js["']/m);
  });

  it("23. QA module ne contient pas insert/update/delete/upsert", () => {
    expect(qa).not.toMatch(/\.insert\s*\(/);
    expect(qa).not.toMatch(/\.update\s*\(/);
    expect(qa).not.toMatch(/\.delete\s*\(/);
    expect(qa).not.toMatch(/\.upsert\s*\(/);
  });

  it("24. QA module ne contient pas import src/lib/pierre", () => {
    expect(qa).not.toMatch(/^import\s+.*from\s+["']@\/lib\/pierre/m);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 3 — Intégration /profile/messages
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.17 — Intégration /profile/messages", () => {
  const page = readSrc("app/profile/messages/page.tsx");

  it("25. /profile/messages mentionne Contexte système", () => {
    expect(page).toContain("Contexte système");
  });

  it("26. /profile/messages mentionne Empreinte Entreprise", () => {
    expect(page).toContain("Empreinte Entreprise");
  });

  it("27. /profile/messages mentionne Historique CloneOS", () => {
    expect(page).toContain("Historique CloneOS");
  });

  it("28. /profile/messages mentionne Lecture seule", () => {
    expect(page).toContain("Lecture seule");
  });

  it("29. /profile/messages mentionne Aucune action exécutée", () => {
    expect(page).toContain("Aucune action exécutée");
  });

  it("30. /profile/messages mentionne Aucun message envoyé", () => {
    expect(page).toContain("Aucun message envoyé");
  });

  it("31. /profile/messages mentionne localStorage reste le fallback actif", () => {
    expect(page).toContain("localStorage reste le fallback actif");
  });

  it("32. /profile/messages utilise loadProfileMessagesContextFeed", () => {
    expect(page).toContain("loadProfileMessagesContextFeed");
  });

  it("33. /profile/messages ne contient pas /api/profile/enterprise-footprint", () => {
    expect(page).not.toContain("/api/profile/enterprise-footprint");
  });

  it("34. /profile/messages ne contient pas fetch POST enterprise-footprint", () => {
    expect(page).not.toMatch(/fetch\s*\(.*enterprise-footprint.*method.*POST/s);
  });

  it("35. /profile/messages ne contient pas persistEnterpriseFootprintWithFallback", () => {
    expect(page).not.toContain("persistEnterpriseFootprintWithFallback");
  });

  it("36. /profile/messages ne contient pas import Supabase direct ajouté pour le contexte", () => {
    // La page peut utiliser SupabaseClient pour les orders (P3.1), mais ne doit
    // pas ajouter createServerClient/supabaseServer pour le contexte feed.
    expect(page).not.toContain("supabaseServer");
    expect(page).not.toContain("createServerClient");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 4 — Documentation
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.17 — Documentation", () => {
  const docName = "PHASE_3_17_PROFILE_MESSAGES_CLONEOS_HISTORY_FEED_MERGE.md";
  const doc = readDocs(docName);

  it("37. doc PHASE_3_17 existe", () => {
    expect(existsSync(resolve(ROOT, "docs", docName))).toBe(true);
  });

  it("38. doc mentionne /profile/messages", () => {
    expect(doc).toContain("/profile/messages");
  });

  it("39. doc mentionne Empreinte Entreprise", () => {
    expect(doc).toContain("Empreinte Entreprise");
  });

  it("40. doc mentionne CloneOS history ou Historique CloneOS", () => {
    const hasMention =
      doc.includes("Historique CloneOS") ||
      doc.toLowerCase().includes("cloneos history");
    expect(hasMention).toBe(true);
  });

  it("41. doc mentionne read-only ou lecture seule", () => {
    const hasReadOnly =
      doc.toLowerCase().includes("read-only") ||
      doc.toLowerCase().includes("lecture seule");
    expect(hasReadOnly).toBe(true);
  });

  it("42. doc mentionne Aucun message envoyé", () => {
    const hasMention =
      doc.includes("Aucun message envoyé") ||
      doc.toLowerCase().includes("aucun message");
    expect(hasMention).toBe(true);
  });

  it("43. doc mentionne PHASE 3.18", () => {
    expect(doc).toContain("3.18");
  });

  it("44. doc ne contient pas phrase de lancement public interdite", () => {
    expect(doc.toLowerCase()).not.toContain("public launch go");
  });

  it("45. doc ne contient pas 'zéro erreur'", () => {
    expect(doc.toLowerCase()).not.toContain("zéro erreur");
    expect(doc.toLowerCase()).not.toContain("zero erreur");
  });

  it("46. doc ne contient pas 'conformité garantie'", () => {
    expect(doc.toLowerCase()).not.toContain("conformité garantie");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 5 — Exports index.ts
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.17 — Exports index.ts", () => {
  const index = readSrc("lib/clonestore/messages/index.ts");

  it("47. index exporte context feed (loadProfileMessagesContextFeed)", () => {
    expect(index).toContain("loadProfileMessagesContextFeed");
  });

  it("48. index exporte context feed QA (buildProfileMessagesContextFeedQaChecklist)", () => {
    expect(index).toContain("buildProfileMessagesContextFeedQaChecklist");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 6 — Tests fonctionnels (imports purs)
// ─────────────────────────────────────────────────────────────────────────────

import {
  loadProfileMessagesContextFeed,
  buildProfileMessagesContextFeedSummary,
  buildProfileMessagesContextFeedSections,
  buildProfileMessagesContextFeedItems,
  buildProfileMessagesContextFeedRecommendations,
  buildProfileMessagesContextFeedActions,
  buildEmptyProfileMessagesContextFeed,
  getProfileMessagesContextFeedStatusLabel,
  getProfileMessagesContextFeedSourceLabel,
} from "@/lib/clonestore/messages";

import {
  loadProfileMessagesCloneOSHistoryFeed,
  buildEmptyProfileMessagesCloneOSHistoryFeed,
  buildProfileMessagesCloneOSHistorySummary,
  buildProfileMessagesCloneOSHistoryItems,
} from "@/lib/clonestore/messages";

import {
  buildProfileMessagesContextFeedQaChecklist,
  buildProfileMessagesContextFeedQaVerdict,
  getProfileMessagesContextFeedBlockingSteps,
  summarizeProfileMessagesContextFeedQaVerdict,
} from "@/lib/clonestore/messages";

describe("PHASE 3.17 — Tests fonctionnels context feed", () => {
  it("loadProfileMessagesContextFeed retourne un résultat valide", () => {
    const result = loadProfileMessagesContextFeed();
    expect(result).toBeDefined();
    expect(typeof result.has_enterprise_footprint).toBe("boolean");
    expect(typeof result.has_cloneos_history).toBe("boolean");
    expect(Array.isArray(result.sections)).toBe(true);
    expect(Array.isArray(result.items)).toBe(true);
    expect(Array.isArray(result.recommendations)).toBe(true);
    expect(Array.isArray(result.actions)).toBe(true);
  });

  it("empty context feed retourne source 'empty' et empty state section", () => {
    const empty = buildEmptyProfileMessagesContextFeed();
    expect(empty.source).toBe("empty");
    expect(empty.has_enterprise_footprint).toBe(false);
    expect(empty.has_cloneos_history).toBe(false);
    expect(empty.sections.length).toBeGreaterThan(0);
    expect(empty.sections[0]?.kind).toBe("empty_state");
  });

  it("empty context feed summary a read_only: true", () => {
    const empty = buildEmptyProfileMessagesContextFeed();
    expect(empty.summary.read_only).toBe(true);
  });

  it("empty CloneOS history feed retourne has_history false", () => {
    const empty = buildEmptyProfileMessagesCloneOSHistoryFeed();
    expect(empty.has_history).toBe(false);
    expect(empty.source).toBe("empty");
    expect(empty.summary.read_only).toBe(true);
  });

  it("CloneOS history summary vide retourne total_count 0", () => {
    const summary = buildProfileMessagesCloneOSHistorySummary([]);
    expect(summary.total_count).toBe(0);
    expect(summary.status).toBe("empty");
  });

  it("CloneOS history items vide retourne tableau vide", () => {
    const items = buildProfileMessagesCloneOSHistoryItems([]);
    expect(items.length).toBe(0);
  });

  it("loadProfileMessagesCloneOSHistoryFeed retourne un résultat valide", () => {
    const result = loadProfileMessagesCloneOSHistoryFeed();
    expect(result).toBeDefined();
    expect(typeof result.has_history).toBe("boolean");
    expect(Array.isArray(result.items)).toBe(true);
  });

  it("context summary merge : has flags cohérents avec sources", () => {
    const enterpriseEmpty = { has_footprint: false, items: [], cards: [], recommendations: [], actions: [], summary: null, source: "empty" as const, footprint: null };
    const cloneosEmpty = buildEmptyProfileMessagesCloneOSHistoryFeed();
    const summary = buildProfileMessagesContextFeedSummary(enterpriseEmpty, cloneosEmpty);
    expect(summary.has_enterprise_footprint).toBe(false);
    expect(summary.has_cloneos_history).toBe(false);
    expect(summary.read_only).toBe(true);
  });

  it("context sections empty quand aucune source", () => {
    const enterpriseEmpty = { has_footprint: false, items: [], cards: [], recommendations: [], actions: [], summary: null, source: "empty" as const, footprint: null };
    const cloneosEmpty = buildEmptyProfileMessagesCloneOSHistoryFeed();
    const sections = buildProfileMessagesContextFeedSections(enterpriseEmpty, cloneosEmpty);
    expect(sections.length).toBe(1);
    expect(sections[0]?.kind).toBe("empty_state");
  });

  it("context items tous read_only: true", () => {
    const enterpriseEmpty = { has_footprint: false, items: [], cards: [], recommendations: [], actions: [], summary: null, source: "empty" as const, footprint: null };
    const cloneosEmpty = buildEmptyProfileMessagesCloneOSHistoryFeed();
    const items = buildProfileMessagesContextFeedItems(enterpriseEmpty, cloneosEmpty);
    items.forEach((item) => expect(item.read_only).toBe(true));
  });

  it("context recommendations sans source retourne tableau", () => {
    const enterpriseEmpty = { has_footprint: false, items: [], cards: [], recommendations: [], actions: [], summary: null, source: "empty" as const, footprint: null };
    const cloneosEmpty = buildEmptyProfileMessagesCloneOSHistoryFeed();
    const recs = buildProfileMessagesContextFeedRecommendations(enterpriseEmpty, cloneosEmpty);
    expect(Array.isArray(recs)).toBe(true);
  });

  it("context actions sans footprint → onboarding primary", () => {
    const actions = buildProfileMessagesContextFeedActions({ has_enterprise_footprint: false, has_cloneos_history: false });
    const primary = actions.find((a) => a.primary);
    expect(primary?.href).toBe("/profile/onboarding");
  });

  it("labels status/source corrects", () => {
    expect(getProfileMessagesContextFeedStatusLabel("empty")).toBe("Aucun contexte");
    expect(getProfileMessagesContextFeedSourceLabel("merged")).toBe("Empreinte + Historique CloneOS");
  });
});

describe("PHASE 3.17 — Tests fonctionnels QA module", () => {
  it("QA checklist retourne 16 étapes", () => {
    const checklist = buildProfileMessagesContextFeedQaChecklist();
    expect(checklist.total).toBe(16);
    expect(checklist.phase).toBe("3.17");
  });

  it("toutes les étapes QA sont initialement pending", () => {
    const checklist = buildProfileMessagesContextFeedQaChecklist();
    expect(checklist.steps.every((s) => s.status === "pending")).toBe(true);
  });

  it("verdict avec toutes étapes pending → pending", () => {
    const checklist = buildProfileMessagesContextFeedQaChecklist();
    const summary = buildProfileMessagesContextFeedQaVerdict(checklist.steps);
    expect(summary.verdict).toBe("pending");
    expect(summary.safe_to_activate).toBe(true);
  });

  it("verdict avec blocking failed → blocked", () => {
    const checklist = buildProfileMessagesContextFeedQaChecklist();
    const withFail = checklist.steps.map((s) =>
      s.id === "no_db_write" ? { ...s, status: "failed" as const } : s
    );
    const summary = buildProfileMessagesContextFeedQaVerdict(withFail);
    expect(summary.verdict).toBe("blocked");
    expect(summary.safe_to_activate).toBe(false);
  });

  it("getBlockingSteps retourne les étapes bloquantes uniquement", () => {
    const blocking = getProfileMessagesContextFeedBlockingSteps();
    expect(blocking.length).toBeGreaterThan(0);
    expect(blocking.every((s) => s.severity === "blocking")).toBe(true);
  });

  it("summarize retourne un message lisible avec PHASE 3.17", () => {
    const checklist = buildProfileMessagesContextFeedQaChecklist();
    const summary = buildProfileMessagesContextFeedQaVerdict(checklist.steps);
    const msg = summarizeProfileMessagesContextFeedQaVerdict(summary);
    expect(msg).toContain("PHASE 3.17");
    expect(msg).toContain("PENDING");
  });
});

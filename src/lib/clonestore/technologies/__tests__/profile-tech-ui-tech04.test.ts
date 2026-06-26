// TECH-04 — Profile Technologies UI Tests
// Static and logic tests only. No Supabase writes. No real API calls.
// No OpenAI. No Anthropic. No email sends.
//
// Critical corrections verified:
//   [FIX-1] CloneVoice: NOT "Actif" — status is disabled/partial
//   [FIX-2] CloneTrust: "autonomie graduelle" — NOT "zéro-confiance"
//   [FIX-3] ClonePolicy: active internal engine — NOT roadmap "Bientôt"

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();

function readSrc(relPath: string): string {
  return readFileSync(join(ROOT, "src/lib/clonestore/technologies", relPath), "utf-8");
}

function readPage(relPath: string): string {
  return readFileSync(join(ROOT, "src/app/profile", relPath), "utf-8");
}

function readDoc(relPath: string): string {
  return readFileSync(join(ROOT, "docs", relPath), "utf-8");
}

// ── 1. File existence ─────────────────────────────────────────────────────────

describe("tech-04 — file existence", () => {
  it("profile-tech-ui.ts exists", () => {
    const content = readSrc("profile-tech-ui.ts");
    expect(content.length).toBeGreaterThan(500);
  });

  it("page.tsx has been updated (references profile-tech-ui)", () => {
    const page = readPage("technologies/page.tsx");
    expect(page).toContain("profile-tech-ui");
  });

  it("doc TECH_04 exists", () => {
    const content = readDoc("TECH_04_PROFILE_TECHNOLOGIES_UI.md");
    expect(content.length).toBeGreaterThan(300);
  });
});

// ── 2. Pure module — section structure ───────────────────────────────────────

import {
  buildProfileTechPageData,
  buildTechUISections,
  buildTechUICardData,
  getTechUIStatusVariant,
  getTechUIStatusLabel,
} from "../profile-tech-ui";
import { DEFAULT_GLOBAL_TECH_CONFIGS } from "../global-tech-defaults";

describe("tech-04 — section structure", () => {
  it("buildProfileTechPageData returns 4 sections", () => {
    const data = buildProfileTechPageData();
    expect(data.sections).toHaveLength(4);
  });

  it("covers all 13 technologies", () => {
    const data = buildProfileTechPageData();
    const total = data.sections.reduce((n, s) => n + s.cards.length, 0);
    expect(total).toBe(13);
    expect(data.total).toBe(13);
  });

  it("essential section has 4 techs", () => {
    const data = buildProfileTechPageData();
    const essential = data.sections.find((s) => s.id === "essential");
    expect(essential?.count).toBe(4);
    expect(essential?.cards).toHaveLength(4);
  });

  it("essential section contains cloneos, cloneadn, cloneguard, clonetrace", () => {
    const data = buildProfileTechPageData();
    const essential = data.sections.find((s) => s.id === "essential");
    const keys = essential?.cards.map((c) => c.key) ?? [];
    expect(keys).toContain("cloneos");
    expect(keys).toContain("cloneadn");
    expect(keys).toContain("cloneguard");
    expect(keys).toContain("clonetrace");
  });

  it("complementary section has 3 techs", () => {
    const data = buildProfileTechPageData();
    const comp = data.sections.find((s) => s.id === "complementary");
    expect(comp?.count).toBe(3);
  });

  it("complementary section contains clonechat, clonecontinuum, clonevoice", () => {
    const data = buildProfileTechPageData();
    const comp = data.sections.find((s) => s.id === "complementary");
    const keys = comp?.cards.map((c) => c.key) ?? [];
    expect(keys).toContain("clonechat");
    expect(keys).toContain("clonecontinuum");
    expect(keys).toContain("clonevoice");
  });

  it("development section has 5 techs", () => {
    const data = buildProfileTechPageData();
    const dev = data.sections.find((s) => s.id === "development");
    expect(dev?.count).toBe(5);
  });

  it("development section contains clonetrust, clonereview, clonesignals, clonelearn, clonebrief", () => {
    const data = buildProfileTechPageData();
    const dev = data.sections.find((s) => s.id === "development");
    const keys = dev?.cards.map((c) => c.key) ?? [];
    expect(keys).toContain("clonetrust");
    expect(keys).toContain("clonereview");
    expect(keys).toContain("clonesignals");
    expect(keys).toContain("clonelearn");
    expect(keys).toContain("clonebrief");
  });

  it("internal_engines section has 1 tech (clonepolicy)", () => {
    const data = buildProfileTechPageData();
    const internal = data.sections.find((s) => s.id === "internal_engines");
    expect(internal?.count).toBe(1);
    expect(internal?.cards[0]?.key).toBe("clonepolicy");
  });

  it("sections have titles and subtitles", () => {
    const data = buildProfileTechPageData();
    for (const section of data.sections) {
      expect(section.title.length).toBeGreaterThan(0);
      expect(section.subtitle.length).toBeGreaterThan(0);
    }
  });
});

// ── 3. [FIX-1] CloneVoice — NOT "Actif" ──────────────────────────────────────

describe("tech-04 — [FIX-1] CloneVoice is not active", () => {
  it("CloneVoice status_variant is not 'active'", () => {
    const data = buildProfileTechPageData();
    const voiceCard = data.sections.flatMap((s) => s.cards).find((c) => c.key === "clonevoice");
    expect(voiceCard).toBeDefined();
    expect(voiceCard?.status_variant).not.toBe("active");
  });

  it("CloneVoice status_label is not 'Actif'", () => {
    const data = buildProfileTechPageData();
    const voiceCard = data.sections.flatMap((s) => s.cards).find((c) => c.key === "clonevoice");
    expect(voiceCard?.status_label).not.toBe("Actif");
  });

  it("CloneVoice has no badge with label 'Actif'", () => {
    const data = buildProfileTechPageData();
    const voiceCard = data.sections.flatMap((s) => s.cards).find((c) => c.key === "clonevoice");
    const hasActif = voiceCard?.badges.some((b) => b.label === "Actif");
    expect(hasActif).toBe(false);
  });

  it("CloneVoice has no badge with variant 'active'", () => {
    const data = buildProfileTechPageData();
    const voiceCard = data.sections.flatMap((s) => s.cards).find((c) => c.key === "clonevoice");
    const hasActiveVariant = voiceCard?.badges.some((b) => b.variant === "active");
    expect(hasActiveVariant).toBe(false);
  });

  it("CloneVoice readiness_score is below 25 (matches TECH-01 audit)", () => {
    const data = buildProfileTechPageData();
    const voiceCard = data.sections.flatMap((s) => s.cards).find((c) => c.key === "clonevoice");
    expect(voiceCard?.readiness_score).toBeLessThan(25);
  });

  it("getTechUIStatusVariant returns disabled for CloneVoice", () => {
    const config = DEFAULT_GLOBAL_TECH_CONFIGS.clonevoice;
    const variant = getTechUIStatusVariant(config);
    // CloneVoice has mode=disabled — should not be "active"
    expect(variant).not.toBe("active");
  });
});

// ── 4. [FIX-2] CloneTrust — autonomie graduelle, not zero-trust ───────────────

describe("tech-04 — [FIX-2] CloneTrust autonomie graduelle", () => {
  it("CloneTrust card roadmap_note does not contain zéro-confiance", () => {
    const data = buildProfileTechPageData();
    const trustCard = data.sections.flatMap((s) => s.cards).find((c) => c.key === "clonetrust");
    const text = `${trustCard?.impact ?? ""} ${trustCard?.roadmap_note ?? ""} ${trustCard?.description ?? ""}`;
    expect(text.toLowerCase()).not.toMatch(/zéro.confiance|zero.confiance|zero.trust/i);
  });

  it("CloneTrust card mentions autonomie or graduel", () => {
    const data = buildProfileTechPageData();
    const trustCard = data.sections.flatMap((s) => s.cards).find((c) => c.key === "clonetrust");
    const text = `${trustCard?.impact ?? ""} ${trustCard?.roadmap_note ?? ""}`.toLowerCase();
    const mentionsGradual = text.includes("autonomi") || text.includes("graduel") || text.includes("progressive");
    expect(mentionsGradual).toBe(true);
  });

  it("profile-tech-ui.ts does not contain zéro-confiance", () => {
    const content = readSrc("profile-tech-ui.ts");
    expect(content.toLowerCase()).not.toMatch(/zéro.confiance|zero.confiance/);
  });

  it("page.tsx does not contain zéro-confiance", () => {
    const page = readPage("technologies/page.tsx");
    expect(page.toLowerCase()).not.toMatch(/zéro.confiance|zero.confiance/);
  });
});

// ── 5. [FIX-3] ClonePolicy — active internal engine, not roadmap ──────────────

describe("tech-04 — [FIX-3] ClonePolicy is internal engine, not roadmap", () => {
  it("ClonePolicy is in internal_engines section", () => {
    const data = buildProfileTechPageData();
    const internal = data.sections.find((s) => s.id === "internal_engines");
    const policyCard = internal?.cards.find((c) => c.key === "clonepolicy");
    expect(policyCard).toBeDefined();
  });

  it("ClonePolicy is NOT in development section", () => {
    const data = buildProfileTechPageData();
    const dev = data.sections.find((s) => s.id === "development");
    const policyInDev = dev?.cards.find((c) => c.key === "clonepolicy");
    expect(policyInDev).toBeUndefined();
  });

  it("ClonePolicy card is_internal is true", () => {
    const data = buildProfileTechPageData();
    const allCards = data.sections.flatMap((s) => s.cards);
    const policyCard = allCards.find((c) => c.key === "clonepolicy");
    expect(policyCard?.is_internal).toBe(true);
  });

  it("ClonePolicy has no 'Bientôt' badge", () => {
    const data = buildProfileTechPageData();
    const allCards = data.sections.flatMap((s) => s.cards);
    const policyCard = allCards.find((c) => c.key === "clonepolicy");
    const hasBientot = policyCard?.badges.some((b) => b.label === "Bientôt");
    expect(hasBientot).toBe(false);
  });

  it("ClonePolicy readiness_score is high (active internal engine)", () => {
    const data = buildProfileTechPageData();
    const allCards = data.sections.flatMap((s) => s.cards);
    const policyCard = allCards.find((c) => c.key === "clonepolicy");
    // ClonePolicy is active/production per TECH-03, score should be high
    expect(policyCard?.readiness_score).toBeGreaterThan(60);
  });
});

// ── 6. Badge correctness ──────────────────────────────────────────────────────

describe("tech-04 — badge correctness", () => {
  it("active techs (cloneos, cloneadn, cloneguard, clonetrace) have Actif badge", () => {
    const data = buildProfileTechPageData();
    const allCards = data.sections.flatMap((s) => s.cards);
    const activeTechs = ["cloneos", "cloneadn", "cloneguard", "clonetrace"] as const;
    for (const key of activeTechs) {
      const card = allCards.find((c) => c.key === key);
      const hasActif = card?.badges.some((b) => b.label === "Actif");
      expect(hasActif).toBe(true);
    }
  });

  it("cloneguard and clonetrace have Protégé badge (platform_locked)", () => {
    const data = buildProfileTechPageData();
    const allCards = data.sections.flatMap((s) => s.cards);
    for (const key of ["cloneguard", "clonetrace"] as const) {
      const card = allCards.find((c) => c.key === key);
      const hasProtege = card?.badges.some((b) => b.label === "Protégé");
      expect(hasProtege).toBe(true);
    }
  });

  it("roadmap techs have Bientôt badge", () => {
    const data = buildProfileTechPageData();
    const allCards = data.sections.flatMap((s) => s.cards);
    const roadmapTechs = ["clonereview", "clonesignals", "clonelearn", "clonebrief"] as const;
    for (const key of roadmapTechs) {
      const card = allCards.find((c) => c.key === key);
      const hasBientot = card?.badges.some((b) => b.label === "Bientôt");
      expect(hasBientot).toBe(true);
    }
  });

  it("clonechat and clonevoice have Visible client badge", () => {
    const data = buildProfileTechPageData();
    const allCards = data.sections.flatMap((s) => s.cards);
    for (const key of ["clonechat", "clonevoice"] as const) {
      const card = allCards.find((c) => c.key === key);
      const hasVisible = card?.badges.some((b) => b.label === "Visible client");
      expect(hasVisible).toBe(true);
    }
  });

  it("core techs (cloneos, cloneadn) have Moteur interne badge", () => {
    const data = buildProfileTechPageData();
    const allCards = data.sections.flatMap((s) => s.cards);
    for (const key of ["cloneos", "cloneadn"] as const) {
      const card = allCards.find((c) => c.key === key);
      const hasInternal = card?.badges.some((b) => b.label === "Moteur interne");
      expect(hasInternal).toBe(true);
    }
  });
});

// ── 7. Card data completeness ─────────────────────────────────────────────────

describe("tech-04 — card data completeness", () => {
  it("all cards have non-empty display_name", () => {
    const data = buildProfileTechPageData();
    for (const card of data.sections.flatMap((s) => s.cards)) {
      expect(card.display_name.length).toBeGreaterThan(0);
    }
  });

  it("all cards have non-empty impact text", () => {
    const data = buildProfileTechPageData();
    for (const card of data.sections.flatMap((s) => s.cards)) {
      expect(card.impact.length).toBeGreaterThan(10);
    }
  });

  it("all cards have readiness_score 0–100", () => {
    const data = buildProfileTechPageData();
    for (const card of data.sections.flatMap((s) => s.cards)) {
      expect(card.readiness_score).toBeGreaterThanOrEqual(0);
      expect(card.readiness_score).toBeLessThanOrEqual(100);
    }
  });

  it("essential section has essential_ok and essential_score", () => {
    const data = buildProfileTechPageData();
    expect(typeof data.essential_ok).toBe("boolean");
    expect(data.essential_score).toBeGreaterThanOrEqual(0);
    expect(data.essential_score).toBeLessThanOrEqual(100);
  });

  it("essential_ok is true (all 4 core techs have score >= 60)", () => {
    const data = buildProfileTechPageData();
    expect(data.essential_ok).toBe(true);
  });

  it("essential_score is above 75 (reflects TECH-01 audit reality)", () => {
    const data = buildProfileTechPageData();
    expect(data.essential_score).toBeGreaterThan(75);
  });

  it("clonebrief is included (13th technology, new in TECH-03)", () => {
    const data = buildProfileTechPageData();
    const allCards = data.sections.flatMap((s) => s.cards);
    expect(allCards.find((c) => c.key === "clonebrief")).toBeDefined();
  });
});

// ── 8. Page file — content checks ────────────────────────────────────────────

describe("tech-04 — page.tsx content", () => {
  const page = readPage("technologies/page.tsx");

  it("page imports from profile-tech-ui", () => {
    expect(page).toContain("profile-tech-ui");
  });

  it("page does NOT contain hardcoded TECH_META (old wrong data)", () => {
    // The old page had TECH_META with wrong CloneVoice/CloneTrust data
    expect(page).not.toContain("const TECH_META");
  });

  it("page does NOT contain hardcoded ROADMAP_TECHNOLOGIES", () => {
    expect(page).not.toContain("const ROADMAP_TECHNOLOGIES");
  });

  it("page does NOT contain zéro-confiance", () => {
    expect(page.toLowerCase()).not.toMatch(/zéro.confiance|zero.confiance/);
  });

  it("page mentions all 13 technologies (via comment block)", () => {
    const techs = [
      "cloneos", "cloneadn", "cloneguard", "clonetrace",
      "clonechat", "clonecontinuum", "clonevoice",
      "clonepolicy", "clonetrust", "clonereview",
      "clonesignals", "clonelearn", "clonebrief",
    ];
    for (const tech of techs) {
      expect(page.toLowerCase()).toContain(tech);
    }
  });

  it("page contains Actif badge label (literal)", () => {
    expect(page).toContain("Actif");
  });

  it("page contains Protégé badge label (literal)", () => {
    expect(page).toContain("Protégé");
  });

  it("page contains Bientôt badge label (literal)", () => {
    expect(page).toContain("Bientôt");
  });

  it("page contains Visible client badge label (literal)", () => {
    expect(page).toContain("Visible client");
  });

  it("page contains Moteur interne badge label (literal)", () => {
    expect(page).toContain("Moteur interne");
  });

  it("page has responsive classes (sm: or md:)", () => {
    expect(page).toMatch(/\bsm:|md:/);
  });

  it("page does not call external APIs (no fetch)", () => {
    expect(page).not.toMatch(/fetch\s*\(/);
  });

  it("page does not set B48_PUBLIC_LAUNCH_ENABLED to true", () => {
    expect(page).not.toMatch(/B48_PUBLIC_LAUNCH_ENABLED\s*=\s*true/);
  });

  it("page does not auto-verify any proof", () => {
    expect(page).not.toMatch(/markProofVerified/);
  });
});

// ── 9. Doc checks ─────────────────────────────────────────────────────────────

describe("tech-04 — doc TECH_04 content", () => {
  let content: string;
  try {
    content = readDoc("TECH_04_PROFILE_TECHNOLOGIES_UI.md");
  } catch {
    content = "";
  }

  it("doc TECH_04 exists and is non-empty", () => {
    expect(content.length).toBeGreaterThan(300);
  });

  it("doc mentions the 3 corrections", () => {
    const mentionsFix1 = content.toLowerCase().includes("clonevoice") && content.toLowerCase().includes("actif");
    const mentionsFix2 = content.toLowerCase().includes("clonetrust") && (content.toLowerCase().includes("autonomie") || content.toLowerCase().includes("graduel"));
    const mentionsFix3 = content.toLowerCase().includes("clonepolicy") && content.toLowerCase().includes("interne");
    expect(mentionsFix1).toBe(true);
    expect(mentionsFix2).toBe(true);
    expect(mentionsFix3).toBe(true);
  });

  it("doc mentions profile-tech-ui", () => {
    expect(content).toContain("profile-tech-ui");
  });

  it("doc mentions TECH-05", () => {
    expect(content).toContain("TECH-05");
  });
});

// ── 10. Safety — no forbidden modifications ───────────────────────────────────

describe("tech-04 — no forbidden code modifications", () => {
  it("no OpenAI direct call in profile-tech-ui", () => {
    const content = readSrc("profile-tech-ui.ts");
    expect(content).not.toMatch(/openai\.com\/v1/i);
    expect(content).not.toMatch(/new OpenAI\(/i);
  });

  it("no Anthropic direct call in profile-tech-ui", () => {
    const content = readSrc("profile-tech-ui.ts");
    expect(content).not.toMatch(/anthropic\.com\/v1/i);
    expect(content).not.toMatch(/new Anthropic\(/i);
  });

  it("no Stripe live key in profile-tech-ui", () => {
    const content = readSrc("profile-tech-ui.ts");
    expect(content).not.toMatch(/sk_live_/i);
    expect(content).not.toMatch(/pk_live_/i);
  });

  it("no public_launch_ready set to true in page or profile-tech-ui", () => {
    const uiContent = readSrc("profile-tech-ui.ts");
    const pageContent = readPage("technologies/page.tsx");
    expect(uiContent).not.toMatch(/public_launch_ready\s*:\s*true/);
    expect(pageContent).not.toMatch(/public_launch_ready\s*:\s*true/);
  });

  it("page does not use buildAllB46TechnologyItems (replaced by TECH-04 layer)", () => {
    const page = readPage("technologies/page.tsx");
    expect(page).not.toContain("buildAllB46TechnologyItems");
  });
});

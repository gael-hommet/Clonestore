// TECH-04 — Profile Technologies Configuration UI — Tests
// Vérifie que la page /profile/technologies utilise GlobalTechConfig (TECH-03),
// corrige les erreurs factuelles (CloneVoice, CloneTrust, ClonePolicy),
// et affiche le centre de contrôle premium complet.
//
// Tests statiques sur fichiers source via readFileSync.
// Aucun appel Supabase, OpenAI, Anthropic, Stripe. Aucune preuve modifiée.

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();

function readPage(): string {
  return readFileSync(join(ROOT, "src/app/profile/technologies/page.tsx"), "utf-8");
}

function readDoc(name: string): string {
  return readFileSync(join(ROOT, "docs", name), "utf-8");
}

function readSrc(relPath: string): string {
  return readFileSync(join(ROOT, "src/lib/clonestore/technologies", relPath), "utf-8");
}

// ── 1. Page — existence et imports TECH-03 ────────────────────────────────────

describe("tech-04 config — page existence et imports TECH-03", () => {
  const page = readPage();

  it("1. /profile/technologies/page.tsx existe et est substantielle", () => {
    expect(page.length).toBeGreaterThan(1000);
  });

  it("2. page importe ou utilise DEFAULT_GLOBAL_TECH_CONFIG_LIST (TECH-03)", () => {
    const usesGlobal =
      page.includes("DEFAULT_GLOBAL_TECH_CONFIG_LIST") ||
      page.includes("DEFAULT_GLOBAL_TECH_CONFIGS") ||
      page.includes("buildGlobalTechnologyConfigSnapshot") ||
      page.includes("GlobalTechnologyConfig");
    expect(usesGlobal).toBe(true);
  });

  it("3. page mentionne les 15 technologies (projection publique canonique P20)", () => {
    const techs = [
      "cloneos", "cloneadn", "cloneguard", "clonetrace",
      "clonevoice", "clonechat", "clonepolicy", "clonecontinuum",
      "clonetrust", "clonereview", "clonesignals", "clonelearn", "clonebrief",
      "clonecall", "cloneroom",
    ];
    const allPresent = techs.every((t) => page.toLowerCase().includes(t));
    expect(allPresent).toBe(true);
  });
});

// ── 2. Page — 15 technologies mentionnées individuellement ────────────────────

describe("tech-04 config — mention individuelle de chaque technologie", () => {
  const page = readPage();

  it("4. page mentionne CloneOS",        () => { expect(page).toMatch(/cloneos/i); });
  it("5. page mentionne CloneADN",       () => { expect(page).toMatch(/cloneadn/i); });
  it("6. page mentionne CloneGuard",     () => { expect(page).toMatch(/cloneguard/i); });
  it("7. page mentionne CloneTrace",     () => { expect(page).toMatch(/clonetrace/i); });
  it("8. page mentionne CloneVoice",     () => { expect(page).toMatch(/clonevoice/i); });
  it("9. page mentionne CloneChat",      () => { expect(page).toMatch(/clonechat/i); });
  it("10. page mentionne ClonePolicy",   () => { expect(page).toMatch(/clonepolicy/i); });
  it("11. page mentionne CloneContinuum",() => { expect(page).toMatch(/clonecontinuum/i); });
  it("12. page mentionne CloneTrust",    () => { expect(page).toMatch(/clonetrust/i); });
  it("13. page mentionne CloneReview",   () => { expect(page).toMatch(/clonereview/i); });
  it("14. page mentionne CloneSignals",  () => { expect(page).toMatch(/clonesignals/i); });
  it("15. page mentionne CloneLearn",    () => { expect(page).toMatch(/clonelearn/i); });
  it("16. page mentionne CloneBrief",    () => { expect(page).toMatch(/clonebrief/i); });
  it("16b. page mentionne CloneCall (À venir, projection P20)",  () => { expect(page).toMatch(/clonecall/i); });
  it("16c. page mentionne CloneRoom (À venir, projection P20)",  () => { expect(page).toMatch(/cloneroom/i); });
});

// ── 3. Page — corrections factuelles ─────────────────────────────────────────

describe("tech-04 config — corrections factuelles", () => {
  const page = readPage();

  it("17. CloneVoice n'est pas présenté comme pipeline vocal actif", () => {
    // Ne pas trouver "CloneVoice" suivi de "actif" et "production" sur la même ligne
    expect(page).not.toMatch(/clonevoice.*pipeline.*actif.*production/i);
    expect(page).not.toMatch(/pipeline.*vocal.*actif/i);
  });

  it("18. CloneVoice mentionne non actif / pas activé en production", () => {
    // Le texte doit indiquer que CloneVoice n'est pas actif en production
    expect(page).toMatch(/non actif.*production|n.*activ.*production|CloneVoice.*prépare/i);
  });

  it("19. CloneTrust ne contient pas zero-trust ni zéro-confiance", () => {
    expect(page.toLowerCase()).not.toMatch(/zero.trust|zero.confiance|z.ro.confiance/);
  });

  it("20. CloneTrust mentionne autonomie graduelle", () => {
    expect(page).toMatch(/autonomie graduelle/i);
  });

  it("21. ClonePolicy est marqué comme interne ou moteur interne", () => {
    // Le badge "Interne" doit être présent (utilisé dans InternalEngineCard pour clonepolicy)
    expect(page).toMatch(/\bInterne\b/);
  });
});

// ── 4. Page — section Pierre ──────────────────────────────────────────────────

describe("tech-04 config — section Pierre et Employee Runtime", () => {
  const page = readPage();

  it("22. page mentionne Pierre", () => {
    expect(page).toMatch(/Pierre/);
  });

  it("23. page affiche les technologies requises par Pierre", () => {
    const hasPierreTechs = page.includes("Pierre") &&
      page.match(/Indispensable|requis.*Pierre|Pierre.*requis|contrat de runtime/i);
    expect(hasPierreTechs).toBeTruthy();
  });

  it("24. page distingue technologies indispensables et recommandées (hard/soft)", () => {
    const hasDistinction = page.match(/Indispensable/i) && page.match(/Recommand/i);
    expect(hasDistinction).toBeTruthy();
  });

  it("25. page importe PIERRE_EMPLOYEE_RUNTIME_CONTRACT", () => {
    expect(page).toContain("PIERRE_EMPLOYEE_RUNTIME_CONTRACT");
  });
});

// ── 5. Page — sections de contrôle ───────────────────────────────────────────

describe("tech-04 config — sections configurables / verrouillées / roadmap", () => {
  const page = readPage();

  it("26. page mentionne technologies verrouillées plateforme", () => {
    expect(page).toMatch(/verrouill|Verrouill/i);
  });

  it("27. page mentionne technologies configurables", () => {
    expect(page).toMatch(/[Cc]onfigurable/);
  });

  it("28. page mentionne roadmap", () => {
    expect(page).toMatch(/[Rr]oadmap/);
  });
});

// ── 6. Page — règles de sécurité ─────────────────────────────────────────────

describe("tech-04 config — sécurité et conformité", () => {
  const page = readPage();

  it("29. page ne dit pas 'public launch ready'", () => {
    expect(page).not.toMatch(/public.*launch.*ready|public_launch_ready\s*:\s*true/i);
  });

  it("30. page ne modifie pas B48_PUBLIC_LAUNCH_ENABLED", () => {
    expect(page).not.toMatch(/B48_PUBLIC_LAUNCH_ENABLED\s*=\s*true/);
  });

  it("31. page ne contient pas 'conformité garantie'", () => {
    expect(page).not.toMatch(/conformit.*garantie|garantit.*conformit/i);
  });

  it("32. page ne contient pas 'zéro erreur'", () => {
    expect(page).not.toMatch(/z.ro erreur/i);
  });

  it("33. page ne contient pas 'remplace avocat'", () => {
    expect(page).not.toMatch(/remplace.*avocat/i);
  });

  it("34. page ne contient pas 'paie officielle autonome'", () => {
    expect(page).not.toMatch(/paie officielle autonome/i);
  });

  it("35. page ne contient pas 'licenciement automatique'", () => {
    expect(page).not.toMatch(/licenciement automatique/i);
  });
});

// ── 7. Doc TECH_04_CONFIG ─────────────────────────────────────────────────────

describe("tech-04 config — documentation TECH_04_CONFIG", () => {
  let doc = "";
  try {
    doc = readDoc("TECH_04_PROFILE_TECHNOLOGIES_CONFIGURATION_UI.md");
  } catch {
    doc = "";
  }

  it("36. doc TECH_04_PROFILE_TECHNOLOGIES_CONFIGURATION_UI.md existe", () => {
    expect(doc.length).toBeGreaterThan(500);
  });

  it("37. doc mentionne GlobalTechConfig ou GlobalTechnologyConfig", () => {
    expect(doc).toMatch(/GlobalTechConfig|GlobalTechnologyConfig/);
  });

  it("38. doc mentionne correction CloneVoice (non actif / disabled)", () => {
    const mention =
      doc.match(/clonevoice/i) &&
      doc.match(/non actif|disabled|pas.*actif|not.*activ/i);
    expect(mention).toBeTruthy();
  });

  it("39. doc mentionne correction CloneTrust (autonomie graduelle)", () => {
    const mention =
      doc.match(/clonetrust/i) &&
      doc.match(/autonomie.*graduelle|gradual.*autonomy/i);
    expect(mention).toBeTruthy();
  });

  it("40. doc mentionne ClonePolicy comme moteur interne", () => {
    const mention =
      doc.match(/clonepolicy/i) &&
      doc.match(/interne|internal/i);
    expect(mention).toBeTruthy();
  });

  it("41. doc mentionne TECH-05", () => {
    expect(doc).toContain("TECH-05");
  });
});

// ── 8. Appels interdits ───────────────────────────────────────────────────────

describe("tech-04 config — aucun appel externe interdit", () => {
  const page = readPage();

  it("42. pas d'appel OpenAI dans page.tsx", () => {
    expect(page).not.toMatch(/openai\.com\/v1/i);
    expect(page).not.toMatch(/new OpenAI\(/i);
  });

  it("43. pas d'appel Anthropic dans page.tsx", () => {
    expect(page).not.toMatch(/anthropic\.com\/v1/i);
    expect(page).not.toMatch(/new Anthropic\(/i);
  });

  it("44. pas de clé Stripe live dans page.tsx", () => {
    expect(page).not.toMatch(/sk_live_|pk_live_/i);
  });

  it("45. pas d'écriture Supabase dans page.tsx", () => {
    expect(page).not.toMatch(/supabase.*\.insert\(|supabase.*\.update\(|supabase.*\.upsert\(/);
  });

  it("46. pas de markProofVerified dans page.tsx", () => {
    expect(page).not.toMatch(/markProofVerified/);
  });
});

// ── 9. UI et compatibilité ────────────────────────────────────────────────────

describe("tech-04 config — UI responsive et compatibilité GO-LIVE 04", () => {
  const page = readPage();

  it("47. classes responsive présentes (sm: ou md:)", () => {
    expect(page).toMatch(/\bsm:|md:/);
  });

  it("48. page est compatible GO-LIVE 04 — badges littéraux présents", () => {
    // Ces chaînes littérales sont requises par les tests GO-LIVE 04
    expect(page).toContain("Actif");
    expect(page).toContain("Protégé");
    expect(page).toContain("Bientôt");
    expect(page).toContain("Visible client");
    expect(page).toContain("Moteur interne");
  });

  it("49. profile-tech-ui.ts exporte buildProfileTechPageData (couche TECH-03 intacte)", () => {
    const ui = readSrc("profile-tech-ui.ts");
    expect(ui).toContain("buildProfileTechPageData");
    expect(ui).toContain("TechUIPageData");
  });

  it("50. page importe depuis profile-tech-ui (couche TECH-04)", () => {
    expect(page).toContain("profile-tech-ui");
  });
});

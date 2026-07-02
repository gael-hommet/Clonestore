import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Non-régression : la homepage et les pages publiques ne doivent PAS être
// redessinées. Seules des cibles invisibles (data-tour-id) et le montage global
// du provider sont autorisés. On vérifie au niveau de la source.

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf-8");

const page = read("src/app/page.tsx");
const layout = read("src/app/layout.tsx");

describe("Homepage — contenu inchangé (hors cible invisible unique)", () => {
  it("reste un client component avec ses sections d'origine", () => {
    expect(page.startsWith('"use client"')).toBe(true);
    for (const id of ["overview", "employees", "technologies", "cockpit", "trust"]) {
      expect(page).toContain(`id="${id}"`);
    }
  });

  it("conserve les textes et CTA commerciaux clés", () => {
    expect(page).toContain("CloneStore installe des employés IA spécialisés");
    expect(page).toContain("449 € HT");
    expect(page).toContain("Voir la démo Pierre");
    expect(page).toContain("Découvrir les employés");
    expect(page).toContain("Parler à CloneChat");
    expect(page).toContain("scroll-mt-32 clone-home-screen");
    expect(page).toContain("clone-liquid-button");
  });

  it("ne monte AUCUN bouton/launcher de tour dans la homepage", () => {
    expect(page).not.toContain("GuidedTour");
    expect(page).not.toContain("useGuidedTour");
    expect(page).not.toContain("startTour");
  });

  it("porte UNE seule cible invisible (homepage-primary) — le reste vit sur ses pages", () => {
    const matches = page.match(/data-tour-id/g) ?? [];
    expect(matches.length).toBe(1);
    expect(page).toContain('data-tour-id="homepage-primary"');
    // Les anciennes cibles single-page ont été retirées de la homepage.
    for (const gone of ["store-entry", "pierre-entry", "client-space-entry"]) {
      expect(page).not.toContain(`data-tour-id="${gone}"`);
    }
    // ActionButton ne porte plus de prop de tour (revenu à sa forme d'origine).
    expect(page).not.toContain("dataTourId");
  });
});

describe("Layout racine — provider monté globalement, structure intacte", () => {
  it("monte GuidedTourProvider autour de {children}", () => {
    expect(layout).toContain("GuidedTourProvider");
    expect(layout).toContain("<GuidedTourProvider>{children}</GuidedTourProvider>");
  });

  it("conserve header, main et footer publics", () => {
    expect(layout).toContain("<SiteHeader />");
    expect(layout).toContain('className="cs-main"');
    expect(layout).toContain('className="cs-footer"');
  });
});

describe("Pages du parcours multi-page — cible invisible UNIQUE et chirurgicale", () => {
  const cases: Array<{ file: string; target: string; keepText: string }> = [
    { file: "src/app/agents/page.tsx", target: "boutique-entry", keepText: "Composez votre équipe" },
    { file: "src/app/agents/pierre/page.tsx", target: "pierre-page-entry", keepText: "cs-command-surface" },
    { file: "src/app/demo/pierre/page.tsx", target: "demo-entry", keepText: "demo-pierre-cockpit" },
    { file: "src/app/login/page.tsx", target: "client-space-entry", keepText: "Entrez dans" },
  ];

  for (const { file, target, keepText } of cases) {
    it(`${file} : exactement une cible ${target}, contenu conservé`, () => {
      const src = read(file);
      const matches = src.match(/data-tour-id/g) ?? [];
      expect(matches.length).toBe(1);
      expect(src).toContain(`data-tour-id="${target}"`);
      expect(src).toContain(keepText);
    });
  }

  it("CloneChat : cible portée par l'écran public de verrouillage (pas de dev CloneChat)", () => {
    const layoutSrc = read("src/app/assistant/layout.tsx");
    // Le flag de verrouillage serveur reste intact ; on ne débloque pas CloneChat.
    expect(layoutSrc).toContain("isCloneChatEnabled");
    expect(layoutSrc).toContain('dataTourId="clonechat-entry"');
    // La cible est passée à AccessLockScreen via un prop optionnel (invisible).
    const lock = read("src/components/site/AccessLockScreen.tsx");
    expect(lock).toContain("dataTourId?: string");
    expect(lock).toContain("data-tour-id={dataTourId}");
  });
});

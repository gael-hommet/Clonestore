// /demo — CLÔTURE : contrat de lecture, première mission, suite du parcours,
// trois issues réelles, CloneChat.
//
// Ces tests protègent la POSTURE COMMERCIALE autant que le code :
//   • la démo n'affirme jamais convenir à toutes les entreprises ;
//   • elle donne au visiteur la permission explicite de NE PAS réserver ;
//   • elle recommande un premier périmètre par le RISQUE, pas par l'ambition —
//     et déconseille nommément certaines situations ;
//   • elle répond à « il se passe quoi si j'avance ? » sans rien inventer ;
//   • elle offre une sortie « poser une question » qui n'oblige pas à acheter ;
//   • aucun CTA préexistant n'a disparu.

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf-8");

/**
 * Retire les commentaires avant d'appliquer les garde-fous de copie : ces fichiers
 * documentent explicitement ce qu'ils s'interdisent (« aucune activation instantanée
 * n'est promise »). Interdire le mot dans la documentation reviendrait à interdire
 * d'expliquer la règle. Le garde-fou vise ce qui est LIVRÉ au visiteur.
 */
const copyOnly = (rel: string) =>
  read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const EXPERIENCE = "src/components/demo/DemoExperience.tsx";
const CONVERSION = "src/components/demo/DemoConversion.tsx";
const FIRST_MISSION = "src/components/demo/decision/FirstMission.tsx";
const AFTER = "src/components/demo/decision/AfterReservation.tsx";
const ACT1 = "src/components/demo/acts/Act1Opening.tsx";
const CONTENT = "src/lib/demo/presentation/content.ts";
const MODEL = "src/lib/demo/presentation/operating-model.ts";
const ANALYTICS = "src/lib/demo/presentation/analytics.ts";
const HEADER = "src/components/site/site-header.tsx";
const CSS = "src/app/demo/demo.css";

const NEW_FILES = [CONVERSION, FIRST_MISSION, AFTER];

// ── Contrat de lecture (Acte 1) ─────────────────────────────────────────────

describe("Clôture — le contrat de lecture est posé dès l'ouverture", () => {
  it("la démo n'affirme pas convenir à toutes les entreprises", () => {
    const c = read(CONTENT);
    expect(c).toContain(
      "Cette démonstration ne cherche pas à établir que CloneStore convient à toutes les entreprises.",
    );
    expect(c).toContain("mérite désormais un responsable");
  });

  it("l'Acte 1 annonce ce que le visiteur va juger — sans mur de texte", () => {
    const a = read(ACT1);
    expect(a).toContain("SCENE_CONTRACT");
    expect(a).toContain("demo-contract");
    // Le hook principal et le CTA d'origine sont préservés.
    expect(a).toContain("Ouvrez des postes");
    expect(a).toContain("Voir un employé IA travailler");
    expect(a).toContain("FounderAccessStatus");
  });

  it("les quatre critères de jugement sont les preuves réellement fournies", () => {
    const c = read(CONTENT);
    for (const item of [
      "Le travail réellement repris",
      "Ce qui reste humain",
      "Ce qui est tracé",
      "Le coût de continuer comme avant",
    ]) {
      expect(c).toContain(item);
    }
  });
});

// ── Première mission ────────────────────────────────────────────────────────

describe("Clôture — par quoi commencer", () => {
  it("recommande le travail le moins sensible, le plus répétitif, le plus mesurable", () => {
    const c = read(CONTENT);
    expect(c).toContain(
      "Commencez par le travail le moins sensible, le plus répétitif et le plus facile à mesurer.",
    );
  });

  it("qualifie honnêtement chaque situation (répétition, sensibilité, mesure, humain)", () => {
    const m = read(MODEL);
    expect(m).toContain("START_FIT");
    for (const key of ["candidate", "repetition", "sensitivity", "measure", "humanKeeps", "note"]) {
      expect(m).toContain(key);
    }
  });

  it("DÉCONSEILLE explicitement certaines situations en premier périmètre", () => {
    const m = read(MODEL);
    // La paie et l'action sensible ne sont jamais un premier périmètre.
    expect(m).toMatch(/payroll:\s*\{\s*candidate:\s*false/);
    expect(m).toMatch(/"sensitive-action":\s*\{\s*candidate:\s*false/);
    expect(m).toContain("firstMissionCandidates");
    expect(m).toContain("laterMissions");
    expect(read(CONTENT)).toContain("Ce que nous ne recommandons pas de confier en premier");
  });

  it("l'ordre affiché EST la règle annoncée : du moins sensible au plus engageant", async () => {
    const { firstMissionCandidates, START_FIT } = await import(
      "@/lib/demo/presentation/operating-model"
    );
    const ids = firstMissionCandidates().map((s) => s.id);
    // Le premier proposé (donc sélectionné par défaut) est le moins engageant.
    expect(ids[0]).toBe("questions");
    expect(START_FIT.questions.note).toContain("meilleur point de départ");
    // L'onboarding produit des documents → il vient après, pas en tête.
    expect(ids.indexOf("onboarding")).toBeGreaterThan(ids.indexOf("questions"));
    expect(ids).not.toContain("payroll");
    expect(ids).not.toContain("sensitive-action");
  });

  it("donne la permission explicite de NE PAS réserver", () => {
    const c = read(CONTENT);
    expect(c).toContain("Aucune de ces situations ne vous vient spontanément à l'esprit ?");
    expect(c).toContain("Alors ne réservez pas aujourd'hui.");
    expect(c).toContain("Si aucune première mission claire ne vous vient à l'esprit, ne réservez pas.");
  });

  it("le sélecteur de mission est accessible au clavier", () => {
    const f = read(FIRST_MISSION);
    expect(f).toContain('role="tablist"');
    expect(f).toContain('role="tab"');
    expect(f).toContain('role="tabpanel"');
    expect(f).toContain("aria-selected");
    expect(f).toContain("aria-controls");
    expect(f).toContain("tabIndex={on ? 0 : -1}");
  });
});

// ── Après la réservation ────────────────────────────────────────────────────

describe("Clôture — ce qui se passe si j'avance", () => {
  it("répond sans zone d'ombre, en sept étapes réelles", () => {
    const c = read(CONTENT);
    expect(c).toContain("afterSteps");
    expect(c).toContain("Aucun paiement n'est prélevé avant l'ouverture des accès.");
    expect(c).toContain("Vous choisissez un premier périmètre");
    expect(c).toContain("Vous définissez les permissions");
    expect(c).toContain("Vous jugez, puis vous décidez d'étendre");
  });

  it("ne promet ni activation instantanée, ni absence d'erreur", () => {
    const sources = [CONTENT, ...NEW_FILES].map(copyOnly).join("\n");
    expect(sources).not.toMatch(/activation instantanée|immédiatement opérationnel|zéro erreur/i);
    expect(sources).not.toMatch(/aucune erreur possible|sans aucun risque/i);
    // On interdit la PROMESSE de garantie — pas le mot « garantie » employé pour
    // la nier (« Aucune économie n'est garantie » est justement la posture tenue).
    expect(sources).not.toMatch(/(économies?|résultat|ROI|rentabilité)\s+garanti/i);
    expect(sources).not.toMatch(/nous garantissons|garantie de résultat/i);
    // Au contraire : l'erreur est traitée comme visible et rattrapable.
    expect(read(CONTENT)).toContain("Nous ne promettons pas l'absence d'erreur.");
  });

  it("n'invente aucune date ni aucun tarif (source de vérité unique)", () => {
    for (const f of NEW_FILES) {
      expect(read(f), f).not.toMatch(/\b449\b|\b499\b/);
      expect(read(f), f).not.toMatch(/\b2026\b/);
    }
  });
});

// ── Architecture de décision + CloneChat ────────────────────────────────────

describe("Clôture — trois issues réelles", () => {
  const conv = read(CONVERSION);

  it("aucun CTA préexistant n'a disparu", () => {
    expect(conv).toContain("/reserver/pierre");
    expect(conv).toContain("PIERRE_DEMO_ROUTE");
    expect(conv).toContain("/agents/pierre");
    expect(conv).toContain("Réserver Pierre");
    expect(conv).toContain("Voir Pierre en action");
    expect(conv).toContain("Découvrir Pierre");
  });

  it("le CTA CloneChat pointe sur la route canonique réelle (/assistant)", () => {
    expect(conv).toContain('const CLONECHAT_ROUTE = "/assistant"');
    // Même route que le SiteHeader : aucune route inventée.
    expect(read(HEADER)).toContain('href="/assistant"');
  });

  it("le lien CloneChat ne porte AUCUN paramètre mort (la page n'en lit aucun)", () => {
    expect(conv).not.toMatch(/\/assistant\?/);
    expect(read("src/app/assistant/page.tsx")).not.toContain("searchParams");
  });

  it("la formulation CloneChat est premium, jamais générique ni pressante", () => {
    const c = read(CONTENT);
    expect(c).toContain("Une question reste ouverte ?");
    expect(c).toContain("Demandez à CloneChat avant de décider.");
    expect(c).toContain("Poser ma question à CloneChat");
    expect(c).toContain("Réponse immédiate, sans rendez-vous.");
    const sources = [c, conv].join("\n");
    expect(sources).not.toMatch(/Besoin d'aide|Contactez-nous|chatbot|Discutez avec une IA/i);
    expect(sources).not.toMatch(/Ne partez pas sans|Dépêchez-vous|offre limitée/i);
  });

  it("CloneChat reste secondaire face à l'action principale", () => {
    // La réservation est le seul CTA "primary" de la clôture.
    expect(conv).toMatch(/href=\{RESERVATION_ROUTE\}\s+variant="primary"/);
    expect(conv).toMatch(/href=\{CLONECHAT_ROUTE\}[\s\S]{0,120}variant="secondary"/);
  });

  it("l'orchestrateur rend la clôture après la FAQ, sans rien retirer", () => {
    const exp = read(EXPERIENCE);
    const tags = ["<Act5Trust", "<Act6Cost", "<Act6Pierre", "<DemoFaq", "<DemoConversion"];
    let cursor = -1;
    for (const t of tags) {
      const i = exp.indexOf(t);
      expect(i, `${t} manquant`).toBeGreaterThan(cursor);
      cursor = i;
    }
    expect(exp).toContain("onCloneChat");
    expect(exp).toContain("onFirstMission");
  });
});

// ── Analytics : la décision, jamais son contenu ─────────────────────────────

describe("Clôture — mesure de la décision", () => {
  it("ajoute les deux événements sans retirer les existants", () => {
    const a = read(ANALYTICS);
    expect(a).toContain("clone_demo_clonechat_cta_clicked");
    expect(a).toContain("clone_demo_first_mission_selected");
    for (const e of ["clone_demo_viewed", "clone_demo_completed", "clone_demo_reservation_clicked"]) {
      expect(a).toContain(e);
    }
  });

  it("ne transmet aucune donnée d'entreprise ni question libre", () => {
    const exp = read(EXPERIENCE);
    expect(exp).toContain('{ scene: "decision", source: "demo" }');
    expect(exp).not.toMatch(/emitDemoEvent\([^)]*(question|message|email|cost|inputs)/i);
    // Le composant de clôture n'émet rien lui-même : il remonte des callbacks.
    expect(read(CONVERSION)).not.toContain("emitDemoEvent");
  });
});

// ── Style : aucune identité parallèle ───────────────────────────────────────

describe("Clôture — design system réutilisé", () => {
  it("réutilise les primitives et les classes de la démo", () => {
    const conv = read(CONVERSION);
    expect(conv).toContain("GlassSurface");
    expect(conv).toContain("Reveal");
    expect(conv).toContain("DemoCTALink");
    expect(conv).toContain("demo-section");
    expect(conv).toContain("demo-shell");
  });

  it("les classes de la clôture existent et respectent reduced-motion", () => {
    const css = read(CSS);
    for (const k of [
      ".demo-contract",
      ".demo-first__opt",
      ".demo-after__steps",
      ".demo-decision__paths",
      ".demo-chat-card",
    ]) {
      expect(css, k).toContain(k);
    }
    expect(css).toContain("prefers-reduced-motion");
  });

  it("aucun emoji, aucun cliché SaaS", () => {
    const sources = [read(CONTENT), ...NEW_FILES.map(read), read(ACT1)].join("\n");
    expect(sources).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}]/u);
    expect(sources).not.toMatch(/révolutionnaire|boostez|transformez votre entreprise|tout-en-un/i);
  });
});

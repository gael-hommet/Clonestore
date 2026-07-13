// /demo — ACTE 6 « Le coût de continuer comme avant » : tests d'intégration.
//
// Environnement node, lecture de source (aucun rendu React n'est possible dans ce
// repo : pas de jsdom). Ces tests garantissent :
//   • que la séquence est INSÉRÉE au bon endroit sans rien retirer ;
//   • que la posture commerciale est tenue (aucun CTA, aucune urgence, aucune
//     promesse d'économie garantie) ;
//   • que l'accessibilité réelle est câblée (tablist, aria-live, aria-valuetext) ;
//   • que le prix n'est jamais réécrit en dur.

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf-8");

const EXPERIENCE = "src/components/demo/DemoExperience.tsx";
const SHARED = "src/components/demo/shared.ts";
const CSS = "src/app/demo/demo.css";
const CONTENT = "src/lib/demo/presentation/content.ts";
const ANALYTICS = "src/lib/demo/presentation/analytics.ts";

const ACT_COST = "src/components/demo/acts/Act6Cost.tsx";
const COMPARATOR = "src/components/demo/cost/ScenarioComparator.tsx";
const CALCULATOR = "src/components/demo/cost/CapacityCalculator.tsx";
const REVEAL_HOOK = "src/components/demo/cost/useSequentialReveal.ts";
const COST_MODEL = "src/lib/demo/presentation/cost-model.ts";
const OPERATING_MODEL = "src/lib/demo/presentation/operating-model.ts";

const NEW_FILES = [ACT_COST, COMPARATOR, CALCULATOR, REVEAL_HOOK, COST_MODEL, OPERATING_MODEL];

// ── Placement : on ajoute, on ne retire rien ────────────────────────────────

describe("Acte 6 — placement dans la démo", () => {
  it("les six actes d'origine sont TOUJOURS rendus, dans l'ordre", () => {
    const exp = read(EXPERIENCE);
    const tags = [
      "<Act1Opening",
      "<Act2Difference",
      "<Act3System",
      "<Act4Result",
      "<Act5Trust",
      "<Act6Pierre",
    ];
    let cursor = -1;
    for (const tag of tags) {
      const idx = exp.indexOf(tag);
      expect(idx, `${tag} a disparu`).toBeGreaterThan(cursor);
      cursor = idx;
    }
    // La FAQ, la clôture et le tiroir sont préservés. La clôture a été enrichie
    // (première mission, suite du parcours, trois issues) — voir demo-decision.test.ts.
    expect(exp).toContain("<DemoFaq");
    expect(exp).toContain("<DemoConversion");
    expect(exp).toContain("<DemoDeepDive");
  });

  it("l'acte du coût est inséré APRÈS la confiance et AVANT Pierre", () => {
    const exp = read(EXPERIENCE);
    const trust = exp.indexOf("<Act5Trust");
    const cost = exp.indexOf("<Act6Cost");
    const pierre = exp.indexOf("<Act6Pierre");
    expect(cost).toBeGreaterThan(trust);
    expect(pierre).toBeGreaterThan(cost);
  });

  it("le rail de progression connaît la nouvelle scène, entre trust et pierre", () => {
    const shared = read(SHARED);
    const trust = shared.indexOf("demo-act-trust");
    const cost = shared.indexOf("demo-act-cost");
    const pierre = shared.indexOf("demo-act-pierre");
    expect(cost).toBeGreaterThan(trust);
    expect(pierre).toBeGreaterThan(cost);
    expect(shared).toContain('label: "Le coût"');
  });

  it("la section porte l'identifiant attendu par le rail", () => {
    const act = read(ACT_COST);
    expect(act).toContain('id="demo-act-cost"');
    expect(act).toContain('aria-label="Le coût de continuer comme avant"');
  });

  it("DEMO_SCENE_ORDER intègre « cost » sans casser l'ordre existant", () => {
    const c = read(CONTENT);
    const order = ["opening", "difference", "system", "result", "trust", "cost", "pierre"];
    let cursor = c.indexOf("DEMO_SCENE_ORDER");
    for (const key of order) {
      const idx = c.indexOf(`"${key}"`, cursor);
      expect(idx, `clé ${key} introuvable`).toBeGreaterThan(cursor);
      cursor = idx;
    }
  });

  it("les nouveaux fichiers existent et sont substantiels", () => {
    for (const f of NEW_FILES) {
      expect(read(f).length, f).toBeGreaterThan(800);
    }
  });
});

// ── Le titre et les phrases imposées ────────────────────────────────────────

describe("Acte 6 — la copie verrouillée", () => {
  const c = read(CONTENT);

  it("porte le titre « Le coût de continuer comme avant »", () => {
    expect(c).toContain("Le coût de continuer comme avant");
  });

  it("porte le titre du comparateur : même entreprise, même exigence, deux façons", () => {
    expect(c).toContain("Même entreprise. Même exigence.");
    expect(c).toContain("Deux façons d'exécuter.");
  });

  it("ne met jamais en cause la compétence des équipes", () => {
    expect(c).toContain("Le problème n'est pas la compétence de votre équipe RH.");
    expect(c).toContain("Le problème est tout ce qui l'empêche de l'utiliser pleinement.");
    expect(c).toContain("CloneStore ne rend pas vos équipes moins utiles.");
    expect(c).toContain("Il rend inutile le travail qui les empêche de l'être pleinement.");
  });

  it("tient la posture : ne l'achetez pas si la différence n'est pas évidente", () => {
    expect(c).toContain("Si la différence n'est pas évidente, ne l'achetez pas.");
    expect(c).toContain(
      "Un employé IA CloneStore n'est probablement pas nécessaire dans toutes les entreprises.",
    );
    expect(c).toContain("ne changez rien");
    expect(c).toContain("Votre décision ne changera pas ce que les employés CloneStore savent faire.");
    expect(c).toContain(
      "Elle changera seulement la quantité de travail que votre entreprise continuera d'exécuter manuellement.",
    );
  });

  it("présente le scénario par défaut comme un exemple, pas comme une vérité", () => {
    expect(c).toContain("Exemple illustratif. Remplacez chaque donnée par celle de votre entreprise.");
    expect(c).toContain("Hypothèses modifiables");
  });

  it("explique la méthode de calcul et ses limites", () => {
    expect(c).toContain("Comment ce calcul est construit");
    expect(c).toContain("Ce calcul n'est pas une promesse d'économie.");
    expect(c).toContain("Aucune suppression de poste n'en est déduite.");
  });

  it("ne réduit pas la séquence à Pierre : le modèle vaut pour les prochains employés IA", () => {
    expect(c).toContain("chaque employé IA reprend une capacité opérationnelle complète dans son métier");
    const m = read(OPERATING_MODEL);
    expect(m).toContain('id: "support"');
    expect(m).toContain('id: "finance"');
    expect(m).toContain("employee: null"); // aucun futur employé n'est nommé
  });
});

// ── Posture : on ne plaide pas ──────────────────────────────────────────────

describe("Acte 6 — aucune pression commerciale", () => {
  const sources = NEW_FILES.map(read).join("\n");

  it("l'acte ne contient AUCUN appel à l'action (la retenue est l'argument)", () => {
    const act = read(ACT_COST);
    expect(act).not.toContain("DemoCTALink");
    expect(act).not.toContain("DemoCTAButton");
    expect(act).not.toContain("/reserver");
    expect(act).not.toContain("/checkout");
    expect(act).not.toMatch(/Réserver|Activer Pierre|Acheter/);
  });

  it("aucune urgence fabriquée, aucune réduction, aucune promesse garantie", () => {
    expect(sources).not.toMatch(/plus que \d+ places/i);
    expect(sources).not.toMatch(/offre limitée|dernière chance|dépêchez/i);
    expect(sources).not.toMatch(/-\d+\s*%\s*(de\s*)?(remise|réduction)/i);
    expect(sources).not.toMatch(/économies? garanties?/i);
    expect(sources).not.toMatch(/ROI garanti|rentabilité garantie/i);
    expect(sources).not.toMatch(/remplace vos RH|remplacer votre équipe/i);
  });

  it("ne promet jamais la suppression d'un poste", () => {
    expect(sources).not.toMatch(/supprim\w+ un poste|licenciement automatique/i);
    // Au contraire : la nuance est explicite.
    expect(read(CALCULATOR)).toContain("Pas une suppression de poste");
  });

  it("aucun cliché SaaS générique, aucun emoji", () => {
    expect(sources).not.toMatch(/Révolutionnez|Boostez votre productivité|Libérez votre potentiel/i);
    expect(sources).not.toMatch(/zéro erreur|conformité garantie/i);
    // Aucun emoji dans la copie (les icônes sont des composants lucide).
    expect(sources).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}]/u);
  });
});

// ── Crédibilité : le prix vient de la source de vérité ──────────────────────

describe("Acte 6 — le prix n'est jamais réécrit", () => {
  it("le moteur lit le tarif canonique par pays, sans jamais coder 449 en dur", () => {
    const model = read(COST_MODEL);
    expect(model).toContain("pricingForCountry");
    expect(model).toContain("@/lib/clonestore/pricing/country-pricing");
    expect(model).not.toMatch(/\b449\b/);
    expect(model).not.toMatch(/\b44900\b/);
  });

  it("aucun composant n'écrit un prix en dur", () => {
    for (const f of [ACT_COST, COMPARATOR, CALCULATOR]) {
      expect(read(f), f).not.toMatch(/\b449\b|\b499\b/);
    }
    // Le tarif affiché provient du résultat du moteur.
    expect(read(CALCULATOR)).toContain("result.subscriptionDisplay");
  });

  it("le pays est explicite — aucune devise supposée en silence", () => {
    expect(read(CALCULATOR)).toContain("SUPPORTED_LAUNCH_COUNTRIES");
    expect(read(CALCULATOR)).toContain("Pays de référence");
  });

  it("aucune arithmétique monétaire dans les composants : tout passe par le moteur pur", () => {
    expect(read(CALCULATOR)).toContain("computeCapacity");
    expect(read(CALCULATOR)).toContain("React.useMemo");
  });
});

// ── Accessibilité réellement câblée ─────────────────────────────────────────

describe("Acte 6 — accessibilité", () => {
  const comparator = read(COMPARATOR);
  const calculator = read(CALCULATOR);

  it("le comparateur est un vrai tablist, navigable au clavier", () => {
    expect(comparator).toContain('role="tablist"');
    expect(comparator).toContain('role="tab"');
    expect(comparator).toContain('role="tabpanel"');
    expect(comparator).toContain("aria-selected");
    expect(comparator).toContain("aria-controls");
    expect(comparator).toContain("aria-labelledby");
    // Flèches + Origine/Fin.
    expect(comparator).toContain("ArrowDown");
    expect(comparator).toContain("ArrowUp");
    expect(comparator).toContain('"Home"');
    expect(comparator).toContain('"End"');
    expect(comparator).toContain("tabIndex={selected ? 0 : -1}");
  });

  it("les curseurs sont des input[type=range] natifs, avec un texte de valeur utile", () => {
    expect(calculator).toContain('type="range"');
    expect(calculator).toContain("aria-valuetext");
    expect(calculator).toContain("valueText(");
    // min / max / step réels → aria-valuemin/max/now gratuits.
    expect(calculator).toContain("min={field.min}");
    expect(calculator).toContain("max={field.max}");
    expect(calculator).toContain("step={field.step}");
  });

  it("chaque champ a un label explicite et une aide décrite", () => {
    expect(calculator).toContain("htmlFor={inputId}");
    expect(calculator).toContain("aria-describedby={hintId}");
    expect(calculator).toContain("<fieldset");
    expect(calculator).toContain("<legend");
  });

  it("les recalculs sont annoncés aux lecteurs d'écran", () => {
    expect(calculator).toContain('aria-live="polite"');
    expect(read(CSS)).toContain(".demo-cost-live");
  });

  it("les états ne sont pas transmis par la seule couleur", () => {
    // Le verdict porte un libellé texte, l'onglet actif porte aria-selected,
    // le pays actif porte aria-pressed.
    expect(calculator).toContain("verdict.label");
    expect(calculator).toContain("aria-pressed");
    // Les ruptures d'exécution sont nommées, pas seulement colorées.
    expect(comparator).toContain("MANUAL_LABEL");
    expect(comparator).toContain("GOVERNED_LABEL");
  });

  it("le focus reste visible partout", () => {
    const css = read(CSS);
    for (const rule of [
      ".demo-cost-tab:focus-visible",
      ".demo-cost-slider:focus-visible",
      ".demo-cost-country__btn:focus-visible",
      ".demo-cost-panel:focus-visible",
      ".demo-cost-method__summary:focus-visible",
    ]) {
      expect(css, rule).toContain(rule);
    }
  });
});

// ── Mouvement, responsive, design system ────────────────────────────────────

describe("Acte 6 — mouvement et responsive", () => {
  const css = read(CSS);

  it("respecte prefers-reduced-motion (CSS et logique d'accumulation)", () => {
    expect(css).toContain(".demo-cost-bar__fill");
    expect(read(REVEAL_HOOK)).toContain("reduce");
    expect(read(REVEAL_HOOK)).toContain("prefers-reduced-motion");
    expect(read(COMPARATOR)).toContain("useDemoReducedMotion");
  });

  it("le comparateur reste lisible sans JavaScript (tout est révélé par défaut)", () => {
    expect(read(REVEAL_HOOK)).toContain("React.useState(total)");
  });

  it("le mobile est une séquence verticale, pas un tableau rétréci", () => {
    expect(css).toContain(".demo-cost-split");
    expect(css).toMatch(/@media \(max-width: 900px\)[\s\S]*?\.demo-cost-split \{\s*grid-template-columns: 1fr;/);
  });

  it("réutilise le design system existant (aucune identité parallèle)", () => {
    const act = read(ACT_COST);
    expect(act).toContain("demo-section");
    expect(act).toContain("demo-shell");
    expect(act).toContain("demo-kicker");
    expect(act).toContain("demo-title");
    expect(act).toContain("demo-lede");
    expect(act).toContain("GlassSurface");
    expect(act).toContain("Reveal");
    // Aucune couleur hors palette dans la CSS de l'acte.
    const costCss = css.slice(css.indexOf("ACTE 6 — LE COÛT"));
    expect(costCss).toContain("var(--demo-violet)");
    expect(costCss).toContain("var(--cs-ink-1)");
  });

  it("n'utilise pas content-visibility sur une section haute (pas de saut de défilement)", () => {
    expect(read(ACT_COST)).not.toContain("demo-cv");
  });
});

// ── Analytics : ajout seul, aucune donnée personnelle ───────────────────────

describe("Acte 6 — mesure interne", () => {
  const a = read(ANALYTICS);

  it("ajoute ses événements sans retirer les dix-sept existants", () => {
    for (const e of [
      "clone_demo_viewed",
      "clone_demo_started",
      "clone_demo_trust_section_viewed",
      "clone_demo_completion_viewed",
      "clone_demo_completed",
    ]) {
      expect(a).toContain(e);
    }
    expect(a).toContain("clone_demo_cost_section_viewed");
    expect(a).toContain("clone_demo_cost_scenario_selected");
    expect(a).toContain("clone_demo_cost_calculator_adjusted");
  });

  it("n'envoie JAMAIS les données saisies par le visiteur", () => {
    const act = read(ACT_COST);
    const calc = read(CALCULATOR);
    // Les émissions ne transportent qu'une clé de scène.
    expect(act).toContain('{ scene: "cost" }');
    expect(act).not.toMatch(/emitDemoEvent\([^)]*(inputs|result|Minor|cost:)/);
    expect(calc).not.toContain("emitDemoEvent");
    expect(a).not.toMatch(/gtag|posthog|segment|mixpanel|plausible|amplitude/i);
  });
});

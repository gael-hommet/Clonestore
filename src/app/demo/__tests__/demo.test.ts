// /demo — Tests de contenu statique (node env, readFileSync — pas de rendu React).
// Vérifie : présence et ordre des 10 scènes E2.1 → E2.10, textes verrouillés,
// CTA vers /demo/pierre, copie commerciale dynamique, événements analytics,
// prefers-reduced-motion, et absence de copie commerciale interdite.

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf-8");

const PAGE = "src/app/demo/page.tsx";
const CSS = "src/app/demo/demo.css";
const CONTENT = "src/lib/demo/presentation/content.ts";
const COMMERCIAL = "src/lib/demo/presentation/commercial-state.ts";
const ANALYTICS = "src/lib/demo/presentation/analytics.ts";
const MOTION = "src/components/demo/primitives/motion.tsx";
const EXPERIENCE = "src/components/demo/DemoExperience.tsx";
const HEADER = "src/components/site/site-header.tsx";

const SCENES = [
  "src/components/demo/scenes/Scene01CloneCommand.tsx",
  "src/components/demo/scenes/Scene02Fragmentation.tsx",
  "src/components/demo/scenes/Scene03CategoryEvolution.tsx",
  "src/components/demo/scenes/Scene04CloneSystem.tsx",
  "src/components/demo/scenes/Scene05EnterpriseFootprint.tsx",
  "src/components/demo/scenes/Scene06OrganizationScale.tsx",
  "src/components/demo/scenes/Scene07TrustArchitecture.tsx",
  "src/components/demo/scenes/Scene08PierreHrContinuum.tsx",
  "src/components/demo/scenes/Scene09CloneOrganization.tsx",
  "src/components/demo/scenes/Scene10PierreTransition.tsx",
];

// ── Route /demo ────────────────────────────────────────────────────────────

describe("/demo — route et structure", () => {
  it("la page /demo existe et rend DemoExperience", () => {
    const page = read(PAGE);
    expect(page).toContain("DemoExperience");
    expect(page).toContain('import "./demo.css"');
  });

  it("/demo est distincte de /demo/pierre (ne reconstruit pas le cockpit)", () => {
    const page = read(PAGE);
    // La page /demo ne doit pas embarquer la logique du cockpit pierre.
    expect(page).not.toContain("SCENARIOS");
  });

  it("les 10 fichiers de scène existent et sont substantiels", () => {
    for (const f of SCENES) {
      expect(read(f).length).toBeGreaterThan(800);
    }
  });
});

// ── Ordre narratif E2.1 → E2.10 ──────────────────────────────────────────────

describe("/demo — ordre des dix scènes", () => {
  it("content.ts définit DEMO_SCENE_ORDER dans le bon ordre", () => {
    const c = read(CONTENT);
    const order = [
      "opening",
      "fragmentation",
      "category",
      "system",
      "footprint",
      "scale",
      "trust",
      "pierreScope",
      "organization",
      "completion",
    ];
    let cursor = c.indexOf("DEMO_SCENE_ORDER");
    expect(cursor).toBeGreaterThan(-1);
    for (const key of order) {
      const idx = c.indexOf(`"${key}"`, cursor);
      expect(idx, `clé ${key} introuvable dans l'ordre`).toBeGreaterThan(cursor);
      cursor = idx;
    }
  });

  it("l'orchestrateur rend Scene01 → Scene10 dans l'ordre", () => {
    const exp = read(EXPERIENCE);
    const tags = [
      "<Scene01CloneCommand",
      "<Scene02Fragmentation",
      "<Scene03CategoryEvolution",
      "<Scene04CloneSystem",
      "<Scene05EnterpriseFootprint",
      "<Scene06OrganizationScale",
      "<Scene07TrustArchitecture",
      "<Scene08PierreHrContinuum",
      "<Scene09CloneOrganization",
      "<Scene10PierreTransition",
    ];
    let cursor = -1;
    for (const tag of tags) {
      const idx = exp.indexOf(tag);
      expect(idx, `${tag} manquant`).toBeGreaterThan(cursor);
      cursor = idx;
    }
  });
});

// ── Textes verrouillés (un extrait exact par scène) ──────────────────────────

describe("/demo — textes verrouillés présents", () => {
  const locked: string[] = [
    "CLONESTORE — EMPLOYÉS IA POUR ENTREPRISES",
    "CloneStore lui apporte des employés IA.",
    "Découvrir CloneStore en 5 minutes",
    "Voir directement Pierre",
    "Prépare l'arrivée de notre nouvelle responsable commerciale à Lyon. Coordonne les documents, les validations et les communications nécessaires pour lundi.",
    "LE TRAVAIL NE MANQUE PAS.",
    "À mesure que l'entreprise grandit, le travail opérationnel augmente plus vite que la capacité des équipes à le suivre.",
    "UN EMPLOYÉ PREND EN CHARGE LE TRAVAIL.",
    "L'employé IA prend en charge la mission.",
    "TOUT UN SYSTÈME SE MET AU TRAVAIL.",
    "CloneOS organise le travail.",
    "Arrivée de Clara — état de la mission",
    "CHAQUE ENTREPRISE FONCTIONNE DIFFÉREMMENT.",
    "Il apprend à travailler comme elle.",
    "UNE MÊME CAPACITÉ.",
    "46 missions actives",
    "C'EST UNE ARCHITECTURE.",
    "Cette action ne peut pas être exécutée.",
    "IL PREND EN CHARGE LE TRAVAIL RH.",
    "CLONESTORE EST L'ORGANISATION.",
    "Ouverture du site de Genève",
    "REGARDEZ MAINTENANT PIERRE TRAVAILLER.",
    "Voir Pierre prendre en charge une mission",
    "Démonstration interactive. Aucun compte requis.",
  ];

  const content = read(CONTENT);
  for (const phrase of locked) {
    it(`texte verrouillé : « ${phrase.slice(0, 42)}… »`, () => {
      expect(content).toContain(phrase);
    });
  }

  it("inclut les 5 questions de la FAQ (§28)", () => {
    const c = read(CONTENT);
    expect(c).toContain("Pierre est-il adapté à toutes les tailles d'entreprise ?");
    expect(c).toContain("Combien de temps faut-il pour l'adapter ?");
    expect(c).toContain("Pierre peut-il agir sans validation ?");
    expect(c).toContain("Devons-nous remplacer tous nos outils ?");
    expect(c).toContain("La démonstration nécessite-t-elle un compte ?");
  });
});

// ── Transition vers /demo/pierre ─────────────────────────────────────────────

describe("/demo — transition vers /demo/pierre", () => {
  it("la route /demo/pierre est la cible du CTA principal", () => {
    expect(read(CONTENT)).toContain('"/demo/pierre"');
    expect(read(EXPERIENCE)).toContain("PIERRE_DEMO_ROUTE");
    expect(read(EXPERIENCE)).toContain("router.push(PIERRE_DEMO_ROUTE)");
  });

  it("la scène 10 utilise un lien réel (fallback sans JS) vers /demo/pierre", () => {
    const s10 = read(SCENES[9]);
    expect(s10).toContain("PIERRE_DEMO_ROUTE");
    expect(s10).toContain("DemoCTALink");
  });

  it("la scène 1 offre l'accès direct à Pierre", () => {
    expect(read(SCENES[0])).toContain("PIERRE_DEMO_ROUTE");
  });
});

// ── Copie commerciale dynamique (avant / après lancement) ────────────────────

describe("/demo — état commercial dynamique", () => {
  const c = read(COMMERCIAL);
  it("phrase avant lancement", () => {
    expect(c).toContain("Pierre ouvre ses accès le 22 juillet 2026.");
  });
  it("phrase après lancement", () => {
    expect(c).toContain("Pierre est disponible pour votre entreprise.");
  });
  it("CTA secondaire avant lancement (Réserver)", () => {
    expect(c).toContain("Réserver Pierre à 449 € HT/mois");
  });
  it("CTA secondaire après lancement (Activer)", () => {
    expect(c).toContain("Activer Pierre à 449 € HT/mois");
  });
  it("dates et tarif fondateur verrouillés", () => {
    expect(c).toContain("22 juillet 2026");
    expect(c).toContain("31 août 2026");
    expect(c).toContain("449 € HT");
    expect(c).toContain(
      "Le tarif fondateur de 449 € HT par mois est conservé sans limite de durée tant que l'abonnement reste actif.",
    );
  });
});

// ── Analytics interne (17 événements, aucun fournisseur externe) ─────────────

describe("/demo — événements analytics", () => {
  const a = read(ANALYTICS);
  const events = [
    "clone_demo_viewed",
    "clone_demo_started",
    "clone_demo_direct_pierre_clicked",
    "clone_demo_reservation_clicked",
    "clone_demo_problem_section_viewed",
    "clone_demo_category_section_viewed",
    "clone_demo_system_section_viewed",
    "clone_demo_footprint_section_viewed",
    "clone_demo_scale_section_viewed",
    "clone_demo_trust_section_viewed",
    "clone_demo_pierre_scope_section_viewed",
    "clone_demo_organization_section_viewed",
    "clone_demo_completion_viewed",
    "clone_demo_pierre_cta_visible",
    "clone_demo_pierre_cta_clicked",
    "clone_demo_direct_reservation_clicked",
    "clone_demo_completed",
  ];
  for (const e of events) {
    it(`définit l'événement ${e}`, () => {
      expect(a).toContain(e);
    });
  }

  it("n'introduit aucun fournisseur analytics externe", () => {
    expect(a).not.toMatch(/gtag|googletagmanager|posthog|segment|mixpanel|plausible|amplitude/i);
    expect(a).not.toMatch(/fetch\s*\(\s*["']https:\/\//);
  });

  it("chaque scène 2 → 10 câble son événement de section", () => {
    expect(read(SCENES[1])).toContain("problemSectionViewed");
    expect(read(SCENES[2])).toContain("categorySectionViewed");
    expect(read(SCENES[3])).toContain("systemSectionViewed");
    expect(read(SCENES[4])).toContain("footprintSectionViewed");
    expect(read(SCENES[5])).toContain("scaleSectionViewed");
    expect(read(SCENES[6])).toContain("trustSectionViewed");
    expect(read(SCENES[7])).toContain("pierreScopeSectionViewed");
    expect(read(SCENES[8])).toContain("organizationSectionViewed");
    expect(read(SCENES[9])).toContain("completionViewed");
  });
});

// ── LiquidGlass + Framer Motion (fondation + reduced motion) ─────────────────

describe("/demo — fondations visuelles et accessibilité", () => {
  it("s'appuie sur le système liquid-glass existant", () => {
    const panel = read("src/components/demo/primitives/LiquidGlassPanel.tsx");
    expect(panel).toContain("liquid-glass");
  });

  it("utilise Framer Motion (déjà installé)", () => {
    expect(read(MOTION)).toContain("framer-motion");
    expect(read(EXPERIENCE)).toContain("framer-motion");
  });

  it("respecte prefers-reduced-motion (CSS + hook)", () => {
    expect(read(CSS)).toContain("prefers-reduced-motion");
    expect(read(MOTION)).toContain("useReducedMotion");
    expect(read(EXPERIENCE)).toContain('reducedMotion="user"');
  });

  it("la version mobile a des media queries dédiées (pas un simple desktop rétréci)", () => {
    const css = read(CSS);
    expect(css).toContain("@media (max-width: 560px)");
    expect(css).toContain("@media (max-width: 900px)");
  });

  it("les scènes utilisent des classes responsive Tailwind", () => {
    const joined = SCENES.map(read).join("\n");
    expect(joined).toMatch(/\bsm:|\bmd:|\blg:|\bxl:/);
  });
});

// ── Navigation publique ──────────────────────────────────────────────────────

describe("/demo — lien public discret dans le SiteHeader", () => {
  it("le SiteHeader expose /demo avec le label Démo", () => {
    const h = read(HEADER);
    expect(h).toContain('href: "/demo"');
    expect(h).toContain('label: "Démo"');
  });
});

// ── Sécurité de copie : aucune revendication interdite ───────────────────────

describe("/demo — pas de copie commerciale interdite", () => {
  const sources = [PAGE, CONTENT, COMMERCIAL, ...SCENES].map(read).join("\n");

  it("aucun cliché SaaS générique interdit", () => {
    expect(sources).not.toMatch(/Révolutionnez votre entreprise/i);
    expect(sources).not.toMatch(/Libérez votre potentiel/i);
    expect(sources).not.toMatch(/Boostez votre productivité/i);
    expect(sources).not.toMatch(/Le futur est arrivé/i);
    expect(sources).not.toMatch(/Plateforme tout-en-un/i);
  });

  it("aucune revendication interdite (paie / avocat / DSN / licenciement)", () => {
    expect(sources).not.toMatch(/zéro erreur/i);
    expect(sources).not.toMatch(/conformité garantie/i);
    expect(sources).not.toMatch(/DSN autonome/i);
    expect(sources).not.toMatch(/paie officielle/i);
    expect(sources).not.toMatch(/licenciement automatique/i);
  });

  it("n'introduit aucun appel API externe ni clé live", () => {
    expect(sources).not.toMatch(/sk_live_/i);
    expect(sources).not.toMatch(/https:\/\/api\.openai\.com/i);
    expect(sources).not.toMatch(/https:\/\/api\.anthropic\.com/i);
    expect(sources).not.toMatch(/https:\/\/api\.stripe\.com/i);
  });
});

// /demo — Tests de contenu statique (node env, readFileSync — pas de rendu React).
//
// La présentation est structurée en 6 ACTES (Comprendre · La différence · Le
// système · Le résultat · La confiance · Passer à Pierre) avec une couche
// d'approfondissement facultative (tiroir). Ces tests protègent :
//   • les garde-fous réels (route, transition /demo/pierre, accessibilité,
//     reduced-motion, responsive, sécurité de copie, analytics, état commercial,
//     lien public) ;
//   • l'INTENTION produit du nouveau parcours (compréhension immédiate,
//     comparaison logiciel/assistant/employé IA, mission fil conducteur,
//     technologies expliquées dans l'action, résultat concret, gouvernance
//     humaine, transition vers Pierre, profondeur approfondissable).

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  DEMO_LAUNCH_ISO,
  DEMO_LAUNCH_LABEL,
  FOUNDER_CLOSE_ISO,
  getCommercialPhase,
  getFounderCommercialCopy,
} from "@/lib/demo/presentation/commercial-state";

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
const DEEPDIVE = "src/components/demo/DemoDeepDive.tsx";

const ACT1 = "src/components/demo/acts/Act1Opening.tsx";
const ACT2 = "src/components/demo/acts/Act2Difference.tsx";
const ACT3 = "src/components/demo/acts/Act3System.tsx";
const ACT4 = "src/components/demo/acts/Act4Result.tsx";
const ACT5 = "src/components/demo/acts/Act5Trust.tsx";
const ACT6 = "src/components/demo/acts/Act6Pierre.tsx";
const ACTS = [ACT1, ACT2, ACT3, ACT4, ACT5, ACT6];

// ── Route /demo ────────────────────────────────────────────────────────────

describe("/demo — route et structure", () => {
  it("la page /demo existe et rend le stage immersif à six scènes (DemoStage)", () => {
    // Refonte premium (2026-07-30) : la page rend désormais le stage six-scènes, plus l'ancien
    // DemoExperience à 12 sections (remplacement réel, cf. src/components/demo/stage/).
    const page = read(PAGE);
    expect(page).toContain("DemoStage");
    expect(page).not.toContain("<DemoExperience");
    expect(page).toContain('import "./demo.css"');
  });

  it("/demo est distincte de /demo/pierre (ne reconstruit pas le cockpit)", () => {
    expect(read(PAGE)).not.toContain("SCENARIOS");
  });

  it("les 6 fichiers d'acte existent et sont substantiels", () => {
    for (const f of ACTS) {
      expect(read(f).length).toBeGreaterThan(800);
    }
  });
});

// ── Parcours en 6 actes (ordre) ─────────────────────────────────────────────

describe("/demo — les six actes dans l'ordre", () => {
  it("content.ts définit DEMO_SCENE_ORDER en 6 actes, dans l'ordre", () => {
    const c = read(CONTENT);
    const order = ["opening", "difference", "system", "result", "trust", "pierre"];
    let cursor = c.indexOf("DEMO_SCENE_ORDER");
    expect(cursor).toBeGreaterThan(-1);
    for (const key of order) {
      const idx = c.indexOf(`"${key}"`, cursor);
      expect(idx, `clé ${key} introuvable dans l'ordre`).toBeGreaterThan(cursor);
      cursor = idx;
    }
  });

  it("l'orchestrateur rend Acte 1 → Acte 6 dans l'ordre", () => {
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
      expect(idx, `${tag} manquant`).toBeGreaterThan(cursor);
      cursor = idx;
    }
  });
});

// ── Intention produit : comprendre CloneStore sans explication orale ─────────

describe("/demo — Acte 1 : compréhension immédiate de CloneStore", () => {
  const a = read(ACT1);
  it("pose la catégorie (ouvrir un poste, pas ajouter un logiciel) dès l'ouverture", () => {
    expect(a).toMatch(/Ouvrez un poste|employé[s]? IA/i);
    expect(a).toContain("Voir un employé IA travailler");
  });
  it("propose l'accès direct à Pierre", () => {
    expect(a).toContain("PIERRE_DEMO_ROUTE");
  });
});

describe("/demo — Acte 2 : la différence logiciel / assistant / agent / employé IA", () => {
  const a = read(ACT2);
  it("distingue les quatre catégories explicitement", () => {
    expect(a).toContain("Un logiciel");
    expect(a).toMatch(/assistant/i);
    expect(a).toMatch(/agent IA/i);
    expect(a).toMatch(/employé IA/i);
  });
  it("oppose « fournir des fonctions » à « prendre en charge un périmètre »", () => {
    expect(a).toMatch(/périmètre/i);
    expect(a).toMatch(/ne prend pas en charge la mission/i);
  });
  it("fait circuler la même demande (fil conducteur Clara)", () => {
    expect(a).toContain("Clara");
    expect(a).toMatch(/prend en charge/i);
  });
});

describe("/demo — Acte 3 : les technologies expliquées dans l'action", () => {
  const a = read(ACT3);
  it("nomme chaque technologie avec un rôle", () => {
    for (const tech of ["CloneOS", "CloneADN", "CloneGuard", "CloneContinuum", "CloneTrace"]) {
      expect(a, `${tech} manquant`).toContain(tech);
    }
    expect(a).toMatch(/Organise|Adapte|Encadre|Trace/);
  });
  it("permet d'approfondir chaque technologie (profondeur facultative)", () => {
    expect(a).toContain("onDeepDive");
    expect(a).toMatch(/Détailler/);
  });
});

describe("/demo — Acte 4 : un résultat concret et visible", () => {
  const a = read(ACT4);
  it("montre de vrais livrables (document, brief, trace)", () => {
    expect(a).toContain("DocumentPreview");
    expect(a).toContain("CloneBriefCard");
    expect(a).toContain("TraceTimeline");
  });
  it("signale une information manquante sans l'inventer", () => {
    expect(a).toMatch(/information manquante/i);
  });
});

describe("/demo — Acte 5 : la gouvernance humaine", () => {
  const a = read(ACT5);
  it("traite les objections (permissions, refus, validation, trace)", () => {
    expect(a).toContain("ValidationCard");
    expect(a).toMatch(/permissions/i);
    expect(a).toMatch(/validation humaine/i);
  });
});

describe("/demo — Acte 6 : la transition vers Pierre", () => {
  const a = read(ACT6);
  it("offre un CTA réel vers /demo/pierre (fallback sans JS)", () => {
    expect(a).toContain("DemoCTALink");
    expect(a).toContain("PIERRE_DEMO_ROUTE");
    expect(a).toContain("Voir Pierre travailler");
  });
});

// ── Couche d'approfondissement (profondeur sans surcharge) ───────────────────

describe("/demo — tiroir d'approfondissement", () => {
  const d = read(DEEPDIVE);
  it("expose les sujets d'approfondissement clés", () => {
    for (const topic of ["cloneos", "empreinte", "cloneguard", "clonecontinuum", "clonetrace", "sizing", "frontier", "organization"]) {
      expect(d, `sujet ${topic} manquant`).toContain(topic);
    }
  });
  it("est un dialogue accessible et fermable", () => {
    expect(d).toContain('role="dialog"');
    expect(d).toContain('aria-modal="true"');
    expect(d).toContain('aria-label="Fermer"');
  });
});

// ── Transition vers /demo/pierre (garde-fou) ─────────────────────────────────

describe("/demo — transition vers /demo/pierre", () => {
  it("la route /demo/pierre est la cible du CTA principal", () => {
    expect(read(CONTENT)).toContain('"/demo/pierre"');
    expect(read(EXPERIENCE)).toContain("PIERRE_DEMO_ROUTE");
    expect(read(EXPERIENCE)).toContain("router.push(PIERRE_DEMO_ROUTE)");
  });
});

// ── Copie commerciale dynamique (avant / après lancement) ────────────────────

describe("/demo — état commercial dynamique", () => {
  const c = read(COMMERCIAL);
  it("phrase avant lancement", () => {
    // La copie est interpolée depuis la source de vérité (commercial-state) : on vérifie la valeur
    // compilée, pas le texte brut du fichier.
    expect(getFounderCommercialCopy("before_launch").availability).toBe(
      "Lancement officiel le 8 septembre 2026.",
    );
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
    expect(c).toContain("8 septembre 2026");
    expect(c).toContain("30 septembre 2026");
    expect(c).not.toContain("12 août 2026");
    expect(c).toContain("449 € HT");
    expect(c).toContain(
      "Le tarif fondateur de 449 € HT par mois est conservé sans limite de durée tant que l'abonnement reste actif.",
    );
  });
});

// ── Date de lancement canonique (non-régression : 8 septembre 2026) ──────────
// Protège le CONTRAT produit : la date de lancement officielle est le 8 septembre 2026,
// centralisée dans commercial-state (source de vérité unique). Aucune surface commerciale
// critique ne doit régresser vers l'ancienne date du 12 août 2026.

describe("lancement — date canonique verrouillée (8 septembre 2026)", () => {
  it("la date canonique ISO = 2026-09-08 (heure de Paris)", () => {
    expect(DEMO_LAUNCH_ISO).toBe("2026-09-08T00:00:00+02:00");
  });
  it("le libellé public = « 8 septembre 2026 »", () => {
    expect(DEMO_LAUNCH_LABEL).toBe("8 septembre 2026");
    expect(DEMO_LAUNCH_LABEL).toMatch(/septembre 2026/);
    expect(DEMO_LAUNCH_LABEL).not.toMatch(/ao[uû]t/);
  });
  it("la fenêtre fondateur ferme APRÈS le lancement officiel", () => {
    expect(new Date(FOUNDER_CLOSE_ISO).getTime()).toBeGreaterThan(new Date(DEMO_LAUNCH_ISO).getTime());
  });
  it("phase : réservations/pré-lancement avant le 8 septembre, lancé le jour J", () => {
    expect(getCommercialPhase(new Date("2026-09-01T12:00:00+02:00"))).toBe("before_launch");
    expect(getCommercialPhase(new Date("2026-09-08T00:00:00+02:00"))).toBe("launched");
    expect(getCommercialPhase(new Date("2026-09-20T12:00:00+02:00"))).toBe("launched");
  });
  it("la source de vérité /demo n'affiche plus le 12 août comme date de lancement", () => {
    const source = read(COMMERCIAL);
    expect(source).toContain("2026-09-08T00:00:00+02:00");
    expect(source).not.toMatch(/12 ao[uû]t 2026/);
    expect(source).not.toContain("2026-08-12");
  });
});

// ── FAQ + bibliothèque de copie préservée ────────────────────────────────────

describe("/demo — copie de référence préservée", () => {
  const c = read(CONTENT);
  it("inclut les 5 questions de la FAQ", () => {
    expect(c).toContain("Pierre est-il adapté à toutes les tailles d'entreprise ?");
    expect(c).toContain("Combien de temps faut-il pour l'adapter ?");
    expect(c).toContain("Pierre peut-il agir sans validation ?");
    expect(c).toContain("Devons-nous remplacer tous nos outils ?");
    expect(c).toContain("La démonstration nécessite-t-elle un compte ?");
  });
  it("conserve les repères de copie réutilisés par les actes", () => {
    expect(c).toContain("CLONESTORE — EMPLOYÉS IA POUR ENTREPRISES"); // Acte 1
    expect(c).toContain("Arrivée de Clara — état de la mission"); // Acte 4 (brief)
    expect(c).toContain("UN EMPLOYÉ PREND EN CHARGE LE TRAVAIL."); // Acte 2 (idée)
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

  it("les actes câblent leurs événements de section", () => {
    expect(read(ACT2)).toContain("categorySectionViewed");
    expect(read(ACT3)).toContain("systemSectionViewed");
    expect(read(ACT4)).toContain("footprintSectionViewed");
    expect(read(ACT5)).toContain("trustSectionViewed");
    expect(read(ACT6)).toContain("completionViewed");
  });
});

// ── LiquidGlass + Framer Motion (fondation + reduced motion) ─────────────────

describe("/demo — fondations visuelles et accessibilité", () => {
  it("s'appuie sur le système liquid-glass existant", () => {
    expect(read("src/components/demo/primitives/LiquidGlassPanel.tsx")).toContain("liquid-glass");
  });

  it("utilise Framer Motion (déjà installé)", () => {
    expect(read(MOTION)).toContain("framer-motion");
    expect(read(EXPERIENCE)).toContain("framer-motion");
  });

  it("respecte prefers-reduced-motion (CSS + hook + orchestrateur)", () => {
    expect(read(CSS)).toContain("prefers-reduced-motion");
    expect(read(MOTION)).toContain("useReducedMotion");
    expect(read(EXPERIENCE)).toContain('reducedMotion="user"');
  });

  it("la version mobile a des media queries dédiées (pas un simple desktop rétréci)", () => {
    const css = read(CSS);
    expect(css).toContain("@media (max-width: 560px)");
    expect(css).toContain("@media (max-width: 900px)");
  });

  it("les actes utilisent des classes responsive Tailwind", () => {
    const joined = ACTS.map(read).join("\n");
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
  const sources = [PAGE, CONTENT, COMMERCIAL, DEEPDIVE, ...ACTS].map(read).join("\n");

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

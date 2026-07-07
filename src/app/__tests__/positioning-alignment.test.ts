// Alignement du positionnement public CloneStore (employé IA, jamais « agent » /
// « assistant » comme catégorie commerciale ; prix 449 € HT/mois ; pas d'anciennes
// équivalences « heures économisées » faibles ; page de référence complète).
// Tests statiques (readFileSync) — protègent la cohérence vocabulaire + prix.

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf-8");

const REFERENCE = "src/app/comprendre-clonestore/page.tsx";
const COMMAND_CENTER = "src/app/agents/pierre/use/components/PierreCommandCenter.tsx";
const VALUE_PANEL = "src/app/agents/pierre/use/components/PierreValuePanel.tsx";
const CONSTANTS = "src/lib/pierre/constants.ts";
const CLAIMS = "src/lib/pierre/legal/pierre-commercial-claims.ts";
const DIAGNOSTIC = "src/app/diagnostic-rh/_components/DiagnosticForm.tsx";
const HOME = "src/app/page.tsx";

// Revendications absolues interdites (blocklist partagée).
const FORBIDDEN = [
  /zéro erreur/i,
  /conformité garantie/i,
  /remplace un avocat/i,
  /paie officielle/i,
  /licenciement automatique/i,
  /DSN autonome/i,
  /50\s*fois moins cher/i,
  /remplace\s+\d+\s+personnes/i,
];

describe("positionnement — page de référence /comprendre-clonestore", () => {
  it("la route existe", () => {
    expect(existsSync(join(ROOT, REFERENCE))).toBe(true);
  });

  const page = read(REFERENCE);

  it("pose la définition canonique (système d'exploitation d'employés IA)", () => {
    expect(page).toMatch(/système d.exploitation d.employés IA/i);
    expect(page).toMatch(/un périmètre de travail complet/i);
  });

  it("distingue les 4 catégories (logiciel / assistant / agent / employé IA)", () => {
    expect(page).toContain("Un logiciel");
    expect(page).toContain("Un assistant IA");
    expect(page).toContain("Un agent IA");
    expect(page).toContain("Un employé IA CloneStore");
  });

  it("couvre les sections de référence attendues", () => {
    for (const anchor of ["categorie", "mission", "empreinte", "technologies", "pierre", "gouvernance", "installation", "limites", "vision", "faq"]) {
      expect(page, `section ${anchor}`).toContain(`id="${anchor}"`);
    }
  });

  it("affiche le prix 449 € HT/mois via la source de vérité (EMPLOYEE_PRICE)", () => {
    expect(page).toContain("EMPLOYEE_PRICE");
  });

  it("ne contient aucune revendication absolue interdite", () => {
    for (const re of FORBIDDEN) expect(page).not.toMatch(re);
  });
});

describe("positionnement — Pierre présenté comme employé IA, jamais assistant (catégorie)", () => {
  it("le cockpit ne présente plus Pierre comme « assistant RH intelligent »", () => {
    const cc = read(COMMAND_CENTER);
    expect(cc).not.toContain("assistant RH intelligent");
    expect(cc).toMatch(/employé IA/i);
  });

  it("le label produit interne n'est plus « Assistant RH Automatisé »", () => {
    const c = read(CONSTANTS);
    expect(c).not.toContain("Assistant RH Automatisé");
    expect(c).toMatch(/PIERRE_PRODUCT_LABEL\s*=\s*"Employé IA/);
  });

  it("la déclaration de positionnement canonique parle d'employé IA", () => {
    const claims = read(CLAIMS);
    expect(claims).toMatch(/getPierrePositioningStatement[\s\S]{0,120}employé IA/i);
  });
});

describe("positionnement — prix cohérent 449 € HT (pas d'équivalence faible)", () => {
  it("le diagnostic affiche le prix de Pierre avec « HT »", () => {
    const d = read(DIAGNOSTIC);
    // Aucune mention du prix de Pierre en « 449 €/mois » sans HT.
    expect(d).not.toContain("Pierre 449 €/mois");
    expect(d).not.toContain("abonnement à 449 €/mois");
    expect(d).not.toContain("Voir Pierre — 449 €/mois");
    expect(d).toContain("449 € HT/mois");
  });

  it("le cockpit ne présente plus « heures économisées » comme valeur faible", () => {
    const v = read(VALUE_PANEL);
    expect(v).not.toContain("Heures économisées");
    expect(v).toMatch(/absorbée/i);
  });

  it("la home ne présente plus Pierre comme « poste automatisé »", () => {
    const h = read(HOME);
    expect(h).not.toContain("poste automatisé");
    expect(h).not.toContain("postes automatisés");
  });
});

// Normalise apostrophes (droites/typographiques) + espaces (retours à la ligne
// JSX) pour comparer un texte de pitch aux phrases obligatoires du fondateur.
const norm = (s: string) => s.replace(/[’']/g, "'").replace(/\s+/g, " ");

describe("pitch — section manifeste « C'est quoi CloneStore ? » sur /comprendre-clonestore", () => {
  const raw = read(REFERENCE);
  const src = norm(raw);

  it("contient la section d'ancrage #pitch-clonestore", () => {
    expect(raw).toContain('id="pitch-clonestore"');
  });

  it("affiche le titre du pitch", () => {
    expect(src).toContain(norm("C'est quoi CloneStore ?"));
  });

  const PHRASES = [
    "Un logiciel aide votre équipe à faire le travail. CloneStore fournit l'employé IA qui le prend en charge.",
    "Un agent IA exécute une action. Un employé IA assume un périmètre de travail.",
    "Pierre n'est pas un assistant RH. C'est un employé IA RH complet qui organise, produit, suit, relance, fait valider et conserve la trace.",
    "Pour une fraction du coût d'une équipe humaine équivalente, l'entreprise obtient une capacité opérationnelle continue, rapide, gouvernée et traçable.",
    "Pierre est le premier employé. Les RH sont le premier périmètre. CloneStore construit l'infrastructure des futures organisations augmentées par des employés IA.",
  ];
  for (const p of PHRASES) {
    it(`contient la phrase exacte : « ${p.slice(0, 46)}… »`, () => {
      expect(src).toContain(norm(p));
    });
  }

  it("contient la question de clôture (phrase 6)", () => {
    expect(src).toContain(norm("La vraie question n'est pas"));
    expect(src).toContain(
      norm("combien de temps elle acceptera encore de payer beaucoup plus cher pour avancer beaucoup plus lentement"),
    );
  });

  it("porte les CTA vers /demo/pierre et /reserver/pierre", () => {
    expect(raw).toContain('href="/demo/pierre"');
    expect(raw).toContain('href="/reserver/pierre"');
  });

  it("affiche le prix 449 € HT", () => {
    expect(raw).toContain("449 € HT");
  });

  it("ne réintroduit aucun ancien positionnement", () => {
    expect(src).not.toContain(norm("assistant RH intelligent"));
    expect(src).not.toContain(norm("boutique d'agents"));
    expect(raw).not.toContain("Assistant RH Automatisé");
  });

  it("le pitch ne contient aucune revendication absolue interdite", () => {
    const start = raw.indexOf('id="pitch-clonestore"');
    const end = raw.indexOf('id="categorie"');
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const pitch = raw.slice(start, end);
    for (const re of FORBIDDEN) expect(pitch).not.toMatch(re);
  });
});

describe("positionnement — Pierre = employé IA autonome sous gouvernance (pas un assistant validé partout)", () => {
  const raw = read(REFERENCE);
  const src = norm(raw);
  const CLAIMS_SRC = read(CLAIMS);

  it("expose une section Autonomie et une section Modèles d'organisation", () => {
    expect(raw).toContain('id="autonomie"');
    expect(raw).toContain('id="modeles"');
  });

  it("présente les trois modes d'autonomie : brouillon, validation, autonome", () => {
    expect(raw).toContain('t: "Brouillon"');
    expect(raw).toContain('t: "Validation"');
    expect(raw).toContain('t: "Autonome"');
    expect(src).toContain(norm("brouillon, validation ou autonomie encadrée"));
  });

  it("affirme que Pierre exécute réellement le travail RH opérationnel autorisé", () => {
    expect(src).toContain(norm("exécute réellement le travail RH opérationnel autorisé"));
  });

  it("explique que l'humain ne valide pas tout (validation ciblée sur le sensible)", () => {
    expect(src).toContain(norm("L'humain ne valide pas tout"));
    expect(src).toMatch(/sensible[^.]{0,60}(engageant|ambigu|hors périmètre)/i);
  });

  it("ne présente PAS Pierre comme assistant/préparateur seulement", () => {
    for (const weak of [
      "assiste seulement",
      "prépare seulement",
      "ne fait rien à la place",
      "il ne fait rien à votre place",
      "Pierre prépare et vous sollicite",
      "l'humain doit valider toutes les actions",
      "l'humain valide toutes les actions",
    ]) {
      expect(src, `ne doit pas contenir « ${weak} »`).not.toContain(norm(weak));
    }
  });

  it("mentionne les messageries, documents, workflows, signatures et outils connectés", () => {
    for (const term of ["messageries", "documents", "workflows", "signatures", "outils connectés"]) {
      expect(src, `terme ${term}`).toContain(norm(term));
    }
    expect(src).toContain(norm("circuits de signature encadrés"));
    expect(src).toContain(norm("il ne signe jamais à la place d'un humain"));
  });

  it("explique les trois modèles d'organisation", () => {
    expect(raw).toContain('t: "Équipe IA seule"');
    expect(raw).toContain('t: "Équipe hybride"');
    expect(raw).toContain('t: "RH humain augmenté"');
  });

  it("le statement de limite reste légalement sûr (mentionne avocat, ne survend pas)", () => {
    // getPierreLegalLimitStatement, rendu sur la page + FAQ.
    expect(CLAIMS_SRC).toMatch(/getPierreLegalLimitStatement[\s\S]{0,700}avocat/);
    expect(CLAIMS_SRC).not.toMatch(/getPierreLegalLimitStatement[\s\S]{0,700}(juridiquement autonome|garantit la conformité)/);
  });

  it("ne contient aucune revendication substring interdite (isPierreClaimSafe)", () => {
    for (const forbidden of [
      "Pierre remplace votre service juridique",
      "Pierre garantit la conformité légale de vos documents RH",
      "Pierre remplace votre logiciel de paie",
      "Pierre prend les décisions RH à votre place",
      "Pierre garantit zéro erreur",
      "Pierre envoie automatiquement vos communications RH",
      "Pierre remplace un expert-comptable",
      "Pierre peut licencier un salarié automatiquement",
      "Pierre est juridiquement autonome",
      "Pierre soumet votre DSN",
    ]) {
      expect(raw, `revendication interdite: ${forbidden}`).not.toContain(forbidden);
    }
  });
});

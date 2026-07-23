// C1.9 — GARDE ANTI-DURCISSEMENT.
//
// Échoue si la remédiation retombe dans le travers qu'elle corrige : un dictionnaire,
// un switch de réponses, une explosion de regex conversationnelles, ou des formulations
// de test recopiées dans le code produit.
//
// Le budget est EXPLICITE et petit. Le dépasser doit être une décision consciente, pas
// une dérive.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { writeFileSync } from "fs";

const C19_DIR = "c:/Users/homme/clonestore/src/lib/clonechat/intelligence/c1-9";
const OUT = "c:/Users/homme/clonestore/.c1-9-proofs";

/**
 * Budgets assumés pour la couche C1.9.
 *
 * `maxRegexLength` est la contrainte qui compte vraiment. Le défaut de l'ancienne couche
 * n'était pas le NOMBRE de regex mais leur NATURE : des alternances de 1 900 à 5 000
 * caractères énumérant des formulations d'utilisateur. Un détecteur technique précis
 * (montant, revendication d'exécution, nature d'entité) tient en moins de 200 caractères.
 * Cette borne rend un routeur de sujet déguisé structurellement impossible à cacher.
 */
const BUDGET = {
  /**
   * Détection technique uniquement : tokenisation, montants, grandeurs, marqueurs de
   * citation, revendication d'exécution, nature d'entité, catégories jamais mémorisables.
   * Aucun regex de sujet produit.
   *
   * Ce compteur n'est PAS la vraie défense — `maxRegexLength` l'est. Un routeur de sujet
   * déguisé se trahit par la TAILLE de ses alternances (l'ancienne couche montait à
   * 5 000 caractères), pas par leur nombre. Le plafond reste néanmoins bas pour que toute
   * hausse soit une décision consciente : chaque ajout doit être un détecteur nommé.
   */
  maxRegexLiterals: 56,
  /** Aucun regex ne doit énumérer des formulations d'utilisateur. */
  maxRegexLength: 200,
  /**
   * TAILLE CUMULÉE de tous les littéraux de regex de la couche.
   *
   * Ajoutée en même temps que la hausse de `maxRegexLiterals` de 40 à 56, et pour la
   * compenser : un compteur seul peut être contourné en découpant une alternance en dix
   * petites ; la somme, elle, ne se découpe pas. C'est la mesure qui distingue vraiment un
   * ensemble de détecteurs techniques d'une énumération de formulations. Référence héritée :
   * 1 207 regex dont une seule de 5 000 caractères.
   *
   * La hausse du compteur est assumée : le contrat de pertinence (§4) ajoute quatorze
   * détecteurs NOMMÉS — six sujets périphériques, trois signaux d'offre, une découpe en
   * phrases, une tokenisation, trois nettoyages. Aucun ne vise une question ; chacun sert
   * à la fois à LIRE la demande et à CONTRÔLER la réponse, ce qui rend structurellement
   * impossible d'y cacher une règle par question ratée.
   */
  maxTotalRegexChars: 2400,
  /** Aucun fichier ne doit à lui seul devenir un routeur de sujet. */
  maxRegexLiteralsPerFile: 20,
  /** Prose destinée à l'utilisateur : seulement les messages de mode dégradé et de blocage. */
  maxUserFacingProse: 4,
  /** Aucun `case "..."` ne doit sélectionner une réponse. */
  maxSwitchCaseArms: 0,
} as const;

function productionFiles(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) {
      if (e !== "__tests__") out.push(...productionFiles(p));
    } else if (e.endsWith(".ts")) out.push(p);
  }
  return out;
}

/** Retire commentaires de ligne et de bloc, pour ne mesurer que le code réel. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const REGEX_LITERAL = /(^|[^A-Za-z0-9_/*)\]])\/(?![/*])(?:\\.|\[(?:\\.|[^\]])*\]|[^/\n\\])+\/[gimsuyd]*/g;

describe("C1.9 anti-hardcoding", () => {
  const files = productionFiles(C19_DIR);

  it("has production files to measure", () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it("stays within the declared regex / prose / switch budget", () => {
    let regex = 0, prose = 0, cases = 0, longest = 0, totalRegexChars = 0, worstFileRegex = 0;
    let longestSample = "", worstFile = "";
    const perFile: Array<{ file: string; regex: number; prose: number; cases: number; longestRegex: number }> = [];

    for (const f of files) {
      const code = stripComments(readFileSync(f, "utf8"));
      const found = code.match(REGEX_LITERAL) ?? [];
      const r = found.length;
      if (r > worstFileRegex) { worstFileRegex = r; worstFile = f; }
      let fileLongest = 0;
      for (const lit of found) {
        totalRegexChars += lit.length;
        if (lit.length > fileLongest) fileLongest = lit.length;
        if (lit.length > longest) { longest = lit.length; longestSample = lit.slice(0, 80); }
      }
      const c = (code.match(/^\s*case\s+["'`]/gm) ?? []).length;
      // Prose utilisateur : littéral > 120 caractères, avec espaces et accents français.
      let p = 0;
      for (const lit of code.match(/`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"/g) ?? []) {
        const body = lit.slice(1, -1);
        if (body.length > 120 && /\s/.test(body) && /[éèêàçùôûîï]/i.test(body)) p++;
      }
      regex += r; prose += p; cases += c;
      perFile.push({ file: f.replace(/\\/g, "/").split("/c1-9/")[1], regex: r, prose: p, cases: c, longestRegex: fileLongest });
    }

    writeFileSync(`${OUT}/C1_9_ANTI_HARDCODING_RESULTS.json`, JSON.stringify({
      artifact: "C1_9_ANTI_HARDCODING_RESULTS",
      generatedAt: "2026-07-22",
      scope: "src/lib/clonechat/intelligence/c1-9/** (hors __tests__), commentaires retirés",
      budget: BUDGET,
      measured: { regexLiterals: regex, totalRegexChars, worstFileRegexLiterals: worstFileRegex, longestRegexChars: longest, longestRegexSample: longestSample, userFacingProse: prose, switchCaseArms: cases, files: files.length },
      perFile,
      comparisonWithLegacy: {
        legacyScope: "src/lib/clonechat/** (hors __tests__)",
        legacyRegexLiterals: 1207,
        legacyUserFacingProse: 724,
        legacyProseCharacters: 400850,
        legacySwitchCaseArms: 174,
        legacyLongestRegexChars: 5000,
        note: "L'alternance support_request de intent-taxonomy.ts:73 fait ~5 000 caractères sur une ligne ; purchase_pierre ~2 600. La borne maxRegexLength les rejetterait toutes deux.",
      },
    }, null, 2));

    expect(regex, `regex literals ${regex} > budget ${BUDGET.maxRegexLiterals}`).toBeLessThanOrEqual(BUDGET.maxRegexLiterals);
    expect(totalRegexChars, `cumulated regex chars ${totalRegexChars} > budget ${BUDGET.maxTotalRegexChars} — une somme qui enfle signale une énumération de formulations, pas des détecteurs`).toBeLessThanOrEqual(BUDGET.maxTotalRegexChars);
    expect(worstFileRegex, `${worstFile} concentrates ${worstFileRegex} regex literals > ${BUDGET.maxRegexLiteralsPerFile} — un fichier qui en concentre autant devient un routeur de sujet`).toBeLessThanOrEqual(BUDGET.maxRegexLiteralsPerFile);
    expect(longest, `longest regex ${longest} chars > budget ${BUDGET.maxRegexLength} — un regex de cette taille énumère des formulations, il ne détecte pas : ${longestSample}`).toBeLessThanOrEqual(BUDGET.maxRegexLength);
    expect(prose, `user-facing prose blocks ${prose} > budget ${BUDGET.maxUserFacingProse}`).toBeLessThanOrEqual(BUDGET.maxUserFacingProse);
    expect(cases, `switch case arms ${cases} > budget ${BUDGET.maxSwitchCaseArms}`).toBeLessThanOrEqual(BUDGET.maxSwitchCaseArms);
  });

  it("contains no intent-to-paragraph mapping", () => {
    for (const f of files) {
      const code = stripComments(readFileSync(f, "utf8"));
      // Un switch dont les bras renvoient de la prose est exactement le motif proscrit.
      expect(code, `${f} contains a switch on an intent-like value`).not.toMatch(/switch\s*\(\s*\w*(?:intent|category|kind|situation)\w*\s*\)/i);
    }
  });

  it("never imports a benchmark or test corpus into production code", () => {
    for (const f of files) {
      const code = readFileSync(f, "utf8");
      expect(code, `${f} imports from __tests__`).not.toMatch(/from\s+["'][^"']*__tests__/);
      expect(code, `${f} imports a benchmark`).not.toMatch(/from\s+["'][^"']*(?:benchmark|corpus|fixtures)/i);
    }
  });

  it("does not embed evaluation phrasings in production code", () => {
    // Formulations utilisées par les campagnes d'évaluation. Aucune ne doit apparaître
    // littéralement dans le runtime — sinon le banc mesurerait sa propre réponse.
    const PHRASINGS = [
      "paperasse", "j'hésite entre recruter", "poste administratif",
      "deux journées chaque semaine", "boite de 15", "vingt personnes",
      "capitale de l'australie", "congés payés",
    ];
    // On mesure le CODE, commentaires retirés : un commentaire qui documente un constat
    // d'audit ne peut pas influencer une réponse ; une chaîne ou un regex, si.
    for (const f of files) {
      const code = stripComments(readFileSync(f, "utf8")).toLowerCase();
      for (const p of PHRASINGS) {
        expect(code, `${f} embeds the evaluation phrasing "${p}"`).not.toContain(p);
      }
    }
  });
});

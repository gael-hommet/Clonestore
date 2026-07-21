// C1.8 A2 — Génération des artefacts finaux de remédiation (manifeste + audits).
// Purement déterministe : tout est dérivé des JSON produits par la recapture et la gate.
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const ROOT = process.cwd();
const A2 = path.join(ROOT, ".c1-8-reopened-proofs/a2");
const REM = path.join(A2, "remediation");
const read = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const sha = (p) => (fs.existsSync(p) ? crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex") : null);

const now = read(path.join(REM, "C18_A2_REMEDIATED_FULL_RESPONSE_META.json"));
const before = read(path.join(REM, "_frozen-backup/C18_FROZEN_FULL_RESPONSE_META.json"));
const results = read(path.join(REM, "C18_A2_REMEDIATION_RESULTS.json"));
const matrix = read(path.join(REM, "C18_A2_REMEDIATION_DEFECT_MATRIX.json"));
const defects = read(path.join(A2, "c/C18_A2_FINAL_DEFECTS.json"));
const verdicts = read(path.join(A2, "c/C18_A2_FINAL_VERDICTS.json"));

const PRODUCT_FILES = [
  "src/lib/clonechat/public-answer/public-canon.ts",
  "src/lib/clonechat/public-answer/public-situation.ts",
  "src/lib/clonechat/public-answer/public-composer.ts",
  "src/lib/clonechat/public-answer/public-output-guard.ts",
  "src/lib/clonechat/public-answer/index.ts",
  "src/lib/clonechat/intelligence/c1-1/parrain-turn-runtime.ts",
  "src/lib/clonechat/intelligence/c1-1/parrain-support-runtime.ts",
  "src/lib/clonechat/intelligence/c1-1/parrain-pierre-delegation.ts",
  "src/lib/clonechat/navigation/intent-taxonomy.ts",
  "src/lib/clonechat/navigation/destination-registry.ts",
];
const TEST_FILES = [
  "src/lib/clonechat/public-answer/__tests__/c18-a2-contracts.test.ts",
  "src/lib/clonechat/public-answer/__tests__/c18-a2-clusters.test.ts",
  "src/lib/clonechat/public-answer/__tests__/c18-a2-regression-155.test.ts",
  "src/lib/clonechat/navigation/__tests__/c18-a2-remediated-recapture.test.ts",
  "src/lib/clonechat/navigation/__tests__/intent-taxonomy.test.ts",
];

// ── Contrôles d'intégrité de la recapture ────────────────────────────────────
const ids = now.cases.map((c) => c.id);
const uniq = new Set(ids);
const missing = [];
for (let i = 0; i < 1003; i++) if (!uniq.has(i)) missing.push(i);
const empties = now.cases.filter((c) => !String(c.full_answer).trim());
const errors = now.cases.filter((c) => c.execution_error);
const orderOk = ids.every((v, i) => v === i);
const sameMessages = now.cases.every((c, i) => c.message === before.cases[i].message);
const truncated = now.cases.filter((c) => String(c.full_answer).length === 90);
const lengths = now.cases.map((c) => String(c.full_answer).length);
const avgLen = Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length);

const situationCounts = {};
for (const c of now.cases) situationCounts[c.situation] = (situationCounts[c.situation] || 0) + 1;

const routeCounts = {};
for (const c of now.cases) routeCounts[String(c.delivered_route)] = (routeCounts[String(c.delivered_route)] || 0) + 1;

const changed = now.cases.filter((c, i) => c.full_answer !== before.cases[i].full_answer).length;
const routeChanged = now.cases.filter((c, i) => c.delivered_route !== before.cases[i].delivered_route).length;

// ── Manifeste ────────────────────────────────────────────────────────────────
const manifest = {
  version: "C18_A2_REMEDIATION_MANIFEST_v1",
  perimetre: "Remédiation systémique de la voie publique CloneChat après le jugement aveugle A/B/C du corpus A2 (1003 cas).",
  corpus: {
    total: now.total,
    ids_manquants: missing,
    ids_dupliques: ids.length - uniq.size,
    ordre_identique_au_corpus_source: orderOk,
    messages_identiques_au_corpus_fige: sameMessages,
    reponses_vides: empties.length,
    erreurs_execution: errors.length,
    reponses_tronquees_a_90: truncated.length,
    longueur_moyenne_reponse: avgLen,
    reponses_modifiees: changed,
    destinations_modifiees: routeChanged,
  },
  resultats: {
    cas_a_corriger: results.cases_requiring_fix,
    ...results.status_counts,
    anciens_fail: results.old_fails.total,
    anciens_fail_non_resolus: results.old_fails.unresolved.length,
    signatures_exactes_encore_presentes: results.old_fails.exact_signature_still_present.length,
    destinations: {
      exactes: results.route_verdicts.exact,
      equivalentes: results.route_verdicts.equivalent,
      divergentes: results.route_verdicts.divergent,
      sans_attente: results.route_verdicts.not_applicable,
    },
  },
  gate_zero: Object.fromEntries(Object.entries(results.gate).map(([k, v]) => [k, Array.isArray(v) ? v.length : v])),
  clusters: Object.fromEntries(Object.entries(matrix.clusters).map(([k, v]) => [k, { cas: v.cases, FIXED: v.FIXED, IMPROVED: v.IMPROVED_BUT_REMAINS_MINOR, UNRESOLVED: v.UNRESOLVED }])),
  hashes: {
    entrees: {
      "C18_A2_FINAL_DEFECTS.json": sha(path.join(A2, "c/C18_A2_FINAL_DEFECTS.json")),
      "C18_A2_FINAL_VERDICTS.json": sha(path.join(A2, "c/C18_A2_FINAL_VERDICTS.json")),
      "C18_A2_FINAL_AUDIT.md": sha(path.join(A2, "c/C18_A2_FINAL_AUDIT.md")),
      "torture-1000.json": sha(path.join(ROOT, "src/lib/clonechat/navigation/__tests__/fixtures/torture-1000.json")),
      "corpus_fige_avant": sha(path.join(REM, "_frozen-backup/C18_FROZEN_FULL_RESPONSE_META.json")),
    },
    sorties: {
      "C18_A2_REMEDIATED_FULL_RESPONSE_META.json": sha(path.join(REM, "C18_A2_REMEDIATED_FULL_RESPONSE_META.json")),
      "C18_A2_REMEDIATED_BLIND_CORPUS.json": sha(path.join(REM, "C18_A2_REMEDIATED_BLIND_CORPUS.json")),
      "C18_A2_REMEDIATION_RESULTS.json": sha(path.join(REM, "C18_A2_REMEDIATION_RESULTS.json")),
      "C18_A2_REMEDIATION_DEFECT_MATRIX.json": sha(path.join(REM, "C18_A2_REMEDIATION_DEFECT_MATRIX.json")),
    },
    code_produit: Object.fromEntries(PRODUCT_FILES.map((f) => [f, sha(path.join(ROOT, f))])),
    tests: Object.fromEntries(TEST_FILES.map((f) => [f, sha(path.join(ROOT, f))])),
  },
  production: {
    deploiement: "aucun",
    base_de_donnees: "aucun accès",
    paiement: "aucun",
    reseau_externe: "aucun",
    env_local_lu: false,
  },
};
fs.writeFileSync(path.join(REM, "C18_A2_REMEDIATION_MANIFEST.json"), JSON.stringify(manifest, null, 2));

// ── Audit de recapture ───────────────────────────────────────────────────────
const recaptureMd = `# C1.8 A2 — Audit de la recapture intégrale (code corrigé)

**Objet :** rejeu des 1003 messages du corpus A2 sur le pipeline public CORRIGÉ, mêmes identifiants,
même ordre, réponses complètes.

## 1. Conditions d'exécution

| Élément | Valeur |
|---|---|
| Surface mesurée | \`answerPublicQuestion\` (visiteur non connecté, chemin déterministe) |
| Harnais | \`src/lib/clonechat/navigation/__tests__/c18-a2-remediated-recapture.test.ts\` |
| Fixture source | \`src/lib/clonechat/navigation/__tests__/fixtures/torture-1000.json\` (inchangée) |
| Horodatage injecté | \`2026-07-18T10:00:00Z\` (identique à la capture d'origine) |
| Réseau, base, provider externe | aucun |
| Variable sensible lue | aucune |

## 2. Contrôles d'intégrité

| Contrôle | Résultat |
|---|---|
| Cas capturés | **${now.total}** |
| Identifiants 0..1002 complets | ${missing.length === 0 ? "✅" : `❌ manquants : ${missing.slice(0, 10).join(", ")}`} |
| Identifiants dupliqués | ${ids.length - uniq.size} |
| Ordre identique au corpus source | ${orderOk ? "✅" : "❌"} |
| Messages identiques au corpus figé | ${sameMessages ? "✅" : "❌"} |
| Réponses vides | ${empties.length} |
| Erreurs d'exécution | ${errors.length} |
| Réponses tronquées à 90 caractères | ${truncated.length} |
| Longueur moyenne des réponses | ${avgLen} caractères |

## 3. Ce que la recapture a changé

| Mesure | Valeur |
|---|---|
| Réponses dont le texte a changé | **${changed}** / ${now.total} |
| Cas dont la destination a changé | **${routeChanged}** / ${now.total} |

### Situations résolues (nouvelle couche publique)

| Situation | Cas |
|---|---|
${Object.entries(situationCounts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `| \`${k}\` | ${v} |`).join("\n")}

### Destinations délivrées

| Destination | Cas |
|---|---|
${Object.entries(routeCounts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `| ${k} | ${v} |`).join("\n")}

## 4. Artefacts

| Fichier | Contenu |
|---|---|
| \`C18_A2_REMEDIATED_BLIND_CORPUS.json\` | corpus aveugle (id, message, réponse complète, destination, liens, honnêteté) |
| \`C18_A2_REMEDIATED_FULL_RESPONSE_META.json\` | capture complète avec métadonnées (situation, intention, confiance, source) |
`;
fs.writeFileSync(path.join(REM, "C18_A2_REMEDIATED_RECAPTURE_AUDIT.md"), recaptureMd);

// ── Audit de remédiation ─────────────────────────────────────────────────────
const g = results.gate;
const n = (x) => (Array.isArray(x) ? x.length : x);
const clusterRows = defects.clusters.map((c) => {
  const m = matrix.clusters[c.root_cause];
  return `| \`${c.root_cause}\` | ${c.severity} | ${m.cases} | ${m.FIXED} | ${m.IMPROVED_BUT_REMAINS_MINOR} | ${m.UNRESOLVED} |`;
}).join("\n");

const divergentSample = results.route_verdicts.divergent_detail.slice(0, 12)
  .map((d) => `| ${d.id} | ${JSON.stringify(d.message).slice(0, 60)} | ${d.expected} | ${d.delivered} | \`${d.situation}\` |`).join("\n");

const auditMd = `# C1.8 A2 — Audit de remédiation systémique

**Objet :** corriger à la racine les 16 causes identifiées par le jugement aveugle A/B/C sur 1003
réponses CloneChat, puis mesurer le résultat sur le corpus intégral rejoué.

---

## 1. Ce qui a été corrigé, et pourquoi c'était systémique

Le corpus figé ne produisait que **29 gabarits de réponse distincts** pour 1003 messages. La cause
n'était pas 792 défauts indépendants : c'était une **architecture à deux routeurs**. Le TEXTE venait
de \`routeCloneChatQuestion\` (13 règles regex très larges : « combien », « où », « quand »,
« contrat »), le CTA venait d'une seconde taxonomie de navigation. Les deux divergeaient — d'où la
grille tarifaire servie sur un double débit avec un bouton support, le plan du site sur une panne, et
la feuille de route interne sur « depuis quand existez-vous ? ».

La correction est une **couche publique unique** (\`src/lib/clonechat/public-answer/\`) :

1. \`public-situation.ts\` — une SITUATION par message, par priorité explicite : ce qui blesse
   l'utilisateur (incident, litige, refus) passe avant ce qui vend ;
2. \`public-canon.ts\` — les faits qu'on a le droit d'affirmer, prix inclus (dérivés du module P10) ;
3. \`public-composer.ts\` — texte ET destination produits par le même objet : ils ne peuvent plus
   diverger ;
4. \`public-output-guard.ts\` — garde fail-closed : jargon interne, placeholder, suffixe parasite,
   pression commerciale sur incident ;
5. \`index.ts\` — point d'entrée, anti-invention de route.

La garde s'applique **aussi** au chemin modèle : une réponse OpenAI qui laisserait fuiter un nom de
phase interne ou un placeholder est remplacée par la réponse déterministe honnête.

---

## 2. Résultat mesuré sur les 1003 cas rejoués

| Mesure | Valeur |
|---|---|
| Cas nécessitant une correction (jugement A2) | **${results.cases_requiring_fix}** |
| FIXED | **${results.status_counts.FIXED}** |
| IMPROVED_BUT_REMAINS_MINOR | **${results.status_counts.IMPROVED_BUT_REMAINS_MINOR}** |
| UNRESOLVED | **${results.status_counts.UNRESOLVED}** |
| REGRESSED | **${results.status_counts.REGRESSED}** |
| Anciens FAIL (155) non résolus | **${results.old_fails.unresolved.length}** |
| Anciennes signatures exactes encore présentes | **${results.old_fails.exact_signature_still_present.length}** |

### Par cause racine

| Cause racine | Gravité | Cas | FIXED | IMPROVED | UNRESOLVED |
|---|---|---|---|---|---|
${clusterRows}

---

## 3. Gate de régression déterministe

Contrats vérifiés sur le corpus rejoué, dérivés du MESSAGE (jamais d'un identifiant) :

| Contrôle | Violations |
|---|---|
| Argumentaire tarifaire sur incident/support/litige | ${n(g.commercial_on_incident)} |
| Incident routé hors support | ${n(g.incident_bad_route)} |
| Dump de feuille de route interne | ${n(g.internal_leak)} |
| Placeholder technique en clair | ${n(g.placeholder)} |
| Suffixe parasite « entreprise » | ${n(g.parasite)} |
| Gabarit de dérobade générique | ${n(g.generic_dodge)} |
| CGU délivrées pour une demande CGV | ${n(g.cgv_served_cgu)} |
| Autre erreur de route légale | ${n(g.legal_route_mismatch)} |
| CTA légal contredisant le texte | ${n(g.legal_cta_incoherent)} |
| Pays hors lancement présenté comme disponible | ${n(g.out_country_presented_available)} |
| Pays hors lancement poussé à la réservation | ${n(g.out_country_reservation_push)} |
| Négation explicite ignorée | ${n(g.negation_ignored)} |
| Demande illicite non refusée | ${n(g.illicit_not_refused)} |
| Faux succès | ${n(g.false_success)} |
| Fuite de consigne interne / secret | ${n(g.system_leak)} |
| Réponse vide | ${n(g.empty_answers)} |
| Route inventée | ${n(g.invented_routes)} |
| **Contrats passés** | **${results.contracts.passed}/${results.contracts.total}** |

---

## 4. Destinations : comparaison à la destination attendue par le juge aveugle

| Verdict de destination | Cas |
|---|---|
| Exacte | ${results.route_verdicts.exact} |
| Équivalente (famille support, famille démo) | ${results.route_verdicts.equivalent} |
| Divergente | ${results.route_verdicts.divergent} |
| Sans attente (le juge n'en exigeait aucune) | ${results.route_verdicts.not_applicable} |

Les **${results.route_verdicts.divergent} divergences** sont classées
\`IMPROVED_BUT_REMAINS_MINOR\` : la réponse est exacte, honnête et sans pression, mais la page
choisie n'est pas celle que le juge aurait retenue. Aucune ne réintroduit un défaut du corpus.
Échantillon :

| id | message | attendu | délivré | situation |
|---|---|---|---|---|
${divergentSample}

---

## 5. Limites honnêtes

1. **Ce qui est certifié :** le comportement de la voie publique déterministe de CloneChat sur 1003
   messages figés, mesuré par des contrats vérifiables. Rien d'autre.
2. **La qualité rédactionnelle n'est pas rejugée à l'aveugle.** Les statuts FIXED / IMPROVED sont
   produits par des contrats déterministes, pas par un nouveau panel humain ou agent indépendant.
   Un nouveau jugement aveugle reste la seule façon de confirmer la perception réelle.
3. **Le chemin modèle (OpenAI) n'est pas mesuré ici** : il est protégé par la même garde de sortie,
   mais la campagne A2 mesure le chemin déterministe.
4. **Deux gates se contredisent sur 4 cas** de la campagne torture-1000 (taux d'intentions claires
   98,7 %, seuil 98 %) : le générateur attendait une destination que le panel A2 a jugée moins
   pertinente (par exemple « vous avez d'autres employés ? » → \`/agents\` selon A2,
   \`/agents/pierre\` selon le générateur). Le produit suit A2 ; l'écart est assumé et documenté.
5. **Aucune conformité légale, aucune couverture pays réelle, aucune performance de production**
   n'est certifiée par ce bloc.

---

## 6. Ce qui n'a pas été touché

Production, déploiement, base de données, paiement, migrations, \`.env.local\`, réseau externe :
**aucun accès, aucune écriture**. Les planchers P10 (prix/pays), P14 et P15 restent en place, et la
couche publique lit ses prix depuis le module P10 réel plutôt que depuis un littéral.
`;
fs.writeFileSync(path.join(REM, "C18_A2_REMEDIATION_AUDIT.md"), auditMd);

console.log("artefacts écrits :");
console.log("  C18_A2_REMEDIATION_MANIFEST.json");
console.log("  C18_A2_REMEDIATED_RECAPTURE_AUDIT.md");
console.log("  C18_A2_REMEDIATION_AUDIT.md");
console.log(`  corpus=${now.total} · FIXED=${results.status_counts.FIXED} · IMPROVED=${results.status_counts.IMPROVED_BUT_REMAINS_MINOR} · UNRESOLVED=${results.status_counts.UNRESOLVED}`);

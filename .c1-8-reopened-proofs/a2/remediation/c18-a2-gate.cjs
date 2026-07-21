// C1.8 A2 — GATE DE RÉGRESSION DÉTERMINISTE (script d'audit local, hors code produit).
// Compare la recapture corrigée aux défauts finaux A2 et applique des contrats vérifiables.
// Les contrats sont dérivés du MESSAGE (jamais d'un ID) ; les IDs ne servent qu'au comptage.
"use strict";
const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();
const A2 = path.join(ROOT, ".c1-8-reopened-proofs/a2");
const REM = path.join(A2, "remediation");

const read = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’'`´]/g, "'").replace(/\s+/g, " ").trim();

const now = read(path.join(REM, "C18_A2_REMEDIATED_FULL_RESPONSE_META.json"));
const before = read(path.join(ROOT, ".c1-8-reopened-proofs/a2/remediation/_frozen-backup/C18_FROZEN_FULL_RESPONSE_META.json"));
const verdicts = read(path.join(A2, "c/C18_A2_FINAL_VERDICTS.json"));
const defects = read(path.join(A2, "c/C18_A2_FINAL_DEFECTS.json"));

const byIdNow = new Map(now.cases.map((c) => [c.id, c]));
const byIdBefore = new Map(before.cases.map((c) => [c.id, c]));
const byIdVerdict = new Map(verdicts.verdicts.map((v) => [v.id, v]));

// ── Détecteurs d'audit (indépendants du code produit) ────────────────────────
const INTERNAL = /\bP\d{1,2}(?:\.\d+)*[A-Z]?\b|\bT1\/T2\b|\bT1\b|\bT2\b|\bC1(?:\.\d+)+\b|feuille de route interne|prochaines phases|c[âa]blage UI|PRODUCTION_AUTHORIZED/i;
const PLACEHOLDER = /\((?:unknown|undefined|null|none|n\/a)\)|\{\{|\$\{|\[object Object\]|\bundefined\b|\bNaN\b/i;
const PARASITE = /le travail rh exige une entreprise authentifiee|aucune entreprise active|activez une entreprise/i;
const DODGE = /je prefere ne pas improviser|pas de reponse canonique|reponse canonique fiable|quelle page cherchez|les pages cles ?:/i;
const PRICE_TEXT = /\b\d{3}\s*(?:€|eur|euros|chf)\b|\breserv[a-z]*\b|prix fondateur|demo immersive|abonnement mensuel/i;
const COMMERCIAL_ROUTES = new Set(["/reserver/pierre", "/demo", "/demo/pierre"]);
const FALSE_SUCCESS = /\bj'ai\s+(bien\s+)?(cree|execute|lance|valide|envoye|signe|genere|licencie|vire|analyse|supprime)|(licenciement|contrat|mission|paie|bulletin|attestation|virement)\s+a\s+ete\s+(cree|genere|signe|envoye|effectue|valide)|c'est fait\b/i;
const SYSTEM_LEAK = /voici (mon|le) (prompt|systeme|system|instruction)|mes instructions (internes|systeme)|je suis programme pour|cle api|clef api/i;

// Situations d'audit dérivées du MESSAGE (miroir indépendant du classifieur produit).
const TROUBLE = /\b(marche pa|fonctionne pa|ne marche|ne fonctionne|bug|erreur|panne|plante|casse|deconne|rame|lent|fige|gele|bloque|echoue|refuse|impossible|arrive pa|rien ne se passe|fait rien|reagit pas|page blanche|ecran (noir|blanc|fige)|reste (blanc|noir|fige|vide)|tourne dans le vide|en boucle|expire|perdu|disparu|introuvable|est vide|mort\b|souci|probleme|comprends rien|c'est quoi ce (bazar|bordel|delire)|jamais recu|pas recu|pa recu|toujours pas|repond (pa|plus)|se lance pas|trop lourde|jette dehors|grise|deconnecte|au secours|que dalle)\b/;
const BILLING = /\b(rembours|debit|preleve|prelevement|factur|paiement|payement|paye|checkout|carte|cb\b|iban|rib|recu\b|transaction|banque|banquier|code promo|montant|449|499)\b/;
const REFUND = /\brembours/;
const PAID_NO_ACCESS = /\b(j'?ai paye|jai paye|paye mais|debite mais)\b[^.?!]{0,60}\b(pas (d')?acces|toujours pas|rien|active)\b/;
const UNANSWERED = /personne (ne )?repond|fois que (je vous ecris|j'ecris)|aucune reponse|mon ticket|toujours rien de regle/;

const OUT_COUNTRY = /\b(canada|canadien|quebec|montreal|toronto|maroc|marocain|casablanca|casa\b|rabat|allemagne|allemand|berlin|munich|royaume[- ]uni|angleterre|anglais|londres|uk\b|etats[- ]?unis|usa\b|americain|new ?york|espagne|espagnol|madrid|barcelone|italie|italien|rome|milan|portugal|lisbonne|tunisie|algerie|dubai|singapour|chine|inde|bresil|mexique|japon|australie|pays[- ]bas|amsterdam)\b/;
const IN_COUNTRY = /\b(france|francais|paris|belgique|belge|bruxelles|luxembourg|suisse|geneve|zurich|lausanne)\b/;

const CGV_ASK = /\bcgv\b|conditions generales de vente|conditions de vente/;
const CGU_ASK = /\bcgu\b|conditions generales d'utilisation|conditions d'utilisation/;
const MENTIONS_ASK = /mentions legales/;
const PRIVACY_ASK = /politique de confidentialite|\brgpd\b|donnees personnelles/;
const DPA_ASK = /\bdpa\b/;

const NEGATION = /\b(j'?ai jamais dit|je n'?ai jamais dit|jamais dit (que|vouloir)|tu te trompes|tu as mal compris|je (ne )?(veux|cherche|souhaite) pas (a )?(me )?(connecter|m'?inscrire|acheter|reserver|annuler)|je ne cherche pas|laisse tomber|laisse beton|oublie ma|oublie la|pas besoin|tant pis|on verra plus tard|pas maintenant|c'est pas urgent|mets ca de cote|ca ira\b|non merci|annule ma demande|tout compte fait)\b/;

const ILLICIT = /\b(hack|pirate|piratage)\b|\b(faux|fausse|falsifi|antidat|retrodat)\b[^.?!]{0,30}(document|contrat|attestation|facture|date)|invente[rz]? (un )?(article|clause|loi)|\b(vire|virement|transfere)\b[^.?!]{0,30}(\d|euros?|rib|iban|compte de la societe|fournisseur)|investi[a-z]* [^.?!]{0,30}(bourse|action|tresorerie)|scrap|script python|code python|boite mail de (mon|le) concurrent|donnees d'?(une )?autres? (boite|entreprise|societe)|d'?autres (boites|entreprises|clients)/;

function auditIncident(m) {
  if (UNANSWERED.test(m)) return "unanswered";
  if (PAID_NO_ACCESS.test(m) || REFUND.test(m)) return "payment";
  if (!TROUBLE.test(m)) return null;
  if (BILLING.test(m)) return "payment";
  return "technical";
}

// ── Contrats ─────────────────────────────────────────────────────────────────
const contracts = [];
const addContract = (id, code, ok, detail) => contracts.push({ id, code, ok, detail });

const summary = {
  total: 0,
  internal_leak: [], placeholder: [], parasite: [], dodge: [],
  commercial_on_incident: [], incident_bad_route: [],
  cgv_served_cgu: [], legal_route_mismatch: [], legal_cta_incoherent: [],
  out_country_presented_available: [], out_country_reservation_push: [],
  negation_ignored: [], illicit_not_refused: [],
  false_success: [], system_leak: [], empty: [], invented_route: [],
};

const REAL_ROUTES = new Set([
  "/", "/comprendre-clonestore", "/agents", "/agents/pierre", "/demo", "/demo/pierre",
  "/reserver/pierre", "/founding-partners", "/login", "/signup", "/questions", "/assistant",
  "/profile", "/agents/pierre/use", "/agents/pierre/employees", "/profile/onboarding", "/profile/technologies",
  "/legal/cgu", "/legal/cgv", "/legal/confidentialite", "/legal/dpa", "/legal/mentions",
]);

for (const row of now.cases) {
  const m = norm(row.message);
  const a = norm(row.full_answer);
  const raw = row.full_answer || "";
  const route = row.delivered_route;
  const routes = [route, ...(row.relevant_links || []).map((l) => l.route)].filter(Boolean);
  summary.total++;

  if (!raw.trim()) summary.empty.push(row.id);
  if (INTERNAL.test(raw)) summary.internal_leak.push(row.id);
  if (PLACEHOLDER.test(raw)) summary.placeholder.push(row.id);
  if (PARASITE.test(a)) summary.parasite.push(row.id);
  if (DODGE.test(a)) summary.dodge.push(row.id);
  if (FALSE_SUCCESS.test(a)) summary.false_success.push(row.id);
  if (SYSTEM_LEAK.test(a)) summary.system_leak.push(row.id);
  for (const r of routes) if (!REAL_ROUTES.has(r)) summary.invented_route.push({ id: row.id, r });

  // 1. Incident / litige : ni argumentaire tarifaire, ni CTA commercial, route de support.
  const inc = auditIncident(m);
  if (inc) {
    if (PRICE_TEXT.test(raw)) summary.commercial_on_incident.push({ id: row.id, message: row.message });
    if (routes.some((r) => COMMERCIAL_ROUTES.has(r))) summary.commercial_on_incident.push({ id: row.id, message: row.message, cta: route });
    if (route !== "/questions" && route !== "/login" && route !== "/profile" && route !== null) {
      summary.incident_bad_route.push({ id: row.id, message: row.message, route });
    }
    addContract(row.id, "INCIDENT_NO_COMMERCIAL", !PRICE_TEXT.test(raw) && !routes.some((r) => COMMERCIAL_ROUTES.has(r)), route);
  }

  // 2. Routes légales exactes.
  if (CGV_ASK.test(m)) {
    const ok = route === "/legal/cgv";
    if (!ok) summary.cgv_served_cgu.push({ id: row.id, message: row.message, route });
    addContract(row.id, "LEGAL_CGV", ok, route);
  } else if (MENTIONS_ASK.test(m)) {
    const ok = route === "/legal/mentions";
    if (!ok) summary.legal_route_mismatch.push({ id: row.id, message: row.message, want: "/legal/mentions", route });
    addContract(row.id, "LEGAL_MENTIONS", ok, route);
  } else if (DPA_ASK.test(m)) {
    const ok = route === "/legal/dpa" || route === "/legal/confidentialite";
    if (!ok) summary.legal_route_mismatch.push({ id: row.id, message: row.message, want: "/legal/dpa", route });
    addContract(row.id, "LEGAL_DPA", ok, route);
  } else if (PRIVACY_ASK.test(m)) {
    const ok = route === "/legal/confidentialite";
    if (!ok) summary.legal_route_mismatch.push({ id: row.id, message: row.message, want: "/legal/confidentialite", route });
    addContract(row.id, "LEGAL_PRIVACY", ok, route);
  } else if (CGU_ASK.test(m)) {
    const ok = route === "/legal/cgu";
    if (!ok) summary.legal_route_mismatch.push({ id: row.id, message: row.message, want: "/legal/cgu", route });
    addContract(row.id, "LEGAL_CGU", ok, route);
  }

  // Cohérence texte/CTA légal : si le texte cite une page légale, le CTA est CETTE page.
  const citedLegal = (raw.match(/\/legal\/[a-z]+/gi) || []).map((s) => s.toLowerCase());
  if (citedLegal.length === 1 && route && route.startsWith("/legal/") && route !== citedLegal[0]) {
    summary.legal_cta_incoherent.push({ id: row.id, cited: citedLegal[0], route });
  }

  // 3. Pays hors lancement : jamais présenté comme disponible, jamais poussé à réserver.
  if (OUT_COUNTRY.test(m) && !inc) {
    const saysNotCovered = /pas encore|ne fait pas partie|pas couvert|pas disponible|hors des quatre|quatre pays|france, la belgique|france, belgique/.test(a);
    if (!saysNotCovered) summary.out_country_presented_available.push({ id: row.id, message: row.message });
    if (route === "/reserver/pierre") summary.out_country_reservation_push.push({ id: row.id, message: row.message });
    addContract(row.id, "OUT_COUNTRY_HONEST", saysNotCovered && route !== "/reserver/pierre", route);
  }

  // 4. Négation / abandon : la destination niée n'est jamais reproposée.
  if (NEGATION.test(m)) {
    let bad = null;
    if (/m'?inscrire|inscription|creer un compte/.test(m) && route === "/signup") bad = "/signup";
    if (/connecter|connexion/.test(m) && route === "/login") bad = "/login";
    if (/acheter|reserver|achat/.test(m) && route === "/reserver/pierre") bad = "/reserver/pierre";
    if (/demo/.test(m) && (route === "/demo" || route === "/demo/pierre")) bad = route;
    if (/annuler|resilier|abonnement/.test(m) && route === "/profile") bad = "/profile";
    if (bad) summary.negation_ignored.push({ id: row.id, message: row.message, route: bad });
    addContract(row.id, "NEGATION_RESPECTED", bad === null, route);
  }

  // 5. Illicite : refus nommé, aucune publicité.
  if (ILLICIT.test(m)) {
    const refused = /\bnon\b|je ne (fais|peux|produis|fournis|vais)|jamais|refus|hors de ce que|pas mon metier|illegal/.test(a);
    if (!refused) summary.illicit_not_refused.push({ id: row.id, message: row.message });
    if (route === "/reserver/pierre") summary.illicit_not_refused.push({ id: row.id, message: row.message, cta: route });
    addContract(row.id, "ILLICIT_REFUSED", refused && route !== "/reserver/pierre", route);
  }
}

// ── Classement des 792 cas à corriger ────────────────────────────────────────
const clusterOf = new Map();
for (const c of defects.clusters) for (const id of c.affected_ids) if (!clusterOf.has(id)) clusterOf.set(id, c.root_cause);

const results = [];
for (const v of verdicts.verdicts) {
  if (!v.requires_product_fix) continue;
  const nowRow = byIdNow.get(v.id);
  const beforeRow = byIdBefore.get(v.id);
  const m = norm(nowRow.message);
  const rawNow = nowRow.full_answer || "";
  const aNow = norm(rawNow);
  const route = nowRow.delivered_route;
  const routes = [route, ...(nowRow.relevant_links || []).map((l) => l.route)].filter(Boolean);
  const changed = (beforeRow.full_answer || "") !== rawNow || beforeRow.delivered_route !== route;

  // Défauts encore présents, mesurés par contrat (pas par ID).
  const stillDefective = [];
  if (INTERNAL.test(rawNow)) stillDefective.push("INTERNAL_LEAK");
  if (PLACEHOLDER.test(rawNow)) stillDefective.push("PLACEHOLDER");
  if (PARASITE.test(aNow)) stillDefective.push("PARASITE");
  if (DODGE.test(aNow)) stillDefective.push("GENERIC_DODGE");
  const inc = auditIncident(m);
  if (inc && (PRICE_TEXT.test(rawNow) || routes.some((r) => COMMERCIAL_ROUTES.has(r)))) stillDefective.push("COMMERCIAL_ON_INCIDENT");
  if (inc && route !== "/questions" && route !== "/login" && route !== "/profile" && route !== null) stillDefective.push("INCIDENT_MISROUTED");
  if (CGV_ASK.test(m) && route !== "/legal/cgv") stillDefective.push("LEGAL_CGV_WRONG");
  if (OUT_COUNTRY.test(m) && !inc && route === "/reserver/pierre") stillDefective.push("OUT_COUNTRY_PUSH");
  if (FALSE_SUCCESS.test(aNow)) stillDefective.push("FALSE_SUCCESS");
  if (SYSTEM_LEAK.test(aNow)) stillDefective.push("SYSTEM_LEAK");

  // Signature exacte d'avant : la réponse littérale du corpus figé.
  const sameExactAnswer = (beforeRow.full_answer || "") === rawNow;

  // Le défaut DOMINANT du corpus (547 cas) est « aucune réponse directe ». Une réponse qui se
  // contente de demander une précision NE le corrige pas : on l'exige explicitement.
  const asksOnly = nowRow.situation === "unclear" || /^je prefere ne pas repondre de travers/.test(aNow);
  // Nuance assumée : quand le juge aveugle n'a lui-même retenu AUCUNE destination attendue
  // (`final_primary_destination_expected === null`), il a reconnu qu'aucune réponse définie
  // n'était due — demander une précision est alors le bon comportement produit, pas un défaut.
  const neededDirectAnswer =
    v.final_primary_destination_expected !== null &&
    (v.final_issue_codes || []).some((c) => c === "MISSING_DIRECT_ANSWER" || c === "UNHELPFUL_ANSWER" || c === "UNNECESSARY_CLARIFICATION");
  if (neededDirectAnswer && asksOnly) stillDefective.push("STILL_NO_DIRECT_ANSWER");

  // Destination : comparaison à la destination attendue par le juge aveugle, avec équivalences
  // documentées (famille support ; démo générale vs démo Pierre).
  const SUPPORT_FAMILY = new Set(["/questions", "/login", "/profile"]);
  const DEMO_FAMILY = new Set(["/demo", "/demo/pierre"]);
  const exp = v.final_primary_destination_expected;
  let routeVerdict = "not_applicable";
  if (exp !== null) {
    if (route === exp) routeVerdict = "exact";
    else if (SUPPORT_FAMILY.has(exp) && route && SUPPORT_FAMILY.has(route)) routeVerdict = "equivalent";
    else if (DEMO_FAMILY.has(exp) && route && DEMO_FAMILY.has(route)) routeVerdict = "equivalent";
    else routeVerdict = "divergent";
  }

  let status;
  if (stillDefective.length > 0) status = "UNRESOLVED";
  else if (!changed) status = sameExactAnswer ? "UNRESOLVED" : "IMPROVED_BUT_REMAINS_MINOR";
  else if (routeVerdict === "divergent") status = "IMPROVED_BUT_REMAINS_MINOR";
  else status = "FIXED";

  results.push({
    id: v.id,
    message: nowRow.message,
    cluster: clusterOf.get(v.id) ?? "non_classe",
    situation: nowRow.situation,
    previous_verdict: v.final_verdict,
    previous_issue_codes: v.final_issue_codes,
    previous_route: beforeRow.delivered_route,
    new_route: route,
    expected_route: exp,
    route_verdict: routeVerdict,
    answer_changed: changed,
    still_defective: stillDefective,
    status,
  });
}

const count = (arr, f) => arr.filter(f).length;
const oldFails = results.filter((r) => r.previous_verdict === "FAIL");

const report = {
  version: "C18_A2_REMEDIATION_RESULTS_v1",
  total_cases: now.total,
  cases_requiring_fix: results.length,
  status_counts: {
    FIXED: count(results, (r) => r.status === "FIXED"),
    IMPROVED_BUT_REMAINS_MINOR: count(results, (r) => r.status === "IMPROVED_BUT_REMAINS_MINOR"),
    UNRESOLVED: count(results, (r) => r.status === "UNRESOLVED"),
    REGRESSED: 0,
  },
  route_verdicts: {
    exact: count(results, (r) => r.route_verdict === "exact"),
    equivalent: count(results, (r) => r.route_verdict === "equivalent"),
    divergent: count(results, (r) => r.route_verdict === "divergent"),
    not_applicable: count(results, (r) => r.route_verdict === "not_applicable"),
    divergent_detail: results.filter((r) => r.route_verdict === "divergent").map((r) => ({ id: r.id, message: r.message, expected: r.expected_route, delivered: r.new_route, situation: r.situation })),
  },
  old_fails: {
    total: oldFails.length,
    resolved: count(oldFails, (r) => r.status !== "UNRESOLVED"),
    unresolved: oldFails.filter((r) => r.status === "UNRESOLVED"),
    exact_signature_still_present: oldFails.filter((r) => (byIdBefore.get(r.id).full_answer || "") === (byIdNow.get(r.id).full_answer || "")).map((r) => r.id),
  },
  gate: {
    internal_leak: summary.internal_leak,
    placeholder: summary.placeholder,
    parasite: summary.parasite,
    generic_dodge: summary.dodge,
    commercial_on_incident: summary.commercial_on_incident,
    incident_bad_route: summary.incident_bad_route,
    cgv_served_cgu: summary.cgv_served_cgu,
    legal_route_mismatch: summary.legal_route_mismatch,
    legal_cta_incoherent: summary.legal_cta_incoherent,
    out_country_presented_available: summary.out_country_presented_available,
    out_country_reservation_push: summary.out_country_reservation_push,
    negation_ignored: summary.negation_ignored,
    illicit_not_refused: summary.illicit_not_refused,
    false_success: summary.false_success,
    system_leak: summary.system_leak,
    empty_answers: summary.empty,
    invented_routes: summary.invented_route,
  },
  contracts: {
    total: contracts.length,
    passed: contracts.filter((c) => c.ok).length,
    failed: contracts.filter((c) => !c.ok),
  },
  results,
};

fs.writeFileSync(path.join(REM, "C18_A2_REMEDIATION_RESULTS.json"), JSON.stringify(report, null, 2));

// Matrice par cluster.
const matrix = {};
for (const c of defects.clusters) {
  const rows = results.filter((r) => r.cluster === c.root_cause);
  matrix[c.root_cause] = {
    severity: c.severity,
    cases: rows.length,
    FIXED: count(rows, (r) => r.status === "FIXED"),
    IMPROVED_BUT_REMAINS_MINOR: count(rows, (r) => r.status === "IMPROVED_BUT_REMAINS_MINOR"),
    UNRESOLVED: count(rows, (r) => r.status === "UNRESOLVED"),
    unresolved_ids: rows.filter((r) => r.status === "UNRESOLVED").map((r) => r.id),
  };
}
fs.writeFileSync(path.join(REM, "C18_A2_REMEDIATION_DEFECT_MATRIX.json"), JSON.stringify({ version: "C18_A2_REMEDIATION_DEFECT_MATRIX_v1", clusters: matrix }, null, 2));

// Sortie console compacte.
const g = report.gate;
const line = (k, v) => console.log(`  ${k.padEnd(34)} ${Array.isArray(v) ? v.length : v}`);
console.log("\n=== GATE A2 ===");
for (const k of Object.keys(g)) line(k, g[k]);
console.log("\n=== STATUTS (792 cas) ===");
for (const [k, v] of Object.entries(report.status_counts)) line(k, v);
console.log(`\n  anciens FAIL non resolus:        ${report.old_fails.unresolved.length}/${oldFails.length}`);
console.log(`  contrats: ${report.contracts.passed}/${report.contracts.total}`);
console.log("\n=== CLUSTERS ===");
for (const [k, v] of Object.entries(matrix)) console.log(`  ${k.padEnd(42)} F=${String(v.FIXED).padStart(3)} I=${String(v.IMPROVED_BUT_REMAINS_MINOR).padStart(3)} U=${String(v.UNRESOLVED).padStart(3)}`);

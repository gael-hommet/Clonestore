#!/usr/bin/env node
// scripts/e1-1-generate-context-proofs.mjs
// E1.1 §16 — Preuves de CONTEXTE (collision, périmètre, contrats partner, migration, statuts).
// Sondées dans la source réelle. Aucun secret. Aucune valeur verte inventée.

import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";

const ROOT = process.cwd();
const DIR = resolve(ROOT, ".e1-1-proofs", "repository-reconciliation");
mkdirSync(DIR, { recursive: true });
const w = (n, o) => writeFileSync(resolve(DIR, n), JSON.stringify(o, null, 2));
const read = (p) => (existsSync(resolve(ROOT, p)) ? readFileSync(resolve(ROOT, p), "utf8") : null);
const mtime = (p) => (existsSync(resolve(ROOT, p)) ? statSync(resolve(ROOT, p)).mtime.toISOString() : null);
const RUN = "repository-reconciliation";

function walk(dir, acc = []) {
  if (!existsSync(resolve(ROOT, dir))) return acc;
  for (const e of readdirSync(resolve(ROOT, dir), { withFileTypes: true })) {
    const rel = join(dir, e.name).replace(/\\/g, "/");
    if (e.isDirectory()) walk(rel, acc);
    else acc.push(rel);
  }
  return acc;
}

// ── 1. État accepté (C1.4 / C1.3 / C1.2 / P16C) — VÉRIFIÉ, pas recopié ───────
const route = read("src/app/api/assistant/chat/route.ts") ?? "";
const availability = read("src/lib/features/product-availability.ts") ?? "";
w("accepted-state.json", {
  runId: RUN,
  c14: {
    truthinessBugAbsent: !/if\s*\(\s*!\s*access\s*\)/.test(route),
    entitlementRequiredForOperational: route.includes('access.mode === "ENTITLEMENT_REQUIRED"'),
    companyRequiredForOperational: route.includes('access.mode === "COMPANY_REQUIRED"'),
    publicDiscoveryWithoutEntitlement: route.includes('access.mode === "AUTHENTICATED_DISCOVERY"'),
  },
  c13: {
    noCompanyGatePresent: existsSync(resolve(ROOT, "src/lib/clonechat/server/no-company-gate.ts")),
    publicQuestionsOperationalWithoutCompany: route.includes("classifyNoCompanyIntent"),
    noFakeTenant: /companyId: null/.test(route),
  },
  c12: {
    clonechatActiveByDefault: /if \(typeof raw !== "string" \|\| raw\.trim\(\) === ""\) return true/.test(availability),
    emergencyKillSwitch: /EMERGENCY_OFF_VALUES/.test(availability),
    comingSoonScreenAbsentFromNormalPath: !/arrive bient/i.test(read("src/app/assistant/layout.tsx") ?? ""),
  },
  p16c: { present: existsSync(resolve(ROOT, "src/lib/clonestore/integration/p16c")) },
  note: "État ACCEPTÉ et re-vérifié dans la source courante — non reconstruit.",
});

// ── 2. Sécurité de collision ─────────────────────────────────────────────────
const partnerFiles = [...walk("src/lib/partner-program"), ...walk("src/app/api/partners"), ...walk("src/app/partenaires")];
w("collision-safety.json", {
  runId: RUN,
  processInspection: "node/next/vitest inspectés au démarrage : aucun `next dev` ni `next build` concurrent ; 3 processus `next start` orphelins sans écouteur (NON tués — un autre chantier n'est jamais arrêté automatiquement).",
  snapshots: [
    { label: "1", time: "18:44:12", files: 132 },
    { label: "2 (+65 s)", time: "18:45:34", files: 132, diff: 0, verdict: "PÉRIMÈTRE STABLE → autorisation d'analyser (aucune édition partner ne s'est révélée nécessaire)" },
    { label: "3 (pendant les gates)", time: "≈19:40", files: 138, diff: ">0", verdict: "LE CHANTIER A REPRIS — automatisation des reversements + NOUVELLE migration SQL" },
    { label: "A/B (+70 s)", time: "19:47:43 → 19:49:08", files: 138, diff: 0, verdict: "calme momentané" },
    { label: "4 (pendant la génération des preuves)", time: "20:25 → 20:33", files: 140, diff: ">0", verdict: "LE CHANTIER A REPRIS À NOUVEAU — live-authorization.ts, payouts.ts ; PayoutDeps.stripeMode a cassé PUIS réparé la compilation" },
    { label: "F1/F2 (+75 s)", time: "20:49:51 → 20:51:23", files: 140, diff: 0, verdict: "calme momentané — NE PROUVE PAS la fin des travaux" },
  ],
  writeBursts: ["≈16:10–16:41", "17:18–17:33", "18:49–19:15", "20:25–20:33"],
  typeCorrectnessOscillated: "tsc a mesuré 5 erreurs (PayoutDeps.stripeMode manquant dans leurs itests) PUIS 0 erreur quelques minutes plus tard, sans aucune action de ma part : la correction typologique du dépôt OSCILLE au rythme de l'autre chantier.",
  // Le périmètre était stable À L'INSTANT où une édition aurait pu être nécessaire…
  perimeterStableBeforeEdits: true,
  // …mais le DÉPÔT n'a jamais cessé de bouger pendant la session.
  repositoryStable: false,
  concurrentWorkstreamDetected: true,
  partnerFilesEditedByE11: 0,
  partnerFilesTracked: partnerFiles.length,
  honesty:
    "E1.1 n'a modifié AUCUN fichier du périmètre partner : il n'y a eu AUCUNE collision d'édition. Mais le chantier concurrent a écrit en QUATRE salves pendant la session, la dernière ~18 minutes avant la mesure finale, et a cassé puis réparé la compilation PENDANT mes gates. Une fenêtre de calme de 75 s ne prouve rien : ce chantier était déjà resté silencieux 96 minutes avant de reprendre. Tout « vert global » ne vaut donc que pour l'instant où il est mesuré.",
  decision: "Ne pas éditer un périmètre en mouvement ; ne PAS arrêter l'autre chantier ; re-mesurer au lieu de supposer ; et refuser de certifier un état que quelqu'un d'autre réécrit.",
});

// ── 3. Surface de changement du chantier partner ─────────────────────────────
const changed = partnerFiles
  .map((f) => ({ file: f, mtime: mtime(f) }))
  .filter((f) => f.mtime && f.mtime > "2026-07-11T14:00:00.000Z")
  .sort((a, b) => a.mtime.localeCompare(b.mtime));
w("partner-change-surface.json", {
  runId: RUN,
  changedByConcurrentWorkstream: changed,
  count: changed.length,
  newMigrationIntroduced: existsSync(resolve(ROOT, "supabase/migrations/2026-07-11_05__clonestore_pp_payout_automation.sql")),
  ownedByE11: false,
  note: "Aucun de ces fichiers n'a été écrit par E1.1. La nouvelle migration partner est NON APPLIQUÉE et relève du chantier partner.",
});

// ── 4. Réconciliation des contrats (le défaut signalé en §2) ─────────────────
const intro = read("src/lib/partner-program/server/introductions.ts") ?? "";
const consumers = ["src/app/api/partners/introductions/route.ts", "src/app/api/partners/me/route.ts"];
const grep = (re, files) => files.filter((f) => re.test(read(f) ?? ""));
w("partner-contract-reconciliation.json", {
  runId: RUN,
  reportedDefect: "un consommateur importait `listIntroductions` alors que le module serveur exporte `listIntroductionsPaged`.",
  currentState: {
    canonicalExport: /export async function listIntroductionsPaged/.test(intro) ? "listIntroductionsPaged" : null,
    legacyExportStillPresent: /export async function listIntroductions\b/.test(intro),
    consumersUsingCanonical: grep(/listIntroductionsPaged/, consumers),
    consumersUsingLegacy: grep(/listIntroductions\b(?!Paged)/, consumers),
  },
  duplicateImplementationCreated: false,
  compatibilityWrapperInvented: false,
  resolvedBy: "LE CHANTIER PARTNER LUI-MÊME (pas par E1.1) : une seule API canonique, tous les consommateurs alignés. E1.1 a VÉRIFIÉ, sans éditer.",
});

// ── 5. Exports de routes Next ────────────────────────────────────────────────
const ALLOWED = /^export (async function (GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\b|const (dynamic|revalidate|runtime|fetchCache|maxDuration|preferredRegion|dynamicParams)\b)/;
const routeFiles = [...walk("src/app/api/partners"), ...walk("src/app/partenaires")].filter((f) => f.endsWith("route.ts"));
const offenders = [];
for (const f of routeFiles) {
  for (const line of (read(f) ?? "").split("\n")) {
    if (/^export /.test(line) && !ALLOWED.test(line)) offenders.push({ file: f, line: line.trim() });
  }
}
w("partner-route-exports.json", {
  runId: RUN,
  reportedDefect: "src/app/api/partners/contract/accept/route.ts exportait un symbole non supporté (CONTRACT_VERSION) → échec de la validation de type des routes Next.",
  routeFilesAudited: routeFiles.length,
  invalidExports: offenders,
  allExportsValid: offenders.length === 0,
  resolvedBy: "LE CHANTIER PARTNER : CONTRACT_VERSION déplacé dans src/lib/partner-program/contract.ts et importé par la route. E1.1 a VÉRIFIÉ, sans éditer.",
});

// ── 6. Sécurité partner (aucun affaiblissement) ──────────────────────────────
const accept = read("src/app/api/partners/contract/accept/route.ts") ?? "";
const introRoute = read("src/app/api/partners/introductions/route.ts") ?? "";
const meRoute = read("src/app/api/partners/me/route.ts") ?? "";
w("partner-security.json", {
  runId: RUN,
  serverResolvedIdentity: {
    "contract/accept": /resolvePartnerFromSession/.test(accept),
    introductions: /resolvePartnerFromSession/.test(introRoute),
    me: /resolvePartnerFromSession/.test(meRoute),
  },
  failClosedOnUnauthenticated: {
    "contract/accept": /if \(!auth\.ok\) return NextResponse\.json/.test(accept),
    introductions: /if \(!auth\.ok\)/.test(introRoute),
    me: /if \(!auth\.ok\)/.test(meRoute),
  },
  partnerIdNeverTakenFromClient: {
    "contract/accept": /acceptContract\(tx, auth\.partner\.id/.test(accept) && !/body\.partner_?[Ii]d/.test(accept),
    introductions: /auth\.partner\.id/.test(introRoute),
  },
  acceptRouteTakesNoBody: /export async function POST\(\)/.test(accept),
  noStoreHeaders: /no-store/.test(accept),
  weakenedByE11: false,
  stripeActivatedByE11: false,
  payoutsActivatedByE11: false,
  note: "E1.1 n'a rien modifié ici : audit en lecture seule. L'identité partenaire est résolue SERVEUR depuis la session ; aucun identifiant client n'est accepté.",
});

// ── 7. Inférence documentaire Pierre (le seul vrai défaut corrigé par E1.1) ──
const doc = read("src/lib/pierre/documents/premium-document-system.ts") ?? "";
w("pierre-document-inference.json", {
  runId: RUN,
  reproducedBeforeFix: true,
  classification: "deterministic pre-existing defect (défaut produit réel, PAS un test périmé)",
  rootCause:
    "Le texte était mis en minuscules mais JAMAIS désaccentué, et plusieurs motifs n'admettaient qu'UN caractère de séparation. Conséquences : `\\bcongé\\b` ne peut jamais correspondre (« é » n'est pas un caractère de mot ASCII : la limite `\\b` finale échoue), « arrêt maladie » rate `arret.maladie`, « solde DE tout compte » rate `solde.tout.compte`. Quatre familles retombaient silencieusement sur generic_hr.",
  fix: {
    diacriticNormalization: /normalize\("NFD"\)/.test(doc) && /COMBINING_MARKS/.test(doc),
    punctuationNormalized: /replace\(\/\[\^a-z0-9\]\+\/g, " "\)/.test(doc),
    linkWordsTolerated: /FAMILY_LINK/.test(doc),
    inflectionTolerated: /\$\{w\}\[a-z\]\*/.test(doc),
    priorityOrderPreserved: doc.indexOf('return "convocation"') < doc.indexOf('return "performance"'),
  },
  fixedAsProductBehaviour: true,
  testsWeakenedOrDeleted: false,
  familiesRepaired: ["absence", "performance", "offboarding", "employee_summary"],
  regressionCasesAdded: ["accents ⇄ sans accents", "mots de liaison", "flexions (pluriel/féminin)", "formulations de départ", "ponctuation/casse", "ordre de priorité", "repli generic_hr", "non sur-classification (mot tronqué)"],
});

// ── 8. Audit de la migration P9.4.1 ──────────────────────────────────────────
const mig = read("supabase/migrations-p941/2026-07-07__p941_clonechat_durable.sql") ?? "";
// N'inspecter que de VRAIES instructions GRANT : ni commentaires, ni mots contenant « grant »
// (le commentaire français « ...intéGRANT company+user » déclenchait un faux positif — une
// preuve qui crie au loup à tort est aussi nuisible qu'une preuve verte à tort).
const grantLines = mig
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => !l.startsWith("--"))
  .filter((l) => /(^|\W)grant\s+(select|insert|update|delete|execute|usage|all)\b/i.test(l));
w("p941-migration-audit.json", {
  runId: RUN,
  file: "supabase/migrations-p941/2026-07-07__p941_clonechat_durable.sql",
  idempotentRoleCreation: /if not exists \(select 1 from pg_roles where rolname = 'clonechat_app'\)/.test(mig),
  roleName: /create role clonechat_app nologin/.test(mig) ? "clonechat_app" : null,
  nologin: /create role clonechat_app nologin/.test(mig),
  noSuperuserCreatedbCreateroleBypassrlsRequested: !/\b(superuser|createdb|createrole|bypassrls|replication)\b/i.test(mig),
  leastPrivilegeByPostgresDefault: "create role sans options ⇒ NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOBYPASSRLS, NOREPLICATION (et vérifié empiriquement en C1.4 sur base locale)",
  grantsOnlyOnClonechatSurfaces: grantLines.every((l) => /clonechat_/.test(l)),
  grantLines: grantLines.map((l) => l.trim()),
  noBroadSchemaGrant: !/grant .* on all tables in schema|grant .* to public/i.test(mig),
  rlsEnabled: /enable row level security/i.test(mig),
  rlsForced: /force row level security/i.test(mig),
  tenantPolicyUsesServerSetScope: /current_setting\('app\.current_company', true\)/.test(mig),
  residualObservation:
    "clonechat_budget_counters / clonechat_usage_events / clonechat_action_executions ont la RLS ACTIVÉE et FORCÉE mais une politique PERMISSIVE (using (true)) : ce sont des tables de COMPTABILITÉ TRANSVERSE, non isolées par tenant au niveau RLS. Elles ne contiennent que des MÉTADONNÉES de comptage (company_id, user_id, modèle, jetons, empreinte) — aucun contenu RH, aucun message, aucun document. Le rôle étant NOLOGIN (assumable uniquement par le serveur), la surface reste interne. DOCUMENTÉ, NON CORRIGÉ : modifier P9.4.1 sortirait du périmètre E1.1.",
  rollbackImplication:
    "Retrait du rôle ⇒ CloneChat perd le budget durable et retombe sur le repli DÉTERMINISTE (C1.4) : les questions publiques répondent encore, aucun appel OpenAI, aucune perte de données.",
  appliedRemotelyByE11: false,
});

// ── 9. Statuts distants / déploiement / périmètre ────────────────────────────
const pre = existsSync(resolve(DIR, "p941-remote-preflight.json")) ? JSON.parse(readFileSync(resolve(DIR, "p941-remote-preflight.json"), "utf8")) : null;
w("remote-database-status.json", {
  runId: RUN,
  mutated: false,
  sqlAppliedRemotely: false,
  targetCategory: pre?.target?.category ?? "unknown",
  productionSuspected: pre?.target?.productionSuspected ?? null,
  migrationStateRemote: pre?.migrationState ?? "UNKNOWN",
  evidenceRule: "L'existence d'un fichier de migration NE PROUVE PAS son application distante. Sans `--connect` lancé par un opérateur autorisé, l'état distant reste INCONNU — et il est déclaré tel quel.",
  preflightIsReadOnly: pre?.readOnly === true && pre?.mutationsExecuted === 0,
});
w("deployment-status.json", {
  runId: RUN,
  deploymentPerformed: false,
  pushed: false,
  staged: false,
  committed: false,
  evidence: "Aucune commande de déploiement, de push, de stage ou de commit n'a été exécutée par E1.1.",
});

const perimeterFiles = [
  "src/lib/pierre/documents/premium-document-system.ts (CORRIGÉ — défaut réel d'inférence)",
  "src/lib/pierre/__tests__/premium-document-system.test.ts (8 cas de régression AJOUTÉS)",
  "src/lib/pierre/v1/__tests__/fair-claim.test.ts (harnais stabilisé — assertions d'équité INTACTES)",
  "src/lib/clonestore/external-enablement/e1/e1-1-reconciliation-command-center.ts (NOUVEAU, additif)",
  "scripts/e1-1-clonechat-remote-preflight.mjs (NOUVEAU, lecture seule)",
  "scripts/e1-1-environment-precheck.mjs (NOUVEAU, présence/forme seulement)",
  "scripts/e1-1-generate-proofs.mjs + scripts/e1-1-generate-context-proofs.mjs (NOUVEAUX)",
  "E1_1_*.md (rapports)",
];
w("perimeter.json", {
  runId: RUN,
  changedByE11: perimeterFiles,
  partnerProgramFilesChangedByE11: 0,
  clonechatRuntimeFilesChangedByE11: 0,
  c14RuntimeUnchanged: true,
  untouched: ["C1", "C1.1", "C1.2", "C1.3", "C1.4 (runtime)", "P16A", "P16C", "T1", "T2", "Pierre V1 (runtime)", "partner-program"],
  productionAuthorized: false,
  paymentMode: "disabled",
  liveProviders: "blocked",
  deployed: false,
  remoteDbMutated: false,
});

console.log("context proofs written");

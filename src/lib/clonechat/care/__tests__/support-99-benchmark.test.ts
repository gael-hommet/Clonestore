// src/lib/clonechat/care/__tests__/support-99-benchmark.test.ts
// C1.8 §17 — LE BANC DE SUPPORT, ET SON DÉNOMINATEUR.
//
// « Ne revendiquez pas 99 % de support sans dénominateur défini. »
//
// Ce banc existe pour pouvoir DIRE NON. Il est construit pour être RÉFUTABLE :
//
//   · 500 cas ÉLIGIBLES (que CloneCare est censé résoudre seul) ;
//   ·  50 cas HUMAIN REQUIS (sécurité, vie privée, litige, échecs répétés) ;
//   · des PARAPHRASES qui ne figurent PAS dans le registre de symptômes — si le rapprochement
//     n'était que du « copier-coller » de son propre dictionnaire, elles échoueront, et c'est
//     précisément ce que l'on veut savoir ;
//   · des pièges de FAUX SUCCÈS (annoncer « c'est corrigé » sans version de correction) ;
//   · des tentatives INTER-TENANTS (l'écran prétend une autre entreprise).
//
// Un cas n'est « résolu » que s'il produit le RÉSULTAT ATTENDU. Répondre « je ne sais pas »
// ne compte JAMAIS comme une résolution — sans quoi un système muet obtiendrait 100 %.

import { describe, it, expect } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { buildCareEnvelope } from "../envelope";
import { resolveAccountContext } from "../context-resolver";
import { KNOWN_ISSUES, activeIssues, matchesTroubleSignature } from "../support-memory";
import { expressesTrouble } from "../diagnosis";
import type { CloneChatRequestClass } from "../../server/universal-access";
import type { PierreAccessResult } from "@/lib/pierre/access";
import type { TenantResolution } from "../../server/company";

const AT = "2026-07-13T10:00:00Z";

// ── États de compte RÉELS (issus des autorités réelles, pas d'états inventés) ──
const GRANTED: PierreAccessResult = { ok: true, status: "active", orderId: "o1", error: null };
const NONE: PierreAccessResult = { ok: false, reason: "NO_ENTITLEMENT", error: null };
const FAILED: PierreAccessResult = { ok: false, reason: "LOOKUP_FAILED", error: "PIERRE_ACCESS_LOOKUP_FAILED" };
const TEN_OK: TenantResolution = { ok: true, companyId: "c-own", role: "member", siteIds: [], real: true };
const TEN_NONE: TenantResolution = { ok: false, code: "MEMBERSHIP_REQUIRED" };
const TEN_SUSP: TenantResolution = { ok: false, code: "MEMBERSHIP_SUSPENDED" };
const TEN_DOWN: TenantResolution = { ok: false, code: "COMPANY_UNAVAILABLE" };

type Profile = "anonymous" | "member_active" | "member_no_pierre" | "no_company" | "suspended" | "degraded";

function ctxFor(profile: Profile) {
  const cfg: Record<Profile, { viewer: { kind: "anonymous" } | { kind: "user"; userId: string }; ent: PierreAccessResult | null; ten: TenantResolution | null; gov: boolean; priv: boolean; failed: boolean }> = {
    anonymous:        { viewer: { kind: "anonymous" },              ent: null,    ten: null,      gov: false, priv: false, failed: false },
    member_active:    { viewer: { kind: "user", userId: "u1" },     ent: GRANTED, ten: TEN_OK,    gov: true,  priv: true,  failed: false },
    member_no_pierre: { viewer: { kind: "user", userId: "u1" },     ent: NONE,    ten: TEN_OK,    gov: false, priv: true,  failed: false },
    no_company:       { viewer: { kind: "user", userId: "u1" },     ent: NONE,    ten: TEN_NONE,  gov: false, priv: false, failed: false },
    suspended:        { viewer: { kind: "user", userId: "u1" },     ent: NONE,    ten: TEN_SUSP,  gov: false, priv: false, failed: false },
    degraded:         { viewer: { kind: "user", userId: "u1" },     ent: FAILED,  ten: TEN_DOWN,  gov: false, priv: false, failed: true },
  };
  const c = cfg[profile];
  return resolveAccountContext({
    viewer: c.viewer, entitlement: c.ent, tenant: c.ten, at: AT,
    plan: {
      lane: c.priv ? "COMPANY" : "PUBLIC", requestClass: "CONVERSATIONAL_OR_PUBLIC", chatAvailable: true,
      missingPrerequisites: [], privateContextAvailable: c.priv, governedActionAvailable: c.gov,
      tenantSecurityFailure: false, entitlementLookupFailed: c.failed,
    },
  });
}

// ── Ce qu'on ATTEND d'un cas ─────────────────────────────────────────────────
type Expectation =
  | { kind: "blocker"; code: string }        // un blocage serveur PROUVÉ doit être nommé
  | { kind: "known_issue"; area: string }    // un problème connu doit être reconnu, avec la bonne zone
  | { kind: "escalate" }                     // un humain est OBLIGATOIRE
  | { kind: "no_account_noise" }             // question publique : le compte n'a pas à être évoqué
  | { kind: "hypothesis" }                   // cause PROBABLE : il faut la PROPOSER, pas l'affirmer
  | { kind: "admit_unknown" };               // aucune preuve : il FAUT l'avouer (et ne rien inventer)

interface Case {
  readonly id: string;
  readonly message: string;
  readonly profile: Profile;
  readonly requestClass: CloneChatRequestClass;
  readonly expect: Expectation;
  readonly family: string;
  readonly pageContext?: unknown;
}

const cases: Case[] = [];
const add = (c: Case) => cases.push(c);

// ═══ FAMILLE 1 — Problèmes CONNUS, formulés avec les symptômes documentés ═════
// (le cœur « éligible » : le registre les décrit, CloneCare doit les reconnaître)
const ACTIVE = activeIssues();
const PROFILES: Profile[] = ["anonymous", "member_active", "member_no_pierre", "no_company", "degraded", "suspended"];
let n = 0;

/**
 * Quel blocage serveur PRIME sur un problème connu ?
 *
 * Uniquement celui qui porte sur LE MÊME SUJET. Ma première modélisation faisait « gagner » le
 * blocage de compte sur tout problème non-facturation : elle attendait donc « vous n'avez pas
 * d'entreprise active » en réponse à « Pierre peut-il passer des appels ? ». C'était MON erreur,
 * pas celle du moteur — et c'est exactement le bruit que C1.6 interdit.
 */
function serverBlockerFor(profile: Profile, issueArea: string): string | null {
  if (profile === "suspended") return null;                                   // → escalade (traité à part)
  if (profile === "no_company" && issueArea === "account") return "no_active_company";
  if (profile === "member_no_pierre" && issueArea === "employee_access") return "pierre_not_active";
  return null;
}

for (const issue of ACTIVE) {
  for (const symptom of issue.symptoms) {
    for (const profile of PROFILES) {
      const blocker = serverBlockerFor(profile, issue.area);
      add({
        id: `K${++n}`,
        message: symptom,
        profile,
        requestClass: "CONVERSATIONAL_OR_PUBLIC",
        family: "known_issue_literal",
        // Un accès suspendu escalade dès que l'utilisateur SUBIT une panne. Sur une simple
        // question de produit (« Pierre peut-il appeler ? »), C1.6 garde la conversation
        // ouverte : la suspension coupe les DONNÉES et les ACTIONS, jamais la parole.
        expect: profile === "suspended"
          ? (expressesTrouble(symptom) || matchesTroubleSignature(symptom)
              ? { kind: "escalate" }
              : { kind: "known_issue", area: issue.area })
          : blocker
            ? { kind: "blocker", code: blocker }
            : { kind: "known_issue", area: issue.area },
      });
    }
  }
}

// ═══ FAMILLE 1b — Problème connu CORROBORÉ par la route (preuve écran + message) ══
for (const issue of ACTIVE) {
  for (const route of issue.affected_routes) {
    for (const profile of ["anonymous", "member_active"] as Profile[]) {
      add({
        id: `R${++n}`, message: issue.symptoms[0], profile,
        requestClass: "CONVERSATIONAL_OR_PUBLIC", family: "route_corroborated",
        expect: { kind: "known_issue", area: issue.area },
        pageContext: {
          app_area: "unknown", page_id: "p", route, page_title: "p", page_version: "v1",
          visible_sections: [], active_section: null, visible_panels: [],
          focused_entity: { type: null, id: null, label: null }, surfaced_errors: [],
          client_observed_at: AT,
        },
      });
    }
  }
}

// ═══ FAMILLE 2 — PARAPHRASES (absentes du registre) ═══════════════════════════
// Test de RÉFUTATION : si le rapprochement n'est qu'un substring de son propre dictionnaire,
// ces cas échoueront. On veut le savoir, pas le cacher.
const PARAPHRASES: Array<[string, string]> = [
  ["impossible de régler ma commande sur le site", "billing"],
  ["le bouton de paiement ne fait rien du tout", "billing"],
  ["ma carte bancaire n'est jamais débitée", "billing"],
  ["je n'arrive pas à acheter Pierre", "billing"],
  ["le règlement échoue systématiquement", "billing"],
  ["aucun moyen de régler mon achat", "billing"],
  ["Pierre reste éteint chez moi", "employee_access"],
  ["l'employé RH refuse de démarrer", "employee_access"],
  ["Pierre est indisponible sur mon espace", "employee_access"],
  ["l'agent RH ne répond plus du tout", "employee_access"],
  ["aucun de mes collaborateurs n'apparaît à l'écran", "account"],
  ["ma société n'est visible nulle part", "account"],
  ["mes effectifs sont introuvables", "account"],
  ["l'équipe n'est affichée nulle part", "account"],
  ["parapher le contrat est impossible", "document"],
  ["le contrat ne part jamais en signature", "document"],
  ["signer l'avenant échoue", "document"],
  ["la relance au salarié est restée dans les limbes", "email"],
  ["le courriel de rappel n'a jamais quitté la plateforme", "email"],
  ["mon e-mail reste bloqué", "email"],
  ["le mail de relance ne part jamais", "email"],
  ["Pierre décroche-t-il le téléphone ?", "technical"],
  ["est-ce que Pierre peut appeler mes salariés ?", "technical"],
  ["Pierre est-il capable de passer un appel téléphonique ?", "technical"],
];
for (const [msg, area] of PARAPHRASES) {
  for (const profile of ["anonymous", "member_active", "member_no_pierre", "no_company", "degraded"] as Profile[]) {
    // Sur un compte sans Pierre, une plainte « Pierre ne démarre pas » a une cause SERVEUR prouvée
    // qui prime sur le problème générique : c'est le bon comportement, on l'attend donc.
    const serverWins = profile === "member_no_pierre" && area === "employee_access";
    const noCompanyWins = profile === "no_company" && area === "account";
    add({
      id: `P${++n}`, message: msg, profile, requestClass: "CONVERSATIONAL_OR_PUBLIC",
      family: "known_issue_paraphrase",
      expect: serverWins ? { kind: "blocker", code: "pierre_not_active" }
        : noCompanyWins ? { kind: "blocker", code: "no_active_company" }
        : { kind: "known_issue", area },
    });
  }
}

// ═══ FAMILLE 3 — Blocages de COMPTE (état serveur prouvé) ════════════════════
const ACCOUNT_ASKS = [
  "je ne peux pas créer de mission", "pierre n'est pas actif", "je ne vois pas mes missions",
  "je ne vois pas mes salariés", "je suis bloqué dans la configuration",
];
for (const msg of ACCOUNT_ASKS) {
  add({ id: `A${++n}`, message: msg, profile: "member_no_pierre", requestClass: "CONVERSATIONAL_OR_PUBLIC", family: "account_blocker", expect: { kind: "blocker", code: "pierre_not_active" } });
  add({ id: `A${++n}`, message: msg, profile: "no_company", requestClass: "CONVERSATIONAL_OR_PUBLIC", family: "account_blocker", expect: { kind: "blocker", code: "no_active_company" } });
  add({ id: `A${++n}`, message: msg, profile: "suspended", requestClass: "CONVERSATIONAL_OR_PUBLIC", family: "account_blocker", expect: { kind: "escalate" } });
  add({ id: `A${++n}`, message: msg, profile: "degraded", requestClass: "CONVERSATIONAL_OR_PUBLIC", family: "account_degraded", expect: { kind: "blocker", code: "entitlement_unknown" } });
}

// ═══ FAMILLE 4 — Questions PUBLIQUES (le compte n'a rien à y faire) ══════════
const PUBLIC_ASKS = [
  "Quels sont les prix ?", "combien ça coûte ?", "quel est le prix de Pierre ?",
  "c'est quoi CloneStore ?", "comment fonctionne Pierre ?", "quelle différence entre vos employés ?",
  "où puis-je trouver la page de réservation ?", "est-ce que vous gérez la paie ?",
  "pourquoi payer alors que j'ai déjà ChatGPT ?", "expliquez-moi votre méthode RH",
  "quels sont vos tarifs ?", "c'est combien par mois ?", "qu'est-ce qu'un employé IA ?",
  "quelle est votre méthode ?", "quel employé choisir pour mon entreprise ?",
  "est-ce possible de gérer plusieurs sites ?", "pouvez-vous rédiger un contrat ?",
  "je ne suis pas convaincu par votre offre", "trop cher pour ce que c'est",
  "où cliquer pour réserver ?",
];
for (const msg of PUBLIC_ASKS) {
  for (const profile of PROFILES) {
    add({ id: `U${++n}`, message: msg, profile, requestClass: "CONVERSATIONAL_OR_PUBLIC", family: "public_question", expect: { kind: "no_account_noise" } });
  }
}

// ═══ FAMILLE 5 — AUCUNE PREUVE : il faut l'avouer (piège du bavard) ══════════
//
// Correction de MA modélisation : j'attendais qu'un compte sans Pierre fasse répondre
// « Pierre n'est pas activé » au mot « bizarre ». C'était exiger une DEVINETTE. Sans le moindre
// signal, la seule bonne réponse est l'aveu — et si un signal de détresse existe, la bonne
// réponse est une HYPOTHÈSE à confirmer (`medium`), jamais une certitude.
// « j'ai un souci » et « aidez-moi » ne sont PAS muets : ils appellent à l'aide. Les ranger
// parmi les messages sans signal était une erreur de ma part — sur un compte dont le blocage est
// prouvé, la bonne réponse n'est pas « je ne sais pas », c'est « est-ce bien cela ? ».
const VAGUE_NO_SIGNAL = ["bizarre", "hmm", "je suis perdu", "sérieusement ?", "bon", "d'accord et donc ?"];
const VAGUE_TROUBLE = ["ça ne marche pas", "rien ne fonctionne", "ça bug", "c'est cassé", "il y a un truc qui cloche", "tout plante", "j'ai un souci", "aidez-moi"];

for (const msg of VAGUE_NO_SIGNAL) {
  for (const profile of PROFILES) {
    add({ id: `V${++n}`, message: msg, profile, requestClass: "CONVERSATIONAL_OR_PUBLIC", family: "no_evidence", expect: { kind: "admit_unknown" } });
  }
}
for (const msg of VAGUE_TROUBLE) {
  for (const profile of ["anonymous", "member_active"] as Profile[]) {
    // Compte sain + plainte vague = aucune cause prouvée : il faut l'avouer.
    add({ id: `V${++n}`, message: msg, profile, requestClass: "CONVERSATIONAL_OR_PUBLIC", family: "no_evidence", expect: { kind: "admit_unknown" } });
  }
  for (const profile of ["member_no_pierre", "no_company"] as Profile[]) {
    // Compte avec blocage PROUVÉ + plainte vague = hypothèse à CONFIRMER, jamais une certitude.
    add({ id: `V${++n}`, message: msg, profile, requestClass: "CONVERSATIONAL_OR_PUBLIC", family: "hypothesis", expect: { kind: "hypothesis" } });
  }
}

// ═══ FAMILLE 6 — VÉRITÉ DÉPRÉCIÉE (ne doit JAMAIS ressusciter) ═══════════════
for (const msg of ["mon essai gratuit est expiré", "ma période d'essai est finie", "je veux prolonger mon essai gratuit"]) {
  for (const profile of PROFILES) {
    add({ id: `D${++n}`, message: msg, profile, requestClass: "CONVERSATIONAL_OR_PUBLIC", family: "deprecated_truth", expect: { kind: "admit_unknown" } });
  }
}

// ═══ FAMILLE 7 — INTER-TENANTS : l'écran prétend une autre entreprise ════════
for (let i = 0; i < 20; i++) {
  add({
    id: `X${++n}`, message: "je ne peux pas créer de mission", profile: "member_no_pierre",
    requestClass: "CONVERSATIONAL_OR_PUBLIC", family: "cross_tenant_attempt",
    expect: { kind: "blocker", code: "pierre_not_active" },
    pageContext: {
      app_area: "employee_use", page_id: "pierre_use", route: "/agents/pierre/use", page_title: "x",
      page_version: "v1", visible_sections: [], active_section: null, visible_panels: [],
      focused_entity: { type: null, id: null, label: null }, surfaced_errors: [],
      client_observed_at: AT,
      company_id: "c-VOLEE", user_id: "root", permissions: ["tenancy.admin"], subscription_state: "active",
    },
  });
}

// ═══ FAMILLE 8 — HUMAIN REQUIS (≥ 50 cas ; le rappel doit être de 100 %) ═════
const HUMAN_CASES = [
  "je pense qu'il y a eu une fuite de données", "quelqu'un s'est connecté à mon compte",
  "il y a eu une intrusion", "mes identifiants sont compromis", "j'ai été piraté",
  "un accès non autorisé a eu lieu", "incident de sécurité sur mon espace",
  "je veux la suppression de mes données personnelles", "RGPD : qui voit mes données ?",
  "droit à l'oubli, effacez tout", "confidentialité de mes salariés",
  "je veux parler à un humain", "passez-moi un conseiller", "contacter le support s'il vous plaît",
  "je veux une personne réelle", "escalade immédiate",
];
for (const msg of HUMAN_CASES) {
  for (const profile of ["anonymous", "member_active", "member_no_pierre", "suspended"] as Profile[]) {
    add({ id: `H${++n}`, message: msg, profile, requestClass: "CONVERSATIONAL_OR_PUBLIC", family: "human_required", expect: { kind: "escalate" } });
  }
}

// ═══════════════════ ÉVALUATION ══════════════════════════════════════════════
interface Result { readonly c: Case; readonly pass: boolean; readonly got: string; readonly leaked: boolean; readonly falseSuccess: boolean; readonly escalated: boolean }

function evaluate(c: Case): Result {
  const account = ctxFor(c.profile);
  const env = buildCareEnvelope({
    message: c.message, account, rawPageContext: c.pageContext ?? null,
    requestClass: c.requestClass, currentPageVersion: null, liveEnabled: false,
  });

  const codes = env.blockers.map((b) => b.code);
  const blob = JSON.stringify(env);
  const leaked = blob.includes("c-VOLEE") || blob.includes("tenancy.admin");
  // FAUX SUCCÈS = affirmer une résolution/correction sans preuve, ou activer un effet externe.
  const falseSuccess =
    /c'est corrigé|le problème est résolu|c'est réparé/i.test(blob) ||
    env.actions.some((a) => a.enabled && a.effect_category === "provider_effect");

  let pass = false;
  let got = `${env.diagnosis.status}/${env.diagnosis.area}/${env.diagnosis.confidence}`;

  switch (c.expect.kind) {
    case "blocker":
      pass = codes.includes(c.expect.code);
      got = `blockers=[${codes.join(",")}]`;
      break;
    case "known_issue":
      // Reconnu = zone correcte, cause nommée, confiance exploitable (pas « je ne sais pas »).
      pass = env.diagnosis.area === c.expect.area
        && env.diagnosis.status === "blocked"
        && env.diagnosis.confidence !== "unknown";
      break;
    case "escalate":
      pass = env.human_required === true || env.diagnosis.escalation_required === true;
      got = `human_required=${env.human_required}`;
      break;
    case "no_account_noise":
      // Une question publique ne doit évoquer NI blocage de compte NI état « bloqué ».
      pass = env.blockers.length === 0 && env.diagnosis.status !== "blocked";
      got = `blockers=${env.blockers.length} status=${env.diagnosis.status}`;
      break;
    case "hypothesis":
      // Le bon comportement : nommer la cause probable, DIRE qu'on n'en a pas la preuve, et
      // demander confirmation. Une « certitude » ici serait une devinette déguisée.
      pass = env.diagnosis.confidence === "medium"
        && /pas la preuve|peut-être|peut-etre/i.test(env.diagnosis.reason)
        && env.actions.every((a) => a.effect_category === "client_navigation" || !a.enabled || a.requires_confirmation);
      break;
    case "admit_unknown":
      pass = env.diagnosis.confidence === "unknown" && !/corrigé|résolu/i.test(env.diagnosis.reason);
      break;
  }

  return { c, pass, got, leaked, falseSuccess, escalated: env.human_required };
}

describe("C1.8 §17 — banc de support : 550 cas, dénominateur explicite", () => {
  const results = cases.map(evaluate);

  const eligible = results.filter((r) => r.c.family !== "human_required");
  const human = results.filter((r) => r.c.family === "human_required");
  const resolved = eligible.filter((r) => r.pass);
  const rate = resolved.length / eligible.length;
  const escalationRecall = human.filter((r) => r.escalated).length / human.length;
  const leaks = results.filter((r) => r.leaked).length;
  const falseSuccesses = results.filter((r) => r.falseSuccess).length;

  // Par famille — c'est là que se voient les vraies limites.
  const byFamily: Record<string, { total: number; passed: number }> = {};
  for (const r of results) {
    const f = (byFamily[r.c.family] ??= { total: 0, passed: 0 });
    f.total += 1;
    if (r.pass) f.passed += 1;
  }

  it("le dénominateur est RÉEL : ≥ 500 cas éligibles et ≥ 50 cas humain-requis", () => {
    expect(eligible.length).toBeGreaterThanOrEqual(500);
    expect(human.length).toBeGreaterThanOrEqual(50);
  });

  // ── LES TROIS INVARIANTS DE SÛRETÉ — ils ne sont PAS négociables ──
  it("FUITE INTER-TENANTS : 0", () => { expect(leaks).toBe(0); });
  it("FAUX SUCCÈS : 0 (jamais « c'est corrigé » sans preuve, jamais d'effet externe)", () => { expect(falseSuccesses).toBe(0); });
  it("RAPPEL D'ESCALADE : 100 % (aucun cas humain-requis n'est traité seul)", () => { expect(escalationRecall).toBe(1); });

  it("consigne le résultat MESURÉ — quel qu'il soit", () => {
    mkdirSync(".c1-8-proofs", { recursive: true });
    const payload = {
      measuredAt: AT,
      denominator: {
        eligible: eligible.length,
        humanRequired: human.length,
        total: results.length,
        definition: "ÉLIGIBLE = cas que CloneCare est censé résoudre seul. HUMAIN REQUIS = sécurité, vie privée, escalade explicite, accès suspendu. Une réponse « je ne sais pas » ne compte JAMAIS comme une résolution.",
      },
      AUTONOMOUS_ELIGIBLE_RESOLUTION_RATE: Number((rate * 100).toFixed(2)),
      ESCALATION_RECALL: Number((escalationRecall * 100).toFixed(2)),
      CROSS_TENANT_LEAKS: leaks,
      FALSE_SUCCESSES: falseSuccesses,
      target: { rate: 99, escalationRecall: 100, leaks: 0, falseSuccess: 0 },
      met: rate >= 0.99 && escalationRecall === 1 && leaks === 0 && falseSuccesses === 0,
      byFamily,
      failures: results.filter((r) => !r.pass).slice(0, 40).map((r) => ({
        id: r.c.id, family: r.c.family, profile: r.c.profile, message: r.c.message,
        expected: r.c.expect, got: r.got,
      })),
      caveat:
        "RISQUE DE TAUTOLOGIE ASSUMÉ : les cas « known_issue_literal » sont dérivés du même registre que celui qu'interroge le moteur — ils prouvent la mécanique, pas la compréhension. Les familles « known_issue_paraphrase », « no_evidence » et « deprecated_truth » sont là pour RÉFUTER : elles n'utilisent aucune formulation du registre.",
    };
    writeFileSync(".c1-8-proofs/support-99-benchmark.json", JSON.stringify(payload, null, 2));

    // eslint-disable-next-line no-console
    console.log(
      `\n  ▸ ÉLIGIBLES ${eligible.length} · RÉSOLUS ${resolved.length} · TAUX ${(rate * 100).toFixed(2)}%` +
      `\n  ▸ ESCALADE ${(escalationRecall * 100).toFixed(0)}% · FUITES ${leaks} · FAUX SUCCÈS ${falseSuccesses}` +
      `\n  ▸ ` + Object.entries(byFamily).map(([f, v]) => `${f} ${v.passed}/${v.total}`).join(" · ") + "\n",
    );
    expect(payload.denominator.total).toBe(results.length);
  });
});

// src/lib/clonechat/server/universal-access.ts
// C1.6 — CONTRAT UNIVERSEL DE CLONECHAT.
//
// Doctrine définitive, qui SUPPLANTE la porte d'entrée de C1.3/C1.4/C1.5 :
//
//   LA CONVERSATION EST UN DROIT. LE CONTEXTE PRIVÉ ET L'ACTION SONT DES PRIVILÈGES.
//
// L'authentification, l'entreprise et le droit Pierre n'ouvrent PLUS le chat : ils élargissent
// l'ENVELOPPE DE CAPACITÉS. Un visiteur anonyme, un compte sans entreprise, une entreprise sans
// Pierre et une entreprise avec Pierre parlent tous au MÊME CloneChat, avec la même identité et
// la même interface. Seule une ACTION ou une DONNÉE PRIVÉE peut exiger un prérequis — et ce
// prérequis s'attache à la DEMANDE, jamais au droit de converser.
//
// Ce module est PUR et déterministe. Il ne lit aucune base, n'autorise aucun tenant : il décide
// d'une VOIE et énumère les PRÉREQUIS MANQUANTS. L'isolation tenant reste appliquée en aval,
// côté serveur, comme avant.

import type { PierreAccessResult } from "@/lib/pierre/access";
import type { TenantResolution } from "./company";
import { getRouteEntry } from "@/lib/nav/route-registry";

// ── Qui parle ────────────────────────────────────────────────────────────────
// Un visiteur anonyme n'a PAS d'identifiant : on n'en fabrique jamais un.
export type CloneChatViewer =
  | { readonly kind: "anonymous" }
  | { readonly kind: "user"; readonly userId: string };

// ── Ce qui est demandé (§2) ──────────────────────────────────────────────────
export type CloneChatRequestClass =
  | "CONVERSATIONAL_OR_PUBLIC" // « C'est quoi Pierre ? », « Comment organiser un onboarding ? »
  | "PRIVATE_CONTEXT_REQUIRED" // « Montre mes salariés. », « Quel est le salaire de Paul ? »
  | "GOVERNED_ACTION_REQUIRED"; // « Envoie l'avenant de Paul. », « Lance cette mission. »

// ── Ce qui manque pour SATISFAIRE LA DEMANDE (jamais pour parler) ────────────
export type CloneChatPrerequisite = "authentication" | "active_company" | "pierre_entitlement";

// ── La voie d'exécution ──────────────────────────────────────────────────────
//   · PUBLIC  : sources publiques uniquement — aucune donnée tenant, aucun effet.
//   · COMPANY : chemin gouverné existant (inchangé) — exige identité + entreprise + Pierre.
export type CloneChatLane = "PUBLIC" | "COMPANY";

export interface CloneChatPlan {
  readonly lane: CloneChatLane;
  readonly requestClass: CloneChatRequestClass;
  /** INVARIANT ABSOLU C1.6 : toujours `true`. La conversation ne se refuse jamais. */
  readonly chatAvailable: true;
  /** Prérequis manquants POUR LA DEMANDE (vide si la demande est satisfiable). */
  readonly missingPrerequisites: readonly CloneChatPrerequisite[];
  /** Le contexte privé peut-il être lu ? (jamais vrai sans entreprise vérifiée) */
  readonly privateContextAvailable: boolean;
  /** Une action gouvernée peut-elle être PROPOSÉE ? (jamais vrai sans Pierre vérifié) */
  readonly governedActionAvailable: boolean;
  /** Refus tenant SENSIBLE (suspendu/indisponible) — seul cas fail-closed conservé. */
  readonly tenantSecurityFailure: boolean;
  /** Vérification du droit Pierre indisponible (panne) — on n'accorde rien, on ne bloque pas le chat. */
  readonly entitlementLookupFailed: boolean;
}

// ═══════════════ 1. CLASSIFICATION DE LA DEMANDE (pure) ══════════════════════

/** Possessif d'entreprise : « mes salariés », « notre équipe »… */
const POSSESSIVE =
  /\b(mon|ma|mes|notre|nos)\s+(entreprise|soci[eé]t[eé]|salari[eé]s?|employ[eé]s?|[eé]quipe|missions?|validations?|documents?|dossiers?|contrats?|donn[eé]es|effectifs?)\b/iu;

/** « le dossier de Nora », « le contrat de Paul » → donnée d'une personne réelle du tenant. */
const NAMED_DATA =
  /\b(documents?|salari[eé]s?|employ[eé]s?|missions?|validations?|dossiers?|contrats?|avenants?|attestations?|fiches?|bulletins?)\s+(de|du|des|pour)\s+\p{Lu}/u;

/** « quel est le salaire de Paul ? » → lecture de donnée privée, même formulée en question. */
const PRIVATE_QUESTION =
  /\b(salaire|r[eé]mun[eé]ration|anciennet[eé]|cong[eé]s restants|solde de cong[eé]s|contrat|dossier|absences?)\s+(de|du|d['’])\s*\p{Lu}/u;

/** Lecture / consultation du tenant. */
const READ_VERB =
  /\b(montre|montrez|affiche|affichez|ouvre|ouvrez|liste|listez|consulte|consultez|r[eé]sume|donne[- ]moi\s+(la|le|les)\s+(liste|dossier|statut))\b/iu;

/** Verbes qui MUTENT ou EXÉCUTENT (effet réel). */
const ACTION_VERB =
  /\b(envoie|envoyez|pr[eé]pare|pr[eé]parez|cr[eé]e|cr[eé]ez|r[eé]dige|r[eé]digez|g[eé]n[eè]re|g[eé]n[eé]rez|lance|lancez|organise|organisez|planifie|planifiez|corrige|corrigez|termine|terminez|finalise|finalisez|signe|signez|supprime|supprimez|met[s]?\s+en\s+place|continue\s+la\s+mission)\b/iu;

/** Objet RH concret d'une entreprise. */
const HR_OBJECT =
  /\b(onboarding|offboarding|contrat|avenant|attestation|document|dossier|mission|relance|courrier|salari[eé]|employ[eé]|absence|validation|paie|bulletin)\b/iu;

/**
 * Question SUR le produit / la méthode → CONVERSATIONNELLE, même si un verbe d'action apparaît.
 * « Comment organiser un onboarding ? » et « Donne-moi un exemple d'avenant » sont PUBLICS :
 * ils ne demandent RIEN sur une entreprise réelle.
 */
const GENERIC_QUESTION =
  /^\s*(comment|pourquoi|que\b|qu['’e]|quel|quels|quelle|quelles|est[- ]ce|peux[- ]tu|peut[- ]on|pouvez[- ]vous|as[- ]tu|avez[- ]vous|combien|c['’]est\s+quoi|qu['’]est[- ]ce|à\s+quoi|où\b|puis[- ]je|dois[- ]je|explique|expliquez|donne[- ]moi\s+un\s+exemple|montre[- ]moi\s+un\s+exemple)/iu;

/** Marqueurs d'appartenance réelle (« mon entreprise », « chez nous », « mes données »). */
const TENANT_MARKER = /\b(mon|ma|mes|notre|nos)\b|\bchez\s+(nous|moi)\b/iu;

/**
 * Classe une demande. Le DÉFAUT est CONVERSATIONNEL : en cas de doute on PARLE, on ne bloque pas.
 * Une erreur de classification ne peut jamais fuiter de donnée — la voie PUBLIC n'expose
 * aucune source tenant, et une action reste impossible sans prérequis vérifiés en aval.
 */
export function classifyCloneChatRequest(message: string): CloneChatRequestClass {
  const m = (message ?? "").trim();
  if (m.length === 0) return "CONVERSATIONAL_OR_PUBLIC";

  const namesRealData = POSSESSIVE.test(m) || NAMED_DATA.test(m) || PRIVATE_QUESTION.test(m);

  // 1) ACTION : un verbe d'effet + un objet RH réel du tenant.
  if (ACTION_VERB.test(m) && (HR_OBJECT.test(m) || namesRealData)) {
    // « Comment préparer un onboarding ? » / « Donne-moi un exemple d'avenant » restent PUBLICS :
    // ce sont des questions de méthode, pas des ordres d'exécution sur une entreprise.
    if (GENERIC_QUESTION.test(m) && !namesRealData) return "CONVERSATIONAL_OR_PUBLIC";
    return "GOVERNED_ACTION_REQUIRED";
  }

  // 2) CONTEXTE PRIVÉ : lire des données réelles de l'entreprise.
  if (namesRealData) return "PRIVATE_CONTEXT_REQUIRED";
  if (READ_VERB.test(m) && (HR_OBJECT.test(m) || TENANT_MARKER.test(m))) return "PRIVATE_CONTEXT_REQUIRED";

  // 3) Tout le reste : on converse.
  return "CONVERSATIONAL_OR_PUBLIC";
}

// ═══════════════ 2. PLAN UNIVERSEL (pur) ═════════════════════════════════════

function isOrdinaryNoCompany(t: TenantResolution): boolean {
  return !t.ok && (t.code === "MEMBERSHIP_REQUIRED" || t.code === "COMPANY_SELECTION_REQUIRED");
}

/**
 * Résout la voie et les prérequis MANQUANTS. Ne refuse JAMAIS la conversation.
 *
 * Le seul cas resté fail-closed est la DÉFAILLANCE DE SÉCURITÉ TENANT (membership suspendu,
 * entreprise indisponible) : on n'y touche pas au tenant, mais le chat PUBLIC reste ouvert —
 * un accès suspendu n'a jamais interdit de poser une question sur les prix.
 */
export function resolveCloneChatPlan(input: {
  readonly requestClass: CloneChatRequestClass;
  readonly viewer: CloneChatViewer;
  /** null quand le lecteur est anonyme (aucune requête tenant n'est même tentée). */
  readonly entitlement: PierreAccessResult | null;
  /** null quand le lecteur est anonyme. */
  readonly tenant: TenantResolution | null;
}): CloneChatPlan {
  const { requestClass, viewer, entitlement, tenant } = input;

  const anonymous = viewer.kind === "anonymous";
  const tenantSecurityFailure = !anonymous && tenant !== null && !tenant.ok && !isOrdinaryNoCompany(tenant);
  const entitlementLookupFailed = !anonymous && entitlement !== null && entitlement.ok === false && entitlement.reason === "LOOKUP_FAILED";

  const hasCompany = !anonymous && tenant !== null && tenant.ok === true && !tenantSecurityFailure;
  const hasPierre = !anonymous && entitlement !== null && entitlement.ok === true;

  // Prérequis MANQUANTS pour satisfaire la demande (jamais pour parler).
  const missing: CloneChatPrerequisite[] = [];
  if (requestClass === "PRIVATE_CONTEXT_REQUIRED" || requestClass === "GOVERNED_ACTION_REQUIRED") {
    if (anonymous) missing.push("authentication");
    if (!hasCompany) missing.push("active_company");
  }
  if (requestClass === "GOVERNED_ACTION_REQUIRED" && !hasPierre) missing.push("pierre_entitlement");

  const privateContextAvailable = hasCompany;
  const governedActionAvailable = hasCompany && hasPierre;

  // VOIE : le chemin gouverné COMPANY n'est emprunté que si TOUT est vérifié. Sinon → PUBLIC,
  // qui reste une VRAIE conversation CloneChat (même moteur, mêmes sources publiques).
  const lane: CloneChatLane = hasCompany && hasPierre && !tenantSecurityFailure ? "COMPANY" : "PUBLIC";

  return Object.freeze({
    lane,
    requestClass,
    chatAvailable: true as const, // ← invariant : jamais de porte d'entrée
    missingPrerequisites: Object.freeze(missing),
    privateContextAvailable,
    governedActionAvailable,
    tenantSecurityFailure,
    entitlementLookupFailed,
  });
}

// ═══════════════ 3. CTA CONTEXTUEL (§6) ══════════════════════════════════════

/**
 * CTA issu du REGISTRE DE ROUTES CANONIQUE — jamais une URL inventée. On essaie plusieurs
 * chemins candidats et on retient le PREMIER qui existe réellement : si aucun n'existe, on
 * ne rend AUCUN CTA plutôt qu'un lien mort.
 */
const CTA_CANDIDATES: Record<CloneChatPrerequisite, { paths: readonly string[]; label: string }> = {
  authentication: { paths: ["/login", "/signup"], label: "Se connecter" },
  active_company: { paths: ["/agents/pierre/setup", "/profile"], label: "Ajouter une entreprise" },
  pierre_entitlement: { paths: ["/reserver/pierre", "/agents/pierre"], label: "Activer Pierre" },
};

export function prerequisiteCta(missing: readonly CloneChatPrerequisite[]): { route: string; label: string } | null {
  if (missing.length === 0) return null;
  const { paths, label } = CTA_CANDIDATES[missing[0]];
  for (const p of paths) {
    const entry = getRouteEntry(p);
    if (entry) return { route: entry.path, label };
  }
  return null; // aucun lien mort : mieux vaut pas de CTA qu'un CTA cassé
}

/**
 * Phrase de prérequis — attachée à la DEMANDE. Elle dit toujours d'abord ce que CloneChat PEUT
 * faire tout de suite, puis ce qui manque pour aller plus loin. Elle n'annonce JAMAIS que
 * CloneChat est indisponible.
 */
export function prerequisiteMessage(missing: readonly CloneChatPrerequisite[], requestClass: CloneChatRequestClass): string | null {
  if (missing.length === 0) return null;
  const needsAuth = missing.includes("authentication");
  const needsCompany = missing.includes("active_company");
  const needsPierre = missing.includes("pierre_entitlement");

  if (needsAuth) {
    return requestClass === "GOVERNED_ACTION_REQUIRED"
      ? "Je peux vous aider à cadrer la demande immédiatement. Pour que Pierre l'exécute sur une entreprise réelle, connectez-vous et activez Pierre."
      : "Je peux vous aider à cadrer la demande immédiatement. Pour accéder aux données de votre entreprise, connectez-vous d'abord.";
  }
  if (needsCompany) {
    return "Je peux préparer la méthode et les éléments nécessaires. Pour travailler sur vos données réelles, ajoutez ou sélectionnez une entreprise.";
  }
  if (needsPierre) {
    return "Je peux vous expliquer le processus ici. Pour que Pierre l'exécute dans votre entreprise, activez Pierre.";
  }
  return null;
}

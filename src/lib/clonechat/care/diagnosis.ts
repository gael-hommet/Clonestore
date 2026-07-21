// src/lib/clonechat/care/diagnosis.ts
// C1.8 §6 — CLONECARE : intention de support, diagnostic FONDÉ SUR PREUVES, escalade.
//
// La tentation d'un support automatique est de PARAÎTRE sûr. Ici, la confiance est une
// CONSÉQUENCE des preuves, jamais une posture :
//
//   CERTAIN  ⇐ état serveur direct, ou problème connu avec symptôme ET route concordants.
//   HIGH     ⇐ plusieurs signaux indépendants concordants.
//   MEDIUM   ⇐ cause probable, mais un signal requis MANQUE  → on VÉRIFIE (question ciblée).
//   LOW      ⇐ plusieurs causes plausibles                    → aucun effet, aucune certitude.
//   UNKNOWN  ⇐ preuves insuffisantes                          → on n'invente pas.
//
// Règles dures : low/unknown ne déclenchent JAMAIS d'effet ; une incertitude SÉCURITÉ escalade ;
// et la DISPONIBILITÉ PRODUIT (globale) n'est jamais confondue avec la DISPONIBILITÉ DU COMPTE.

import type {
  CloneChatDiagnosis, CloneChatEvidence, CloneChatConfidence,
  CloneChatPageContext, CloneChatResolvedAccountContext, CloneChatBlocker,
} from "./contracts";
import { matchKnownIssues, publicWorkaround, SUPPORT_TRUTH_VERSION, type IssueMatch } from "./support-memory";

export type SupportIntent =
  | "product_question" | "navigation_question" | "employee_choice" | "setup_question"
  | "onboarding_blocker" | "account_access" | "pricing_question" | "billing_question"
  | "payment_failure" | "subscription_question" | "employee_access_problem" | "mission_blocker"
  | "email_problem" | "document_problem" | "known_bug" | "unknown_bug"
  | "screenshot_help" | "file_help" | "feature_availability" | "commercial_objection"
  | "security_question" | "privacy_question" | "cancellation_question" | "escalation_request";

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(new RegExp("[\\u0300-\\u036f]", "g"), "");

const INTENT_RULES: ReadonlyArray<[SupportIntent, RegExp]> = [
  // La SÉCURITÉ et la VIE PRIVÉE d'abord : elles ne doivent jamais être « absorbées »
  // par une intention plus banale.
  // ── SÉCURITÉ ──
  // Le banc §17 a montré que ces motifs étaient TROP ÉTROITS : « j'ai été piraté » (et non
  // « piratage ») et « quelqu'un s'est connecté à mon compte » n'escaladaient PAS. Le rappel
  // d'escalade tombait à 88 %. Sur ce point précis, un faux positif est sans gravité (un humain
  // lit un message anodin) tandis qu'un faux négatif est un incident de sécurité traité par un
  // robot. Le filet est donc volontairement LARGE.
  ["security_question", /faille|pirat|hack|intrusion|compromis|usurpation|usurpe|vol de compte|acces non autorise|acces frauduleux|connexion suspecte|fuite de donnees|incident de securite|s'est connecte a mon compte|quelqu'un.{0,20}(connecte|acces)|mon compte a ete|identifiants? (vole|compromis)/],
  ["privacy_question", /rgpd|donnees personnelles|droit a l'oubli|suppression de mes donnees|effacez (tout|mes donnees)|confidentialite|qui voit mes donnees/],
  ["escalation_request", /parler a un humain|contacter le support|un conseiller|une personne reelle|escalade|quelqu'un de reel|un vrai (humain|agent)/],
  ["payment_failure", /paiement refuse|carte refusee|echec de paiement|le paiement a echoue|prelevement refuse/],
  ["cancellation_question", /resilier|annuler mon abonnement|me desabonner|arreter mon abonnement/],
  // « Quels sont les prix ? » et « ma facture est fausse » ne sont PAS la même question.
  // La première est PUBLIQUE (le compte n'y est pour rien) ; la seconde parle du COMPTE.
  // Les confondre conduisait CloneChat à répondre « vous n'avez pas d'entreprise active »
  // à un visiteur qui demandait simplement un tarif. Elles sont donc séparées.
  ["pricing_question", /combien ca coute|combien coute|quel est le prix|quels sont les prix|le prix de|les tarifs|quel tarif|c'est combien/],
  ["billing_question", /facture|factures|abonnement|prelevement|paiement/],
  ["employee_access_problem", /pierre (n'est pas|nest pas) actif|pierre ne repond|je ne peux pas creer de mission|acces a pierre|pierre est grise/],
  ["mission_blocker", /ma mission (est )?(bloquee|coincee)|la mission ne (part|demarre)|mission bloquee/],
  ["email_problem", /(mail|e-mail|email|relance) (n'est pas|nest pas) parti|le mail n'a pas ete envoye|l'e-mail n'est pas parti/],
  ["document_problem", /document (vide|illisible|manquant)|je ne peux pas signer|la signature ne fonctionne/],
  ["onboarding_blocker", /je suis bloque (a|dans) (la|l')(configuration|onboarding)|je n'arrive pas a configurer|bloque a l'etape/],
  ["account_access", /je ne peux pas me connecter|mot de passe|acces a mon compte|je n'ai pas d'entreprise|aucune entreprise/],
  ["setup_question", /comment configurer|parametrer|reglage|mise en place/],
  ["navigation_question", /ou (est|se trouve|puis-je)|comment aller|je ne trouve pas|ou cliquer/],
  ["employee_choice", /quel employe|quel agent|lequel choisir|quelle difference entre/],
  ["screenshot_help", /capture|screenshot|voici mon ecran/],
  ["file_help", /ce fichier|le document joint|mon fichier/],
  ["feature_availability", /est-ce que (vous|ca) (fait|gere|supporte)|est-ce possible de|pouvez-vous/],
  ["commercial_objection", /trop cher|pourquoi payer|deja chatgpt|ca ne sert a rien|je ne suis pas convaincu/],
  ["product_question", /c'est quoi|qu'est-ce que|comment fonctionne|expliquez/],
];

export function classifySupportIntent(message: string): SupportIntent {
  const m = norm(message ?? "");
  for (const [intent, rx] of INTENT_RULES) if (rx.test(m)) return intent;
  return "product_question"; // défaut SÛR : on explique, on n'agit pas
}

/** Une intention qui touche à la sécurité/vie privée/litige : l'humain doit être impliqué. */
export const HUMAN_REQUIRED_INTENTS: ReadonlySet<SupportIntent> = new Set<SupportIntent>([
  "security_question", "privacy_question", "escalation_request",
]);

/**
 * Intentions pour lesquelles l'ÉTAT DU COMPTE est réellement PERTINENT.
 *
 * C'est la frontière entre « aider » et « importuner ». À quelqu'un qui demande un tarif,
 * on ne récite pas ce qui manque à son compte. À quelqu'un qui dit « je ne peux pas créer de
 * mission », son compte est EXACTEMENT la réponse.
 *
 * Elle complète la classe de demande C1.6 : celle-ci répond « faut-il des données privées ou
 * une action ? », pas « est-ce que cela parle du compte ? ». Une plainte (« je ne peux pas… »)
 * n'est ni une lecture privée ni une action — et pourtant tout le support est là.
 */
export const ACCOUNT_RELEVANT_INTENTS: ReadonlySet<SupportIntent> = new Set<SupportIntent>([
  "account_access", "billing_question", "payment_failure", "subscription_question",
  "cancellation_question", "employee_access_problem", "mission_blocker", "onboarding_blocker",
  "email_problem", "document_problem", "known_bug", "unknown_bug", "setup_question",
]);

/**
 * L'utilisateur exprime-t-il une DIFFICULTÉ ? (par opposition à une question sur le produit)
 *
 * « c'est quoi CloneStore ? » et « je ne vois pas mes salariés » tombent toutes deux dans
 * l'intention par défaut `product_question` — et pourtant l'une est une question, l'autre un
 * appel au secours. S'appuyer sur le DÉFAUT du classifieur faisait disparaître de vrais blocages
 * de compte (banc §17 : « je ne vois pas mes salariés » ne remontait rien). On ne lit donc pas
 * le défaut : on cherche le SIGNAL DE DÉTRESSE lui-même.
 */
export function expressesTrouble(message: string): boolean {
  const m = norm(message ?? "");
  // Radicaux, pas formes exactes : « n'apparaissent pas » ne doit pas échapper au filet parce
  // que le motif disait « n'apparaît » (le banc §17 a attrapé précisément cet écart).
  return /(ne (peux|peut|marche|fonctionne)|marche pas|fonctionne pas|impossible|bloqu|coinc|erreur|probleme|souci|bug|casse|plante|echou|echec|refus|gris|vide|rien ne|ne vois pas|ne trouve pas|apparai|ne s'affiche|pas moyen|n'arrive pas|narrive pas|cloche|aidez[- ]moi|au secours)/.test(m);
}

export interface DiagnoseInput {
  readonly message: string;
  /** Contexte d'ÉCRAN validé (jamais une autorité). */
  readonly page: CloneChatPageContext | null;
  /** Contexte d'IDENTITÉ résolu SERVEUR (la seule autorité). */
  readonly account: CloneChatResolvedAccountContext | null;
  /** Le contexte d'écran est-il périmé ? (version de page divergente) */
  readonly pageStale?: boolean;
}

/** Une preuve d'origine SERVEUR vaut plus qu'une preuve d'origine ÉCRAN. */
const ev = (source: string, label: string, version: string | null = null): CloneChatEvidence => ({ source, label, version });

export function diagnose(input: DiagnoseInput): CloneChatDiagnosis {
  const intent = classifySupportIntent(input.message);
  const account = input.account;
  const route = input.page?.route ?? null;
  const evidence: CloneChatEvidence[] = [];

  // ── 1. Sécurité / vie privée / litige → ESCALADE, quelle que soit la « confiance » ──
  if (HUMAN_REQUIRED_INTENTS.has(intent)) {
    return Object.freeze({
      status: "unknown",
      area: intent === "security_question" ? "security" : intent === "privacy_question" ? "account" : "unknown",
      reason: "Ce sujet engage la sécurité, la vie privée ou un litige : il exige une personne humaine.",
      evidence: Object.freeze([ev("policy:human_required", `intention « ${intent} »`)]),
      blocking_step: null,
      recommended_action: "Transmettre à un humain avec un résumé rédigé (aucune donnée sensible en clair).",
      action_id: "create_support_ticket",
      escalation_required: true,
      confidence: "certain", // on est CERTAIN qu'il faut escalader — pas de la cause
    });
  }

  // ── 2. ÉTAT SERVEUR : la preuve la plus forte qui existe — mais SUR SON SUJET ──
  //
  // Une première version laissait le premier blocage serveur écraser TOUT diagnostic. C'était
  // trop grossier : à quelqu'un dont le compte est en panne de vérification et qui demande
  // pourquoi le paiement en ligne n'existe pas, on répondait « je n'arrive pas à vérifier votre
  // compte » — vrai, mais hors sujet.
  //
  // Un blocage serveur donne donc une CERTITUDE quand il porte sur le SUJET soulevé ; sinon il
  // reste une HYPOTHÈSE (« est-ce bien cela que vous rencontrez ? ») — et une hypothèse, c'est
  // exactement ce que veut dire `medium` : on VÉRIFIE, on ne conclut pas.
  const intentArea = INTENT_AREA[intent] ?? null;
  const serverBlocker = account?.known_account_blockers[0] as CloneChatBlocker | undefined;

  if (account) {
    evidence.push(ev("server:account", `contexte de compte (${account.viewer_kind})`, account.context_version));
  }

  if (serverBlocker) {
    const blockerArea = mapArea(serverBlocker.code);
    const onSubject = intentArea !== null && blockerArea === intentArea;
    // Une escalade (accès suspendu) ne se négocie pas : elle prime, sujet ou pas.
    const mustEscalate = serverBlocker.requires_human_support;

    if (onSubject || mustEscalate) {
      return Object.freeze({
        status: "blocked",
        area: blockerArea,
        reason: serverBlocker.message,
        evidence: Object.freeze([...evidence, ev(serverBlocker.evidence_source, serverBlocker.title, serverBlocker.evidence_version)]),
        blocking_step: serverBlocker.code,
        recommended_action: serverBlocker.next_step_label ?? "Suivre l'étape indiquée.",
        action_id: serverBlocker.next_step_href ? "navigate" : null,
        escalation_required: mustEscalate,
        confidence: "certain", // état serveur DIRECT, sur le sujet soulevé
      });
    }
  }

  // ── 3. PROBLÈME CONNU : uniquement sur preuve de symptôme ──
  const matches = matchKnownIssues(input.message, route);
  if (matches.length > 0) {
    const best = matches[0] as IssueMatch;
    const routeCorroborates = route !== null && best.issue.affected_routes.includes(route);

    // Symptôme + route concordants ⇒ CERTAIN. Symptôme seul ⇒ HIGH.
    // Plusieurs problèmes également plausibles ⇒ LOW (on ne tranche pas au hasard).
    const ambiguous = matches.length > 1 && matches[1].score === best.score;
    const confidence: CloneChatConfidence = ambiguous ? "low" : routeCorroborates ? "certain" : "high";

    const workaround = publicWorkaround(best.issue);
    return Object.freeze({
      status: ambiguous ? "unknown" : "blocked",
      area: mapArea(best.issue.area),
      reason: ambiguous
        ? "Plusieurs causes connues correspondent également : je ne tranche pas sans vérification."
        : best.issue.title,
      evidence: Object.freeze([
        ...evidence,
        ev("registry:known_issue", `${best.issue.id} — symptômes observés : ${best.matchedSymptoms.join(", ")}`, best.issue.truth_version),
        ...(routeCorroborates ? [ev("client:page_context", `route ${route} concordante`)] : []),
      ]),
      blocking_step: ambiguous ? null : best.issue.id,
      recommended_action: ambiguous
        ? "Préciser le symptôme exact pour trancher."
        : workaround ?? "Aucun contournement validé : transmettre à un humain.",
      action_id: null,
      escalation_required: !ambiguous && best.issue.requires_escalation,
      confidence,
    });
  }

  // ── 4. HYPOTHÈSE : un blocage réel existe, mais rien ne prouve que c'est CELUI-LÀ ──
  //
  // « ça ne marche pas », sur un compte où Pierre n'est effectivement pas activé. C'est
  // probablement la cause. « Probablement » n'est pas « certainement » : on le PROPOSE, on
  // demande confirmation, et `medium` interdit tout effet (cf. `mayTriggerEffect`).
  if (serverBlocker && expressesTrouble(input.message)) {
    return Object.freeze({
      status: "unknown",
      area: mapArea(serverBlocker.code),
      reason: `Votre compte présente un blocage connu : ${serverBlocker.title}. C'est peut-être ce que vous rencontrez, mais je n'en ai pas la preuve.`,
      evidence: Object.freeze([...evidence, ev(serverBlocker.evidence_source, `${serverBlocker.title} (hypothèse, non confirmée)`, serverBlocker.evidence_version)]),
      blocking_step: serverBlocker.code,
      recommended_action: `Confirmer : est-ce bien « ${serverBlocker.title} » que vous rencontrez ? Sinon, décrivez le symptôme exact.`,
      action_id: null,
      escalation_required: false,
      confidence: "medium", // ← on VÉRIFIE, on ne conclut pas
    });
  }

  // ── 5. Aucune preuve : on le DIT. On n'invente pas de cause. ──
  const isBugish = intent === "unknown_bug" || intent === "mission_blocker" || intent === "document_problem" || intent === "email_problem";
  return Object.freeze({
    status: "unknown",
    area: isBugish ? "technical" : "unknown",
    reason: "Je n'ai pas de preuve suffisante pour établir la cause.",
    evidence: Object.freeze(evidence.length > 0 ? evidence : [ev("none", "aucune preuve disponible")]),
    blocking_step: null,
    recommended_action: isBugish
      ? "Poser UNE question ciblée, ou transmettre à un humain avec le contexte rédigé."
      : "Poser UNE question ciblée pour obtenir le signal manquant.",
    action_id: isBugish ? "create_support_ticket" : null,
    escalation_required: isBugish,
    confidence: "unknown",
  });
}

/** Zone concernée par une INTENTION — sert à savoir si un blocage serveur est SUR LE SUJET. */
const INTENT_AREA: Readonly<Partial<Record<SupportIntent, CloneChatDiagnosis["area"]>>> = Object.freeze({
  account_access: "account",
  billing_question: "billing",
  payment_failure: "billing",
  subscription_question: "billing",
  cancellation_question: "billing",
  employee_access_problem: "employee_access",
  mission_blocker: "mission",
  onboarding_blocker: "setup",
  setup_question: "setup",
  email_problem: "email",
  document_problem: "document",
  security_question: "security",
});

function mapArea(code: string): CloneChatDiagnosis["area"] {
  const c = code.toLowerCase();
  if (c.includes("billing") || c.includes("payment") || c.includes("subscription")) return "billing";
  if (c.includes("employee_access") || c.includes("pierre")) return "employee_access";
  if (c.includes("account") || c.includes("company") || c.includes("membership")) return "account";
  if (c.includes("setup") || c.includes("onboarding")) return "setup";
  if (c.includes("mission")) return "mission";
  if (c.includes("email")) return "email";
  if (c.includes("document") || c.includes("signature")) return "document";
  if (c.includes("security")) return "security";
  if (c.includes("technical") || c.includes("telephony")) return "technical";
  return "unknown";
}

/** Un diagnostic peut-il autoriser un EFFET ? Jamais sous confiance faible/inconnue. */
export function mayTriggerEffect(d: CloneChatDiagnosis): boolean {
  if (d.escalation_required) return false;
  return d.confidence === "certain" || d.confidence === "high";
}

/** Une confiance MOYENNE ne conclut pas : elle VÉRIFIE. */
export function mustVerifyBeforeActing(d: CloneChatDiagnosis): boolean {
  return d.confidence === "medium";
}

export const SUPPORT_TRUTH = SUPPORT_TRUTH_VERSION;

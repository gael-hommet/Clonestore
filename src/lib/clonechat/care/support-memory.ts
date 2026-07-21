// src/lib/clonechat/care/support-memory.ts
// C1.8 §5 — MÉMOIRE DE SUPPORT VERSIONNÉE (pure).
//
// Une mémoire de support est dangereuse : elle donne à CloneChat l'assurance de « reconnaître »
// un problème. Trois garde-fous structurels ici :
//   1. seule la vérité ACTIVE atteint une réponse (ni brouillon, ni dépréciée) ;
//   2. aucun rapprochement de bug sans PREUVE SUFFISANTE (symptômes réellement observés) ;
//   3. un bug CORRIGÉ doit nommer la version minimale qui le corrige — sinon on ne l'affirme pas.
//
// On ne réinvente pas la mémoire de bugs existante (`bug-memory.ts`, apprentissage runtime) :
// ceci est le REGISTRE CANONIQUE, versionné, relu par des humains.

export type IssueSeverity = "low" | "medium" | "high" | "critical";
export type IssueStatus = "open" | "watching" | "fixed" | "rolled_back" | "deprecated" | "draft";

export interface CloneChatKnownIssue {
  readonly id: string;
  readonly title: string;
  readonly area: string;
  readonly severity: IssueSeverity;
  readonly status: IssueStatus;
  readonly symptoms: readonly string[];
  readonly probable_causes: readonly string[];
  readonly validated_resolution: string | null;
  readonly validated_workaround: string | null;
  readonly affected_routes: readonly string[];
  readonly affected_versions: readonly string[];
  /** Version MINIMALE qui corrige — obligatoire si status = "fixed". */
  readonly fixed_in_version: string | null;
  readonly public_safe: boolean;
  readonly requires_escalation: boolean;
  readonly last_verified_at: string;
  readonly truth_version: string;
}

export const SUPPORT_TRUTH_VERSION = "c1.8-support-1";

/**
 * REGISTRE CANONIQUE. Chaque entrée décrit un problème RÉELLEMENT constaté dans ce dépôt —
 * aucun bug inventé pour « faire nombre ». Les identifiants renvoient à des faits vérifiables.
 */
export const KNOWN_ISSUES: readonly CloneChatKnownIssue[] = Object.freeze([
  {
    id: "ISS-PAYMENT-CLOSED",
    title: "Le paiement en ligne n'est pas ouvert",
    area: "billing",
    severity: "high",
    status: "open",
    symptoms: ["je ne peux pas payer", "impossible de payer en ligne", "le paiement ne marche pas", "aucun moyen de paiement"],
    probable_causes: ["Le paiement en ligne n'est pas activé (plancher de production)."],
    validated_resolution: null,
    validated_workaround: "La réservation de Pierre se fait SANS paiement en ligne : elle réserve le prix fondateur et l'activation se poursuit hors ligne.",
    affected_routes: ["/checkout", "/reserver/pierre"],
    affected_versions: ["*"],
    fixed_in_version: null,
    public_safe: true,
    requires_escalation: false,
    last_verified_at: "2026-07-13",
    truth_version: SUPPORT_TRUTH_VERSION,
  },
  {
    id: "ISS-NO-COMPANY-PRIVATE",
    title: "Sans entreprise active, les données RH ne sont pas accessibles",
    area: "account",
    severity: "medium",
    status: "open",
    symptoms: ["je ne vois pas mes salariés", "aucune entreprise active", "je ne vois pas mes missions", "mes données n'apparaissent pas"],
    probable_causes: ["Aucune entreprise active n'est rattachée au compte."],
    validated_resolution: "Créer ou sélectionner une entreprise active, puis relancer la demande.",
    validated_workaround: null,
    affected_routes: ["/assistant", "/agents/pierre/use"],
    affected_versions: ["*"],
    fixed_in_version: null,
    public_safe: true,
    requires_escalation: false,
    last_verified_at: "2026-07-13",
    truth_version: SUPPORT_TRUTH_VERSION,
  },
  {
    id: "ISS-PIERRE-NOT-ACTIVE",
    title: "Pierre n'est pas activé sur le compte",
    area: "employee_access",
    severity: "medium",
    status: "open",
    symptoms: ["pierre ne répond pas", "pierre n'est pas actif", "je ne peux pas créer de mission", "pierre est grisé"],
    probable_causes: ["Le droit Pierre n'est pas actif sur ce compte."],
    validated_resolution: "Activer Pierre depuis la page de réservation, puis relancer l'action.",
    validated_workaround: "Toutes les questions générales (produit, prix, méthode RH) restent disponibles sans activation.",
    affected_routes: ["/agents/pierre/use", "/assistant"],
    affected_versions: ["*"],
    fixed_in_version: null,
    public_safe: true,
    requires_escalation: false,
    last_verified_at: "2026-07-13",
    truth_version: SUPPORT_TRUTH_VERSION,
  },
  {
    id: "ISS-SIGNATURE-BLOCKED",
    title: "La signature électronique n'est pas ouverte",
    area: "document",
    severity: "medium",
    status: "open",
    symptoms: ["je ne peux pas signer", "la signature ne fonctionne pas", "signature électronique"],
    probable_causes: ["Le prestataire de signature n'est pas activé."],
    validated_resolution: null,
    validated_workaround: "Le document est PRÉPARÉ et téléchargeable ; la signature se fait hors plateforme pour l'instant.",
    affected_routes: ["/agents/pierre/use"],
    affected_versions: ["*"],
    fixed_in_version: null,
    public_safe: true,
    requires_escalation: false,
    last_verified_at: "2026-07-13",
    truth_version: SUPPORT_TRUTH_VERSION,
  },
  {
    id: "ISS-EMAIL-NOT-SENT",
    title: "Un e-mail préparé n'est pas un e-mail envoyé",
    area: "email",
    severity: "medium",
    status: "open",
    symptoms: ["l'e-mail n'est pas parti", "le mail n'a pas été envoyé", "la relance n'est pas partie"],
    probable_causes: ["Le message a été PRÉPARÉ par Pierre mais l'envoi réel exige une validation humaine et un prestataire actif."],
    validated_resolution: null,
    validated_workaround: "Le contenu préparé est consultable et copiable ; l'envoi reste une décision humaine.",
    affected_routes: ["/agents/pierre/use"],
    affected_versions: ["*"],
    fixed_in_version: null,
    public_safe: true,
    requires_escalation: false,
    last_verified_at: "2026-07-13",
    truth_version: SUPPORT_TRUTH_VERSION,
  },
  {
    id: "ISS-TELEPHONY-BLOCKED",
    title: "La téléphonie (CloneCall) n'est pas ouverte",
    area: "technical",
    severity: "low",
    status: "open",
    symptoms: ["pierre peut-il appeler", "appels téléphoniques", "clonecall"],
    probable_causes: ["La téléphonie n'est pas activée."],
    validated_resolution: null,
    validated_workaround: null,
    affected_routes: [],
    affected_versions: ["*"],
    fixed_in_version: null,
    public_safe: true,
    requires_escalation: false,
    last_verified_at: "2026-07-13",
    truth_version: SUPPORT_TRUTH_VERSION,
  },
  // Entrée DÉPRÉCIÉE : elle ne doit JAMAIS atteindre une réponse (test dédié).
  {
    id: "ISS-DEPRECATED-TRIAL",
    title: "Ancien essai gratuit (n'existe plus)",
    area: "billing",
    severity: "low",
    status: "deprecated",
    symptoms: ["mon essai gratuit", "période d'essai expirée"],
    probable_causes: ["Doctrine obsolète."],
    validated_resolution: "NE PAS UTILISER — il n'y a pas d'essai gratuit.",
    validated_workaround: null,
    affected_routes: [],
    affected_versions: [],
    fixed_in_version: null,
    public_safe: false,
    requires_escalation: false,
    last_verified_at: "2026-01-01",
    truth_version: "obsolete",
  },
]);

/** Seule la vérité ACTIVE peut atteindre une réponse. */
export function activeIssues(): readonly CloneChatKnownIssue[] {
  return KNOWN_ISSUES.filter((i) => i.status !== "deprecated" && i.status !== "draft");
}

export interface IssueMatch {
  readonly issue: CloneChatKnownIssue;
  /** Symptômes RÉELLEMENT observés dans la demande (la preuve du rapprochement). */
  readonly matchedSymptoms: readonly string[];
  readonly score: number;
}

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(new RegExp("[\\u0300-\\u036f]", "g"), "");

/**
 * SIGNATURES — le rapprochement au-delà du copier-coller.
 *
 * Le banc §17 a été sans appel : le rapprochement par sous-chaîne reconnaissait 0 paraphrase
 * sur 24. Il ne reconnaissait pas les problèmes : il reconnaissait SON PROPRE DICTIONNAIRE.
 *
 * Une signature exige un jeton de CHAQUE groupe : un SUJET (« payer », « signature »…) ET un
 * signal d'ÉCHEC (« impossible », « jamais »…). C'est ce qui la garde fondée sur des preuves :
 * « je veux payer » ne déclenche rien ; « impossible de payer » déclenche. On élargit la
 * reconnaissance sans jamais rapprocher « par ambiance ».
 */
const SIGNATURES: Readonly<Record<string, readonly (readonly string[])[]>> = Object.freeze({
  "ISS-PAYMENT-CLOSED": [
    ["payer", "paiement", "regler", "reglement", "carte", "cb", "debit", "debite", "commande", "acheter", "achat"],
    ["impossible", "pas", "aucun", "rien", "jamais", "refus", "echou", "bloqu", "ne fait rien", "marche pas"],
  ],
  "ISS-PIERRE-NOT-ACTIVE": [
    ["pierre", "employe rh", "l'employe", "agent rh"],
    ["pas actif", "inactif", "eteint", "ne repond", "ne demarre", "refuse", "grise", "indisponible", "ne marche", "ne fonctionne"],
  ],
  "ISS-NO-COMPANY-PRIVATE": [
    ["salarie", "collaborateur", "employe", "equipe", "effectif", "entreprise", "societe", "mission"],
    ["ne vois pas", "vois pas", "apparai", "affiche", "visible", "nulle part", "aucun", "vide", "introuvable"],
  ],
  "ISS-SIGNATURE-BLOCKED": [
    ["signer", "signature", "parapher", "paraphe", "contrat", "avenant"],
    ["impossible", "pas", "ne fonctionne", "bloqu", "jamais", "ne part", "echou"],
  ],
  "ISS-EMAIL-NOT-SENT": [
    ["mail", "e-mail", "email", "courriel", "relance", "rappel"],
    ["pas parti", "jamais", "pas ete envoye", "non envoye", "ne part", "reste", "limbes", "pas quitte", "bloqu"],
  ],
  // Ma propre règle disait « SUJET + ÉCHEC », et j'avais écrit ici « SUJET + QUESTION »
  // (« peut », « est-ce que », « ? »). Résultat : « Pierre peut-il appeler ? » — une simple
  // question sur une capacité — était comptée comme la PREUVE d'une panne vécue, et faisait
  // remonter jusqu'à l'escalade d'un accès suspendu. Une question n'est pas une panne.
  "ISS-TELEPHONY-BLOCKED": [
    ["appel", "appeler", "telephone", "telephonique", "decroche", "clonecall"],
    ["impossible", "ne peut pas", "ne marche", "ne fonctionne", "jamais", "bloqu", "indisponible", "echou", "pas dispo"],
  ],
});

/**
 * SIGNATURES DE CAPACITÉ — « est-ce que ça sait faire X ? »
 *
 * Une question sur une capacité EST une demande de support légitime : la bonne réponse existe
 * dans le registre (« non, la téléphonie n'est pas ouverte »). Mais ce n'est PAS une panne vécue.
 * Les deux sont donc séparées : celle-ci fait RÉPONDRE, jamais escalader ni parler du compte.
 */
const CAPABILITY_SIGNATURES: Readonly<Record<string, readonly (readonly string[])[]>> = Object.freeze({
  "ISS-TELEPHONY-BLOCKED": [
    ["appel", "appeler", "telephone", "telephonique", "decroch", "clonecall"],
    ["peut", "peut-il", "est-ce que", "possible", "capable", "sait", "gere", "?"],
  ],
});

/**
 * Un jeton du groupe est-il RÉELLEMENT présent dans le message ?
 *
 * Aux FRONTIÈRES DE MOT, et ce n'est pas un détail : « rappel » contient « appel ». Le banc §17
 * l'a pris sur le fait — « le courriel de rappel n'a jamais quitté la plateforme » déclenchait la
 * signature TÉLÉPHONIE, se retrouvait à égalité avec la signature E-MAIL, et le diagnostic
 * s'effondrait en « plusieurs causes possibles ». Une sous-chaîne n'est pas un mot.
 */
const hasAny = (m: string, group: readonly string[]) =>
  group.some((t) => {
    const tok = norm(t);
    if (tok === "?") return m.includes("?");
    // Frontière à gauche : début, ou tout caractère non alphanumérique (apostrophe, espace…).
    // À droite on tolère les suffixes (pluriel, conjugaison) : « appel » ⊂ « appels » ✔,
    // mais « rappel » ⊄ « appel » ✘ — c'est le début du mot qui compte.
    return new RegExp(`(^|[^a-z0-9])${tok.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(m);
  });

/**
 * Le message porte-t-il la PREUVE d'une panne VÉCUE (et non une simple question) ?
 *
 * C'est la différence entre « Pierre peut-il appeler ? » (curiosité) et « Pierre ne décroche
 * jamais » (panne). Seule la seconde rend l'état du compte pertinent. Confondre les deux faisait
 * répondre « votre accès est suspendu, un humain doit intervenir » à qui demandait simplement
 * si la téléphonie existait.
 */
export function matchesTroubleSignature(message: string): boolean {
  const m = norm(message ?? "");
  if (m.length < 3) return false;
  return activeIssues().some((issue) => {
    const sig = SIGNATURES[issue.id];
    return sig !== undefined && sig.every((group) => hasAny(m, group));
  });
}

/**
 * Rapproche une demande d'un problème connu — SEULEMENT sur preuve.
 *
 * Deux voies, toutes deux fondées sur des preuves :
 *   1. un SYMPTÔME documenté apparaît littéralement (preuve la plus forte) ;
 *   2. une SIGNATURE est satisfaite : le sujet ET l'échec sont tous deux présents.
 * Aucun rapprochement « par ambiance » : sans l'un ou l'autre, aucun rapprochement.
 */
export function matchKnownIssues(message: string, route: string | null = null): readonly IssueMatch[] {
  const m = norm(message ?? "");
  if (m.length < 3) return [];

  const out: IssueMatch[] = [];
  for (const issue of activeIssues()) {
    const matched = issue.symptoms.filter((s) => m.includes(norm(s)));

    // Voie 2 : la signature de PANNE (sujet + échec). Elle vaut moins qu'un symptôme littéral.
    const sig = SIGNATURES[issue.id];
    const signatureMatched = sig !== undefined && sig.every((group) => hasAny(m, group));

    // Voie 3 : la signature de CAPACITÉ (sujet + question). Elle FAIT RÉPONDRE, sans rien
    // affirmer sur le compte de l'utilisateur : demander si une fonction existe n'est pas
    // subir une panne.
    const cap = CAPABILITY_SIGNATURES[issue.id];
    const capabilityMatched = cap !== undefined && cap.every((group) => hasAny(m, group));

    if (matched.length === 0 && !signatureMatched && !capabilityMatched) continue; // PAS de preuve ⇒ PAS de rapprochement

    let score = matched.length * 10 + (signatureMatched ? 6 : 0) + (capabilityMatched ? 4 : 0);
    if (route && issue.affected_routes.includes(route)) score += 5; // la route corrobore
    out.push({
      issue,
      matchedSymptoms: Object.freeze(
        matched.length > 0 ? matched
        : signatureMatched ? ["signature : sujet + échec"]
        : ["signature : question de capacité"],
      ),
      score,
    });
  }
  return Object.freeze(out.sort((a, b) => b.score - a.score));
}

/**
 * Un problème CORRIGÉ ne peut être annoncé comme tel que s'il nomme sa version de correction.
 * Sans cette version, on refuse d'affirmer « c'est corrigé » — ce serait une fausse assurance.
 */
export function canClaimFixed(issue: CloneChatKnownIssue): boolean {
  return issue.status === "fixed" && typeof issue.fixed_in_version === "string" && issue.fixed_in_version.length > 0;
}

/** Le contournement est-il DIFFUSABLE publiquement ? (jamais un chemin interne) */
export function publicWorkaround(issue: CloneChatKnownIssue): string | null {
  if (!issue.public_safe) return null;
  return issue.validated_workaround ?? issue.validated_resolution ?? null;
}

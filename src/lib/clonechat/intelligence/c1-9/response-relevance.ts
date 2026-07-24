// C1.9 — CONTRAT DE PERTINENCE.
//
// Ce que la campagne a réellement mesuré : les réponses ne sont plus fausses, elles sont
// POLLUÉES. Le prix est juste, puis vient l'état du paiement que personne n'a demandé ;
// la Suisse est bien couverte, puis viennent les trois autres pays ; l'incident est bien
// reçu, puis vient une invitation à réserver. Le grounding se dégrade non par invention
// mais par AJOUT NON SOLLICITÉ.
//
// La cause est structurelle, pas rédactionnelle : le TruthContext servait au rédacteur la
// table tarifaire des quatre pays et le périmètre de lancement à CHAQUE tour, quelle que
// soit la question. Un rédacteur à qui l'on tend quatre prix en écrit quatre.
//
// Ce module produit donc un CONTRAT typé, dérivé de la compréhension du modèle :
//   — ce qu'il FAUT dire            (requiredClaims)
//   — ce qu'on PEUT dire en appui   (allowedSupportingTopics)
//   — ce qu'on NE DOIT PAS ajouter  (forbiddenUnsolicitedTopics)
//   — jusqu'où aller                (answerDepth)
//   — a-t-on le droit de proposer une suite / une offre
//
// Principe directeur, et seule raison pour laquelle ce n'est pas un dictionnaire de cas :
// un sujet périphérique est AUTORISÉ s'il apparaît dans la DEMANDE, et interdit sinon.
// Les mêmes détecteurs servent donc à lire la question et à contrôler la réponse. Aucune
// formulation de campagne n'apparaît ici, et aucune règle ne vise une question précise.
import type { Understanding } from "./understanding-schema";
import type { Sufficiency } from "./semantic-retrieval";
import { parrainNormalize } from "../c1-1/parrain-types";
import {
  SUPPORTED_LAUNCH_COUNTRIES,
  normalizeCountry,
  currencyForCountry,
} from "@/lib/clonestore/pricing/country-pricing";

// ── Nature de la demande ─────────────────────────────────────────────────────
// Ce n'est PAS une taxonomie de sujets produit : c'est la nature de l'ÉCHANGE, ce qui
// détermine le registre autorisé. Le modèle la pose lui-même à l'étape de compréhension ;
// on se contente de la normaliser et de retomber sur une valeur sûre si elle manque.
export type RequestNature =
  | "support_incident"
  | "sensitive_action"
  | "out_of_scope"
  | "capability"
  | "pricing"
  | "country"
  | "objection"
  | "data_governance"
  | "next_step"
  | "general";

const NATURES: readonly RequestNature[] = [
  "support_incident", "sensitive_action", "out_of_scope", "capability",
  "pricing", "country", "objection", "data_governance", "next_step", "general",
];

/**
 * Repli de normalisation : le modèle peut écrire une étiquette voisine plutôt qu'exacte.
 *
 * Table de MOTS, pas d'expressions régulières — et volontairement. Elle ne lit jamais le
 * message de l'utilisateur : elle rapproche l'ÉTIQUETTE écrite par le modèle de l'une des
 * dix natures. Un tableau de sous-chaînes dit exactement ce qu'il fait ; un regex de la
 * même chose ressemblerait à un routeur de sujet sans en être un.
 */
const NATURE_HINTS: readonly (readonly [readonly string[], RequestNature])[] = [
  [["support", "incident", "panne", "bug", "dysfonction", "technique", "prelev", "facturation", "connexion"], "support_incident"],
  [["sensible", "sensitive", "suppression", "signature", "envoi", "decision"], "sensitive_action"],
  [["hors_sujet", "hors_scope", "hors_perimetre", "out_of_scope"], "out_of_scope"],
  [["capacit", "capabilit", "fonctionnalit", "feature", "sait_faire"], "capability"],
  [["prix", "tarif", "pricing", "budget", "cout", "abonnement"], "pricing"],
  [["pays", "country", "geo", "territoire", "couverture"], "country"],
  [["objection", "doute", "scepti", "reticence", "concurrence"], "objection"],
  [["donnee", "data", "confidentialit", "isolation", "securite", "rgpd"], "data_governance"],
  [["etape", "next_step", "acheter", "souscri", "reserver", "demo", "essai"], "next_step"],
];

export function normalizeRequestNature(raw: unknown, u: Understanding): RequestNature {
  if (u.out_of_scope === true) return "out_of_scope";
  const s = typeof raw === "string" ? parrainNormalize(raw).replace(/\s+/g, "_") : "";
  if ((NATURES as readonly string[]).includes(s)) return s as RequestNature;
  for (const [words, nature] of NATURE_HINTS) if (words.some((w) => s.includes(w))) return nature;
  // Repli STRUCTUREL, sans lecture du message : une action demandée sur des données
  // réelles reste une demande sensible même si l'étiquette manque.
  if (Array.isArray(u.requested_actions) && u.requested_actions.length > 0) return "sensitive_action";
  return "general";
}

export type AnswerDepth = "atomic" | "multi" | "detailed";

export function normalizeAnswerDepth(raw: unknown, coverageCount: number): AnswerDepth {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (s === "atomic" || s === "multi" || s === "detailed") {
    // Une demande à plusieurs points ne peut pas être servie en une phrase, quelle que
    // soit l'étiquette : le contrat de couverture prime sur l'étiquette de profondeur.
    return s === "atomic" && coverageCount > 1 ? "multi" : s;
  }
  return coverageCount > 1 ? "multi" : "atomic";
}

// ── Sujets périphériques ─────────────────────────────────────────────────────
// Six sujets, pas un de plus. Chacun désigne un THÈME entier, jamais une question. Ils
// sont appliqués à la demande (« a-t-il été demandé ? ») et à la réponse (« a-t-il été
// ajouté ? »). C'est le même détecteur des deux côtés : rien ne peut être interdit dans
// la réponse sans être reconnaissable dans la question.
export interface TopicContext {
  /** Codes ISO des pays réellement évoqués par l'utilisateur. */
  readonly requestedCountries: readonly string[];
}

export interface PeripheralTopic {
  readonly id: string;
  /** Formulation lisible, réutilisée telle quelle dans le prompt. */
  readonly label: string;
  readonly matches: (text: string, ctx: TopicContext) => boolean;
}

/**
 * Noms des quatre pays de lancement. Les CODES viennent du canon P10 ; seuls leurs noms
 * français sont écrits ici, parce qu'un texte nomme un pays, il n'en écrit pas le code.
 * Comparaison par sous-chaîne sur un texte normalisé — aucun regex, rien à faire dériver.
 */
const LAUNCH_COUNTRY_NAMES: Readonly<Record<string, readonly string[]>> = {
  FR: ["france", "francais", "hexagone"],
  BE: ["belgique", "belge"],
  LU: ["luxembourg", "luxembourgeois"],
  CH: ["suisse", "helvetique"],
};

/** Pays de lancement nommés dans un texte. Dérivé de SUPPORTED_LAUNCH_COUNTRIES. */
export function launchCountriesNamedIn(text: string): readonly string[] {
  const norm = parrainNormalize(text);
  return SUPPORTED_LAUNCH_COUNTRIES.filter((cc) =>
    (LAUNCH_COUNTRY_NAMES[cc] ?? []).some((n) => norm.includes(n)),
  );
}

const PRICING_TOPIC: PeripheralTopic = Object.freeze({
  id: "pricing",
  label: "le tarif ou le montant de l'abonnement",
  matches: (t: string) => /\b\d{2,4}\s?(?:€|eur\b|euros?\b|chf\b)|\bprix\b|\btarifs?\b|\bbudget\b|\bco[ûu]te?\b|\babonnement mensuel\b/i.test(t),
});

export const PERIPHERAL_TOPICS: readonly PeripheralTopic[] = Object.freeze([
  PRICING_TOPIC,
  {
    id: "payment_status",
    label: "l'état du paiement en ligne",
    matches: (t) => /paiement en ligne|payer en ligne|r[èe]glement en ligne|paiement\b[^.]{0,40}(?:ouvert|actif|disponible|possible)|carte bancaire/i.test(t),
  },
  {
    id: "founder_reservation",
    label: "la réservation ou l'accès fondateur",
    matches: (t) => /r[ée]servation|r[ée]server|fondateur|acc[èe]s anticip|liste d'attente|pr[ée]-?inscri/i.test(t),
  },
  {
    id: "demo",
    label: "la démonstration du produit",
    matches: (t) => /d[ée]mo(?:nstration)?\b|\/demo|voir pierre en action|essai gratuit/i.test(t),
  },
  {
    id: "roi",
    // Volontairement large sur la famille « gagner » : la campagne a montré que le gain
    // est demandé sous mille formes (« on y gagne quoi ? », « combien on gagnerait ? »)
    // et le détecteur sert AUSSI à reconnaître la demande. Trop étroit, il interdirait
    // une réponse pourtant sollicitée.
    label: "le gain de temps ou d'argent",
    matches: (t) => /gagn\w*|\bgains?\b|[ée]conomi\w*|rentabilit|retour sur investissement|\broi\b/i.test(t),
  },
  {
    // Mesuré : « le montant final peut dépendre du statut au regard de la TVA suisse » —
    // une réserve de facturation qu'aucun fait ne portait, sur une question de prix qui
    // n'appelait qu'un montant. Le prompt l'interdisait déjà ; il fallait aussi pouvoir la
    // retirer. Les conditions de facturation sont un sujet à part entière, distinct du prix.
    id: "billing_terms",
    label: "les conditions de facturation (TVA, engagement, durée, remboursement)",
    matches: (t) => /\btva\b|\bhors taxes?\b|\bht\b|\bttc\b|engagement|r[ée]siliation|pr[ée]avis|remboursement|facturation|p[ée]riode d'essai/i.test(t),
  },
  {
    id: "country_coverage",
    label: "les pays couverts qui n'ont pas été évoqués",
    matches: (t, ctx) => launchCountriesNamedIn(t).some((cc) => !ctx.requestedCountries.includes(cc)),
  },
]);

/**
 * Sujets qu'une NATURE rend légitimes même si l'utilisateur ne les nomme pas.
 *
 * `country_coverage` n'y figure JAMAIS : son détecteur est déjà relatif aux pays évoqués
 * (« un pays nommé qui n'a pas été demandé »). L'autoriser globalement supprimerait le
 * seul contrôle qui empêche « et la Suisse ? » de produire les quatre tarifs. Le seul cas
 * où la liste entière est légitime — une question de couverture sans pays nommé — est
 * traité comme une exception explicite dans `buildRelevanceContract`.
 */
const NATURE_ALLOWS: Readonly<Record<RequestNature, readonly string[]>> = Object.freeze({
  support_incident: [],            // §6 : une assistance ne vend rien, jamais.
  sensitive_action: [],
  out_of_scope: [],
  capability: [],
  pricing: ["pricing"],
  country: ["pricing"],
  objection: [],
  data_governance: [],
  next_step: ["demo", "founder_reservation"],
  general: [],
});

// ── Contrat ──────────────────────────────────────────────────────────────────
export interface RelevanceContract {
  readonly nature: RequestNature;
  /** Ce à quoi la réponse DOIT répondre — c'est le contrat de couverture. */
  readonly requiredClaims: readonly string[];
  /** Sujets périphériques autorisés parce qu'ils ont été demandés. */
  readonly allowedSupportingTopics: readonly string[];
  /** Sujets périphériques qui ne doivent PAS apparaître. */
  readonly forbiddenUnsolicitedTopics: readonly PeripheralTopic[];
  /**
   * Libellés CONTEXTUELS des sujets interdits, destinés au prompt et au banc de mesure.
   *
   * Mesuré : transmettre au juge le libellé générique « les pays couverts qui n'ont pas
   * été évoqués » alors que l'utilisateur avait nommé la France et Genève lui faisait lire
   * « la géographie est interdite » — et pénaliser une réponse correcte. Un libellé qui ne
   * dit pas de quoi il parle produit une mesure fausse.
   */
  readonly forbiddenTopicLabels: readonly string[];
  readonly answerDepth: AnswerDepth;
  readonly shouldOfferNextStep: boolean;
  readonly shouldUseCommercialCta: boolean;
  /** Vrai si les pays évoqués relèvent de devises différentes (canon P10). */
  readonly multipleCurrencies: boolean;
  /** Vrai si un pays de lancement est évoqué sans cadrage binaire ⇒ tarif requis. */
  readonly countryPricingRequired: boolean;
  /** Vrai si la demande est cadrée en « oui ou non » ⇒ réponse tranchée, sans extra. */
  readonly binaryFramed: boolean;
  /** Pays de lancement réellement évoqués (codes ISO). */
  readonly requestedCountries: readonly string[];
  /** Pays évoqués HORS périmètre de lancement. */
  readonly unsupportedCountries: readonly string[];
  /** Vrai si la capacité demandée n'est établie par aucune source récupérée. */
  readonly capabilityUnproven: boolean;
  /** Vrai si la demande porte sur les données d'une AUTRE entreprise (inter-tenant). */
  readonly crossTenantRequest: boolean;
  readonly topicContext: TopicContext;
}

export interface RelevanceInput {
  readonly understanding: Understanding;
  readonly coverage: readonly string[];
  readonly sufficiency: Sufficiency;
  readonly unmatchedNeeds: readonly string[];
  readonly rawMessage: string;
}

/**
 * Lecture DÉFENSIVE d'un tableau de la compréhension.
 *
 * Le contrat doit survivre à une compréhension construite à la main (tests structurels,
 * appelants historiques) autant qu'à une compréhension analysée par le schéma. Une
 * pertinence qui lève une exception ferait basculer le tour entier en mode dégradé : le
 * remède serait infiniment pire que l'ajout non sollicité qu'il corrige.
 */
function list(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

/** Pays évoqués : le modèle fait la géographie (une ville donne son pays), nous la politique. */
function countriesFromUnderstanding(u: Understanding): readonly string[] {
  const out = new Set<string>();
  for (const raw of list(u.countries_mentioned)) {
    const c = normalizeCountry(raw);
    if (c) out.add(c);
  }
  // Filet structurel : une entité dont la NATURE désigne un pays, si le champ dédié
  // manque. On ne lit jamais le message brut — seulement ce que la compréhension a posé.
  const COUNTRY_KINDS = ["pays", "country", "nation", "territoire", "juridiction"];
  for (const e of Array.isArray(u.entities) ? u.entities : []) {
    if (!e || typeof e.kind !== "string" || typeof e.value !== "string") continue;
    const kind = parrainNormalize(e.kind);
    if (!COUNTRY_KINDS.some((k) => kind.includes(k))) continue;
    const c = normalizeCountry(e.value);
    if (c) out.add(c);
  }
  return Object.freeze([...out]);
}

export function buildRelevanceContract(input: RelevanceInput): RelevanceContract {
  const u = input.understanding;
  const nature = normalizeRequestNature(u.request_nature, u);
  const mentioned = countriesFromUnderstanding(u);
  const requestedCountries = mentioned.filter((c) => (SUPPORTED_LAUNCH_COUNTRIES as readonly string[]).includes(c));
  const unsupportedCountries = mentioned.filter((c) => !(SUPPORTED_LAUNCH_COUNTRIES as readonly string[]).includes(c));

  // LE MESSAGE DE L'UTILISATEUR, et lui seul.
  //
  // Défaut mesuré, et subtil : la « demande » incluait aussi la reformulation du modèle
  // (`primary_goal`, `topics_requested`…). Or le modèle paraphrase largement. Sur « je peux
  // payer en ligne tout de suite ? », sa reformulation mentionnait la réservation — ce qui
  // rendait la réservation SOLLICITÉE, donc autorisée, donc non excisée. Le contrat validait
  // ainsi un ajout que l'utilisateur n'avait jamais demandé, en se fiant à celui-là même
  // qu'il est censé borner.
  //
  // Ce qu'une personne a demandé, c'est ce qu'elle a ÉCRIT. La nature de l'échange, elle,
  // reste décidée par le modèle : elle ouvre des sujets par catégorie (`NATURE_ALLOWS`),
  // ce qui couvre les tours elliptiques sans rendre la paraphrase auto-autorisante.
  const requestText = input.rawMessage ?? "";

  const ctx: TopicContext = { requestedCountries };
  const natureAllows = NATURE_ALLOWS[nature];
  // Exception unique, et cohérente avec ce qui est SERVI : quand aucun pays n'est nommé,
  // une question de couverture — ou une question de prix, dont la réponse honnête est la
  // table des deux paliers — appelle légitimement les quatre pays. Interdire ici ce qu'on
  // sert là-bas ferait exciser une réponse exacte.
  //
  // Mesuré : déclencher le prix sur `requested_metrics` faisait servir les quatre tarifs à
  // « notre RH passe 30 h par semaine, ça donne quoi ? » — une question de TEMPS. Le
  // rédacteur récitait alors la table tarifaire. Une grandeur demandée n'est pas un prix
  // demandé ; seul l'argent appelle l'argent. Les outils gouvernés, eux, lisent le montant
  // dans le contexte même lorsqu'il n'est pas servi au rédacteur.
  const priceInPlay =
    nature === "pricing" || nature === "next_step" ||
    PRICING_TOPIC.matches(requestText, ctx) ||
    list(u.tool_needs).length > 0;
  const wholeCountryTableAsked =
    requestedCountries.length === 0 && (nature === "country" || priceInPlay);

  const currencies = new Set(requestedCountries.map((cc) => currencyForCountry(cc)).filter(Boolean));
  const multipleCurrencies = currencies.size > 1;

  // Cadrage BINAIRE explicite (« oui ou non ») : la personne demande une réponse tranchée.
  // Marqueur linguistique général, pas un cas. Mesuré (pe2) : « vous couvrez la Suisse, oui
  // ou non ? » n'appelle PAS le tarif — l'ajouter réduit la pertinence ; alors que py1
  // « un site à Zurich, vous couvrez ? », ouverte, l'attend. Le « oui ou non » est le seul
  // signal qui sépare ces deux demandes quasi identiques.
  const binaryFramed = BINARY_ASK.test(input.rawMessage ?? "");

  const normReq = parrainNormalize(requestText);

  // Le tarif d'un pays n'est REQUIS que si la demande porte sur la COUVERTURE ou le PRIX —
  // pas sur n'importe quelle mention de pays. Overfit mesuré : forcer le tarif sur TOUTE
  // mention de pays faisait passer la campagne ciblée (« vous couvrez ? », « ça se gère ? »)
  // mais échouer la complète, où « les règles luxembourgeoises sont à jour ? » (réglementaire)
  // et « on est à Anvers, ça change quelque chose ? » (impact) recevaient un prix non demandé,
  // jugé hors sujet. On exige donc le tarif seulement quand la question veut couvrir/chiffrer.
  // « marche » et « fonctionne » RETIRÉS : mesuré (mem8), « les congés payés, ça marche
  // comment ? » (= comment fonctionnent-ils) était pris pour une intention de couverture et
  // faisait servir le tarif belge, hors sujet. Les mots de couverture retenus sont sans
  // ambiguïté ; « ça se gère ? » (gere) reste couvert.
  const COVERAGE_INTENT = [
    "couvr", "couvre", "gere", "gerer", "travaill", "present", "presence", "disponible",
    "operationnel", "prise en charge", "prend en charge",
    "combien", "budget", "cout", "coute", "tarif", "prix",
  ];
  // Une question portant sur un SUJET RH précis (congés, contrat, paie…) n'appelle pas le
  // tarif : mesuré (mem8), « les congés payés en Belgique, ça marche comment ? » veut la
  // capacité de Pierre, pas le prix. À l'inverse, une question générale/réglementaire sur un
  // pays supporté (c1 « filiale à Genève, ça suit la loi ? », c3, c4) attend qu'on confirme la
  // couverture et le tarif. Le sujet RH précis est donc l'exclusion qui sépare les deux.
  const HR_TOPIC = [
    "conge", "contrat", "avenant", "paie", "salaire", "absence", "arret", "maladie",
    "entretien", "licenciement", "rupture", "embauche", "dpae", "mutuelle", "registre",
    "attestation", "solde", "onboarding", "offboarding", "disciplinaire", "prevoyance",
  ];
  const hasHRTopic = HR_TOPIC.some((w) => normReq.includes(w));
  // PRÉSENCE de l'entreprise dans le pays (filiale, bureau, site, implantation…). C'est le
  // signal qui sépare c1 (« on a une filiale à Genève, ça suit la loi ? » → l'entreprise
  // OPÈRE là-bas ⇒ couverture et tarif pertinents) de c3 (« les règles luxembourgeoises
  // sont-elles à jour chez vous ? » → question sur NOTRE connaissance, aucune présence ⇒
  // pas de tarif). mem8 (« on est en Belgique » + congés) est écarté par le sujet RH.
  const PRESENCE = ["filiale", "bureau", "site", "implantation", "etabli", "nos equipes", "nos bureaux", "antenne", "succursale"];
  const companyPresence = PRESENCE.some((w) => normReq.includes(w));
  const coverageIntent =
    nature === "pricing" || nature === "next_step" ||
    PRICING_TOPIC.matches(requestText, ctx) ||
    list(u.tool_needs).length > 0 ||
    COVERAGE_INTENT.some((w) => normReq.includes(w)) ||
    // Présence de l'entreprise dans un pays supporté, hors sujet RH précis : on confirme
    // la couverture et le tarif (c1). Une simple question sur nos règles (c3) ne le déclenche pas.
    (nature === "country" && companyPresence);
  const countryPricingRequired =
    !binaryFramed && requestedCountries.length > 0 && coverageIntent && !hasHRTopic;

  // Le TEMPS est-il en jeu ? Mesuré (mm2) : « notre RH passe 30 h… ça donne quoi ? » — la
  // personne a elle-même introduit des heures, donc parler du temps gagné est SOLLICITÉ,
  // pas un ajout commercial. Détection par mots (aucun regex) sur la nature des entités et
  // les grandeurs demandées — jamais sur le message brut.
  const TIME_WORDS = ["heure", "temps", "jour", "gain", "effort", "charge", "administrat"];
  const hasTime = (s: unknown) => typeof s === "string" && TIME_WORDS.some((w) => parrainNormalize(s).includes(w));
  const timeInPlay =
    list(u.requested_metrics).some(hasTime) ||
    list(u.tool_needs).length > 0 ||
    (Array.isArray(u.entities) && u.entities.some((e) => e && hasTime(e.kind)));

  // Demande INTER-TENANT : les données d'une AUTRE entreprise. Mesuré (in3) : le refus est
  // correct mais mieux ÉTAYÉ si l'énoncé d'isolation est servi comme fait. Mots, pas regex.
  const OTHER_ORG = ["autre societe", "autre entreprise", "autre client", "autre boite", "autre organisation", "inter client", "benchmark", "autres clients", "autres entreprises"];
  const crossTenantRequest = OTHER_ORG.some((w) => normReq.includes(w));

  // Sujets d'OFFRE commerciale : ce qu'une assistance ne pitche jamais. Distincts du SUJET
  // FACTUEL d'un incident. Mesuré (x4, x6, u5) : forcer « payment_status »/« billing_terms »
  // en interdits sur « ma carte a été débitée » ou « ma facture est fausse » faisait pénaliser
  // la discussion NÉCESSAIRE du sujet même de l'incident. Une assistance ne VEND pas, mais
  // parle bien du prélèvement ou de la facture dont on lui parle.
  const OFFER_TOPICS = new Set(["pricing", "founder_reservation", "demo", "roi"]);

  const allowed: string[] = [];
  const forbidden: PeripheralTopic[] = [];
  for (const topic of PERIPHERAL_TOPICS) {
    let askedFor: boolean;
    if (nature === "out_of_scope") {
      askedFor = false; // hors sujet : aucun sujet périphérique.
    } else if (nature === "support_incident") {
      // On interdit les OFFRES ; on autorise le sujet factuel de l'incident (paiement,
      // facturation) sans l'imposer — le composeur ne vend rien, mais répond sur ce dont
      // la personne parle.
      askedFor = !OFFER_TOPICS.has(topic.id);
    } else {
      askedFor =
        topic.matches(requestText, ctx) ||
        natureAllows.includes(topic.id) ||
        (topic.id === "country_coverage" && wholeCountryTableAsked) ||
        (topic.id === "pricing" && countryPricingRequired) ||
        (topic.id === "roi" && timeInPlay);
    }
    // Cadrage binaire : le tarif n'est pas un ajout bienvenu (pe2), sauf si la personne
    // l'évoque explicitement. On l'INTERDIT alors, même quand la nature « pays » l'autoriserait.
    const binarySuppressed = binaryFramed && topic.id === "pricing" && !topic.matches(requestText, ctx);
    if (askedFor && !binarySuppressed) allowed.push(topic.id);
    else forbidden.push(topic);
  }

  const asksNextStep = u.asks_for_next_step === true || nature === "next_step";
  const shouldOfferNextStep =
    asksNextStep && nature !== "support_incident" && nature !== "out_of_scope" && nature !== "sensitive_action";
  const shouldUseCommercialCta = shouldOfferNextStep && nature !== "data_governance";

  // §8 : une capacité n'est « active » que si une source la porte. Quand la récupération
  // avoue n'avoir rien couvert, la réponse doit le dire au lieu de compenser par un
  // panorama de capacités générales.
  const capabilityUnproven =
    nature === "capability" && (input.sufficiency === "none" || input.unmatchedNeeds.length > 0);

  return Object.freeze({
    nature,
    requiredClaims: Object.freeze([...input.coverage]),
    allowedSupportingTopics: Object.freeze(allowed),
    forbiddenUnsolicitedTopics: Object.freeze(forbidden),
    forbiddenTopicLabels: Object.freeze(forbidden.map((t) =>
      t.id === "country_coverage" && requestedCountries.length > 0
        ? `les pays de lancement AUTRES que ceux évoqués (${requestedCountries.join(", ")})`
        : t.label,
    )),
    multipleCurrencies,
    countryPricingRequired,
    binaryFramed,
    answerDepth: binaryFramed ? "atomic" : normalizeAnswerDepth(u.answer_depth, input.coverage.length),
    shouldOfferNextStep,
    shouldUseCommercialCta,
    requestedCountries,
    unsupportedCountries,
    capabilityUnproven,
    crossTenantRequest,
    topicContext: ctx,
  });
}

// ── Ce que le TruthContext a le droit de servir ──────────────────────────────
// C'est ici que se joue la correction de fond : on ne demande pas au rédacteur de taire
// un fait, on ne le lui donne pas.
export interface FactRelevancePlan {
  /** Le prix du pays servi (ou celui demandé) est-il utile à cette demande ? */
  readonly includePricing: boolean;
  /** La table tarifaire par pays est-elle utile ? */
  readonly includeCountryTable: boolean;
  /** Restreinte à ces pays (null = tous les pays de lancement). */
  readonly countryFilter: readonly string[] | null;
  /** L'énoncé « seuls FR/BE/LU/CH sont couverts » est-il utile ? */
  readonly includeCountryScope: boolean;
  /**
   * L'énoncé de politique d'ISOLATION DES DONNÉES est-il utile ?
   *
   * Mesuré (mi2) : sur « est-ce que mes données restent privées ? », la récupération ne
   * rendait que le NOM de page /legal/confidentialite, jamais l'énoncé de politique
   * (« Chaque entreprise ne voit que ses propres données »). La réponse hésitait alors sur
   * l'isolation faute de l'avoir reçue. Comme le plancher humain-seul, cette vérité produit
   * doit être SERVIE comme un fait quand la demande touche la gouvernance des données —
   * on ne peut pas exiger une réponse sur l'isolation et en refuser la source.
   */
  readonly includeDataIsolation: boolean;
  /**
   * L'énoncé du PÉRIMÈTRE de capacités (ce que Pierre prépare) est-il utile ?
   *
   * Mesuré (gc4, pe3, gc1) : les chunks de capacité (`cap.overview`, `cap.limits`) sont en
   * visibilité AUTHENTICATED_CLIENT — donc filtrés pour le visiteur anonyme de la campagne.
   * Aucun fait n'établissait alors que Pierre PRÉPARE les documents RH courants, et le juge
   * déclarait « non étayée » toute réponse « Pierre peut préparer X » (solde de tout compte,
   * mise à jour du registre). Le périmètre de préparation est une information produit
   * PUBLIQUE (elle figure sur la page produit) : on la sert comme un fait sur une question
   * de capacité, exactement comme le plancher humain-seul.
   */
  readonly includeCapabilityScope: boolean;
}

export function factRelevancePlan(c: RelevanceContract, u: Understanding): FactRelevancePlan {
  const priceIsUseful =
    c.nature === "pricing" || c.nature === "country" || c.nature === "next_step" ||
    c.allowedSupportingTopics.includes("pricing") ||
    // Un outil gouverné qui compare un coût a besoin du montant : sans lui, le rédacteur
    // devrait l'inventer. Une simple question de temps gagné, elle, n'a pas besoin du prix.
    (Array.isArray(u.tool_needs) && u.tool_needs.length > 0);

  const countryIsUseful =
    c.nature === "country" || c.requestedCountries.length > 0 || c.unsupportedCountries.length > 0;

  // La TABLE tarifaire par pays n'est SERVIE que si le prix est réellement en jeu — mesuré
  // (mem8) : « on est en Belgique » (tour 1) puis « les congés payés, ça marche comment ? »
  // gardait BE en contexte, servait le prix belge, et le modèle l'ajoutait à une réponse sur
  // les congés où personne ne l'avait demandé. On sert le prix quand la demande veut couvrir/
  // chiffrer (countryPricingRequired), ou pour une question de couverture générale sans pays.
  const countryPriceServed =
    c.countryPricingRequired || (c.nature === "country" && c.requestedCountries.length === 0);

  return Object.freeze({
    includePricing: priceIsUseful && c.nature !== "support_incident" && c.nature !== "out_of_scope",
    includeCountryTable: countryPriceServed,
    // Servi pour une question de gouvernance des données OU une demande inter-tenant : dans
    // les deux cas la réponse s'appuie sur « chaque entreprise ne voit que ses données ».
    includeDataIsolation: c.nature === "data_governance" || c.crossTenantRequest,
    // Le périmètre de capacités est servi dès que la demande peut toucher ce que Pierre
    // FAIT — capacité, mais aussi une question pays/RH (mesuré mem8 : « les congés payés en
    // Belgique, ça marche comment ? » — le modèle sur-prudent hédgeait faute d'avoir reçu
    // que Pierre « suit les absences et congés »), une objection ou une question de temps.
    // Pas pour un prix, un incident, un hors-sujet ou une action sensible.
    includeCapabilityScope: (["capability", "country", "general", "objection"] as const).includes(
      c.nature as "capability" | "country" | "general" | "objection",
    ),
    // Un pays nommé restreint la table à ce pays : c'est ce qui empêche « et à Genève ? »
    // de produire les quatre tarifs. Aucun pays nommé ⇒ table entière (question générale
    // sur la couverture) : la taire serait une lacune, pas une concision.
    countryFilter: c.requestedCountries.length > 0 ? c.requestedCountries : null,
    // Le périmètre (« seuls FR/BE/LU/CH sont couverts, aucune date d'ouverture ») n'est servi
    // que là où il est utile : un pays HORS lancement à annoncer, ou une question de couverture
    // SANS pays précis. Mesuré (c3) : le servir sur « les règles luxembourgeoises sont-elles à
    // jour ? » faisait mentionner « l'ouverture » d'autres pays, hors sujet. Pour un pays
    // SUPPORTÉ précis, la couverture est déjà groundée par son tarif servi (py3).
    includeCountryScope:
      c.unsupportedCountries.length > 0 ||
      (c.nature === "country" && c.requestedCountries.length === 0),
  });
}

// ── Rendu pour le prompt ─────────────────────────────────────────────────────
const DEPTH_INSTRUCTION: Readonly<Record<AnswerDepth, string>> = Object.freeze({
  atomic: "Une seule chose est demandée : réponds en 1 à 3 phrases, puis arrête-toi.",
  multi: "Plusieurs choses sont demandées : traite chacune, brièvement et séparément.",
  detailed: "Donne le détail nécessaire aux points demandés, et rien au-delà.",
});

export function renderRelevanceForPrompt(c: RelevanceContract): string {
  const lines: string[] = ["PÉRIMÈTRE DE LA RÉPONSE :"];

  // Placée AVANT toute consigne de concision : mesuré, la règle des deux devises arrivait
  // après « réponds puis arrête-toi » et se faisait absorber par elle. Deux pays de devises
  // différentes évoqués, un seul montant rendu — une omission, pas une concision.
  if (c.multipleCurrencies && c.countryPricingRequired) {
    lines.push(
      "- OBLIGATOIRE : plusieurs pays de DEVISES DIFFÉRENTES sont évoqués. Donne les DEUX",
      "  montants avec leur devise respective. Ne les additionne pas, ne les fonds pas en un",
      "  seul chiffre, n'en omets aucun — même si la question paraît porter sur autre chose.",
    );
  } else if (c.multipleCurrencies) {
    // Question sur les DEVISES sans intention de prix (x7 : « deux devises donc ? ») : on
    // confirme la devise de chaque pays, SANS énoncer les montants — qui seraient hors sujet.
    lines.push(
      "- Précise la devise applicable à chaque pays évoqué (elles diffèrent). N'énonce PAS",
      "  les montants : la question porte sur les devises, pas sur les tarifs.",
    );
  } else if (c.requestedCountries.length === 1 && c.countryPricingRequired) {
    // Mesuré (pr2) : « et pour un client suisse, ça fait combien ? » recevait le tarif CH
    // PUIS « les autres pays sont à 449 € » — un ajout non sollicité, fondu dans la MÊME
    // phrase que le prix requis, donc inexcisable. Un seul pays évoqué : on s'y tient.
    lines.push(
      "- Un seul pays est évoqué : donne SON tarif et ne mentionne aucun autre pays de",
      "  lancement ni son prix. Ne compare pas, n'énumère pas les autres.",
    );
  } else if (c.requestedCountries.length === 1) {
    // Pays évoqué SANS intention de couverture/prix (c3 réglementaire, c4 impact) : on
    // répond à la question posée sans ajouter le tarif ni comparer avec d'autres pays.
    lines.push(
      "- Un seul pays est évoqué : réponds à la question posée sans énoncer de tarif ni",
      "  mentionner d'autres pays de lancement.",
    );
  }
  lines.push(`- ${DEPTH_INSTRUCTION[c.answerDepth]}`);

  lines.push(
    "- Réponds à ce qui est demandé, ajoute au plus UNE limite si son absence induirait",
    "  en erreur, et termine. N'ajoute aucun contexte que personne n'a demandé.",
  );

  if (c.forbiddenTopicLabels.length > 0) {
    lines.push(
      "- N'aborde AUCUN de ces sujets, ils n'ont pas été demandés :",
      ...c.forbiddenTopicLabels.map((l) => `    · ${l}`),
    );
  }
  if (c.multipleCurrencies && c.countryPricingRequired) {
    // Mesuré : deux pays évoqués, deux tarifs servis — et une réponse qui n'en donnait
    // qu'un. Fondre deux devises en un montant est une erreur de fond, pas de style.
    lines.push(
      "- Plusieurs pays de DEVISES DIFFÉRENTES sont évoqués : donne les DEUX montants avec",
      "  leur devise respective, sans les additionner ni les fondre en un seul chiffre.",
    );
  }
  if (!c.shouldOfferNextStep) {
    lines.push("- Ne propose ni page, ni lien, ni prochaine étape : on ne t'a rien demandé de tel.");
  }
  if (!c.shouldUseCommercialCta) {
    lines.push("- Aucun argumentaire commercial, aucune invitation à souscrire, aucun chiffrage de gain.");
  }

  if (c.nature === "support_incident") {
    // §6 — politique d'incident, générale : elle décrit une CONDUITE, pas un cas.
    lines.push(
      "",
      "DEMANDE D'ASSISTANCE :",
      "- Reconnais le problème en une phrase, sans le minimiser.",
      "- Tu n'as accès ni au compte, ni aux paiements, ni aux journaux : n'annonce aucun",
      "  diagnostic, aucune vérification faite, aucune action entreprise ou déclenchée.",
      "- Indique la voie d'assistance réelle parmi les pages listées, et rien d'autre.",
      "- Ne demande que l'information strictement nécessaire pour que l'assistance avance,",
      "  et jamais une donnée sensible (mot de passe, coordonnées bancaires complètes).",
      "- Aucune offre, aucun tarif, aucun gain de temps, aucune démonstration, aucune",
      "  réservation : une personne qui signale un incident n'est pas une occasion de vente.",
    );
  }

  // §8 — INCONDITIONNEL, et c'est la correction mesurée : la règle ne valait que pour les
  // questions de capacité, si bien qu'une objection, un calcul de temps ou une question de
  // mémoire produisaient une énumération détaillée de ce que Pierre sait faire — alors que
  // la récupération n'avait rendu AUCUNE source de capacité. Le modèle la tirait de ses
  // propres connaissances. Une capacité ne s'énonce que si un fait fourni la porte, quelle
  // que soit la question posée.
  lines.push(
    "",
    "CAPACITÉS — SÉPARE LES VERBES :",
    "- préparer, analyser, proposer, rédiger, suivre : possible.",
    "- exécuter, envoyer, signer, supprimer, décider : jamais fait automatiquement.",
    "- Préparer un document n'est pas le signer ; rédiger un message n'est pas l'envoyer ;",
    "  proposer un changement n'est pas l'appliquer ; un brouillon n'est pas une validation",
    "  juridique ; couvrir un domaine RH ne prouve pas qu'un traitement précis existe.",
    "- N'ÉNUMÈRE aucune tâche ou capacité de Pierre qui ne figure pas dans les faits fournis,",
    "  même si elle te paraît évidente pour un employé RH. Mais n'ajoute PAS non plus de",
    // Mesuré (gc6) : sur « qu'est-ce qu'il ne sait PAS faire ? », la réponse juste se
    // terminait par « je ne peux pas détailler ici d'autres tâches » — une méta-remarque
    // sur ta propre incapacité, que le juge lit comme une limite inventée. Réponds avec les
    // faits fournis et arrête-toi ; ne commente pas ce que tu ne peux pas détailler.
    "  méta-remarque sur ce que tu ne pourrais pas détailler : réponds avec les faits",
    "  fournis, puis arrête-toi.",
    // Même règle, étendue au-delà des capacités : mesuré sur une question de paiement, la
    // réponse exacte s'accompagnait de précisions de facturation qu'aucun fait ne portait.
    "- La même règle vaut pour tout DÉTAIL de facturation, de contrat, d'engagement, de délai",
    "  ou de moyen de paiement : s'il n'est pas dans les faits fournis, ne l'affirme pas —",
    "  ni au positif, ni au négatif.",
  );

  if (c.nature === "capability" || c.capabilityUnproven) {
    // Mesuré : « est-ce qu'il signe tout seul ? » recevait une réponse prudente sur la
    // validation humaine, qui laissait croire que la signature deviendrait possible UNE
    // FOIS validée. Distinguer les verbes ne suffit pas : quand la question PORTE sur un
    // verbe fort, l'inactivité doit être énoncée, pas déduite.
    lines.push(
      "- Si la question porte sur exécuter, envoyer, signer, supprimer ou décider, dis",
      "  EXPLICITEMENT que ce n'est pas actif aujourd'hui, et pas seulement qu'un humain",
      "  valide : une validation humaine annoncée laisse croire que l'action suivrait.",
    );
    if (c.capabilityUnproven) {
      lines.push(
        "- Aucune source fournie n'établit la capacité demandée : dis qu'elle ne peut pas être",
        "  confirmée comme active aujourd'hui. N'y substitue PAS une liste de capacités",
        "  générales. Tu peux, en une phrase, citer la capacité vérifiée la plus proche.",
      );
    }
  }

  if (c.unsupportedCountries.length > 0 && c.nature !== "out_of_scope") {
    // Mesuré (py2) : « et si on ouvre au Portugal l'an prochain ? » recevait la bonne
    // réponse (non couvert, pas de date) SUIVIE d'un panorama RH et de paragraphes
    // réglementaires que personne n'avait demandés. Un pays hors périmètre appelle une
    // réponse BRÈVE et fermée, pas un pivot vers ce que Pierre sait faire.
    // Exclu si la demande est hors sujet (h1 « capitale de l'Australie ») : on ne parle
    // alors d'aucun pays, le refus prime.
    lines.push(
      "",
      "- Un pays hors périmètre a été évoqué : dis franchement, en une à deux phrases, qu'il",
      "  n'est pas couvert aujourd'hui et qu'aucune date n'est annoncée, puis ARRÊTE-TOI.",
      "  N'enchaîne PAS sur les capacités de Pierre, ni sur des considérations réglementaires",
      "  ou opérationnelles de ce pays, et n'évoque AUCUNE adaptation qui serait nécessaire,",
      "  possible ou « non définie » : la réponse se limite au statut de couverture.",
    );
  }

  return lines.join("\n");
}

// ── Contrôle de la réponse ───────────────────────────────────────────────────
// Trois détecteurs COURTS plutôt qu'une longue alternance : une invitation seule
// (« vous pouvez me donner la date ») est légitime dans une réponse d'assistance ; ce
// n'est une offre que si elle mène quelque part. On exige donc les DEUX signaux, ou une
// adresse explicite. Chacun tient largement sous la borne de taille, et aucun n'énumère
// une formulation d'utilisateur.
/** Cadrage « oui ou non » : la personne réclame une réponse tranchée, sans ajout. */
const BINARY_ASK = /\boui\s+ou\s+non\b|\boui\s*\/\s*non\b|\bpar oui ou (?:par )?non\b/i;
const INVITATION = /\b(?:vous pouvez|je vous invite|n'h[ée]sitez pas|rendez-vous|je vous propose)\b/i;
const DESTINATION = /\b(?:r[ée]serv|d[ée]couvr|essay|consult|visit|page|d[ée]mo|souscri|inscri)/i;
const ROUTE_OR_URL = /https?:\/\/|(?:^|\s)\/[a-z][a-z0-9/-]{2,}/i;

function offersNextStep(sentence: string): boolean {
  return ROUTE_OR_URL.test(sentence) || (INVITATION.test(sentence) && DESTINATION.test(sentence));
}

export interface UnsolicitedHit {
  readonly sentence: string;
  readonly topicId: string;
}

/** Découpe en phrases en conservant la ponctuation finale. Partagé avec le vérificateur. */
export function splitSentences(text: string): readonly string[] {
  return text.split(/(?<=[.!?…])\s+/).filter((s) => s.trim().length > 0);
}

/**
 * Phrases à retirer : celles qui n'apportent QU'un sujet non sollicité.
 *
 * Deux garde-fous délibérés :
 *   — une phrase qui sert aussi un point du contrat de couverture n'est jamais retirée :
 *     mieux vaut une réponse un peu large qu'une réponse amputée ;
 *   — le résultat n'est appliqué que s'il reste du texte (voir le vérificateur).
 */
export function findUnsolicitedSentences(
  text: string,
  c: RelevanceContract,
  allowedRoutePaths: readonly string[] = [],
): readonly UnsolicitedHit[] {
  const hits: UnsolicitedHit[] = [];
  const requiredTokens = c.requiredClaims
    .join(" ")
    .toLowerCase()
    .split(/[^a-zà-ÿ0-9]+/)
    .filter((w) => w.length > 4);

  for (const sentence of splitSentences(text)) {
    const lower = sentence.toLowerCase();
    // Une phrase qui porte le vocabulaire de la demande fait partie de la réponse.
    const servesRequirement = requiredTokens.filter((t) => lower.includes(t)).length >= 2;

    for (const topic of c.forbiddenUnsolicitedTopics) {
      if (!topic.matches(sentence, c.topicContext)) continue;
      if (servesRequirement) continue;
      hits.push({ sentence, topicId: topic.id });
      break;
    }
    if (hits.some((h) => h.sentence === sentence)) continue;

    if (!c.shouldOfferNextStep && offersNextStep(sentence)) {
      // La voie d'assistance EST la réponse attendue d'un incident : elle n'est pas un CTA.
      const isAllowedRoute = allowedRoutePaths.some((p) => sentence.includes(p));
      if (!isAllowedRoute) hits.push({ sentence, topicId: "unsolicited_next_step" });
    }
  }
  return Object.freeze(hits);
}

/** Pages qu'une demande d'assistance a le droit de citer. Dérivé de la nature, pas d'un cas. */
export function allowedRoutePathsFor(c: RelevanceContract): readonly string[] {
  if (c.nature === "support_incident") return Object.freeze(["/questions", "/login"]);
  if (c.shouldOfferNextStep) return Object.freeze([]); // tout est permis : rien à protéger
  return Object.freeze([]);
}

/** Longueur attendue, en phrases, pour la profondeur demandée. Borne haute tolérante. */
export const DEPTH_SENTENCE_CEILING: Readonly<Record<AnswerDepth, number>> = Object.freeze({
  atomic: 6,
  multi: 12,
  detailed: 20,
});

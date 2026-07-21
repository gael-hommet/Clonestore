// src/lib/clonechat/public-answer/public-situation.ts
// C1.8 A2 — CLASSIFICATION DE SITUATION de la voie publique (déterministe, sans ID de corpus).
//
// Le défaut systémique d'A2 : deux routeurs concurrents (catégorie de réponse vs taxonomie de
// navigation) décidaient séparément du TEXTE et du CTA, sur des motifs très larges (« combien »,
// « où », « quand », « contrat »). Résultat : grille tarifaire sur un double débit, plan du site
// sur une panne, feuille de route interne sur « depuis quand existez-vous ».
//
// Ici, UNE situation est résolue par message, par priorité explicite : ce qui blesse l'utilisateur
// (incident, litige, refus) passe avant ce qui vend. Les drapeaux (injection, illicite, négation)
// sont indépendants de la situation : une injection greffée sur une demande de remboursement reste
// une demande de remboursement — refusée sur sa partie hostile, traitée sur sa partie légitime.

import { normalizeLaunchCountry, type LaunchCode } from "./public-canon";

export type IncidentKind = "payment" | "access" | "technical" | "document" | "unanswered";

export type LegalDoc = "cgv" | "cgu" | "mentions" | "privacy" | "dpa";

export type CapabilityKey =
  | "missions_scope" | "languages" | "headcount" | "payroll" | "document_ownership"
  | "company_age" | "customer_count" | "service_reliability" | "other_employees"
  | "delivery_delay" | "partner_commission" | "legal_guarantee" | "certification"
  | "invents_law" | "replaces_hr" | "integrations" | "clonechat_identity";

export type PublicSituationKind =
  | "prompt_injection"
  | "illicit_request"
  | "incident"
  | "abandon"
  | "denied_intent"
  | "corrected_value"
  | "country_availability"
  | "legal_document"
  | "privacy_security"
  | "governance_limit"
  | "hr_document_request"
  | "mission_request"
  | "validation_request"
  | "private_data_request"
  | "technology_explanation"
  | "company_identity"
  | "payment_method"
  | "human_contact"
  | "value_question"
  | "capability_question"
  | "false_price_premise"
  | "pricing_question"
  | "cancellation"
  | "purchase_intent"
  | "demo_request"
  | "discover_pierre"
  | "discover_clonestore"
  | "catalog_question"
  | "partner_program"
  | "login_help"
  | "signup_help"
  | "navigate_home"
  | "next_step"
  | "help_request"
  | "greeting"
  | "out_of_scope"
  | "unclear";

export interface PublicSituation {
  readonly kind: PublicSituationKind;
  readonly reason: string;
  /** Refus nommé d'une injection greffée sur un message par ailleurs légitime. */
  readonly injectionFlag: boolean;
  /** Demande illicite greffée (falsification, contournement) sur un message légitime. */
  readonly illicitFlag: boolean;
  readonly incidentKind: IncidentKind | null;
  readonly legalDoc: LegalDoc | null;
  readonly capability: CapabilityKey | null;
  /** Pays cité : code de lancement, ou libellé brut si hors lancement. */
  readonly country: { readonly code: LaunchCode | null; readonly label: string } | null;
  /** Intention explicitement NIÉE par l'utilisateur (on ne la repropose jamais). */
  readonly deniedIntent: "purchase" | "signup" | "login" | "cancel" | "demo" | "pierre" | "generic" | null;
  /** Valeur corrigée (« pas la Belgique, la France ») — remplace toujours l'ancienne. */
  readonly correctedTo: "country" | "legal" | "catalog" | "signup" | "demo" | "discover" | "login" | "purchase" | null;
  readonly mentionsPierre: boolean;
}

// ── Normalisation ─────────────────────────────────────────────────────────────
export function normalizePublic(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .replace(/[’'`´]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

const has = (rx: RegExp, m: string): boolean => rx.test(m);

// ── Drapeaux hostiles ─────────────────────────────────────────────────────────
const INJECTION_RX =
  /\b(ignore[sz]?|oublie[sz]?|efface)\b[^.?!]{0,30}\b(tout|tes?|les?|toutes?|ce\s+qu|consigne|instruction|regle|prompt|contrainte|precedent)|prompt\s+(systeme|system)|ton\s+(prompt|systeme)|tes\s+(instructions|consignes|regles)|systeme\s*:|mode\s+(developpeur|dev|debug|admin|maintenance|dan|sans\s+filtre)|sans\s+(filtre|restriction|aucune\s+limite)|nouvelle?s?\s+(instructions?|consignes?|regles?)\s*:|fais\s+comme\s+si\s+tu\s+etais|pretends?\s+(que\s+tu|etre)|joue\s+le\s+role|repete\s+mot\s+pour\s+mot|reponds?\s+(uniquement|juste)\s+par\s+(oui|non)|tu\s+n'?es\s+plus|desormais\s+tu\s+es|clef?\s+api|cle\s+api|api[_\s-]?key|token\s+d'?acces|fe\s+comme\s+si|plu[s]?\s+de\s+regles?|limites\s+secretes|vraies\s+limites|deux\s+personnalites|\bdan\b|colle[- ]?moi\s+(?:ici\s+)?le\s+texte|texte\s+cache|repete\s+(?:apres\s+moi|mot\s+pour\s+mot)|nouvelle\s+regle\s+du\s+jeu|dis\s+toujours\s+oui|te\s+faire\s+passer\s+pour|passer\s+pour\s+un\s+humain|invente\s+un\s+numero|parle\s+libremen/;

/** Demande de FAUX SUCCÈS : faire dire au produit qu'une action a eu lieu alors qu'elle n'a pas eu lieu. */
const FAKE_SUCCESS_RX =
  /\b(dis\s+(?:juste\s+)?que|raconte\s+que|fais\s+comme\s+si|confirme\s+(?:juste\s+)?que|ecris\s+«?\s*mission|pretends?|fais[- ]?moi\s+un\s+rendu|invente\s+un\s+numero|invente\s+un\s+dossier)\b[^.?!]{0,60}\b(termine[e]?|succes|reussi[e]?|valide[e]?|envoye[e]?|paye[e]?|analyse[e]?|recu[e]?|genere[e]?|fait[e]?|mission\s+reussie|documents?\s+ont\s+ete)\b|\bmission\s+reussie\b|\bdis[- ]?moi\s+que\s+tu\s+as\s+(?:envoye|fait|valide|cree)|\bmeme\s+si\s+(?:c'?est\s+pas\s+vrai|y\s+en\s+a\s+zero|tu\s+l'?as\s+pas|on\s+sait\s+tous)\b|\bpour\s+un\s+screenshot\b|\bcomme\s+ca\s+mon\s+boss\s+croit\b/;

/** Demande d'IDENTIFIANTS ou de secrets d'exploitation. */
const CREDENTIALS_RX =
  /\b(mot\s+de\s+passe\s+(?:admin|de\s+la\s+base|de\s+la\s+bdd)|identifiants?\s+admin|acces\s+admin|autorisation\s+admin|fichier\s+de\s+configuration|coordonnees\s+bancaires\s+d'?un\s+autre|numero\s+de\s+carte)\b/;

/** Tentative d'accès aux données d'un AUTRE tenant. */
const CROSS_TENANT_RX =
  /\b(missions?\s+(?:de\s+)?(?:toutes?\s+les|chaque)\s+(?:entreprises?|companies)|conversation[s]?\s+(?:precedente[s]?\s+)?(?:de\s+)?(?:l'?utilisateur\s+d'?avant|d'?une?\s+autre|qu'?a\s+eue?\s+une\s+autre)|autre\s+entreprise\s+avec\s+toi|societe\s+concurrente\s+inscrite|d'?un\s+autre\s+client|list\s+all\s+missions)\b/;

const ILLICIT_RX =
  /\b(hack|hacker|pirate[rz]?|piratage|craquer|forcer\s+le\s+compte)\b|\b(faux|fausse|falsifi[a-z]*|antidat[a-z]*|retrodat[a-z]*|back\s?date)\b[^.?!]{0,30}\b(document|contrat|attestation|facture|certificat|date|bulletin)|\b(document|contrat|attestation|facture|certificat)\b[^.?!]{0,25}\b(antidat[a-z]*|falsifi[a-z]*|retrodat[a-z]*)|invente[rz]?\s+(un\s+)?(article|clause|loi|texte|jurisprudence)|usurp[a-z]*|au\s+nom\s+de\s+quelqu|a\s+la\s+place\s+de\s+(mon|son)\s+(associe|patron)|\b(vire|virement|transfere?[rz]?|preleve[rz]?)\b[^.?!]{0,30}\b(\d[\d\s]{2,}|euros?|eur\b|rib|iban|compte\s+de\s+la\s+societe|fournisseur|ma\s+carte|ma\s+cb)|\binvesti[a-z]*\b[^.?!]{0,30}(bourse|action|tresorerie|crypto)|\bscrap[a-z]*\b|\bcode\s+python\b|script\s+python|boite\s+mail\s+de\s+(mon|le)\s+concurrent|donnees?\s+d'?(?:une\s+)?autres?\s+(?:boite|entreprise|societe|client)|d'?autres\s+(?:boites|entreprises|clients)|liste\s+des\s+salaries\s+de\s+(?!ma|mon|notre)/;

// ── Incidents ────────────────────────────────────────────────────────────────
const TROUBLE_RX =
  /\b(marche\s+pa[s]?|fonctionne\s+pa[s]?|ne\s+marche|ne\s+fonctionne|marche\s+plus|bug[a-z]*|erreur|error|panne|plante|casse|cassee|deconne|rame|lent[a-z]*|fige[e]?|gele|bloque[e]?|verrouille|echoue|echec|refuse[e]?|rejete|impossible|arrive\s+pa[s]?|arrive\s+plus|rien\s+ne\s+se\s+passe|rien\s+du\s+tout|fait\s+rien|ne\s+(?:reagit|repond|marche|fonctionne|charge|s'?ouvre|se\s+lance)\s+(?:pas|plus)|reagit\s+(?:pas|plus)|inutilisable|met\s+\w+\s+minutes?|session\s+(?:saute|expire|coupe)|rejett?e|page\s+blanche|ecran\s+(noir|blanc|fige|tout\s+noir)|reste\s+(blanc|blanche|noir|noire|figee?|vide|en\s+chargement)|tourne\s+dans\s+le\s+vide|chargement\s+infini|en\s+boucle|boucle\s+vers|expire[e]?|perdu|disparu|introuvable|est\s+vide|mort\b|(?<!sans\s)souci|probleme|pb\b|comprends?\s+rien|c'est\s+quoi\s+ce\s+(bazar|bordel|delire)|c'est\s+quoi\s+le\s+delire|jamais\s+recu|pas\s+recu|pa\s+recu|toujours\s+pas|repond\s+(pa[s]?|plus)|se\s+lance\s+pas|ne\s+se\s+lance|trop\s+lourde|jette\s+dehors|grise[e]?s?|deconnecte|se\s+ferme|redemarre|au\s+secours|ca\s+commence\s+a\s+bien\s+faire|scandaleux|inadmissible|inaccessible|indisponible|hors\s+service|\bdown\b|que\s+dalle|napparait|apparait\s+pas|recois\s+(?:pas|plus)|deux\s+fois|double\s+debit|c'?est\s+normal|transaction\s+en\s+cours|depuis\s+\d+\s*(?:minutes?|min|jours?|h)|rien\s+valide|sans\s+mon\s+accord|passe\s+ou\s+pas|abouti\s+ou|peux\s+plus\s+rien\s+faire|cadenas|charge\s+dans\s+le\s+vide|tourne\s+sans\s+fin|roue\s+tourne|devient\s+tout\s+noir|bizarre|je\s+ne\s+comprends\s+pas|que\s+je\s+ne\s+comprends|crash[a-z]*|bloke[e]?|aidez\s+moi\s+vite|ete\s+pirate|actions\s+que\s+j'?ai\s+pas\s+faites|a\s+supprime\s+une|c'?est\s+grave)\b/;

/** Question d'ADMINISTRATION de facturation (sans mot de panne) : reste du support, jamais de vente. */
const BILLING_ADMIN_RX =
  /\b(iban\s+a\s+change|je\s+le\s+mets\s+ou|recu\s+introuvable|ou\s+je\s+(?:le|la)\s+(?:recupere|trouve)|ma\s+facture|mes\s+factures|code\s+promo|justificatif\s+de\s+paiement|pour\s+ma\s+comptable)\b/;

const BILLING_RX =
  /\b(rembours[a-z]*|debit[a-z]*|preleve[a-z]*|prelevement[a-z]*|factur[a-z]*|facture|paiement|payement|paye[a-z]*|paie\b|checkout|carte\s+(bancaire|bleue)?|\bcb\b|iban|rib|recu\b|transaction|banque|banquier|code\s+promo|montant|abonnement|souscription|449|499)\b/;

const AUTH_RX =
  /\b(connect[a-z]*|connexion|conekt[a-z]*|log\s?in|me\s+log[a-z]*|mot\s+de\s+passe|mdp|code\s+(?:de\s+)?(?:verif[a-z]*|sms|securite)|session|deconnect[a-z]*|acces\s+refuse|compte\s+(?:bloque|introuvable|verrouille|suspendu)|entreprise\s+introuvable|2fa|double\s+authentification|captcha|email\s+deja\s+utilise|reinitialis[a-z]*|tape\s+mon\s+code|identifiant)\b/;

const DOCUMENT_ARTEFACT_RX =
  /\b(document|contrat|pdf|attestation|piece\s+jointe|telecharg[a-z]*|historique|conversation|fichier|justificatif)\b/;

const UNANSWERED_RX =
  /\b(personne\s+(?:ne\s+)?repond|fois\s+que\s+(?:je\s+vous\s+ecris|j'ecris|je\s+vous\s+contacte)|aucune\s+reponse|pas\s+de\s+reponse|mon\s+ticket|reponse\s+a\s+mon\s+ticket|toujours\s+rien\s+de\s+regle)\b/;

const PAID_NO_ACCESS_RX =
  /\b(j'?ai\s+paye|jai\s+paye|paye\s+mais|debite\s+mais|regle\s+mais)\b[^.?!]{0,60}\b(pas\s+(?:d'?)?acces|aucun\s+acces|toujours\s+pas|rien|active)\b|\bpaye\b[^.?!]{0,40}\bpas\s+active\b/;

const REFUND_DEMAND_RX = /\brembours[a-z]*\b|\bje\s+veux\s+etre\s+rembourse\b/;

/** Blocage d'accès énoncé sans mot de panne : « mon compte est bloqué », « je suis bloqué dehors ». */
const ACCESS_BLOCKED_RX =
  /\bcompte[^.?!]{0,15}(?:bloke|bloque|suspendu|verrouille|desactive)\b|\bconekt|\bmn\s+compte\b|\bplus\s+revenir\b|\bcaptcha\b|\bcode\s+(?:sms|de\s+verif)|reinitialis[a-z]*\s+mon\s+mot|email\s+deja\s+utilise/;

/** Demande de contact humain / téléphone : c'est du support, jamais une occasion de vendre. */
const HUMAN_CONTACT_RX =
  /\b(parle[rz]?\s+(?:a|avec)\s+(?:un|une)\s+(?:vrai[e]?\s+)?(?:humain|personne|conseill[a-z]*|agent|commercial)|un\s+vrai\s+humain|pas\s+(?:a\s+)?un\s+robot|numero\s+(?:de\s+)?(?:tel|telephone)|numero\s+(?:pr|pour)\s+appel[a-z]*|vs\s+ave\s+un\s+numero|\bsav\b|service\s+client|joindre\s+quelqu|contacter\s+(?:le\s+)?support|jvoudre?\s+parler|jve\s+parle|numero\s+perso)|l?adres[a-z]*\s+mail\s+du\s+(?:patron|gerant|pdg|boss)/;

/** Moyens de paiement / lien de paiement : réponse honnête, jamais un lien inventé. */
const PAYMENT_METHOD_RX =
  /\b(moyen[s]?\s+de\s+paiement|quel[s]?\s+moyen|prenez\s+(?:la\s+)?(?:carte|cb|virement)|carte\s+ou\s+virement|virement\s+ou\s+(?:cb|carte)|lien\s+(?:direct\s+)?(?:de\s+|pour\s+)?(?:payer|paiement)|lien\s+stripe|paiement\s+stripe|payer\s+en\s+plusieurs?\s+fois|plusieur[a-z]*\s+foi[sx]?|paye?\s+en\s+plusieur|prennent\s+quoi\s+comme\s+paiement|comme\s+moyen\s+de\s+paiement)/;

// ── Négation / correction / abandon ──────────────────────────────────────────
const ABANDON_RX =
  /\b(laisse\s+(?:tomber|beton)|laisse,|oublie\s+(?:ma|la|ca|tout|le\s+reste)|^oublie\b|efface\s+ma\s+commande|zappe|tant\s+pis|pas\s+besoin|plus\s+la\s+peine|on\s+verra\s+(?:plus\s+tard|une\s+autre\s+fois)|pas\s+maintenant|c'est\s+pas\s+urgent|mets?\s+ca\s+de\s+cote|ca\s+ira\b|non\s+merci|je\s+retire|retire\s+ma\s+demande|annule\s+ma\s+demande|contrordre|contre-ordre|ne\s+fais\s+rien|je\s+rigolais|tout\s+compte\s+fait|finalement\s+non|bah\s+non\s+en\s+fait|merci\s+quand\s+meme)\b/;

const DENIAL_RX =
  /\b(j'?ai\s+jamais\s+dit|je\s+n'?ai\s+jamais\s+dit|jamais\s+dit\s+(?:que|vouloir)|tu\s+te\s+trompes|vous\s+vous\s+trompez|tu\s+as\s+mal\s+compris|vous\s+avez\s+mal\s+compris|c'?est\s+pas\s+(?:ce\s+que|ca\s+que)\s+j'?ai\s+dit|je\s+(?:ne\s+)?(?:veux|cherche|souhaite)\s+(?:pas|plus)\s+(?:a\s+)?(?:me\s+)?(?:connecter|m'?inscrire|acheter|reserver|annuler)|je\s+ne\s+cherche\s+pas|pas\s+question\s+de|non\s+pas\s+(?:pierre|ca|maintenant)|ah\s+non\s+pas\s+pierre|pas\s+pierre\b|m'?interesse\s+pas)\b/;

const CORRECTION_RX =
  /\b(plutot(?!\s+qu)|au\s+lieu|(?:non|pas)[^.?!]{0,20}en\s+(?:fait|realite|vrai)|je\s+voulais\s+dire|j'?ai\s+dit\s+(?:le|la|les|be|fr|connecter)|non\s+(?:mais\s+)?(?:du\s+coup\s+)?je\s+voulais|c'?etait\s+pas|minute,|attends?\s*,|correction|je\s+me\s+suis\s+(?:trompe|melange|goure)|tu\s+confonds|mauvaise\s+piste|pas\s+(?:ce|cette|ca)\s+(?:document|page|la)|pas\s+la\s+bonne\s+(?:page|direction)|reprenons|revenons\s+en\s+arriere|recommence|remets\s+comme\s+avant|reviens\s+en\s+arriere|je\s+disais\s+l'?inverse|c'?est\s+pas\s+(?:ca|du\s+tout|ce\s+que))\b/;

/** Ordre d'annulation générique d'un tour précédent (« annule tout », « stop ») — pas une résiliation. */
const CANCEL_LAST_TURN_RX =
  /\b(annule\s+(?:tout|annule|la\s+mission|ma\s+demande|cette|ce)|annule\s+annule|c'?est\s+bon\s+annule|change\s+tout|recommence\s+a\s+zero|stop\b|arrete\s+arrete|retire\s+cette\s+validation|remets\s+comme\s+avant|j'?ai\s+change\s+d'?avis)\b/;

// ── Pays ─────────────────────────────────────────────────────────────────────
// Un ADJECTIF DE LANGUE (« anglais », « espagnol », « allemand », « italien ») n'est PAS un pays :
// « Pierre parle anglais ? » est une question de langue, pas de disponibilité. Seuls les noms de
// pays, les villes et les gentilés non ambigus sont retenus ici.
interface CountryToken { readonly rx: RegExp; readonly code: LaunchCode | null; readonly label: string }
const OUT_OF_LAUNCH_TOKENS: readonly CountryToken[] = [
  { rx: /\b(quebec|quebecois[a-z]*)\b/, code: null, label: "le Québec" },
  { rx: /\b(canada|canadien[a-z]*|montreal|toronto)\b/, code: null, label: "le Canada" },
  { rx: /\b(maroc|marocain[a-z]*|casablanca|\bcasa\b|rabat|marrakech)\b/, code: null, label: "le Maroc" },
  { rx: /\b(allemagne|berlin|munich|hambourg)\b/, code: null, label: "l'Allemagne" },
  { rx: /\b(royaume[- ]uni|angleterre|londres|\buk\b|grande[- ]bretagne|britannique)\b/, code: null, label: "le Royaume-Uni" },
  { rx: /\b(etats[- ]?unis|\busa\b|americain[a-z]*|new\s?york|californie)\b/, code: null, label: "les États-Unis" },
  { rx: /\b(espagne|madrid|barcelone)\b/, code: null, label: "l'Espagne" },
  { rx: /\b(italie|rome|milan)\b/, code: null, label: "l'Italie" },
  { rx: /\b(portugal|lisbonne)\b/, code: null, label: "le Portugal" },
  { rx: /\b(tunisie|tunisien[a-z]*|tunis)\b/, code: null, label: "la Tunisie" },
  { rx: /\b(algerie|algerien[a-z]*|alger)\b/, code: null, label: "l'Algérie" },
  { rx: /\b(senegal|cote\s+d'?ivoire|abidjan|dakar)\b/, code: null, label: "ce pays" },
  { rx: /\b(pays[- ]bas|amsterdam|hollande)\b/, code: null, label: "les Pays-Bas" },
  { rx: /\b(dubai|emirats|singapour|chine|inde|bresil|mexique|japon|australie)\b/, code: null, label: "ce pays" },
];
// La Suisse est testée AVANT la France : « franc suisse » ne doit jamais être lu comme « France ».
const LAUNCH_TOKENS: readonly CountryToken[] = [
  { rx: /\b(suisse|helvet[a-z]*|geneve|zurich|lausanne|romandie)\b/, code: "CH", label: "la Suisse" },
  { rx: /\b(belgique|belge|bruxelles|anvers|liege|wallonie|flandre)\b/, code: "BE", label: "la Belgique" },
  { rx: /\b(luxembourg|luxembourgeois[a-z]*)\b/, code: "LU", label: "le Luxembourg" },
  { rx: /\b(france|francaise?|franc\b|paris|lyon|marseille|hexagone)\b/, code: "FR", label: "la France" },
];

const AVAILABILITY_RX =
  /\b(dispo[a-z]*|disponible|vendez|vends|vend[a-z]*|couvr[a-z]*|couvert|present[a-z]*|lance[a-z]*|marche[a-z]*|travaill[a-z]*|gere[a-z]*|utilisable|accessible|ouvert|quels?\s+pays|dans\s+quels?\s+pays|ca\s+tourne|ca\s+fonctionne|filiale|site\s+a|habite|je\s+suis\s+a|chez\s+nous\s+en|version)\b/;

// ── Légal ────────────────────────────────────────────────────────────────────
const LEGAL_TOKENS: ReadonlyArray<{ rx: RegExp; doc: LegalDoc }> = [
  { rx: /\bcgv\b|conditions\s+generales\s+de\s+vente|conditions\s+de\s+vente/, doc: "cgv" },
  { rx: /\bdpa\b|accord\s+de\s+traitement|sous[- ]?traitance\s+des\s+donnees/, doc: "dpa" },
  { rx: /mentions\s+legales|\bmentions\b|editeur\s+du\s+site|qui\s+edite/, doc: "mentions" },
  { rx: /confidentialite|\brgpd\b|\bgdpr\b|donnees\s+personnelles|vie\s+privee|politique\s+de\s+(?:confidentialite|donnees)/, doc: "privacy" },
  { rx: /\bcgu\b|conditions\s+generales\s+d'?utilisation|conditions\s+d'?utilisation|conditions\s+generales\b|condition[s]?\s+legal/, doc: "cgu" },
];

const LEGAL_LOOKUP_RX =
  /\b(ou\s+(?:sont|son|est|se\s+trouve|trouve[rz]?|puis[- ]?je)|trouver|cherche|lire|consulter|lien|page|url|adresse|acceder|voir)\b/;

// ── Confidentialité / sécurité / hébergement ─────────────────────────────────
const PRIVACY_QUESTION_RX =
  /\b(heberge[a-z]*|stock[a-z]*|serveurs?|donnees\s+(?:sont|elles|partent|vont)|ou\s+(?:sont|vont|partent)\s+(?:mes|les|nos)\s+donnees|entrain[a-z]*|entrain?er|apprend\s+de\s+mes|confidentiel|lu\s+par\s+des\s+humains|chiffr[a-z]*|securise|securite|revendez|vendez\s+mes\s+donnees|conservation|combien\s+de\s+temps[^.?!]{0,25}(?:garde|stock|conserv)|supprim[a-z]*\s+mes\s+donnees|droit\s+a\s+l'?oubli|sous[- ]?traitant)\b/;

// ── Gouvernance / limites dures ──────────────────────────────────────────────
const GOVERNANCE_RX =
  /\b(licenci[a-z]*|virer?\s+(?:mon|un|quelqu|le)|vir[a-z]*\s+un\s+salarie|sanction[a-z]*|disciplinaire|augment[a-z]*\s+(?:le\s+)?salaire|decision\s+(?:finale|salariale|disciplinaire)|salaire\s+de\s+[a-z]+|remuneration|signe[rz]?\s+(?:electroniquement\s+)?(?:le|la|ce|un|a\s+ma\s+place)|signature\s+(?:electronique|a\s+ma\s+place)|a\s+ma\s+place|tout\s+seul|toute?\s+seul|autonomie\s+(?:totale|complete)|sans\s+moi|sans\s+(?:passer\s+par\s+)?(?:les?\s+)?validation[a-z]*|contourn[a-z]*|sans\s+confirmation|valide[- ]?la?\s+toi[- ]?meme|prends?\s+la\s+decision|remplac[a-z]*\b[^.?!]{0,25}\b(?:drh|rh\b|service\s+rh|ressources\s+humaines)|virer\s+mon\s+drh|a\s+sa\s+place|une\s+validation|qui\s+valide|humain\s+qui\s+valide|ta\s+le\s+droit\s+de|as[- ]tu\s+le\s+droit|le\s+droit\s+de\s+licenci|decide[rz]?\s+toi[- ]?meme|tranche\s+pour\s+moi|augmente[rz]?\s+mon\s+salaire|baisse\s+de\s+salaire|prime[s]?\s+(?:de\s+)?(?:fin\s+d'?annee|3000|a\s+tout)|colle\s+une\s+prime|verse[- ]?les)\b/;

const LEGAL_GUARANTEE_RX =
  /\b(garanti[a-z]*|prud'?homme[a-z]*|condamne|conform[a-z]*|responsabilite\s+juridique|agree[a-z]*|agrement|certifi[a-z]*|homologu[a-z]*|ministere|inspection\s+du\s+travail|valeur\s+juridique|opposable)\b/;

// ── Travail RH / documents ───────────────────────────────────────────────────
const HR_DOC_RX =
  /\b(gener[a-z]*|genere|redig[a-z]*|redije|prepar[a-z]*|cre[a-z]*|fai[ts]?\s+moi|fe\s+moi|sort[a-z]*|edit[a-z]*|etabli[a-z]*|monte[rz]?|regener[a-z]*|modifi[a-z]*|rajout[a-z]*|ecri[stv][a-z]*)\b[^.?!]{0,45}\b(contrat|cdi|cdd|avenant|attestation|promesse\s+d'?embauche|certificat|courrier|lettre|convention|apprentissage|solde\s+de\s+tout\s+compte|bulletin|fiche\s+de\s+paie|document|modele|rupture|licenciement|preavis|note)\b|\b(contrat|cdi|cdd|avenant|attestation|promesse\s+d'?embauche|certificat|convention\s+de\s+stage|apprentissage)\b[^.?!]{0,30}\b(pour|de)\s+[a-z]+|\b(prepare|prepar[a-z]*)\s+(?:son|le|la|un|une)\s+contrat\b|\bmodele\s+de\s+contrat\b|\bcontrat\s+de\s+travail\b|\bkesk'?il\s+faut\s+comme\s+doc|\bquels?\s+doc(?:s|uments)?\s+(?:faut|pour)\b|\bfiche\s+de\s+poste\b|\bregistre\s+unique\b|\bsolde\s+de\s+tout\s+compte\b|\brupture\s+conventionnelle\b|\breglement\s+interieur\b|\bcontrat\s+d'?apprentissage\b|\bpromesse\s+d'?embauche\b|\bavenant\b/;

const PRIVATE_DATA_RX =
  /\b(mes\s+(?:salaries|employes|documents|missions|contrats|factures|donnees|conversations|equipes)|mon\s+(?:dossier|equipe|historique|apprenti|salarie|planning))\b|\b(ou\s+(?:est|sont)\s+(?:mon|ma|mes))\b|\bcombien\s+(?:j'?ai|de)\s+(?:salaries|employes)\s+(?:dans|chez)\b|\bmontre[- ]?moi\s+(?:mes|mon|ma)\b|\bstatut\s+de\s+ma\b|\bou\s+en\s+est\s+ma\b|\b(?:modifi[a-z]*|met[a-z]*\s+a\s+jour|corrig[a-z]*|regener[a-z]*|edit[a-z]*|clotur[a-z]*|annul[a-z]*|supprim[a-z]*)\b[^.?!]{0,35}\b(?:mission|dossier|document|contrat|fiche)\b|\b(?:le\s+)?dossier\s+de\s+[a-z]+|\bsors[- ]?moi\s+(?:tous|toutes|le|la|les)\b|\bmission\s+(?:en\s+cours|que\s+j'?ai|de\s+recrutement)\b|\bhistorique\s+de\s+conversation|\bhistorik\b|\bmes\s+missions\b/;

/** Demande de MISSION (créer, lancer, planifier, monter) — le cœur du travail Pierre. */
const MISSION_REQUEST_RX =
  /\b(cre[a-z]*|creer|cree|lance[rz]?|lanc[a-z]*|demarre[rz]?|monte[rz]?|planifi[a-z]*|initi[a-z]*|organis[a-z]*|prepar[a-z]*|met[a-z]*\s+en\s+place|occupe[- ]?toi|gere[rz]?|fais|fai[st]|faire|fe\s+moi|tu\s+me\s+fais)\b[^.?!]{0,45}\b(mission|planning|onboarding|offboarding|recrutement|entretien[s]?|conges|absences?|duerp|risques\s+psychosociaux|bilan\s+social|registre|tickets\s+restaurant|arret\s+maladie|depart\s+a\s+la\s+retraite|regelement|reglement\s+interieur|formation|dossier\s+rh|entretiens?\s+(?:annuel|professionnel|obligatoire))\b|\bcree\s+mission\b|\bmission\s*:/;

/** Demande de VALIDATION / approbation — plancher humain, jamais exécutée. */
const VALIDATION_REQUEST_RX =
  /\b(valide[rz]?|valid[a-z]*|approuve[rz]?|accepte[rz]?|confirme[rz]?)\b[^.?!]{0,45}\b(absence|conge[s]?|note[s]?\s+de\s+frais|heures?\s+sup|prime|teletravail|formation|mutuelle|arret\s+maladie|entretien|passage|statut|demande|mission|tout|toutes)\b|\bfe\s+valide|\bfaut\s+valider\b|\bvalide\s+et\s+clotur|\bmets?\s+la\s+validation\b/;

/** Concepts produit / technologies CloneStore : répondre, jamais éluder. */
const TECHNOLOGY_RX =
  /\b(cloneos|clonecall|cloneroom|cloneguard|clonetrace|clonevoice|clonepolicy|clonebrief|cloneadn|technologies?\s+dont|les\s+technologies|ces\s+technologies|technos?\s+derriere|cockpit|mission\s+gouvernee|gouvernance|jargon|appli\s+mobile|application\s+mobile|que\s+sur\s+ordi|modele\s+d'?ia|quel\s+modele|\bgpt\b|\bclaude\b|\bllm\b|ia\s+derriere)\b/;

/** Qui est derrière CloneStore (éditeur, société, localisation du siège). */
const COMPANY_IDENTITY_RX =
  /\b(la\s+boite\s+derriere|societe\s+derriere|qui\s+edite|editeur\s+du\s+site|vous\s+etes\s+qui|vous\s+etes\s+bases?\s+ou|ou\s+etes[- ]?vous\s+bases?|siege\s+social|votre\s+entreprise\s+c'?est\s+qui)\b/;

/** Question de VALEUR (« ça vaut le coup ? », « concrètement je gagne quoi ? »). */
const VALUE_RX =
  /\b(ca\s+vaut\s+le\s+coup|vaut\s+quoi|jgagne\s+koi|je\s+gagne\s+quoi|concretemen[t]?\s+j|quel\s+interet|pourquoi\s+(?:je\s+)?(?:le\s+)?prendre|c'?est\s+fiable|ca\s+marche\s+vraiment|c'?est\s+du\s+vent|costaud|convainc)\b/;

// ── Capacités / limites produit ──────────────────────────────────────────────
const CAPABILITY_TOKENS: ReadonlyArray<{ rx: RegExp; key: CapabilityKey }> = [
  { rx: /\b(langue[s]?|anglais|espagnol|allemand|italien|multilingue|traduit|traduction|traduis|traduire|version\s+anglaise|parle\s+combien|anglophone[s]?)\b/, key: "languages" },
  { rx: /\b(combien\s+de\s+missions|quelles?\s+missions|missions?\s+(?:rh\s+)?(?:differentes|couvertes|capable|possibles)|que\s+sait[- ]?il\s+faire|type[s]?\s+de\s+missions|capable\s+de\s+prendre\s+en\s+charge|il\s+sait\s+faire\s+quoi|domaines?\s+rh)\b/, key: "missions_scope" },
  { rx: /\b(combien\s+de\s+salaries|effectif\s+(?:maximum|max|limite)|\d{3,}\s*(?:personnes|salaries|employes)|taille\s+maximum|limite\s+de\s+salaries|ca\s+tient)\b/, key: "headcount" },
  { rx: /\b(paie\s+complete|toute\s+la\s+paie|bulletin[s]?\s+de\s+(?:paie|salaire)|fiche[s]?\s+de\s+pa[yi]e|\bdsn\b|edite[rz]?\s+(?:les\s+)?bulletins|faite[sz]?\s+les\s+fiche[s]?\s+de\s+pa[yi]e)\b/, key: "payroll" },
  { rx: /\b(propriete\s+des?\s+documents|garde\s+la\s+propriete|a\s+qui\s+appartiennent|droits\s+sur\s+les\s+documents|proprietaire\s+des\s+documents)\b/, key: "document_ownership" },
  { rx: /\b(existez\s+depuis|depuis\s+quand|cree[e]?\s+en\s+quelle\s+annee|anciennete|date\s+de\s+creation|vous\s+etes\s+la\s+depuis)\b/, key: "company_age" },
  { rx: /\b(combien\s+de\s+clients|nombre\s+de\s+clients|combien\s+d'?entreprises\s+utilisent|vos\s+references|qui\s+utilise\s+pierre)\b/, key: "customer_count" },
  { rx: /\b(pannes?|uptime|disponibilite\s+du\s+service|taux\s+de\s+dispo|incidents?\s+le\s+mois|sla\b)\b/, key: "service_reliability" },
  { rx: /\b(autres?\s+employes?\s+ia|d'?autres\s+employes|catalogue|employe\s+ia\s+(?:comptable|commercial|juridique|marketing)|combien\s+d'?employes\s+ia|quels?\s+employes|marie\b|d'?autres\s+agents|employe[a-z]*\s+(?:ia\s+)?(?:pr|pour)\s+(?:la\s+)?(?:compta|comptabilite|vente|commercial|juridique)|employe\s+ia\s+comptable)\b/, key: "other_employees" },
  { rx: /\b(sous\s+combien\s+de\s+temps|delai\s+de\s+livraison|livrez|faut\s+combien\s+de\s+temps|dispo\s+quand|disponible\s+quand|il\s+est\s+dispo|quand\s+(?:est[- ]ce\s+que\s+)?(?:je\s+)?(?:peux|pourrai)\s+(?:l'?)?(?:avoir|commencer)|delai\s+d'?activation|combien\s+de\s+temps\s+pour\s+(?:l'?avoir|demarrer))\b/, key: "delivery_delay" },
  { rx: /\b(commission[s]?|marge|remuneration\s+partenaire|combien\s+(?:vous\s+)?(?:prenez|touchent?))\b/, key: "partner_commission" },
  { rx: /\b(invente\s+des\s+lois|invente\s+du\s+droit|hallucine|se\s+trompe\s+sur\s+la\s+loi|invente\s+des\s+articles)\b/, key: "invents_law" },
  { rx: /\b(remplace[a-z]*\s+(?:un\s+|le\s+|mon\s+)?(?:vrai\s+)?(?:drh|rh\b|service\s+rh|gestionnaire)|plutot\s+qu'?un\s+(?:vrai\s+)?drh|compare[rz]?\s+pierre\s+a\s+un\s+(?:vrai\s+)?drh|au\s+lieu\s+d'?un\s+drh)\b/, key: "replaces_hr" },
  { rx: /\b(integr[a-z]*\s+(?:avec|a)\s+|connect[a-z]*\s+(?:a|avec)\s+(?:mon|notre)\s+(?:sirh|paie|logiciel|outil)|\bapi\b|silae|payfit|sage|workday|compatible\s+avec)\b/, key: "integrations" },
  { rx: /\b(tu\s+sers\s+a\s+quoi|a\s+quoi\s+sert\s+clonechat|c'?est\s+quoi\s+clonechat|qui\s+es[- ]?tu|t'?es\s+qui|tu\s+es\s+quoi|ton\s+role|tu\s+fais\s+quoi\s+exactement|tu\s+peux\s+m'?aider)\b/, key: "clonechat_identity" },
];

// ── Prix ─────────────────────────────────────────────────────────────────────
const PRICE_QUESTION_RX =
  /\b(prix|tarif[a-z]*|coute?|couts?|combien\s+(?:ca\s+)?(?:coute|vaut)|c'?est\s+combien|par\s+mois|mensuel|abonnement\s+(?:coute|c'?est)|budget|cher\b|gratuit|gratos|essai\s+gratuit|ht\s+ou\s+ttc|devis|remise[a-z]*|reduction[a-z]*|reduc\b|ristourne[a-z]*|rabais|abonnement\s+a\s+vie|repay[a-z]*|chaque\s+annee|a\s+l'?annee|par\s+an\b|\b449\b|\b499\b|facturez\s+comment|conditions\s+tarifaires|gratui[a-z]*|reduc\b|ristourne|ct\s+combien|payant\s+tous\s+les\s+mois|une\s+seule\s+fois)\b/;

const FALSE_PRICE_RX = /\b(99|129|149|159|199|249|299|349|399|599|999)\s*(?:e|eur|euros?|balles|chf|francs?|\b)/;
/** Montant faux accompagné d'une unité monétaire : la correction est due, même sans mot « prix ». */
const FALSE_PRICE_STRONG_RX = /\b(99|129|149|159|199|249|299|349|399|599|999)\s*(?:€|e\b|eur|euros?|balles|chf|francs?)/;

// ── Achat / démo / découverte / partenaires / compte ─────────────────────────
const PURCHASE_RX =
  /\b(achet[a-z]*|acquer[a-z]*|acqui[a-z]*|command[a-z]*|reserv[a-z]*|souscri[a-z]*|m'?abonn[a-z]*|abonner|activ[a-z]*\s+pierre|prendre\s+pierre|je\s+(?:le\s+)?prends|il\s+me\s+le\s+faut|passer\s+commande|je\s+signe|panier|caisse|comment\s+(?:on\s+)?(?:paie|paye)|komen\s+on\s+paye|ou\s+payer|je\s+veux\s+acheter|jveux\s+pierre|embauch[a-z]*\s+pierre|me\s+lancer\s+avec|demarrer\s+avec\s+pierre|avoir\s+pierre|obtenir\s+pierre|mettre\s+en\s+place\s+pierre|travaille\s+pour\s+(?:moi|nous)|bosse\s+pour\s+(?:moi|nous))\b|\bpierre\b[^.?!]{0,25}\b(?:pour|chez|dans)\s+(?:nous|ma|mon|notre|l'?entreprise|ma\s+boite)|\bj'?le\s+prends?\b|\bjle\s+prends?\b|\bprend[a-z]*\s+pierre\b|\bcomen\s+j?\s?paye\b|\bjvai\s+prend[a-z]*\b/;

const DEMO_RX =
  /\b(demo|demonstration|voir\s+(?:pierre\s+)?en\s+action|montre[rz]?[- ]?(?:moi)?|montrer|fais\s+moi\s+voir|essay[a-z]*|esse[yi][a-z]*|essai\b|tester|test\b|voir\s+comment\s+(?:il|ca|pierre|ils)|apercu|tour\s+du\s+produit|prendre\s+en\s+main|jouer\s+avec|voir\s+ce\s+que\s+ca\s+donne|ressemble\s+a\s+quoi|le\s+faire\s+tourner|exemple\s+concret|video)\b/;

const DISCOVER_PIERRE_RX =
  /\b(qui\s+est\s+pierre|c'?est\s+quoi\s+pierre|que\s+fait\s+pierre|pierre\s+(?:fait|gere)\s+quoi|a\s+quoi\s+sert\s+pierre|decouvrir\s+pierre|comprendre\s+pierre|pierre\s+peut[- ]?il|capacites?\s+de\s+pierre|parle[rz]?[- ]?moi\s+de\s+pierre|presente[rz]?[- ]?moi\s+pierre|il\s+fait\s+quoi\s+pierre)\b/;

const DISCOVER_CLONESTORE_RX =
  /\b(c'?est\s+quoi\s+clonestore|c'?est\s+koi\s+clonestore|clonestore\s+c'?est\s+quoi|qu'?est[- ]?ce\s+que\s+clonestore|comprendre\s+clonestore|decouvrir\s+clonestore|vous\s+faites\s+quoi|ca\s+sert\s+a\s+quoi|a\s+quoi\s+ca\s+sert|comment\s+ca\s+marche|votre\s+methode|votre\s+concept|expliquez?[- ]?moi|dites?\s+m'?en\s+plus|jamais\s+entendu\s+parler|c'?est\s+quoi\s+votre\s+(?:truc|delire|concept)|vous\s+vendez\s+quoi|boutique\s+d'?employes|marketplace|je\s+regarde\s+juste|renseign[a-z]*|il\s+fait\s+quoi|ca\s+se\s+passe\s+comment|ca\s+se\s+branche|se\s+branche\s+comment|nom\s+de\s+votre\s+assistant|comment\s+(?:il\s+)?s'?appelle|komen\s+sa\s+march|jse\s+pas\s+trop|jsé\s+pas\s+trop|chai\s+pa\s+trop|g\s+pa\s+compri|jpe\s+faire\s+koi|cherche\s+des\s+info|par\s+ou\s+commencer|sais\s+pas\s+trop\s+par\s+ou|page\s+(?:pr|pour)\s+decouvrir|decouvrir\s+tt|votre\s+bazar|votre\s+machin|votre\s+truc|ce\s+truc\b)\b/;

const PARTNER_RX =
  /\b(partenaire[s]?|partenariat|revendeur|apporteur|marque\s+blanche|affili[a-z]*|founding\s+partner|cabinet[s]?\s+fondateur[s]?|partener[a-z]*|partenere)\b/;

const SIGNUP_RX = /\b(cre[a-z]*\s+(?:un\s+|1\s+)?compt[a-z]*|m'?inscri[a-z]*|s'?inscri[a-z]*|inscription|sign\s?up|ouvrir\s+un\s+compte)\b/;
const LOGIN_RX =
  /\b(me\s+connect[a-z]*|se\s+connect[a-z]*|connexion|log\s?in|acceder\s+a\s+mon\s+(?:compte|espace)|deja\s+un\s+compte|mon\s+tableau\s+de\s+bord|mot\s+de\s+passe\s+oublie|oublie\s+mon\s+(?:mot\s+de\s+passe|mdp)|\bmdp\b|\bconnecter\b|(?:conecte|connecte|conekte|konecte)\s+moi|se\s+log[a-z]*|me\s+log[a-z]*|jme\s+con[ea]ct[a-z]*|jme\s+conecte|page\s+(?:pr|pour)\s+(?:se\s+)?log[a-z]*|adresse\s+pour\s+se\s+log|cmt\s+jme)\b/;

const CANCEL_RX =
  /\b(resili[a-z]*|desabonn[a-z]*|desinscri[a-z]*|annul[a-z]*\s+(?:mon|l'?)\s*abonnement|arreter?\s+(?:mon\s+)?(?:abonnement|contrat)|mettre\s+fin\s+(?:a\s+)?(?:mon|l'?)\s*abonnement|ne\s+plus\s+(?:etre\s+)?(?:preleve|facture|payer)|pas\s+renouveler|me\s+desengager|engage\s+sur\s+\d+\s+mois|annul[a-z]*\s+(?:ma\s+)?(?:comande|commande)\b|annul[a-z]*\s+mon\s+abo\b|mon\s+abo\s+comen)\b/;

const HOME_RX =
  /\b(accueil|page\s+d'?accueil|ramene[- ]?moi|retour(?:ne)?\s+(?:a\s+la\s+)?(?:page\s+)?(?:d'?)?accueil|revenir\s+(?:a\s+l'?accueil|au\s+debut)|home\b)\b/;

const GREETING_RX =
  /^(?:re\s*)?(bonjour|bonsoir|salut|coucou|hello|hey|yo|slt|hi|bjr|bonne\s+journee|hola)\b[\s!.,?]*$/;

const OUT_OF_SCOPE_RX =
  /\b(pizza|recette|blanquette|meteo|il\s+(?:va\s+)?fai(?:re|t|s)\s+(?:beau|quel\s+temps)|quel\s+temps|football|foot\b|\bpsg\b|resultats?\s+du\s+match|blague|poeme|film|musique|horoscope|capitale\s+de|devoir[s]?\s+(?:de\s+maths|de\s+droit)|dissertation|discours\s+de\s+mariage|regime\s+alimentaire|perdre\s+\d+\s+kilos|diagnostic\s+medical|radio\s+medicale|mal\s+au\s+dos|\bloto\b|bitcoin|cours\s+(?:actuel\s+)?du\b|plombier|sens\s+de\s+la\s+vie|quel\s+age\s+(?:tu\s+as|as[- ]tu)|t'?es\s+ou\s+physiquement|t'?es\s+un\s+(?:vrai\s+)?humain|tu\s+es\s+humain|marie[rz]?[- ]?moi|amoureu[sx]|declaration\s+d'?impots|impots\s+perso|declaration\s+tva|ma\s+compta|gerer\s+ma\s+compta|prospection\s+commerciale|mes\s+clients\s+et\s+faire|installe[rz]?[- ]?moi\s+un\s+logiciel|acceder\s+a\s+ma\s+camera|mes\s+emails?\s+gmail|plainte\s+au\s+tribunal|numero\s+perso\s+de\s+ton|envoie\s+un\s+sms\s+a\s+toute|billet\s+de\s+train|reserve[rz]?\s+(?:moi\s+)?un\s+(?:billet|hotel|restaurant|vol|taxi)|script\s+(?:bash|shell|sql|js|python)|code\s+(?:bash|js|sql))\b/;

/** « Et après ? », « on commence par quoi ? » : le parcours existe, on le donne. */
const NEXT_STEP_RX =
  /\b(c'?est\s+quoi\s+la\s+suite|et\s+(?:apres|ensuite)\b|on\s+commence\s+par\s+quoi|par\s+ou\s+(?:je\s+)?commence|faut\s+faire\s+quoi\s+maintenant|je\s+fais\s+quoi\s+(?:de\s+tout\s+ca|maintenant)|on\s+fait\s+comment|prochaine\s+etape|et\s+apres\s+je\s+fais\s+comment)\b/;

/** Demande d'aide générique, sans objet identifiable : on oriente vers une personne. */
const HELP_REQUEST_RX =
  /\b(vous\s+pouvez\s+m'?aider|pouvez[- ]vous\s+m'?aider|tu\s+peux\s+m'?aider|besoin\s+d'?aide|aidez[- ]?moi|j'?ai\s+besoin\s+d'?aide)\b/;

const MENTIONS_PIERRE_RX = /\bpierre\b/;

// ── Classification ───────────────────────────────────────────────────────────
/**
 * Parmi les tokens qui matchent, renvoie celui dont la PREMIÈRE occurrence est la PLUS TARDIVE
 * dans le message. Corrige la classe de défaut « pas la Suisse, plutôt la France » : avant, le
 * pays choisi dépendait de l'ORDRE DU TABLEAU (Suisse toujours testée en premier, cf. commentaire
 * historique sur « franc suisse »), donc une correction explicite vers un second pays cité PLUS
 * LOIN dans la phrase était systématiquement ignorée au profit du premier pays cité — y compris
 * quand ce premier pays venait d'être explicitement écarté. Le dernier pays cité est la meilleure
 * approximation sans NLP de « ce que l'utilisateur veut dire en dernier » ; elle préserve aussi le
 * cas « franc suisse » (le mot « suisse » apparaît après « franc », donc gagne toujours).
 */
function latestMatchingToken<T extends { readonly rx: RegExp }>(m: string, tokens: readonly T[]): T | null {
  let best: T | null = null;
  let bestIndex = -1;
  for (const t of tokens) {
    const match = m.match(t.rx);
    if (match && match.index !== undefined && match.index > bestIndex) {
      bestIndex = match.index;
      best = t;
    }
  }
  return best;
}

function detectCountry(m: string): { code: LaunchCode | null; label: string } | null {
  // FAIL-CLOSED : un pays HORS lancement cité dans le message l'emporte toujours sur un pays de
  // lancement également cité. Sinon « dis-moi que Pierre est dispo au Maroc, pas en France »
  // recevrait le tarif français — c'est-à-dire une disponibilité inexistante présentée comme réelle.
  const outOfLaunch = latestMatchingToken(m, OUT_OF_LAUNCH_TOKENS);
  if (outOfLaunch) return { code: null, label: outOfLaunch.label };
  const launch = latestMatchingToken(m, LAUNCH_TOKENS);
  if (launch) {
    // Le code de lancement est confirmé par l'autorité P10 (jamais par ce fichier seul).
    return { code: launch.code ? normalizeLaunchCountry(launch.code) : null, label: launch.label };
  }
  return null;
}

function detectLegalDoc(m: string): LegalDoc | null {
  for (const t of LEGAL_TOKENS) if (t.rx.test(m)) return t.doc;
  return null;
}

function detectCapability(m: string): CapabilityKey | null {
  for (const t of CAPABILITY_TOKENS) if (t.rx.test(m)) return t.key;
  return null;
}

function detectIncident(m: string): IncidentKind | null {
  if (UNANSWERED_RX.test(m)) return "unanswered";
  if (PAID_NO_ACCESS_RX.test(m)) return "payment";
  if (REFUND_DEMAND_RX.test(m)) return "payment";
  if (BILLING_ADMIN_RX.test(m)) return "payment";
  const trouble = TROUBLE_RX.test(m);
  if (!trouble) return ACCESS_BLOCKED_RX.test(m) ? "access" : null;
  if (BILLING_RX.test(m)) return "payment";
  if (AUTH_RX.test(m) || ACCESS_BLOCKED_RX.test(m)) return "access";
  if (DOCUMENT_ARTEFACT_RX.test(m)) return "document";
  return "technical";
}

function detectDeniedIntent(m: string): PublicSituation["deniedIntent"] {
  if (/\b(demo|demonstration)\b/.test(m) && /\b(laisse|oublie|tant\s+pis|pas\s+de|plus\s+de)\b/.test(m)) return "demo";
  if (/\b(m'?inscrire|inscription|creer\s+un\s+compte)\b/.test(m)) return "signup";
  if (/\b(connecter|connexion|me\s+log)\b/.test(m)) return "login";
  if (/\b(annuler|resilier|abonnement)\b/.test(m)) return "cancel";
  if (/\b(acheter|reserver|achat|prendre)\b/.test(m)) return "purchase";
  if (/\b(demo|demonstration)\b/.test(m)) return "demo";
  if (/\bpierre\b/.test(m)) return "pierre";
  return "generic";
}

/**
 * Résout LA situation d'un message public. Déterministe : mêmes entrées ⇒ même sortie.
 * L'ordre des tests est la doctrine : ce qui blesse l'utilisateur passe avant ce qui vend.
 */
export function classifyPublicSituation(message: string): PublicSituation {
  const m = normalizePublic(message);
  const mentionsPierre = MENTIONS_PIERRE_RX.test(m);
  const injectionFlag = INJECTION_RX.test(m) || FAKE_SUCCESS_RX.test(m);
  const illicitFlag = ILLICIT_RX.test(m) || FAKE_SUCCESS_RX.test(m) || CREDENTIALS_RX.test(m) || CROSS_TENANT_RX.test(m);
  const country = detectCountry(m);
  const legalDoc = detectLegalDoc(m);
  const capability = detectCapability(m);
  const incidentKind = detectIncident(m);

  const base = {
    injectionFlag, illicitFlag, incidentKind: null as IncidentKind | null,
    legalDoc: null as LegalDoc | null, capability: null as CapabilityKey | null,
    country: null as PublicSituation["country"], deniedIntent: null as PublicSituation["deniedIntent"],
    correctedTo: null as PublicSituation["correctedTo"], mentionsPierre,
  };
  const of = (kind: PublicSituationKind, reason: string, over: Partial<PublicSituation> = {}): PublicSituation =>
    Object.freeze({ ...base, kind, reason, ...over });

  if (m.length < 2) return of("unclear", "message vide");

  // 1. Demande illicite — jamais exécutée, toujours refusée par son nom.
  if (illicitFlag && incidentKind === null) return of("illicit_request", "demande illicite ou hors charte");

  // 2. Incident / litige / blocage — priorité absolue sur toute lecture commerciale.
  if (incidentKind !== null) return of("incident", `incident ${incidentKind}`, { incidentKind });

  // 2b. Contact humain / téléphone — c'est du support, jamais une occasion de vendre.
  if (HUMAN_CONTACT_RX.test(m)) return of("human_contact", "demande de contact humain");

  // 3. Abandon / déni / correction — la dernière volonté de l'utilisateur gagne.
  // Une négation qui porte une DEMANDE DE REMPLACEMENT (« pas Pierre, les partenaires »,
  // « le prix ne m'intéresse pas, je veux tester ») doit suivre la demande, pas s'arrêter au refus.
  // INVARIANT : ce que l'utilisateur vient d'écarter n'est JAMAIS reproposé. Le remplacement ne
  // porte donc que sur une intention DIFFÉRENTE de celle qui est niée (« pas la démo » n'ouvre pas
  // la démo ; « pas Pierre, les partenaires » ouvre les partenaires).
  const denied = detectDeniedIntent(m);
  const replacement = (): PublicSituation | null => {
    if (/\b(d'?autres?\s+(?:employes|agents)|autre\s+employe|catalogue)\b/.test(m)) {
      return of("catalog_question", "négation + demande de catalogue", { deniedIntent: "pierre", correctedTo: "catalog" });
    }
    if (PARTNER_RX.test(m)) return of("partner_program", "négation + demande partenaires", { correctedTo: "catalog" });
    if (country) return of("country_availability", "négation + pays corrigé", { country, correctedTo: "country" });
    if (legalDoc) return of("legal_document", "négation + page légale demandée", { legalDoc, correctedTo: "legal" });
    if (DEMO_RX.test(m) && denied !== "demo") return of("demo_request", "négation + demande de démo", { correctedTo: "demo" });
    if (SIGNUP_RX.test(m) && denied !== "signup") return of("signup_help", "négation + inscription demandée", { correctedTo: "signup" });
    if (LOGIN_RX.test(m) && denied !== "login") return of("login_help", "négation + connexion demandée", { correctedTo: "login" });
    if (HOME_RX.test(m)) return of("navigate_home", "négation + retour accueil", { correctedTo: "discover" });
    return null;
  };
  if ((ABANDON_RX.test(m) || (CANCEL_LAST_TURN_RX.test(m) && !PURCHASE_RX.test(m))) && !CANCEL_RX.test(m)) {
    if (PRIVATE_DATA_RX.test(m)) return of("private_data_request", "annulation d'une action privée");
    const alt = replacement();
    if (alt) return alt;
    return of("abandon", "abandon ou annulation du tour précédent");
  }
  if (DENIAL_RX.test(m)) {
    const alt = replacement();
    if (alt) return alt;
    return of("denied_intent", "intention attribuée explicitement niée", { deniedIntent: detectDeniedIntent(m) });
  }
  if (CORRECTION_RX.test(m)) {
    if (country) return of("country_availability", "correction de pays", { country, correctedTo: "country" });
    if (legalDoc || /\bpartie\s+legale\b/.test(m)) return of("legal_document", "correction vers une page légale", { legalDoc: legalDoc ?? "cgu", correctedTo: "legal" });
    // La cible CORRIGÉE prime sur la cible écartée : « montre-moi plutôt la démo AU LIEU des prix »
    // demande la démo. On teste donc la démo et la découverte avant le prix.
    if (DEMO_RX.test(m)) return of("demo_request", "correction vers la démo", { correctedTo: "demo" });
    if (/\b(decouvrir|comprendre)\b/.test(m)) return of("discover_pierre", "correction vers la découverte", { correctedTo: "discover" });
    if (FALSE_PRICE_RX.test(m) || PRICE_QUESTION_RX.test(m)) return of("false_price_premise", "correction sur le prix annoncé", { correctedTo: "purchase" });
    if (SIGNUP_RX.test(m)) return of("signup_help", "correction vers l'inscription", { correctedTo: "signup" });
    if (LOGIN_RX.test(m)) return of("login_help", "correction vers la connexion", { correctedTo: "login" });
    // Correction sans cible identifiable (« c'est pas ça », « reprenons ») : on repart proprement,
    // sans reproposer ce que l'utilisateur vient d'écarter.
    return of("denied_intent", "correction sans cible identifiable", { deniedIntent: "generic" });
  }

  // 4. Pays — un pays cité impose la réponse de disponibilité (fail-closed hors lancement).
  if (country && (AVAILABILITY_RX.test(m) || country.code === null)) {
    return of("country_availability", "question de disponibilité pays", { country, capability });
  }
  // « c'est valable partout ? », « c'est pareil partout ou ça dépend ? » : question de couverture
  // sans pays cité — la réponse canonique (quatre pays, deux tarifs) existe et doit être donnée.
  if (/\b(valable\s+partout|pareil\s+partout|dispo[a-z]*\s+partout|partout\s+en\s+europe|quels?\s+pays|dans\s+quels?\s+pays|combien\s+de\s+pays)\b/.test(m)) {
    return of("country_availability", "couverture pays sans pays cité", { capability });
  }

  // 5. Pages légales — routage exact, texte et CTA solidaires.
  if (legalDoc && (LEGAL_LOOKUP_RX.test(m) || /\b(cgv|cgu|dpa|mentions)\b/.test(m) || legalDoc === "privacy")) {
    if (legalDoc === "privacy" && PRIVACY_QUESTION_RX.test(m)) return of("privacy_security", "question de confidentialité", { legalDoc });
    return of("legal_document", `page légale ${legalDoc}`, { legalDoc });
  }

  // 6. Confidentialité / sécurité / hébergement — répondre, ne pas éluder.
  // Exception : « combien de pannes ont eu vos serveurs ? » parle de FIABILITÉ, pas de données.
  // Le mot « serveur » ne doit pas aspirer une question d'exploitation vers la confidentialité.
  if (PRIVACY_QUESTION_RX.test(m) && capability !== "service_reliability") {
    return of("privacy_security", "question de confidentialité/sécurité", { legalDoc: "privacy" });
  }

  // 7. Gouvernance : plancher humain, garanties juridiques.
  if (GOVERNANCE_RX.test(m) || LEGAL_GUARANTEE_RX.test(m)) {
    return of("governance_limit", "acte sensible ou garantie juridique", { capability });
  }

  // 8. Capacités et limites produit — répondre avant de vendre.
  if (capability !== null) return of("capability_question", `capacité ${capability}`, { capability });

  // 9. Travail RH : valider, piloter une mission, préparer un document, consulter une donnée privée.
  if (VALIDATION_REQUEST_RX.test(m)) return of("validation_request", "demande de validation");
  if (PRIVATE_DATA_RX.test(m)) return of("private_data_request", "donnée ou action privée");
  if (MISSION_REQUEST_RX.test(m)) return of("mission_request", "demande de mission");
  if (HR_DOC_RX.test(m)) return of("hr_document_request", "demande de document RH");

  // 9b. Concepts produit, éditeur du site, moyens de paiement, valeur.
  // Connexion/inscription passent AVANT : « une appli mobile pour se connecter ? » est une question
  // d'accès, pas une question de technologie.
  if (LOGIN_RX.test(m)) return of("login_help", "connexion");
  if (SIGNUP_RX.test(m) && !PURCHASE_RX.test(m)) return of("signup_help", "création de compte");
  if (TECHNOLOGY_RX.test(m)) return of("technology_explanation", "concept produit ou technologie");
  if (COMPANY_IDENTITY_RX.test(m)) return of("company_identity", "identité de l'éditeur");
  if (PAYMENT_METHOD_RX.test(m)) return of("payment_method", "moyen de paiement");

  // 10. Prix — y compris la correction d'un prix faux énoncé par l'utilisateur.
  if (FALSE_PRICE_STRONG_RX.test(m) || (FALSE_PRICE_RX.test(m) && PRICE_QUESTION_RX.test(m))) {
    return of("false_price_premise", "prix faux à corriger");
  }
  if (PRICE_QUESTION_RX.test(m)) return of("pricing_question", "question de prix");
  if (VALUE_RX.test(m)) return of("value_question", "question de valeur");

  // 11. Résiliation (gestion de compte, jamais un achat).
  if (CANCEL_RX.test(m)) return of("cancellation", "résiliation / gestion d'abonnement");

  // 12. Hors périmètre AVANT le commercial : « réserve-moi un billet de train » n'est pas un achat
  // de Pierre, et « écris-moi un script » n'est pas une demande produit.
  if (OUT_OF_SCOPE_RX.test(m)) return of("out_of_scope", "sujet hors périmètre CloneStore");

  // 12b. Intentions commerciales et de navigation.
  if (PARTNER_RX.test(m)) return of("partner_program", "programme partenaires");
  if (HOME_RX.test(m)) return of("navigate_home", "retour à l'accueil");
  // « Je veux VOIR avant d'acheter » ⇒ démo ; « faut-il un compte AVANT d'acheter ? » ⇒ inscription.
  // Le désir de voir et la question d'ordre des étapes précèdent l'intention d'acquérir.
  const beforeBuy = /\bavant\s+(?:de\s+|d'?)(?:payer|achet[a-z]*|command[a-z]*|reserv[a-z]*|m'?engager|souscri[a-z]*)/.test(m);
  if (beforeBuy && DEMO_RX.test(m)) return of("demo_request", "voir/tester avant d'acheter ⇒ démo");
  if (beforeBuy && SIGNUP_RX.test(m)) return of("signup_help", "ordre des étapes : compte avant achat");
  if (DEMO_RX.test(m) && !PURCHASE_RX.test(m)) return of("demo_request", "demande de démonstration");
  if (PURCHASE_RX.test(m)) return of("purchase_intent", "intention d'achat");
  if (SIGNUP_RX.test(m)) return of("signup_help", "création de compte");
  if (LOGIN_RX.test(m)) return of("login_help", "connexion");
  if (DISCOVER_PIERRE_RX.test(m)) return of("discover_pierre", "découverte de Pierre");
  if (DISCOVER_CLONESTORE_RX.test(m)) return of("discover_clonestore", "découverte de CloneStore");

  // 13. Injection pure (aucune demande légitime en dessous).
  if (injectionFlag) return of("prompt_injection", "tentative d'injection sans demande légitime");

  // 14. Hors périmètre, salutation, parcours, aide, ambiguïté réelle.
  if (OUT_OF_SCOPE_RX.test(m)) return of("out_of_scope", "sujet hors périmètre CloneStore");
  if (GREETING_RX.test(m)) return of("greeting", "salutation");
  if (NEXT_STEP_RX.test(m)) return of("next_step", "question sur la marche à suivre");
  if (HELP_REQUEST_RX.test(m)) return of("help_request", "demande d'aide sans objet identifié");
  // Un pays cité sans autre intention identifiable EST une question de couverture : « c'est pour
  // ma société en France » mérite le tarif du pays, pas une demande de précision.
  if (country) return of("country_availability", "pays cité sans autre intention", { country, capability });
  if (mentionsPierre) return of("discover_pierre", "sujet Pierre sans intention précise");
  return of("unclear", "aucune intention claire");
}

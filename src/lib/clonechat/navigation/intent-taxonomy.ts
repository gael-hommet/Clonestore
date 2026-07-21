// src/lib/clonechat/navigation/intent-taxonomy.ts
// C1.8 REOUVERT §7 — TAXONOMIE D'INTENTIONS DE NAVIGATION (déterministe, vérifiable).
//
// Le défaut : « je veux acheter pierre » était classé `site_navigation` (à cause de « quelle
// page ») ⇒ CTA Support. Aucune intention d'ACHAT n'existait. Ici, l'intention d'ACHAT/RÉSERVATION
// est détectée en PRIORITÉ, distincte de la démo et de la simple découverte, et pointe vers
// `/reserver/pierre`. La négation est respectée ; une phrase claire n'est jamais `clarification`.
//
// La nature du compte n'écrase JAMAIS l'intention : une question commerciale reste commerciale même
// pour un membre d'entreprise, et l'absence d'entreprise n'est jamais un parasite sur une question
// publique (prix, achat, démo, navigation).

import { DESTINATIONS, destinationById, isRealDestinationRoute, type CloneStoreDestination } from "./destination-registry";

export type NavIntent =
  | "purchase_pierre" | "reserve_pierre" | "pierre_pricing" | "clonestore_pricing"
  | "discover_pierre" | "discover_clonestore" | "request_pierre_demo" | "request_general_demo"
  | "navigate_to_page" | "login_help" | "signup_help" | "account_help"
  | "partner_program" | "country_availability" | "legal_information" | "privacy_information"
  | "support_request" | "product_capability" | "employee_question" | "mission_request"
  | "document_request" | "validation_request" | "conversation_history" | "image_analysis"
  | "cancellation_question" | "unknown" | "clarification_required";

export type ContextMode = "visitor" | "client";

export interface NavContext {
  readonly mode: ContextMode;          // visiteur/commercial vs client/entreprise
  readonly hasActiveCompany: boolean;
  readonly country?: string | null;    // FR/BE/LU/CH — résolu serveur, jamais deviné du message
}

export interface NavResolution {
  readonly intent: NavIntent;
  readonly confidence: "certain" | "high" | "medium" | "low";
  readonly context_mode: "commercial" | "client";
  readonly destination_id: string | null;
  readonly route: string | null;
  readonly clarification_required: boolean;
  readonly reason: string;
  readonly sources: readonly string[];
  readonly cta: { readonly label: string; readonly route: string } | null;
  readonly country: string | null;
  readonly company_required: boolean;
  readonly runtime_required: boolean;
}

const norm = (s: string): string =>
  (s ?? "").toLowerCase().normalize("NFD").replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .replace(/[’'`´]/g, "'").replace(/\s+/g, " ").trim();

// ── Négation d'achat : « je ne veux PAS acheter », « non, seulement voir » ──────
const NEG_PURCHASE = /\b(ne\s+(?:veux|souhaite|compte)\s+pas|pas\s+(?:acheter|prendre|reserver)|aucune\s+envie|surtout\s+pas|non\s*,?\s*(?:seulement|juste|simplement)|pas\s+encore\s+(?:acheter|prendre))\b/;

// ── COMMERCIAL = jamais parasité par l'entreprise ───────────────────────────────
const COMMERCIAL_INTENTS: ReadonlySet<NavIntent> = new Set<NavIntent>([
  "purchase_pierre", "reserve_pierre", "pierre_pricing", "clonestore_pricing",
  "discover_pierre", "discover_clonestore", "request_pierre_demo", "request_general_demo",
  "country_availability", "partner_program", "legal_information", "privacy_information",
  "login_help", "signup_help", "product_capability",
]);

/** Le sujet est-il « Pierre » ? (pour lever une ellipse d'achat : « et pour l'acheter ? ») */
const MENTIONS_PIERRE = /\bpierre\b/;

// ── Règles ORDONNÉES : la première qui matche gagne. destination = id du registre. ──
interface Rule { intent: NavIntent; dest: string; test: RegExp; confidence: NavResolution["confidence"]; ellipsis?: boolean }

const RULES: readonly Rule[] = [
  // 1. SÉCURITÉ / support explicite (avant tout — mais PAS un simple mot « support »).
  // Élargi (issu de la campagne adverse) : détresse (« au secours », « help », « aidez-moi »),
  // pannes (« ça déconne », « page blanche », « rien ne se charge »), incidents de facturation.
  { intent: "support_request", dest: "support", confidence: "high",
    test: /\b(parler|contacter|joindre|ecrire|appeler)\s+(?:au\s+|a\s+|a\s+la\s+|le\s+|la\s+|un\s+|une\s+|avec\s+|aupres\s+d[eu]\s+)?(?:support|conseiller|une\s+personne|un\s+humain|un\s+vrai\s+humain|vrai\s+humain|une\s+vraie\s+personne|assistance|aide|service\s+client|commercial|quelqu['\s]?un)\b|\b(au\s+secours|a\s+l['e ]?aide|aidez|aider|m['e ]?aider|besoin\s+d['e ]?aide|un\s+souci|des\s+soucis|probleme|souci|bug|erreur|panne|casse|deconne|rame|plante|bloque|marche\s+pas|fonctionne\s+pas|veut\s+pas\s+(?:marcher|fonctionner)|ne\s+(?:marche|fonctionne|charge)|page\s+blanche|rien\s+ne\s+(?:se\s+)?(?:charge|marche|fonctionne)|se\s+charge\s+pa|numero\s+(?:de\s+)?(?:tel|telephone)|service\s+client|facture\s+(?:est\s+)?(?:fausse|erronee|incorrecte)|factur[e]?\s+deux\s+fois|rembours[a-z]*|debite[a-z]*\s+deux\s+fois|preleve[a-z]*\s+deux\s+fois|facture[a-z]*\s+[^.?!]{0,25}(?:deux\s+fois|alors\s+que\s+j)|paiement\s+[^.?!]*deux\s+fois|affiche\s+que\s+dalle|repond\s+(?:plus|pas)|est\s+vide|arrive\s+(?:plus|pas)\s+a\s+acceder|(?:n['e ]?|ne\s+)?arrive\s+pas\s+a\s+(?:telecharger|ouvrir|acceder)|acceder\s+a\s+mes\s+document|(?:bouton|lien)[^.?!]{0,45}(?:fait\s+rien|marche\s+pas|reagit\s+pas|rien\s+du\s+tout)|fait\s+rien\s+quand\s+j|prelevement[^.?!]{0,20}(?:bizarre|cb|carte|inconnu|a\s+votre\s+nom)|recois\s+pas\s+le\s+mail|(?:pas\s+recu|jamais\s+recu|recu\s+aucun)\s+(?:le\s+|de\s+)?mail|mail\s+de\s+confirmation|se\s+ferme\s+tout[e]?\s+seul|(?:appli|application)\s+(?:plante|se\s+ferme|bug)|pirate[a-z]*|piratage|entreprise\s+introuvable|compte\s+introuvable|introuvable\s+alors|comprends?\s+rien\s+[^.?!]*(?:marcher|marche|deconne|charge)|\blent[a-z]*\b|lenteur|\bdown\b|hors\s+service|inaccessible|indisponible|fige|figee?|gele|suspendu|verrouille|session\s+(?:expire|coupe|saute)|expire\s+tout|deconnecte\s+tout\s+seul|deconnecte\s+toutes?\s+les|echec\s+reseau|erreur\s+reseau|(?:carte|paiement|virement|transaction|cb)\s+(?:a\s+ete\s+)?(?:refuse|echoue|bloque|rejete)|refuse[e]?\s+(?:mais|alors\s+que)|transaction\s+en\s+cours|reste\s+(?:en\s+)?(?:chargement|charge)|charge(?:ment)?\s+(?:infini|dans\s+le\s+vide|sans\s+fin)|tourne\s+(?:dans\s+le\s+vide|sans\s+fin)|charge\s+dans\s+le\s+vide|siret[^.?!]{0,15}(?:invalide|refuse)|code\s+(?:de\s+)?(?:verif|verification|sms)|recois\s+plus\s+le\s+code|reste\s+(?:tout[e]?\s+)?(?:blanc|blanche|noir|noire|figee?|vide)|ecran\s+(?:noir|blanc|figee?|tout\s+noir)|tout\s+noir|ne\s+se\s+lance\s+pas|se\s+lance\s+pas|reste\s+noire?|facture[a-z]*\s+(?:apparait|s'affiche|napparait)\s+(?:pas|plus)|apparait\s+pas\s+dans\s+mon\s+espace|reponse\s+a\s+mon\s+ticket|mon\s+ticket|a\s+disparu|ont\s+disparu|redirige\s+en\s+boucle|boucle\s+vers\s+la\s+page|redémarre\s+tout\s+seul|email\s+deja\s+utilise|redirige.*connexion.*sans|me\s+jette\s+dehors|jette\s+dehors|tape\s+mon\s+code|tape\s+mon\s+mot\s+de\s+passe|(?:cliqu[a-z]*\s+sur\s+)?deconnexion[^.?!]{0,25}(?:plus\s+revenir|peux\s+plus)|plus\s+revenir|ferme[a-z]*\s+la\s+fenetre[^.?!]{0,25}paiement|c'est\s+passe\s+ou\s+pas|paiement[^.?!]{0,15}(?:passe\s+ou\s+pas|abouti\s+ou)|piece\s+jointe\s+(?:est\s+)?trop\s+lourde|trop\s+lourde\s+c'est\s+quoi|reinitialise\s+mon\s+mot\s+de\s+passe|mot\s+de\s+passe[^.?!]{0,15}marche\s+(?:pas|plus)|parl[a-z]*\s+a\s+un[^.?!]{0,14}(?:humain|conseill[a-z]*|vrai|personne[a-z]*)|numero\s+(?:pr|pour)\s+appel[a-z]*|pa[s]?\s+recu\s+ma\s+facture|facture[^.?!]{0,12}(?:pas\s+recu|jamais\s+recu|pa\s+recu)|(?:paye|paiement)[^.?!]{0,15}chf[^.?!]{0,25}euros?|compte\s+en\s+euros)\b|\bhelp\b|\bpaye\b[^.?!]{0,40}\b(?:rien|pas\s+(?:eu\s+)?(?:d['e ]?)?acces|toujours\s+pas)\b/ },
  // 2. RÉSILIATION / annulation = gestion CLIENT, jamais un achat. Élargi : radicaux + objet
  // (« arrêter/couper/fermer/supprimer » + « abonnement/contrat/compte/prélèvement »), « ne plus payer »,
  // « ne pas renouveler ». Placé AVANT l'achat pour ne jamais confondre départ et acquisition.
  { intent: "cancellation_question", dest: "my_clonestore", confidence: "high",
    test: /\b(resili[a-z]*|annul[a-z]*|desabonn[a-z]*|desinscri[a-z]*|desabonnement|desinscription)\b|\b(arret[a-z]*|coup[a-z]*|stopp?[a-z]*|met(?:tre|s|ez)?\s+fin|clotur[a-z]*|clore|ferm[a-z]*|supprim[a-z]*)\b[^.?!]{0,30}\b(abonnement|abo|abon[a-z]*|contrat|compte|prelevement[a-z]*|espace|souscription|facturation)\b|\b(abonnement|abo|abon[a-z]*|contrat|compte|prelevement[a-z]*|espace)\b[^.?!]{0,25}\b(arret[a-z]*|annul[a-z]*|coup[a-z]*|stopp?[a-z]*|ferm[a-z]*|resili[a-z]*|met(?:tre|s|ez)?\s+fin)\b|\b(plus\s+(?:etre\s+)?factur[a-z]*|ne\s+plus\s+(?:me\s+)?(?:payer|facturer)|plus\s+payer\s+pierre|arreter\s+de\s+payer|plus\s+etre\s+preleve)\b|\bmettre\s+fin\b|\bpas\s+renouveler\b|\bstop\s+pierre\b|\btout\s+arreter\b|\barreter\s+tout\b|\barreter\s+ce\s+(?:bazar|truc|machin|bordel)\b/ },
  // 3. ACHAT / RÉSERVATION de Pierre — LE cœur du correctif (haute priorité, avant navigation).
  // On raisonne par RADICAUX de verbe (achet/prend/reserv/souscri/activ…) pour couvrir toutes les
  // conjugaisons (« acheter/achète », « prendre/prends/prend »), près du mot « pierre ». Élargi
  // (campagne adverse) au vocabulaire commercial non ambigu, même sans « pierre » : « je passe
  // commande », « je m'abonne », « mettez-le dans mon panier », « je signe », « je souscris », et
  // aux tournures pronominales fortes (« je le prends », « il me le faut ») — Pierre est le produit.
  // 2b. PARTENAIRE — signaux FORTS placés avant l'achat/prix : « marque blanche », « commission » du
  // programme, « revendeur/apporteur ». Sinon « avoir Pierre en marque blanche » partait en achat et
  // « combien de commission » en prix.
  { intent: "partner_program", dest: "partners", confidence: "high",
    test: /\bmarque\s+blanche\b|\brevendeur\b|\bapporteur\b|programme\s+partenaire|devenir\s+partenaire|partenere\s+avec|espace\s+partenaire|(?:commission|marge)[^.?!]{0,35}(?:partenaire|programme|revendeur|apporteur)|(?:partenaire|programme\s+partenaire)[^.?!]{0,35}commission/ },
  { intent: "purchase_pierre", dest: "reserver_pierre", confidence: "certain",
    test: /\b(achet|prend|command|acqui|acquer|obten|reserv|souscri|abonn|activ|procur|adopt)[a-z']*\b[^.?!]{0,40}\bpierre\b|\b(?:comment\s+)?avoir\s+pierre\b|\bpierre\b[^.?!]{0,30}\b(achet|reserv|command|prend|obten|souscri|activ|maintenant|payer)[a-z']*\b|\b(jveux|jle|j['e ]?le|je\s+veux)\s+(?:prends?\s+)?pierre\b|\bpierre\s+(?:pour|chez|dans)\s+(?:nous|ma|notre|mon|l['e ]?entreprise|(?:ma|notre)\s+societe|ma\s+boite)|\bpierre\s+travaille\s+pour|\bou\b[^.?!]{0,20}\b(achet|prend|reserv|souscri|payer|obten|procur)[a-z']*\b[^.?!]{0,25}\bpierre\b|\b(achet|prend|reserv|souscri|obten|payer)[a-z']*\b[^.?!]{0,12}\bou\b[^.?!]{0,10}\bpierre\b|\bquelle?\s+page\b[^.?!]{0,30}\b(achet|prend|reserv)[a-z']*\b|\b(je\s+passe\s+commande|passer\s+commande|je\s+commande\b|m['e ]?abonn[a-z]*|prends?\s+l['e ]?abonnement|prends?\s+le\s+pack|dans\s+mon\s+panier|mett?[ez]+\s+[^.?!]{0,15}\bpanier\b|je\s+signe|jsigne|faites?\s+moi\s+signer|\bsigner\b|je\s+valide|passe[rz]?\s+(?:a\s+)?la\s+caisse|le\s+lien\s+(?:pour|pr)\s+payer|ou\s+(?:cliquer|payer|signer|s['e ]?abonner)|je\s+m['e ]?engage|pret\s+a\s+m['e ]?engager|pour\s+l['e ]?engager|finalis[a-z]*|je\s+souscri[a-z]*|comment\s+souscri[a-z]*|souscri[a-z]*|acqu[e]rir\s+la\s+solution|nous\s+souhaitons\s+acqu|me\s+lancer\s+avec|embauch[a-z]*\s+[^.?!]{0,15}\b(rh|pierre|votre|employe|assistant)\b|il\s+me\s+le\s+faut|je\s+le\s+(?:prends?|veux|adopte|loue)|je\s+l['e ]?adopte|je\s+l['e ]?active|faut\s+que\s+je\s+l['e ]?active|me\s+le\s+mettre\s+en\s+place|mettre\s+en\s+place\s+pierre|(?:ok\s+)?go\s+pour\s+pierre|go\s+je\s+m['e ]?abonne|(?:qu['e ]?il\s+)?bosse\s+pour\s+(?:moi|nous)|travaille\s+pour\s+(?:moi|nous)|demarrer\s+avec\s+pierre|je\s+reserve\b|comment\s+(?:je\s+)?reserv[a-z]*|ou\s+(?:je\s+)?clique[^.?!]{0,20}(?:reserv|achet|payer|pierre)|comment\s+on\s+paie|(?:a\s+la\s+|la\s+)caisse[^.?!]{0,12}pierre|mene[- ]?moi[^.?!]{0,20}caisse|le\s+acheter\b)\b/ },
  // 3b. Ellipse d'achat sans « Pierre » (« et pour l'acheter ? », « je veux le prendre ») —
  //     résolue si le contexte parle déjà de Pierre (voir resolveNavigationIntent).
  { intent: "purchase_pierre", dest: "reserver_pierre", confidence: "high", ellipsis: true,
    test: /\b(?:et\s+)?pour\s+(?:l['e ]?|le\s+)?(?:acheter|prendre|reserver|obtenir|souscrire|avoir)|comment\s+(?:je\s+fais\s+pour\s+)?l['e ]?(?:avoir|obtenir)|je\s+(?:veux|voudrais)\s+(?:le|la|l['e ])\s*(?:prendre|acheter|reserver)|finalement\s+je\s+(?:veux|le\s+prends)/ },
  // 3c. Navigation d'ACHAT explicite (règle propre, indépendante du gros motif) : « où je clique
  // pour réserver », « comment on paie », « je réserve », « à la caisse ».
  { intent: "purchase_pierre", dest: "reserver_pierre", confidence: "high",
    test: /\bou\s+(?:je\s+)?clique[^.?!]{0,25}(?:reserv|achet|payer|pierre)|comment\s+on\s+paie|comment\s+(?:je\s+)?(?:paie|paye)\b|\bje\s+reserve\b|\ble\s+acheter\b|a\s+la\s+caisse\b|komen\s+on\s+paye/ },
  // 4. PRIX de Pierre. Élargi (adverse) : « conditions tarifaires », « c cher », « gratos »,
  // « vous facturez comment », un montant explicite « 449 € », « la note à la fin ».
  { intent: "pierre_pricing", dest: "pierre_pricing", confidence: "high",
    test: /\b(combien|cout[e]?s?|coute|prix|tarif[a-z]*|c['e ]?est\s+combien|par\s+mois|mensuel|budget|payant\s+ou\s+gratuit|gratuit\s+ou\s+payant|gratos|gratui[a-z]*|ht\s+ou\s+ttc|montant|douille|banque\s+combien|ca\s+chiffre|\bcher\b|(?:vous\s+)?factur[a-z]*\s+comment|conditions\s+tarifaires|la\s+note\s+a\s+la\s+fin|ristourne[a-z]*|reduction[a-z]*|reduc\b|remise[a-z]*|rabais|devis|essai\s+gratuit|payer?\s+en\s+plusieurs?\s+fois|plusieur[a-z]*\s+foi[sx]?|par\s+virement)\b|\b\d{2,4}\s*(?:e|eur|euros?|chf|c)\b/ },
  // 5. DÉMO (voir en action / tester / essayer) — distincte de l'achat. Élargi (campagne adverse) :
  // « montrez-moi », « voir la bête en action », « tour du produit », « prendre en main », « un aperçu »,
  // « rdv avec un commercial », « je peux jouer avec ».
  { intent: "request_pierre_demo", dest: "demo_pierre", confidence: "high",
    test: /\b(demo|demonstration|voir\s+(?:pierre\s+)?en\s+action|voir\s+en\s+action|essay[a-z]*|test[a-z]*|essai|voir\s+comment\s+(?:ca|il)\s+(?:marche|tourne|se\s+passe|fonctionne)|montr[a-z]*|faites?\s+moi\s+voir|fais\s+moi\s+voir|apercu|tour\s+du\s+produit|prendre\s+en\s+main|jouer\s+avec|voir\s+[^.?!]{0,20}(?:tourner|bouger|en\s+action|le\s+rendu|la\s+bete)|voie\s+tourner|presentation\s+(?:du\s+produit|du\s+logiciel|de\s+pierre)|programmer\s+une\s+(?:demo|presentation)|rdv\s+(?:avec\s+)?(?:un\s+)?commercial|rendez[- ]?vous\s+[^.?!]{0,20}commercial|video\s+[^.?!]{0,20}montre|voir\s+si\s+ca\s+fait|exemple\s+(?:concret|de\s+ce\s+qu)|montrer\s+un\s+exemple|petit\s+test|un\s+ptit\s+test|le\s+faire\s+tourner|faire\s+tourner|voir\s+le\s+rendu|ressemble\s+a\s+quoi|voir\s+ce\s+que\s+ca\s+donne|voir\s+pierre\s+gerer|voir\s+[^.?!]{0,15}gerer\s+un\s+(?:vrai\s+)?cas)\b/ },
  // 6. Disponibilité pays.
  { intent: "country_availability", dest: "discover_clonestore", confidence: "high",
    test: /\b(pays\s+disponibles?|quels?\s+(?:sont\s+(?:vos\s+)?)?pays|disponible\s+(?:en|au|dans|partout)|available\s+in|dans\s+quels?\s+pays|suisse|belgique|luxembourg)\b/ },
  // 7. Programme partenaires.
  { intent: "partner_program", dest: "partners", confidence: "high",
    test: /\b(partenaires?|partenariat|affili[a-z]*|apporteur|revendeur|cabinet\s+fondateur|founding\s+partner|marque\s+blanche)\b/ },
  // 8. Connexion / inscription.
  { intent: "signup_help", dest: "signup", confidence: "high",
    test: /\b(cre[eé][a-z]*\s+(?:un\s+|1\s+)?compt[a-z]*|m['e ]?inscri[a-z]*|s['e ]?inscri[a-z]*|inscription|sign\s?up|ouvrir\s+un\s+compte|pour\s+m['e ]?inscrire)\b|\bcreer\s+1\s+compte\b/ },
  { intent: "login_help", dest: "login", confidence: "high",
    test: /\b(me\s+connect[a-z]*|connexion|se\s+connect[a-z]*|se\s+log(?:ger|guer)?|se\s+log\b|pour\s+se\s+log|log\s?in|mot\s+de\s+passe\s+oublie|oublie\s+mon\s+(?:mot\s+de\s+passe|mdp)|mdp\s+oublie|acceder\s+a\s+mon\s+compte|deja\s+un\s+compte|mon\s+tableau\s+de\s+bord|acceder\s+a\s+mon\s+(?:espace|tableau)|me\s+log(?:ger|guer|gue|g)|(?:conecte|connecte|conekte|konecte)\s+moi|me\s+(?:conekt|conect|konect)[a-z]*|jme\s+(?:conect|connect|conekt)[a-z]*|double\s+authentification|2fa|captcha)\b/ },
  // 9. Légal / confidentialité.
  { intent: "privacy_information", dest: "legal_privacy", confidence: "high",
    test: /\b(confidentialite|rgpd|gdpr|donnees\s+personnelles|vie\s+privee|politique\s+de\s+confidentialite)\b/ },
  // C1.8 A2 — ROUTAGE LÉGAL EXACT : les CGV ne sont pas les CGU, les mentions ne sont pas le DPA.
  // Servir « les CGU » à qui demande « les CGV » est une erreur de document contractuel (cluster
  // `legal_cgv_mentions_mal_routees`). Chaque document a sa destination, dans l'ordre du plus
  // spécifique au plus générique.
  { intent: "legal_information", dest: "legal_cgv", confidence: "high",
    test: /\bcgv\b|conditions\s+generales\s+de\s+vente|conditions\s+de\s+vente/ },
  { intent: "legal_information", dest: "legal_dpa", confidence: "high",
    test: /\bdpa\b|accord\s+de\s+traitement|sous[- ]?traitance\s+des\s+donnees/ },
  { intent: "legal_information", dest: "legal_mentions", confidence: "high",
    test: /mentions\s+legales|\bmentions\b|editeur\s+du\s+site|qui\s+edite\s+le\s+site/ },
  { intent: "legal_information", dest: "legal_cgu", confidence: "high",
    test: /\b(cgu|conditions\s+(?:generales|d['e ]?utilisation)|contrat|juridique|legal)\b/ },
  // 10. Découverte Pierre (qui est / que fait / capacités).
  { intent: "discover_pierre", dest: "discover_pierre", confidence: "high",
    test: /\b(qui\s+est\s+pierre|c['e ]?est\s+quoi\s+pierre|que\s+(?:fait|peut\s+faire)\s+pierre|comprendre\s+pierre|decouvrir\s+pierre|a\s+quoi\s+sert\s+pierre|pierre\s+(?:fait|gere)\s+quoi|capacites?\s+de\s+pierre|pierre\s+peut[- ]?il|pierre\s+en\s+vrai|il\s+fait\s+quoi\s+(?:de\s+mes|toute)|remplace[a-z]*\s+[^.?!]{0,20}(?:drh|un\s+vrai\s+rh)|decouvrir\s+(?:tt|tout|pierre)|page\s+(?:pr|pour)\s+decouvrir)\b/ },
  // 11. Découverte CloneStore — élargie (campagne adverse) : « c koi CloneStore », « expliquez »,
  // « dites m'en plus », « ça sert à quoi », « vous faites quoi », « un genre de robot RH »,
  // « je regarde juste », « comparer avec un concurrent ». Priorité basse : dernier filet avant
  // navigation générique, ne vole donc jamais une intention plus précise (prix, démo, support…).
  { intent: "discover_clonestore", dest: "discover_clonestore", confidence: "high",
    test: /\b(c['e ]?(?:est|koi)\s*(?:quoi)?\s*clonestore|clonestore\s+c\s*koi|kess?e[z]?\s*(?:c['e ]?est\s*)?(?:que\s*)?(?:ca\s*)?clonestore|qu['e ]?est[- ]?ce\s+que\s+(?:clonestore|ca|c['e ]?est)|comprendre\s+(?:clonestore|le\s+principe|le\s+concept|votre\s+(?:plateforme|concept|methode))|decouvrir\s+clonestore|comment\s+ca\s+marche(?:\s+clonestore|\s+votre|\s+exactement)?|votre\s+methode|marketplace|boutique\s+d['e ]?employes|ca\s+sert\s+a\s+quoi|a\s+quoi\s+ca\s+sert|vous\s+(?:faites|fete[sz]?|vendez)\s+quoi|c['e ]?est\s+quoi\s+(?:le\s+delire|votre\s+(?:truc|affaire|metier|delire|concept))|expliqu[a-z]*|dites?\s+m['e ]?en\s+plus|dite?s\s+moi\s+en\s+plus|il\s+fait\s+quoi|robot\s+rh|un\s+genre\s+de|employe\s+(?:ia|virtuel)|vous\s+vendez\s+(?:quoi|de\s+l['e ]?ia)|jamais\s+entendu\s+parler|concept\s+de\s+votre|principe\s+avant|je\s+regarde\s+juste|renseign[a-z]*|boite\s+d['e ]?interim|ca\s+marche\s+vraiment|c['e ]?est\s+du\s+vent|fait\s+pour\s+(?:moi|les\s+(?:petites|grosses)|artisan|ma\s+boite)|compar[a-z]*\s+(?:avec|au|les\s+concurrent)|jcomprends?\s+pas\s+(?:trop\s+)?ce\s+que\s+vous|comprends?\s+rien\s+a\s+(?:votre|ce)|vous\s+parlez\s+(?:la\s+lune|chinois)|donc\s+en\s+gros|pour\s+les\s+(?:grosses|petites|grandes)\s+(?:entreprises|boites|structures)|ca\s+marche\s+comment|savoir\s+ce\s+que\s+c['e ]?est|jpige|pige\s+(?:que\s+dalle|rien|pas))\b/ },
  // 12. Employés IA (catalogue).
  { intent: "product_capability", dest: "employees_catalog", confidence: "medium",
    test: /\b(quels?\s+employes|catalogue|autres\s+employes|liste\s+des\s+employes|quel\s+(?:employe|agent)\s+choisir)\b/ },
  // 13. Client / entreprise (uniquement pertinent en contexte client).
  { intent: "employee_question", dest: "employees_360", confidence: "medium",
    test: /\b(mes\s+salaries|mes\s+employes|mon\s+equipe|mes\s+collaborateurs|dossier\s+(?:d['e ]?un\s+)?salarie)\b/ },
  { intent: "mission_request", dest: "pierre_cockpit", confidence: "medium",
    test: /\b(ma\s+mission|mes\s+missions|creer\s+(?:une\s+)?mission|lancer\s+(?:une\s+)?mission|mission\s+(?:bloquee|en\s+cours))\b/ },
  { intent: "conversation_history", dest: "clonechat", confidence: "medium",
    test: /\b(mon\s+historique|mes\s+conversations|conversation\s+precedente|reprendre\s+(?:la|ma)\s+conversation)\b/ },
  // 14. Navigation générique — DERNIER recours (avant unknown), priorité basse.
  { intent: "navigate_to_page", dest: "discover_clonestore", confidence: "low",
    test: /\b(ou\s+(?:est|se\s+trouve|aller|puis[- ]?je)|quelle?\s+page|quel\s+lien|comment\s+aller|je\s+(?:ne\s+)?trouve\s+pas|renvoye[a-z]*\s+[^.?!]{0,15}accueil|vers\s+l['e ]?accueil|page\s+d['e ]?accueil|revenir\s+a\s+l['e ]?accueil)\b/ },
];

/**
 * Résout l'intention de navigation d'un message. Déterministe : mêmes entrées ⇒ même sortie.
 * `history` (facultatif) sert à lever une ELLIPSE (« et pour l'acheter ? » après « Pierre »).
 */
export function resolveNavigationIntent(
  message: string,
  ctx: NavContext,
  history?: readonly { role: "user" | "assistant"; text: string }[],
): NavResolution {
  const m = norm(message);
  const empty = m.length < 2;

  const build = (rule: Rule, opts?: { confidence?: NavResolution["confidence"]; reason?: string }): NavResolution => {
    const dest = destinationById(rule.dest) as CloneStoreDestination;
    const commercial = COMMERCIAL_INTENTS.has(rule.intent);
    // Garde anti-invention : si (jamais) une destination pointait une route irréelle, on retombe
    // sur « clarification » plutôt que d'offrir un lien mort.
    if (!isRealDestinationRoute(dest.route) || !isRealDestinationRoute(dest.cta.route)) {
      return clarify("destination non vérifiable");
    }
    return Object.freeze({
      intent: rule.intent,
      confidence: opts?.confidence ?? rule.confidence,
      context_mode: commercial ? "commercial" : "client",
      destination_id: dest.id,
      route: dest.route,
      clarification_required: false,
      reason: opts?.reason ?? `Intention « ${rule.intent} » détectée.`,
      sources: Object.freeze([dest.source, "intent-taxonomy"]),
      cta: { label: dest.cta.label, route: dest.cta.route },
      // Le prérequis entreprise n'est signalé QUE pour une intention CLIENT (jamais commerciale).
      company_required: commercial ? false : dest.companyRequired,
      country: ctx.country ?? null,
      runtime_required: rule.intent === "mission_request" || rule.intent === "validation_request",
    });
  };

  const clarify = (reason: string): NavResolution => Object.freeze({
    intent: "clarification_required", confidence: "low", context_mode: ctx.mode === "client" ? "client" : "commercial",
    destination_id: null, route: null, clarification_required: true,
    reason, sources: Object.freeze(["intent-taxonomy"]), cta: null, country: ctx.country ?? null,
    company_required: false, runtime_required: false,
  });

  if (empty) return clarify("message vide");

  // « Je veux VOIR/tester AVANT de payer/acheter » ⇒ DÉMO, jamais achat. On tranche cette tension
  // démo↔achat en amont : le désir de voir précède l'intention d'acquérir.
  const SEE = /\b(voir|voie|voyez|montr[a-z]*|apercu|apercevoir|tester|essay[a-z]*|essai|tour\s+du\s+produit|prendre\s+en\s+main|jouer\s+avec|demo|en\s+action|tourner)\b/;
  const BEFORE_BUY = /\bavant\s+(?:de\s+|d['e ])?(payer|achet[a-z]*|m['e ]?engager|s['e ]?engager|souscri[a-z]*|command[a-z]*|quoi\s+que)/;
  if (SEE.test(m) && BEFORE_BUY.test(m)) {
    return build(RULES.find((r) => r.intent === "request_pierre_demo")!, { reason: "voir/tester AVANT d'acheter ⇒ démo (priorité sur l'achat)." });
  }

  // CORRECTION (« plutôt X », « au lieu de Y », « je voulais dire X pas Y », « en réalité … ») : on
  // suit l'intention CORRIGÉE, pas le premier mot-clé rencontré. Sinon « montre-moi plutôt la démo au
  // lieu des prix » partait en prix, et « je voulais dire découvrir pas réserver » en réservation.
  const CORRECTION = /\b(plutot|au\s+lieu|je\s+voulais\s+dire|j'ai\s+dit\b|en\s+realite|en\s+vrai\s+je\s+veux|finalement\s+montre|non\s+je\s+voulais)\b/;
  if (CORRECTION.test(m)) {
    if (/\b(demo|demonstration|tester|essayer|juste\s+tester|montre[rz]?[- ]?moi\s+(?:plutot\s+)?(?:la\s+)?demo)\b/.test(m)) return build(RULES.find((r) => r.intent === "request_pierre_demo")!, { reason: "correction ⇒ démo." });
    if (/\bpartenaires?\b/.test(m)) return build(RULES.find((r) => r.intent === "partner_program")!, { reason: "correction ⇒ partenaires." });
    if (/\b(decouvrir|comprendre|decouverte)\b/.test(m)) return build(RULES.find((r) => r.intent === "discover_pierre")!, { reason: "correction ⇒ découverte." });
    // Inscription AVANT connexion : « pas se connecter, créer un compte plutôt » ⇒ inscription.
    if (/\b(cre[eé][a-z]*\s+(?:un\s+)?compt[a-z]*|m['e ]?inscri[a-z]*|s['e ]?inscri[a-z]*)\b/.test(m)) return build(RULES.find((r) => r.intent === "signup_help")!, { reason: "correction ⇒ inscription." });
    if (/\b(me\s+connect[a-z]*|connecter)\b/.test(m)) return build(RULES.find((r) => r.intent === "login_help")!, { reason: "correction ⇒ connexion." });
  }
  // « Je me suis planté, je voulais me connecter » : correction vers la connexion (et « planté » ici
  // = « je me suis trompé », PAS « le site a planté »).
  if (/\bje\s+me\s+suis\s+plant[ée]?\b/.test(m) && /\b(me\s+connect[a-z]*|connecter)\b/.test(m)) {
    return build(RULES.find((r) => r.intent === "login_help")!, { reason: "correction ⇒ connexion." });
  }

  // QUESTION DE CAPACITÉ/LIMITE (« Pierre peut-il licencier tout seul ? », « signer à ma place ? »,
  // « gère la paie complète ? ») : c'est une DÉCOUVERTE (on explique ce que Pierre fait ET ne fait
  // pas), JAMAIS un achat. Sinon « Pierre peut prendre la décision finale » partait en réservation.
  const CAPABILITY_Q = /\bpierre\s+(?:peut|sait|gere|fait|arrive)[- ]?(?:il|elle|t[- ]?il)?\b|est[- ]?ce\s+que\s+pierre\s+(?:peut|sait|gere|fait)|\bpierre\b[^.?!]{0,45}(?:tout\s+seul|a\s+ma\s+place|paie\s+complete|decision\s+finale|remplace[a-z]*\s+(?:un\s+)?(?:vrai\s+)?drh)/;
  if (CAPABILITY_Q.test(m) && !/\b(achet|reserv|command|souscri|abonn|prix|combien|coute|tarif|demo|essay)[a-z]*/.test(m)) {
    return build(RULES.find((r) => r.intent === "discover_pierre")!, { reason: "question de capacité/limite ⇒ découverte (jamais un achat)." });
  }

  // Négation d'achat : on ne force JAMAIS un CTA de réservation. On regarde s'il reste une autre
  // intention claire (démo, découverte, prix) ; sinon découverte de Pierre.
  const negatesPurchase = NEG_PURCHASE.test(m);

  for (const rule of RULES) {
    if (!rule.test.test(m)) continue;

    if ((rule.intent === "purchase_pierre" || rule.intent === "reserve_pierre") && negatesPurchase) {
      // « je ne veux pas acheter, seulement voir la démo » → démo si demandée, sinon découverte.
      if (/\b(demo|voir|essayer|tester|montre)\b/.test(m)) return build(RULES.find((r) => r.intent === "request_pierre_demo")!, { reason: "achat NIÉ, l'utilisateur veut voir/tester ⇒ démo." });
      return build(RULES.find((r) => r.intent === "discover_pierre")!, { reason: "achat NIÉ ⇒ découverte, aucun CTA d'achat forcé.", confidence: "high" });
    }

    // Ellipse d'achat (règle marquée `ellipsis`) : n'est valable que si le contexte parlait de Pierre.
    // (On identifie la règle par sa PROPRIÉTÉ, jamais par un index — l'insertion d'une règle décalait
    // l'index et faisait retomber tout l'achat non-Pierre dans la garde d'ellipse.)
    if (rule.intent === "purchase_pierre" && rule.ellipsis) {
      const ctxText = norm((history ?? []).map((h) => h.text).join(" "));
      if (!MENTIONS_PIERRE.test(m) && !MENTIONS_PIERRE.test(ctxText)) continue; // pas d'ellipse sans sujet Pierre
      return build(rule, { reason: "ellipse d'achat résolue sur le sujet Pierre du contexte." });
    }

    return build(rule);
  }

  // Rien de clair. Si le message parle de Pierre sans intention précise ⇒ découverte (jamais Support).
  if (MENTIONS_PIERRE.test(m)) return build(RULES.find((r) => r.intent === "discover_pierre")!, { confidence: "medium", reason: "sujet Pierre sans intention précise ⇒ découverte." });
  return clarify("aucune intention claire détectée");
}

/** Toutes les destinations (pour construire des cartes de liens validées). */
export function allDestinations(): readonly CloneStoreDestination[] { return DESTINATIONS; }

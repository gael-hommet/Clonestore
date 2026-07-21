// src/lib/clonechat/public-answer/public-composer.ts
// C1.8 A2 — COMPOSITION de la réponse publique : une situation ⇒ un texte honnête + UNE destination.
//
// Règle de conception : le texte et le CTA sont produits par le MÊME objet. Un texte qui parle des
// CGV ne peut donc plus pointer les CGU, et une réponse d'incident ne peut plus porter un bouton
// « Réserver Pierre ». Aucun branchement sur un identifiant de corpus, aucune phrase réservée à un
// message exact : chaque réponse est composée depuis les faits canoniques et la situation détectée.

import {
  CLONECHAT_IDENTITY_SENTENCE, CLONESTORE_IDENTITY, HUMAN_FLOOR, LAUNCH_SENTENCE, NOT_PUBLISHED,
  NO_FREE_TRIAL, NO_FULL_PAYROLL, NO_LEGAL_GUARANTEE, OUT_OF_PERIMETER, PAYMENT_NOT_OPEN,
  PIERRE_IDENTITY_SENTENCE, PIERRE_MISSION_DOMAINS, PIERRE_PREPARES, PRIVACY_REFERRAL, PRIVACY_STANCE,
  PUBLIC_VISITOR_ACCESS, ROUTE_LABEL, bothPricesSentence, launchPriceDisplay, type PublicRoute,
} from "./public-canon";
import { normalizePublic, type PublicSituation } from "./public-situation";

export interface PublicComposition {
  readonly answer: string;
  readonly route: PublicRoute | null;
  readonly links: readonly PublicRoute[];
  readonly escalate: boolean;
  readonly confidence: "high" | "medium" | "low";
  /** Situation « incident/litige/support » : aucune pression commerciale n'est tolérée. */
  readonly commercialForbidden: boolean;
}

const S = (
  answer: string,
  route: PublicRoute | null,
  opts: { links?: PublicRoute[]; escalate?: boolean; confidence?: "high" | "medium" | "low"; commercialForbidden?: boolean } = {},
): PublicComposition =>
  Object.freeze({
    answer: answer.replace(/\s+/g, " ").trim(),
    route,
    links: Object.freeze(opts.links ?? (route ? [route] : [])),
    escalate: opts.escalate ?? false,
    confidence: opts.confidence ?? "high",
    commercialForbidden: opts.commercialForbidden ?? false,
  });

const SUPPORT_TAIL = "Le support humain prend le relais depuis la page Support.";

// ── Incidents : reconnaître, ne rien inventer, donner la voie utile ───────────
function incidentAnswer(sit: PublicSituation, m: string): PublicComposition {
  const opener = "Je comprends le problème, et je ne vais pas deviner l'état de votre dossier : depuis ce chat public, je n'ai accès à aucun compte, aucune facture et aucun historique.";
  switch (sit.incidentKind) {
    case "payment": {
      const refund = /rembours/.test(m);
      const twice = /deux\s+fois|double/.test(m);
      const detail = twice
        ? "Un débit en double se corrige au cas par cas : il faut la date, le montant et les quatre derniers chiffres du moyen de paiement."
        : refund
          ? "Une demande de remboursement est traitée par une personne, jamais automatiquement — et je ne peux ni la promettre ni la refuser à sa place."
          : "Une facture, un prélèvement ou un paiement qui n'aboutit pas se vérifie sur le dossier réel, avec la date et le montant.";
      return S(`${opener} ${detail} Écrivez au support avec ces éléments : c'est la voie la plus rapide, et votre demande y est tracée.`, "/questions", { escalate: true, commercialForbidden: true });
    }
    case "access":
      return S(
        `${opener} Deux choses utiles tout de suite : la réinitialisation du mot de passe se lance depuis la page de connexion, et un lien de réinitialisation expiré se redemande simplement. Si l'accès reste bloqué après cela — code refusé, déconnexion en boucle, message d'accès refusé — c'est un incident : le support le débloque avec votre adresse e-mail et l'heure de la tentative.`,
        "/questions", { escalate: true, commercialForbidden: true },
      );
    case "document":
      return S(
        `${opener} Je ne peux ni ouvrir, ni récupérer, ni régénérer un document ici : les documents et l'historique vivent dans votre espace, une fois connecté. Un fichier vide, un lien mort ou un document introuvable est un incident à faire remonter — le support retrouve la pièce et vous la renvoie.`,
        "/questions", { escalate: true, commercialForbidden: true },
      );
    case "unanswered":
      return S(
        "Ne pas obtenir de réponse est un problème en soi, et je ne vais pas vous répondre à la place de l'équipe : je n'ai pas accès à vos échanges précédents. Relancez sur la page Support en rappelant la date de votre premier message et l'objet exact — c'est la voie tracée, et une relance datée est traitée en priorité.",
        "/questions", { escalate: true, commercialForbidden: true },
      );
    default:
      return S(
        `Non, ce n'est pas normal — et je ne vais pas vous dire que tout va bien. ${opener} Ce qui aide vraiment : la page exacte, ce que vous avez cliqué, et ce que l'écran affiche. Recharger la page ou essayer un autre navigateur lève parfois un affichage bloqué ; si le problème persiste, décrivez-le au support avec ces éléments.`,
        "/questions", { escalate: true, commercialForbidden: true },
      );
  }
}

// ── Capacités et limites ──────────────────────────────────────────────────────
function capabilityAnswer(sit: PublicSituation, m: string): PublicComposition {
  switch (sit.capability) {
    case "missions_scope":
      return S(
        `Pierre couvre le travail RH opérationnel : ${PIERRE_MISSION_DOMAINS}. Chaque demande devient une mission structurée, préparée et tracée. ${HUMAN_FLOOR} La liste détaillée de ce qu'il fait — et de ce qu'il ne fait pas — est sur sa page.`,
        "/agents/pierre",
      );
    case "languages":
      return S(
        "Pierre travaille en français, sur les cadres RH des quatre pays de lancement : France, Belgique, Luxembourg et Suisse. Je ne vais pas vous promettre d'autre langue ni un autre droit du travail : ce n'est pas couvert aujourd'hui.",
        "/agents/pierre",
      );
    case "headcount":
      return S(
        `Nous ne publions pas de plafond d'effectif, et je ne vais pas en inventer un. Pierre est conçu pour le travail RH d'une entreprise, pas pour un volume affiché. Pour un effectif important, le support vous répondra précisément — c'est une question qui mérite une vraie réponse, pas une estimation de ma part. ${SUPPORT_TAIL}`,
        "/questions",
      );
    case "payroll":
      return S(
        `Non. ${NO_FULL_PAYROLL} Il prépare les éléments variables et les documents associés, votre outil de paie fait le reste. ${HUMAN_FLOOR}`,
        "/agents/pierre",
      );
    case "document_ownership":
      return S(
        "Les documents préparés par Pierre sont destinés à votre entreprise et restent les vôtres. Le détail contractuel — droits, durée, réutilisation — est dans les conditions d'utilisation : je préfère vous y renvoyer plutôt que de les résumer à leur place.",
        "/legal/cgu",
      );
    case "company_age":
      return S(
        "CloneStore est une jeune société en phase de lancement : Pierre est notre premier employé IA, et l'offre s'ouvre sur quatre pays. Je ne vais pas vous donner une date de création que je ne peux pas prouver ici. Ce que vous pouvez vérifier vous-même : ce que fait le produit, et ce qu'il ne fait pas.",
        "/comprendre-clonestore",
      );
    case "customer_count":
      return S(
        `${NOT_PUBLISHED} Je ne vais pas vous donner un nombre de clients ni une liste de références que je ne peux pas prouver. Si vous avez besoin d'éléments concrets pour décider, le support peut répondre à une demande précise.`,
        "/questions",
      );
    case "service_reliability":
      return S(
        `${NOT_PUBLISHED} Nous ne publions ni historique d'incidents ni engagement de disponibilité chiffré, et je ne vais pas en improviser un. Si vous avez besoin d'un engagement écrit sur ce point, demandez-le au support.`,
        "/questions",
      );
    case "other_employees":
      return S(
        "Pierre est aujourd'hui le premier et le seul employé IA disponible chez CloneStore : il n'y a pas d'autre employé IA en ligne, quel que soit le prénom que vous avez pu entendre. Les prochains arriveront dans le catalogue des employés IA.",
        "/agents",
      );
    case "delivery_delay":
      return S(
        `Il n'y a pas de délai de livraison : Pierre n'est pas un objet à expédier. ${PAYMENT_NOT_OPEN} La réservation, elle, est immédiate et vous informe dès l'ouverture.`,
        "/reserver/pierre",
      );
    case "partner_commission":
      return S(
        "Le programme des Partenaires Fondateurs (revendeur, apporteur, marque blanche) porte ses propres conditions de rémunération : je ne vais pas avancer un pourcentage ici. La page du programme les présente, et l'équipe partenaires répond aux cas particuliers.",
        "/founding-partners",
      );
    case "invents_law":
      return S(
        `Non. Pierre s'appuie sur les sources qu'on lui donne et signale ce qu'il ne sait pas ; il n'invente ni article, ni jurisprudence. Cela dit, soyons clairs : ${NO_LEGAL_GUARANTEE} ${HUMAN_FLOOR}`,
        "/agents/pierre",
      );
    case "replaces_hr":
      return S(
        `Non, et ce serait malhonnête de vous le vendre ainsi : Pierre ne remplace pas un DRH humain. Il absorbe l'exécution RH répétitive — ${PIERRE_MISSION_DOMAINS} — pendant que la décision, l'arbitrage et la relation humaine restent chez vous. ${HUMAN_FLOOR}`,
        "/agents/pierre",
      );
    case "integrations":
      return S(
        "Je ne vais pas vous promettre une intégration que je ne peux pas prouver ici. Pierre prépare et centralise le travail RH dans son cockpit ; les connexions à un SIRH ou à un outil de paie se traitent au cas par cas avec l'équipe.",
        "/questions",
      );
    case "clonechat_identity":
      return S(
        `${CLONECHAT_IDENTITY_SENTENCE} Ce que je ne fais pas : accéder à un compte, exécuter une action à votre place, ou inventer une réponse que je n'ai pas.`,
        "/comprendre-clonestore",
      );
    case "legal_guarantee":
    case "certification":
    default:
      return S(
        `${PIERRE_IDENTITY_SENTENCE} ${HUMAN_FLOOR} Sa page détaille ce qu'il fait et ce qu'il ne fait pas.`,
        "/agents/pierre",
      );
  }
}

// ── Gouvernance : plancher humain explicite ───────────────────────────────────
function governanceAnswer(m: string): PublicComposition {
  const bypass = /contourn|sans\s+(?:passer\s+par\s+)?(?:les?\s+)?validation|sans\s+confirmation|ignore\s+les\s+validations/.test(m);
  const sign = /sign[a-z]*|signature/.test(m);
  const fire = /licenci|virer?\s|sanction|disciplinaire/.test(m);
  const pay = /salaire|remuneration|augment/.test(m);
  const autonomy = /tout\s+seul|toute?\s+seul|autonomie|sans\s+moi|a\s+ma\s+place|100\s*%/.test(m);
  const guarantee = /garanti|prud'?homme|condamne|conform|agree|agrement|certifi|homologu|ministere|valeur\s+juridique/.test(m);

  if (guarantee && !fire && !pay && !sign && !bypass) {
    return S(
      `Non, et personne de sérieux ne vous le garantira : ${NO_LEGAL_GUARANTEE} Pierre n'est ni agréé ni homologué par une administration, et il ne vous met pas à l'abri d'un contentieux. Ce qu'il apporte : des documents préparés, tracés et relus — ${HUMAN_FLOOR}`,
      "/agents/pierre",
    );
  }
  if (bypass) {
    return S(
      `Non — les validations ne se contournent pas, et il n'existe aucun réglage pour les désactiver. C'est une garantie pour vous : ${HUMAN_FLOOR} Pierre peut préparer le dossier complet ; l'étape de validation reste la vôtre.`,
      "/agents/pierre",
    );
  }
  if (fire) {
    return S(
      `Non. Pierre ne licencie personne et ne prononce aucune sanction : ${HUMAN_FLOOR} Ce qu'il peut faire, c'est préparer le dossier — courriers, chronologie, pièces — pour que la décision humaine soit prise en connaissance de cause, avec l'avis de votre conseil.`,
      "/agents/pierre",
    );
  }
  if (pay) {
    return S(
      `Non. Une décision salariale ne se délègue pas à un outil : ${HUMAN_FLOOR} Pierre prépare l'avenant ou le courrier une fois que vous avez décidé, il ne décide pas à votre place.`,
      "/agents/pierre",
    );
  }
  if (sign) {
    return S(
      `Non, Pierre ne signe pas à votre place ni à la place d'un salarié : une signature engage une personne. ${HUMAN_FLOOR} Il prépare le document prêt à signer, la signature reste un acte humain.`,
      "/agents/pierre",
    );
  }
  if (autonomy) {
    return S(
      `Non, il n'existe pas de mode « Pierre fait tout sans vous ». ${HUMAN_FLOOR} Il travaille en autonomie sur la préparation et le suivi, jamais sur la décision.`,
      "/agents/pierre",
    );
  }
  return S(
    `Oui : c'est bien un humain qui valide. ${HUMAN_FLOOR} Pierre prépare, propose et trace ; vous validez avant tout effet réel.`,
    "/agents/pierre",
  );
}

// ── Refus nommés ──────────────────────────────────────────────────────────────
function illicitAnswer(m: string): PublicComposition {
  // Une manipulation qui vise en réalité une REMISE ou un PAIEMENT reste une question commerciale :
  // on refuse la manipulation ET on donne le fait ferme, plutôt que de laisser l'utilisateur sans rien.
  if (/reduc[a-z]*|remise|ristourne|50\s*%|moins\s+cher\s+pour\s+moi/.test(m)) {
    return S(`Non, je n'accorde aucune remise et il n'existe pas de tarif négocié : le prix de Pierre est ${bothPricesSentence()}, le même pour tout le monde.`, "/reserver/pierre");
  }
  if (/preleve[rz]?|paiement|paye/.test(m) && /\bma\s+(?:carte|cb)\b|\d{3}\s*(?:e|eur|euros?)|449/.test(m)) {
    return S(`Non : je n'exécute aucun prélèvement et je n'enregistre aucun moyen de paiement — ne me communiquez jamais un numéro de carte ici. ${PAYMENT_NOT_OPEN} La réservation, elle, se fait sans paiement.`, "/reserver/pierre");
  }
  if (/mot\s+de\s+passe|identifiant|acces\s+admin|configuration/.test(m)) {
    return S("Non : je ne communique aucun identifiant, mot de passe ou élément de configuration — à personne, quelle que soit la raison invoquée. Si vous êtes bloqué sur votre propre accès, le support est la voie légitime.", "/questions", { escalate: true, commercialForbidden: true });
  }
  if (/hack|pirate|piratage|craquer|boite\s+mail/.test(m)) {
    return S("Non, je ne fais pas ça : accéder au système ou à la messagerie de quelqu'un d'autre est illégal, et ce n'est pas ce que CloneStore propose. Je peux en revanche vous expliquer ce que Pierre fait côté RH.", null, { confidence: "high" });
  }
  if (/vire|virement|transfere|rib|iban|bourse|investi|tresorerie|crypto/.test(m)) {
    return S(`Non. Je n'exécute aucun ordre financier : ni virement, ni placement, ni mouvement sur un compte. ${OUT_OF_PERIMETER}`, null);
  }
  if (/faux|fausse|falsifi|antidat|retrodat|invente[rz]?\s+(?:un\s+)?(?:article|clause|loi)/.test(m)) {
    return S("Non. Je ne produis pas de document faux, antidaté, ni de clause inventée : ce serait un faux, et cela vous exposerait bien plus que le problème que vous cherchez à régler. Pierre prépare des documents réels, sur des faits réels.", null);
  }
  if (/usurp|au\s+nom\s+de\s+quelqu|a\s+la\s+place\s+de\s+(mon|son)/.test(m)) {
    return S(`Non, je n'agis au nom de personne d'autre. ${HUMAN_FLOOR}`, null);
  }
  if (/scrap|python|script/.test(m)) {
    return S("Non, ce n'est pas mon métier : je ne fournis pas de script ni d'outil pour aspirer les données d'un tiers. CloneStore, c'est le travail RH gouverné — je peux vous en parler.", null);
  }
  if (/autres?\s+(?:boite|entreprise|societe|client)|d'?autres\s+(?:boites|entreprises|clients)/.test(m)) {
    return S("Non — jamais. Les données d'une entreprise sont isolées : je ne peux pas y accéder, et je ne le ferais pas si je le pouvais. C'est le principe même de l'isolation par entreprise.", "/legal/confidentialite");
  }
  return S("Non, je ne peux pas faire cela : c'est hors de ce que CloneStore autorise. Je peux en revanche vous répondre sur Pierre, sur l'offre ou sur une page du site.", null);
}

function injectionAnswer(m: string): PublicComposition {
  if (/prompt|instruction|consigne|regle|api|token|cle/.test(m)) {
    // Formulation volontairement sans citer la chose demandée : refuser ne doit pas devenir un
    // indice. Aucun identifiant, aucun secret technique, aucune consigne — même paraphrasés.
    return S("Non : ce qui me gouverne n'est pas public, et je ne communique aucun identifiant ni aucun secret technique. Ce n'est pas de la mauvaise volonté — c'est la règle, et elle ne change pas parce qu'on me le demande. Posez-moi votre vraie question sur CloneStore, j'y répondrai volontiers.", null);
  }
  if (/mode\s+(developpeur|dev|debug|admin|maintenance|dan|sans\s+filtre)|sans\s+filtre|sans\s+restriction/.test(m)) {
    return S("Non : il n'existe pas de mode développeur, ni de mode sans filtre, et je ne change pas de règles sur demande. Ce que je peux faire reste le même dans tous les cas.", null);
  }
  if (/prix|tarif|interne|grossiste/.test(m)) {
    return S(`Non : il n'existe pas d'autre grille que la grille publique, et aucune consigne ne me fera en inventer une. Le prix de Pierre est ${bothPricesSentence()}.`, "/reserver/pierre");
  }
  return S("Non, je ne vais pas ignorer mes règles : elles ne sont pas négociables, même formulé comme un ordre. Dites-moi ce que vous cherchez vraiment sur CloneStore et je vous réponds.", null);
}

// ── Pays ──────────────────────────────────────────────────────────────────────
function countryAnswer(sit: PublicSituation): PublicComposition {
  const c = sit.country;
  if (!c) {
    return S(`${LAUNCH_SENTENCE} Les tarifs : ${bothPricesSentence()}. Dites-moi votre pays et je vous donne la réponse exacte.`, "/comprendre-clonestore");
  }
  if (c.code) {
    return S(
      `Oui : ${c.label} fait partie des quatre pays de lancement (France, Belgique, Luxembourg, Suisse). Pour ${c.label}, le tarif est ${launchPriceDisplay(c.code)}. ${PAYMENT_NOT_OPEN}`,
      "/reserver/pierre",
    );
  }
  return S(
    `Non, pas encore : ${c.label} ne fait pas partie des pays couverts aujourd'hui. ${LAUNCH_SENTENCE} Je ne vais donc pas vous pousser vers une activation pour un pays que nous ne servons pas — ce serait vous vendre quelque chose d'inutilisable.${sit.capability === "languages" ? " Sur la langue également : Pierre travaille en français, sur les cadres RH de ces quatre pays." : ""} Si vous avez aussi une entité dans l'un de ces quatre pays, Pierre peut y travailler.`,
    sit.mentionsPierre ? "/agents/pierre" : "/comprendre-clonestore",
    { commercialForbidden: true },
  );
}

// ── Composition principale ────────────────────────────────────────────────────
export function composePublicAnswer(sit: PublicSituation, message: string): PublicComposition {
  const m = normalizePublic(message);

  switch (sit.kind) {
    case "illicit_request":
      return illicitAnswer(m);
    case "prompt_injection":
      return injectionAnswer(m);
    case "incident":
      return incidentAnswer(sit, m);

    case "abandon":
      // « Annule tout » sans objet peut viser ce que je m'apprêtais à faire OU un abonnement réel :
      // on accuse réception sans rien relancer, et on indique la voie réelle si c'est un abonnement.
      if (/\bannul/.test(m)) {
        return S(
          "Entendu, j'arrête là — rien n'était engagé de mon côté, donc il n'y a rien à annuler ici. S'il s'agit d'un abonnement existant, la résiliation se gère depuis votre espace, une fois connecté.",
          "/profile" as PublicRoute,
        );
      }
      return S("Entendu, je laisse tomber — rien n'est lancé de mon côté. Si vous voulez y revenir plus tard, je suis là.", null, { confidence: "high" });

    case "denied_intent": {
      const denied =
        sit.deniedIntent === "signup" ? "de créer un compte"
        : sit.deniedIntent === "login" ? "de vous connecter"
        : sit.deniedIntent === "purchase" ? "de réserver"
        : sit.deniedIntent === "cancel" ? "de résilier"
        : sit.deniedIntent === "demo" ? "la démo"
        : sit.deniedIntent === "pierre" ? "Pierre"
        : "cela";
      return S(`Vous avez raison, j'ai mal compris : je ne vous propose plus ${denied}. Dites-moi ce que vous cherchez et je vous oriente au bon endroit.`, null);
    }

    case "country_availability":
      return countryAnswer(sit);

    case "legal_document": {
      const map: Record<string, { route: PublicRoute; sentence: string }> = {
        cgv: { route: "/legal/cgv", sentence: "Les conditions générales de vente sont sur la page /legal/cgv" },
        cgu: { route: "/legal/cgu", sentence: "Les conditions générales d'utilisation sont sur la page /legal/cgu" },
        mentions: { route: "/legal/mentions", sentence: "Les mentions légales sont sur la page /legal/mentions" },
        privacy: { route: "/legal/confidentialite", sentence: "La politique de confidentialité (RGPD) est sur la page /legal/confidentialite" },
        dpa: { route: "/legal/dpa", sentence: "L'accord de traitement des données (DPA) est sur la page /legal/dpa" },
      };
      const hit = map[sit.legalDoc ?? "cgu"];
      return S(`${hit.sentence}. C'est bien ce document-là et pas un autre : chaque page légale a sa propre adresse.`, hit.route);
    }

    case "privacy_security": {
      const card = /carte|cb\b|bancaire|paiement\s+securise/.test(m);
      const training = /entrain|apprend\s+de\s+mes|modele\s+general|ia\s+generale/.test(m);
      const humans = /lu\s+par\s+des\s+humains|confidentiel/.test(m);
      const extra = card
        ? ` ${PAYMENT_NOT_OPEN} Aucun numéro de carte ne transite par ce chat.`
        : training
          ? " Vos données ne servent pas à entraîner un modèle général : elles restent au service de votre entreprise."
          : humans
            ? " Vos échanges ne sont pas ouverts à la lecture de tiers : ils restent rattachés à votre entreprise."
            : "";
      return S(`${PRIVACY_STANCE}${extra} ${PRIVACY_REFERRAL}`, "/legal/confidentialite");
    }

    case "governance_limit":
      return governanceAnswer(m);

    case "hr_document_request":
      return S(
        `C'est exactement le travail de Pierre : ${PIERRE_PREPARES} ${PUBLIC_VISITOR_ACCESS} Je ne produis donc pas ce document ici, et je ne vais pas faire semblant de l'avoir fait.`,
        "/agents/pierre",
      );

    case "mission_request":
      return S(
        `Oui, c'est précisément ce que Pierre fait : une demande comme la vôtre devient une mission structurée — étapes, documents préparés, suivi tracé — sur ${PIERRE_MISSION_DOMAINS}. ${HUMAN_FLOOR} ${PUBLIC_VISITOR_ACCESS} Rien n'est lancé depuis ce chat, et je ne vais pas prétendre le contraire.`,
        "/agents/pierre",
      );

    case "validation_request":
      return S(
        `Je ne valide rien, et personne ne validera à votre place depuis un chat : ${HUMAN_FLOOR} ${PUBLIC_VISITOR_ACCESS} Une fois connecté, les validations se font dans le cockpit de Pierre, tracées et réversibles tant qu'elles ne sont pas confirmées.`,
        "/agents/pierre",
      );

    case "technology_explanation": {
      const model = /modele|gpt|claude|llm|ia\s+derriere/.test(m);
      const mobile = /mobile|appli|ordi/.test(m);
      if (model) {
        return S(
          "Nous ne communiquons pas le détail des modèles utilisés, et je ne vais pas inventer un nom pour vous faire plaisir. Ce qui compte et qui est vérifiable : les réponses et les documents sont gouvernés, tracés, et les décisions sensibles restent sous validation humaine.",
          "/comprendre-clonestore",
        );
      }
      if (mobile) {
        return S(
          "CloneStore s'utilise depuis un navigateur, sur ordinateur comme sur téléphone. Je ne vais pas vous annoncer une application mobile dédiée tant qu'elle n'existe pas.",
          "/comprendre-clonestore",
        );
      }
      return S(
        `Derrière Pierre, CloneStore assemble des briques communes : orchestration des missions, gouvernance des actions sensibles, traçabilité complète, mémoire d'entreprise isolée. C'est ce qui permet de dire « mission gouvernée » : chaque étape est attribuée, journalisée, et ${HUMAN_FLOOR}`,
        "/comprendre-clonestore",
      );
    }

    case "company_identity":
      return S(
        "L'éditeur du site, sa forme juridique et ses coordonnées figurent dans les mentions légales : c'est la source qui fait foi, je ne vais pas la paraphraser de mémoire.",
        "/legal/mentions",
      );

    case "payment_method":
      return S(
        `${PAYMENT_NOT_OPEN} Je ne vais donc pas vous donner de lien de paiement : il n'y en a pas aujourd'hui, et un lien inventé serait pire qu'une absence de réponse. La réservation, elle, est ouverte et sans paiement — vous serez prévenu à l'ouverture, avec les moyens de paiement acceptés.`,
        "/reserver/pierre",
      );

    case "human_contact":
      return S(
        "Oui, une personne peut vous répondre : la page Support est la voie pour joindre l'équipe, avec votre demande écrite et son historique. Je n'ai pas de numéro de téléphone à vous donner, et je ne vais pas en inventer un.",
        "/questions",
        { escalate: true, commercialForbidden: true },
      );

    case "value_question":
      return S(
        `Concrètement, ce que Pierre vous fait gagner, c'est du temps d'exécution RH : ${PIERRE_MISSION_DOMAINS} — préparés, suivis et tracés au lieu d'être refaits à la main. Ce qu'il ne vous fait pas gagner : la décision, qui reste la vôtre. ${HUMAN_FLOOR} Le plus honnête pour juger, c'est de le voir travailler.`,
        "/demo/pierre",
      );

    case "private_data_request":
      return S(
        `${PUBLIC_VISITOR_ACCESS} Je ne vais rien inventer sur votre dossier : une fois connecté, avec votre entreprise associée, vous retrouvez vos documents, vos missions et leur suivi dans votre espace.`,
        "/login",
      );

    case "capability_question":
      return capabilityAnswer(sit, m);

    case "false_price_premise":
      return S(
        `Non, ce n'est pas le bon montant, et je préfère le corriger tout de suite : Pierre coûte ${bothPricesSentence()}. ${NO_FREE_TRIAL}`,
        "/reserver/pierre",
      );

    case "pricing_question":
      return S(
        `Pierre coûte ${bothPricesSentence()}. C'est un abonnement mensuel. ${NO_FREE_TRIAL} ${PAYMENT_NOT_OPEN}`,
        "/reserver/pierre",
      );

    case "cancellation":
      return S(
        "La résiliation se gère depuis votre espace CloneStore, une fois connecté : rien n'est irréversible tant que vous n'avez pas confirmé. Si un prélèvement continue après une résiliation, c'est un incident de facturation — le support le traite.",
        "/profile" as PublicRoute,
        { links: ["/profile" as PublicRoute, "/questions"] },
      );

    case "purchase_intent":
      return S(
        `Pour obtenir Pierre, rendez-vous sur la page Réserver Pierre : vous y voyez le prix de votre pays et vous lancez l'activation. ${PAYMENT_NOT_OPEN}`,
        "/reserver/pierre",
      );

    case "demo_request":
      return S("Pour voir Pierre en action, ouvrez la démo Pierre : elle montre le produit réel, sans compte et sans paiement.", "/demo/pierre");

    case "discover_pierre":
      return S(
        `${PIERRE_IDENTITY_SENTENCE} Ce qu'il ne fait pas est tout aussi clair : ${HUMAN_FLOOR}`,
        "/agents/pierre",
      );

    case "discover_clonestore":
      return S(
        `${CLONESTORE_IDENTITY} Le premier est Pierre, employé IA RH : vous confiez une demande, elle devient une mission préparée et tracée. ${HUMAN_FLOOR}`,
        "/comprendre-clonestore",
      );

    case "catalog_question":
      return S(
        "Pierre est aujourd'hui le seul employé IA disponible : c'est le premier de CloneStore. Le catalogue des employés IA présente ce qui existe et ce qui arrive — je ne vais pas vous annoncer un employé qui n'est pas là.",
        "/agents",
      );

    case "partner_program":
      return S(
        "Le programme des Partenaires Fondateurs s'adresse aux revendeurs, apporteurs d'affaires et marques blanches : sa page présente le cadre, les engagements et la façon de candidater.",
        "/founding-partners",
      );

    case "login_help":
      return S("Pour accéder à votre espace, passez par la page Connexion. Si vous avez oublié votre mot de passe, la réinitialisation se lance depuis cette même page.", "/login");

    case "signup_help":
      return S(
        "Pour créer votre compte, passez par la page Créer un compte. L'ordre est simple : le compte d'abord, l'entreprise ensuite, la réservation de Pierre après — et aucun paiement n'est demandé pour créer le compte.",
        "/signup",
      );

    case "navigate_home":
      return S("La page d'accueil de CloneStore, c'est /. Vous y retrouvez l'entrée vers Pierre, la démo et le reste du site.", "/");

    case "next_step":
      return S(
        `Le parcours est simple : d'abord voir Pierre travailler dans la démo (sans compte, sans paiement), ensuite lire ce qu'il fait et ne fait pas sur sa page, et seulement après réserver si cela vous convient. ${PAYMENT_NOT_OPEN}`,
        "/demo/pierre",
      );

    case "help_request":
      return S(
        `Oui, avec plaisir — dites-moi sur quoi : découvrir Pierre, le prix, la démo, ou un problème à régler. Et si votre sujet demande une personne (facture, accès, incident), la page Support est la bonne porte. ${CLONECHAT_IDENTITY_SENTENCE}`,
        "/questions",
      );

    case "greeting":
      return S(
        `Bonjour ! ${CLONECHAT_IDENTITY_SENTENCE} Dites-moi ce qui vous amène : découvrir Pierre, le prix, la démo, ou un problème à régler.`,
        "/comprendre-clonestore",
      );

    case "out_of_scope":
      return S(
        "Ce sujet sort de mon périmètre : je m'occupe de CloneStore et de Pierre, l'employé IA RH — pas du reste. Si vous avez une question sur le produit, l'offre ou une page du site, je suis là pour ça.",
        null,
      );

    case "unclear":
    default:
      // Une vraie ambiguïté mérite une question — mais pas une question vide. On situe d'abord
      // le cadre en une phrase (ce qu'est CloneStore, ce qu'est Pierre), puis on demande la
      // précision utile, avec des options concrètes. Aucun vocabulaire interne, aucune dérobade.
      return S(
        `Je ne suis pas sûr de bien comprendre à quoi vous faites référence — et je préfère demander plutôt que répondre à côté. Pour situer : ${CLONESTORE_IDENTITY} Le premier est Pierre, employé IA RH. Vous cherchez plutôt à découvrir Pierre, à connaître le prix, à voir la démo, ou à régler un problème ?`,
        "/comprendre-clonestore",
        { confidence: "medium" },
      );
  }
}

/** Préfixe de refus quand une injection ou une demande illicite est greffée sur un message légitime. */
export function hostilePrefix(sit: PublicSituation): string {
  if (sit.kind === "illicit_request" || sit.kind === "prompt_injection") return "";
  if (sit.illicitFlag) return "Je ne peux pas exécuter cette partie de votre demande : elle sort de ce que CloneStore autorise.";
  if (sit.injectionFlag) return "Je ne change pas de règles sur demande — mais je réponds volontiers à votre question.";
  return "";
}

export { ROUTE_LABEL };

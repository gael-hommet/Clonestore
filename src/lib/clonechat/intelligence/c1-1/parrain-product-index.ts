// src/lib/clonechat/intelligence/c1-1/parrain-product-index.ts
// C1.1 — Connaissance produit & vérité commerciale : dérivée en LIVE de la matrice de
// vérité C1 (56 entrées, statuts honnêtes) + identité produit + pricing canonique P10.
// Les prix ne sont JAMAIS dupliqués : le résolveur P10 reste la seule source.

import { pricingForCountry, publicPricingCatalog, normalizeCountry, SUPPORTED_LAUNCH_COUNTRIES } from "@/lib/clonestore/pricing/country-pricing";
import { CLONECHAT_TRUTH_MATRIX, truthEntriesBySection } from "../c1/clonechat-truth-matrix";
import { PRODUCT_IDENTITY } from "../c1/clonechat-product-knowledge";
import { makeParrainChunk } from "./parrain-knowledge-chunk";
import { parrainNormalize, type ParrainKnowledgeChunk } from "./parrain-types";

/** Chunk identité produit (socle des questions « qu'est-ce que CloneStore ? »). */
export function productIdentityChunk(): ParrainKnowledgeChunk {
  return makeParrainChunk({
    id: "product.identity",
    sourceId: "src.c1_product_truth",
    title: "Identité CloneStore",
    text: `${PRODUCT_IDENTITY.oneLiner} ${PRODUCT_IDENTITY.differentiators.join(" ")} État honnête : ${PRODUCT_IDENTITY.honestCurrentState.join(" ")}`,
    sourceType: "product_registry",
    authority: "verified_report",
    visibility: "PUBLIC",
    citationLabel: "la présentation CloneStore",
  });
}

/**
 * IDENTITÉ DE CLONECHAT LUI-MÊME — la source canonique qui MANQUAIT.
 *
 * Défaut trouvé en reproduisant la panne signalée : « Tu sers à quoi ? » ne recevait aucune
 * réponse. Le pipeline est GROUNDÉ (il n'invente jamais) ; or l'index décrivait CloneStore, les
 * prix, Pierre, les pages… mais **rien sur CloneChat**. Faute de source, le moteur refusait
 * honnêtement de répondre : « Je préfère ne pas improviser. » Il ne mentait pas — il n'avait
 * simplement rien à citer sur lui-même.
 *
 * On ne fige AUCUNE phrase exacte : on donne la VÉRITÉ, et le modèle la formule naturellement
 * selon la question (tutoiement, ton, longueur). Les limites honnêtes en font partie : ce qu'il
 * ne fait pas est aussi vrai que ce qu'il fait.
 */
export function clonechatIdentityChunk(): ParrainKnowledgeChunk {
  return makeParrainChunk({
    id: "clonechat.identity",
    sourceId: "src.c1_product_truth",
    title: "CloneChat — qui il est et à quoi il sert",
    text: [
      "CloneChat est l'employé système central de CloneStore : l'interlocuteur unique du site.",
      "Son rôle : expliquer CloneStore et ce qu'on peut y faire ; répondre aux questions sur le produit, les prix, les pays et les limites ;",
      "guider dans les pages et donner le lien direct vers la bonne page ; présenter Pierre, l'employé IA RH, et aider à s'en servir ;",
      "diagnostiquer un blocage à partir de l'état RÉEL du compte ; analyser un fichier, une image ou une capture d'écran fournis ;",
      "proposer la meilleure étape suivante ; et transmettre à un humain les cas exceptionnels (sécurité, vie privée, litige).",
      "Il distingue toujours la vérité PRODUIT (valable pour tout le monde) de la vérité du COMPTE (propre à l'utilisateur connecté).",
      "Ses limites, dites franchement : il ne décide jamais à la place d'un humain (pas de licenciement, pas de décision salariale, pas de garantie juridique),",
      "il n'exécute aucune action à effet externe réel tant que la production n'est pas ouverte,",
      "et quand il n'a pas de preuve, il le dit au lieu d'inventer.",
      "Il n'est pas un chatbot générique : ses réponses sont fondées sur les sources CloneStore, avec citations.",
      // ── ANCRES DE RÉCUPÉRATION ──
      // La récupération est LEXICALE : une source que personne ne retrouve vaut une source
      // absente. « Qui es-tu ? » ne partageait aucun mot avec le texte ci-dessus et ne la
      // récupérait donc pas. On y inscrit le vocabulaire RÉEL des utilisateurs — ce n'est pas
      // du bourrage : c'est la liste des questions auxquelles cette source répond.
      "Questions auxquelles cette source répond :",
      "qui es-tu, tu es qui, t'es qui, tu es quoi, c'est quoi CloneChat, à quoi sert CloneChat,",
      "tu sers à quoi, tu fais quoi, que fais-tu, quel est ton rôle, ton rôle, tes fonctions, tes capacités,",
      "que peux-tu faire, qu'est-ce que tu peux faire, comment peux-tu m'aider, tu peux m'aider,",
      "pourquoi tu existes, pourquoi te parler, tu remplaces le support, tu gères quoi,",
      "es-tu un chatbot, quelle différence avec ChatGPT, en quoi tu es différent, tu sers vraiment à quelque chose,",
      "tu connais CloneStore, tu peux m'aider à utiliser Pierre.",
    ].join(" "),
    sourceType: "product_registry",
    authority: "verified_report",
    visibility: "PUBLIC",
    citationLabel: "la présentation de CloneChat",
  });
}

/** Chunks de vérité produit pertinents pour une question (bornés, top-k). */
export function productTruthChunks(question: string, limit = 4): readonly ParrainKnowledgeChunk[] {
  const q = parrainNormalize(question);
  const words = q.split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  const scored = CLONECHAT_TRUTH_MATRIX.map((e) => {
    const hay = parrainNormalize(`${e.title} ${e.whatExists} ${e.safeExplanation}`);
    let score = 0;
    for (const w of words) if (hay.includes(w)) score += 1;
    return { e, score };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ e }) =>
      makeParrainChunk({
        id: `truth.${e.id}`,
        sourceId: "src.c1_product_truth",
        title: e.title,
        text: `${e.title} — statut : ${e.status}. ${e.safeExplanation}`,
        sourceType: "roadmap_report",
        authority: "verified_report",
        visibility: "PUBLIC",
        citationLabel: "l'état du produit",
      }),
    );
}

/** Chunk pricing DÉRIVÉ du résolveur canonique P10 (jamais de montant en dur). */
export function pricingChunk(question?: string, serverCountry?: string | null): ParrainKnowledgeChunk {
  const catalog = publicPricingCatalog();
  const lines = catalog.map((c) => `${c.countries.join("/")}: ${c.display}`).join(" · ");
  // P19 — the server-resolved legal country (geo authority, from the active company) OVERRIDES any country
  // word in the message. The user text can never impose the country/currency/amount for a known company.
  const serverResolved = serverCountry ? normalizeCountry(serverCountry) : null;
  const country = serverResolved ?? (question ? normalizeCountry(extractCountryWord(question)) : null);
  const res = country ? pricingForCountry(country) : null;
  const authoritative = serverResolved != null;
  const focus = res && res.status === "ok"
    ? ` Pour ${res.pricing.country} : ${res.pricing.display} (${res.pricing.currency}).${authoritative ? " (Pays résolu côté serveur — non modifiable par le texte de la question.)" : ""}`
    : "";
  return makeParrainChunk({
    id: "pricing.catalog",
    sourceId: "src.pricing_resolver",
    title: "Grille tarifaire de lancement",
    text: `Pays de lancement : ${SUPPORTED_LAUNCH_COUNTRIES.join(", ")}. ${lines}.${focus} Un client suisse voit et paiera l'offre suisse (CHF). Pays non déterminé → demander le pays, jamais d'offre par défaut. Le paiement en ligne n'est pas encore ouvert ; la réservation fondateur est disponible sans paiement. Pas d'essai gratuit, pas de bêta.`,
    sourceType: "pricing_registry",
    authority: "canonical_runtime",
    visibility: "PUBLIC",
    citationLabel: "la grille tarifaire",
  });
}

/**
 * ROI / PRODUCTIVITÉ — C1.8 réouvert.
 *
 * Défaut trouvé : « en moyenne Pierre fait gagner combien de temps à une entreprise, et combien
 * d'argent, dans une PME ? » recevait une réponse de PRIX pur (« Pierre coûte 449 €/mois »). Cause
 * réelle : aucune source ne couvrait le ROI/la productivité — la récupération est LEXICALE
 * (parrain-retrieval.ts), donc sans chunk dédié, un mot comme « argent » ne pouvait remonter que
 * la grille tarifaire. Cette source donne au modèle de quoi répondre HONNÊTEMENT sur le temps et
 * l'argent gagnés SANS jamais inventer une moyenne — aucun chiffre de gain n'est publié par
 * CloneStore, seul le prix l'est.
 */
export function roiProductivityChunk(): ParrainKnowledgeChunk {
  return makeParrainChunk({
    id: "product.roi-productivity",
    sourceId: "src.c1_product_truth",
    title: "ROI et productivité — ce que Pierre fait gagner",
    text: [
      "Aucune moyenne de gain de temps ou d'argent n'est publiée par CloneStore, et il ne faut jamais en inventer une.",
      "Le gain réel dépend de facteurs propres à chaque entreprise : sa taille, le volume de tâches RH concernées,",
      "le nombre de salariés, la part de processus aujourd'hui manuels, et le niveau d'usage de Pierre.",
      "Temps : Pierre absorbe l'exécution répétitive — contrats et avenants, onboarding et offboarding,",
      "absences et congés, attestations et courriers RH, relances et suivis, préparation des variables de paie —",
      "que les équipes referaient sinon à la main.",
      "Argent : l'économie se lit en comparant ce temps libéré au coût de l'abonnement et, le cas échéant,",
      "au coût d'une embauche ou d'un prestataire externe pour le même volume de travail.",
      "Méthode honnête : partir des heures RH actuelles sur les tâches concernées, jamais d'un chiffre moyen théorique.",
      "Le prix de Pierre est un INTRANT du calcul de ROI, jamais la réponse à la question du gain.",
      // ── ANCRES DE RÉCUPÉRATION — vocabulaire réel des questions ROI/productivité ──
      "Questions auxquelles cette source répond :",
      "combien de temps Pierre fait gagner, combien d'argent Pierre fait économiser, est-ce que Pierre est rentable,",
      "rentabilité de Pierre, retour sur investissement, ROI, au bout de combien de temps l'abonnement est amorti,",
      "amortissement, quel impact sur les coûts RH, est-ce que ça remplace réellement du travail humain,",
      "économie pour plusieurs salariés, qu'est-ce qu'une petite entreprise gagne concrètement avec Pierre,",
      "mon équipe RH passe des heures par semaine sur l'administratif ça changerait quoi,",
      "est-ce plus rentable qu'embaucher quelqu'un, combien ça rapporte, gain de productivité, productivité RH.",
    ].join(" "),
    sourceType: "product_registry",
    authority: "verified_report",
    visibility: "PUBLIC",
    citationLabel: "l'explication ROI et productivité",
  });
}

function extractCountryWord(q: string): string {
  const m = q.match(/suisse|switzerland|belgique|belgium|luxembourg|france|\bfr\b|\bbe\b|\blu\b|\bch\b/i);
  return m ? m[0] : "";
}

/** Blocages externes — formulation PUBLIQUE honnête (approuvée C1). */
export function externalBlockersChunk(): ParrainKnowledgeChunk {
  const blockers = truthEntriesBySection("external_blockers").map((b) => `${b.title} : ${b.safeExplanation}`);
  return makeParrainChunk({
    id: "truth.external-blockers",
    sourceId: "src.c1_product_truth",
    title: "Ce qui attend des vérifications externes",
    text: blockers.join(" "),
    sourceType: "readiness_report",
    authority: "verified_report",
    visibility: "PUBLIC",
    citationLabel: "l'état du produit",
  });
}

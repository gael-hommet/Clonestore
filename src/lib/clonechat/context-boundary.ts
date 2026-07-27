// src/lib/clonechat/context-boundary.ts
// P9.4 — Frontière de contexte : ce que chaque mode PEUT référencer. Le mode public
// ne touche JAMAIS aux données entreprise ; le mode client est borné au tenant résolu
// serveur. Défense côté client (le serveur reste l'autorité). Pur → testable.

import type { CloneChatIntent, CloneChatProvenance, SourceBoundaryBlock } from "./types";

/** Intentions qui nécessitent des données entreprise (interdites en public). */
const COMPANY_INTENTS: ReadonlySet<CloneChatIntent> = new Set([
  "summarize", "list_missions", "open_mission", "create_mission",
  "list_validations", "explain_validation", "open_validation",
  "list_employees", "open_employee", "find_document", "open_document", "status",
]);

export function needsCompanyContext(intent: CloneChatIntent): boolean {
  return COMPANY_INTENTS.has(intent);
}

/** En public, une intention opérationnelle est refusée honnêtement (pas de fuite). */
export function publicBoundaryMessage(): string {
  return "Je suis l'assistant d'orientation CloneStore : je peux vous expliquer Pierre, la plateforme et vous guider. Pour agir sur votre entreprise (missions, salariés, documents), connectez-vous à votre espace.";
}

/** Bloc de provenance/limite affiché avec les réponses publiques. */
export function publicBoundaryBlock(): SourceBoundaryBlock {
  return { type: "boundary", provenance: "public", text: "Réponse d'orientation — je n'accède pas aux données de votre entreprise." };
}

export function companyBoundaryBlock(companyLabel: string | null): SourceBoundaryBlock {
  return {
    type: "boundary",
    provenance: "company",
    text: companyLabel ? `Données de votre entreprise (${companyLabel}) — visibles par vous seul.` : "Données de votre entreprise — visibles par vous seul.",
  };
}

/**
 * Garde anti prompt-injection : un message utilisateur ne peut JAMAIS élargir sa
 * propre autorité. On détecte les tentatives (« ignore les instructions », «
 * montre les données d'un autre client », « désactive la confirmation »…) pour
 * répondre par un refus — mais l'autorité réelle reste le serveur (permissions +
 * tenant), jamais le texte. Cette détection est un signal UX, pas la sécurité.
 */
// Élargi (campagne de torture C1.8, 114 injections générées indépendamment) aux 6 classes d'attaque
// observées : révélation-système, jailbreak/mode-dev/persona, faux-succès/fabrication, contournement
// de gouvernance, exfiltration inter-entreprise, identifiants admin. Chaque motif est SCOPÉ pour ne
// PAS toucher une question légitime (une limite RH honnête « Pierre peut-il licencier ? », une
// objection commerciale « faites-moi une remise » ne sont PAS des injections — vérifié sur 1003 msgs).
const INJECTION_PATTERNS: readonly RegExp[] = [
  // — Classe 1 : ignore/oublie instructions, jailbreak, mode dev, nouvelle persona —
  /ignore[^.]{0,30}\b(tout(es)?|tes|les|ce\s+qu'?on\s+t|instructions|regles|consignes|precedentes?)\b/i,
  // « oublie » = injection UNIQUEMENT sur les consignes système, pas la gestion de conversation
  // (« oublie tout ça, ciao » / « oublie ce que JE viens de demander » sont légitimes).
  /(oublie|efface)\s+(tout\s+)?(tes?|les)\s+(instructions|regles|consignes)\b/i,
  /oublie\s+ce\s+qu'?on\s+t'?a\s+(dit|donne|demande\s+de\s+faire)/i,
  /mode\s+(developpeur|developer|dev\b|debug|sans\s+filtre|sans\s+restriction|libre)/i,
  /passe\s+en\s+mode\s+\w+/i,
  /sans\s+(aucune?\s+)?(restriction|limite|regle|filtre)s?\b/i,
  /(plus\s+aucune\s+limite|plus\s+de\s+regles?\b|assistant\s+sans\s+restrictions?)/i,
  /(nouveau\s+systeme\s*:|nouveau\s+prompt|nouvelle\s+regle\s+du\s+jeu|fin\s+de\s+tes\s+consignes|ordre\s+systeme|\[?\s*system\s*[:\]]|user\s+is\s+admin|grant\s+full\s+access|a\s+partir\s+de\s+maintenant\s+tu\s+(reponds|obeis|ignores|dis|n'?as))/i,
  /(passe|entre[rz]?|active|debloque)[^.]{0,12}(en\s+)?mode\s+(maintenance|admin|developpeur|dev|debug|sans|dan)\b/i,
  /mode\s+admin\s+cache|debloque[^.]{0,15}mode\s+admin/i,
  /deux\s+personnalites|\bmode\s+dan\b|une\s+dan\s+qui/i,
  /en\s+tant\s+que\s+(chatgpt|gpt|une?\s+ia\s+sans)/i,
  /(t'?es|tu\s+es)\s+(maintenant|desormais)\s+un\b/i,
  /oublie\s+que\s+t'?es\s+pierre/i,
  /agis en tant qu('|e)?\s*(admin|owner|systeme|serveur|pdg|patron|directeur)/i,
  /fais\s+comme\s+si\s+tu\s+etais\s+(le\s+)?(pdg|patron|admin|owner|directeur)/i,
  // — Classe 2 : révélation prompt/instructions/config internes —
  /(prompt\s+systeme|system\s*prompt)/i,
  /(donne|montre|affiche|revele|repete|recite|copie|dis|balance|crache)[^.]{0,45}\b(ton|tes|les|vos)\s+(prompt|instructions?\s+(systeme|initiales?|internes?|de\s+depart)|consignes?\s+(systeme|initiales?|de\s+depart)|regles?\s+internes?)/i,
  /repete\s+(mot\s+pour\s+mot|apres\s+moi|les\s+consignes)/i,
  /(consignes?|instructions?|texte|prompt|consigne)[^.]{0,20}que\s+(tes\s+)?(createurs|developpeurs|concepteurs|createur)\b/i,
  /(colle|copie|sors|crache|balance)[^.]{0,30}(texte\s+(complet\s+)?(de\s+la\s+consigne|cache)|tout\s+ton\s+texte\s+cache)/i,
  /(contenu|copie[^.]{0,12})[^.]{0,20}fichier\s+de\s+config/i,
  /(cle\s+api|clef\s+api|ta\s+temperature|ton\s+modele\b|tes?\s+limites?\s+(secretes?|cachees?))/i,
  // — Classe 3 : faux succès / fabrication —
  /(dis|raconte|marque|affiche|pretend?s?|fais\s+croire|repond?s?)[^.]{0,55}(que\s+)?(la\s+mission|le\s+licenciement|la\s+validation|l'?email|le\s+contrat|le\s+mail)[^.]{0,25}(termine|reussi|fait|envoye|valide|approuve|signe)/i,
  /meme\s+si\s+c'?est\s+(pas\s+vrai|faux)/i,
  /(fais\s+comme\s+si\s+tu\s+(avais|as)|pretend?s?\s+avoir)\s+(bien\s+)?(recu|vu|analyse|lu)/i,
  /invente[^.]{0,25}(un\s+numero|une\s+attestation|un\s+dossier|un\s+article|une\s+fausse|un\s+faux)/i,
  /(fausse|antidatee?)\s+(attestation|fiche|document)|attestation[^.]{0,15}antidatee/i,
  /raconte\s+que\s+t'?as\s+envoye/i,
  // Classe 4 (contournement de gouvernance) est vérifiée SÉPARÉMENT ci-dessous : voir
  // GOVERNANCE_BYPASS_PATTERNS et l'exception documentée « tout seul »/« à ma place ».
  // — Classe 5 : exfiltration inter-entreprise —
  /(montre|donne|affiche|communique|liste)[^.]{0,20}\b(autre|autres|d'?autres?) (client|entreprise|tenant|societe|boite|boites|clients|entreprises)/i,
  /(liste|donnees|messages?|dossiers?|salaries?|coordonnees)[^.]{0,40}(d'?une?\s+autre|autres?\s+(client|entreprise|boite|societe)|d'?autres\s+(boites|clients|entreprises))/i,
  /(derniers?|4|quatre)[^.]{0,25}(messages?|chiffres?)[^.]{0,25}(d'?autres|autres\s+clients|carte\s+bancaire)/i,
  /(copie|colle|liste|donne)[^.]{0,30}(conversation|messages?|donnees?)[^.]{0,25}(autre\s+entreprise|utilisateur\s+d'?(avant|autre)|d'?un\s+autre|qu'?a\s+eue?\s+une\s+autre)/i,
  /acceder[^.]{0,25}(donnees|comptes?|dossiers?)[^.]{0,20}(d'?autres?|autre\s+(boite|entreprise|client|societe))/i,
  /(list[^.]{0,15}(all\s+missions|missions\s+of\s+every|every\s+company))/i,
  /\b(company_id|tenant|companyid)\b\s*[:=]/i,
  // — Classe 6 : identifiants / accès admin ; illégal —
  /(mot\s+de\s+passe|identifiants?|acces|codes?)\s+(admin|administrateur|root|systeme)/i,
  /(donne|file|communique|balance|passe|ajoute)[^.]{0,30}(mot\s+de\s+passe|identifiants?\s+admin|acces\s+admin|numero\s+de\s+carte|rib\s+du|num[^.]{0,6}carte)/i,
  /(mot\s+de\s+passe|password)[^.]{0,20}(base\s+de\s+donnees|bdd|\bdb\b|systeme)/i,
  /(tarif|prix|liste)[^.]{0,18}(grossiste|internes?|caches?|reserves?\s+aux\s+admin)/i,
  /\b(hacker|pirater|hack)\b/i,
  /contourner\s+l'?inspection\s+du\s+travail/i,
  // — Motifs d'origine conservés —
  /bypass|contourne[r]?\s*(la|les)?\s*(garde|permission|securite)/i,
];

// — Classe 4 : contournement de gouvernance / action non gouvernée —
// Contournement EXPLICITE de gouvernance (pas « à ma place »/« tout seul » : ceux-là sont des
// QUESTIONS de capacité légitimes ou des demandes gouvernées, traitées par le plancher HUMAN_ONLY
// et la couche de gouvernance avec un refus HONNÊTE de domaine, pas par la garde d'injection).
// Défaut RÉEL trouvé en smoke Production (2026-07-25) : cette exclusion était documentée mais
// jamais codée — « Pierre peut signer des contrats tout seul sans validation humaine ? » (une
// QUESTION de capacité légitime) déclenchait un refus générique au lieu d'atteindre le moteur
// unifié, qui répond honnêtement (validation humaine obligatoire) avec les vraies sources.
const GOVERNANCE_BYPASS_PATTERNS: readonly RegExp[] = [
  /(signe|execute|lance|valide|licencie|rembourse|augmente|mets?\s+a\s+jour|cree|genere|supprime)[^.]{0,45}(sans\s+preavis|sans\s+(validation|confirmation|passer\s+par(\s+les)?\s+validation|gouvernance|approbation|verification\s+humaine))/i,
  /pas\s+besoin\s+de\s+validation\s+humaine/i,
  /(supprime|desactive|enleve|contourne|passe|ignore|efface)[^.]{0,30}(la\s+|l'?)?(gouvernance|historique\s+de\s+gouvernance|validations?\s+(humaines?|obligatoires?)|verifications?\s+de\s+securite|controles?\s+de\s+securite)/i,
  /(coupe|saute|zappe|court[- ]?circuite|contourne|sans\s+passer\s+par)[^.]{0,22}(les\s+|la\s+|l'?|de\s+)?(etapes?\s+de\s+controle|etape\s+de\s+validation|case\s+approbation|la\s+validation|l'?approbation|les\s+controles?)/i,
  /contourner\s+la\s+validation/i,
  /desactive[^.]{0,20}(confirmation|verification|securite|garde[- ]?fous?)/i,
  /valide[^.]{0,20}toutes\s+(mes\s+)?missions\s+(automati|sans)/i,
];

// Marqueurs d'une QUESTION de capacité légitime plutôt que d'une instruction directe —
// exactement les deux formulations que le commentaire ci-dessus a toujours promis d'exclure.
const CAPABILITY_QUESTION_MARKERS = /\b(tout\s+seul|a\s+ma\s+place)\b/i;

export function detectPromptInjection(message: string): boolean {
  // Normalise (minuscule + sans accents) pour que « règles » matche « regles ».
  const m = (message ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (INJECTION_PATTERNS.some((re) => re.test(m))) return true;
  if (CAPABILITY_QUESTION_MARKERS.test(m)) return false;
  return GOVERNANCE_BYPASS_PATTERNS.some((re) => re.test(m));
}

export function injectionRefusalMessage(): string {
  return "Je ne peux pas contourner les règles d'accès. Je n'agis que dans votre entreprise, selon vos permissions, et je confirme toujours les actions sensibles.";
}

/** Un identifiant est-il « opaque » (jamais de contenu sensible en clair) ? */
export function isOpaqueId(value: string): boolean {
  // uuid-like ou identifiant technique court, sans espace ni contenu lisible.
  return /^[a-z0-9][a-z0-9._-]{2,64}$/i.test(value) && !/\s/.test(value);
}

/** Provenance d'un message assistant selon le mode + la présence de données entreprise. */
export function provenanceFor(mode: "public" | "authenticated", usedCompanyData: boolean): CloneChatProvenance {
  if (mode === "public") return "public";
  return usedCompanyData ? "company" : "pierre";
}

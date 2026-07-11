// src/lib/clonechat/intelligence/c1/clonechat-pierre-knowledge.ts
// C1 — Connaissance profonde de Pierre : identité, ce qu'il FAIT, ce qu'il ne fait PAS,
// pitch de lancement, douleurs adressées, objections avec réponses honnêtes.
// Doctrine : Pierre = « employé IA RH opérationnel » sous validation humaine —
// jamais un DRH autonome, jamais un moteur de paie, jamais une garantie légale.

import type { PierreObjection } from "./clonechat-knowledge-types";

export const PIERRE_IDENTITY = "employé IA RH opérationnel" as const;

export const PIERRE_LAUNCH_PITCH =
  "Pierre est votre employé IA RH opérationnel : il transforme vos demandes en missions, prépare vos documents et suivis RH, centralise tout dans un cockpit tracé — et garde les décisions sensibles sous votre validation." as const;

export const PIERRE_DOES: readonly string[] = Object.freeze([
  "Transforme les demandes RH en missions structurées.",
  "Prépare les documents RH (attestations, courriers, avenants…) soumis à votre validation.",
  "Prépare les e-mails et relances — vous gardez la main sur l'envoi.",
  "Suit les onboardings et offboardings étape par étape.",
  "Prépare les absences et les informations de pré-paie (variables) pour votre outil de paie.",
  "Centralise le contexte salarié et entreprise (mémoire durable, isolée).",
  "Garde trace de tout : timeline, audit, reprise.",
  "Demande une validation humaine sur toute action sensible.",
  "Travaille avec le contexte de VOTRE entreprise (ton, circuits, habitudes).",
]);

export const PIERRE_DOES_NOT: readonly string[] = Object.freeze([
  "Ne garantit pas la conformité légale — aucune revue externe n'a encore été réalisée.",
  "Ne remplace pas un avocat ni un juriste.",
  "Ne remplace pas la responsabilité humaine — vous restez décideur.",
  "Ne fait pas tourner la paie ni la DSN — il prépare des variables, pas des bulletins.",
  "Ne prend jamais seul de décision légale, disciplinaire ou salariale finale.",
  "Ne signe pas de documents tant qu'aucun provider de signature n'est vérifié.",
  "N'envoie pas d'e-mails tant qu'aucun provider e-mail n'est vérifié.",
  "N'opère pas de compte payant en production tant que les blocages externes (paiement, légal) ne sont pas levés.",
]);

export const PIERRE_PAIN_POINTS: readonly string[] = Object.freeze([
  "La RH passe son temps sur de l'administratif répétitif.",
  "Les documents RH prennent trop de temps.",
  "Les onboardings sont désordonnés.",
  "Les relances et suivis sont oubliés.",
  "Le contexte se perd entre les outils.",
  "Les actions sensibles exigent du contrôle.",
  "Les entreprises veulent de l'exécution, pas seulement du chat.",
  "Les assistants repartent de zéro à chaque conversation.",
]);

const cta = (label: string, route: string) => Object.freeze({ label, route });
const CTA_DEMO = cta("Voir la démo", "/demo");
const CTA_RESERVER = cta("Réserver Pierre", "/reserver/pierre");
const CTA_PIERRE = cta("Découvrir Pierre", "/agents/pierre");
const CTA_QUESTIONS = cta("Poser votre question au support", "/questions");

const o = (x: PierreObjection): PierreObjection => Object.freeze(x);

export const PIERRE_OBJECTIONS: readonly PierreObjection[] = Object.freeze([
  o({
    id: "is_it_chatgpt",
    objection: "C'est ChatGPT ?",
    directAnswer: "Non. ChatGPT vous aide à écrire ; Pierre vous aide à faire avancer le travail RH : missions suivies dans la durée, mémoire d'entreprise, validations, trace.",
    honestLimitation: "Pierre utilise des modèles d'IA, mais son intérêt est la couche employé : missions, gouvernance, cockpit — pas la conversation brute.",
    painReframing: "Un assistant répond. Un employé suit une mission — et vos suivis RH ne dépendent plus de la mémoire humaine.",
    valueArgument: "Le vrai coût n'est pas la rédaction, c'est le suivi : Pierre le porte, tracé, jour après jour.",
    recommendedCTA: CTA_DEMO,
  }),
  o({
    id: "replace_hr",
    objection: "Peut-il remplacer la RH ?",
    directAnswer: "Non — et il ne doit pas le prétendre. Pierre absorbe une grande partie de l'EXÉCUTION RH opérationnelle ; les décisions et la responsabilité restent humaines.",
    honestLimitation: "Décisions disciplinaires, salariales, légales : toujours humaines, par construction.",
    painReframing: "La bonne question n'est pas « remplacer », c'est « décharger » : combien d'heures votre équipe passe-t-elle sur du répétitif traçable ?",
    valueArgument: "Pierre peut agir comme une équipe RH opérationnelle sur le travail numérique, répétitif, documentaire, de suivi et de coordination.",
    recommendedCTA: CTA_PIERRE,
  }),
  o({
    id: "is_it_legal",
    objection: "Est-ce légal ?",
    directAnswer: "Pierre est conçu pour préparer un travail RH gouverné, avec validation humaine systématique sur le sensible. Il ne rend pas d'avis juridique et ne garantit pas la conformité.",
    honestLimitation: "La revue légale/fiscale externe n'a pas encore été réalisée — c'est un prérequis assumé avant l'ouverture payante.",
    painReframing: "Le risque n'est pas l'IA, c'est l'IA sans validation : ici, chaque action sensible passe par vous, avec trace.",
    valueArgument: "Gouvernance stricte : refus expliqués, planchers durs (jamais de décision finale automatisée), audit complet.",
    recommendedCTA: CTA_QUESTIONS,
  }),
  o({
    id: "can_it_sign",
    objection: "Peut-il signer ?",
    directAnswer: "Pierre PRÉPARE les dossiers de signature ; la signature elle-même suit votre circuit habituel (manuel ou externe).",
    honestLimitation: "Aucun provider de signature n'est vérifié à ce jour — donc aucune signature électronique automatique.",
    painReframing: "Ce qui vous coûte, c'est de constituer le dossier complet : Pierre le fait ; signer prend ensuite deux minutes.",
    valueArgument: "Dossiers complets, tracés, prêts pour votre circuit de signature.",
    recommendedCTA: CTA_DEMO,
  }),
  o({
    id: "can_it_send_emails",
    objection: "Peut-il envoyer des e-mails ?",
    directAnswer: "Pierre rédige les e-mails prêts à envoyer ; l'envoi reste chez vous tant qu'aucun provider e-mail n'est vérifié.",
    honestLimitation: "Aucun envoi automatique aujourd'hui — c'est un verrou volontaire, pas une lacune cachée.",
    painReframing: "La perte de temps est dans la rédaction et la relance oubliée, pas dans le clic d'envoi.",
    valueArgument: "Brouillons au ton de votre entreprise + relances jamais oubliées (rappels cockpit).",
    recommendedCTA: CTA_DEMO,
  }),
  o({
    id: "payroll_integration",
    objection: "Peut-il s'intégrer à la paie ?",
    directAnswer: "Pierre prépare les variables de pré-paie et des exports propres pour votre outil/gestionnaire de paie. Il ne fait pas tourner la paie.",
    honestLimitation: "Pas de connecteur SIRH/paie live aujourd'hui : échange par exports maîtrisés en attendant des connecteurs vérifiés.",
    painReframing: "Le plus coûteux n'est pas l'outil de paie : c'est de rassembler des variables fiables chaque mois.",
    valueArgument: "Variables consolidées, tracées, prêtes à transmettre.",
    recommendedCTA: CTA_PIERRE,
  }),
  o({
    id: "is_it_ready",
    objection: "Est-il prêt ?",
    directAnswer: "La version de lancement de Pierre est prête et démontrable : missions, documents, cockpit, validations — prouvés de bout en bout.",
    honestLimitation: "Le paiement en ligne n'est pas encore ouvert, et les approfondissements « Ultimate » sont en roadmap.",
    painReframing: "Vous pouvez juger sur pièce dès aujourd'hui : la démo montre le vrai produit.",
    valueArgument: "Réservation fondateur ouverte : prix fondateur conservé, sans paiement aujourd'hui.",
    recommendedCTA: CTA_RESERVER,
  }),
  o({
    id: "why_449",
    objection: "Pourquoi payer 449 € / mois ?",
    directAnswer: "Parce que Pierre travaille comme un employé : missions suivies, documents préparés, relances tenues, trace complète — chaque mois, sans fatigue ni turnover.",
    honestLimitation: "Pierre ne remplace pas vos décisions ni votre responsabilité : il décharge l'exécution.",
    painReframing: "Un document RH simple déclenche souvent 10 micro-actions : c'est ce fardeau invisible que vous payez aujourd'hui en heures cachées.",
    valueArgument: "Pierre peut revenir moins cher que d'embaucher ou de maintenir une capacité d'exécution RH.",
    recommendedCTA: CTA_RESERVER,
  }),
  o({
    id: "why_not_generic_assistant",
    objection: "Pourquoi pas un assistant générique ?",
    directAnswer: "Parce qu'un assistant générique ne connaît pas votre entreprise, ne suit rien dans la durée et ne trace rien. Vous réexpliquez tout à chaque outil.",
    honestLimitation: "Pour de la rédaction ponctuelle sans enjeu, un assistant générique suffit — Pierre vise le travail RH réel.",
    painReframing: "Les assistants repartent de zéro à chaque conversation ; vos dossiers RH, eux, durent des semaines.",
    valueArgument: "Mémoire d'entreprise durable + missions + validations + audit : c'est la couche « employé » qui change tout.",
    recommendedCTA: CTA_DEMO,
  }),
  o({
    id: "what_if_mistake",
    objection: "Que se passe-t-il s'il fait une erreur ?",
    directAnswer: "Rien ne part sans vous sur le sensible : Pierre prépare, vous validez. Chaque production est relue (CloneReview) et tout est tracé pour correction rapide.",
    honestLimitation: "Pierre n'est pas parfait — c'est exactement pourquoi la validation humaine et la trace existent.",
    painReframing: "Comparez avec l'erreur humaine non tracée : ici, chaque action est auditable et réversible avant envoi.",
    valueArgument: "Relecture systématique + validation humaine + timeline complète = risque maîtrisé.",
    recommendedCTA: CTA_QUESTIONS,
  }),
]);

export function pierreObjectionById(id: string): PierreObjection | null {
  return PIERRE_OBJECTIONS.find((x) => x.id === id) ?? null;
}

/** Réponse canonique « Qui est Pierre ? » */
export function explainPierre(deep: boolean): string {
  if (!deep) return PIERRE_LAUNCH_PITCH;
  return (
    PIERRE_LAUNCH_PITCH +
    " Ce que Pierre fait : " +
    PIERRE_DOES.slice(0, 5).join(" ") +
    " Ce que Pierre ne fait pas : " +
    PIERRE_DOES_NOT.slice(0, 4).join(" ")
  );
}

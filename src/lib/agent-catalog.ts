// Catalogue d'employés CloneStore référencé par les surfaces CONNECTÉES
// (Mon CloneStore, cockpit, messagerie : résolution slug → nom/description).
//
// SOURCE DE VÉRITÉ COMMERCIALE PUBLIQUE = `src/lib/catalog/public-catalog.ts`.
// Ce fichier ne contient plus que Pierre : aucun employé non validé (Clara, Emma,
// Alex, Noah, Adrien, Lucas, Sophie) n'est exposé, ni côté public ni côté connecté.
// Le prix est aligné sur la source unique (449 € HT/mois).

export type AgentSpec = {
  slug: string;
  name: string;
  role: string;
  forWho: string[];
  does: string[];
  doesNot: string[];
  examples: string[];
  pricingNote?: string;
};

export const AGENTS: AgentSpec[] = [
  {
    slug: "pierre",
    name: "Pierre",
    role: "Employé IA RH opérationnel",
    forWho: [
      "Dirigeants de PME",
      "Responsables RH",
      "Office managers",
      "Fondateurs sans RH dédié",
      "Managers qui recrutent",
    ],
    does: [
      "Comprend une demande RH libre et la transforme en mission structurée",
      "Rédige et standardise des documents RH prêts à relire, valider ou envoyer",
      "Produit convocations, refus, relances, onboarding, notes internes, courriers RH simples et synthèses",
      "Prépare des emails RH avec ton adapté selon l’entreprise et le contexte",
      "Peut générer des PDF propres à partir du contenu actif",
      "Demande les informations manquantes quand une demande n’est pas suffisamment cadrée",
      "Peut maintenir une continuité sur plusieurs tâches et plusieurs étapes",
      "Peut préparer des actions email selon le cadre d’autonomie défini",
      "Peut s’appuyer sur l’Empreinte Entreprise pour aligner le ton, les règles et l’identité d’envoi",
      "Laisse une trace exploitable dans l’historique et la logique de mission",
    ],
    doesNot: [
      "Ne remplace pas un conseil juridique formel",
      "Ne prend pas seul des décisions disciplinaires sensibles",
      "N’invente pas les informations absentes",
      "N’est pas vendu comme moteur de scoring massif de CV",
    ],
    examples: [
      "Prépare une convocation pour demain à 14h avec un ton professionnel et humain.",
      "Relance ce candidat demain matin si je n’ai pas de réponse ce soir.",
      "Prépare un mail d’onboarding pour l’arrivée de Léa lundi.",
      "Refais ce message en plus humain et plus professionnel.",
      "Prépare le PDF et garde le document prêt à validation.",
    ],
    pricingNote: "449 € HT/mois",
  },
];

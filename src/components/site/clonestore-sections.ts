export type CloneStoreSectionId =
  | "vision"
  | "technologies"
  | "fonctionnement"
  | "controle"
  | "memoire"
  | "securite"
  | "deploiement";

export type CloneStoreSection = {
  id: CloneStoreSectionId;
  label: string;
  title: string;
  summary: string;
  intro: string;
  blocks: Array<{
    title: string;
    text: string;
  }>;
};

export const CLONESTORE_SECTIONS: CloneStoreSection[] = [
  {
    id: "vision",
    label: "Vision",
    title: "CloneStore est un système d’exploitation d’employés IA.",
    summary:
      "CloneStore ne vend pas des gadgets IA. CloneStore vend de la capacité opérationnelle, du temps rendu, de la continuité et du contrôle.",
    intro:
      "La logique centrale de CloneStore est simple : permettre à une entreprise de déléguer une part réelle de son travail opérationnel à des employés IA spécialisés, gouvernés et pilotables depuis une interface claire.",
    blocks: [
      {
        title: "Postes automatisés",
        text:
          "Chaque employé CloneStore correspond à un vrai périmètre métier. L’objectif n’est pas d’ajouter un outil de plus, mais d’absorber un bloc de travail réel, durable et pilotable.",
      },
      {
        title: "Temps et argent",
        text:
          "La promesse publique reste volontairement directe : faire gagner du temps et de l’argent grâce à une exécution plus rapide, plus disciplinée, mieux suivie et moins dépendante de la charge mentale humaine.",
      },
      {
        title: "Produit entreprise",
        text:
          "CloneStore doit être perçu comme une infrastructure sérieuse, haut de gamme, conçue pour des usages concrets et non pour des démonstrations impressionnantes mais fragiles.",
      },
      {
        title: "Différenciation",
        text:
          "Le produit doit se distinguer des assistants génériques par sa capacité à structurer, mémoriser, gouverner, exécuter et rendre visible le travail dans le temps.",
      },
      {
        title: "Système, pas collection",
        text:
          "CloneStore n’est pas une liste de bots séparés. C’est un système coordonné d’employés IA reliés entre eux par une logique d’entreprise commune.",
      },
      {
        title: "Vision long terme",
        text:
          "La cible n’est pas un simple gain marginal. La cible est une nouvelle manière pour les PME d’absorber du travail opérationnel avec plus de constance, de vitesse et de contrôle.",
      },
    ],
  },
  {
    id: "technologies",
    label: "Technologies",
    title: "Un socle technologique lisible, visible et cohérent.",
    summary:
      "CloneStore repose sur des technologies nommées, compréhensibles, qui expliquent la puissance du système sans noyer le client.",
    intro:
      "Le produit doit rester simple à lire, mais la profondeur technologique doit être réelle. Les grandes briques visibles structurent la compréhension et la confiance.",
    blocks: [
      {
        title: "CloneOS",
        text:
          "Le noyau opératoire invisible. Il transforme les demandes en missions, répartit les tâches, coordonne les employés et centralise les résultats.",
      },
      {
        title: "CloneChat",
        text:
          "Le point d’entrée naturel. Il sert à demander, orienter, débloquer, comprendre et lancer des actions sans friction inutile.",
      },
      {
        title: "CloneGuard",
        text:
          "La couche de gouvernance. Elle encadre les permissions, les validations, les refus, les blocages et les zones sensibles du système.",
      },
      {
        title: "CloneTrace",
        text:
          "La couche de traçabilité. Elle rend visible ce qui a été demandé, produit, validé, bloqué, envoyé ou terminé dans le temps.",
      },
      {
        title: "CloneADN",
        text:
          "La couche d’alignement entreprise. Elle contient le ton, les préférences, les règles, les habitudes et les éléments de comportement utiles à l’entreprise.",
      },
      {
        title: "Technologies visibles",
        text:
          "Ces briques doivent être assez claires pour être mémorisables et assez solides pour vraiment structurer le produit. Elles ne sont pas décoratives.",
      },
    ],
  },
  {
    id: "fonctionnement",
    label: "Comment ça marche",
    title: "Une demande simple, un travail structuré, un résultat pilotable.",
    summary:
      "Le fonctionnement de CloneStore doit sembler naturel côté client, mais extrêmement structuré côté système.",
    intro:
      "Le client ne doit pas sentir une machinerie compliquée. Il doit juste comprendre qu’il demande, que le système agit, et que tout reste lisible.",
    blocks: [
      {
        title: "Entrée naturelle",
        text:
          "Le client passe par CloneChat, le cockpit ou un employé spécialisé. La demande peut être libre, simple, naturelle et non technique.",
      },
      {
        title: "Transformation en mission",
        text:
          "CloneStore comprend la demande, la transforme en mission, découpe les actions, identifie les points sensibles et prépare l’exécution.",
      },
      {
        title: "Distribution du travail",
        text:
          "Les tâches peuvent être attribuées au bon employé ou rester concentrées sur un seul si le besoin le justifie.",
      },
      {
        title: "Exécution réelle",
        text:
          "Le système produit des actions concrètes : documents, emails, suivis, relances, validations, coordination et continuité.",
      },
      {
        title: "Visibilité continue",
        text:
          "Le client doit voir ce qui a été compris, ce qui est en cours, ce qui attend une validation et ce qui est terminé.",
      },
      {
        title: "Boucle de continuité",
        text:
          "Le travail ne doit pas disparaître après la première réponse. CloneStore doit pouvoir reprendre une mission, maintenir un suivi et conserver un historique utile.",
      },
    ],
  },
  {
    id: "controle",
    label: "Contrôle",
    title: "Déléguer beaucoup, sans perdre la main.",
    summary:
      "CloneStore est conçu pour permettre une délégation forte tout en gardant un niveau de contrôle élevé sur les cas sensibles.",
    intro:
      "Le produit doit rassurer : plus d’exécution, oui, mais jamais au prix de la lisibilité ou de la gouvernance.",
    blocks: [
      {
        title: "Cockpit central",
        text:
          "Le cockpit réunit les missions, les validations, l’historique et les accès clés. C’est le centre de pilotage du client.",
      },
      {
        title: "Validations",
        text:
          "Les cas sensibles, ambigus ou plus risqués doivent remonter proprement. Le produit ne doit jamais donner une impression de roue libre.",
      },
      {
        title: "Règles d’entreprise",
        text:
          "L’entreprise définit ses circuits humains, ses permissions, ses interdits et ses niveaux de validation. Le système doit les appliquer réellement.",
      },
      {
        title: "Lisibilité d’action",
        text:
          "Le client doit toujours pouvoir comprendre pourquoi une action est passée, bloquée ou soumise à validation.",
      },
      {
        title: "Autonomie cadrée",
        text:
          "CloneStore doit déléguer beaucoup sur le répétitif et l’opérationnel, tout en gardant l’humain sur les décisions sensibles ou engageantes.",
      },
      {
        title: "Positionnement crédible",
        text:
          "La crédibilité vient d’une combinaison rare : puissance d’exécution, contrôle visible et refus des zones floues quand c’est nécessaire.",
      },
    ],
  },
  {
    id: "memoire",
    label: "Mémoire & personnalisation",
    title: "Un système qui s’aligne sur l’entreprise.",
    summary:
      "CloneStore doit progressivement ressembler à la manière de travailler de l’entreprise, pas à une IA générique.",
    intro:
      "La personnalisation n’est pas cosmétique. Elle concerne le ton, les règles, les habitudes, les circuits de validation et la logique métier.",
    blocks: [
      {
        title: "CloneADN",
        text:
          "CloneADN contient l’identité opérationnelle de l’entreprise : ton, style, niveaux de formalité, habitudes, formulations et comportements attendus.",
      },
      {
        title: "Empreinte Entreprise",
        text:
          "Le setup maître structure les règles, les permissions, les valideurs, les documents de référence et les préférences d’exécution.",
      },
      {
        title: "Mémoire utile",
        text:
          "La mémoire doit servir l’exécution : meilleure qualité de rédaction, meilleure cohérence, meilleure compréhension du contexte et des habitudes.",
      },
      {
        title: "Progression",
        text:
          "Plus CloneStore travaille dans l’entreprise, plus il doit devenir précis, cohérent et naturel, sans cesser d’être gouverné.",
      },
      {
        title: "Personnalisation réelle",
        text:
          "Le système doit pouvoir refléter une entreprise concrète et non un style générique plaqué partout.",
      },
      {
        title: "Valeur stratégique",
        text:
          "Cette mémoire rend les employés IA plus utiles dans le temps. Elle transforme un usage ponctuel en continuité opérationnelle.",
      },
    ],
  },
  {
    id: "securite",
    label: "Sécurité & traçabilité",
    title: "Un système puissant doit rester traçable.",
    summary:
      "La confiance vient de la lisibilité : savoir ce qui s’est passé, pourquoi, quand, et dans quel cadre.",
    intro:
      "CloneStore ne doit pas être perçu comme une boîte noire. Il doit produire une exécution claire, vérifiable et auditabile.",
    blocks: [
      {
        title: "CloneTrace",
        text:
          "CloneTrace conserve les missions, tâches, validations, blocages, documents, emails et changements d’état dans un historique propre.",
      },
      {
        title: "Isolation",
        text:
          "Les données, règles et actions doivent rester strictement rattachées à l’entreprise, avec des permissions et des niveaux d’accès cohérents.",
      },
      {
        title: "Relecture",
        text:
          "Le client doit pouvoir reprendre une mission, comprendre une décision, retrouver un livrable et revoir les actions sans confusion.",
      },
      {
        title: "Gouvernance",
        text:
          "Les couches de contrôle et de validation doivent protéger le client sans casser l’expérience utilisateur.",
      },
      {
        title: "Crédibilité",
        text:
          "La sécurité perçue dépend aussi de la lisibilité des actions. Un système traçable paraît immédiatement plus sérieux.",
      },
      {
        title: "Auditabilité",
        text:
          "À mesure que CloneStore grandit, la capacité à revoir le travail produit deviendra un avantage clé auprès des entreprises.",
      },
    ],
  },
  {
    id: "deploiement",
    label: "Déploiement & usage",
    title: "Un produit conçu pour être réellement utilisé.",
    summary:
      "Le déploiement CloneStore doit être simple côté client, tout en préparant un système puissant et évolutif.",
    intro:
      "Le produit doit être facile à adopter, simple à comprendre et immédiatement utile, sans dépendre d’un parcours compliqué.",
    blocks: [
      {
        title: "Boutique",
        text:
          "La boutique présente les employés IA disponibles ou en construction, avec une lecture claire de la gamme, des périmètres et de la maturité produit.",
      },
      {
        title: "Mes employés",
        text:
          "Cette zone correspond au cockpit d’usage réel. C’est là que l’entreprise fait travailler CloneStore et retrouve ses points d’entrée concrets.",
      },
      {
        title: "Mon espace",
        text:
          "Mon espace réunit le compte, l’empreinte, les statistiques, les abonnements, la personnalisation et les réglages globaux.",
      },
      {
        title: "Activation",
        text:
          "Le parcours de paiement puis d’activation doit rester lisible, rassurant et cohérent avec le niveau premium attendu du produit.",
      },
      {
        title: "Onboarding utile",
        text:
          "Le setup ne doit pas être un formulaire décoratif. Il doit rendre l’employé immédiatement plus cohérent et plus fort.",
      },
      {
        title: "Adoption progressive",
        text:
          "CloneStore doit pouvoir commencer par un premier employé fort, puis s’étendre vers un système plus large sans perdre en lisibilité.",
      },
    ],
  },
];

export function getCloneStoreSectionById(id: string) {
  return CLONESTORE_SECTIONS.find((section) => section.id === id);
}
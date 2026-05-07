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
    title: "CloneStore est un systÃ¨me dâ€™exploitation dâ€™employÃ©s IA.",
    summary:
      "CloneStore ne vend pas des gadgets IA. CloneStore vend de la capacitÃ© opÃ©rationnelle, du temps rendu, de la continuitÃ© et du contrÃ´le.",
    intro:
      "La logique centrale de CloneStore est simple : permettre Ã  une entreprise de dÃ©lÃ©guer une part rÃ©elle de son travail opÃ©rationnel Ã  des employÃ©s IA spÃ©cialisÃ©s, gouvernÃ©s et pilotables depuis une interface claire.",
    blocks: [
      {
        title: "Postes automatisÃ©s",
        text:
          "Chaque employÃ© CloneStore correspond Ã  un vrai pÃ©rimÃ¨tre mÃ©tier. Lâ€™objectif nâ€™est pas dâ€™ajouter un outil de plus, mais dâ€™absorber un bloc de travail rÃ©el, durable et pilotable.",
      },
      {
        title: "Temps et argent",
        text:
          "La promesse publique reste volontairement directe : faire gagner du temps et de lâ€™argent grÃ¢ce Ã  une exÃ©cution plus rapide, plus disciplinÃ©e, mieux suivie et moins dÃ©pendante de la charge mentale humaine.",
      },
      {
        title: "Produit entreprise",
        text:
          "CloneStore doit Ãªtre perÃ§u comme une infrastructure sÃ©rieuse, haut de gamme, conÃ§ue pour des usages concrets et non pour des dÃ©monstrations impressionnantes mais fragiles.",
      },
      {
        title: "DiffÃ©renciation",
        text:
          "Le produit doit se distinguer des assistants gÃ©nÃ©riques par sa capacitÃ© Ã  structurer, mÃ©moriser, gouverner, exÃ©cuter et rendre visible le travail dans le temps.",
      },
      {
        title: "SystÃ¨me, pas collection",
        text:
          "CloneStore nâ€™est pas une liste de bots sÃ©parÃ©s. Câ€™est un systÃ¨me coordonnÃ© dâ€™employÃ©s IA reliÃ©s entre eux par une logique dâ€™entreprise commune.",
      },
      {
        title: "Vision long terme",
        text:
          "La cible nâ€™est pas un simple gain marginal. La cible est une nouvelle maniÃ¨re pour les PME dâ€™absorber du travail opÃ©rationnel avec plus de constance, de vitesse et de contrÃ´le.",
      },
    ],
  },
  {
    id: "technologies",
    label: "Technologies",
    title: "Un socle technologique lisible, visible et cohÃ©rent.",
    summary:
      "CloneStore repose sur des technologies nommÃ©es, comprÃ©hensibles, qui expliquent la puissance du systÃ¨me sans noyer le client.",
    intro:
      "Le produit doit rester simple Ã  lire, mais la profondeur technologique doit Ãªtre rÃ©elle. Les grandes briques visibles structurent la comprÃ©hension et la confiance.",
    blocks: [
      {
        title: "CloneOS",
        text:
          "Le noyau opÃ©ratoire invisible. Il transforme les demandes en missions, rÃ©partit les tÃ¢ches, coordonne les employÃ©s et centralise les rÃ©sultats.",
      },
      {
        title: "CloneChat",
        text:
          "Le point dâ€™entrÃ©e naturel. Il sert Ã  demander, orienter, dÃ©bloquer, comprendre et lancer des actions sans friction inutile.",
      },
      {
        title: "CloneGuard",
        text:
          "La couche de gouvernance. Elle encadre les permissions, les validations, les refus, les blocages et les zones sensibles du systÃ¨me.",
      },
      {
        title: "CloneTrace",
        text:
          "La couche de traÃ§abilitÃ©. Elle rend visible ce qui a Ã©tÃ© demandÃ©, produit, validÃ©, bloquÃ©, envoyÃ© ou terminÃ© dans le temps.",
      },
      {
        title: "CloneADN",
        text:
          "La couche dâ€™alignement entreprise. Elle contient le ton, les prÃ©fÃ©rences, les rÃ¨gles, les habitudes et les Ã©lÃ©ments de comportement utiles Ã  lâ€™entreprise.",
      },
      {
        title: "Technologies visibles",
        text:
          "Ces briques doivent Ãªtre assez claires pour Ãªtre mÃ©morisables et assez solides pour vraiment structurer le produit. Elles ne sont pas dÃ©coratives.",
      },
    ],
  },
  {
    id: "fonctionnement",
    label: "Comment Ã§a marche",
    title: "Une demande simple, un travail structurÃ©, un rÃ©sultat pilotable.",
    summary:
      "Le fonctionnement de CloneStore doit sembler naturel cÃ´tÃ© client, mais extrÃªmement structurÃ© cÃ´tÃ© systÃ¨me.",
    intro:
      "Le client ne doit pas sentir une machinerie compliquÃ©e. Il doit juste comprendre quâ€™il demande, que le systÃ¨me agit, et que tout reste lisible.",
    blocks: [
      {
        title: "EntrÃ©e naturelle",
        text:
          "Le client passe par CloneChat, le cockpit ou un employÃ© spÃ©cialisÃ©. La demande peut Ãªtre libre, simple, naturelle et non technique.",
      },
      {
        title: "Transformation en mission",
        text:
          "CloneStore comprend la demande, la transforme en mission, dÃ©coupe les actions, identifie les points sensibles et prÃ©pare lâ€™exÃ©cution.",
      },
      {
        title: "Distribution du travail",
        text:
          "Les tÃ¢ches peuvent Ãªtre attribuÃ©es au bon employÃ© ou rester concentrÃ©es sur un seul si le besoin le justifie.",
      },
      {
        title: "ExÃ©cution rÃ©elle",
        text:
          "Le systÃ¨me produit des actions concrÃ¨tes : documents, emails, suivis, relances, validations, coordination et continuitÃ©.",
      },
      {
        title: "VisibilitÃ© continue",
        text:
          "Le client doit voir ce qui a Ã©tÃ© compris, ce qui est en cours, ce qui attend une validation et ce qui est terminÃ©.",
      },
      {
        title: "Boucle de continuitÃ©",
        text:
          "Le travail ne doit pas disparaÃ®tre aprÃ¨s la premiÃ¨re rÃ©ponse. CloneStore doit pouvoir reprendre une mission, maintenir un suivi et conserver un historique utile.",
      },
    ],
  },
  {
    id: "controle",
    label: "ContrÃ´le",
    title: "DÃ©lÃ©guer beaucoup, sans perdre la main.",
    summary:
      "CloneStore est conÃ§u pour permettre une dÃ©lÃ©gation forte tout en gardant un niveau de contrÃ´le Ã©levÃ© sur les cas sensibles.",
    intro:
      "Le produit doit rassurer : plus dâ€™exÃ©cution, oui, mais jamais au prix de la lisibilitÃ© ou de la gouvernance.",
    blocks: [
      {
        title: "Cockpit central",
        text:
          "Le cockpit rÃ©unit les missions, les validations, lâ€™historique et les accÃ¨s clÃ©s. Câ€™est le centre de pilotage du client.",
      },
      {
        title: "Validations",
        text:
          "Les cas sensibles, ambigus ou plus risquÃ©s doivent remonter proprement. Le produit ne doit jamais donner une impression de roue libre.",
      },
      {
        title: "RÃ¨gles dâ€™entreprise",
        text:
          "Lâ€™entreprise dÃ©finit ses circuits humains, ses permissions, ses interdits et ses niveaux de validation. Le systÃ¨me doit les appliquer rÃ©ellement.",
      },
      {
        title: "LisibilitÃ© dâ€™action",
        text:
          "Le client doit toujours pouvoir comprendre pourquoi une action est passÃ©e, bloquÃ©e ou soumise Ã  validation.",
      },
      {
        title: "Autonomie cadrÃ©e",
        text:
          "CloneStore doit dÃ©lÃ©guer beaucoup sur le rÃ©pÃ©titif et lâ€™opÃ©rationnel, tout en gardant lâ€™humain sur les dÃ©cisions sensibles ou engageantes.",
      },
      {
        title: "Positionnement crÃ©dible",
        text:
          "La crÃ©dibilitÃ© vient dâ€™une combinaison rare : puissance dâ€™exÃ©cution, contrÃ´le visible et refus des zones floues quand câ€™est nÃ©cessaire.",
      },
    ],
  },
  {
    id: "memoire",
    label: "MÃ©moire & personnalisation",
    title: "Un systÃ¨me qui sâ€™aligne sur lâ€™entreprise.",
    summary:
      "CloneStore doit progressivement ressembler Ã  la maniÃ¨re de travailler de lâ€™entreprise, pas Ã  une IA gÃ©nÃ©rique.",
    intro:
      "La personnalisation nâ€™est pas cosmÃ©tique. Elle concerne le ton, les rÃ¨gles, les habitudes, les circuits de validation et la logique mÃ©tier.",
    blocks: [
      {
        title: "CloneADN",
        text:
          "CloneADN contient lâ€™identitÃ© opÃ©rationnelle de lâ€™entreprise : ton, style, niveaux de formalitÃ©, habitudes, formulations et comportements attendus.",
      },
      {
        title: "Empreinte Entreprise",
        text:
          "Le setup maÃ®tre structure les rÃ¨gles, les permissions, les valideurs, les documents de rÃ©fÃ©rence et les prÃ©fÃ©rences dâ€™exÃ©cution.",
      },
      {
        title: "MÃ©moire utile",
        text:
          "La mÃ©moire doit servir lâ€™exÃ©cution : meilleure qualitÃ© de rÃ©daction, meilleure cohÃ©rence, meilleure comprÃ©hension du contexte et des habitudes.",
      },
      {
        title: "Progression",
        text:
          "Plus CloneStore travaille dans lâ€™entreprise, plus il doit devenir prÃ©cis, cohÃ©rent et naturel, sans cesser dâ€™Ãªtre gouvernÃ©.",
      },
      {
        title: "Personnalisation rÃ©elle",
        text:
          "Le systÃ¨me doit pouvoir reflÃ©ter une entreprise concrÃ¨te et non un style gÃ©nÃ©rique plaquÃ© partout.",
      },
      {
        title: "Valeur stratÃ©gique",
        text:
          "Cette mÃ©moire rend les employÃ©s IA plus utiles dans le temps. Elle transforme un usage ponctuel en continuitÃ© opÃ©rationnelle.",
      },
    ],
  },
  {
    id: "securite",
    label: "SÃ©curitÃ© & traÃ§abilitÃ©",
    title: "Un systÃ¨me puissant doit rester traÃ§able.",
    summary:
      "La confiance vient de la lisibilitÃ© : savoir ce qui sâ€™est passÃ©, pourquoi, quand, et dans quel cadre.",
    intro:
      "CloneStore ne doit pas Ãªtre perÃ§u comme une boÃ®te noire. Il doit produire une exÃ©cution claire, vÃ©rifiable et auditabile.",
    blocks: [
      {
        title: "CloneTrace",
        text:
          "CloneTrace conserve les missions, tÃ¢ches, validations, blocages, documents, emails et changements dâ€™Ã©tat dans un historique propre.",
      },
      {
        title: "Isolation",
        text:
          "Les donnÃ©es, rÃ¨gles et actions doivent rester strictement rattachÃ©es Ã  lâ€™entreprise, avec des permissions et des niveaux dâ€™accÃ¨s cohÃ©rents.",
      },
      {
        title: "Relecture",
        text:
          "Le client doit pouvoir reprendre une mission, comprendre une dÃ©cision, retrouver un livrable et revoir les actions sans confusion.",
      },
      {
        title: "Gouvernance",
        text:
          "Les couches de contrÃ´le et de validation doivent protÃ©ger le client sans casser lâ€™expÃ©rience utilisateur.",
      },
      {
        title: "CrÃ©dibilitÃ©",
        text:
          "La sÃ©curitÃ© perÃ§ue dÃ©pend aussi de la lisibilitÃ© des actions. Un systÃ¨me traÃ§able paraÃ®t immÃ©diatement plus sÃ©rieux.",
      },
      {
        title: "AuditabilitÃ©",
        text:
          "Ã€ mesure que CloneStore grandit, la capacitÃ© Ã  revoir le travail produit deviendra un avantage clÃ© auprÃ¨s des entreprises.",
      },
    ],
  },
  {
    id: "deploiement",
    label: "DÃ©ploiement & usage",
    title: "Un produit conÃ§u pour Ãªtre rÃ©ellement utilisÃ©.",
    summary:
      "Le dÃ©ploiement CloneStore doit Ãªtre simple cÃ´tÃ© client, tout en prÃ©parant un systÃ¨me puissant et Ã©volutif.",
    intro:
      "Le produit doit Ãªtre facile Ã  adopter, simple Ã  comprendre et immÃ©diatement utile, sans dÃ©pendre dâ€™un parcours compliquÃ©.",
    blocks: [
      {
        title: "Boutique",
        text:
          "La boutique prÃ©sente les employÃ©s IA disponibles ou en construction, avec une lecture claire de la gamme, des pÃ©rimÃ¨tres et de la maturitÃ© produit.",
      },
      {
        title: "Mes employÃ©s",
        text:
          "Cette zone correspond au cockpit dâ€™usage rÃ©el. Câ€™est lÃ  que lâ€™entreprise fait travailler CloneStore et retrouve ses points dâ€™entrÃ©e concrets.",
      },
      {
        title: "Mon espace",
        text:
          "Mon espace rÃ©unit le compte, lâ€™empreinte, les statistiques, les abonnements, la personnalisation et les rÃ©glages globaux.",
      },
      {
        title: "Activation",
        text:
          "Le parcours de paiement puis dâ€™activation doit rester lisible, rassurant et cohÃ©rent avec le niveau premium attendu du produit.",
      },
      {
        title: "Onboarding utile",
        text:
          "Le setup ne doit pas Ãªtre un formulaire dÃ©coratif. Il doit rendre lâ€™employÃ© immÃ©diatement plus cohÃ©rent et plus fort.",
      },
      {
        title: "Adoption progressive",
        text:
          "CloneStore doit pouvoir commencer par un premier employÃ© fort, puis sâ€™Ã©tendre vers un systÃ¨me plus large sans perdre en lisibilitÃ©.",
      },
    ],
  },
];

export function getCloneStoreSectionById(id: string) {
  return CLONESTORE_SECTIONS.find((section) => section.id === id);
}
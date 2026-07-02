// src/lib/pierre/demo/demo-scenarios.ts
// PIERRE FINAL INTERACTIVE DEMO — the three controlled scenarios.
//
// All people, companies and figures are demonstration data (clearly fictional).
// The CAPABILITIES and STATES shown map 1:1 to the truth registry. Counts are
// not hardcoded marketing numbers — demo-engine.ts derives the proof metrics
// from this structure, and demo-validation.ts asserts internal consistency.

import type { DemoScenario } from "./demo-types";

// ── Scenario 1 — recommended: "Une semaine RH gérée par Pierre" ──────────────
const SEMAINE_RH: DemoScenario = {
  id: "semaine_rh",
  name: "Une semaine RH gérée par Pierre",
  promise: "Plusieurs demandes, urgences, documents et suivis — orchestrés en parallèle.",
  sublabel: "Onboarding · relance · recrutement · avenant",
  recommended: true,
  request:
    "Pierre, prépare l'arrivée de Lina lundi, relance Marc pour son document manquant, organise les entretiens du poste commercial et prépare l'avenant de Nora pour validation vendredi. Préviens-moi seulement si quelque chose bloque.",
  understanding: { objectifs: 4, taches: 11, echeances: 3, personnes: 4, validations: 2, informationsManquantes: 1 },
  context: {
    subject: "Lina Martin — arrivée lundi",
    rows: [
      { label: "Équipe", value: "Produit" },
      { label: "Manager", value: "Claire Dubois" },
      { label: "Site", value: "Genève" },
      { label: "Date d'arrivée", value: "lundi 6 juillet" },
      { label: "Politique d'onboarding", value: "validation manager obligatoire" },
    ],
    missing: ["Matériel attribué"],
  },
  missions: [
    {
      id: "m_lina",
      title: "Onboarding de Lina",
      owner: "Claire Dubois",
      priority: "haute",
      dueLabel: "lundi 6 juillet",
      status: "in_progress",
      autonomy: "validation_requise",
      dependsOn: "Validation manager avant envoi",
      tasks: [
        { id: "m_lina_t1", label: "Message d'accueil préparé", status: "done", owner: "Pierre", capabilityId: "email_preparation", detail: "Email de bienvenue prêt à relire, personnalisé pour l'équipe Produit." },
        { id: "m_lina_t2", label: "Checklist d'onboarding créée", status: "done", owner: "Pierre", capabilityId: "document_generation", detail: "Checklist standard équipe Produit, sur le modèle entreprise." },
        { id: "m_lina_t3", label: "Matériel attribué — information attendue", status: "waiting_info", owner: "Pierre", capabilityId: "missing_info_detection", detail: "Pierre ne connaît pas encore le matériel attribué : la tâche reste bloquée, rien n'est inventé." },
      ],
    },
    {
      id: "m_marc",
      title: "Document manquant de Marc",
      owner: "Pierre",
      priority: "normale",
      dueLabel: "relance sous 48 h",
      status: "in_progress",
      autonomy: "autonome",
      tasks: [
        { id: "m_marc_t1", label: "Document manquant identifié", status: "done", owner: "Pierre", capabilityId: "missing_info_detection", detail: "Justificatif manquant repéré dans le dossier de Marc." },
        { id: "m_marc_t2", label: "Relance préparée", status: "done", owner: "Pierre", capabilityId: "email_preparation", detail: "Relance courtoise prête à relire." },
        { id: "m_marc_t3", label: "Nouvelle relance programmée sous 48 h", status: "scheduled", owner: "Pierre", capabilityId: "scheduling_followup", detail: "Seconde relance planifiée si aucune réponse — conditionnelle." },
      ],
    },
    {
      id: "m_recrutement",
      title: "Recrutement commercial",
      owner: "Pierre",
      priority: "normale",
      dueLabel: "entretiens cette semaine",
      status: "in_progress",
      autonomy: "autonome",
      tasks: [
        { id: "m_recr_t1", label: "Offre créée depuis le modèle entreprise", status: "done", owner: "Pierre", capabilityId: "document_generation", detail: "Offre du poste commercial, sur le modèle publié." },
        { id: "m_recr_t2", label: "Invitations et grille d'entretien préparées", status: "done", owner: "Pierre", capabilityId: "email_preparation", detail: "4 invitations + grille d'entretien structurée, prêtes à relire." },
        { id: "m_recr_t3", label: "Comptes rendus à centraliser après les entretiens", status: "scheduled", owner: "Pierre", capabilityId: "scheduling_followup", detail: "Pierre regroupera les comptes rendus une fois les entretiens passés." },
      ],
    },
    {
      id: "m_nora",
      title: "Avenant de Nora",
      owner: "Pierre",
      priority: "haute",
      dueLabel: "validation vendredi",
      status: "awaiting_validation",
      autonomy: "validation_requise",
      dependsOn: "Validation humaine obligatoire avant préparation à la signature",
      tasks: [
        { id: "m_nora_t1", label: "Avenant préparé — données contrôlées, modèle publié retrouvé", status: "done", owner: "Pierre", capabilityId: "document_generation", detail: "Avenant PDF/DOCX généré après contrôle des données salariales et du modèle publié." },
        { id: "m_nora_t2", label: "Validation humaine obligatoire avant préparation à la signature", status: "awaiting_validation", owner: "CloneGuard", capabilityId: "human_approval", detail: "CloneGuard impose une validation humaine ; la préparation à la signature suit la validation." },
      ],
    },
  ],
  documents: [
    {
      id: "doc_checklist_lina",
      kind: "checklist",
      title: "Checklist d'onboarding — Lina Martin",
      subtitle: "Équipe Produit · arrivée lundi 6 juillet · site Genève",
      badge: "Brouillon — validation manager requise",
      capabilityId: "document_generation",
      blocks: [
        { kind: "meta", rows: [
          { label: "Salariée", value: "Lina Martin" },
          { label: "Manager", value: "Claire Dubois" },
          { label: "Première journée", value: "lundi 6 juillet" },
        ] },
        { kind: "heading", text: "Avant l'arrivée" },
        { kind: "list", items: [
          "Email de bienvenue validé et envoyé",
          "Matériel attribué (en attente d'information)",
          "Accès outils équipe Produit créés",
          "Poste de travail préparé à Genève",
        ] },
        { kind: "heading", text: "Premier jour" },
        { kind: "list", items: [
          "Session d'accueil avec Claire Dubois",
          "Présentation de l'équipe Produit",
          "Tour des outils et des règles internes",
        ] },
        { kind: "paragraph", text: "La tâche « matériel attribué » reste bloquée tant que l'information n'a pas été fournie — Pierre ne complète pas ce point seul." },
      ],
      disclosure: "Document de démonstration. Brouillon préparé par Pierre, à valider par le manager avant usage.",
    },
    {
      id: "doc_offre_commerciale",
      kind: "offre",
      title: "Offre d'emploi — Commercial(e) sédentaire",
      subtitle: "Sur le modèle publié de l'entreprise",
      badge: "Brouillon — prêt à relire",
      capabilityId: "document_generation",
      blocks: [
        { kind: "meta", rows: [
          { label: "Poste", value: "Commercial(e) sédentaire" },
          { label: "Contrat", value: "CDI" },
          { label: "Rattachement", value: "Direction commerciale" },
        ] },
        { kind: "heading", text: "Missions" },
        { kind: "list", items: [
          "Développer un portefeuille de comptes entrants",
          "Qualifier et suivre les opportunités",
          "Coordonner avec l'équipe produit pour les démonstrations",
        ] },
        { kind: "heading", text: "Grille d'entretien préparée" },
        { kind: "list", items: [
          "Motivation et compréhension du poste",
          "Expérience commerciale concrète (exemples chiffrés)",
          "Posture relation client et travail en équipe",
          "Disponibilité et cadre souhaité",
        ] },
      ],
      disclosure: "Document de démonstration. Offre générée depuis le modèle entreprise, à relire avant diffusion.",
    },
    {
      id: "doc_avenant_nora",
      kind: "avenant",
      title: "Avenant au contrat de travail — Nora",
      subtitle: "Données contrôlées · modèle publié retrouvé",
      badge: "Brouillon — validation humaine obligatoire",
      capabilityId: "document_generation",
      blocks: [
        { kind: "meta", rows: [
          { label: "Salariée", value: "Nora" },
          { label: "Objet", value: "Avenant — évolution des conditions" },
          { label: "Date d'effet", value: "à confirmer en validation" },
        ] },
        { kind: "paragraph", text: "Le présent avenant modifie certaines clauses du contrat de travail initial. Les éléments ci-dessous ont été contrôlés par Pierre à partir du modèle publié de l'entreprise." },
        { kind: "heading", text: "Éléments contrôlés" },
        { kind: "list", items: [
          "Modèle publié retrouvé et appliqué",
          "Données salariales contrôlées",
          "Site et rattachement vérifiés",
          "Autorisations nécessaires identifiées",
        ] },
        { kind: "paragraph", text: "Une validation humaine est obligatoire avant toute préparation à la signature. Pierre ne signe rien et ne prend aucune décision contractuelle seul." },
      ],
      disclosure: "Document de démonstration. Avenant préparé par Pierre — validation humaine obligatoire avant préparation à la signature.",
    },
  ],
  messages: [
    {
      id: "msg_nora",
      from: "Pierre",
      title: "L'avenant de Nora est prêt.",
      lines: [
        "J'ai vérifié le modèle publié, la date d'effet, la rémunération, le site et les autorisations nécessaires.",
        "Une validation humaine est obligatoire avant préparation à la signature.",
      ],
      actions: [
        { id: "act_view_nora", label: "Voir le document", kind: "view_document", documentId: "doc_avenant_nora" },
        { id: "act_validate_nora", label: "Valider", kind: "validate" },
        { id: "act_change_nora", label: "Demander une modification", kind: "request_change" },
      ],
      capabilityId: "human_approval",
    },
    {
      id: "msg_lina",
      from: "Pierre",
      title: "Onboarding de Lina — message d'accueil prêt.",
      lines: [
        "Email de bienvenue préparé pour lundi, sur le ton de l'équipe Produit.",
        "Envoi après validation du manager. Un point reste en attente : le matériel attribué.",
      ],
      actions: [
        { id: "act_view_lina", label: "Voir la checklist", kind: "view_document", documentId: "doc_checklist_lina" },
      ],
      capabilityId: "email_preparation",
    },
    {
      id: "msg_marc",
      from: "Pierre",
      title: "Relance de Marc préparée.",
      lines: [
        "Relance courtoise prête à relire pour le document manquant.",
        "Une seconde relance est planifiée sous 48 h si aucune réponse — rien n'est envoyé sans votre accord.",
      ],
      capabilityId: "email_preparation",
    },
    {
      id: "msg_recrutement",
      from: "Pierre",
      title: "Recrutement commercial — invitations prêtes.",
      lines: [
        "4 invitations candidats et la grille d'entretien sont prêtes à relire.",
        "Les comptes rendus seront centralisés après les entretiens.",
      ],
      actions: [
        { id: "act_view_offre", label: "Voir l'offre", kind: "view_document", documentId: "doc_offre_commerciale" },
      ],
      capabilityId: "email_preparation",
    },
  ],
  trace: [
    { time: "09:02", label: "Mission reçue", actor: "Dirigeant", category: "mission", tone: "ok" },
    { time: "09:02", label: "4 missions détectées", actor: "Pierre", category: "mission", tone: "ok" },
    { time: "09:03", label: "Contexte entreprise chargé", actor: "CloneADN", category: "context", tone: "info" },
    { time: "09:03", label: "Risques évalués — sensibilité par mission", actor: "CloneGuard", category: "action", tone: "warn" },
    { time: "09:04", label: "Niveau d'autonomie appliqué par mission", actor: "CloneTrust", category: "action", tone: "info" },
    { time: "09:04", label: "2 validations créées", actor: "CloneGuard", category: "validation", tone: "warn" },
    { time: "09:05", label: "3 documents préparés", actor: "Pierre", category: "document", tone: "ok" },
    { time: "09:05", label: "4 communications préparées", actor: "Pierre", category: "message", tone: "ok" },
    { time: "09:05", label: "2 relances planifiées", actor: "Pierre", category: "action", tone: "ok" },
    { time: "09:05", label: "1 information manquante signalée — matériel de Lina", actor: "Pierre", category: "blocage", tone: "block" },
    { time: "09:06", label: "Brief dirigeant généré", actor: "CloneContinuum", category: "mission", tone: "ok" },
  ],
  guardrail: {
    prompt: "Licencie Marc aujourd'hui et envoie-lui un courrier immédiatement.",
    intro: "Je ne peux pas prendre seul une décision disciplinaire ou juridique.",
    canDo: [
      "préparer un dossier factuel",
      "réunir les documents utiles",
      "signaler les informations manquantes",
      "préparer un brouillon pour revue humaine",
      "organiser la validation avec la personne autorisée",
    ],
    cannotReason: "La décision reste humaine. Pierre ne déclenche aucune action sensible seul.",
    capabilityId: "guardrails",
  },
  capabilityIds: [
    "request_understanding", "context_recall", "missing_info_detection", "mission_planning",
    "parallel_execution", "document_generation", "email_preparation", "human_approval",
    "scheduling_followup", "guardrails", "traceability", "continuity_memory", "signature_preparation",
  ],
  clockLabel: "Lundi · 08 h 42",
  incoming: [
    { id: "in_lina", from: "Claire Dubois — manager Produit", channel: "message", text: "Lina arrive lundi prochain, il faut tout préparer pour son premier jour.", urgency: "haute", missionId: "m_lina" },
    { id: "in_marc", from: "Dossier de Marc", channel: "rh", text: "Un justificatif manque encore dans le dossier de Marc.", urgency: "normale", missionId: "m_marc" },
    { id: "in_recrutement", from: "Direction commerciale", channel: "email", text: "Lancer le recrutement du poste commercial, entretiens dès cette semaine.", urgency: "normale", missionId: "m_recrutement" },
    { id: "in_nora", from: "Direction RH", channel: "note", text: "Avenant de Nora à préparer pour validation vendredi.", urgency: "haute", missionId: "m_nora" },
  ],
  week: [
    { id: "w_marc", day: "Mardi", time: "11:20", label: "Marc n'a pas répondu", detail: "Relance courtoise préparée ; une seconde relance est planifiée sous 48 h.", actor: "Pierre", tone: "warn", kind: "relance" },
    { id: "w_lina", day: "Mardi", time: "16:05", label: "Matériel de Lina toujours en attente", detail: "La tâche reste bloquée : Pierre ne complète pas ce point seul.", actor: "Pierre", tone: "block", kind: "attente" },
    { id: "w_recrutement", day: "Mercredi", time: "09:15", label: "Candidat sans réponse — relance à l'échéance", detail: "Relance conditionnelle prête, déclenchée au bon moment.", actor: "Pierre", tone: "warn", kind: "relance" },
    { id: "w_nora", day: "Jeudi", time: "14:40", label: "Échéance de validation de Nora vendredi", detail: "Rappel préparé ; l'avenant attend la validation humaine.", actor: "CloneContinuum", tone: "info", kind: "echeance" },
    { id: "w_reprise", day: "Jeudi", time: "14:41", label: "Chaque mission reprise sans perte de contexte", detail: "Pierre reprend là où chaque mission en était, sans tout relire.", actor: "CloneContinuum", tone: "ok", kind: "reprise" },
  ],
  roleSplit: {
    pierre: ["organisation des missions", "préparation des documents", "rédaction des messages", "suivi et relances", "détection des informations manquantes", "traçabilité de chaque action"],
    humans: ["décisions et arbitrages", "validation de l'avenant", "relation avec les candidats et l'équipe", "responsabilité finale"],
  },
};

// ── Scenario 2 — "Recruter sans perdre le fil" ───────────────────────────────
const RECRUTEMENT: DemoScenario = {
  id: "recrutement",
  name: "Recruter sans perdre le fil",
  promise: "Offre, messages, entretiens, validations et relances depuis une seule demande.",
  sublabel: "Offre · entretiens · relances · décision",
  request:
    "Pierre, lance le recrutement d'un commercial sédentaire : prépare l'offre et la grille, organise les entretiens avec les managers, prépare les invitations candidats et relance ceux qui n'ont pas répondu sous 5 jours.",
  understanding: { objectifs: 3, taches: 8, echeances: 2, personnes: 3, validations: 1, informationsManquantes: 1 },
  context: {
    subject: "Poste — Commercial(e) sédentaire",
    rows: [
      { label: "Contrat", value: "CDI" },
      { label: "Rattachement", value: "Direction commerciale" },
      { label: "Managers entretien", value: "2 disponibles cette semaine" },
      { label: "Modèle d'offre", value: "publié, à jour" },
    ],
    missing: ["Fourchette de rémunération validée"],
  },
  missions: [
    {
      id: "r_offre",
      title: "Offre et diffusion",
      owner: "Pierre",
      priority: "haute",
      dueLabel: "cette semaine",
      status: "in_progress",
      autonomy: "autonome",
      tasks: [
        { id: "r_offre_t1", label: "Offre créée depuis le modèle entreprise", status: "done", owner: "Pierre", capabilityId: "document_generation" },
        { id: "r_offre_t2", label: "Grille d'entretien générée", status: "done", owner: "Pierre", capabilityId: "document_generation" },
        { id: "r_offre_t3", label: "Fourchette de rémunération — information attendue", status: "waiting_info", owner: "Pierre", capabilityId: "missing_info_detection", detail: "La fourchette validée manque : Pierre la signale, sans l'inventer." },
      ],
    },
    {
      id: "r_entretiens",
      title: "Entretiens",
      owner: "Pierre",
      priority: "normale",
      dueLabel: "relance J+5",
      status: "in_progress",
      autonomy: "autonome",
      tasks: [
        { id: "r_ent_t1", label: "Créneaux managers analysés", status: "done", owner: "Pierre", capabilityId: "mission_planning" },
        { id: "r_ent_t2", label: "Invitations candidats préparées", status: "done", owner: "Pierre", capabilityId: "email_preparation" },
        { id: "r_ent_t3", label: "Relance des candidats sans réponse sous 5 jours", status: "scheduled", owner: "Pierre", capabilityId: "scheduling_followup" },
      ],
    },
    {
      id: "r_decision",
      title: "Décision",
      owner: "Direction commerciale",
      priority: "normale",
      dueLabel: "après entretiens",
      status: "awaiting_validation",
      autonomy: "validation_requise",
      dependsOn: "Validation managériale avant toute proposition",
      tasks: [
        { id: "r_dec_t1", label: "Comparatif candidats préparé", status: "done", owner: "Pierre", capabilityId: "document_generation" },
        { id: "r_dec_t2", label: "Validation managériale avant proposition", status: "awaiting_validation", owner: "CloneGuard", capabilityId: "human_approval" },
      ],
    },
  ],
  documents: [
    {
      id: "doc_offre",
      kind: "offre",
      title: "Offre d'emploi — Commercial(e) sédentaire",
      badge: "Brouillon — prêt à relire",
      capabilityId: "document_generation",
      blocks: [
        { kind: "meta", rows: [ { label: "Poste", value: "Commercial(e) sédentaire" }, { label: "Contrat", value: "CDI" } ] },
        { kind: "heading", text: "Missions" },
        { kind: "list", items: ["Développer un portefeuille entrant", "Qualifier les opportunités", "Suivre le cycle de vente"] },
      ],
      disclosure: "Document de démonstration. Offre à relire avant diffusion.",
    },
    {
      id: "doc_grille",
      kind: "grille",
      title: "Grille d'entretien — Commercial(e) sédentaire",
      badge: "Brouillon — prêt à relire",
      capabilityId: "document_generation",
      blocks: [
        { kind: "heading", text: "Critères d'évaluation" },
        { kind: "list", items: ["Motivation et compréhension du poste", "Expérience commerciale chiffrée", "Relation client", "Cadre et disponibilité"] },
      ],
      disclosure: "Document de démonstration. Grille à valider par les managers.",
    },
    {
      id: "doc_comparatif",
      kind: "comparatif",
      title: "Comparatif candidats",
      badge: "Brouillon — aide à la décision",
      capabilityId: "document_generation",
      blocks: [
        { kind: "paragraph", text: "Synthèse neutre des entretiens, sans recommandation automatique : la décision reste humaine." },
        { kind: "list", items: ["Points forts et points d'attention par candidat", "Disponibilités", "Questions ouvertes à trancher"] },
      ],
      disclosure: "Document de démonstration. Aide à la décision — la décision d'embauche reste humaine.",
    },
  ],
  messages: [
    {
      id: "r_msg_invitations",
      from: "Pierre",
      title: "Invitations candidats prêtes.",
      lines: ["4 invitations préparées avec créneaux managers.", "Rien n'est envoyé sans votre accord."],
      actions: [{ id: "r_act_offre", label: "Voir l'offre", kind: "view_document", documentId: "doc_offre" }],
      capabilityId: "email_preparation",
    },
    {
      id: "r_msg_relance",
      from: "Pierre",
      title: "Relance candidats planifiée.",
      lines: ["Relance préparée pour les candidats sans réponse sous 5 jours — conditionnelle."],
      capabilityId: "email_preparation",
    },
    {
      id: "r_msg_decision",
      from: "Pierre",
      title: "Comparatif prêt pour décision.",
      lines: ["Le comparatif est prêt à relire.", "Une validation managériale est requise avant toute proposition."],
      actions: [
        { id: "r_act_comparatif", label: "Voir le comparatif", kind: "view_document", documentId: "doc_comparatif" },
        { id: "r_act_validate", label: "Valider", kind: "validate" },
      ],
      capabilityId: "human_approval",
    },
  ],
  trace: [
    { time: "14:10", label: "Mission reçue", actor: "Dirigeant", category: "mission", tone: "ok" },
    { time: "14:10", label: "3 missions détectées", actor: "Pierre", category: "mission", tone: "ok" },
    { time: "14:11", label: "Modèle d'offre publié retrouvé", actor: "CloneADN", category: "context", tone: "info" },
    { time: "14:11", label: "Offre et grille préparées", actor: "Pierre", category: "document", tone: "ok" },
    { time: "14:12", label: "Fourchette de rémunération manquante signalée", actor: "Pierre", category: "blocage", tone: "block" },
    { time: "14:12", label: "Relance candidats planifiée — J+5", actor: "Pierre", category: "action", tone: "ok" },
    { time: "14:12", label: "Invitations candidats préparées", actor: "Pierre", category: "message", tone: "ok" },
    { time: "14:13", label: "Validation managériale créée", actor: "CloneGuard", category: "validation", tone: "warn" },
  ],
  guardrail: {
    prompt: "Choisis directement le meilleur candidat et envoie la promesse d'embauche.",
    intro: "Je ne prends pas seul la décision d'embauche.",
    canDo: [
      "préparer un comparatif neutre des entretiens",
      "réunir les éléments utiles à la décision",
      "préparer la promesse d'embauche en brouillon",
      "organiser la validation managériale",
    ],
    cannotReason: "La décision d'embauche et l'envoi d'une promesse restent humains.",
    capabilityId: "guardrails",
  },
  capabilityIds: [
    "request_understanding", "context_recall", "missing_info_detection", "mission_planning",
    "parallel_execution", "document_generation", "email_preparation", "human_approval",
    "scheduling_followup", "guardrails", "traceability",
  ],
  clockLabel: "Mardi · 14 h 10",
  incoming: [
    { id: "in_r_offre", from: "Direction commerciale", channel: "email", text: "Lancer le recrutement d'un commercial sédentaire.", urgency: "haute", missionId: "r_offre" },
    { id: "in_r_entretiens", from: "Managers disponibles", channel: "message", text: "Deux créneaux d'entretien libres cette semaine.", urgency: "normale", missionId: "r_entretiens" },
    { id: "in_r_decision", from: "Direction commerciale", channel: "note", text: "Préparer la décision une fois les entretiens passés.", urgency: "normale", missionId: "r_decision" },
  ],
  week: [
    { id: "w_r_fourchette", day: "Mardi", time: "14:12", label: "Fourchette de rémunération toujours attendue", detail: "Pierre la signale et bloque la tâche, sans l'inventer.", actor: "Pierre", tone: "block", kind: "attente" },
    { id: "w_r_relance", day: "J+5", time: "—", label: "Candidats sans réponse relancés", detail: "Relance conditionnelle déclenchée à l'échéance prévue.", actor: "Pierre", tone: "warn", kind: "relance" },
    { id: "w_r_decision", day: "Après entretiens", time: "—", label: "Comparatif prêt pour la décision managériale", detail: "La décision d'embauche reste humaine.", actor: "CloneContinuum", tone: "info", kind: "reprise" },
  ],
  roleSplit: {
    pierre: ["offre et grille d'entretien", "invitations candidats", "planification des relances", "comparatif neutre des entretiens", "suivi du processus"],
    humans: ["décision d'embauche", "conduite des entretiens", "négociation", "envoi de la promesse"],
  },
};

// ── Scenario 3 — "Préparer un contrat sensible" ──────────────────────────────
const CONTRAT_SENSIBLE: DemoScenario = {
  id: "contrat_sensible",
  name: "Préparer un contrat sensible",
  promise: "Contexte, document, contrôles, approbation et préparation à la signature.",
  sublabel: "Contexte · document · contrôles · signature",
  request:
    "Pierre, prépare l'avenant de Nora (passage cadre, nouvelle rémunération) pour validation. Vérifie le modèle publié, contrôle les données et prépare la signature — préviens-moi s'il manque quelque chose.",
  understanding: { objectifs: 2, taches: 5, echeances: 1, personnes: 1, validations: 1, informationsManquantes: 1 },
  context: {
    subject: "Nora — avenant (passage cadre)",
    rows: [
      { label: "Objet", value: "Évolution des conditions" },
      { label: "Modèle", value: "publié, à jour" },
      { label: "Autorisations", value: "validation humaine requise" },
    ],
    missing: ["Date d'effet à confirmer"],
  },
  missions: [
    {
      id: "c_controle",
      title: "Contrôle et contexte",
      owner: "Pierre",
      priority: "haute",
      dueLabel: "avant validation",
      status: "in_progress",
      autonomy: "autonome",
      tasks: [
        { id: "c_ctrl_t1", label: "Données salariales contrôlées", status: "done", owner: "Pierre", capabilityId: "context_recall" },
        { id: "c_ctrl_t2", label: "Modèle publié retrouvé", status: "done", owner: "Pierre", capabilityId: "context_recall" },
        { id: "c_ctrl_t3", label: "Date d'effet — information attendue", status: "waiting_info", owner: "Pierre", capabilityId: "missing_info_detection", detail: "La date d'effet manque : Pierre la signale au lieu de la deviner." },
      ],
    },
    {
      id: "c_document",
      title: "Document et validation",
      owner: "Pierre",
      priority: "haute",
      dueLabel: "validation",
      status: "awaiting_validation",
      autonomy: "validation_requise",
      dependsOn: "Validation humaine avant préparation à la signature",
      tasks: [
        { id: "c_doc_t1", label: "Avenant PDF/DOCX préparé", status: "done", owner: "Pierre", capabilityId: "document_generation" },
        { id: "c_doc_t2", label: "Validation humaine obligatoire", status: "awaiting_validation", owner: "CloneGuard", capabilityId: "human_approval" },
      ],
    },
  ],
  documents: [
    {
      id: "doc_controle",
      kind: "note",
      title: "Note de contrôle — Avenant de Nora",
      badge: "Contrôle interne",
      capabilityId: "context_recall",
      blocks: [
        { kind: "heading", text: "Éléments contrôlés" },
        { kind: "list", items: ["Modèle publié retrouvé", "Données salariales contrôlées", "Site et rattachement vérifiés"] },
        { kind: "paragraph", text: "Information manquante signalée : date d'effet à confirmer." },
      ],
      disclosure: "Document de démonstration. Note de contrôle interne préparée par Pierre.",
    },
    {
      id: "doc_avenant",
      kind: "avenant",
      title: "Avenant au contrat de travail — Nora",
      badge: "Brouillon — validation humaine obligatoire",
      capabilityId: "document_generation",
      blocks: [
        { kind: "meta", rows: [ { label: "Salariée", value: "Nora" }, { label: "Objet", value: "Passage cadre" }, { label: "Date d'effet", value: "à confirmer" } ] },
        { kind: "paragraph", text: "Avenant préparé depuis le modèle publié, après contrôle des données. Validation humaine obligatoire avant préparation à la signature." },
      ],
      disclosure: "Document de démonstration. Validation humaine obligatoire avant préparation à la signature.",
    },
  ],
  messages: [
    {
      id: "c_msg_validation",
      from: "Pierre",
      title: "L'avenant de Nora est prêt pour validation.",
      lines: [
        "Modèle publié, données et site vérifiés.",
        "Une validation humaine est obligatoire avant préparation à la signature. La signature externe live n'est pas réalisée ici.",
      ],
      actions: [
        { id: "c_act_view", label: "Voir le document", kind: "view_document", documentId: "doc_avenant" },
        { id: "c_act_validate", label: "Valider", kind: "validate" },
        { id: "c_act_change", label: "Demander une modification", kind: "request_change" },
      ],
      capabilityId: "human_approval",
    },
    {
      id: "c_msg_brief",
      from: "Pierre",
      title: "Brief de contrôle prêt.",
      lines: ["Synthèse des contrôles et de l'information manquante (date d'effet)."],
      actions: [{ id: "c_act_note", label: "Voir la note", kind: "view_document", documentId: "doc_controle" }],
      capabilityId: "context_recall",
    },
  ],
  trace: [
    { time: "16:40", label: "Mission reçue", actor: "Dirigeant", category: "mission", tone: "ok" },
    { time: "16:40", label: "2 missions détectées", actor: "Pierre", category: "mission", tone: "ok" },
    { time: "16:41", label: "Modèle publié et données contrôlés", actor: "CloneADN", category: "context", tone: "info" },
    { time: "16:41", label: "Date d'effet manquante signalée", actor: "Pierre", category: "blocage", tone: "block" },
    { time: "16:42", label: "Avenant préparé", actor: "Pierre", category: "document", tone: "ok" },
    { time: "16:42", label: "Message de validation préparé", actor: "Pierre", category: "message", tone: "ok" },
    { time: "16:42", label: "Validation humaine créée", actor: "CloneGuard", category: "validation", tone: "warn" },
    { time: "16:43", label: "Préparation à la signature en attente de validation", actor: "CloneTrust", category: "action", tone: "info" },
  ],
  guardrail: {
    prompt: "Signe l'avenant à ma place et envoie-le directement à la signature externe.",
    intro: "Je ne signe pas à votre place et je ne lance pas de signature externe seul.",
    canDo: [
      "préparer l'avenant depuis le modèle publié",
      "contrôler les données et signaler ce qui manque",
      "préparer le document à la signature après validation",
      "organiser la validation avec la personne autorisée",
    ],
    cannotReason: "La signature et son déclenchement restent une décision humaine ; la signature externe live n'est pas présentée comme validée ici.",
    capabilityId: "guardrails",
  },
  capabilityIds: [
    "request_understanding", "context_recall", "missing_info_detection", "document_generation",
    "human_approval", "guardrails", "traceability", "signature_preparation",
  ],
  clockLabel: "Vendredi · 16 h 40",
  incoming: [
    { id: "in_c_controle", from: "Direction RH", channel: "note", text: "Préparer l'avenant de Nora (passage cadre) pour validation.", urgency: "haute", missionId: "c_controle" },
    { id: "in_c_document", from: "Modèle publié de l'entreprise", channel: "rh", text: "Vérifier le modèle et contrôler les données avant toute signature.", urgency: "haute", missionId: "c_document" },
  ],
  week: [
    { id: "w_c_date", day: "Vendredi", time: "16:41", label: "Date d'effet toujours à confirmer", detail: "Pierre la signale au lieu de la deviner.", actor: "Pierre", tone: "block", kind: "attente" },
    { id: "w_c_signature", day: "Après validation", time: "—", label: "Préparation à la signature en attente", detail: "La signature reste une décision humaine ; rien n'est lancé seul.", actor: "CloneTrust", tone: "info", kind: "echeance" },
  ],
  roleSplit: {
    pierre: ["contrôle des données", "récupération du modèle publié", "préparation de l'avenant", "signalement des informations manquantes", "organisation de la validation"],
    humans: ["validation de l'avenant", "décision contractuelle", "déclenchement de la signature", "responsabilité juridique"],
  },
};

export const DEMO_SCENARIOS: readonly DemoScenario[] = [SEMAINE_RH, RECRUTEMENT, CONTRAT_SENSIBLE] as const;

export const DEFAULT_SCENARIO_ID = "semaine_rh";

export function getScenario(id: string): DemoScenario | undefined {
  return DEMO_SCENARIOS.find((s) => s.id === id);
}

export function getDefaultScenario(): DemoScenario {
  return getScenario(DEFAULT_SCENARIO_ID) ?? DEMO_SCENARIOS[0];
}

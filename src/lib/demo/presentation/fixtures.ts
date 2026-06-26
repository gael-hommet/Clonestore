// /demo — Données de démonstration (100% fictives)
//
// Contexte cohérent d'un bout à l'autre de la présentation (§26) : Clara Martin,
// responsable commerciale, site de Lyon, arrivée lundi, entreprise fictive.
// Ces données illustrent les composants animés ; elles ne sont jamais présentées
// comme des résultats clients réels.

export const DEMO_DATA_DISCLAIMER = "Données de démonstration — entièrement fictives.";

export const DEMO_CONTEXT = {
  collaborator: "Clara Martin",
  role: "Responsable commerciale",
  site: "Lyon",
  manager: "Hélène Roy",
  managerRole: "Directrice régionale",
  company: "Vireo", // entreprise fictive
  deadline: "lundi",
} as const;

export type DemoTone = "ok" | "warn" | "block" | "info";

export interface DemoTask {
  id: string;
  title: string;
  owner: string;
  status: string;
  tone: DemoTone;
}

/** Mission centrale réutilisée entre plusieurs scènes (E2.1, E2.2, E2.4, E2.10). */
export const DEMO_MISSION = {
  title: "Mission RH — Onboarding responsable commerciale",
  collaborator: DEMO_CONTEXT.collaborator,
  site: DEMO_CONTEXT.site,
  deadline: DEMO_CONTEXT.deadline,
  intervenants: 3,
  validations: 1,
  tasks: [
    {
      id: "t1",
      title: "Rassembler le dossier de Clara Martin",
      owner: "Pierre",
      status: "Terminé",
      tone: "ok",
    },
    {
      id: "t2",
      title: "Préparer l'avenant et le contrat",
      owner: "Pierre",
      status: "Prêt à valider",
      tone: "warn",
    },
    {
      id: "t3",
      title: "Rédiger le message à la manager",
      owner: "Pierre",
      status: "Prêt",
      tone: "ok",
    },
    {
      id: "t4",
      title: "Préparer la checklist d'arrivée (matériel, accès)",
      owner: "Pierre",
      status: "En cours",
      tone: "info",
    },
    {
      id: "t5",
      title: "Planifier la session d'accueil",
      owner: "Pierre",
      status: "Planifié",
      tone: "info",
    },
    {
      id: "t6",
      title: "Préparer les communications de l'équipe de Lyon",
      owner: "Pierre",
      status: "Prêt",
      tone: "ok",
    },
    {
      id: "t7",
      title: "Enregistrer la trace de mission",
      owner: "CloneTrace",
      status: "Enregistré",
      tone: "ok",
    },
  ] satisfies DemoTask[],
} as const;

export interface DemoTraceEntry {
  time: string;
  event: string;
  actor: string;
  tone: DemoTone;
}

export const DEMO_TRACE: DemoTraceEntry[] = [
  { time: "08:58", event: "Demande reçue", actor: "Direction", tone: "ok" },
  { time: "08:58", event: "Mission créée — onboarding responsable commerciale", actor: "CloneOS", tone: "ok" },
  { time: "08:59", event: "Contexte appliqué — site de Lyon, règles de l'entreprise", actor: "CloneADN", tone: "ok" },
  { time: "08:59", event: "Dossier de Clara Martin rassemblé", actor: "Pierre", tone: "ok" },
  { time: "09:00", event: "Avenant préparé (brouillon)", actor: "Pierre", tone: "ok" },
  { time: "09:00", event: "Envoi de l'avenant — validation requise", actor: "CloneGuard", tone: "warn" },
  { time: "09:01", event: "Message à la manager préparé", actor: "Pierre", tone: "ok" },
  { time: "09:01", event: "Étapes consignées et retrouvables", actor: "CloneTrace", tone: "ok" },
];

/** Document préparé (aperçu liquid glass) — brouillon clairement marqué. */
export const DEMO_DOCUMENT = {
  title: "Avenant au contrat — Clara Martin — Brouillon",
  meta: ["Responsable commerciale", "Site de Lyon", "Prise de poste : lundi"],
  body: [
    "Madame Clara Martin,",
    "",
    "Dans le cadre de votre prise de fonction de Responsable commerciale sur le site de Lyon, nous vous transmettons l'avenant correspondant à vos nouvelles responsabilités.",
    "",
    "Prise de poste : lundi.",
    "Rattachement : Hélène Roy, Directrice régionale.",
  ],
  disclaimer: "Brouillon — validation humaine requise avant envoi.",
} as const;

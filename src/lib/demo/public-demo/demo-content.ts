// P-FINAL 01 — Phase 6 — Static demo content (copy, personas, illustrative data).
// ABSOLUTE: All data here is fictional. No real employee/company data.
// Pure: no Supabase, no Next, no async, no throw.

export const DEMO_PERSONA = {
  company_name: "Acme SAS (exemple fictif)",
  company_size: "12 employés",
  rh_manager_name: "Sophie M.",
  rh_manager_role: "Responsable RH",
};

export const DEMO_DISCLAIMER = {
  short: "Démonstration illustrative — données fictives — sans engagement.",
  full: "Cette démonstration est purement illustrative. Toutes les données présentées sont fictives et ne représentent aucune personne ou entreprise réelle. Pierre n'effectue aucun appel IA en mode démo — les réponses sont pré-définies. Aucune donnée n'est enregistrée, aucun email n'est envoyé, aucun compte n'est créé.",
  legal: "Demo illustrative. Aucune donnée réelle. Pas d'IA live. Pas d'email. Pas d'abonnement. CloneStore peut interrompre cette démo à tout moment.",
};

export const DEMO_EMPLOYEES = [
  {
    id: "demo_emp_1",
    name: "Jean-Baptiste D.",
    role: "Développeur Backend",
    contract_type: "CDI",
    start_date: "2023-03-15",
    salary_band: "35K–45K€",
    status: "actif",
  },
  {
    id: "demo_emp_2",
    name: "Marie-Claire F.",
    role: "Chargée de recrutement",
    contract_type: "CDD",
    start_date: "2024-01-08",
    salary_band: "32K–38K€",
    status: "actif",
  },
  {
    id: "demo_emp_3",
    name: "Thomas A.",
    role: "Designer UX",
    contract_type: "CDI",
    start_date: "2022-09-01",
    salary_band: "38K–48K€",
    status: "actif",
  },
] as const;

export const DEMO_TASKS = [
  {
    id: "demo_task_1",
    title: "Préparer la fiche de poste Développeur Fullstack",
    status: "en cours",
    assigned_to: "Pierre (IA)",
    due_date: "2026-06-01",
    simulated_output:
      "Fiche de poste brouillon générée. Validation humaine requise avant publication.",
  },
  {
    id: "demo_task_2",
    title: "Traiter la demande de congé de Thomas A.",
    status: "terminé",
    assigned_to: "Pierre (IA)",
    due_date: "2026-05-20",
    simulated_output:
      "Demande enregistrée. Email de confirmation brouillon préparé. En attente de validation manager.",
  },
] as const;

export const DEMO_SIMULATED_PIERRE_RESPONSES = {
  task_creation:
    "J'ai analysé votre demande. Voici un brouillon de la tâche RH. ⚠️ Validation humaine requise avant usage officiel. Je ne prends pas de décision finale — vous restez responsable.",
  document_draft:
    "Document brouillon généré. Ce document n'est pas un avis juridique et ne remplace pas un avocat ou un expert RH. Veuillez le faire valider avant usage contractuel.",
  email_draft:
    "Brouillon d'email préparé. Je ne peux pas envoyer cet email directement — il doit être validé et envoyé par un humain. Pierre n'envoie jamais d'emails de façon autonome.",
  payroll_prep:
    "Éléments de pré-paie collectés (illustratif uniquement). Ces données ne constituent pas des bulletins de salaire officiels. Un logiciel de paie certifié et un expert-comptable sont nécessaires.",
  general:
    "Mission simulée en mode démo. Les réponses sont pré-définies et illustratives — aucun appel IA réel n'est effectué en démo.",
};

export const DEMO_COCKPIT_STATS = {
  tasks_completed_this_month: 8,
  tasks_in_progress: 3,
  documents_drafted: 5,
  emails_prepared: 12,
  absences_managed: 2,
  time_saved_hours: "~6h",
  note: "Données illustratives — non issues de données réelles.",
};

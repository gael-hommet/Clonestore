// src/lib/pierre/email/pierre-email-templates.ts
// B39 — Pierre email templates. Text-only, no AI generation.
// These are structural templates only — Pierre fills variables before sending.
// Human validation is required for all official documents.

import type { PierreEmailUseCase } from "./pierre-email-policy";
import type { EmailSendPayload } from "@/lib/cloneos/channels/email-production/types";

// ── Template variables ────────────────────────────────────────────────────────

export type PierreEmailTemplateVars = {
  company_name?: string;
  employee_name?: string;
  employee_first_name?: string;
  manager_name?: string;
  position_title?: string;
  start_date?: string;
  document_type?: string;
  mission_ref?: string;
  sender_name?: string;
  sender_title?: string;
  sender_email?: string;
  custom?: Record<string, string>;
};

// ── Template definition ───────────────────────────────────────────────────────

export type PierreEmailTemplate = {
  use_case: PierreEmailUseCase;
  subject_template: string;
  body_text_template: string;
  requires_human_review: boolean;
  forbidden_auto_send: boolean;
};

// ── Template library ──────────────────────────────────────────────────────────

const PIERRE_EMAIL_TEMPLATES: Record<PierreEmailUseCase, PierreEmailTemplate> = {
  hr_notification: {
    use_case: "hr_notification",
    subject_template: "[RH] Notification — {{company_name}}",
    body_text_template:
      "Bonjour {{employee_first_name}},\n\nVeuillez trouver ci-joint les informations concernant votre dossier RH.\n\nCordialement,\n{{sender_name}}\n{{sender_title}}",
    requires_human_review: false,
    forbidden_auto_send: false,
  },

  hr_communication: {
    use_case: "hr_communication",
    subject_template: "[RH] Communication — {{company_name}}",
    body_text_template:
      "Bonjour {{employee_first_name}},\n\nNous vous adressons cette communication dans le cadre de votre relation de travail avec {{company_name}}.\n\n[Contenu de la communication à compléter par le responsable RH]\n\nCordialement,\n{{sender_name}}\n{{sender_title}}",
    requires_human_review: true,
    forbidden_auto_send: true,
  },

  onboarding_email: {
    use_case: "onboarding_email",
    subject_template: "Bienvenue chez {{company_name}} — {{employee_first_name}}",
    body_text_template:
      "Bonjour {{employee_first_name}},\n\nNous sommes ravis de vous accueillir au sein de {{company_name}} en tant que {{position_title}}.\n\nVotre date d'intégration est prévue le {{start_date}}.\n\nCordialement,\n{{sender_name}}\n{{sender_title}}",
    requires_human_review: true,
    forbidden_auto_send: true,
  },

  document_delivery: {
    use_case: "document_delivery",
    subject_template: "{{document_type}} — {{company_name}} / {{employee_name}}",
    body_text_template:
      "Bonjour {{employee_first_name}},\n\nVeuillez trouver en pièce jointe votre {{document_type}}.\n\nCe document a été préparé par le service RH de {{company_name}}. En cas de question, contactez votre responsable RH.\n\nCordialement,\n{{sender_name}}\n{{sender_title}}",
    requires_human_review: true,
    forbidden_auto_send: true,
  },

  candidate_update: {
    use_case: "candidate_update",
    subject_template: "Mise à jour de votre candidature — {{company_name}}",
    body_text_template:
      "Bonjour {{employee_first_name}},\n\nNous vous contactons concernant votre candidature au poste de {{position_title}} chez {{company_name}}.\n\n[Contenu à compléter]\n\nCordialement,\n{{sender_name}}\n{{sender_title}}",
    requires_human_review: true,
    forbidden_auto_send: true,
  },

  absence_followup: {
    use_case: "absence_followup",
    subject_template: "[RH] Suivi de votre absence — {{company_name}}",
    body_text_template:
      "Bonjour {{employee_first_name}},\n\nNous vous contactons dans le cadre du suivi de votre absence.\n\n[Contenu à compléter par le responsable RH]\n\nCordialement,\n{{sender_name}}\n{{sender_title}}",
    requires_human_review: true,
    forbidden_auto_send: true,
  },

  prepayroll_alert: {
    use_case: "prepayroll_alert",
    subject_template: "[ALERTE INTERNE] Anomalie pré-paie — {{company_name}}",
    body_text_template:
      "Alerte interne — Service Paie\n\nUne anomalie a été détectée lors du traitement pré-paie de {{company_name}} (mission : {{mission_ref}}).\n\n[Détails à compléter]\n\nCette alerte est destinée à l'équipe RH uniquement. Ne pas transférer.\n\n— Pierre HR Engine",
    requires_human_review: false,
    forbidden_auto_send: false,
  },

  sensitive_hr: {
    use_case: "sensitive_hr",
    subject_template: "[CONFIDENTIEL] Communication RH — {{company_name}}",
    body_text_template:
      "DOCUMENT CONFIDENTIEL — NE PAS TRANSFÉRER\n\nBonjour {{employee_first_name}},\n\n[Contenu confidentiel à rédiger et valider par le DRH avant envoi]\n\nCordialement,\n{{sender_name}}\n{{sender_title}}",
    requires_human_review: true,
    forbidden_auto_send: true,
  },

  internal_alert: {
    use_case: "internal_alert",
    subject_template: "[ALERTE PIERRE] {{company_name}} — Action requise",
    body_text_template:
      "Alerte interne — Pierre HR Engine\n\nUne action est requise pour {{company_name}}.\n\n[Détails à compléter]\n\n— Pierre",
    requires_human_review: false,
    forbidden_auto_send: false,
  },

  executive_report_delivery: {
    use_case: "executive_report_delivery",
    subject_template: "[RAPPORT DIRIGEANT] {{document_type}} — {{company_name}}",
    body_text_template:
      "Bonjour,\n\nVeuillez trouver en pièce jointe le {{document_type}} de {{company_name}}.\n\nCe rapport a été préparé par Pierre HR Engine et validé par votre équipe RH.\n\nCordialement,\n{{sender_name}}\n{{sender_title}}",
    requires_human_review: true,
    forbidden_auto_send: true,
  },

  demo_static: {
    use_case: "demo_static",
    subject_template: "[DÉMO] Email Pierre — Exemple",
    body_text_template:
      "Ceci est un exemple de rendu email Pierre.\n\nCet email n'est pas envoyé — il s'agit d'un aperçu statique de démonstration.\n\n— Pierre HR Engine",
    requires_human_review: true,
    forbidden_auto_send: true,
  },
};

// ── Template resolver ─────────────────────────────────────────────────────────

export function getPierreEmailTemplate(useCase: PierreEmailUseCase): PierreEmailTemplate {
  return PIERRE_EMAIL_TEMPLATES[useCase];
}

// ── Variable interpolation ────────────────────────────────────────────────────

function interpolate(template: string, vars: PierreEmailTemplateVars): string {
  let result = template;

  const simple: Record<string, string | undefined> = {
    company_name:        vars.company_name,
    employee_name:       vars.employee_name,
    employee_first_name: vars.employee_first_name ?? vars.employee_name,
    manager_name:        vars.manager_name,
    position_title:      vars.position_title,
    start_date:          vars.start_date,
    document_type:       vars.document_type,
    mission_ref:         vars.mission_ref,
    sender_name:         vars.sender_name,
    sender_title:        vars.sender_title,
    sender_email:        vars.sender_email,
    ...vars.custom,
  };

  for (const [key, val] of Object.entries(simple)) {
    if (val !== undefined) {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), val);
    }
  }

  return result;
}

// ── Payload builder ───────────────────────────────────────────────────────────

export function buildPierreTemplatedPayload(params: {
  use_case: PierreEmailUseCase;
  from: string;
  to: string[];
  vars: PierreEmailTemplateVars;
  reply_to?: string | null;
  cc?: string[];
  bcc?: string[];
}): Omit<EmailSendPayload, "attachments"> & { attachments: [] } {
  const template = getPierreEmailTemplate(params.use_case);

  return {
    from: params.from,
    reply_to: params.reply_to ?? null,
    to: params.to,
    cc: params.cc ?? [],
    bcc: params.bcc ?? [],
    subject: interpolate(template.subject_template, params.vars),
    body_text: interpolate(template.body_text_template, params.vars),
    body_html: null,
    attachments: [],
  };
}

export function listPierreEmailTemplates(): PierreEmailTemplate[] {
  return Object.values(PIERRE_EMAIL_TEMPLATES);
}

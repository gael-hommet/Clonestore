// B45 — Document Style Kit test fixtures
// Pure: no async, no Supabase, no Next.js, no side effects.

import { createDefaultDocumentStyleKit } from "./defaults";
import type { DocumentStyleKit, DocumentTemplate, DocumentRenderContext } from "./types";
import { getB45TemplateById } from "./template-registry";

export function buildMinimalStyleKit(userId = "user_b45_test"): DocumentStyleKit {
  const kit = createDefaultDocumentStyleKit({ user_id: userId });
  kit.visual_identity.brand_mark_text = "ACME Corp";
  kit.color_system.primary_color_hex = "#1A56DB";
  kit.color_system.secondary_color_hex = "#7E3AF2";
  kit.legal.legal_footer_text = "ACME SAS — Document confidentiel.";
  kit.signature.enabled = true;
  kit.signature.default_signatory_name = "Marie Martin";
  kit.signature.default_signatory_title = "DRH";
  return kit;
}

export function buildFullStyleKit(userId = "user_b45_full"): DocumentStyleKit {
  const kit = buildMinimalStyleKit(userId);
  kit.visual_identity.brand_asset_url = "https://cdn.acme.fr/brand.svg";
  kit.visual_identity.show_brand_mark = true;
  kit.typography.primary_font_family = "'Inter', 'Segoe UI', sans-serif";
  kit.signature.signature_template = "Marie Martin\nDRH — ACME SAS\nrh@acme.fr";
  kit.footer.show_confidentiality_note = true;
  kit.footer.show_generated_by = true;
  kit.header.show_company_name = true;
  kit.header.show_document_title = true;
  kit.reference_sources = [
    {
      id: "ref_payslip",
      source_type: "payslip_sample",
      label: "Bulletin de salaire type",
      file_id: "file_001",
      file_name: "bulletin_paie_type.pdf",
      mime_type: "application/pdf",
      extracted_text_preview: "Bulletin de salaire — période...",
      extracted_structure: null,
      style_notes: null,
      trusted: true,
      uploaded_at: "2026-01-01T00:00:00Z",
    },
    {
      id: "ref_cert",
      source_type: "employment_certificate",
      label: "Attestation de travail type",
      file_id: "file_002",
      file_name: "attestation_travail.docx",
      mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      extracted_text_preview: "Attestation de travail...",
      extracted_structure: null,
      style_notes: null,
      trusted: true,
      uploaded_at: "2026-01-01T00:00:00Z",
    },
  ];
  return kit;
}

export function buildCertificateVariables(): Record<string, unknown> {
  return {
    company_name: "ACME SAS",
    employee_name: "Jean Dupont",
    position_title: "Ingénieur Logiciel Senior",
    start_date: "1er janvier 2022",
    issue_date: "27 mai 2026",
    signatory_name: "Marie Martin",
    signatory_title: "Directrice des Ressources Humaines",
    company_address: "12 rue de la Paix, 75001 Paris",
    contract_type: "CDI",
    department: "Technologie",
  };
}

export function buildPrepayrollVariables(): Record<string, unknown> {
  return {
    payroll_period: "Mai 2026",
    variable_items: "Prime objectif: 500€\nHotel: 2 nuits × 150€",
    anomalies: "Absence non justifiée (2j) — Jean Dupont\nHeures supplémentaires non validées — Pierre Durand",
    missing_justificatifs: "Arrêt maladie du 10/05 non reçu\nNote de frais sans justificatifs",
    company_name: "ACME SAS",
    hr_contact_name: "Marie Martin",
  };
}

export function buildRenderContext(
  templateId: string,
  variables: Record<string, unknown>,
  userId = "user_b45_test",
): DocumentRenderContext | null {
  const template = getB45TemplateById(templateId);
  if (!template) return null;
  const kit = buildMinimalStyleKit(userId);

  return {
    style_kit: kit,
    template,
    variables,
    company_name: String(variables.company_name ?? ""),
    document_title: template.label,
    mission_id: null,
    task_id: null,
    generated_at: new Date().toISOString(),
  };
}

export function buildGenericChatGptText(): string {
  return `
    Voici un modèle de lettre que vous pouvez adapter selon votre situation.

    Madame, Monsieur [Votre nom],

    Je vous contacte au sujet de votre demande. Vous pouvez adapter ce document.
    En vous remerciant, [Nom de l'entreprise].
  `;
}

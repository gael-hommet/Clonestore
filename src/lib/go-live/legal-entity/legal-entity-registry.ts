// GO-LIVE 03 — Legal Entity Field Registry
// Defines all required legal information for public launch.
// Pure: no Supabase, no Next, no async, no throw.

import type { LegalEntityField } from "./types";

export const LEGAL_ENTITY_FIELDS: LegalEntityField[] = [
  {
    key: "company_name",
    label: "Dénomination sociale",
    required_for_public_launch: true,
    required_for_private_pilot: true,
    description: "Nom officiel de la société éditrice du service CloneStore",
    example: "CloneStore SAS",
    placeholder_markers: ["À renseigner", "Placeholder", "votre société"],
  },
  {
    key: "legal_form",
    label: "Forme juridique",
    required_for_public_launch: true,
    required_for_private_pilot: true,
    description: "Statut juridique de la société (SAS, SASU, SARL, auto-entrepreneur…)",
    example: "SAS au capital de X €",
    placeholder_markers: ["forme juridique", "SAS, SASU, auto-entrepreneur"],
  },
  {
    key: "address",
    label: "Adresse du siège social",
    required_for_public_launch: true,
    required_for_private_pilot: true,
    description: "Adresse complète du siège social de la société éditrice",
    example: "12 rue de la Paix, 75001 Paris, France",
    placeholder_markers: ["adresse", "siège social", "À renseigner"],
  },
  {
    key: "siren",
    label: "SIREN / SIRET / RCS",
    required_for_public_launch: true,
    required_for_private_pilot: false,
    description: "Numéro d'immatriculation au Registre du Commerce (9 ou 14 chiffres)",
    example: "SIREN 123 456 789 — RCS Paris",
    placeholder_markers: ["SIREN", "SIRET", "RCS", "immatriculation"],
  },
  {
    key: "publication_director",
    label: "Directeur de la publication",
    required_for_public_launch: true,
    required_for_private_pilot: true,
    description: "Nom et prénom du responsable légal de la publication (représentant légal)",
    example: "Gaël Hommet",
    placeholder_markers: ["directeur de publication", "représentant légal", "À renseigner"],
  },
  {
    key: "contact_email",
    label: "Email de contact officiel",
    required_for_public_launch: true,
    required_for_private_pilot: true,
    description: "Adresse email officielle pour les demandes légales, support, mentions légales",
    example: "contact@clonestore.fr",
    placeholder_markers: ["email de contact", "adresse email", "À renseigner"],
  },
  {
    key: "privacy_email",
    label: "Email RGPD / DPO",
    required_for_public_launch: true,
    required_for_private_pilot: false,
    description: "Adresse email pour les demandes RGPD (accès, rectification, suppression de données)",
    example: "privacy@clonestore.fr",
    placeholder_markers: ["email privacy", "DPO", "RGPD contact"],
  },
  {
    key: "hosting_provider",
    label: "Hébergeur",
    required_for_public_launch: true,
    required_for_private_pilot: true,
    description: "Nom, adresse et coordonnées de l'hébergeur (ex. Vercel Inc.)",
    example: "Vercel Inc., 340 Pine Street, San Francisco, CA 94104, USA",
    placeholder_markers: ["hébergeur à préciser", "À préciser l'hébergeur", "À préciser :"],
  },
  {
    key: "vat_number",
    label: "Numéro TVA intracommunautaire",
    required_for_public_launch: false,
    required_for_private_pilot: false,
    description: "Numéro TVA si applicable selon la réglementation fiscale",
    example: "FR12 123456789",
    placeholder_markers: ["TVA intracommunautaire", "numéro TVA"],
  },
  {
    key: "applicable_law",
    label: "Droit applicable et juridiction",
    required_for_public_launch: true,
    required_for_private_pilot: false,
    description: "Droit applicable et juridiction compétente (à valider par un juriste)",
    example: "Droit français — Tribunal de Commerce de Paris",
    placeholder_markers: ["Placeholder à valider juridiquement", "juridiction de l'éditeur"],
  },
  {
    key: "document_version",
    label: "Version et date des documents légaux",
    required_for_public_launch: true,
    required_for_private_pilot: false,
    description: "Version et date de mise à jour des CGU/CGV/DPA/Confidentialité",
    example: "v1.0 — 2026-06-01",
    placeholder_markers: ["Draft 1.0", "version", "À valider"],
  },
];

export function getLegalEntityFields(): LegalEntityField[] {
  return [...LEGAL_ENTITY_FIELDS];
}

export function getRequiredPublicLaunchFields(): LegalEntityField[] {
  return LEGAL_ENTITY_FIELDS.filter((f) => f.required_for_public_launch);
}

export function getRequiredPrivatePilotFields(): LegalEntityField[] {
  return LEGAL_ENTITY_FIELDS.filter((f) => f.required_for_private_pilot);
}

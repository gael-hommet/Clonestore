// BLOC 4 — Validation CLIENT légère du formulaire de réservation (UX uniquement).
// Le serveur (validateStep1) reste la SEULE source de vérité ; ceci ne le remplace jamais — cela
// donne un retour inline immédiat et bloque un envoi manifestement invalide pour éviter un aller-retour.

import { COMPANY_SIZES, type CompanySize } from "./types";

export interface ClientStep1 {
  email: string;
  company_name: string;
  company_size: CompanySize | "";
}

// Contrôle pragmatique de forme d'email (PAS l'autorité — le serveur valide réellement).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateReservationStep1Client(s: ClientStep1): Record<string, string> {
  const errors: Record<string, string> = {};
  const email = s.email.trim();
  if (!email) errors.email = "Renseignez votre email professionnel.";
  else if (email.length > 254 || !EMAIL_RE.test(email)) errors.email = "Cet email semble invalide.";
  if (!s.company_name.trim()) errors.company_name = "Renseignez le nom de votre entreprise.";
  if (!s.company_size || !COMPANY_SIZES.includes(s.company_size as CompanySize)) {
    errors.company_size = "Sélectionnez la taille de votre entreprise.";
  }
  return errors;
}

export function isReservationStep1Valid(s: ClientStep1): boolean {
  return Object.keys(validateReservationStep1Client(s)).length === 0;
}

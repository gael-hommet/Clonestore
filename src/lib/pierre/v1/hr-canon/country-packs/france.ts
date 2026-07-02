// src/lib/pierre/v1/hr-canon/country-packs/france.ts
// PHASE 8.10 — France (FR) country pack SCAFFOLD. All rules are SOURCE_REQUIRED (null values).
// Source POINTERS below indicate WHERE P8.12 must source each family from — they are not rule
// values. No French legal rule is asserted here.
import type { CountryPack } from "./types";
import { scaffoldPack } from "./registry";

export const FRANCE_PACK: CountryPack = scaffoldPack({
  jurisdiction: "FR",
  name: "France",
  currency: "EUR",
  language: "fr-FR",
  notes: {
    contract_types: "Source: Code du travail (national) + applicable branch collective agreement.",
    working_time: "Source: Code du travail (durée du travail) + branch/company agreements.",
    paid_leave: "Source: Code du travail (congés payés) + agreements.",
    payroll_contributions: "Source: Code de la sécurité sociale + URSSAF specs; requires provider spec.",
    payslip_requirements: "Source: Code du travail + décret bulletin de paie.",
    collective_agreements: "Source: convention collective de branche applicable (IDCC).",
    dismissal_procedure: "Source: Code du travail + jurisprudence; high legal sensitivity.",
    document_retention: "Source: Code du travail / Code de commerce retention obligations.",
    data_protection: "Source: RGPD + Loi Informatique et Libertés + CNIL guidance.",
  },
});

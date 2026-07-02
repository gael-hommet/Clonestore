// src/lib/pierre/v1/hr-canon/country-packs/luxembourg.ts
// PHASE 8.10 — Luxembourg (LU) country pack SCAFFOLD. All rules SOURCE_REQUIRED (null values).
// Source pointers indicate WHERE P8.12 must source each family; no Luxembourg legal rule asserted.
import type { CountryPack } from "./types";
import { scaffoldPack } from "./registry";

export const LUXEMBOURG_PACK: CountryPack = scaffoldPack({
  jurisdiction: "LU",
  name: "Luxembourg",
  currency: "EUR",
  language: "fr-LU",
  notes: {
    contract_types: "Source: Code du travail luxembourgeois + applicable collective agreements.",
    working_time: "Source: Code du travail (durée du travail).",
    payroll_contributions: "Source: CCSS specs + legislation; requires provider spec.",
    document_retention: "Source: Luxembourg legal retention obligations.",
    data_protection: "Source: GDPR + CNPD guidance.",
  },
});

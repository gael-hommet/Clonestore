// src/lib/pierre/v1/hr-canon/country-packs/belgium.ts
// PHASE 8.10 — Belgium (BE) country pack SCAFFOLD. All rules SOURCE_REQUIRED (null values).
// Source pointers indicate WHERE P8.12 must source each family; no Belgian legal rule is asserted.
import type { CountryPack } from "./types";
import { scaffoldPack } from "./registry";

export const BELGIUM_PACK: CountryPack = scaffoldPack({
  jurisdiction: "BE",
  name: "Belgium",
  currency: "EUR",
  language: "fr-BE",
  notes: {
    contract_types: "Source: national employment legislation + sectoral collective agreements (CP/commissions paritaires).",
    collective_agreements: "Source: applicable joint-committee (commission paritaire) CBA.",
    payroll_contributions: "Source: ONSS/RSZ specs + legislation; requires provider spec.",
    notice_periods: "Source: national statute on notice; high legal sensitivity.",
    dismissal_procedure: "Source: national dismissal legislation + case law.",
    data_protection: "Source: GDPR + national DPA (APD/GBA) guidance.",
  },
});

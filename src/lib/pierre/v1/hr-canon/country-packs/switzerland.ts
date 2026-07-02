// src/lib/pierre/v1/hr-canon/country-packs/switzerland.ts
// PHASE 8.10 — Switzerland (CH) country pack SCAFFOLD. All rules SOURCE_REQUIRED (null values).
// Switzerland adds a CANTONAL dimension (subRegion) for several families. Source pointers indicate
// WHERE P8.12 must source each family; no Swiss legal rule is asserted here.
import type { CountryPack } from "./types";
import { scaffoldPack } from "./registry";

export const SWITZERLAND_PACK: CountryPack = scaffoldPack({
  jurisdiction: "CH",
  name: "Switzerland",
  currency: "CHF",
  language: "fr-CH",
  notes: {
    contract_types: "Source: Code des obligations (CO) + cantonal specifics + CCT where applicable.",
    working_time: "Source: Loi sur le travail (LTr) + ordinances; some cantonal specifics.",
    public_holidays: "Source: cantonal public-holiday calendars (subRegion dependent).",
    payroll_contributions: "Source: AVS/AI/APG + LPP + cantonal specs; requires provider spec.",
    minimum_wage: "Source: cantonal minimum-wage laws where they exist (subRegion dependent).",
    data_protection: "Source: nLPD (revised Swiss FADP) + FDPIC guidance; note non-EU GDPR regime.",
  },
});

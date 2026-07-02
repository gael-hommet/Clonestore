// src/lib/pierre/v1/hr-canon/country-packs/precedence.ts
// PHASE 8.10 — precedence model for resolving which rule wins when several layers speak. This is
// STRUCTURAL ordering only (which layer overrides which); it does not encode any country's actual
// legal rule values. The classic labour-law "favourability" nuance (a lower layer may prevail if
// more favourable to the employee) is represented but flagged as country/legally dependent.

export type RuleLayer =
  | "statutory"            // primary/secondary legislation (highest floor)
  | "sector_agreement"     // sector-level collective agreement
  | "company_agreement"    // company-level collective agreement
  | "company_policy"       // internal HR policy
  | "individual_contract"; // the employment contract

// Default override order, highest authority first. A higher layer sets a floor; lower layers may
// improve on it where the law allows (favourability), which is itself a country rule.
export const LAYER_PRECEDENCE: readonly RuleLayer[] = [
  "statutory", "sector_agreement", "company_agreement", "company_policy", "individual_contract",
];

export function layerRank(layer: RuleLayer): number {
  const i = LAYER_PRECEDENCE.indexOf(layer);
  return i < 0 ? Number.MAX_SAFE_INTEGER : i;
}

export type LayeredValue<T> = { layer: RuleLayer; value: T; moreFavourableToEmployee?: boolean };

/**
 * Resolve which layered value applies. Default: highest-authority layer wins. If a lower layer is
 * marked more favourable to the employee AND favourabilityApplies (a country rule), it may prevail.
 * favourabilityApplies is NOT assumed true — it must be supplied from a verified country rule.
 */
export function resolvePrecedence<T>(values: LayeredValue<T>[], opts: { favourabilityApplies: boolean } = { favourabilityApplies: false }): { winner: LayeredValue<T> | null; rationale: string } {
  if (values.length === 0) return { winner: null, rationale: "no layered values" };
  const sorted = [...values].sort((a, b) => layerRank(a.layer) - layerRank(b.layer));
  const top = sorted[0];
  if (opts.favourabilityApplies) {
    const favourable = sorted.find((v) => v.moreFavourableToEmployee);
    if (favourable && favourable !== top) return { winner: favourable, rationale: `favourability: '${favourable.layer}' more favourable than '${top.layer}'` };
  }
  return { winner: top, rationale: `highest-authority layer '${top.layer}'` };
}

// src/lib/clonestore/production/p10-production-gate.ts
// P10 §10 — PORTE DE PRODUCTION pour la tarification par pays. PURE, FAIL-CLOSED. Certifie
// (ou bloque) l'ouverture des paiements par pays. `PRODUCTION_AUTHORIZED` reste FAUX tant que
// l'owner n'autorise pas explicitement le go-live (idiome maison : voir final-certification
// launch-decision.ts productionUnblock='NOT_AUTHORIZED', go-live-command-center flags jamais true
// par le code). P10 rend le système LAUNCH-READY mais NE lance PAS.

import {
  SUPPORTED_LAUNCH_COUNTRIES, canCountryBuyPrice, pricingForCountry, currencyForCountry,
} from "@/lib/clonestore/pricing/country-pricing";
import { validateStripePricingConfig, detectStripeMode, type Env } from "@/lib/clonestore/pricing/stripe-pricing-config";
import { isCountryPricingEnabled } from "@/lib/clonestore/pricing/pricing-flags";

// ── AUTORISATION DE PRODUCTION — JAMAIS true par le code. Seul l'owner peut lever le blocage. ──
export const PRODUCTION_AUTHORIZED = false as const;

export type P10Severity = "blocker" | "warning";
export type P10Owner = "engineering" | "legal" | "provider" | "owner" | "external";

export interface P10GateItem {
  readonly id: string;
  readonly severity: P10Severity;
  readonly owner: P10Owner;
  readonly title: string;
  readonly detail: string;
  readonly blocksLaunch: boolean;
}

export interface P10DimensionReadiness {
  readonly ready: boolean;
  readonly blockers: string[];
  readonly warnings: string[];
  readonly notes: string[];
}

export interface P10ProductionGateVerdict {
  readonly ok: boolean;                    // toujours false tant que PRODUCTION_AUTHORIZED=false ou blockers>0
  readonly productionAuthorized: boolean;  // = PRODUCTION_AUTHORIZED (false)
  readonly countryPricingEnabled: boolean;
  readonly stripeMode: ReturnType<typeof detectStripeMode>;
  readonly blockers: P10GateItem[];
  readonly warnings: P10GateItem[];
  readonly requiredEnv: { readonly name: string; readonly present: boolean; readonly required: boolean }[];
  readonly countryPricingReadiness: P10DimensionReadiness;
  readonly stripeReadiness: P10DimensionReadiness;
  readonly legalReadiness: P10DimensionReadiness;
  readonly providerReadiness: P10DimensionReadiness;
  readonly deploymentReadiness: P10DimensionReadiness;
  readonly summary: string;
}

const nonEmpty = (v: string | undefined): boolean => typeof v === "string" && v.trim().length > 0;
const flagOn = (v: string | undefined): boolean => {
  const s = (v ?? "").trim().toLowerCase();
  return s === "true" || s === "1" || s === "on" || s === "enabled";
};

/** Évalue la porte de production P10. Pure. FAIL-CLOSED : ok=false tant que non autorisé. */
export function evaluateP10ProductionGate(env: Env = process.env): P10ProductionGateVerdict {
  const blockers: P10GateItem[] = [];
  const warnings: P10GateItem[] = [];
  const B = (id: string, owner: P10Owner, title: string, detail: string) => blockers.push({ id, severity: "blocker", owner, title, detail, blocksLaunch: true });
  const W = (id: string, owner: P10Owner, title: string, detail: string) => warnings.push({ id, severity: "warning", owner, title, detail, blocksLaunch: false });

  const stripeCfg = validateStripePricingConfig({ forProduction: true, env });
  const stripeMode = detectStripeMode(env);
  // Flag lu depuis l'env injecté (tests) ou l'env process réel (via le helper partagé).
  const countryPricingEnabled = env === process.env ? isCountryPricingEnabled() : flagOn(env.STRIPE_COUNTRY_PRICING_ENABLED);

  // ── Env requis ──
  const requiredEnv = [
    { name: "STRIPE_SECRET_KEY", present: nonEmpty(env.STRIPE_SECRET_KEY), required: true },
    { name: "STRIPE_WEBHOOK_SECRET", present: nonEmpty(env.STRIPE_WEBHOOK_SECRET), required: true },
    { name: "STRIPE_PRICE_PIERRE_EUR_MONTHLY", present: nonEmpty(env.STRIPE_PRICE_PIERRE_EUR_MONTHLY) || nonEmpty(env.STRIPE_PRICE_PIERRE), required: true },
    { name: "STRIPE_PRICE_PIERRE_CHF_MONTHLY", present: nonEmpty(env.STRIPE_PRICE_PIERRE_CHF_MONTHLY), required: true },
    { name: "STRIPE_COUNTRY_PRICING_ENABLED", present: countryPricingEnabled, required: true },
  ];

  // ── 1. Readiness tarification par pays — AUTO-VÉRIFICATION du canon/guard (garde vivante) ──
  const cpBlockers: string[] = []; const cpNotes: string[] = [];
  // CH ne peut jamais acheter l'EUR ; FR/BE/LU ne peuvent jamais acheter le CHF.
  if (canCountryBuyPrice("CH", "STRIPE_PRICE_PIERRE_EUR_MONTHLY")) cpBlockers.push("RÉGRESSION : CH peut acheter le prix EUR.");
  for (const c of ["FR", "BE", "LU"]) if (canCountryBuyPrice(c, "STRIPE_PRICE_PIERRE_CHF_MONTHLY")) cpBlockers.push(`RÉGRESSION : ${c} peut acheter le prix CHF.`);
  // Chaque pays supporté a un prix ; les non supportés n'en ont pas.
  for (const c of SUPPORTED_LAUNCH_COUNTRIES) if (pricingForCountry(c).status !== "ok") cpBlockers.push(`RÉGRESSION : ${c} supporté sans prix.`);
  if (pricingForCountry("US").status === "ok") cpBlockers.push("RÉGRESSION : un pays non supporté (US) obtient un prix.");
  if (pricingForCountry(null).status === "ok") cpBlockers.push("RÉGRESSION : un pays inconnu obtient un prix.");
  if (!countryPricingEnabled) cpNotes.push("STRIPE_COUNTRY_PRICING_ENABLED désactivé (opt-in) — checkout country-aware inactif.");
  cpBlockers.forEach((b) => B(`cp_${cpBlockers.indexOf(b)}`, "engineering", "Anti-abus tarification pays", b));
  if (!countryPricingEnabled) B("cp_flag", "owner", "Flag tarification pays désactivé", "STRIPE_COUNTRY_PRICING_ENABLED doit être activé pour servir les prix par pays.");
  const countryPricingReadiness: P10DimensionReadiness = { ready: cpBlockers.length === 0 && countryPricingEnabled, blockers: cpBlockers, warnings: [], notes: cpNotes };

  // ── 2. Readiness Stripe (fail-closed, both currencies, live) ──
  const stripeReadiness: P10DimensionReadiness = { ready: stripeCfg.ok, blockers: stripeCfg.blockers, warnings: stripeCfg.warnings, notes: [`mode=${stripeMode}`] };
  if (!stripeCfg.eurConfigured) B("stripe_eur", "engineering", "Prix EUR Stripe manquant", "STRIPE_PRICE_PIERRE_EUR_MONTHLY (ou legacy STRIPE_PRICE_PIERRE) absent.");
  if (!stripeCfg.chfConfigured) B("stripe_chf", "engineering", "Prix CHF Stripe manquant", "STRIPE_PRICE_PIERRE_CHF_MONTHLY absent — checkout CH fail-closed.");
  if (stripeMode !== "live") B("stripe_live", "owner", "Stripe pas en mode LIVE", `Mode=${stripeMode} : la production exige des clés live vérifiées (jamais de prix test en prod).`);
  if (!nonEmpty(env.STRIPE_WEBHOOK_SECRET)) B("stripe_webhook", "engineering", "Webhook Stripe non vérifié", "STRIPE_WEBHOOK_SECRET absent — événements de facturation non vérifiés.");

  // ── 3. Readiness légale — EXTERNE, pending (jamais un conseil juridique final ici) ──
  const legalReadiness: P10DimensionReadiness = {
    ready: false,
    blockers: [
      "Revue légale par pays (FR/BE/LU/CH) NON finalisée — 0/4 launch-grade (cf. certification pays P8.13, WITHHELD).",
      "Traitement TVA/fiscal par pays NON revu externellement (CHF vs EUR, TVA CH vs UE).",
    ],
    warnings: [],
    notes: ["P10 ne formule AUCUN conseil juridique/fiscal final ; validation avocat requise avant go-live."],
  };
  B("legal_country", "legal", "Revue légale pays pending", legalReadiness.blockers[0]);
  B("legal_tax", "legal", "Traitement TVA/fiscal pending", legalReadiness.blockers[1]);

  // ── 4. Readiness fournisseurs — EXTERNE, pending (Yousign/signature bloqué, cf. P8.7.4) ──
  const providerReadiness: P10DimensionReadiness = {
    ready: false,
    blockers: ["Fournisseurs (signature/Yousign) non live (cf. P8.7.4 OPEN) — hors périmètre pricing mais requis pour le go-live global."],
    warnings: [],
    notes: ["Le pricing par pays est indépendant des providers HR, mais le go-live global les requiert."],
  };
  W("provider_yousign", "provider", "Providers non live", providerReadiness.blockers[0]);

  // ── 5. Readiness déploiement — l'owner n'a pas autorisé ; deploy-block actif ──
  const deploymentReadiness: P10DimensionReadiness = {
    ready: false,
    blockers: ["PRODUCTION_AUTHORIZED=false — autorisation owner requise (go-live non lancé par le code)."],
    warnings: [],
    notes: ["P10 rend le système launch-ready sans lancer."],
  };
  B("deploy_owner", "owner", "Production non autorisée", deploymentReadiness.blockers[0]);

  const ok = PRODUCTION_AUTHORIZED && blockers.length === 0;
  const summary = ok
    ? "P10 production gate: OUVERT (ne devrait pas arriver sans autorisation owner)."
    : `P10 production gate: FERMÉ — ${blockers.length} bloqueur(s). Production NON autorisée (PRODUCTION_AUTHORIZED=false).`;

  return {
    ok,
    productionAuthorized: PRODUCTION_AUTHORIZED,
    countryPricingEnabled,
    stripeMode,
    blockers,
    warnings,
    requiredEnv,
    countryPricingReadiness,
    stripeReadiness,
    legalReadiness,
    providerReadiness,
    deploymentReadiness,
    summary,
  };
}

/** L'ouverture des paiements par pays est-elle autorisée en production ? FAIL-CLOSED. */
export function isP10ProductionAuthorized(env: Env = process.env): boolean {
  return evaluateP10ProductionGate(env).ok; // toujours false tant que non autorisé
}

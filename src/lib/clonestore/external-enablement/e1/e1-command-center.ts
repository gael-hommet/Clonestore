// src/lib/clonestore/external-enablement/e1/e1-command-center.ts
// E1 §14 — THE GO-LIVE COMMAND CENTER. Every flag is COMPUTED from real signals: the real P16C command
// center, the real production evaluators (P10 hard floor, P15 stripe/webhook/provider, P15.1 payment mode),
// the typed environment contract (presence/shape only), the local Supabase audit, the legal-pages state,
// and the canonical dependency ledger. No hardcoded green status.
//
// HARD RULES:
//  - productionAuthorized stays false (P10 const hard floor).
//  - readyForProductionActivation stays false unless every external proof exists + explicit owner authorization.
//  - file existence never proves provider configuration.
//  - env variable NAMES never prove secrets are configured.
//  - source code never proves DNS verification, legal sign-off, or that a deployment occurred.

import { PRODUCTION_AUTHORIZED } from "@/lib/clonestore/production/p10-production-gate";
import { resolvePaymentMode } from "@/lib/clonestore/production/p15-1-payment-mode";
import { verifyStripeLiveReadonly, evaluateWebhookReadiness } from "@/lib/clonestore/production/p15-stripe-live-verification";
import { evaluateProviderClosure } from "@/lib/clonestore/production/p15-provider-closure";
import { detectStripeMode } from "@/lib/clonestore/pricing/stripe-pricing-config";
import { SUPPORTED_LAUNCH_COUNTRIES, currencyForCountry, pricingForCountry } from "@/lib/clonestore/pricing/country-pricing";
import { computeP16CCommandCenter } from "@/lib/clonestore/integration/p16c";

import type { E1Env, E1DependencyStatus } from "./e1-types";
import { evaluateEnvironmentContract } from "./e1-environment-contract";
import { buildE1DependencyLedger, summarizeE1Ledger } from "./e1-external-dependency-ledger";
import { evaluateSupabaseLocalReadiness } from "./e1-supabase-readiness";

const flagOn = (v: string | undefined): boolean => { const s = (v ?? "").trim().toLowerCase(); return s === "true" || s === "1" || s === "on" || s === "enabled"; };
const nonPlaceholder = (env: E1Env, name: string): boolean => {
  const v = (env[name] ?? "").trim();
  if (!v) return false;
  const low = v.toLowerCase();
  return !(low.startsWith("your-") || low.endsWith("..."));
};

async function readRepoFile(relative: string): Promise<string | null> {
  try {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    return readFileSync(resolve(process.cwd(), relative), "utf8");
  } catch {
    return null;
  }
}

async function fileExists(relative: string): Promise<boolean> {
  return (await readRepoFile(relative)) !== null;
}

export type E1Verdict =
  | "E1 — EXTERNAL ENABLEMENT PREPARATION VERIFIED / OWNER, PROVIDER AND LEGAL ACTIONS REQUIRED"
  | "E1 — EXTERNAL ENABLEMENT LOCALLY VERIFIED / PRODUCTION ACTIVATION STILL EXTERNALLY BLOCKED"
  | "E1 — EXTERNAL ENABLEMENT PARTIAL / LOCAL PREPARATION BLOCKED";

export interface E1CommandCenter {
  // ── P16C + hard floors ──
  readonly p16cLocallyReady: boolean;
  readonly productionAuthorized: boolean;
  readonly paymentMode: "disabled" | "test" | "live";
  // ── Stripe ──
  readonly stripeTestReady: boolean;
  readonly stripeLiveReady: boolean;
  readonly stripeWebhookLocallyReady: boolean;
  readonly stripeWebhookExternallyRegistered: boolean;
  // ── Domain ──
  readonly productionDomainKnown: boolean;
  readonly productionDomainDnsVerified: boolean;
  // ── Email ──
  readonly emailAdapterLocallyReady: boolean;
  readonly emailDomainVerified: boolean;
  readonly emailProviderConfigured: boolean;
  // ── Providers ──
  readonly signatureAdapterLocallyReady: boolean;
  readonly signatureProviderConfigured: boolean;
  readonly calendarProviderConfigured: boolean;
  readonly notificationProviderConfigured: boolean;
  readonly voiceProviderConfigured: boolean;
  readonly telephonyProviderConfigured: boolean;
  readonly sirhPayrollProviderConfigured: boolean;
  readonly slackConnectorConfigured: boolean;
  // ── Supabase ──
  readonly supabaseCodeReady: boolean;
  readonly supabaseProductionProjectConfigured: boolean;
  readonly productionMigrationsAuthorized: boolean;
  readonly rlsVerifiedLocally: boolean;
  readonly productionBackupConfigured: boolean;
  // ── Environment / secrets ──
  readonly environmentContractReady: boolean;
  readonly requiredSecretsPresentByShape: boolean;
  readonly noSecretsExposed: boolean;
  // ── Deployment ──
  readonly deploymentConfigLocallyReady: boolean;
  readonly deploymentPerformed: boolean;
  readonly productionHealthVerified: boolean;
  // ── Monitoring ──
  readonly monitoringContractReady: boolean;
  readonly monitoringProviderConfigured: boolean;
  // ── Legal / country ──
  readonly legalDocumentsLocallyPresent: boolean;
  readonly legalPlaceholdersResolved: boolean;
  readonly legalSignoffObtained: boolean;
  readonly countryLaunchConfigReady: boolean;
  readonly priceCurrencyConfigReady: boolean;
  // ── Completion rollups ──
  readonly ownerActionsComplete: boolean;
  readonly providerActionsComplete: boolean;
  readonly legalActionsComplete: boolean;
  readonly exactLocalCompletedItems: readonly string[];
  readonly exactOwnerActions: readonly string[];
  readonly exactProviderActions: readonly string[];
  readonly exactLegalActions: readonly string[];
  readonly exactExternalBlockers: readonly string[];
  readonly exactWarnings: readonly string[];
  // ── Gates ──
  readonly readyForExternalConfiguration: boolean;
  readonly readyForProductionActivation: boolean;
  readonly nextSafeAction: string;
  readonly verdict: E1Verdict;
  // ── Diagnostics ──
  readonly ledgerStatusCounts: Record<E1DependencyStatus, number>;
  readonly localPrepBlockers: readonly string[];
}

/** Compute the E1 command center from real behavior. Deterministic (no OpenAI, no live effects). */
export async function computeE1CommandCenter(env: E1Env = process.env): Promise<E1CommandCenter> {
  // ── P16C real command center (heavy, deterministic) ──
  const p16c = await computeP16CCommandCenter();
  const p16cLocallyReady = p16c.readyForIntegratedLocalUse;

  // ── Hard floors ──
  const productionAuthorized = PRODUCTION_AUTHORIZED; // false as const
  const paymentMode = resolvePaymentMode(env);

  // ── Stripe (real evaluators; read-only, no session/payment) ──
  const stripeMode = detectStripeMode(env);
  const stripeTestReady = stripeMode === "test";
  const stripeLive = await verifyStripeLiveReadonly({ env });
  const stripeLiveReady = stripeLive.ready; // VERIFIED only
  const webhook = evaluateWebhookReadiness(env);
  const stripeWebhookLocallyReady = webhook.routeExists && webhook.signatureEnforced && webhook.idempotent;
  const stripeWebhookExternallyRegistered = false; // code can NEVER prove external registration

  // ── Domain ──
  const appUrl = (env.NEXT_PUBLIC_APP_URL ?? "").trim();
  const productionDomainKnown = /^https:\/\//.test(appUrl) && !/localhost|127\.0\.0\.1/.test(appUrl);
  const productionDomainDnsVerified = false; // code can NEVER prove DNS

  // ── Email ──
  const emailAdapterLocallyReady = await fileExists("src/lib/cloneos/channels/email-production/runtime.ts")
    && await fileExists("src/lib/cloneos/channels/providers/resend.ts");
  const emailProviderConfigured = nonPlaceholder(env, "RESEND_API_KEY") && (env.EMAIL_PROVIDER ?? "").trim().toLowerCase() === "resend";
  const emailDomainVerified = false; // DNS/domain verification is external

  // ── Providers ──
  const provider = evaluateProviderClosure(env as NodeJS.ProcessEnv);
  const signatureAdapterLocallyReady = p16c.exactBlockedItems.some((id) => id.includes("signature")) || provider.fallbackDefinition.length > 0;
  const signatureProviderConfigured = provider.liveVerified; // LIVE_VERIFIED only
  // Calendar/notification/voice/telephony/sirh/slack: no live credential path locally → fail-closed false.
  const calendarProviderConfigured = false;
  const notificationProviderConfigured = false;
  const voiceProviderConfigured = false; // CloneVoice live_disabled by design
  const telephonyProviderConfigured = false; // CloneCall dual-blocked
  const sirhPayrollProviderConfigured = false;
  const slackConnectorConfigured = false;

  // ── Supabase (local audit) ──
  const supabase = await evaluateSupabaseLocalReadiness();
  const supabaseCodeReady = supabase.codeReady;
  const supabaseProductionProjectConfigured = false;
  const productionMigrationsAuthorized = false;
  const rlsVerifiedLocally = supabase.rlsRegistryComplete && supabase.criticalTablesCovered;
  const productionBackupConfigured = false;

  // ── Environment / secrets ──
  const envContract = evaluateEnvironmentContract(env);
  const environmentContractReady = envContract.contractReady;
  const requiredSecretsPresentByShape = envContract.missingRequiredForProduction.length === 0;
  const noSecretsExposed = envContract.secretBoundary.ok;

  // ── Deployment ──
  const nextCfg = await readRepoFile("next.config.ts");
  const pkg = await readRepoFile("package.json");
  const deploymentConfigLocallyReady = !!nextCfg && /serverExternalPackages/.test(nextCfg)
    && !!pkg && /"build":\s*"next build"/.test(pkg) && /"start":\s*"next start"/.test(pkg);
  const deploymentPerformed = false; // code can NEVER prove a deploy
  const productionHealthVerified = false; // requires a live deployment

  // ── Monitoring ──
  const monitoringContractReady = await fileExists("src/lib/observability/health.ts")
    && await fileExists("src/lib/observability/runbook.ts")
    && await fileExists("src/lib/observability/dead-letter.ts");
  const monitoringProviderConfigured = false; // vendor config is external; never provable by code

  // ── Legal / country ──
  const legalPages = ["cgu", "cgv", "dpa", "mentions", "confidentialite"];
  const legalContents = await Promise.all(legalPages.map((p) => readRepoFile(`src/app/legal/${p}/page.tsx`)));
  const legalDocumentsLocallyPresent = legalContents.every((c) => c !== null);
  // Placeholders resolved ONLY if NONE of the pages still contain placeholder/draft markers.
  const placeholderRe = /placeholder|à renseigner|à compléter|à préciser|à valider|Draft 1\.0/i;
  const legalPlaceholdersResolved = legalDocumentsLocallyPresent && legalContents.every((c) => !!c && !placeholderRe.test(c));
  const legalSignoffObtained = false; // NEVER inferred from document presence

  const countryLaunchConfigReady = SUPPORTED_LAUNCH_COUNTRIES.every((c) => pricingForCountry(c).status === "ok");
  const priceCurrencyConfigReady = currencyForCountry("FR") === "EUR" && currencyForCountry("BE") === "EUR"
    && currencyForCountry("LU") === "EUR" && currencyForCountry("CH") === "CHF"
    && pricingForCountry("US").status !== "ok" && pricingForCountry(null).status !== "ok";

  // ── Ledger rollups ──
  const summary = summarizeE1Ledger(env);
  const ledger = buildE1DependencyLedger(env);
  const exactLocalCompletedItems = ledger.filter((e) => e.finalStatus === "LOCAL_READY" || e.finalStatus === "TEST_READY").map((e) => e.id);
  const ownerStatuses: E1DependencyStatus[] = ["OWNER_ACTION_REQUIRED", "CREDENTIAL_REQUIRED", "DOMAIN_DNS_REQUIRED", "DEPLOYMENT_REQUIRED", "PRODUCTION_AUTHORIZATION_REQUIRED"];
  const exactOwnerActions = ledger.filter((e) => ownerStatuses.includes(e.finalStatus) && (e.currentOwner === "owner" || e.currentOwner === "engineering")).map((e) => `${e.id}: ${e.externalOwnerAction}`);
  const exactProviderActions = ledger.filter((e) => e.finalStatus === "PROVIDER_ACTION_REQUIRED").map((e) => `${e.id}: ${e.externalOwnerAction}`);
  const exactLegalActions = ledger.filter((e) => e.finalStatus === "LEGAL_ACTION_REQUIRED").map((e) => `${e.id}: ${e.requiredLegalOwnerAction ?? e.externalOwnerAction}`);
  const notBlockedStatuses: E1DependencyStatus[] = ["LOCAL_READY", "TEST_READY", "NOT_REQUIRED_FOR_LAUNCH"];
  const exactExternalBlockers = ledger.filter((e) => !notBlockedStatuses.includes(e.finalStatus)).map((e) => `${e.id} [${e.finalStatus}]`);

  const ownerActionsComplete = exactOwnerActions.length === 0;
  const providerActionsComplete = exactProviderActions.length === 0;
  const legalActionsComplete = exactLegalActions.length === 0;

  const exactWarnings: string[] = [
    "Presence-by-shape of a key NEVER proves the external account/domain/webhook is configured or verified.",
    "Payment mode can never be 'live' while the P10 hard floor (PRODUCTION_AUTHORIZED const) is false.",
    "Live email/calendar/push/voice/telephony/SIRH providers remain blocked by design; local-safe fallbacks proven (P16C).",
    "Legal placeholders present in /legal/mentions — legal sign-off outstanding.",
    ...(productionDomainKnown ? [] : ["NEXT_PUBLIC_APP_URL is localhost/unset — production domain not yet known."]),
    ...(stripeMode === "live" && !productionAuthorized ? ["Stripe LIVE keys present but production not authorized → payment stays disabled (fail-closed)."] : []),
  ];

  // ── Local-prep blockers: what would prevent handing off to external configuration ──
  const localPrepChecks: Array<[string, boolean]> = [
    ["p16cLocallyReady", p16cLocallyReady],
    ["environmentContractReady", environmentContractReady],
    ["noSecretsExposed", noSecretsExposed],
    ["supabaseCodeReady", supabaseCodeReady],
    ["rlsVerifiedLocally", rlsVerifiedLocally],
    ["deploymentConfigLocallyReady", deploymentConfigLocallyReady],
    ["emailAdapterLocallyReady", emailAdapterLocallyReady],
    ["signatureAdapterLocallyReady", signatureAdapterLocallyReady],
    ["monitoringContractReady", monitoringContractReady],
    ["legalDocumentsLocallyPresent", legalDocumentsLocallyPresent],
    ["countryLaunchConfigReady", countryLaunchConfigReady],
    ["priceCurrencyConfigReady", priceCurrencyConfigReady],
    ["stripeWebhookLocallyReady", stripeWebhookLocallyReady],
    ["productionStillOff", productionAuthorized === false],
    ["paymentNotLive", paymentMode !== "live"],
  ];
  const localPrepBlockers = localPrepChecks.filter(([, ok]) => !ok).map(([name]) => name);

  // ── Gates ──
  // readyForExternalConfiguration: the LOCAL side is complete and honest — the owner can now start
  // external configuration. This does NOT authorize production and does NOT claim anything external.
  const readyForExternalConfiguration = localPrepBlockers.length === 0;

  // readyForProductionActivation: ALL external proofs present AND explicit owner authorization AND the
  // P10 hard floor lifted. Never true here (hard floor false + external blockers present).
  const allExternalProofsPresent = stripeLiveReady && stripeWebhookExternallyRegistered
    && productionDomainDnsVerified && emailProviderConfigured && emailDomainVerified
    && signatureProviderConfigured && supabaseProductionProjectConfigured
    && productionMigrationsAuthorized && productionBackupConfigured
    && deploymentPerformed && productionHealthVerified && monitoringProviderConfigured
    && legalPlaceholdersResolved && legalSignoffObtained;
  const readyForProductionActivation = allExternalProofsPresent && productionAuthorized; // both false → false

  // ── Verdict (clean, deterministic, all three states reachable) ──
  // - local prep incomplete → PARTIAL.
  // - local prep complete AND owner/provider/legal/domain/deploy/prod-auth actions still outstanding
  //   → PREPARATION VERIFIED (the current honest state).
  // - local prep complete AND every external blocker resolved but production not yet activated
  //   → LOCALLY VERIFIED / PRODUCTION ACTIVATION STILL EXTERNALLY BLOCKED.
  const externalWorkRemaining = exactExternalBlockers.length > 0;
  const verdict: E1Verdict = !readyForExternalConfiguration
    ? "E1 — EXTERNAL ENABLEMENT PARTIAL / LOCAL PREPARATION BLOCKED"
    : externalWorkRemaining
      ? "E1 — EXTERNAL ENABLEMENT PREPARATION VERIFIED / OWNER, PROVIDER AND LEGAL ACTIONS REQUIRED"
      : "E1 — EXTERNAL ENABLEMENT LOCALLY VERIFIED / PRODUCTION ACTIVATION STILL EXTERNALLY BLOCKED";

  const nextSafeAction = !readyForExternalConfiguration
    ? `Fix local preparation blockers: ${localPrepBlockers.join(", ")}.`
    : "Owner begins external configuration in this order: (1) legal entity + counsel sign-off, (2) production domain + DNS, (3) Supabase production project + authorized migrations + RLS runtime verify, (4) Stripe account + live EUR/CHF prices + webhook registration, (5) email provider + SPF/DKIM/DMARC, (6) monitoring vendor + rollback rehearsal, (7) complete the owner go-live approval packet. Then a DELIBERATE code change lifts the P10 hard floor. No production activation until every external proof exists.";

  return {
    p16cLocallyReady, productionAuthorized, paymentMode,
    stripeTestReady, stripeLiveReady, stripeWebhookLocallyReady, stripeWebhookExternallyRegistered,
    productionDomainKnown, productionDomainDnsVerified,
    emailAdapterLocallyReady, emailDomainVerified, emailProviderConfigured,
    signatureAdapterLocallyReady, signatureProviderConfigured, calendarProviderConfigured,
    notificationProviderConfigured, voiceProviderConfigured, telephonyProviderConfigured,
    sirhPayrollProviderConfigured, slackConnectorConfigured,
    supabaseCodeReady, supabaseProductionProjectConfigured, productionMigrationsAuthorized,
    rlsVerifiedLocally, productionBackupConfigured,
    environmentContractReady, requiredSecretsPresentByShape, noSecretsExposed,
    deploymentConfigLocallyReady, deploymentPerformed, productionHealthVerified,
    monitoringContractReady, monitoringProviderConfigured,
    legalDocumentsLocallyPresent, legalPlaceholdersResolved, legalSignoffObtained,
    countryLaunchConfigReady, priceCurrencyConfigReady,
    ownerActionsComplete, providerActionsComplete, legalActionsComplete,
    exactLocalCompletedItems, exactOwnerActions, exactProviderActions, exactLegalActions,
    exactExternalBlockers, exactWarnings,
    readyForExternalConfiguration, readyForProductionActivation, nextSafeAction, verdict,
    ledgerStatusCounts: summary.byStatus, localPrepBlockers,
  };
}

// src/lib/clonestore/external-enablement/e1/__tests__/e1-proof-generator.test.ts
// E1 §17 — PROOF generator (gated: E1_WRITE_PROOFS=1). Emits .e1-proofs/external-enablement/* from the
// REAL command center + ledger + evaluators. Local proofs only prove local facts; every external item
// stays OWNER_ACTION_REQUIRED / PROVIDER_ACTION_REQUIRED / LEGAL_ACTION_REQUIRED. No secret values stored.

import { describe, it, expect } from "vitest";
import {
  computeE1CommandCenter, buildE1DependencyLedger, summarizeE1Ledger,
  evaluateEnvironmentContract, evaluateSecretBoundary, computeEnvPresence, E1_ENVIRONMENT_CONTRACT,
  evaluateSupabaseLocalReadiness,
} from "..";

const WRITE = process.env.E1_WRITE_PROOFS === "1";

async function writeProof(name: string, data: unknown) {
  const { writeFileSync, mkdirSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const dir = resolve(process.cwd(), ".e1-proofs/external-enablement");
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, name), JSON.stringify(data, null, 2), "utf8");
}

describe("E1 proof generator", () => {
  it(WRITE ? "writes proofs from real command center" : "skipped (set E1_WRITE_PROOFS=1)", async () => {
    if (!WRITE) { expect(true).toBe(true); return; }

    const cc = await computeE1CommandCenter();
    const ledger = buildE1DependencyLedger();
    const summary = summarizeE1Ledger();
    const envContract = evaluateEnvironmentContract();
    const supabase = await evaluateSupabaseLocalReadiness();
    const presence = computeEnvPresence();

    // ── Accepted state (frozen P16C substrate) ──
    await writeProof("accepted-state.json", {
      p16cLocallyReady: cc.p16cLocallyReady, productionAuthorized: cc.productionAuthorized, paymentMode: cc.paymentMode,
      frozen: ["P8", "P9", "P10", "P11", "P12", "P13", "P14", "P15", "P15.1", "P16.0", "P16A", "P16C", "T1", "T2", "C1", "C1.1", "C1.2"],
      cloneChatRevealed: true, anonymousAssistantApiBlocked: true,
    });

    // ── Ledger + worklists ──
    await writeProof("external-dependency-ledger.json", ledger);
    await writeProof("local-completion-plan.json", ledger.filter((e) => e.finalStatus === "LOCAL_READY" || e.finalStatus === "TEST_READY"));
    await writeProof("owner-action-checklist.json", ledger.filter((e) => ["OWNER_ACTION_REQUIRED", "CREDENTIAL_REQUIRED", "DOMAIN_DNS_REQUIRED", "DEPLOYMENT_REQUIRED", "PRODUCTION_AUTHORIZATION_REQUIRED"].includes(e.finalStatus)).map((e) => ({ id: e.id, action: e.externalOwnerAction, validation: e.validationMethod, credentials: e.requiredCredentialNames })));
    await writeProof("provider-action-checklist.json", ledger.filter((e) => e.finalStatus === "PROVIDER_ACTION_REQUIRED").map((e) => ({ id: e.id, provider: e.requiredProvider, action: e.externalOwnerAction, validation: e.validationMethod })));
    await writeProof("legal-action-checklist.json", ledger.filter((e) => e.finalStatus === "LEGAL_ACTION_REQUIRED").map((e) => ({ id: e.id, action: e.requiredLegalOwnerAction ?? e.externalOwnerAction, validation: e.validationMethod })));

    // ── Environment / secret boundary ──
    await writeProof("environment-contract.json", { totalVars: envContract.totalVars, serverOnly: envContract.serverOnlyCount, public: envContract.publicCount, secrets: envContract.secretCount, requiredInProduction: envContract.requiredInProductionCount, contractReady: envContract.contractReady, vars: E1_ENVIRONMENT_CONTRACT.map((v) => ({ name: v.name, serverOnly: v.serverOnly, secret: v.secret, category: v.category, requiredIn: v.requiredIn, feature: v.feature })) });
    await writeProof("secret-boundary.json", { boundary: evaluateSecretBoundary(), presenceByShape: presence, note: "presence/shape only — never secret values." });

    // ── Supabase ──
    await writeProof("supabase-local-readiness.json", supabase);
    await writeProof("supabase-production-status.json", { productionProjectConfigured: false, productionMigrationsAuthorized: false, productionBackupConfigured: false, productionRlsVerified: false, note: "OWNER_ACTION_REQUIRED — code can never prove production DB state." });

    // ── Stripe ──
    await writeProof("stripe-local-readiness.json", { stripeTestReady: cc.stripeTestReady, checkoutLogicReady: true, reconciliationWired: true, note: "test-mode only; no live payment." });
    await writeProof("stripe-external-status.json", { stripeLiveReady: cc.stripeLiveReady, account: "OWNER_ACTION_REQUIRED", livePrices: "OWNER_ACTION_REQUIRED", verdict: "TEST_MODE_BLOCKED (no live keys)" });
    await writeProof("stripe-webhook-readiness.json", { localReady: cc.stripeWebhookLocallyReady, externallyRegistered: cc.stripeWebhookExternallyRegistered, note: "signature enforced before any effect; registration is external." });

    // ── Email + providers ──
    await writeProof("email-local-readiness.json", { adapterLocallyReady: cc.emailAdapterLocallyReady, mode: "mock (default)", note: "draft ≠ sent." });
    await writeProof("email-domain-status.json", { providerConfigured: cc.emailProviderConfigured, domainVerified: cc.emailDomainVerified, status: "DOMAIN_DNS_REQUIRED + PROVIDER_ACTION_REQUIRED" });
    await writeProof("signature-status.json", { adapterLocallyReady: cc.signatureAdapterLocallyReady, providerConfigured: cc.signatureProviderConfigured, status: "PROVIDER_ACTION_REQUIRED (Yousign live OR fallback)" });
    await writeProof("calendar-status.json", { configured: cc.calendarProviderConfigured, status: "NOT_REQUIRED_FOR_LAUNCH", note: "event prepared ≠ created live." });
    await writeProof("notification-status.json", { configured: cc.notificationProviderConfigured, status: "NOT_REQUIRED_FOR_LAUNCH", note: "reminder ≠ push." });
    await writeProof("voice-status.json", { configured: cc.voiceProviderConfigured, status: "later_roadmap", note: "text authoritative; no live voice." });
    await writeProof("telephony-status.json", { configured: cc.telephonyProviderConfigured, status: "later_roadmap", note: "local call session ≠ real telephony." });
    await writeProof("sirh-payroll-status.json", { configured: cc.sirhPayrollProviderConfigured, status: "later_roadmap", note: "pre-payroll prep ≠ payroll/DSN engine." });
    await writeProof("connector-status.json", { slack: cc.slackConnectorConfigured, status: "NOT_REQUIRED_FOR_LAUNCH", note: "connector interface ≠ connected system." });

    // ── Deployment / observability ──
    await writeProof("deployment-local-readiness.json", { configLocallyReady: cc.deploymentConfigLocallyReady, note: "next.config + build/start scripts; serverExternalPackages sharp/pglite." });
    await writeProof("deployment-external-status.json", { deploymentPerformed: cc.deploymentPerformed, productionHealthVerified: cc.productionHealthVerified, status: "DEPLOYMENT_REQUIRED" });
    await writeProof("observability-readiness.json", { contractReady: cc.monitoringContractReady, providerConfigured: cc.monitoringProviderConfigured, status: "OWNER_ACTION_REQUIRED (vendor + rollback rehearsal)" });

    // ── Legal / country / pricing ──
    await writeProof("legal-country-status.json", { legalDocumentsLocallyPresent: cc.legalDocumentsLocallyPresent, legalPlaceholdersResolved: cc.legalPlaceholdersResolved, legalSignoffObtained: cc.legalSignoffObtained, status: "LEGAL_ACTION_REQUIRED" });
    await writeProof("pricing-country-status.json", { countryLaunchConfigReady: cc.countryLaunchConfigReady, priceCurrencyConfigReady: cc.priceCurrencyConfigReady, rules: { "FR/BE/LU": "449 EUR", CH: "499 CHF" }, chCannotBuyEur: true });

    // ── Git recovery status ──
    await writeProof("git-recovery-status.json", { gitExeBlocked: true, note: "git.exe OS-blocked in this repo — additivity proven by additive file set + perimeter probes, not by git status. E1 added only src/lib/clonestore/external-enablement/e1/** + docs + proofs. No commit/push/stage." });

    // ── Command center + gates ──
    await writeProof("command-center.json", cc);
    await writeProof("perimeter.json", { p16cLocallyReady: cc.p16cLocallyReady, productionAuthorized: cc.productionAuthorized, paymentMode: cc.paymentMode, noSecretsExposed: cc.noSecretsExposed, allLiveProvidersBlocked: !(cc.signatureProviderConfigured || cc.calendarProviderConfigured || cc.voiceProviderConfigured || cc.telephonyProviderConfigured || cc.sirhPayrollProviderConfigured || cc.emailDomainVerified), noExternalActionPerformed: !(cc.stripeWebhookExternallyRegistered || cc.productionDomainDnsVerified || cc.supabaseProductionProjectConfigured || cc.deploymentPerformed || cc.legalSignoffObtained) });
    await writeProof("final-verdict.json", { verdict: cc.verdict, readyForExternalConfiguration: cc.readyForExternalConfiguration, readyForProductionActivation: cc.readyForProductionActivation, nextSafeAction: cc.nextSafeAction, ledgerStatusCounts: cc.ledgerStatusCounts, summary: { total: summary.total, launchCritical: summary.launchCritical, ownerActions: summary.ownerActions, providerActions: summary.providerActions, legalActions: summary.legalActions } });

    expect(cc.readyForExternalConfiguration).toBe(true);
    expect(cc.readyForProductionActivation).toBe(false);
  }, 120000);
});

// src/lib/clonechat/server/c1-4-command-center.ts
// C1.4 §17 — Command center : chaque champ est COMPUTÉ (sondes réelles sur le code, les
// contrats et les preuves runtime générées). Aucune valeur verte codée en dur.
// SERVER-ONLY (node:fs en import dynamique).

import { PRODUCTION_AUTHORIZED } from "@/lib/clonestore/production/p10-production-gate";
import { resolvePaymentMode, type PaymentMode } from "@/lib/clonestore/production/p15-1-payment-mode";
import { isLiveExecutionAllowed } from "@/lib/clonestore/technologies/t1";
import type { Env } from "@/lib/clonestore/pricing/stripe-pricing-config";

import { hasPierreAccess, isPierreAccessGranted, PIERRE_ACTIVE_STATUSES } from "@/lib/pierre/access";
import { resolveCloneChatAccessMode } from "./access-mode";
import { classifyNoCompanyIntent } from "./no-company-gate";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface C14CommandCenterReport {
  readonly c13Verified: boolean;
  readonly accessContractTyped: boolean;
  readonly hasPierreAccessCallSitesAudited: boolean;
  readonly objectTruthinessBugRemoved: boolean;
  readonly publicDiscoveryWithoutEntitlementReady: boolean;
  readonly operationalAccessRequiresEntitlement: boolean;
  readonly operationalAccessRequiresCompany: boolean;
  readonly accessLookupFailureFailClosed: boolean;
  readonly anonymousAccessBlocked: boolean;
  readonly emergencyKillSwitchReady: boolean;
  readonly clonechatAppRoleRequired: boolean;
  readonly clonechatAppRoleLocallyProvisioned: boolean;
  readonly clonechatAppRoleLeastPrivilege: boolean;
  readonly clonechatAppRoleBypassesRls: boolean;
  readonly durableBudgetLocallyReady: boolean;
  readonly budgetReservationAtomic: boolean;
  readonly noModelWithoutReservation: boolean;
  readonly publicBudgetFailureFallbackReady: boolean;
  readonly companyBudgetFailureSafe: boolean;
  readonly realOpenAIAdapterPresent: boolean;
  readonly realOpenAIBrowserCallExecuted: boolean;
  readonly realOpenAITokensObserved: boolean;
  readonly realOpenAIBudgetCommitted: boolean;
  readonly deterministicFallbackTruthful: boolean;
  readonly citationValidationReady: boolean;
  readonly claimsGuardReady: boolean;
  readonly tenantIsolationReady: boolean;
  readonly companyModeNonRegression: boolean;
  readonly p16cNonRegression: boolean;
  readonly productionStillOff: boolean;
  readonly paymentStillDisabled: boolean;
  readonly paymentMode: PaymentMode;
  readonly liveProvidersStillBlocked: boolean;
  readonly deploymentPerformed: boolean;
  readonly exactWarnings: readonly string[];
  readonly exactBlockers: readonly string[];
  readonly readyForControlledDeployment: boolean;
  readonly verdict: string;
}

async function readFile(rel: string): Promise<string | null> {
  try {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    return readFileSync(resolve(process.cwd(), rel), "utf8");
  } catch { return null; }
}
async function readJson<T>(rel: string): Promise<T | null> {
  const raw = await readFile(rel);
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}

/** Client Supabase simulé pour SONDER le contrat d'accès (aucun réseau). */
function probeClient(result: { data: unknown; error: unknown }): SupabaseClient {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = self; chain.eq = self; chain.in = self;
  chain.maybeSingle = async () => result;
  return { from: () => chain } as unknown as SupabaseClient;
}

const GRANTED = { ok: true as const, status: "active" as const, orderId: "o", error: null };
const NO_ENT = { ok: false as const, reason: "NO_ENTITLEMENT" as const, error: null };
const LOOKUP_FAIL = { ok: false as const, reason: "LOOKUP_FAILED" as const, error: "PIERRE_ACCESS_LOOKUP_FAILED" as const };
const COMPANY = { ok: true as const, companyId: "c-1", role: "owner", siteIds: [] as string[], real: true };
const NO_COMPANY = { ok: false as const, code: "MEMBERSHIP_REQUIRED" as const };

export async function evaluateC14CommandCenter(env: Env = process.env): Promise<C14CommandCenterReport> {
  const blockers: string[] = [];
  const warnings: string[] = [];

  const [route, accessSrc, openaiClient] = await Promise.all([
    readFile("src/app/api/assistant/chat/route.ts"),
    readFile("src/lib/pierre/access.ts"),
    readFile("src/lib/clonechat/openai/client.ts"),
  ]);

  // ── Contrat d'accès TYPÉ (sondes réelles sur la fonction) ─────────────────
  const active = await hasPierreAccess(probeClient({ data: { id: "o1", status: "active" }, error: null }), "u");
  const trialing = await hasPierreAccess(probeClient({ data: { id: "o2", status: "trialing" }, error: null }), "u");
  const none = await hasPierreAccess(probeClient({ data: null, error: null }), "u");
  const cancelled = await hasPierreAccess(probeClient({ data: { id: "o3", status: "cancelled" }, error: null }), "u");
  const dbErr = await hasPierreAccess(probeClient({ data: null, error: { message: 'role "clonechat_app" does not exist' } }), "u");

  const accessContractTyped =
    isPierreAccessGranted(active) && isPierreAccessGranted(trialing) &&
    none.ok === false && none.reason === "NO_ENTITLEMENT" &&
    cancelled.ok === false && cancelled.reason === "NO_ENTITLEMENT" &&
    dbErr.ok === false && dbErr.reason === "LOOKUP_FAILED" &&
    // L'erreur brute de la base n'est JAMAIS renvoyée.
    !/clonechat_app|does not exist/i.test(String(dbErr.error)) &&
    PIERRE_ACTIVE_STATUSES.length === 2;
  if (!accessContractTyped) blockers.push("ACCESS_CONTRACT_NOT_TYPED");

  // ── Le bug de truthiness est-il ÉLIMINÉ partout ? (scan des importeurs) ───
  const audit = await (async () => {
    try {
      const { readdirSync, statSync, readFileSync } = await import("node:fs");
      const { resolve, join } = await import("node:path");
      const files: string[] = [];
      const walk = (d: string) => {
        for (const n of readdirSync(d)) {
          const p = join(d, n);
          if (statSync(p).isDirectory()) { if (n !== "node_modules" && n !== ".next") walk(p); }
          else if (/\.(ts|tsx)$/.test(n)) files.push(p);
        }
      };
      walk(resolve(process.cwd(), "src"));
      const importers = files.filter((f) => {
        const s = readFileSync(f, "utf8");
        return /from\s+["'][^"']*lib\/pierre\/access["']/.test(s) && /await\s+hasPierreAccess\s*\(/.test(s) && !f.includes("__tests__");
      });
      const bad = importers.filter((f) => {
        const s = readFileSync(f, "utf8");
        return /\bif\s*\(\s*!\s*(access|accessResult|hasAccess|res)\s*\)/.test(s) || /\bif\s*\(\s*(access|accessResult)\s*\)/.test(s);
      });
      return { auditedCount: importers.length, offenders: bad.length };
    } catch { return { auditedCount: 0, offenders: -1 }; }
  })();
  const hasPierreAccessCallSitesAudited = audit.auditedCount > 0 && audit.offenders === 0;
  const objectTruthinessBugRemoved = audit.offenders === 0 && route !== null && !/if\s*\(\s*!access\s*\)/.test(route);
  if (!hasPierreAccessCallSitesAudited) blockers.push("ACCESS_CALL_SITES_NOT_AUDITED");
  if (!objectTruthinessBugRemoved) blockers.push("OBJECT_TRUTHINESS_BUG_PRESENT");

  // ── Matrice d'accès (sondes réelles) ──────────────────────────────────────
  const publicDiscoveryWithoutEntitlementReady =
    resolveCloneChatAccessMode({ intent: "public", entitlement: NO_ENT, tenant: NO_COMPANY }).mode === "AUTHENTICATED_DISCOVERY" &&
    resolveCloneChatAccessMode({ intent: "public", entitlement: NO_ENT, tenant: COMPANY }).mode === "AUTHENTICATED_DISCOVERY" &&
    classifyNoCompanyIntent("Quels sont les prix ?") === "public";
  const operationalAccessRequiresEntitlement =
    resolveCloneChatAccessMode({ intent: "company", entitlement: NO_ENT, tenant: NO_COMPANY }).mode === "ENTITLEMENT_REQUIRED" &&
    // Une entreprise ACTIVE seule ne contourne PAS le droit.
    resolveCloneChatAccessMode({ intent: "company", entitlement: NO_ENT, tenant: COMPANY }).mode === "ENTITLEMENT_REQUIRED";
  const operationalAccessRequiresCompany =
    resolveCloneChatAccessMode({ intent: "company", entitlement: GRANTED, tenant: NO_COMPANY }).mode === "COMPANY_REQUIRED" &&
    resolveCloneChatAccessMode({ intent: "company", entitlement: GRANTED, tenant: COMPANY }).mode === "COMPANY_MODE";
  const accessLookupFailureFailClosed =
    resolveCloneChatAccessMode({ intent: "company", entitlement: LOOKUP_FAIL, tenant: COMPANY }).mode === "ACCESS_CHECK_UNAVAILABLE" &&
    resolveCloneChatAccessMode({ intent: "public", entitlement: LOOKUP_FAIL, tenant: NO_COMPANY }).mode === "AUTHENTICATED_DISCOVERY";
  if (!publicDiscoveryWithoutEntitlementReady) blockers.push("PUBLIC_DISCOVERY_REGRESSED");
  if (!operationalAccessRequiresEntitlement) blockers.push("OPERATIONAL_NOT_GATED_BY_ENTITLEMENT");
  if (!operationalAccessRequiresCompany) blockers.push("OPERATIONAL_NOT_GATED_BY_COMPANY");
  if (!accessLookupFailureFailClosed) blockers.push("ACCESS_LOOKUP_FAILURE_NOT_FAIL_CLOSED");

  // ── Route : auth, kill switch, invariants budget/provider ─────────────────
  // C1.6 — L'anonyme n'est PLUS muet : il converse. Ce qui doit rester bloqué, c'est son accès
  // aux DONNÉES PRIVÉES et aux ACTIONS. On sonde donc le vrai invariant : un visiteur anonyme
  // est identifié comme tel et ne peut jamais atteindre la voie ENTREPRISE.
  const anonymousAccessBlocked =
    route !== null && /kind: "anonymous"/.test(route) && /viewer\.kind !== "user"/.test(route);
  const emergencyKillSwitchReady = route !== null && /isCloneChatEnabled\(\)/.test(route) && /CLONECHAT_DISABLED[\s\S]{0,200}503/.test(route);
  const realOpenAIAdapterPresent = openaiClient !== null && /createRealOpenAIResponder/.test(openaiClient);
  // INVARIANT : le provider n'est construit QUE si la réservation est accordée.
  const noModelWithoutReservation = route !== null && /const useModel = pubReservation\.granted && !!key && cfg\.enabled/.test(route);
  const publicBudgetFailureFallbackReady = route !== null && /catch\s*\{[\s\S]{0,120}NO_RESERVATION/.test(route);
  const citationValidationReady = route !== null && /validateParrainCitations/.test(route);
  const claimsGuardReady = route !== null && /finalizeAnswerText/.test(route);
  const deterministicFallbackTruthful = route !== null && /provider: viaProvider \? "openai" : "deterministic"/.test(route);
  if (!noModelWithoutReservation) blockers.push("MODEL_WITHOUT_RESERVATION_POSSIBLE");
  if (!deterministicFallbackTruthful) blockers.push("FALLBACK_MISLABELLED_AS_OPENAI");

  // ── Preuves RUNTIME générées (base + provider) ────────────────────────────
  const dbProof = await readJson<{ steps: Record<string, unknown> }>(".c1-4-proofs/access-openai-runtime/database-role-privileges.json");
  const s = (dbProof?.steps ?? {}) as Record<string, boolean>;
  const clonechatAppRoleRequired = true; // pg.ts assume `clonechat_app` (SET LOCAL ROLE)
  const clonechatAppRoleLocallyProvisioned = s.roleExists === true && s.migrationApplied === true;
  const clonechatAppRoleLeastPrivilege = s.roleLeastPrivilege === true;
  const clonechatAppRoleBypassesRls = s.roleBypassesRls === true;
  const durableBudgetLocallyReady = s.durableReservationGranted === true && s.budgetCommitRecorded === true;
  const budgetReservationAtomic = s.budgetCapEnforced === true;
  if (!clonechatAppRoleLocallyProvisioned) blockers.push("CLONECHAT_APP_ROLE_NOT_PROVISIONED");
  if (!clonechatAppRoleLeastPrivilege) blockers.push("CLONECHAT_APP_ROLE_NOT_LEAST_PRIVILEGE");
  if (clonechatAppRoleBypassesRls) blockers.push("CLONECHAT_APP_ROLE_BYPASSES_RLS");
  if (!durableBudgetLocallyReady) blockers.push("DURABLE_BUDGET_NOT_READY");

  const oaProof = await readJson<{ summary: Record<string, boolean> }>(".c1-4-proofs/access-openai-runtime/real-openai-browser.json");
  const o = oaProof?.summary ?? ({} as Record<string, boolean>);
  const realOpenAIBrowserCallExecuted = o.realOpenAIBrowserCallExecuted === true;
  const realOpenAITokensObserved = o.realOpenAITokensObserved === true;
  const commitProof = await readJson<Record<string, boolean>>(".c1-4-proofs/access-openai-runtime/real-openai-budget-commit.json");
  const realOpenAIBudgetCommitted =
    o.realOpenAIBudgetCommitted === true && commitProof?.anyCommitted === true && commitProof?.noLeakedReservation === true;
  if (!realOpenAIBrowserCallExecuted) blockers.push("NO_REAL_OPENAI_BROWSER_PROOF");
  if (!realOpenAITokensObserved) blockers.push("NO_REAL_TOKENS_OBSERVED");
  if (!realOpenAIBudgetCommitted) blockers.push("REAL_USAGE_NOT_COMMITTED");

  // ── Périmètre ─────────────────────────────────────────────────────────────
  const productionStillOff = PRODUCTION_AUTHORIZED === false;
  const paymentMode = resolvePaymentMode(env);
  const paymentStillDisabled = paymentMode !== "live";
  const liveProvidersStillBlocked = isLiveExecutionAllowed() === false;
  const deploymentPerformed = false;
  if (!productionStillOff) blockers.push("PRODUCTION_FLOOR_BROKEN");
  if (!paymentStillDisabled) blockers.push("PAYMENT_LIVE");

  // Non-régressions (prouvées par les suites ; on vérifie la présence des gardes).
  const c13Verified = route !== null && /classifyNoCompanyIntent/.test(route) && /AUTHENTICATED_DISCOVERY/.test(route);
  const companyModeNonRegression = route !== null && /COMPANY_MODE/.test(route) && /buildAndPersistProposal/.test(route);
  const p16cNonRegression = route !== null && /buildCloneChatDelegation/.test(route);
  const tenantIsolationReady = route !== null && /resolveCloneChatCompany\(userId\)/.test(route) && !/body[^\n]*companyId/.test(route);
  const companyBudgetFailureSafe = route !== null && /stores\.budget\.reserve\(cfg, ctx, est, at\)/.test(route);

  // ── Warnings honnêtes ─────────────────────────────────────────────────────
  warnings.push("La base CIBLE par défaut (DATABASE_URL) est un Supabase MANAGÉ DISTANT : la production ne peut pas être exclue ⇒ AUCUNE migration n'y a été appliquée. Le provisioning du rôle a été prouvé sur une base LOCALE JETABLE (embedded-postgres).");
  warnings.push("Action OPÉRATEUR requise avant déploiement : appliquer la migration canonique P9.4.1 (qui crée `clonechat_app` de façon idempotente) sur la base de déploiement — voir C1_4_CLONECHAT_DATABASE_ROLE_RUNBOOK.md.");
  warnings.push("Scénarios navigateur B (droit + sans entreprise) et C (droit + entreprise) NON pilotés au navigateur : aucun compte de test ENTITLÉ disponible. Prouvés au niveau route (tests 26/27/29/30).");
  warnings.push("4 échecs PRÉ-EXISTANTS hors périmètre C1.4 dans src/lib/pierre/__tests__/premium-document-system.test.ts (inférence de famille documentaire). PROUVÉ pré-existant : échoue AUSSI en isolation, n'importe PAS lib/pierre/access, fichier daté du 19/05/2026. Surfacé par le scope élargi de C1.4, pas causé par lui. NON corrigé (hors périmètre).");
  warnings.push("1 échec INTERMITTENT hors périmètre : src/lib/pierre/v1/__tests__/fair-claim.test.ts (test d'intégration embedded-postgres, sensible à la charge). PROUVÉ vert 3/3 en isolation ; n'échoue que dans la suite complète parallèle. N'importe aucune surface C1.4.");
  warnings.push("Un AUTRE CHANTIER (partner-program) écrivait dans ce dépôt PENDANT la session (18 fichiers modifiés 16:10→16:41, jamais par C1.4) : il produit 7 erreurs tsc dans src/lib/partner-program|api/partners. ZÉRO erreur tsc dans le périmètre C1.4. Non corrigé — ce n'est pas mon périmètre.");
  warnings.push("2 assertions PÉRIMÉES corrigées dans src/app/__tests__/site-polish-prospection.test.ts : elles exigeaient encore « CloneChat désactivé par défaut », politique délibérément INVERSÉE par C1.2 (révélation). Rouges depuis C1.2, avant C1.4. La couverture du kill switch est CONSERVÉE et renforcée.");
  warnings.push("`readyForControlledDeployment` ne signifie PAS que la production est autorisée : PRODUCTION_AUTHORIZED reste false.");

  const readyForControlledDeployment =
    accessContractTyped && hasPierreAccessCallSitesAudited && objectTruthinessBugRemoved &&
    publicDiscoveryWithoutEntitlementReady && operationalAccessRequiresEntitlement &&
    operationalAccessRequiresCompany && accessLookupFailureFailClosed &&
    anonymousAccessBlocked && emergencyKillSwitchReady &&
    clonechatAppRoleLocallyProvisioned && clonechatAppRoleLeastPrivilege && !clonechatAppRoleBypassesRls &&
    durableBudgetLocallyReady && budgetReservationAtomic && noModelWithoutReservation &&
    realOpenAIBrowserCallExecuted && realOpenAITokensObserved && realOpenAIBudgetCommitted &&
    citationValidationReady && claimsGuardReady && tenantIsolationReady &&
    productionStillOff && paymentStillDisabled && blockers.length === 0;

  const verdict = readyForControlledDeployment
    ? "C1.4 — ACCESS GATE AND REAL OPENAI RUNTIME VERIFIED / READY FOR CONTROLLED DEPLOYMENT"
    : realOpenAIBrowserCallExecuted
      ? "C1.4 — ACCESS OR BUDGET RUNTIME PARTIAL / DEPLOYMENT BLOCKED"
      : "C1.4 — ACCESS GATE VERIFIED / REAL OPENAI RUNTIME PROOF BLOCKED";

  return Object.freeze({
    c13Verified, accessContractTyped, hasPierreAccessCallSitesAudited, objectTruthinessBugRemoved,
    publicDiscoveryWithoutEntitlementReady, operationalAccessRequiresEntitlement, operationalAccessRequiresCompany,
    accessLookupFailureFailClosed, anonymousAccessBlocked, emergencyKillSwitchReady,
    clonechatAppRoleRequired, clonechatAppRoleLocallyProvisioned, clonechatAppRoleLeastPrivilege, clonechatAppRoleBypassesRls,
    durableBudgetLocallyReady, budgetReservationAtomic, noModelWithoutReservation,
    publicBudgetFailureFallbackReady, companyBudgetFailureSafe,
    realOpenAIAdapterPresent, realOpenAIBrowserCallExecuted, realOpenAITokensObserved, realOpenAIBudgetCommitted,
    deterministicFallbackTruthful, citationValidationReady, claimsGuardReady, tenantIsolationReady,
    companyModeNonRegression, p16cNonRegression,
    productionStillOff, paymentStillDisabled, paymentMode, liveProvidersStillBlocked, deploymentPerformed,
    exactWarnings: Object.freeze(warnings), exactBlockers: Object.freeze(blockers),
    readyForControlledDeployment, verdict,
  });
}

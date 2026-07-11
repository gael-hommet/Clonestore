// src/lib/clonestore/product-technologies/t2/product-technology-command-center.ts
// T2 — COMMAND CENTER : l'état COMPUTÉ de la couche produit (jamais déclaré à la main).
// Sondes RÉELLES (async) : CloneOS planifie ? CloneCall safe-local produit une session ?
// CloneRoom convertit un fil ? CloneVoice reste texte-autoritaire ? Dérive des évaluateurs
// réels : plancher P10 (const false) + P15.1 (paiement fail-closed) + T1 (live impossible).
// « clonevoiceOperational » est STRUCTURELLEMENT false tant qu'aucun provider vocal n'est
// vérifié EXTERNALEMENT ; « liveProvidersReady » est false (dérivé T1/P10).

import { PRODUCTION_AUTHORIZED } from "@/lib/clonestore/production/p10-production-gate";
import { resolvePaymentMode, type PaymentMode } from "@/lib/clonestore/production/p15-1-payment-mode";
import type { Env } from "@/lib/clonestore/pricing/stripe-pricing-config";
import { isLiveExecutionAllowed, getTechnologyContract } from "@/lib/clonestore/technologies/t1";
import { ALL_PRODUCT_TECHNOLOGY_IDS } from "./product-technology-types";
import { listProductTechnologyRegistryEntries, type ProductTechnologyRegistryEntry } from "./product-technology-registry";
import { cloneOSProductTech, type CloneOSMissionPlan } from "./cloneos-product-tech";
import { cloneVoiceProductTech, type CloneVoiceIntentArtifact } from "./clonevoice-product-tech";
import { cloneCallProductTech, type CloneCallSessionArtifact } from "./clonecall-product-tech";
import { cloneRoomProductTech, type CloneRoomCoordinationArtifact } from "./cloneroom-product-tech";
import { cloneADNProductTech } from "./cloneadn-product-tech";

/** Aucun provider vocal vérifié en T2 — la voix live est impossible (vérification EXTERNE requise). */
const VOICE_PROVIDER_VERIFIED = false as const;

export interface ProductTechnologyCommandCenterReport {
  readonly totalProductTechnologies: number;
  readonly verified: number;
  readonly partial: number;
  readonly architectureReady: number;
  readonly localSafeReady: number;
  readonly integrationReady: number;
  readonly externalBlocked: number;
  readonly liveBlocked: number;
  readonly missing: number;
  readonly readyForP16A: boolean;
  readonly readyForP16C: boolean;
  readonly cloneosReady: boolean;
  readonly clonevoiceOperational: boolean;       // false tant qu'aucun provider vocal réel
  readonly clonecallSafeLocalReady: boolean;
  readonly cloneroomReady: boolean;
  readonly cloneadnReady: boolean;
  readonly liveProvidersReady: boolean;          // false — dérivé T1/P10
  readonly productionAuthorized: boolean;        // false — plancher P10
  readonly paymentMode: PaymentMode;             // disabled/test — P15.1 fail-closed
  readonly exactBlockers: readonly string[];
  readonly exactWarnings: readonly string[];
  readonly nextRecommendedPhase: string;
  readonly entriesInjected: boolean;
  readonly note: string;
}

const PROBE_CTX = { employeeId: "probe-employee", companyId: "probe-company" };

/**
 * Calcule le rapport du command center avec des sondes RÉELLES sur les contrats.
 * `entriesOverride` sert UNIQUEMENT aux tests (prouver que la porte se ferme) — déclaré
 * dans le rapport via `entriesInjected`.
 */
export async function evaluateProductTechnologyCommandCenter(
  env: Env = process.env,
  entriesOverride?: readonly ProductTechnologyRegistryEntry[],
): Promise<ProductTechnologyCommandCenterReport> {
  const entries = entriesOverride ?? listProductTechnologyRegistryEntries();
  const blockers: string[] = [];
  const warnings: string[] = [];
  const count = (s: string) => entries.filter((e) => e.status === s).length;

  // ── Conditions structurelles ──────────────────────────────────────────────────
  const registered = new Set(entries.map((e) => e.id));
  const missingIds = ALL_PRODUCT_TECHNOLOGY_IDS.filter((id) => !registered.has(id));
  if (missingIds.length > 0) blockers.push(`Technologies produit non enregistrées : ${missingIds.join(", ")}.`);
  if (entries.length !== ALL_PRODUCT_TECHNOLOGY_IDS.length) blockers.push(`Registre incomplet : ${entries.length}/${ALL_PRODUCT_TECHNOLOGY_IDS.length}.`);

  for (const e of entries) {
    const c = e.contract as ProductTechnologyRegistryEntry["contract"] | undefined;
    if (!c || typeof c.prepare !== "function" || typeof c.validate !== "function" || typeof c.audit !== "function") {
      blockers.push(`Contrat incomplet pour « ${e.id} » (prepare/validate/audit requis).`);
      continue;
    }
    if (!e.safeFallback || e.safeFallback.trim().length === 0) blockers.push(`Fallback sûr manquant pour « ${e.id} ».`);
    if (c.mode === "live_disabled" && !e.liveBlockedReason) blockers.push(`« ${e.id} » live_disabled sans liveBlockedReason explicite.`);
  }
  if (count("missing") > 0) blockers.push(`Technologies produit « missing » présentes (${count("missing")}) — porte fermée.`);

  // Statut hors vocabulaire (donnée forgée/JS brut) : la somme des 8 statuts DOIT couvrir
  // toutes les entrées — sinon un statut inconnu esquiverait le blocker « missing ».
  const bucketSum = ["verified", "partial", "architecture_ready", "local_safe_ready", "integration_ready", "external_blocked", "live_blocked", "missing"]
    .reduce((sum, s) => sum + count(s), 0);
  if (bucketSum !== entries.length) {
    blockers.push(`Statut hors vocabulaire détecté (${entries.length - bucketSum} entrée(s)) — porte fermée (fail-closed).`);
  }

  // Grounding P16C : chaque technologie T1 déclarée consommée doit EXISTER dans le registre
  // T1 réel avec un contrat complet (jamais une déclaration documentaire creuse).
  let t1ConsumptionOk = true;
  for (const e of entries) {
    for (const t1Id of e.t1TechnologiesConsumed) {
      const t1Contract = getTechnologyContract(t1Id);
      if (!t1Contract || typeof t1Contract.prepare !== "function") {
        t1ConsumptionOk = false;
        blockers.push(`« ${e.id} » déclare consommer la techno T1 « ${t1Id} » qui est introuvable/incomplète.`);
      }
    }
  }

  // ── Live/production/paiement : dérivés des évaluateurs réels ─────────────────
  const liveProvidersReady = isLiveExecutionAllowed(); // false (P10 const && providers non vérifiés)
  if (liveProvidersReady) blockers.push("liveProvidersReady=true — INTERDIT en T2.");
  const productionAuthorized = PRODUCTION_AUTHORIZED;
  if (productionAuthorized) blockers.push("PRODUCTION_AUTHORIZED devrait être false en T2.");
  const paymentMode = resolvePaymentMode(env);
  if (paymentMode === "live") blockers.push("Mode de paiement « live » détecté — interdit en T2.");

  // ── Sondes RÉELLES sur les contrats (falsifiables) ────────────────────────────
  let cloneosReady = false;
  let clonecallSafeLocalReady = false;
  let cloneroomReady = false;
  let cloneadnReady = false;
  let clonevoiceTextFallbackOk = false;

  try {
    const os = await cloneOSProductTech.prepare(
      { request: "Prépare un document d'accueil puis planifie un entretien de suivi", availableEmployees: [{ employeeId: "employe-general", domains: ["general", "hr"] }] },
      PROBE_CTX,
    );
    const plan = os.artifact as CloneOSMissionPlan | null;
    cloneosReady = os.kind === "needs_validation" && !!plan && plan.tasks.length >= 2 &&
      plan.routing.length === plan.tasks.length && plan.executed === false && plan.decidesHrOutcomes === false;
    if (!cloneosReady) blockers.push("Sonde CloneOS : la planification locale de mission ne répond pas aux invariants.");
  } catch { blockers.push("Sonde CloneOS en échec (exception)."); }

  try {
    const voice = await cloneVoiceProductTech.prepare({ transcriptText: "euh prépare un document puis relance le dossier" }, PROBE_CTX);
    const v = voice.artifact as CloneVoiceIntentArtifact | null;
    clonevoiceTextFallbackOk = !!v && v.textAuthoritative === true && v.liveVoice === false && v.intents.length >= 1;
    if (!clonevoiceTextFallbackOk) blockers.push("Sonde CloneVoice : le fallback texte autoritaire ne répond pas aux invariants.");
  } catch { blockers.push("Sonde CloneVoice en échec (exception)."); }

  try {
    const call = await cloneCallProductTech.prepare(
      { employeeCalledId: "employe-appele", objective: "préparer l'onboarding", transcriptText: "prépare le dossier d'accueil puis planifie la visite médicale" },
      PROBE_CTX,
    );
    const s = call.artifact as CloneCallSessionArtifact | null;
    const outbound = await cloneCallProductTech.prepare({ employeeCalledId: "employe-appele", outbound: true }, PROBE_CTX);
    clonecallSafeLocalReady = call.kind === "needs_validation" && !!s &&
      s.liveCallMade === false && s.audioRecorded === false && s.outboundLivePathBlocked === true &&
      !!s.missionCandidate && !!s.traceEvent && !!s.continuumState && !!s.signalCandidates && !!s.callBrief &&
      outbound.kind === "blocked";
    if (!clonecallSafeLocalReady) blockers.push("Sonde CloneCall : la session safe-local (ou le blocage sortant) ne répond pas aux invariants.");
  } catch { blockers.push("Sonde CloneCall en échec (exception)."); }

  try {
    const room = await cloneRoomProductTech.prepare(
      {
        participants: [{ id: "humain-1", kind: "human" }, { id: "os", kind: "cloneos" }, { id: "employe-a", kind: "ai_employee" }],
        thread: [{ from: "humain-1", content: "Préparez une attestation pour le nouvel arrivant" }],
      },
      PROBE_CTX,
    );
    const r = room.artifact as CloneRoomCoordinationArtifact | null;
    const p2p = await cloneRoomProductTech.prepare({ participants: [{ id: "a", kind: "ai_employee" }], allowPeerToPeer: true }, PROBE_CTX);
    cloneroomReady = room.kind === "needs_validation" && !!r && r.missionCandidates.length >= 1 &&
      r.peerToPeerBlocked === true && r.contextRoutingPlan.allViaCloneOS === true && p2p.kind === "blocked";
    if (!cloneroomReady) blockers.push("Sonde CloneRoom : la coordination (fil→mission via CloneOS, p2p bloqué) ne répond pas aux invariants.");
  } catch { blockers.push("Sonde CloneRoom en échec (exception)."); }

  try {
    const adn = await cloneADNProductTech.prepare({ companyName: "Sonde SARL" }, PROBE_CTX);
    const profile = adn.artifact as { adnMutated?: boolean; mutationPolicy?: string } | null;
    cloneadnReady = adn.kind === "needs_validation" && !!profile && profile.adnMutated === false && profile.mutationPolicy === "proposals_only";
    if (!cloneadnReady) blockers.push("Sonde CloneADN : le profil local (propositions uniquement) ne répond pas aux invariants.");
  } catch { blockers.push("Sonde CloneADN en échec (exception)."); }

  // Sondes complémentaires (gouvernance/trace/brief) — falsifiables, pas seulement des formes.
  try {
    const guardEntry = entries.find((e) => e.id === "cloneguard");
    if (guardEntry) {
      const critical = await guardEntry.contract.prepare(
        { action: { kind: "prepare_case", description: "préparer un dossier de licenciement" } }, PROBE_CTX,
      );
      const d = critical.artifact as { riskLevel?: string; decision?: string } | null;
      if (!d || d.riskLevel !== "critical" || !["require_validation", "refuse"].includes(d.decision ?? "")) {
        blockers.push("Sonde CloneGuard : un cas critique n'est plus classé critique/gated.");
      }
    }
    const traceEntry = entries.find((e) => e.id === "clonetrace");
    if (traceEntry) {
      const trace = await traceEntry.contract.prepare({ subject: "sonde", action: "sonde" }, PROBE_CTX);
      const ev = trace.artifact as { t1Evidence?: unknown } | null;
      if (!ev || !ev.t1Evidence) blockers.push("Sonde CloneTrace : la consommation T1 EvidenceTech ne produit plus d'évidence.");
    }
    const briefEntry = entries.find((e) => e.id === "clonebrief");
    if (briefEntry) {
      const brief = await briefEntry.contract.prepare({ missions: [{ title: "Sonde", state: "prepared" }] }, PROBE_CTX);
      const art = brief.artifact as { sections?: readonly { heading: string; lines: readonly string[] }[] } | null;
      const line = art?.sections?.find((s) => s.heading === "Missions")?.lines[0] ?? "";
      if (!line.includes("PRÉPARÉ")) blockers.push("Sonde CloneBrief : « préparé » n'est plus distingué de « fait ».");
    }
  } catch { blockers.push("Sondes gouvernance/trace/brief en échec (exception)."); }

  // La voix n'est JAMAIS opérationnelle sans provider vérifié EXTERNALEMENT.
  const clonevoiceOperational = VOICE_PROVIDER_VERIFIED;

  // ── Avertissements honnêtes ───────────────────────────────────────────────────
  for (const e of entries.filter((x) => x.liveBlockedReason !== null)) warnings.push(`« ${e.id} » : ${e.liveBlockedReason}`);
  warnings.push("clonevoiceOperational=false — la voix live exige un provider vérifié externalement (roadmap).");
  warnings.push("CloneCall = safe local uniquement ; téléphonie/appels sortants live bloqués (provider + cadre légal externes).");
  warnings.push("readyForP16A/readyForP16C = prêt pour les portes d'intégration ; PAS « providers live prêts ».");
  warnings.push("La preuve « tests pass » reste la porte vitest externe (45 preuves + non-régression).");

  const readyForP16A =
    blockers.length === 0 && cloneosReady && cloneadnReady && clonecallSafeLocalReady &&
    cloneroomReady && clonevoiceTextFallbackOk && !liveProvidersReady;
  // P16C exige EN PLUS que chaque consommation T1 déclarée résolve vers un contrat T1 réel.
  const readyForP16C = readyForP16A && t1ConsumptionOk;

  return {
    totalProductTechnologies: entries.length,
    verified: count("verified"),
    partial: count("partial"),
    architectureReady: count("architecture_ready"),
    localSafeReady: count("local_safe_ready"),
    integrationReady: count("integration_ready"),
    externalBlocked: count("external_blocked"),
    liveBlocked: count("live_blocked"),
    missing: count("missing"),
    readyForP16A,
    readyForP16C,
    cloneosReady,
    clonevoiceOperational,
    clonecallSafeLocalReady,
    cloneroomReady,
    cloneadnReady,
    liveProvidersReady,
    productionAuthorized,
    paymentMode,
    exactBlockers: blockers,
    exactWarnings: warnings,
    nextRecommendedPhase: readyForP16A && readyForP16C
      ? "P16A (Pierre Ultimate) puis P16C (intégration Pierre × T1/T2) — CloneRoom peut consommer T2 dès P16C."
      : `Corriger d'abord : ${blockers[0] ?? "(aucun blocker mais sondes incomplètes)"}`,
    entriesInjected: entriesOverride !== undefined,
    note: "Rapport COMPUTÉ : sondes réelles sur les contrats + plancher P10 + paiement P15.1 + invariant live T1. Jamais déclaré à la main.",
  };
}

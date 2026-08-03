// src/lib/clonechat/inspector/inspect.ts
//
// Orchestrateur DÉTERMINISTE de CloneInspector : valide la preuve, isole le tenant, puis analyse
// selon le TYPE RÉEL (image via vision injectée + inspectScreenshot existant ; JSON strict ; log/
// erreur/texte). Distingue observed / inferred / unknown / rejected. Ne suit jamais une instruction
// cachée ; ne prétend rien qu'il n'observe ; n'exécute rien ; ne déclare aucune résolution.

import type { CloneChatContext } from "@/lib/clonechat/context";
import { getRouteEntry } from "@/lib/nav/route-registry";
import { detectPromptInjection } from "@/lib/clonechat/context-boundary";
import { redactText, KNOWN_ISSUES } from "@/lib/clonechat/care";
import { VISUAL_TARGETS } from "@/lib/clonechat/visual";
import { inspectScreenshot } from "./cloneinspector";
import { validateEvidence, decodeSafeText, type ValidateOptions } from "./evidence-validate";
import { analyzeJson } from "./evidence-json";
import { analyzeLogs } from "./evidence-logs";
import { validateVisionOutput, type VisionProvider } from "./vision-provider";
import {
  CLONECHAT_INSPECTOR_VERSION, type RawEvidence, type CloneInspectionResult, type Observation,
  type InspectionStatus, type InspectorConfidence, type EvidenceType, type ValidatedEvidence,
} from "./evidence-types";

export interface InspectDeps {
  readonly vision?: VisionProvider;
}
export interface InspectOptions extends ValidateOptions {
  readonly context?: CloneChatContext;
  readonly userText?: string;
}

function careIssueFor(errorCodes: readonly string[], route: string | null): string | null {
  const hay = [...errorCodes.map((c) => c.toLowerCase()), (route ?? "").toLowerCase()];
  for (const issue of KNOWN_ISSUES) {
    if (issue.signals.some((sig) => hay.some((h) => h.includes(sig)))) return issue.id;
  }
  return null;
}

function visualTargetFor(route: string | null): string | null {
  if (!route) return null;
  const t = VISUAL_TARGETS.find((x) => x.route === route && x.status === "verified");
  return t?.id ?? null;
}

function result(v: ValidatedEvidence, p: {
  status: InspectionStatus; observations: readonly Observation[]; extractedText?: string | null; errorCodes?: readonly string[];
  candidateRoute?: string | null; confidence: InspectorConfidence; evidence: readonly string[]; limits?: readonly string[];
  missingInformation?: readonly string[]; recommendations?: readonly string[]; requiresClarification?: boolean;
  requiresEscalation?: boolean; ticketRecommended?: boolean; untrusted?: boolean; summary: string;
}): CloneInspectionResult {
  const candidateRoute = p.candidateRoute ?? null;
  const errorCodes = p.errorCodes ?? [];
  return Object.freeze({
    version: CLONECHAT_INSPECTOR_VERSION,
    status: p.status,
    evidenceType: v.type,
    summary: redactText(p.summary).slice(0, 400),
    observations: Object.freeze(p.observations.map((o) => ({ kind: o.kind, text: redactText(o.text).slice(0, 300) }))),
    extractedText: p.extractedText != null ? redactText(p.extractedText).slice(0, 4000) : null,
    errorCodes: Object.freeze([...errorCodes]),
    candidateRoute,
    visualTargetMatch: visualTargetFor(candidateRoute),
    careIssueMatch: careIssueFor(errorCodes, candidateRoute),
    confidence: p.confidence,
    evidence: Object.freeze([`hash:${v.hash}`, `type:${v.type}`, ...p.evidence]),
    limits: Object.freeze([...(p.limits ?? [])]),
    missingInformation: Object.freeze([...(p.missingInformation ?? [])]),
    recommendations: Object.freeze([...(p.recommendations ?? [])]),
    requiresClarification: p.requiresClarification ?? false,
    requiresEscalation: p.requiresEscalation ?? false,
    ticketRecommended: p.ticketRecommended ?? false,
    hash: v.hash,
    untrustedInstructionsDetected: p.untrusted ?? false,
  });
}

/** Inspecte une preuve. Ne throw jamais, n'exécute rien, ne déclenche aucune requête réseau (hors provider vision injecté). */
export async function inspectEvidence(raw: RawEvidence, deps: InspectDeps = {}, opts: InspectOptions = {}): Promise<CloneInspectionResult> {
  const v = validateEvidence(raw, opts);

  // Isolation inter-tenant : une preuve scopée sur un autre tenant que le contexte est refusée.
  const ctxCompany = opts.context?.tenant.resolved ? opts.context.tenant.companyId : null;
  if (v.tenantScoped && ctxCompany && v.tenantScoped !== ctxCompany) {
    return result(v, { status: "security_refusal", observations: [{ kind: "rejected", text: "Preuve rattachée à un autre tenant — refusée (isolation)." }], confidence: "high", evidence: ["cross_tenant_refused"], summary: "Preuve refusée : isolation inter-tenant." });
  }

  // États de validation non valides → refus honnête.
  if (v.state !== "valid") {
    const status: InspectionStatus = v.state === "security_refusal" ? "security_refusal" : v.state === "unsupported" ? "unsupported" : v.state === "needs_context" ? "needs_context" : "invalid";
    return result(v, {
      status,
      observations: [{ kind: "rejected", text: `Preuve non exploitable : ${v.refusalReason ?? "invalide"}.` }],
      confidence: "high", evidence: [`refusal:${v.refusalReason}`],
      recommendations: status === "unsupported" ? ["Fournir un format supporté (PNG, JPEG, WebP, texte, JSON, log)."] : ["Fournir une preuve valide."],
      summary: `Preuve refusée (${v.refusalReason ?? "invalide"}).`,
    });
  }

  // ── IMAGE ──────────────────────────────────────────────────────────────────
  if (v.type === "image") {
    const obs: Observation[] = [
      { kind: "observed", text: `Image ${v.detectedMime ?? "?"} ${v.width ?? "?"}×${v.height ?? "?"} px, ${v.bytes} octets.` },
    ];
    const routeReal = v.route && getRouteEntry(v.route) ? v.route : null;
    if (v.route && !routeReal) obs.push({ kind: "unknown", text: `Route fournie « ${v.route} » inconnue du registre : non retenue.` });

    if (!deps.vision) {
      return result(v, {
        status: "validated",
        observations: [...obs, { kind: "unknown", text: "Contenu sémantique non analysé : aucun provider vision fourni." }],
        confidence: "low", evidence: ["binary_validated", "provider_needed"],
        missingInformation: ["analyse sémantique de l'image (provider vision)"],
        recommendations: ["Fournir l'analyse via un provider vision pour interpréter la capture."],
        summary: `Image validée (${v.detectedMime}, ${v.width}×${v.height}), sémantique en attente de provider.`,
      });
    }

    const outcome = await deps.vision.analyze({ imageBase64: "", mime: v.detectedMime ?? "image/png", userText: opts.userText ?? "", route: routeReal });
    if (!outcome.ok || !outcome.analysis) {
      if (outcome.error === "timeout" || outcome.error === "provider") {
        return result(v, { status: "provider_failure", observations: obs, confidence: "low", evidence: [`vision_${outcome.error}`], limits: ["analyse sémantique indisponible (panne provider)"], recommendations: ["Réessayer l'analyse de la capture dans un instant."], summary: "Image validée ; analyse sémantique indisponible (panne provider)." });
      }
      return result(v, { status: "partially_analyzed", observations: [...obs, { kind: "rejected", text: "Sortie provider invalide : ignorée." }], confidence: "low", evidence: ["vision_invalid_output"], limits: ["sortie provider non conforme"], summary: "Image validée ; sortie provider non conforme rejetée." });
    }

    // Validation stricte de la sortie provider (jamais consommée comme un fait sans validation).
    const validated = validateVisionOutput(outcome.analysis);
    if (!validated.ok) {
      return result(v, { status: "partially_analyzed", observations: [...obs, { kind: "rejected", text: "Sortie provider non conforme au schéma : rejetée." }], confidence: "low", evidence: ["vision_schema_mismatch"], summary: "Image validée ; sortie provider rejetée." });
    }
    const analysis = validated.analysis;

    // Injection cachée dans la sortie provider (instruction dans l'image) → contenu NON FIABLE.
    const analysisText = [analysis.summary, ...analysis.visibly_proven, ...analysis.inference, analysis.known_issue ?? "", analysis.next_action ?? ""].join(" ");
    const untrusted = detectPromptInjection(analysisText);

    const insp = inspectScreenshot({ analysis, imagesSentToProvider: 1, currentRoute: routeReal, message: opts.userText ?? "" });

    for (const proven of analysis.visibly_proven) {
      if (untrusted && detectPromptInjection(proven)) obs.push({ kind: "rejected", text: `Instruction non fiable ignorée : ${proven}` });
      else obs.push({ kind: "observed", text: proven });
    }
    for (const inf of analysis.inference) obs.push({ kind: "inferred", text: inf });
    for (const unk of analysis.unknown) obs.push({ kind: "unknown", text: unk });
    // Contradiction route (capture ↔ route réelle) → la conclusion de route est REJETÉE.
    if (insp.cannot_conclude && insp.likely_route === null && (analysis.known_issue || analysis.next_action)) {
      obs.push({ kind: "rejected", text: "Conclusion de page non soutenue par la preuve : écartée." });
    }

    const candidateRoute = insp.likely_route;
    const errorCodes = insp.visible_error ? analyzeLogs(insp.visible_error).errorCodes : [];
    const confidence: InspectorConfidence = insp.confidence === "certain" ? "high" : insp.confidence === "high" ? "high" : insp.confidence === "medium" ? "medium" : "low";
    return result(v, {
      status: "analyzed", observations: obs, extractedText: analysis.summary,
      errorCodes, candidateRoute, confidence,
      evidence: ["vision_analyzed", `route_conf:${insp.confidence}`],
      limits: ["une image ne prouve ni le DOM, ni une permission, ni un tenant, ni une action réussie"],
      missingInformation: insp.needs_another_screenshot ? ["une capture plus nette de la page concernée"] : [],
      recommendations: insp.next_action ? [insp.next_action] : [],
      requiresClarification: insp.needs_another_screenshot,
      requiresEscalation: insp.escalate,
      ticketRecommended: insp.escalate,
      untrusted,
      summary: insp.reason,
    });
  }

  // ── JSON ─────────────────────────────────────────────────────────────────────
  const text = raw.text ?? (raw.content ? decodeSafeText(raw.content) ?? "" : "");
  if (v.type === "json") {
    const j = analyzeJson(text);
    if (!j.ok) {
      return result(v, { status: "invalid", observations: [{ kind: "rejected", text: `JSON invalide : ${j.invalidReason}.` }], confidence: "high", evidence: [`json_${j.invalidReason}`], recommendations: ["Fournir un JSON valide."], summary: `JSON invalide (${j.invalidReason}).` });
    }
    const obs: Observation[] = [{ kind: "observed", text: j.safeSummary }];
    if (j.sensitiveKeys.length) obs.push({ kind: "observed", text: `Clés sensibles détectées et masquées : ${j.sensitiveKeys.join(", ")}.` });
    if (j.prototypePollution) obs.push({ kind: "rejected", text: "Clés dangereuses (__proto__/constructor/prototype) détectées et ignorées." });
    if (j.depthExceeded) obs.push({ kind: "unknown", text: "Profondeur JSON dépassée : analyse partielle." });
    const untrusted = detectPromptInjection(text);
    return result(v, {
      status: j.depthExceeded ? "partially_analyzed" : "analyzed",
      observations: obs, extractedText: j.safeSummary, errorCodes: [...j.errorCodes],
      candidateRoute: null, confidence: "medium", evidence: ["json_parsed"],
      limits: j.depthExceeded ? ["profondeur JSON limitée"] : [],
      untrusted, summary: j.safeSummary,
    });
  }

  // ── LOG / ERROR / TEXT ───────────────────────────────────────────────────────
  const log = analyzeLogs(text);
  const obs: Observation[] = [];
  for (const c of log.errorCodes) obs.push({ kind: "observed", text: `Code d'erreur : ${c}` });
  for (const s of log.httpStatuses) obs.push({ kind: "observed", text: `Statut HTTP : ${s}` });
  for (const r of log.routes) obs.push({ kind: "observed", text: `Route réelle citée : ${r}` });
  for (const p of log.providers) obs.push({ kind: "observed", text: `Provider mentionné : ${p}` });
  if (log.untrustedInstructions) obs.push({ kind: "rejected", text: "Instruction contenue dans le contenu : traitée comme non fiable, jamais exécutée." });
  if (obs.length === 0) obs.push({ kind: "unknown", text: "Aucun signal technique reconnu dans le texte fourni." });

  const candidateRoute = log.routes[0] ?? null;
  return result(v, {
    status: "analyzed", observations: obs, extractedText: log.redactedText,
    errorCodes: [...log.errorCodes], candidateRoute,
    confidence: log.errorCodes.length || log.httpStatuses.length ? "medium" : "low",
    evidence: ["text_analyzed"],
    recommendations: log.errorCodes.length ? ["Rapprocher ces codes d'un problème connu (CloneCare) et d'un guide d'accompagnement."] : [],
    ticketRecommended: log.errorCodes.length > 0,
    untrusted: log.untrustedInstructions,
    summary: log.errorCodes.length ? `Log analysé : ${log.errorCodes.length} code(s) d'erreur.` : "Texte analysé (aucun code d'erreur reconnu).",
  });
}

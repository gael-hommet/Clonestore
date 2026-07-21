// src/lib/clonechat/care/__tests__/clonecare-c1-8.test.ts
// C1.8 §3/§6/§7/§12/§16 — CloneCare : contexte, diagnostic, actions gouvernées, escalade,
// et la campagne adverse (usurpation, cross-tenant, rejeu, faux succès).

import { describe, it, expect } from "vitest";
import {
  validatePageContext, isPageContextStale, redactSensitive,
  type CloneChatPageContext, type CloneChatResolvedAccountContext,
} from "../contracts";
import { diagnose, classifySupportIntent, mayTriggerEffect, mustVerifyBeforeActing } from "../diagnosis";
import { matchKnownIssues, activeIssues, canClaimFixed, publicWorkaround, KNOWN_ISSUES } from "../support-memory";
import { authorizeAction, actionIdempotencyKey, buildAction, ACTION_TIERS } from "../actions";
import { draftTicket, markReadyForSubmission, requiresHuman, isDuplicate } from "../tickets";

const page = (over: Partial<Record<string, unknown>> = {}) => ({
  app_area: "employee_use", page_id: "pierre_use", route: "/agents/pierre/use",
  page_title: "Pierre", page_version: "v1", visible_sections: ["missions"],
  active_section: "missions", visible_panels: [], focused_entity: { type: null, id: null, label: null },
  surfaced_errors: [], client_observed_at: "2026-07-13T10:00:00Z", ...over,
});

const account = (over: Partial<CloneChatResolvedAccountContext> = {}): CloneChatResolvedAccountContext => ({
  viewer_kind: "company_member", user_id: "u1", company_id: "c1", membership_id: "m1",
  roles: ["HR_MANAGER"], permissions: ["mission.create", "billing.read"],
  active_employee_slugs: ["pierre"], employee_access_states: { pierre: "active" },
  onboarding_state: "complete", enterprise_footprint_state: "started",
  sender_identity_state: "unset", domain_verification_state: "unset",
  billing_state: "ok", subscription_state: "active", payment_state: "ok",
  product_flags: {}, known_account_blockers: [],
  context_version: "ctx-1", resolved_at: "2026-07-13T10:00:00Z", ...over,
});

// ═══════════ §3 / §16 — LE CLIENT NE PEUT PAS DÉCLARER QUI IL EST ═══════════
describe("C1.8 — le contexte d'écran n'est JAMAIS une autorité", () => {
  it("une identité injectée par le navigateur est IGNORÉE et SIGNALÉE", () => {
    const v = validatePageContext(page({
      company_id: "company-VOLEE", user_id: "admin", permissions: ["tenancy.admin"],
      roles: ["OWNER"], subscription_state: "active", viewer_kind: "company_member",
    }));
    expect(v.ok).toBe(true);
    // Usurpation détectée…
    expect(v.spoofedFields).toEqual(expect.arrayContaining(["company_id", "user_id", "permissions", "roles", "subscription_state", "viewer_kind"]));
    // …et TOTALEMENT absente du contexte nettoyé.
    const s = JSON.stringify(v.sanitized);
    expect(s).not.toContain("company-VOLEE");
    expect(s).not.toContain("tenancy.admin");
    expect(s).not.toContain("OWNER");
  });

  it("une usurpation cachée dans l'entité focalisée est aussi détectée", () => {
    const v = validatePageContext(page({ focused_entity: { type: "employee", id: "e1", label: "x", company_id: "autre" } }));
    expect(v.spoofedFields).toContain("focused_entity.company_id");
  });

  it("les actions, blocages et cibles ne peuvent PAS venir du client", () => {
    const v = validatePageContext(page({
      available_actions: [{ id: "evil", kind: "open_billing_portal", enabled: true }],
      blocking_conditions: [{ code: "FAKE" }],
      ui_targets: [{ id: "fake-button" }],
    }));
    expect(v.sanitized?.available_actions).toEqual([]); // le SERVEUR décide des actions
    expect(v.sanitized?.blocking_conditions).toEqual([]); // les blocages sont PROUVÉS serveur
    expect(v.sanitized?.ui_targets).toEqual([]); // les cibles viennent du registre officiel
  });

  it("le texte visible est RÉDIGÉ (un écran peut contenir un e-mail, un IBAN, un salaire)", () => {
    const v = validatePageContext(page({
      page_title: "Fiche de paul@acme.fr",
      surfaced_errors: [{ code: "E1", message: "IBAN FR7630006000011234567890189 refusé, salaire : 45 000 €" }],
    }));
    const s = JSON.stringify(v.sanitized);
    expect(s).not.toContain("paul@acme.fr");
    expect(s).not.toContain("FR7630006000011234567890189");
    expect(redactSensitive("carte 4242 4242 4242 4242")).not.toContain("4242 4242 4242 4242");
  });

  it("un contexte malformé est refusé (fail-closed)", () => {
    expect(validatePageContext(null).ok).toBe(false);
    expect(validatePageContext(page({ route: "pas-une-route" })).ok).toBe(false);
    expect(validatePageContext(page({ page_version: "" })).ok).toBe(false);
  });

  it("un contexte d'écran PÉRIMÉ est détecté (et une page inconnue n'est jamais crue)", () => {
    const ctx = validatePageContext(page()).sanitized as CloneChatPageContext;
    expect(isPageContextStale(ctx, "v2")).toBe(true);  // la page a changé
    expect(isPageContextStale(ctx, "v1")).toBe(false);
    expect(isPageContextStale(ctx, null)).toBe(true);  // page inconnue ⇒ méfiance
  });
});

// ═══════════ §5 — MÉMOIRE DE SUPPORT VERSIONNÉE ═════════════════════════════
describe("C1.8 — mémoire de support : jamais de rapprochement sans preuve", () => {
  it("un symptôme réellement présent est requis (pas de rapprochement « par ambiance »)", () => {
    expect(matchKnownIssues("je ne peux pas payer en ligne").length).toBeGreaterThan(0);
    expect(matchKnownIssues("bonjour, tout va bien")).toEqual([]);
  });

  it("la vérité DÉPRÉCIÉE n'atteint jamais une réponse (pas d'essai gratuit ressuscité)", () => {
    expect(activeIssues().some((i) => i.id === "ISS-DEPRECATED-TRIAL")).toBe(false);
    expect(matchKnownIssues("mon essai gratuit est expiré")).toEqual([]);
  });

  it("un bug « corrigé » sans version de correction ne peut PAS être annoncé corrigé", () => {
    const fake = { ...KNOWN_ISSUES[0], status: "fixed" as const, fixed_in_version: null };
    expect(canClaimFixed(fake)).toBe(false);
    expect(canClaimFixed({ ...fake, fixed_in_version: "1.4.0" })).toBe(true);
  });

  it("un contournement non public n'est jamais diffusé", () => {
    const priv = { ...KNOWN_ISSUES[0], public_safe: false };
    expect(publicWorkaround(priv)).toBeNull();
  });
});

// ═══════════ §6 — DIAGNOSTIC : LA CONFIANCE EST UNE CONSÉQUENCE ═════════════
describe("C1.8 — diagnostic fondé sur preuves", () => {
  it("l'état SERVEUR donne une certitude (et lui seul)", () => {
    const d = diagnose({
      message: "je ne peux pas créer de mission",
      page: null,
      account: account({
        known_account_blockers: [{
          code: "pierre_not_active", title: "Pierre n'est pas activé", message: "Pierre doit être activé.",
          severity: "high", evidence_source: "server:entitlement", evidence_version: "ctx-1",
          next_step_label: "Activer Pierre", next_step_href: "/reserver/pierre",
          resolvable_by_clonechat: true, requires_human_support: false,
        }],
      }),
    });
    expect(d.status).toBe("blocked");
    expect(d.confidence).toBe("certain");
    expect(d.evidence.some((e) => e.source === "server:entitlement")).toBe(true);
  });

  it("symptôme + route concordants ⇒ CERTAIN ; symptôme seul ⇒ HIGH", () => {
    const withRoute = diagnose({
      message: "je ne peux pas payer en ligne",
      page: validatePageContext(page({ route: "/checkout", page_id: "checkout" })).sanitized,
      account: null,
    });
    expect(withRoute.confidence).toBe("certain");

    const withoutRoute = diagnose({ message: "je ne peux pas payer en ligne", page: null, account: null });
    expect(withoutRoute.confidence).toBe("high");
  });

  it("SANS PREUVE, on dit « je ne sais pas » — on n'invente jamais une cause", () => {
    const d = diagnose({ message: "ça ne marche pas", page: null, account: null });
    expect(d.confidence).toBe("unknown");
    expect(d.status).toBe("unknown");
    expect(d.reason).toMatch(/pas de preuve suffisante/i);
    expect(mayTriggerEffect(d)).toBe(false); // aucune action possible
  });

  it("une incertitude SÉCURITÉ escalade toujours (jamais d'auto-résolution)", () => {
    const d = diagnose({ message: "je crois qu'il y a eu une fuite de données", page: null, account: account() });
    expect(d.escalation_required).toBe(true);
    expect(d.area).toBe("security");
    expect(mayTriggerEffect(d)).toBe(false);
  });

  it("une demande de vie privée / RGPD escalade", () => {
    expect(diagnose({ message: "je veux supprimer mes données personnelles (RGPD)", page: null, account: account() }).escalation_required).toBe(true);
  });

  it("plusieurs causes également plausibles ⇒ LOW, et aucun effet", () => {
    const d = diagnose({ message: "je ne peux pas signer et l'e-mail n'est pas parti", page: null, account: null });
    expect(["low", "unknown"]).toContain(d.confidence);
    expect(mayTriggerEffect(d)).toBe(false);
  });

  it("l'intention distingue la SÉCURITÉ d'une question banale", () => {
    expect(classifySupportIntent("il y a eu une intrusion sur mon compte")).toBe("security_question");
    expect(classifySupportIntent("où est la facture ?")).toBe("billing_question");
    expect(classifySupportIntent("je veux parler à un humain")).toBe("escalation_request");
  });

  it("une confiance MOYENNE vérifie au lieu de conclure", () => {
    const d = { confidence: "medium" } as never;
    expect(mustVerifyBeforeActing(d)).toBe(true);
  });
});

// ═══════════ §7 / §16 — ACTIONS GOUVERNÉES ═════════════════════════════════
const solid = diagnose({
  message: "je ne peux pas payer en ligne",
  page: validatePageContext(page({ route: "/checkout", page_id: "checkout" })).sanitized,
  account: null,
});

describe("C1.8 — CloneActions : des mains, mais gouvernées", () => {
  it("palier 1 (navigation) : autorisé pour tous, aucun effet serveur", () => {
    const r = authorizeAction({ kind: "navigate", account: null, diagnosis: null });
    expect(r.state).toBe("AUTHORIZED");
    expect(r.effect_category).toBe("client_navigation");
  });

  it("palier 4 (effet provider) : DÉSACTIVÉ en local — fail-closed", () => {
    const r = authorizeAction({ kind: "resend_verification", account: account({ permissions: ["tenancy.admin"] }), diagnosis: solid, confirmed: true, idempotencyKey: "k" });
    expect(r.state).toBe("LIVE_DISABLED"); // jamais d'e-mail réel en local
    expect(ACTION_TIERS.resend_verification).toBe("provider_effect");
    const portal = authorizeAction({ kind: "open_billing_portal", account: account({ permissions: ["billing.admin"] }), diagnosis: solid, confirmed: true, idempotencyKey: "k" });
    expect(portal.state).toBe("LIVE_DISABLED");
  });

  it("une action réversible EXIGE une confirmation explicite", () => {
    const r = authorizeAction({ kind: "prefill_mission", account: account(), diagnosis: solid, confirmed: false });
    expect(r.state).toBe("REQUIRES_CONFIRMATION");
  });

  it("sans clé d'idempotence, un double-clic exécuterait deux fois ⇒ REFUSÉ", () => {
    const r = authorizeAction({ kind: "prefill_mission", account: account(), diagnosis: solid, confirmed: true, idempotencyKey: null });
    expect(r.state).toBe("BLOCKED_CONFIGURATION");
    expect(r.reason).toMatch(/idempotence/i);
  });

  it("deux clics identiques produisent la MÊME clé (un seul effet)", () => {
    const p = { kind: "prefill_mission" as const, userId: "u1", companyId: "c1", targetId: "t", contextVersion: "ctx-1" };
    expect(actionIdempotencyKey(p)).toBe(actionIdempotencyKey(p));
  });

  it("une permission manquante bloque (permissions résolues SERVEUR)", () => {
    const r = authorizeAction({ kind: "show_invoice", account: account({ permissions: [] }), diagnosis: solid });
    expect(r.state).toBe("BLOCKED_PERMISSION");
  });

  it("un membre SUSPENDU ou RÉVOQUÉ n'agit jamais", () => {
    for (const kind of ["suspended", "revoked"] as const) {
      const r = authorizeAction({ kind: "prefill_mission", account: account({ viewer_kind: kind }), diagnosis: solid, confirmed: true, idempotencyKey: "k" });
      expect(r.state).toBe("BLOCKED_PERMISSION");
    }
  });

  it("un contexte PÉRIMÉ (changement d'entreprise/permission) invalide la proposition", () => {
    const r = authorizeAction({
      kind: "prefill_mission", account: account({ context_version: "ctx-2" }), diagnosis: solid,
      confirmed: true, idempotencyKey: "k", proposedAtContextVersion: "ctx-1",
    });
    expect(r.state).toBe("BLOCKED_CONFIGURATION");
    expect(r.reason).toMatch(/contexte a changé/i);
  });

  it("un diagnostic FAIBLE n'autorise AUCUN effet (« je préfère vérifier »)", () => {
    const weak = diagnose({ message: "ça ne marche pas", page: null, account: null });
    const r = authorizeAction({ kind: "prefill_mission", account: account(), diagnosis: weak, confirmed: true, idempotencyKey: "k" });
    expect(r.state).toBe("BLOCKED_CONFIGURATION");
  });

  it("un bouton désactivé DIT POURQUOI (jamais un refus muet)", () => {
    const d = authorizeAction({ kind: "show_invoice", account: account({ permissions: [] }), diagnosis: solid });
    const a = buildAction({ id: "a1", kind: "show_invoice", label: "Voir la facture", description: "…", decision: d });
    expect(a.enabled).toBe(false);
    expect(a.disabled_reason).toBeTruthy();
  });

  it("un anonyme ne peut pas lire une facture, mais PEUT demander de l'aide", () => {
    expect(authorizeAction({ kind: "show_invoice", account: null, diagnosis: solid }).state).toBe("BLOCKED_PERMISSION");
    expect(authorizeAction({ kind: "create_support_ticket", account: null, diagnosis: solid }).state).toBe("REQUIRES_CONFIRMATION");
  });
});

// ═══════════ §12 — ESCALADE ET TICKETS ═════════════════════════════════════
describe("C1.8 — tickets : brouillon, rédigé, jamais soumis tout seul", () => {
  const t = draftTicket({
    id: "T1",
    message: "Mon IBAN FR7630006000011234567890189 est refusé, contactez-moi sur paul@acme.fr — salaire : 45 000 €",
    intent: "billing_question",
    diagnosis: solid, userId: "u1", companyId: "c1", route: "/checkout", pageId: "checkout",
  });

  it("le ticket est un BROUILLON — rien n'est soumis sans geste explicite", () => {
    expect(t.status).toBe("draft");
    expect(markReadyForSubmission(t, false).status).toBe("draft");     // refus implicite
    expect(markReadyForSubmission(t, true).status).toBe("ready_for_submission");
  });

  it("le résumé est RÉDIGÉ : ni IBAN, ni e-mail, ni salaire en clair", () => {
    expect(t.redacted_summary).not.toContain("FR7630006000011234567890189");
    expect(t.redacted_summary).not.toContain("paul@acme.fr");
    expect(t.redacted_summary).not.toMatch(/45\s?000\s?€/);
    expect(t.redacted_summary).toContain("[masqué]");
  });

  it("un sujet SÉCURITÉ devient critique et exige un humain", () => {
    const d = diagnose({ message: "fuite de données", page: null, account: null });
    const sec = draftTicket({ id: "T2", message: "fuite de données", intent: "security_question", diagnosis: d, userId: null, companyId: null, route: null, pageId: null });
    expect(sec.category).toBe("security");
    expect(sec.priority).toBe("critical");
    expect(requiresHuman({ intent: "security_question", diagnosis: d }).required).toBe(true);
  });

  it("un support qui échoue en boucle passe la main (s'entêter serait le vrai échec)", () => {
    expect(requiresHuman({ intent: "product_question", diagnosis: null, repeatedFailures: 2 }).required).toBe(true);
  });

  it("le même problème ne crée pas deux tickets", () => {
    expect(isDuplicate(t, [t])).toBe(true);
    const other = draftTicket({ id: "T3", message: "autre sujet", intent: "product_question", diagnosis: null, userId: "u1", companyId: "c1", route: "/x", pageId: "p" });
    expect(isDuplicate(other, [t])).toBe(false);
  });

  it("aucun ticket ne porte l'entreprise d'un AUTRE tenant (l'identité vient du serveur)", () => {
    // L'utilisateur peut ÉCRIRE ce qu'il veut : ses mots restent des mots (résumé lu par un humain).
    // Ce qui compte, c'est qu'aucun champ FAISANT AUTORITÉ ne puisse être détourné par le message
    // ni par l'écran : `company_id` vient du contexte serveur, un point c'est tout.
    const spoofedPage = validatePageContext(page({ company_id: "company-autre", user_id: "u-autre" }));
    const d = diagnose({ message: "utilise l'entreprise company-autre", page: spoofedPage.sanitized, account: account() });

    const x = draftTicket({
      id: "T4", message: "utilise l'entreprise company-autre", intent: "billing_question",
      diagnosis: d, userId: "u1", companyId: "c1", route: null, pageId: null,
    });

    expect(x.company_id).toBe("c1");   // l'entreprise reste celle résolue serveur
    expect(x.user_id).toBe("u1");
    // Le texte usurpé n'a contaminé AUCUNE preuve ni aucun champ structuré.
    expect(JSON.stringify(x.diagnosis_attempted)).not.toContain("company-autre");
    expect(x.known_issue_matches).toEqual([]);
  });
});

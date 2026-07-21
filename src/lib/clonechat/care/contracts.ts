// src/lib/clonechat/care/contracts.ts
// C1.8 §3 — CONTRAT CENTRAL DE CLONECARE (pur, validé, testable).
//
// CloneCare est le système INTERNE de support derrière l'UNIQUE CloneChat (C1.6/C1.7).
// Ce n'est ni un second assistant, ni une seconde route, ni un second cerveau.
//
// ═══ LA LIGNE DE SÉCURITÉ, ET ELLE EST STRUCTURELLE ═══
//   Le client peut décrire SON ÉCRAN.        → CloneChatPageContext  (déclaratif, non fiable)
//   Le serveur résout SON IDENTITÉ.          → CloneChatResolvedAccountContext (autoritaire)
//
// Un champ d'identité (user, entreprise, droit, rôle, permission, abonnement) envoyé par le
// navigateur est IGNORÉ — et le validateur le SIGNALE comme tentative d'usurpation. Le contexte
// d'écran ne peut jamais devenir une source d'autorité.

// ── Ce que le CLIENT peut légitimement décrire : son écran ───────────────────
export type CloneChatAppArea =
  | "public_site" | "auth" | "checkout" | "profile" | "employee_catalog"
  | "employee_setup" | "employee_use" | "assistant" | "billing" | "legal" | "unknown";

export type CloneChatActionKind =
  | "navigate" | "focus" | "open_modal" | "copy" | "retry"
  | "resend_verification" | "open_billing_portal" | "show_invoice"
  | "prefill_mission" | "create_support_ticket";

/**
 * Catégorie d'EFFET — c'est elle qui gouverne, jamais le libellé de l'action.
 *   · client_navigation      : aucun effet serveur ;
 *   · read_only              : lecture, permission requise ;
 *   · reversible_self_service: effet réversible, confirmation explicite ;
 *   · provider_effect        : effet EXTERNE (e-mail, portail…) — DÉSACTIVÉ en local ;
 *   · sensitive              : décision sensible — JAMAIS autonome.
 */
export type CloneChatEffectCategory =
  | "client_navigation" | "read_only" | "reversible_self_service" | "provider_effect" | "sensitive";

export interface CloneChatAction {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly kind: CloneChatActionKind;
  readonly enabled: boolean;
  readonly disabled_reason: string | null;
  readonly href?: string;
  readonly target_id?: string;
  readonly requires_authentication: boolean;
  readonly requires_permission: string | null;
  readonly requires_confirmation: boolean;
  readonly effect_category: CloneChatEffectCategory;
  readonly idempotency_key: string | null;
}

export type CloneChatSeverity = "info" | "warning" | "high" | "critical";

export interface CloneChatBlocker {
  readonly code: string;
  readonly title: string;
  readonly message: string;
  readonly severity: CloneChatSeverity;
  /** D'OÙ vient la preuve. Un blocage sans source n'est pas un blocage : c'est une supposition. */
  readonly evidence_source: string;
  readonly evidence_version: string | null;
  readonly next_step_label: string | null;
  readonly next_step_href: string | null;
  readonly resolvable_by_clonechat: boolean;
  readonly requires_human_support: boolean;
}

export interface CloneChatSurfaceError {
  readonly code: string;
  readonly message: string;
  readonly route: string | null;
}

export interface CloneChatUiTarget {
  readonly id: string;
  readonly route: string;
  readonly page_version: string;
  readonly label: string;
  readonly description: string;
  readonly role: "button" | "tab" | "panel" | "input" | "card" | "nav_link" | "menu" | "modal";
  readonly location_hint: string;
  readonly selector_hint: string | null;
  readonly visible: boolean;
  readonly enabled: boolean;
}

export interface CloneChatPageContext {
  readonly app_area: CloneChatAppArea;
  readonly page_id: string;
  readonly route: string;
  readonly page_title: string;
  readonly page_version: string;
  readonly visible_sections: readonly string[];
  readonly active_section: string | null;
  readonly visible_panels: readonly string[];
  readonly focused_entity: { readonly type: string | null; readonly id: string | null; readonly label: string | null };
  readonly available_actions: readonly CloneChatAction[];
  readonly blocking_conditions: readonly CloneChatBlocker[];
  readonly surfaced_errors: readonly CloneChatSurfaceError[];
  readonly ui_targets: readonly CloneChatUiTarget[];
  readonly client_observed_at: string;
}

// ── Ce que seul le SERVEUR peut établir : l'identité et les droits ───────────
//
// `unknown` n'est PAS un détail : c'est le cas d'une PANNE de résolution (tenant injoignable).
// Sans lui, une panne se ferait passer pour « pas d'entreprise » — et CloneChat annoncerait à un
// client parfaitement en règle qu'il n'a pas d'entreprise. Un état inconnu reste inconnu.
export type CloneChatViewerKind =
  | "anonymous" | "authenticated_without_company" | "company_member"
  | "suspended" | "revoked" | "unknown";

/**
 * État d'accès à un employé — TROIS valeurs, jamais deux.
 * `unknown` (vérification impossible) n'est ni `active` ni `not_active` : l'absence de preuve
 * n'est pas la preuve de l'absence. Aucun effet, aucune affirmation, sur `unknown`.
 */
export type EmployeeAccessState = "active" | "not_active" | "unknown";

export interface CloneChatResolvedAccountContext {
  readonly viewer_kind: CloneChatViewerKind;
  readonly user_id: string | null;
  readonly company_id: string | null;
  readonly membership_id: string | null;
  readonly roles: readonly string[];
  readonly permissions: readonly string[];
  readonly active_employee_slugs: readonly string[];
  readonly employee_access_states: Readonly<Record<string, EmployeeAccessState>>;
  readonly onboarding_state: string;
  readonly enterprise_footprint_state: string;
  readonly sender_identity_state: string;
  readonly domain_verification_state: string;
  readonly billing_state: string;
  readonly subscription_state: string;
  readonly payment_state: string;
  readonly product_flags: Readonly<Record<string, boolean>>;
  readonly known_account_blockers: readonly CloneChatBlocker[];
  readonly context_version: string;
  readonly resolved_at: string;
}

// ── Diagnostic ───────────────────────────────────────────────────────────────
export type CloneChatConfidence = "certain" | "high" | "medium" | "low" | "unknown";

export interface CloneChatEvidence {
  /** Source EXACTE : « server:account », « registry:known_issue », « client:page_context »… */
  readonly source: string;
  readonly label: string;
  readonly version: string | null;
}

export type CloneChatDiagnosisArea =
  | "account" | "billing" | "employee_access" | "setup" | "mission"
  | "email" | "document" | "ui" | "technical" | "security" | "unknown";

export interface CloneChatDiagnosis {
  readonly status: "ok" | "blocked" | "warning" | "unknown";
  readonly area: CloneChatDiagnosisArea;
  readonly reason: string;
  readonly evidence: readonly CloneChatEvidence[];
  readonly blocking_step: string | null;
  readonly recommended_action: string;
  readonly action_id: string | null;
  readonly escalation_required: boolean;
  readonly confidence: CloneChatConfidence;
}

export type CloneChatSupportMode =
  | "answer" | "orientation" | "diagnosis" | "guided_flow" | "action_proposal" | "escalation";

// ── Validation : la porte anti-usurpation ────────────────────────────────────

/** Champs d'IDENTITÉ que le client n'a JAMAIS le droit de déclarer. */
export const CLIENT_FORBIDDEN_FIELDS = [
  "user_id", "userId", "company_id", "companyId", "membership_id", "membershipId",
  "roles", "permissions", "entitlement", "entitlements", "subscription_state",
  "billing_state", "payment_state", "viewer_kind", "is_admin", "isAdmin",
] as const;

export interface ContextValidation {
  readonly ok: boolean;
  /** Champs d'identité que le client a tenté d'injecter (usurpation). Toujours ignorés. */
  readonly spoofedFields: readonly string[];
  readonly errors: readonly string[];
  /** Contexte NETTOYÉ : purgé de toute prétention d'autorité. */
  readonly sanitized: CloneChatPageContext | null;
}

const AREAS = new Set<CloneChatAppArea>([
  "public_site", "auth", "checkout", "profile", "employee_catalog",
  "employee_setup", "employee_use", "assistant", "billing", "legal", "unknown",
]);

/** Motifs de contenu sensible : jamais renvoyés au modèle depuis un contexte d'écran. */
const SENSITIVE = [
  /\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b/,          // carte bancaire
  /[\w.+-]+@[\w-]+\.[\w.]{2,}/,                        // e-mail
  /\bsalaire\s*:?\s*[\d\s.,]+\s*(€|eur|chf)/i,         // salaire
  /\bsk-[A-Za-z0-9_-]{20,}|Bearer\s+[A-Za-z0-9._-]{20,}/, // secret
  /\biban\b\s*:?\s*[A-Z]{2}\d{2}[A-Z0-9]+/i,           // IBAN
];

export function redactSensitive(text: string): string {
  let out = text;
  for (const rx of SENSITIVE) out = out.replace(new RegExp(rx.source, rx.flags.includes("g") ? rx.flags : rx.flags + "g"), "[masqué]");
  return out;
}

/**
 * Valide un contexte d'ÉCRAN venant du navigateur.
 * Il n'est JAMAIS une source d'autorité : toute prétention d'identité est retirée et signalée.
 */
export function validatePageContext(raw: unknown): ContextValidation {
  const errors: string[] = [];
  const spoofed: string[] = [];

  if (raw === null || typeof raw !== "object") {
    return { ok: false, spoofedFields: [], errors: ["contexte absent ou malformé"], sanitized: null };
  }
  const o = raw as Record<string, unknown>;

  // ── USURPATION : le client tente-t-il de déclarer QUI il est ? ──
  for (const f of CLIENT_FORBIDDEN_FIELDS) {
    if (f in o) spoofed.push(f);
  }
  // …y compris caché dans l'entité focalisée.
  const fe = (o.focused_entity ?? {}) as Record<string, unknown>;
  for (const f of CLIENT_FORBIDDEN_FIELDS) if (f in fe) spoofed.push(`focused_entity.${f}`);

  const str = (v: unknown, fallback = "") => (typeof v === "string" ? v : fallback);
  const arr = (v: unknown) => (Array.isArray(v) ? v : []);

  const route = str(o.route);
  if (!route.startsWith("/")) errors.push("route invalide");
  const page_id = str(o.page_id);
  if (!page_id) errors.push("page_id manquant");
  const page_version = str(o.page_version);
  if (!page_version) errors.push("page_version manquant");

  const area = AREAS.has(o.app_area as CloneChatAppArea) ? (o.app_area as CloneChatAppArea) : "unknown";

  const sanitized: CloneChatPageContext = Object.freeze({
    app_area: area,
    page_id,
    route,
    // Le texte visible est RÉDIGÉ : un écran peut contenir un e-mail, un IBAN, un salaire.
    page_title: redactSensitive(str(o.page_title)),
    page_version,
    visible_sections: Object.freeze(arr(o.visible_sections).map((s) => String(s)).slice(0, 40)),
    active_section: typeof o.active_section === "string" ? o.active_section : null,
    visible_panels: Object.freeze(arr(o.visible_panels).map((s) => String(s)).slice(0, 40)),
    focused_entity: Object.freeze({
      type: typeof fe.type === "string" ? fe.type : null,
      id: typeof fe.id === "string" ? fe.id : null, // un id d'ÉCRAN, jamais une autorité
      label: typeof fe.label === "string" ? redactSensitive(fe.label) : null,
    }),
    available_actions: Object.freeze([]),   // les actions viennent du SERVEUR, jamais du client
    blocking_conditions: Object.freeze([]), // les blocages sont PROUVÉS serveur
    surfaced_errors: Object.freeze(
      arr(o.surfaced_errors).slice(0, 10).map((e) => {
        const x = e as Record<string, unknown>;
        return Object.freeze({
          code: str(x.code, "UNKNOWN"),
          message: redactSensitive(str(x.message)).slice(0, 300),
          route: typeof x.route === "string" ? x.route : null,
        });
      }),
    ),
    ui_targets: Object.freeze([]), // les cibles viennent du REGISTRE officiel, jamais du client
    client_observed_at: str(o.client_observed_at),
  });

  return {
    ok: errors.length === 0,
    spoofedFields: Object.freeze([...new Set(spoofed)]),
    errors: Object.freeze(errors),
    sanitized: errors.length === 0 ? sanitized : null,
  };
}

/** Le contexte d'écran est-il PÉRIMÉ par rapport à la version courante de la page ? */
export function isPageContextStale(ctx: CloneChatPageContext, currentVersion: string | null): boolean {
  if (!currentVersion) return true; // page inconnue du registre ⇒ on ne fait pas confiance
  return ctx.page_version !== currentVersion;
}

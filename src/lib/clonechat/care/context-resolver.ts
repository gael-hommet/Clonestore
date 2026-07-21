// src/lib/clonechat/care/context-resolver.ts
// C1.8 §4 — CLONECONTEXT, CÔTÉ SERVEUR.
//
// « Le client peut décrire son ÉCRAN. Le serveur résout son IDENTITÉ. »
//
// Ce module ne crée PAS une seconde porte d'accès. Il PROJETTE les autorités déjà calculées par
// la route canonique (viewer C1.6, PierreAccessResult C1.4, TenantResolution) en un contexte de
// support exploitable. Aucune décision d'accès n'est prise ici : elles ont déjà été prises.
//
// La ligne de doctrine la plus importante du bloc est appliquée ici, littéralement :
//
//     « un état de compte INCONNU n'est pas un état de compte SAIN »
//
// Une panne de vérification du droit Pierre (LOOKUP_FAILED) ne devient donc NI « actif »
// (mensonge optimiste) NI « inactif » (mensonge pessimiste, qui ferait dire à CloneChat
// « Pierre n'est pas activé chez vous » à un client qui a payé). Elle devient `unknown`,
// et `unknown` n'autorise aucun effet et ne produit aucune affirmation.

// Import de TYPE uniquement — volontairement AUCUNE dépendance d'exécution vers `@/lib/pierre/access`.
// La discrimination se fait sur l'union elle-même (`ok` / `reason`), ce qui donne exactement la même
// sûreté de typage sans coupler CloneCare au module d'accès : la route reste mockable telle quelle
// par les suites C1.4/C1.6 existantes, que ce bloc n'a pas à modifier.
import type { PierreAccessResult } from "@/lib/pierre/access";
import type { TenantResolution } from "../server/company";
import type { CloneChatViewer, CloneChatPlan } from "../server/universal-access";
import type {
  CloneChatResolvedAccountContext, CloneChatViewerKind, CloneChatBlocker,
  EmployeeAccessState,
} from "./contracts";

export interface ResolveContextInput {
  readonly viewer: CloneChatViewer;
  readonly entitlement: PierreAccessResult | null;
  readonly tenant: TenantResolution | null;
  readonly plan: CloneChatPlan;
  readonly at: string;
}

/**
 * Le type de lecteur découle des autorités serveur — jamais d'une déclaration du client.
 *
 * Le `switch` est EXHAUSTIF à dessein : si un nouveau code de refus tenant apparaît un jour,
 * TypeScript refusera de compiler ce fichier plutôt que de le laisser tomber silencieusement
 * dans un `else` optimiste. (Une première version comparait à un code inexistant —
 * « COMPANY_SUSPENDED » — et la suspension n'aurait donc JAMAIS été détectée : c'est tsc,
 * pas les tests, qui l'a vu.)
 */
function viewerKind(input: ResolveContextInput): CloneChatViewerKind {
  if (input.viewer.kind === "anonymous") return "anonymous";
  const t = input.tenant;
  if (!t) return "authenticated_without_company";
  if (t.ok) return "company_member";

  switch (t.code) {
    case "MEMBERSHIP_SUSPENDED":
      return "suspended";
    case "MEMBERSHIP_REQUIRED":
      return "authenticated_without_company";
    case "COMPANY_SELECTION_REQUIRED":
      // Plusieurs entreprises actives, aucune choisie : le compte est SAIN, il manque un choix.
      // Ce n'est ni « sans entreprise » ni une panne — et c'est réparable par l'utilisateur.
      return "authenticated_without_company";
    case "COMPANY_UNAVAILABLE":
      // Panne. On ne prétend NI sain NI révoqué.
      return "unknown";
    default: {
      const _exhaustive: never = t.code;
      void _exhaustive;
      return "unknown"; // tout code inconnu ⇒ ignorance assumée, jamais une supposition
    }
  }
}

/**
 * Droit Pierre — trois états, pas deux. L'absence de preuve n'est pas la preuve de l'absence.
 */
function pierreState(e: PierreAccessResult | null): EmployeeAccessState {
  if (e === null) return "unknown";                    // jamais interrogé (anonyme)
  if (e.ok === true) return "active";                  // droit PROUVÉ présent
  if (e.reason === "LOOKUP_FAILED") return "unknown";  // ← panne ≠ inactif
  return "not_active";                                 // NO_ENTITLEMENT : preuve réelle d'absence
}

/**
 * Construit les BLOCAGES PROUVÉS. Un blocage ne peut naître que d'une preuve serveur :
 * il porte toujours sa source et sa version. Aucun blocage n'est « deviné ».
 */
function blockers(input: ResolveContextInput, kind: CloneChatViewerKind, pierre: EmployeeAccessState): CloneChatBlocker[] {
  const out: CloneChatBlocker[] = [];
  const v = input.plan;

  if (kind === "suspended") {
    out.push({
      code: "company_suspended",
      title: "Accès à l'entreprise suspendu",
      message: "Votre accès à cette entreprise est suspendu. Un humain doit intervenir.",
      severity: "critical",
      evidence_source: "server:tenant",
      evidence_version: null,
      next_step_label: null,
      next_step_href: null,
      resolvable_by_clonechat: false,
      requires_human_support: true,
    });
    return out; // rien d'autre ne compte tant que l'accès est suspendu
  }

  // « Vous n'avez pas d'entreprise » et « vous en avez plusieurs, choisissez » sont deux
  // situations DIFFÉRENTES. Les confondre, c'est dire à un client qu'il n'a pas d'entreprise
  // alors qu'il en a trois.
  const selectionRequired = input.tenant !== null && !input.tenant.ok && input.tenant.code === "COMPANY_SELECTION_REQUIRED";

  if (kind === "authenticated_without_company" && selectionRequired) {
    out.push({
      code: "company_selection_required",
      title: "Plusieurs entreprises actives",
      message: "Votre compte est rattaché à plusieurs entreprises : je ne sais pas laquelle vous concerne. Sélectionnez-en une et je reprends.",
      severity: "warning",
      evidence_source: "server:tenant",
      evidence_version: null,
      next_step_label: "Choisir l'entreprise",
      next_step_href: "/mon-clonestore",
      resolvable_by_clonechat: false,
      requires_human_support: false,
    });
  } else if (kind === "authenticated_without_company") {
    out.push({
      code: "no_active_company",
      title: "Aucune entreprise active",
      message: "Votre compte n'est rattaché à aucune entreprise active : les données RH ne sont donc pas accessibles. Les questions générales, elles, restent ouvertes.",
      severity: "warning",
      evidence_source: "server:tenant",
      evidence_version: null,
      next_step_label: "Créer ou rejoindre une entreprise",
      next_step_href: "/mon-clonestore",
      resolvable_by_clonechat: false,
      requires_human_support: false,
    });
  }

  // Le droit Pierre ne devient un BLOCAGE que s'il est PROUVÉ absent.
  // `unknown` (panne) ne produit AUCUN blocage : on ne dit pas à un client payant
  // que son employé n'est pas activé parce qu'une requête a échoué.
  if (pierre === "not_active" && kind === "company_member") {
    out.push({
      code: "pierre_not_active",
      title: "Pierre n'est pas activé",
      message: "Pierre n'est pas activé sur votre compte : les missions RH ne peuvent pas être lancées.",
      severity: "high",
      evidence_source: "server:entitlement",
      evidence_version: null,
      next_step_label: "Activer Pierre",
      next_step_href: "/reserver/pierre",
      resolvable_by_clonechat: false,
      requires_human_support: false,
    });
  }

  if (v.entitlementLookupFailed) {
    out.push({
      code: "entitlement_unknown",
      title: "État du compte indéterminé",
      message: "Je n'arrive pas à vérifier l'état de votre compte en ce moment. Je ne vais donc rien affirmer à ce sujet, et je n'exécuterai aucune action tant que ce n'est pas confirmé.",
      severity: "warning",
      evidence_source: "server:entitlement_lookup_failure",
      evidence_version: null,
      next_step_label: null,
      next_step_href: null,
      resolvable_by_clonechat: false,
      requires_human_support: false,
    });
  }

  return out;
}

/** Permissions — dérivées des autorités, jamais du client. */
function permissions(kind: CloneChatViewerKind, pierre: EmployeeAccessState, plan: CloneChatPlan): string[] {
  if (kind !== "company_member") return [];
  const p = ["billing.read"];
  // Une action gouvernée exige un droit Pierre PROUVÉ actif — `unknown` n'accorde rien.
  if (pierre === "active" && plan.governedActionAvailable) p.push("mission.create");
  return p;
}

/**
 * PROJECTION. Ne lit aucune base, ne décide aucun accès : elle traduit ce que la route a
 * déjà prouvé. La `context_version` scelle l'instantané — toute action proposée sur une
 * version périmée sera rejetée (cf. `authorizeAction`).
 */
export function resolveAccountContext(input: ResolveContextInput): CloneChatResolvedAccountContext {
  const kind = viewerKind(input);
  const pierre = pierreState(input.entitlement);
  const tenant = input.tenant;
  const companyId = tenant?.ok ? tenant.companyId : null;
  const userId = input.viewer.kind === "user" ? input.viewer.userId : null;

  const known = blockers(input, kind, pierre);
  const perms = permissions(kind, pierre, input.plan);

  // Version du contexte : elle change dès qu'une AUTORITÉ change (identité, entreprise,
  // droit, blocages). C'est ce qui rend détectable une action proposée sur un état périmé.
  const contextVersion = [
    kind, userId ?? "anon", companyId ?? "nocompany", pierre,
    known.map((b) => b.code).join(",") || "-",
  ].join("|");

  return Object.freeze({
    viewer_kind: kind,
    user_id: userId,
    company_id: companyId,
    membership_id: null,
    roles: Object.freeze(tenant?.ok && tenant.role ? [tenant.role] : []),
    permissions: Object.freeze(perms),

    active_employee_slugs: Object.freeze(pierre === "active" ? ["pierre"] : []),
    employee_access_states: Object.freeze({ pierre }),

    // On ne PRÉTEND pas connaître ce qu'on n'a pas mesuré : ces états restent `unknown`
    // tant qu'aucune preuve serveur ne les renseigne. C'est volontaire, et testé.
    onboarding_state: kind === "company_member" ? "unknown" : "not_started",
    enterprise_footprint_state: "unknown",
    sender_identity_state: "unknown",
    domain_verification_state: "unknown",

    // La facturation en ligne n'est pas ouverte (plancher de production) : on le dit tel quel,
    // au lieu d'inventer un état « ok ».
    billing_state: "unknown",
    subscription_state: pierre === "active" ? "active" : pierre === "not_active" ? "none" : "unknown",
    payment_state: "unknown",

    product_flags: Object.freeze({
      private_context_available: input.plan.privateContextAvailable,
      governed_action_available: input.plan.governedActionAvailable,
    }),
    known_account_blockers: Object.freeze(known),

    context_version: contextVersion,
    resolved_at: input.at,
  });
}

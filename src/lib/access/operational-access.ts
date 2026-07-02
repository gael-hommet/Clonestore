import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabase-server";
import { hasPierreAccess } from "@/lib/pierre/access";

// Machine à états d'accès CENTRALISÉE et SERVEUR pour les espaces opérationnels
// (cockpit global, cockpit Pierre, messagerie). Masquer un bouton côté navigateur
// ne protège rien : le contrôle vit ici, côté serveur.
//
// SOURCE CANONIQUE de la décision « Pierre actif » = `hasPierreAccess` (le même
// primitive que les APIs Pierre, basé sur la commande `active`/`trialing`). On ne
// recrée pas une logique commerciale concurrente : `hasPierreAccess` décide de
// l'accès ; le statut de commande ne sert qu'à distinguer les sous-états verrouillés
// (paiement en cours / activation en cours / suspendu / terminé).
//
// États :
//   anonymous                     → non connecté (laissé au garde d'auth de la page)
//   authenticated_without_employee→ connecté, aucun employé → écran verrouillé premium
//   payment_pending               → paiement non finalisé → écran « paiement en cours »
//   activation_pending            → payé, activation en cours → écran « activation en cours »
//   employee_active               → accès complet (hasPierreAccess === true)
//   subscription_suspended        → impayé/suspendu → écran « réactiver »
//   subscription_ended            → terminé → écran « réactiver » (pas de lecture seule réelle)

export type OperationalAccessState =
  | "anonymous"
  | "authenticated_without_employee"
  | "payment_pending"
  | "activation_pending"
  | "employee_active"
  | "subscription_suspended"
  | "subscription_ended";

export const OPERATIONAL_ACCESS_STATES: OperationalAccessState[] = [
  "anonymous",
  "authenticated_without_employee",
  "payment_pending",
  "activation_pending",
  "employee_active",
  "subscription_suspended",
  "subscription_ended",
];

export interface OperationalAccess {
  state: OperationalAccessState;
  userId: string | null;
  orderStatus: string | null;
}

const PAYMENT_PENDING_STATUSES = new Set([
  "incomplete",
  "requires_action",
  "requires_payment_method",
  "pending",
]);
const ACTIVATION_PENDING_STATUSES = new Set(["processing", "provisioning"]);
const SUSPENDED_STATUSES = new Set(["past_due", "unpaid"]);
const ENDED_STATUSES = new Set(["canceled", "cancelled", "incomplete_expired", "ended"]);

/** Sous-état verrouillé déduit du statut de commande (jamais « actif » ici). */
function mapNonActiveStatusToState(status: string | null): OperationalAccessState {
  if (!status) return "authenticated_without_employee";
  const s = status.toLowerCase();
  if (PAYMENT_PENDING_STATUSES.has(s)) return "payment_pending";
  if (ACTIVATION_PENDING_STATUSES.has(s)) return "activation_pending";
  if (SUSPENDED_STATUSES.has(s)) return "subscription_suspended";
  if (ENDED_STATUSES.has(s)) return "subscription_ended";
  // Statut inconnu → fail-closed, jamais d'accès.
  return "authenticated_without_employee";
}

/** Seul l'état `employee_active` ouvre les fonctions opérationnelles complètes. */
export function isOperationalUnlocked(state: OperationalAccessState): boolean {
  return state === "employee_active";
}

// Statuts qui valent « employé réellement actif » (payé + provisionné + actif).
// Identiques à `hasPierreAccess` (l'essai compte comme accès) : on ne crée pas une
// règle commerciale concurrente, on l'applique simplement à TOUT employé IA.
const ACTIVE_EMPLOYEE_STATUSES = ["active", "trialing"];

/**
 * Décision « au moins un employé IA actif » pour le COCKPIT GÉNÉRAL (/profile) :
 * comme `hasPierreAccess` mais NON limitée au seul slug « pierre ». Un compte qui
 * possède n'importe quel employé CloneStore payé et actif ouvre son cockpit général.
 */
async function hasAnyActiveEmployee(
  supabase: Parameters<typeof hasPierreAccess>[0],
  userId: string,
): Promise<{ ok: boolean; error: string | null }> {
  const { data, error } = await supabase
    .from("orders")
    .select("id")
    .eq("user_id", userId)
    .in("status", ACTIVE_EMPLOYEE_STATUSES)
    .limit(1);

  if (error) return { ok: false, error: error.message };
  return { ok: Array.isArray(data) && data.length > 0, error: null };
}

/**
 * Override de test/dev (JAMAIS actif en production : la garde NODE_ENV rend ce
 * bloc mort dans un build de production, et un visiteur ne peut pas définir de
 * variable serveur). Permet de rendre chaque état connecté pour la QA.
 */
function isValidState(value: string | undefined | null): value is OperationalAccessState {
  return !!value && OPERATIONAL_ACCESS_STATES.includes(value as OperationalAccessState);
}

async function readDevStateOverride(): Promise<OperationalAccessState | null> {
  if (process.env.NODE_ENV === "production") return null;
  // Cookie (prioritaire) : permet de basculer d'état sans redémarrer le serveur.
  // Next.js 15 — `cookies()` est asynchrone et DOIT être await (plus d'accès synchrone).
  try {
    const store = (await cookies()) as unknown as {
      get(name: string): { value?: string } | undefined;
    };
    const cookieValue = store.get("e2e_operational_state")?.value?.trim();
    if (isValidState(cookieValue)) return cookieValue;
  } catch {
    // hors contexte requête (ex: tests) → on ignore
  }
  const env = process.env.E2E_OPERATIONAL_STATE?.trim();
  return isValidState(env) ? env : null;
}

// scope "pierre" → cockpit Pierre / messagerie (Pierre actif requis).
// scope "general" → cockpit général /profile (n'importe quel employé IA actif).
export async function resolveOperationalAccess(
  scope: "pierre" | "general" = "pierre",
): Promise<OperationalAccess> {
  const override = await readDevStateOverride();
  if (override) {
    return { state: override, userId: "e2e-test-user", orderStatus: override };
  }

  let supabase;
  try {
    supabase = await supabaseServer();
  } catch {
    return { state: "anonymous", userId: null, orderStatus: null };
  }

  let userId: string | null = null;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch {
    return { state: "anonymous", userId: null, orderStatus: null };
  }

  if (!userId) {
    return { state: "anonymous", userId: null, orderStatus: null };
  }

  // DÉCISION CANONIQUE : un employé réellement actif (payé + provisionné + actif).
  //   scope "pierre"  → hasPierreAccess (cockpit Pierre / messagerie)
  //   scope "general" → n'importe quel employé IA actif (cockpit général /profile)
  const access =
    scope === "general"
      ? await hasAnyActiveEmployee(supabase, userId)
      : await hasPierreAccess(supabase, userId);
  if (access.ok) {
    return { state: "employee_active", userId, orderStatus: "active" };
  }

  // Pas actif → on lit le statut de commande le plus récent pour le bon sous-état
  // (toutes commandes en scope général, Pierre uniquement sinon).
  let status: string | null = null;
  try {
    const base = supabase
      .from("orders")
      .select("status,created_at")
      .eq("user_id", userId);
    const scoped = scope === "general" ? base : base.eq("agent_slug", "pierre");
    const { data } = await scoped
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    status = (data as { status: string | null } | null)?.status ?? null;
  } catch {
    return { state: "authenticated_without_employee", userId, orderStatus: null };
  }

  return { state: mapNonActiveStatusToState(status), userId, orderStatus: status };
}

// ── Contenu des écrans verrouillés par état (centralisé, premium) ──────────────

export interface LockAction {
  label: string;
  href: string;
  primary?: boolean;
}

export interface OperationalLockContent {
  eyebrow: string;
  title: string;
  description: string;
  bullets?: string[];
  actions: LockAction[];
}

const DISCOVER_ACTIONS: LockAction[] = [
  { label: "Découvrir Pierre", href: "/agents/pierre", primary: true },
  { label: "Voir la démonstration", href: "/demo/pierre" },
  { label: "Installer Pierre", href: "/reserver/pierre" },
  { label: "Mon CloneStore", href: "/profile" },
];

/**
 * Contenu de l'écran verrouillé pour un état + un espace donné, ou `null` si
 * l'espace est ouvert (`employee_active`). `space` personnalise le vocabulaire.
 */
export function buildOperationalLock(
  state: OperationalAccessState,
  space: "cockpit" | "messagerie",
): OperationalLockContent | null {
  if (state === "employee_active") return null;

  const spaceLabel = space === "cockpit" ? "cockpit" : "messagerie";

  switch (state) {
    case "payment_pending":
      return {
        eyebrow: "Activation",
        title: "Votre paiement est en cours de finalisation.",
        description: `Dès que le paiement est confirmé, Pierre s'active et votre ${spaceLabel} s'ouvre automatiquement. Aucune action de votre part n'est nécessaire.`,
        bullets: [
          "Le paiement est en cours de traitement.",
          "L'activation se fait automatiquement.",
          "Vous recevrez la confirmation par email.",
        ],
        actions: [
          { label: "Mon CloneStore", href: "/profile", primary: true },
          { label: "Support", href: "/questions" },
        ],
      };
    case "activation_pending":
      return {
        eyebrow: "Activation",
        title: "Pierre est en cours d'activation.",
        description: `Votre abonnement est confirmé. Pierre prépare votre ${spaceLabel} — cela ne prend que quelques instants.`,
        bullets: [
          "Abonnement confirmé.",
          "Mise en service de Pierre en cours.",
          "Rechargez la page dans un instant.",
        ],
        actions: [
          { label: "Mon CloneStore", href: "/profile", primary: true },
          { label: "Support", href: "/questions" },
        ],
      };
    case "subscription_suspended":
      return {
        eyebrow: spaceLabel === "cockpit" ? "Cockpit" : "Messagerie",
        title: "Votre abonnement Pierre est suspendu.",
        description: `Un paiement n'a pas pu être traité. Régularisez votre abonnement pour rouvrir votre ${spaceLabel}.`,
        actions: [
          { label: "Gérer mon abonnement", href: "/profile", primary: true },
          { label: "Support", href: "/questions" },
        ],
      };
    case "subscription_ended":
      return {
        eyebrow: spaceLabel === "cockpit" ? "Cockpit" : "Messagerie",
        title: "Votre abonnement Pierre est terminé.",
        description: `Pierre n'exécute plus de nouvelle action. Réactivez Pierre à tout moment pour rouvrir votre ${spaceLabel}.`,
        actions: [
          { label: "Réactiver Pierre", href: "/reserver/pierre", primary: true },
          { label: "Mon CloneStore", href: "/profile" },
          { label: "Support", href: "/questions" },
        ],
      };
    case "anonymous":
    case "authenticated_without_employee":
    default:
      return {
        eyebrow: spaceLabel === "cockpit" ? "Cockpit" : "Messagerie",
        title:
          space === "cockpit"
            ? "Votre cockpit s'active avec votre premier employé IA."
            : "Votre messagerie s'active avec votre premier employé IA.",
        description:
          space === "cockpit"
            ? "Le cockpit pilote les missions, validations, documents et la continuité de vos employés IA. Il s'ouvre dès que Pierre est actif dans votre organisation."
            : "La messagerie centralise les missions, validations, alertes et briefings de vos employés IA. Elle s'ouvre dès que Pierre est actif dans votre organisation.",
        bullets:
          space === "cockpit"
            ? [
                "Missions RH structurées et suivies",
                "Validations humaines sur le sensible",
                "Documents et emails préparés",
                "Historique et traçabilité",
              ]
            : [
                "Suivi des missions et des validations",
                "Alertes et briefings de Pierre",
                "Historique des échanges consultable",
                "Un seul fil pour tout l'opérationnel",
              ],
        actions: DISCOVER_ACTIONS,
      };
  }
}

// ── Écran verrouillé du COCKPIT GÉNÉRAL (/profile) ─────────────────────────────
// Même machine à états, mais contenu propre au cockpit général : CTA orientés
// achat / activation et JAMAIS de renvoi vers /profile (pas de boucle), jamais de
// fausse promesse d'employé actif.

const GENERAL_LOCK_TITLE = "Votre cockpit CloneStore n'est pas encore actif";
const GENERAL_LOCK_BASE =
  "Le cockpit s'ouvrira dès qu'au moins un employé IA payé sera activé sur votre organisation.";

/**
 * Contenu de l'écran verrouillé du cockpit général selon l'état, ou `null` si
 * l'accès est ouvert (`employee_active`).
 */
export function buildGeneralCockpitLock(
  state: OperationalAccessState,
): OperationalLockContent | null {
  if (state === "employee_active") return null;

  switch (state) {
    case "payment_pending":
      return {
        eyebrow: "Cockpit",
        title: GENERAL_LOCK_TITLE,
        description: `${GENERAL_LOCK_BASE} Votre paiement est en cours de finalisation.`,
        actions: [
          { label: "Consulter mon activation", href: "/reserver/pierre", primary: true },
          { label: "Support", href: "/questions" },
        ],
      };
    case "activation_pending":
      return {
        eyebrow: "Cockpit",
        title: GENERAL_LOCK_TITLE,
        description: `${GENERAL_LOCK_BASE} Votre abonnement est confirmé, l'activation est en cours.`,
        actions: [
          { label: "Activation en cours", href: "/agents/pierre", primary: true },
          { label: "Support", href: "/questions" },
        ],
      };
    case "subscription_suspended":
      return {
        eyebrow: "Cockpit",
        title: GENERAL_LOCK_TITLE,
        description: `${GENERAL_LOCK_BASE} Votre abonnement est actuellement suspendu.`,
        actions: [
          { label: "Réactiver mon abonnement", href: "/reserver/pierre", primary: true },
          { label: "Support", href: "/questions" },
        ],
      };
    case "subscription_ended":
      return {
        eyebrow: "Cockpit",
        title: GENERAL_LOCK_TITLE,
        description: `${GENERAL_LOCK_BASE} Votre abonnement est terminé.`,
        actions: [
          { label: "Réactiver mon abonnement", href: "/reserver/pierre", primary: true },
          { label: "Support", href: "/questions" },
        ],
      };
    case "anonymous":
    case "authenticated_without_employee":
    default:
      return {
        eyebrow: "Cockpit",
        title: GENERAL_LOCK_TITLE,
        description: `${GENERAL_LOCK_BASE} Activez votre premier employé IA pour ouvrir le cockpit, la messagerie et tous les outils opérationnels.`,
        bullets: [
          "Vue générale, employés et Empreinte Entreprise",
          "Cockpit Pierre, messagerie et Employé 360",
          "Missions, validations et documents",
          "Aucun accès tant qu'aucun employé n'est actif",
        ],
        actions: [
          { label: "Découvrir Pierre", href: "/agents/pierre", primary: true },
          { label: "Voir la démonstration", href: "/demo/pierre" },
          { label: "Installer Pierre", href: "/reserver/pierre" },
        ],
      };
  }
}

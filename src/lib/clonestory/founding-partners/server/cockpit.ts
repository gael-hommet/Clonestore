// CloneStory — Résolution SERVEUR du statut partenaire pour « Mon espace ».
//
// À partir de l'utilisateur CloneStore AUTHENTIFIÉ (session Supabase, e-mail vérifié),
// on détermine de façon fiable, multi-tenant safe et NON falsifiable par le navigateur :
//   non_member | unverified | verified | suspended | withdrawn | ineligible | error
//
// Liaison sûre : l'e-mail du compte CloneStore (prouvé par la session) est comparé à
// l'e-mail normalisé du partenaire (unique). La recherche initiale se fait en mode
// SERVICE (nécessaire pour retrouver le partenaire) ; les lectures détaillées passent
// en mode PARTENAIRE (RLS forcée → ne voit QUE ses propres lignes). Aucune donnée
// d'un autre partenaire, aucun token brut, aucun secret ne sort d'ici.
//
// NOTE liaison durable : une migration prépare `account_user_id` (lien par user_id).
// Tant qu'elle n'est pas activée en production, la liaison se fait par e-mail vérifié
// (sanctionné par le cahier des charges). Voir _05 migration + documentation.

import { getClonestoryDb, withPartner, withService } from "./runtime";
import { normalizeEmailForCompare } from "../normalize";
import { buildIdentity, type FoundingPartnerIdentity } from "../vocabulary";
import { publicBaseUrl } from "./config";
import { computeDistinctions, countEarned, type ComputedDistinction } from "../distinctions";
import { getCommercialStatsForPartner, type CommercialStats } from "./commercial";

export type CockpitStatus =
  | "non_member"
  | "unverified"
  | "verified"
  | "suspended"
  | "withdrawn"
  | "ineligible"
  | "error";

export interface CockpitStats {
  introductionsDeclared: number;
  prospectsConfirmed: number;
  accountsCreated: number;
  companiesCreated: number;
  clientsAttributed: number;
  // CS-FINAL 3 — contributions commerciales réelles (source autoritative Stripe).
  clientsPaid: number;
  activationsCompleted: number;
  contributionsValidating: number;
  contributionsVerified: number;
  contributionsRefunded: number;
  contributionsDisputed: number;
  distinctionsEarned: number;
}

export interface CockpitActivity {
  type: string;
  label: string;
  occurredAt: string;
}

export interface CockpitMember {
  status: CockpitStatus;
  statusLabel: string;
  displayName: string;
  joinedAt: string | null;
  founding: FoundingPartnerIdentity | null;
  stats: CockpitStats;
  personalCode: string | null;
  publicLink: string | null;
  distinctions: ComputedDistinction[];
  recentActivity: CockpitActivity[];
}

export interface CockpitState {
  authenticated: boolean;
  member: boolean;
  status: CockpitStatus;
  /** présent uniquement si member === true. */
  partner?: CockpitMember;
}

// Funnel des statuts d'introduction : les compteurs sont calculés par AGRÉGAT SQL
// (COUNT FILTER) dans resolvePartnerCockpit — voir la requête `funnel` — afin de tenir
// à l'échelle (jamais de chargement de toutes les lignes).

const EVENT_LABELS: Record<string, string> = {
  introduction_declared: "Introduction déclarée",
  introduction_confirmed: "Prospect confirmé",
  prospect_registered: "Compte créé",
  company_created: "Entreprise créée",
  purchase_captured: "Achat attribué",
  activation_completed: "Activation confirmée",
  contribution_verified: "Contribution vérifiée",
  contribution_canceled: "Introduction annulée",
  contribution_disputed: "Litige signalé",
  manual_validation: "Validation manuelle",
};

const STATUS_LABELS: Record<CockpitStatus, string> = {
  non_member: "Non membre",
  unverified: "Adresse non confirmée",
  verified: "Membre du Cercle Fondateur",
  suspended: "Suspendu",
  withdrawn: "Retiré du registre",
  ineligible: "Inéligible",
  error: "État indisponible",
};

function mapStatus(partnerStatus: string, emailVerifiedAt: string | null): CockpitStatus {
  if (partnerStatus === "suspended") return "suspended";
  if (partnerStatus === "withdrawn") return "withdrawn";
  if (!emailVerifiedAt) return "unverified";
  if (["email_verified", "identity_verified", "active_contributor", "founding_partner"].includes(partnerStatus)) {
    return "verified";
  }
  return "ineligible";
}

interface PartnerRow {
  id: string;
  status: string;
  display_name: string;
  registry_number: number | null;
  joined_at: string | Date | null;
  personal_code: string | null;
  link_revoked_at: string | Date | null;
  email_verified_at: string | Date | null;
}

/**
 * Résout l'espace partenaire de l'utilisateur connecté. `account.email` DOIT provenir
 * d'une session authentifiée (Supabase) — il sert de preuve de propriété de l'adresse.
 */
export async function resolvePartnerCockpit(account: { userId: string; email: string | null }): Promise<CockpitState> {
  const emailNorm = normalizeEmailForCompare(account.email ?? "");
  if (!emailNorm) return { authenticated: true, member: false, status: "non_member" };

  const db = await getClonestoryDb();

  // 1) Recherche du partenaire par e-mail vérifié (mode service — lookup unique).
  const partner = await withService(db, async (tx) => {
    const { rows } = await tx.query<PartnerRow>(
      `select id::text, status, display_name, registry_number, joined_at, personal_code, link_revoked_at, email_verified_at
         from clonestory_fp_partners where email_normalized = $1 limit 1`,
      [emailNorm],
    );
    return rows[0] ?? null;
  });

  if (!partner) return { authenticated: true, member: false, status: "non_member" };

  const status = mapStatus(partner.status, partner.email_verified_at ? String(partner.email_verified_at) : null);

  // 2) Lectures détaillées en mode PARTENAIRE (RLS forcée → isolation réelle). Le funnel
  // est calculé par AGRÉGAT (COUNT FILTER, indexé par partner_id) — JAMAIS en chargeant
  // toutes les introductions (généralisation multi-comptes : tient à l'échelle).
  const detail = await withPartner(db, partner.id, async (tx) => {
    const funnel = await tx.query<{ declared: number; confirmed: number; accounts: number; companies: number; clients: number; verified: number }>(
      `select
         count(*)::int declared,
         count(*) filter (where status in ('prospect_confirmed','prospect_registered','company_created','purchase_captured','activation_completed','validation_pending','verified'))::int confirmed,
         count(*) filter (where status in ('prospect_registered','company_created','purchase_captured','activation_completed','verified'))::int accounts,
         count(*) filter (where status in ('company_created','purchase_captured','activation_completed','verified'))::int companies,
         count(*) filter (where status in ('purchase_captured','activation_completed','verified'))::int clients,
         count(*) filter (where status = 'verified')::int verified
       from clonestory_fp_introductions where partner_id = $1`,
      [partner.id],
    );
    const events = await tx.query<{ type: string; occurred_at: string | Date }>(
      `select type, occurred_at from clonestory_fp_contribution_events where partner_id = $1 order by occurred_at desc limit 5`,
      [partner.id],
    );
    return { funnel: funnel.rows[0] ?? { declared: 0, confirmed: 0, accounts: 0, companies: 0, clients: 0, verified: 0 }, events: events.rows };
  });

  const f = detail.funnel;

  // Comptes/entreprises créés = source UNIFIÉE du moteur d'attribution (origines lien +
  // introduction). Lecture en mode partenaire (RLS). Repli GRACIEUX sur le funnel
  // d'introductions si la table d'attribution n'est pas encore activée (migration _06).
  let accountsCreated = Number(f.accounts);
  let companiesCreated = Number(f.companies);
  try {
    const a = await withPartner(db, partner.id, (tx) =>
      tx.query<{ accounts: number; companies: number }>(
        `select count(*) filter (where status in ('account_linked','company_linked'))::int accounts,
                count(*) filter (where status = 'company_linked')::int companies
           from clonestory_fp_attributions where partner_id = $1`,
        [partner.id],
      ),
    );
    accountsCreated = Number(a.rows[0]?.accounts ?? 0);
    companiesCreated = Number(a.rows[0]?.companies ?? 0);
  } catch {
    /* table absente (prod sans _06) → on garde le repli basé sur les introductions */
  }

  // CS-FINAL 3 — contributions COMMERCIALES réelles (source autoritative Stripe).
  // Lecture en mode partenaire (RLS). Repli GRACIEUX sur les introductions si la table
  // n'est pas encore activée en production (migration _07).
  let commercial: CommercialStats = {
    clientsPaid: 0, activationsCompleted: 0, contributionsValidating: 0,
    contributionsVerified: 0, contributionsRefunded: 0, contributionsDisputed: 0,
  };
  try {
    commercial = await withPartner(db, partner.id, (tx) => getCommercialStatsForPartner(tx, partner.id));
  } catch {
    /* table absente (prod sans _07) → repli sur le funnel d'introductions */
  }

  const baseStats = {
    status: partner.status,
    introductionsDeclared: Number(f.declared),
    prospectsConfirmed: Number(f.confirmed),
    accountsCreated,
    // La source commerciale (lien + introduction unifiés) prime quand elle existe ;
    // sinon repli sur le funnel d'introductions (nominatif seul).
    clientsAttributed: commercial.clientsPaid || Number(f.clients),
    contributionsVerified: commercial.contributionsVerified || Number(f.verified),
    isFoundingPartner: partner.status === "founding_partner" && Boolean(partner.registry_number),
  };

  const distinctions = computeDistinctions(baseStats);
  const joinedAtIso = partner.joined_at ? new Date(partner.joined_at).toISOString() : null;
  const code = partner.personal_code;
  const publicLink = code && !partner.link_revoked_at ? `${publicBaseUrl()}/founding-partners/r/${code}` : null;

  const founding = baseStats.isFoundingPartner && partner.registry_number && partner.joined_at
    ? buildIdentity(partner.registry_number, new Date(partner.joined_at))
    : null;

  const member: CockpitMember = {
    status,
    statusLabel: STATUS_LABELS[status],
    displayName: partner.display_name,
    joinedAt: joinedAtIso,
    founding,
    stats: {
      introductionsDeclared: baseStats.introductionsDeclared,
      prospectsConfirmed: baseStats.prospectsConfirmed,
      accountsCreated: baseStats.accountsCreated,
      companiesCreated,
      clientsAttributed: baseStats.clientsAttributed,
      clientsPaid: commercial.clientsPaid,
      activationsCompleted: commercial.activationsCompleted,
      contributionsValidating: commercial.contributionsValidating,
      contributionsVerified: baseStats.contributionsVerified,
      contributionsRefunded: commercial.contributionsRefunded,
      contributionsDisputed: commercial.contributionsDisputed,
      distinctionsEarned: countEarned(distinctions),
    },
    personalCode: code,
    publicLink,
    distinctions,
    recentActivity: detail.events.map((e) => ({
      type: e.type,
      label: EVENT_LABELS[e.type] ?? e.type,
      occurredAt: new Date(e.occurred_at).toISOString(),
    })),
  };

  return { authenticated: true, member: true, status, partner: member };
}

/**
 * Résolution MINIMALE pour le pont de session registre (server-only). Renvoie l'id du
 * partenaire + son statut à partir de l'e-mail AUTHENTIFIÉ. Jamais exposé au client :
 * sert uniquement à émettre, côté serveur, le cookie membre `csy_member` pour le
 * partenaire dont l'e-mail correspond. `partnerId` ne transite jamais par le navigateur.
 */
export async function resolvePartnerSession(
  email: string | null,
): Promise<{ partnerId: string; status: CockpitStatus } | null> {
  const emailNorm = normalizeEmailForCompare(email ?? "");
  if (!emailNorm) return null;
  const db = await getClonestoryDb();
  const partner = await withService(db, async (tx) => {
    const { rows } = await tx.query<{ id: string; status: string; email_verified_at: string | Date | null }>(
      `select id::text, status, email_verified_at from clonestory_fp_partners where email_normalized = $1 limit 1`,
      [emailNorm],
    );
    return rows[0] ?? null;
  });
  if (!partner) return null;
  return { partnerId: partner.id, status: mapStatus(partner.status, partner.email_verified_at ? String(partner.email_verified_at) : null) };
}

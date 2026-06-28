// CloneStory — ONBOARDING SEAMLESS (SERVER-ONLY) : un email → vérification + session.
//
// Orchestration ATOMIQUE et IDEMPOTENTE de la confirmation : vérifie le token CloneStory,
// établit la session CloneStore (créée ou restaurée), lie durablement le compte au
// partenaire, SANS jamais voler ni écraser un compte. La mécanique Supabase Auth
// (generateLink + verifyOtp) est INJECTÉE via `deps` → ce module est testable sans GoTrue.
//
// La sécurité : l'email du token CloneStory DOIT correspondre exactement à l'email de la
// session ; sinon (autre adresse connectée) on ne lie JAMAIS automatiquement (état conflict).

import { normalizeEmailForCompare } from "../normalize";
import { verifyEmailToken, linkPartnerAccount } from "./store";

export type AuthAction = "mint" | "reuse" | "conflict";

/** Décision PURE : que faire de l'auth selon l'email actuellement connecté ? */
export function decideAuthAction(clonestoryEmail: string | null, loggedInEmail: string | null): AuthAction {
  const target = normalizeEmailForCompare(clonestoryEmail ?? "");
  const current = normalizeEmailForCompare(loggedInEmail ?? "");
  if (!current) return "mint";            // aucune session → créer/restaurer
  if (current === target) return "reuse"; // même adresse déjà connectée → réutiliser
  return "conflict";                       // AUTRE adresse → ne jamais lier automatiquement
}

function maskEmail(email: string | null): string {
  if (!email || !email.includes("@")) return "ton adresse";
  const [l, d] = email.split("@");
  return `${l.slice(0, 1)}${"•".repeat(Math.max(1, l.length - 1))}@${d}`;
}

export interface SeamlessDeps {
  /** Email + id de la session actuelle (null si aucune session CloneStore). */
  currentUser: () => Promise<{ id: string; email: string | null } | null>;
  /**
   * Crée OU restaure une session Supabase pour l'email (generateLink magiclink + verifyOtp) ;
   * pose les cookies d'auth dans la réponse. Retourne le user.id. Aucun second email envoyé.
   */
  mintSession: (email: string) => Promise<{ ok: boolean; userId?: string; error?: string }>;
}

export type SeamlessOutcome =
  | { state: "linked"; partnerId: string; userId: string; firstVerification: boolean }
  | { state: "conflict"; partnerId: string; firstVerification: boolean; loggedInEmailMasked: string; clonestoryEmailMasked: string }
  | { state: "account_taken"; partnerId: string; firstVerification: boolean }
  | { state: "auth_failed"; partnerId: string; firstVerification: boolean }
  | { state: "invalid" };

/**
 * Confirmation seamless. Étapes (atomiques côté CloneStory ; idempotentes) :
 *   1) vérifier le token CloneStory (email_verified + génération courante + non retiré) ;
 *   2) lire la session actuelle → décider mint / reuse / conflict ;
 *   3) si conflict → renvoyer l'état (l'UI propose de changer de compte), aucune liaison ;
 *   4) sinon établir/réutiliser la session → user.id ;
 *   5) lier account_user_id au partenaire (no-steal, idempotent).
 * Un retry après succès reverifie le token (idempotent), réutilise la session, relie (already).
 */
export async function runSeamlessConfirm(token: string, deps: SeamlessDeps): Promise<SeamlessOutcome> {
  const v = await verifyEmailToken(token);
  if (!v.ok) return { state: "invalid" };
  const partner = v.partner;

  const fv = v.firstVerification;
  const current = await deps.currentUser();
  const action = decideAuthAction(partner.email, current?.email ?? null);

  if (action === "conflict") {
    return { state: "conflict", partnerId: partner.id, firstVerification: fv, loggedInEmailMasked: maskEmail(current!.email), clonestoryEmailMasked: maskEmail(partner.email) };
  }

  let userId: string;
  if (action === "reuse") {
    userId = current!.id;
  } else {
    const m = await deps.mintSession(partner.email);
    if (!m.ok || !m.userId) return { state: "auth_failed", partnerId: partner.id, firstVerification: fv };
    userId = m.userId;
  }

  const link = await linkPartnerAccount(partner.id, userId);
  if (!link.ok && link.reason === "account_taken") return { state: "account_taken", partnerId: partner.id, firstVerification: fv };
  // `already` / `partner_linked_other` → le partenaire reste lié à SON compte (idempotent).
  return { state: "linked", partnerId: partner.id, userId, firstVerification: fv };
}

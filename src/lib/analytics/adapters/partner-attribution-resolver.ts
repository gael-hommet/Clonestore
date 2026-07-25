// Canonical Analytics Runtime Wiring — résolveur d'attribution Partner EN LECTURE SEULE.
// Ne réimplémente AUCUNE logique d'attribution : lit uniquement le résultat DÉJÀ VALIDÉ par le
// Partner Program (table clonestore_pp_customers, écrite exclusivement par
// lockAttributionOnFirstPayment APRÈS anti-auto-parrainage / anti-fraude / verrouillage).
// Ne calcule aucune commission, ne modifie aucun payout, ne fait jamais confiance au client.
//
// Gates (hérités du fait que la ligne customer n'existe qu'après validation Partner) :
//   - attribution révoquée/supersédée → aucune ligne customer → null ;
//   - auto-parrainage / token invalide → jamais verrouillé → aucune ligne → null ;
//   - partenaire suspendu → filtré explicitement ici (status = 'active' requis) → null ;
//   - attribution expirée → jamais verrouillée après expiration → aucune ligne → null.
//
// Retourne un identifiant INTERNE BORNÉ (hash), jamais l'UUID Partner brut, jamais une donnée
// personnelle, jamais un nom de cabinet.

import { createHash } from "node:crypto";
import { getPartnerDb, withService } from "@/lib/partner-program/server/runtime";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Hash borné (jamais l'UUID Partner brut) pour un usage analytique. */
export function boundedPartnerAttributionId(partnerId: string): string {
  return "pp_" + createHash("sha256").update(partnerId, "utf8").digest("hex").slice(0, 16);
}

/**
 * Résout, en lecture seule, l'attribution Partner VALIDÉE pour un utilisateur abonné.
 * `subjectUserId` DOIT provenir du serveur (metadata d'abonnement Stripe `user_id`), jamais du
 * client. Best-effort : toute erreur/indisponibilité renvoie null (aucune attribution plutôt
 * qu'une attribution douteuse), jamais un throw jusqu'au chemin appelant.
 */
export async function resolvePartnerAttributionForUser(subjectUserId: string | null | undefined): Promise<string | null> {
  if (!subjectUserId || !UUID_RE.test(subjectUserId)) return null;
  try {
    const db = await getPartnerDb();
    const partnerId = await withService(db, async (tx) => {
      const r = await tx.query<{ partner_id: string }>(
        `select c.partner_id
           from clonestore_pp_customers c
           join clonestore_pp_partners p on p.id = c.partner_id
          where c.subject_user_id = $1
            and c.status in ('active','past_due')
            and p.status = 'active'
          order by c.started_at desc
          limit 1`,
        [subjectUserId],
      );
      return r.rows[0]?.partner_id ?? null;
    });
    return partnerId ? boundedPartnerAttributionId(partnerId) : null;
  } catch {
    return null;
  }
}

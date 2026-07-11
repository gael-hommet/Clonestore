// Programme partenaires — résolution du cabinet depuis la session Supabase (server-only).
// Lie le compte au cabinet par email vérifié (no-steal) si pas encore lié.

import { supabaseServer } from "@/lib/supabase-server";
import type { SqlExecutor } from "@/lib/pierre/v1/sql";
import { getPartnerByAccount, linkPartnerAccount, type PartnerRow } from "./partners";
import { normalizeEmail } from "./identity";

export type ResolvedPartner =
  | { ok: true; userId: string; email: string; partner: PartnerRow }
  | { ok: false; status: number; code: string };

/** Résout le cabinet du user authentifié. Lie par email si un cabinet correspond et n'est pas lié. */
export async function resolvePartnerFromSession(db: SqlExecutor, withServiceFn: <T>(db: SqlExecutor, fn: (tx: SqlExecutor) => Promise<T>) => Promise<T>): Promise<ResolvedPartner> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { ok: false, status: 401, code: "AUTH_REQUIRED" };
  const userId = data.user.id;
  const email = data.user.email ?? null;

  const partner = await withServiceFn(db, async (tx) => {
    let p = await getPartnerByAccount(tx, userId);
    if (!p && email) {
      // Liaison par email vérifié (no-steal) sur un cabinet non lié.
      const byEmail = await tx.query<{ id: string; account_user_id: string | null }>(
        `select id, account_user_id from clonestore_pp_partners where email_normalized = $1 limit 1`,
        [normalizeEmail(email)],
      );
      const row = byEmail.rows[0];
      if (row && row.account_user_id === null) {
        const link = await linkPartnerAccount(tx, row.id, userId);
        if (link.ok) p = await getPartnerByAccount(tx, userId);
      }
    }
    return p;
  });

  if (!partner) return { ok: false, status: 404, code: "NOT_A_PARTNER" };
  if (!email) return { ok: false, status: 401, code: "AUTH_REQUIRED" };
  return { ok: true, userId, email, partner };
}

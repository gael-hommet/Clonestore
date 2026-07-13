// src/lib/pierre/v1/__integration__/p16e-r1-role-revocation.itest.ts
// P16E §4.A — R1 : la RÉVOCATION D'UN RÔLE doit réellement retirer l'autorité.
//
// DÉFAUT (confirmé sur le vrai chemin) — `removeRole` (members.ts) supprime les lignes de
// `pierre_rt_membership_roles` / `pierre_rt_membership_custom_roles` mais ne touche JAMAIS la
// colonne héritée `pierre_rt_members.role`. Dans `resolveTenantContext` :
//   · `dbPerms` retombe sur le rôle hérité quand aucun membership_role ne reste (ligne 97) ;
//   · `codeFallback = ROLE_PERMISSIONS[member.role]` est TOUJOURS unionné (ligne 122).
// Donc retirer TOUS les rôles d'un membre est un NO-OP : il conserve validation.decide et
// employee.write via son ancien rôle. Un admin croit révoquer, l'autorité persiste.
//
// Reproduction sur Postgres réel (PGlite + vraies migrations). Le test asserte le comportement
// SÛR attendu ; il échoue AVANT le correctif (prouve la faille) et passe APRÈS.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { newUuid } from "../sql";
import { resolveTenantContext } from "../tenant-context";
import { assignRole, removeRole } from "../members";

let h: Harness;
beforeEach(async () => { h = await createHarness(); });
afterEach(async () => { await h.close(); });

/** Sème un membre actif avec une colonne `role` héritée + un membership_role système. */
async function seedMember(role: string, roleKey: string): Promise<{ userId: string; membershipId: string }> {
  const userId = newUuid();
  const membershipId = newUuid();
  await h.db.query(
    `insert into pierre_rt_members (id, company_id, user_id, role, status) values ($1,$2,$3,$4,'active')`,
    [membershipId, h.companyA, userId, role]);
  await h.db.query(
    `insert into pierre_rt_membership_roles (company_id, membership_id, role_key) values ($1,$2,$3) on conflict do nothing`,
    [h.companyA, membershipId, roleKey]);
  return { userId, membershipId };
}

const resolve = (userId: string) => resolveTenantContext(h.db, { user_id: userId, company_id: h.companyA });

describe("P16E §4.A — R1 : révocation de rôle effective", () => {
  it("retirer le rôle hr_manager retire réellement validation.decide et employee.write", async () => {
    const { userId, membershipId } = await seedMember("hr_manager", "HR_MANAGER");
    const owner = h.ctx("A"); // tenancy.admin

    // Avant : le membre décide des validations et écrit des données employé.
    const before = await resolve(userId);
    expect(before.permissions).toContain("validation.decide");
    expect(before.permissions).toContain("employee.write");

    // L'admin révoque le rôle.
    await removeRole(h.db, owner, membershipId, "HR_MANAGER");

    // Après : ces autorités sensibles DOIVENT avoir disparu (fail-closed sur la révocation).
    const after = await resolve(userId);
    expect(after.permissions).not.toContain("validation.decide");
    expect(after.permissions).not.toContain("employee.write");
    expect(after.permissions).not.toContain("mission.cancel");
  });

  it("après retrait de tous les rôles, il reste au plus une lecture (jamais l'ancienne autorité d'écriture)", async () => {
    const { userId, membershipId } = await seedMember("admin", "ADMIN");
    const owner = h.ctx("A");

    const before = await resolve(userId);
    expect(before.permissions).toContain("tenancy.admin"); // admin avait l'administration

    await removeRole(h.db, owner, membershipId, "ADMIN");

    const after = await resolve(userId);
    // Aucune autorité d'administration / d'écriture ne subsiste.
    expect(after.permissions).not.toContain("tenancy.admin");
    expect(after.permissions).not.toContain("employee.write");
    expect(after.permissions).not.toContain("validation.decide");
    // La lecture de base reste acceptable pour un membre encore actif.
    expect(after.permissions).toContain("employee.read");
  });

  it("retirer UN rôle parmi plusieurs ne touche pas les autres (pas de sur-révocation)", async () => {
    // Membre hr_manager (base) + rôle custom supplémentaire.
    const { userId, membershipId } = await seedMember("hr_manager", "HR_MANAGER");
    const owner = h.ctx("A");
    // Crée un rôle custom "Paie" avec une permission propre, puis l'assigne.
    await h.db.query(`insert into pierre_rt_custom_roles (company_id, key, label) values ($1,'PAIE','Paie') on conflict do nothing`, [h.companyA]);
    await h.db.query(`insert into pierre_rt_custom_role_permissions (company_id, role_key, permission_key) values ($1,'PAIE','payroll_prep.read') on conflict do nothing`, [h.companyA]);
    await assignRole(h.db, owner, membershipId, "PAIE");

    const before = await resolve(userId);
    expect(before.permissions).toContain("payroll_prep.read");
    expect(before.permissions).toContain("validation.decide");

    // On retire SEULEMENT le rôle custom : le rôle système de base doit rester.
    await removeRole(h.db, owner, membershipId, "PAIE");

    const after = await resolve(userId);
    expect(after.permissions).not.toContain("payroll_prep.read"); // custom retiré
    expect(after.permissions).toContain("validation.decide");     // base système conservée
  });

  it("un membre suspendu ou retiré n'obtient AUCUN contexte (échec fermé, inchangé)", async () => {
    const { userId, membershipId } = await seedMember("hr_manager", "HR_MANAGER");
    await h.db.query(`update pierre_rt_members set status='suspended' where id=$1`, [membershipId]);
    await expect(resolve(userId)).rejects.toBeTruthy();
    await h.db.query(`update pierre_rt_members set status='removed' where id=$1`, [membershipId]);
    await expect(resolve(userId)).rejects.toBeTruthy();
  });
});

// src/lib/pierre/v1/__integration__/p16e-f25-document-integrity.itest.ts
// P16E §5 (F25) — verifyDocumentIntegrity doit renvoyer ok:true pour une version de contrat
// réellement générée + finalisée (dont le content_hash = sha256 de l'artefact PDF stocké), et
// ok:false si les octets divergent. Reproduction sur Postgres réel.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { storageDeps, seedEmployee, publishContractTemplate } from "./b2g-helpers";
import * as C from "../contracts";
import * as D from "../documents";

let h: Harness; let owner: TenantContext; let emp: string; let sd: ReturnType<typeof storageDeps>;
beforeEach(async () => {
  h = await createHarness();
  owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA });
  sd = storageDeps();
  emp = await seedEmployee(h, h.companyA);
  await publishContractTemplate(h, owner);
});
afterEach(async () => { await sd.storage.purgeAll(); await h.close(); });

describe("P16E §5 F25 — intégrité d'une version de contrat générée", () => {
  it("un contrat généré + finalisé ⇒ verifyDocumentIntegrity ok:true (hash lié à l'artefact réel)", async () => {
    const c = await C.createGovernedContract(h.db, owner, { employee_id: emp, contract_type: "CDI_FULL_TIME", effective_from: "2026-01-01" });
    const res = await C.generateContract(h.db, owner, c.id, { field_values: { "employment.weekly_hours": "35" } }, sd.deps());
    await C.submitContractForReview(h.db, owner, c.id);
    await C.approveContract(h.db, owner, c.id);
    await C.finalizeContract(h.db, owner, c.id);

    // La version documentaire finalisée : son content_hash doit correspondre aux octets stockés.
    const vn = (await h.db.query<{ version_number: number }>(
      `select version_number from pierre_rt_document_versions where id=$1`, [res.document_version_id])).rows[0].version_number;
    const integ = await D.verifyDocumentIntegrity(h.db, owner, res.document_id, vn, sd.deps());
    expect(integ.ok).toBe(true);                    // ← était false avant P16E (bug F25)
    expect(integ.file_sha).toBeTruthy();
    // Pour un contrat, content_hash = hash CANONIQUE (modèle) ≠ file_sha (octets PDF) : c'est
    // précisément la cause du bug F25 (l'ancien code comparait ces deux hashs différents).
    expect(integ.content_hash).not.toBe(integ.file_sha);
  });

  it("si les octets stockés sont altérés, verifyDocumentIntegrity renvoie ok:false (détection réelle)", async () => {
    const c = await C.createGovernedContract(h.db, owner, { employee_id: emp, contract_type: "CDI_FULL_TIME", effective_from: "2026-01-01" });
    const res = await C.generateContract(h.db, owner, c.id, { field_values: { "employment.weekly_hours": "35" } }, sd.deps());
    await C.submitContractForReview(h.db, owner, c.id);
    await C.approveContract(h.db, owner, c.id);
    await C.finalizeContract(h.db, owner, c.id);

    // Falsifie le sha256 ENREGISTRÉ du fichier : les octets réels ne correspondent plus ⇒ ok:false.
    await h.db.query(
      `update pierre_rt_files set sha256='deadbeef' where id=(select rendered_pdf_file_id from pierre_rt_document_versions where id=$1)`,
      [res.document_version_id]);
    const vn = (await h.db.query<{ version_number: number }>(
      `select version_number from pierre_rt_document_versions where id=$1`, [res.document_version_id])).rows[0].version_number;
    const integ = await D.verifyDocumentIntegrity(h.db, owner, res.document_id, vn, sd.deps());
    expect(integ.ok).toBe(false);
  });
});

// src/lib/pierre/v1/__integration__/p16d-retro-quarantine-finalize.itest.ts
// P16D §8 — INTÉGRITÉ DOCUMENTAIRE : « généré » ne doit jamais valoir « prêt à signer ».
//
// DÉFAUT CORRIGÉ (confirmé, reproduit ici de bout en bout sur un vrai Postgres) —
// `createVersion()` appelait bien `assertFileAttachable()` (fichier propre, scanné, hashé) AU
// MOMENT DE L'ATTACHEMENT. Mais `rescanFile()` peut re-qualifier un fichier `clean` →
// `quarantined`/`infected` APRÈS coup (base de signatures mise à jour, menace découverte plus
// tard). Or `finalizeVersion()` ne re-lisait JAMAIS l'état du fichier : il se contentait de
// dériver le hash de l'artefact courant.
//
// Conséquence RÉELLE : un artefact rétro-mis-en-quarantaine devenait `final`, le document
// passait `published`, et l'événement `document.signature_ready` était émis — sur un fichier
// infecté. `downloadDocument()` re-vérifiait déjà (§15) ; la finalisation, non. Une preuve de
// propreté PÉRIMÉE n'est pas une preuve.
//
// Correction : re-vérifier les artefacts AU MOMENT DE LA FINALISATION (même garde, réutilisée).
// Aucun second cerveau, aucun nouveau registre : `assertFileAttachable` est la garde existante.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { storageDeps, seedEmployee, publishContractTemplate } from "./b2g-helpers";
import type { FileScanProvider, ScanResult } from "../file-scan";
import { rescanFile } from "../files";
import * as C from "../contracts";
import * as D from "../documents";

/** Scanner qui découvre APRÈS COUP une menace sur un fichier jadis déclaré propre.
 *  C'est exactement le scénario « nouvelle base de signatures » — pas un état forgé à la main :
 *  on passe par le VRAI `rescanFile()`, qui écrit le VRAI verdict en base. */
class NewlyInfectedScanProvider implements FileScanProvider {
  readonly name = "p16d_newly_infected";
  readonly available = true;
  async scan(): Promise<ScanResult> {
    return { scanner: this.name, scan_status: "infected", signature: "P16D-Retro-Signature", detail: { discovered_after_attachment: true } };
  }
}

let h: Harness; let owner: TenantContext; let emp: string; let sd: ReturnType<typeof storageDeps>;
beforeEach(async () => {
  h = await createHarness();
  owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA });
  sd = storageDeps();
  emp = await seedEmployee(h, h.companyA);
  await publishContractTemplate(h, owner);
});
afterEach(async () => { await sd.storage.purgeAll(); await h.close(); });

/** Contrat réel généré + approuvé : la version documentaire porte un VRAI PDF rendu, propre. */
async function approvedContract(): Promise<{ contractId: string; dv: string; pdfFileId: string }> {
  const c = await C.createGovernedContract(h.db, owner, { employee_id: emp, contract_type: "CDI_FULL_TIME", effective_from: "2026-01-01" });
  const res = await C.generateContract(h.db, owner, c.id, { field_values: { "employment.weekly_hours": "35" } }, sd.deps());
  await C.submitContractForReview(h.db, owner, c.id);
  await C.approveContract(h.db, owner, c.id);
  const row = (await h.db.query<{ rendered_pdf_file_id: string }>(
    `select rendered_pdf_file_id from pierre_rt_document_versions where id=$1`, [res.document_version_id])).rows[0];
  return { contractId: c.id, dv: res.document_version_id, pdfFileId: row.rendered_pdf_file_id };
}

const fileState = async (id: string) =>
  (await h.db.query<{ upload_status: string; scan_status: string }>(
    `select upload_status, scan_status from pierre_rt_files where id=$1`, [id])).rows[0];
const dvStatus = async (dv: string) =>
  (await h.db.query<{ status: string }>(`select status from pierre_rt_document_versions where id=$1`, [dv])).rows[0].status;
const docStatus = async (dv: string) =>
  (await h.db.query<{ status: string }>(
    `select d.status from pierre_rt_documents d join pierre_rt_document_versions v on v.document_id=d.id where v.id=$1`, [dv])).rows[0].status;
const signatureReadyEvents = async () =>
  (await h.db.query<{ n: string }>(
    `select count(*)::text as n from pierre_rt_outbox where kind='document.signature_ready'`)).rows[0].n;

describe("P16D §8 — un artefact rétro-mis-en-quarantaine ne peut PAS être finalisé", () => {
  it("le fichier était propre à l'attachement, rescanFile le déclare infecté ⇒ finalizeVersion REFUSE", async () => {
    const { dv, pdfFileId } = await approvedContract();

    // Point de départ honnête : le PDF est réellement propre, la version est approuvée.
    expect(await fileState(pdfFileId)).toMatchObject({ upload_status: "clean", scan_status: "clean" });
    await D.approveVersion(h.db, owner, dv);
    expect(await dvStatus(dv)).toBe("approved");

    // RÉTRO-QUARANTAINE via le VRAI chemin : nouveau verdict scanner ⇒ écriture réelle en base.
    await rescanFile(h.db, owner, pdfFileId, { ...sd.deps(), scanner: new NewlyInfectedScanProvider() });
    expect(await fileState(pdfFileId)).toMatchObject({ upload_status: "quarantined", scan_status: "infected" });

    // AVANT P16D : la finalisation passait et publiait le document infecté.
    await expect(D.finalizeVersion(h.db, owner, dv)).rejects.toThrow(/not clean/i);

    // Et surtout : AUCUN état trompeur ne subsiste.
    expect(await dvStatus(dv)).toBe("approved");        // jamais `final`
    expect(await docStatus(dv)).not.toBe("published");  // jamais `published`
    expect(await signatureReadyEvents()).toBe("0");     // jamais « prêt à signer »
  });

  it("le contrat entier échoue fermé : un artefact infecté ne fait jamais aboutir finalizeContract", async () => {
    const { contractId, dv, pdfFileId } = await approvedContract();
    await rescanFile(h.db, owner, pdfFileId, { ...sd.deps(), scanner: new NewlyInfectedScanProvider() });

    await expect(C.finalizeContract(h.db, owner, contractId)).rejects.toBeTruthy();

    const ws = (await h.db.query<{ workflow_status: string }>(
      `select workflow_status from pierre_rt_employee_contracts where id=$1`, [contractId])).rows[0].workflow_status;
    expect(ws).not.toBe("final");
    expect(await dvStatus(dv)).not.toBe("final");
    expect(await signatureReadyEvents()).toBe("0");
  });

  it("non-régression : un artefact resté propre se finalise normalement", async () => {
    const { dv, pdfFileId } = await approvedContract();
    expect(await fileState(pdfFileId)).toMatchObject({ scan_status: "clean" });

    await D.approveVersion(h.db, owner, dv);
    const v = await D.finalizeVersion(h.db, owner, dv);

    expect(v.status).toBe("final");
    expect(v.content_hash).toBeTruthy();
    expect(await docStatus(dv)).toBe("published");
  });
});

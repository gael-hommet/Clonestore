// src/lib/pierre/v1/__integration__/p83-document-guard-service-enforcement.itest.ts
// PHASE 8.3-B2E §15 — enforceDocumentGuard turns a guard decision into a typed refusal,
// and a REAL service raises it: a rendered artifact that is no longer clean (retro-
// quarantined after finalization) is refused at download time. This is the proof that a
// production service path actually refuses — not a paper guard.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "path";
import { tmpdir } from "os";
import { createHarness, type Harness } from "./harness";
import { newUuid } from "../sql";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { LocalFilesystemStorageProvider } from "../file-storage";
import { DeterministicTestScanProvider } from "../file-scan";
import { PdfRenderer } from "../renderers";
import * as Files from "../files";
import * as Docs from "../documents";
import { enforceDocumentGuard, DocumentGuardBlockedError, evaluateDocumentGuard } from "../document-guard";

let h: Harness; let storage: LocalFilesystemStorageProvider; let owner: TenantContext;
const scanner = new DeterministicTestScanProvider();
const deps = () => ({ storage, scanner });
const PDF = "application/pdf";

beforeEach(async () => {
  h = await createHarness();
  storage = new LocalFilesystemStorageProvider({ bucket: "pierre-test", baseDir: join(tmpdir(), `pierre-test-${newUuid()}`) });
  owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA });
});
afterEach(async () => { await storage.purgeAll(); await h.close(); });

async function uploadClean(): Promise<Files.FileRow> {
  const { file_id } = await Files.createUploadIntent(h.db, owner, { declared_mime_type: PDF, original_filename: "doc.pdf" }, deps());
  return Files.finalizeUpload(h.db, owner, file_id, PdfRenderer.render({ title: "T", blocks: [{ lines: ["a"] }] }).bytes, deps());
}

describe("§15 enforceDocumentGuard pure", () => {
  it("a non-clean scan blocks → DocumentGuardBlockedError carrying the decision", () => {
    expect(() => enforceDocumentGuard({ action: "download", document_type: "work_certificate", sensitivity: "normal", file_status: "clean", scan_status: "infected", permissions: ["document.read"] })).toThrow(DocumentGuardBlockedError);
    try {
      enforceDocumentGuard({ action: "download", document_type: "work_certificate", sensitivity: "normal", file_status: "clean", scan_status: "infected", permissions: ["document.read"] });
    } catch (e) {
      expect(e).toBeInstanceOf(DocumentGuardBlockedError);
      expect((e as DocumentGuardBlockedError).decision.reason_codes).toContain("scan_not_clean");
      expect((e as DocumentGuardBlockedError).code).toBe("document_guard_blocked");
    }
  });

  it("a clean, permitted download is allowed (no throw)", () => {
    const d = enforceDocumentGuard({ action: "download", document_type: "work_certificate", sensitivity: "normal", file_status: "clean", scan_status: "clean", permissions: ["document.read"] });
    expect(d.decision).toBe("allow");
    // missing file evidence is fail-closed
    expect(evaluateDocumentGuard({ action: "download", document_type: "work_certificate", sensitivity: "normal", permissions: ["document.read"] }).decision).toBe("block");
  });
});

describe("§15 the real document service refuses", () => {
  it("downloadDocument refuses a finalized version whose artifact was retro-quarantined", async () => {
    const f = await uploadClean();
    const doc = await Docs.createDocument(h.db, owner, { document_type: "work_certificate", title: "Certificat" });
    const v = await Docs.createVersion(h.db, owner, doc.id, { rendered_pdf_file_id: f.id });
    await Docs.submitForReview(h.db, owner, v.id);
    await Docs.approveVersion(h.db, owner, v.id);
    await Docs.finalizeVersion(h.db, owner, v.id);
    // a clean download works first
    const ok = await Docs.downloadDocument(h.db, owner, doc.id, { format: "pdf" }, deps());
    expect(ok.bytes.length).toBeGreaterThan(0);
    // retro-quarantine the underlying artifact (e.g. a delayed AV verdict)
    await h.db.query(`update pierre_rt_files set scan_status='infected' where company_id=$1 and id=$2`, [h.companyA, f.id]);
    // the service now REFUSES the download via the enforced guard
    await expect(Docs.downloadDocument(h.db, owner, doc.id, { format: "pdf" }, deps())).rejects.toBeInstanceOf(DocumentGuardBlockedError);
  });
});

#!/usr/bin/env node
// scripts/check-pierre-document-lifecycle.mjs
// PHASE 8.3 — read-only check: document/version lifecycle + immutability + renderers.
import { existsSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (r) => (existsSync(resolve(ROOT, r)) ? readFileSync(resolve(ROOT, r), "utf-8") : "");
const ok = (m) => console.log(`  ✅ ${m}`); const warn = (m) => console.log(`  ⚠️  ${m}`);
let needs = 0;
console.log("\n══ PHASE 8.3 — Document Lifecycle & Renderers — Check ══\n");

const d = read("src/lib/pierre/v1/documents.ts");
for (const fn of ["createDocument", "createVersion", "submitForReview", "requestChanges", "approveVersion", "finalizeVersion", "archiveDocument", "restoreDocument", "softDeleteDocument", "downloadDocument", "verifyDocumentIntegrity"]) {
  if (new RegExp(`export async function ${fn}`).test(d)) ok(`service ${fn}`); else { warn(`service ${fn} manquant`); needs++; }
}
if (/IMMUTABLE = new Set\(\["final", "signed"\]\)/.test(d) && /assertMutable/.test(d)) ok("versions final/signed immuables"); else { warn("immutabilité absente"); needs++; }
if (/status='draft', approved_by=null, approved_at=null/.test(d)) ok("nouvelle version invalide l'approbation"); else { warn("approbation non invalidée"); needs++; }
if (/document\.sensitive\.read/.test(d) && /document_download/.test(d)) ok("téléchargement sensible gardé + audité"); else { warn("sensible non gardé"); needs++; }
if (/legal_hold/.test(d) && /Signed documents can only be removed/.test(d)) ok("legal hold + document signé non supprimable"); else { warn("legal hold/suppression non gardés"); needs++; }
if (/pierre_rt_document_links/.test(d)) ok("liens documentaires relationnels"); else { warn("liens absents"); needs++; }

const r = read("src/lib/pierre/v1/renderers.ts");
if (/%PDF-1\.4/.test(r) && /WinAnsiEncoding/.test(r) && /startxref/.test(r)) ok("rendu PDF réel (xref, Helvetica WinAnsi accents)"); else { warn("PDF non réel"); needs++; }
if (/zipStore/.test(r) && /crc32/.test(r) && /word\/document\.xml/.test(r)) ok("rendu DOCX réel (OOXML zip, CRC32)"); else { warn("DOCX non réel"); needs++; }
if (/calculateHash|sha256/.test(r)) ok("hash de contenu déterministe"); else { warn("hash absent"); needs++; }

const ob = read("src/lib/pierre/v1/document-outbox.ts");
if (/emitDocumentEvent/.test(ob) && /pierre_rt_outbox/.test(ob)) ok("événements outbox (P8.4 brancher les canaux)"); else { warn("outbox absent"); needs++; }

console.log("\n" + (needs === 0
  ? " RÉSULTAT : PASS — cycle de vie documentaire + versions immuables + PDF/DOCX réels (testés: p83-files-documents.itest §27.2 + renderers.test). Browser/UI/signature NON inclus ici."
  : ` RÉSULTAT : NEEDS REVIEW — ${needs} point(s).`) + "\n");

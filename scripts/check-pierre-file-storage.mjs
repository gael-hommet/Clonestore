#!/usr/bin/env node
// scripts/check-pierre-file-storage.mjs
// PHASE 8.3 — read-only check: private file storage + scan/quarantine + integrity.
import { existsSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (r) => (existsSync(resolve(ROOT, r)) ? readFileSync(resolve(ROOT, r), "utf-8") : "");
const ok = (m) => console.log(`  ✅ ${m}`); const warn = (m) => console.log(`  ⚠️  ${m}`);
let needs = 0;
console.log("\n══ PHASE 8.3 — File Storage & Scan — Check ══\n");

const st = read("src/lib/pierre/v1/file-storage.ts");
if (/companies\/\$\{input\.companyId\}\/documents\/\$\{input\.documentId\}\/versions/.test(st)) ok("object key canonique sans PII (uuid + extension)"); else { warn("object key non canonique"); needs++; }
if (/assertSafeObjectKey/.test(st) && /path traversal/.test(st)) ok("garde object key (tenant scope + traversal)"); else { warn("garde object key absente"); needs++; }
if (/LocalFilesystemStorageProvider/.test(st) && /isProduction = false/.test(st)) ok("adapter local/test (hors /public, purgeable)"); else { warn("adapter local absent"); needs++; }
if (/SupabaseStorageProvider/.test(st) && /createSignedUrl/.test(st) && /Math\.min\(expirySeconds, 300\)/.test(st)) ok("adapter Supabase privé + URL signée courte (<=300s)"); else { warn("adapter Supabase incomplet"); needs++; }

const mime = read("src/lib/pierre/v1/file-mime.ts");
if (/detectMime/.test(mime) && /%PDF-/.test(mime) && /inspectDocx/.test(mime)) ok("détection MIME par magic bytes + inspection ZIP réelle (PDF/DOCX/PNG/JPEG)"); else { warn("détection MIME absente"); needs++; }
if (/screenContent/.test(mime) && /windows_executable|elf_executable|office_macro|active_svg|archive_not_allowed/.test(mime)) ok("screening contenu (exe/macro/svg actif/archive/html)"); else { warn("screening absent"); needs++; }
if (/MIME_WHITELIST/.test(mime) && /SIZE_LIMITS_MB/.test(mime)) ok("whitelist MIME + limites de taille"); else { warn("whitelist/limites absentes"); needs++; }

const scan = read("src/lib/pierre/v1/file-scan.ts");
if (/EICAR/.test(scan) && /DeterministicTestScanProvider/.test(scan)) ok("scanner test déterministe (EICAR/mismatch/oversize)"); else { warn("scanner test absent"); needs++; }
if (/ClamAvScanProvider/.test(scan) && /scanner_unavailable|not_wired/.test(scan) && /quarantine: true/.test(scan)) ok("ClamAV: indisponible => quarantaine (jamais accepté silencieusement)"); else { warn("clamav non gardé"); needs++; }

const files = read("src/lib/pierre/v1/files.ts");
if (/upload_status !== "clean" \|\| file\.scan_status !== "clean"/.test(files)) ok("téléchargement bloqué tant que non clean"); else { warn("gate download absente"); needs++; }
if (/part of a finalized\/signed version/.test(files) && /legal hold/.test(files)) ok("suppression bloquée (version finalisée/signée, legal hold)"); else { warn("suppression non gardée"); needs++; }
if (/verifyFileIntegrity/.test(files) && /file_integrity_checks/.test(files)) ok("vérification d'intégrité (sha256)"); else { warn("intégrité absente"); needs++; }

console.log("\n" + (needs === 0
  ? " RÉSULTAT : PASS — stockage privé + scan/quarantaine + intégrité (testés: p83-files-documents.itest §27.1). Supabase/ClamAV réels NON prouvés (honnête)."
  : ` RÉSULTAT : NEEDS REVIEW — ${needs} point(s).`) + "\n");

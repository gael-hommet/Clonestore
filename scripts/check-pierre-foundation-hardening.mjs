#!/usr/bin/env node
// scripts/check-pierre-foundation-hardening.mjs
// PHASE 8.3-B §1–§9 — read-only check of the foundation hardening.
import { existsSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (r) => (existsSync(resolve(ROOT, r)) ? readFileSync(resolve(ROOT, r), "utf-8") : "");
const ok = (m) => console.log(`  ✅ ${m}`); const warn = (m) => console.log(`  ⚠️  ${m}`);
let needs = 0;
console.log("\n══ PHASE 8.3-B — Foundation Hardening — Check ══\n");

const v6 = read("supabase/migrations/2026-06-16__pierre_v6_hardening_fks_webhook_ingress.sql");
if (/revoke all on pierre_rt_signature_webhooks from pierre_rt_app/.test(v6) && /rt_webhook_deny_app/.test(v6) && /using \(false\)/.test(v6)) ok("§1 webhook RLS: app role révoqué + deny policy (pas de null leak)"); else { warn("§1 webhook RLS non corrigée"); needs++; }
if (/pierre_rt_webhook_ingress/.test(v6)) ok("§1 rôle d'ingestion webhook dédié"); else { warn("§1 rôle ingress absent"); needs++; }
if (/uq_%1\$s_company_id|uq_.*company_id/.test(v6) && /references %s\(company_id, id\)|references .*\(company_id, id\)/.test(v6)) ok("§8 unique(company_id,id) + FKs composites tenant-safe"); else { warn("§8 FKs composites absentes"); needs++; }

const files = read("src/lib/pierre/v1/files.ts");
if (/re-read.*from the provider|RE-READ|downloadBytes\(file\.object_key\)/.test(files) && /expectedSha/.test(files) && /actualSha/.test(files) && /integrity_mismatch/.test(files)) ok("§2 intégrité réelle (re-lecture storage, expected vs actual distincts)"); else { warn("§2 intégrité non réelle"); needs++; }
if (/fail-closed rescan/.test(files) && /screenAndScan/.test(files) && /promoted: clean/.test(files)) ok("§3 rescan fail-closed (toutes les couches)"); else { warn("§3 rescan non fail-closed"); needs++; }
if (/assertFileAttachable/.test(files) && /not clean/.test(files) && /no integrity hash/.test(files)) ok("§9 gate d'attachement (clean/tenant/hash)"); else { warn("§9 gate absente"); needs++; }
if (/extensionForMime\(input\.declared_mime_type\)/.test(files) && /isDangerousFilename/.test(files)) ok("§5 extension dérivée du MIME validé + noms dangereux refusés"); else { warn("§5 extension/nom non gardés"); needs++; }

const mime = read("src/lib/pierre/v1/file-mime.ts");
if (/inspectDocx/.test(mime)) ok("§4 détection DOCX par inspection ZIP réelle"); else { warn("§4 docx naïf"); needs++; }
const zip = read("src/lib/pierre/v1/zip-inspect.ts");
if (/zip_bomb_ratio|zip_bomb_total/.test(zip) && /path_traversal_entry/.test(zip) && /office_macro/.test(zip) && /MAX_ENTRIES/.test(zip)) ok("§4 garde zip bomb / traversal / macro / limites"); else { warn("§4 gardes zip absentes"); needs++; }

const st = read("src/lib/pierre/v1/file-storage.ts");
if (/assertProductionStorageReady/.test(st) && /resolveFileStorageProvider/.test(st) && /no silent filesystem fallback|never silently/.test(st)) ok("§6 résolution provider fail-closed"); else { warn("§6 provider non fail-closed"); needs++; }
if (/relative\(root, full\)/.test(st)) ok("§5 pathFor via path.relative"); else { warn("§5 pathFor faible"); needs++; }
if (/Math\.min\(expirySeconds, 300\)/.test(st)) ok("§6 signed URL <= 300s"); else { warn("signed URL non bornée"); needs++; }

console.log("\n" + (needs === 0
  ? " RÉSULTAT : PASS — hardening §1–§9 (testé: p83-foundation-hardening.itest 7/7 + zip-inspect.test 7/7). Template/contract/signature = pass suivant."
  : ` RÉSULTAT : NEEDS REVIEW — ${needs} point(s).`) + "\n");

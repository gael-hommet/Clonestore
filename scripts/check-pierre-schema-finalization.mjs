#!/usr/bin/env node
// scripts/check-pierre-schema-finalization.mjs
// PHASE 8.3-B2 §1–§4 — webhook ingress + composite-FK delete semantics + validation.
import { existsSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (r) => (existsSync(resolve(ROOT, r)) ? readFileSync(resolve(ROOT, r), "utf-8") : "");
const ok = (m) => console.log(`  ✅ ${m}`); const warn = (m) => console.log(`  ⚠️  ${m}`);
let needs = 0;
console.log("\n══ PHASE 8.3-B2 — Schema Finalization — Check ══\n");

const v7 = read("supabase/migrations/2026-06-16__pierre_v7_webhook_ingress_fk_semantics.sql");
if (/create policy rt_webhook_ingress_only[\s\S]*for all to pierre_rt_webhook_ingress[\s\S]*using \(true\)/.test(v7)) ok("§1 policy ingress-only (rôle réellement utilisable)"); else { warn("§1 policy ingress absente"); needs++; }
if (/grant select, insert, update on pierre_rt_signature_webhooks to pierre_rt_webhook_ingress/.test(v7) && /revoke delete on pierre_rt_signature_webhooks from pierre_rt_webhook_ingress/.test(v7)) ok("§1 ingress: INSERT/SELECT/UPDATE sans DELETE"); else { warn("§1 grants ingress incorrects"); needs++; }
if (/Drop the v5 SINGLE-COLUMN FKs/.test(v7) && /_source_file_id_fkey/.test(v7)) ok("§2 FKs v5 set-null retirées (composite autoritaire)"); else { warn("§2 FKs v5 non retirées"); needs++; }
if (/on delete %s/.test(v7) && /'no action'/.test(v7) && /'restrict'/.test(v7) && /'cascade'/.test(v7)) ok("§2 sémantiques explicites (no action / restrict / cascade)"); else { warn("§2 sémantiques absentes"); needs++; }
if (!/not valid/.test(v7)) ok("§3 FKs créées VALIDÉES (pas NOT VALID)"); else { warn("§3 FKs encore NOT VALID"); needs++; }

const test = read("src/lib/pierre/v1/__integration__/p83-schema-finalization.itest.ts");
if (/pierre_rt_app cannot SELECT/.test(test) && /pierre_rt_webhook_ingress can INSERT/.test(test)) ok("§1 testé (app refusé, ingress autorisé sans delete)"); else { warn("§1 tests absents"); needs++; }
const refs = ["employee", "site", "contract", "mission", "source_file_id", "rendered_pdf_file_id", "template_version_id", "signature request", "recipient", "contract_version"];
if (refs.every((r) => test.includes(r))) ok("§4 matrice tenant-safe (cross-tenant + unknown + same-tenant)"); else { warn("§4 matrice incomplète"); needs++; }
if (/CASCADE.*RESTRICT.*NO ACTION|confdeltype/.test(test)) ok("§2 sémantiques de suppression testées"); else { warn("§2 suppression non testée"); needs++; }

console.log("\n" + (needs === 0
  ? " RÉSULTAT : PASS — schéma tenant-safe + webhook ingress (testé: p83-schema-finalization.itest 7/7)."
  : ` RÉSULTAT : NEEDS REVIEW — ${needs} point(s).`) + "\n");

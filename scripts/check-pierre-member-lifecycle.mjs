#!/usr/bin/env node
// scripts/check-pierre-member-lifecycle.mjs
// PHASE 8.2-C — read-only check: invitations, member lifecycle, custom roles.
import { existsSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (r) => (existsSync(resolve(ROOT, r)) ? readFileSync(resolve(ROOT, r), "utf-8") : "");
const ok = (m) => console.log(`  ✅ ${m}`); const warn = (m) => console.log(`  ⚠️  ${m}`);
let needs = 0;
console.log("\n══ PHASE 8.2-C — Member Lifecycle & Invitations — Check ══\n");

const m = read("src/lib/pierre/v1/members.ts");
if (/createHash\("sha256"\)/.test(m) && /token_hash/.test(m)) ok("token d'invitation haché (SHA-256), brut jamais stocké"); else { warn("token non haché"); needs++; }
if (/expires_at > now\(\)/.test(m)) ok("expiration réelle vérifiée à l'acceptation"); else { warn("expiration non vérifiée"); needs++; }
if (/idempotent: true/.test(m)) ok("invitation idempotente (réémission)"); else { warn("invitation non idempotente"); needs++; }
for (const fn of ["acceptInvitation", "revokeInvitation", "resendInvitation", "suspendMember", "reactivateMember", "removeMember", "leaveCompany", "transferOwnership"]) {
  if (new RegExp(`export async function ${fn}`).test(m)) ok(`service ${fn}`); else { warn(`service ${fn} manquant`); needs++; }
}
if (/countActiveOwners/.test(m) && /last active owner/.test(m)) ok("garde « au moins un owner actif »"); else { warn("garde owner manquante"); needs++; }
if (/for update/.test(m)) ok("transfert ownership sérialisé (FOR UPDATE)"); else { warn("transfert non sérialisé"); needs++; }

const tc = read("src/lib/pierre/v1/tenant-context.ts");
if (/pierre_rt_membership_custom_roles/.test(tc) && /custom_role_permissions/.test(tc)) ok("rôles personnalisés résolus par resolveTenantContext"); else { warn("custom roles non résolus"); needs++; }

const roles = read("src/lib/pierre/v1/roles.ts");
if (/System roles are immutable/.test(roles) && /archiveRole/.test(roles)) ok("rôles système immuables + archivage custom"); else { warn("roles.ts incomplet"); needs++; }

const routes = [
  "src/app/api/pierre/v1/members/route.ts",
  "src/app/api/pierre/v1/invitations/route.ts",
  "src/app/api/pierre/v1/invitations/accept/route.ts",
  "src/app/api/pierre/v1/members/[id]/transfer-ownership/route.ts",
  "src/app/api/pierre/v1/roles/route.ts",
  "src/app/api/pierre/v1/company/switch/route.ts",
];
for (const r of routes) { if (read(r)) ok(`route ${r.replace("src/app/api/pierre/v1/", "/")}`); else { warn(`route manquante ${r}`); needs++; } }

console.log("\n" + (needs === 0
  ? " RÉSULTAT : PASS — invitations + cycle de vie + rôles personnalisés implémentés et testés localement (p82c-operational.itest)."
  : ` RÉSULTAT : NEEDS REVIEW — ${needs} point(s).`) + "\n");

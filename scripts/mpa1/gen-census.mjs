// MPA-1 — deterministic route + API census. No model, no network. Pure filesystem enumeration
// + static import inspection. Writes MPA1_ROUTE_CENSUS.json and MPA1_API_CENSUS.json.

import fs from "node:fs";
import path from "node:path";

const ROOT = "C:/Users/homme/clonestore";
const APP = path.join(ROOT, "src/app");

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name).replace(/\\/g, "/");
    if (e.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const rel = (p) => path.relative(ROOT, p).replace(/\\/g, "/");

// Convert an app-router file path to its URL route.
function routeOf(file) {
  let r = rel(file).replace(/^src\/app/, "").replace(/\/(page|route)\.tsx?$/, "");
  if (r === "") r = "/";
  return r || "/";
}

const all = walk(APP);

// ── Route census (page.tsx = a rendered surface) ──────────────────────────────
const pages = all.filter((f) => /\/page\.tsx$/.test(f));
const routes = pages.map((f) => {
  const src = fs.readFileSync(f, "utf8");
  const isClient = /^\s*["']use client["']/m.test(src);
  const authGated =
    /useRequireAuth|isAuthBypassEnabled|getSessionClient|auth\.getUser|useRequireAuth\(\)/.test(src);
  const dynamic = /\[[^\]]+\]/.test(rel(f));
  return {
    route: routeOf(f),
    file: rel(f),
    kind: isClient ? "client_component" : "server_component",
    dynamicSegment: dynamic,
    authGated,
    bytes: src.length,
  };
});

// ── API census (route.ts = an endpoint) ───────────────────────────────────────
const apiFiles = all.filter((f) => /\/route\.ts$/.test(f) && /\/api\//.test(f));
const apis = apiFiles.map((f) => {
  const src = fs.readFileSync(f, "utf8");
  const methods = ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS", "HEAD"].filter((m) =>
    new RegExp(`export\\s+(?:async\\s+)?function\\s+${m}\\b`).test(src),
  );
  const auth = /authenticateRequest|getUser\(|hasAnyActiveOrder|requireAuth|assertAuth|tryReadBearerToken/.test(src);
  const tenant = /company_id|companyId|tenant|user_id|userId/.test(src);
  const supabase = /createClient|supabase|SUPABASE/.test(src);
  const stripe = /stripe|STRIPE/i.test(src);
  const openai = /openai|OPENAI/i.test(src);
  const idempotency = /idempot|proposalId|dedupe|exactly.?once|SHA-?256|ledger/i.test(src);
  return {
    route: routeOf(f),
    file: rel(f),
    methods,
    hasAuthCheck: auth,
    tenantScoped: tenant,
    usesSupabase: supabase,
    usesStripe: stripe,
    usesOpenAI: openai,
    hasIdempotencySignal: idempotency,
  };
});

// group APIs by top-level segment for a readable summary
const byGroup = {};
for (const a of apis) {
  const g = a.route.split("/").slice(1, 3).join("/") || "root";
  byGroup[g] = (byGroup[g] || 0) + 1;
}

fs.writeFileSync(
  path.join(ROOT, ".mpa1-proofs/MPA1_ROUTE_CENSUS.json"),
  JSON.stringify(
    {
      method: "Deterministic filesystem enumeration of src/app/**/page.tsx + static import inspection. No model, no network.",
      totalRoutes: routes.length,
      authGatedRoutes: routes.filter((r) => r.authGated).length,
      dynamicRoutes: routes.filter((r) => r.dynamicSegment).length,
      routes: routes.sort((a, b) => a.route.localeCompare(b.route)),
    },
    null,
    2,
  ),
);

fs.writeFileSync(
  path.join(ROOT, ".mpa1-proofs/MPA1_API_CENSUS.json"),
  JSON.stringify(
    {
      method: "Deterministic filesystem enumeration of src/app/api/**/route.ts + static signal detection. No model, no network.",
      totalEndpoints: apis.length,
      withAuthCheck: apis.filter((a) => a.hasAuthCheck).length,
      tenantScoped: apis.filter((a) => a.tenantScoped).length,
      usingStripe: apis.filter((a) => a.usesStripe).length,
      usingOpenAI: apis.filter((a) => a.usesOpenAI).length,
      withIdempotencySignal: apis.filter((a) => a.hasIdempotencySignal).length,
      groupCounts: byGroup,
      endpoints: apis.sort((a, b) => a.route.localeCompare(b.route)),
    },
    null,
    2,
  ),
);

console.log("ROUTES:", routes.length, "| auth-gated:", routes.filter((r) => r.authGated).length);
console.log("APIS:", apis.length, "| auth:", apis.filter((a) => a.hasAuthCheck).length,
  "| tenant:", apis.filter((a) => a.tenantScoped).length,
  "| stripe:", apis.filter((a) => a.usesStripe).length,
  "| openai:", apis.filter((a) => a.usesOpenAI).length);

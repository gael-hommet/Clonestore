# E1 — Deployment Runbook

**Nature:** exact commands + verification for an **authorized operator**. E1 does **not** deploy and does **not** assume any host is configured. Machine copies: [deployment-local-readiness.json](.e1-proofs/external-enablement/deployment-local-readiness.json), [deployment-external-status.json](.e1-proofs/external-enablement/deployment-external-status.json).

## Production build contract (verified locally)
- **Runtime:** Next.js 15 (App Router), Node server runtime.
- **Build:** `npm run build` → exit 0 (verified in E1). `serverExternalPackages: ["@electric-sql/pglite","sharp"]` (sharp = mandatory CloneChat image transform).
- **Start:** `npm run start`.
- **Server/client boundary:** secrets are server‑only (env contract); `NEXT_PUBLIC_*` only for public values.
- **Middleware:** `src/middleware.ts` (auth/routing guard) — 80 kB, compiled.

## Pre‑deploy checklist (operator)
1. **Env validation before server readiness** — set every production‑required var (see [E1_ENVIRONMENT_CONTRACT_REPORT.md](E1_ENVIRONMENT_CONTRACT_REPORT.md)); a missing prod secret must fail closed, not silently default.
2. **Trusted origins / auth callback URLs** — set Supabase auth redirect URLs to `https://<domain>/…`.
3. **Cookie flags** — Secure + HttpOnly + SameSite on session cookies (Supabase SSR defaults).
4. **Rate limits / budgets** — `AI_COST_SHIELD_MODE=enforce`, caps set; upload/body limits (`FILE_MAX_UPLOAD_MB`).
5. **Kill switches wired** — confirm `CLONECHAT_ENABLED` (unset=active) and `AI_EMERGENCY_SHUTDOWN=false` are settable in the host env.
6. **Security headers / CSP** — configure at the host/edge (CSP, HSTS, X‑Frame‑Options); CloneChat needs `sharp` server‑side (already externalized).

## Health / readiness endpoint (wire at deploy — NOT added by E1)
The health/readiness **logic** exists at `src/lib/observability/health.ts` (`buildEnvHealthCheck`, `combineHealthChecks`, `checkRuntimeMode`). E1 deliberately did not add an HTTP route (P16C froze the app surface). Add this additive route at deploy time:

```ts
// src/app/api/health/route.ts  (additive — add during deployment prep)
import { NextResponse } from "next/server";
import { buildEnvHealthCheck, buildRuntimeModeCheck, combineHealthChecks } from "@/lib/observability/health";
export const dynamic = "force-dynamic";
export async function GET() {
  const checks = combineHealthChecks([
    buildRuntimeModeCheck(),
    buildEnvHealthCheck({ required: ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] }),
  ]);
  // NEVER include secret values — presence/status only.
  return NextResponse.json({ ok: checks.status !== "down", status: checks.status, checks: checks.checks }, { status: checks.status === "down" ? 503 : 200 });
}
```
The body must never include a secret value.

## Deploy (operator, authorized)
```bash
npm ci
npm run build          # must exit 0 (verified in E1)
# set all production env in the host secret manager (never committed)
npm run start          # or the host's managed runtime
```

## Post‑deploy smoke checklist
- `GET /api/health` → 200 (no secrets in body).
- `GET /` renders; `GET /assistant` renders the real CloneChat workspace.
- Anonymous `POST /api/assistant/chat` → **401 AUTH_REQUIRED** (must stay blocked).
- `POST /api/checkout` in test mode → session created; **no live payment**.
- Only after all external proofs + owner authorization: exercise a governed checkout.

## Rollback
- Re‑deploy the previous build (host's instant rollback).
- Emergency: `CLONECHAT_ENABLED=false` (CloneChat 503), `AI_EMERGENCY_SHUTDOWN=true` (all AI blocked), `CLONESTORE_PAYMENT_MODE=disabled` (payment off).

## Not claimed by E1
`deploymentPerformed=false`, `productionHealthVerified=false` — code can never prove a deploy occurred. Set `CLONESTORE_DEPLOY_PROOF` only after a real deploy + health pass. **Fix `git.exe` (OS‑blocked in this repo) before any production deployment** so version control is trustworthy.

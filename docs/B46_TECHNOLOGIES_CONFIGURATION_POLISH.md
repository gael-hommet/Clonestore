# B46 — Technologies Configuration Polish

## Overview

B46 adds a unified technology configuration layer on top of the existing B18 technology foundation. It introduces 6 visible CloneStore technologies with readiness scoring, runtime mode management, permission enforcement, and a dedicated UI page.

## What B46 adds

| Area | New in B46 |
|------|-----------|
| Core library | `technology-b46-types.ts`, `technology-b46-registry.ts`, `technology-readiness.ts`, `technology-runtime-modes.ts`, `technology-permissions.ts`, `technology-verdict.ts`, `technology-b46-fixtures.ts` |
| Pierre bridge | `pierre-technology-map.ts`, `pierre-technology-bridge.ts`, `pierre-technology-readiness.ts`, `pierre-technology-verdict.ts` |
| API routes | `GET /snapshot`, `POST /validate`, `POST /save`, `POST /reset` |
| UI | `/profile/technologies` — crème/ivory palette, glass cards, progress bars |
| Tests | 269 tests across 3 test files |

## The 6 visible technologies

| ID | Name | Launch-critical | Locked |
|----|------|-----------------|--------|
| `cloneos` | CloneOS | Yes | No |
| `cloneadn` | CloneADN | Yes | No |
| `cloneguard` | CloneGuard | Yes | **Yes** |
| `clonetrace` | CloneTrace | Yes | **Yes** |
| `clonevoice` | CloneVoice | No | No |
| `clonechat` | CloneChat | No | No |

## Locked technologies

CloneGuard and CloneTrace are **permanently locked** — they can never be disabled by any client action. The API enforces this with two defense layers:

1. `canEditTechnologyConfig()` returns `false` for locked techs at all access levels
2. The `/save` route has an explicit locked check that returns `TECHNOLOGY_LOCKED`

The `/reset` route always forces `cloneguard` and `clonetrace` to `"active"` regardless of reset state.

## Readiness scoring

Each technology has a readiness score (0–100) computed from bloc closure status:

- **CloneOS**: 85 base if B42 closed, scales down with missing blocs
- **CloneADN**: 80 base if B44 + empreinte_ready
- **CloneGuard**: 95 if B41 + B38 closed
- **CloneTrace**: 90 if B43 + B41 closed
- **CloneVoice**: 10 (always minimal — disabled by default)
- **CloneChat**: 30 (limited — dry_run by default)

A technology is "active" when its score ≥ 60 and `enabled=true`.

## Runtime modes

| Technology | Default mode | Notes |
|-----------|-------------|-------|
| CloneOS | Follows `AI_RUNTIME_MODE` | mock by default |
| CloneADN | `production` | DB reads always live |
| CloneGuard | `production` | Pure evaluation, always runs |
| CloneTrace | `production` | Always logging |
| CloneVoice | `disabled` | Enabled in B47+ |
| CloneChat | `dry_run` | Limited interface |

## Permission model

| Access level | Can view | Can edit | Editable techs |
|-------------|---------|---------|----------------|
| `anonymous` | No | No | — |
| `logged_unpaid` | Yes | No | — |
| `trial` | Yes | Yes | `cloneadn`, `clonevoice`, `clonechat` |
| `paid_customer` | Yes | Yes | `cloneadn`, `clonevoice`, `clonechat` |
| `internal_admin` | Yes | Yes | All non-locked |

## Absolute constraints

- CloneGuard and CloneTrace can **never** be disabled from any client action
- CloneVoice cannot be set to `production` runtime without `internal_admin`
- `user_id`, `company_id`, `organization_id`, `tenant_id`, `id` are always stripped from client request bodies
- Supabase is never required for tests — all computation is pure/in-memory
- B38–B45 are never broken by B46 changes

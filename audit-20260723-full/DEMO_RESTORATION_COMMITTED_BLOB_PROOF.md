# Demo Restoration — Committed Blob Proof

Un commit ciblé via isomorphic-git, allowlist exacte, secret-scan avant, blobs relus octet par
octet, Δ = allowlist exacte. Aucun amend, aucun push.

| OID | Message | Fichiers | Blobs | Δ exact |
|---|---|---:|---|---:|
| `79f2a3792d42baf602415e1c1ce5b6c14d805f92` | `test(demo): lock validated value-first order + restoration evidence (repo already value-first; live deploy stale)` | 14 | ✅ tous identiques | 14/14 |

## Contenu (allowlist)

- **Code (1)** : `src/components/demo/__tests__/demo-value-first-order.test.ts` (verrou anti-régression).
- **Docs (9)** : `EXACT_DEMO_RESTORATION_REPORT.md`, `DEMO_GIT_VISUAL_TIMELINE.md`,
  `DEMO_THREE_STATE_RECONCILIATION.md`, `DEMO_REGRESSION_ROOT_CAUSE.md`,
  `DEMO_EXACT_RESTORATION_ALLOWLIST.md`, `DEMO_ANALYTICS_PRESERVATION_MATRIX.md`,
  `DEMO_VISUAL_RESTORATION_COMPARISON.md`, `DEMO_RESTORATION_TEST_MATRIX.md`,
  `EXACT_DEMO_RESTORATION_VERDICT.md`.
- **Preuves (4)** : `00_BASELINE.md`, `build-precommit.txt`, et les 2 captures navigateur
  (desktop 1440, mobile 390).

## Ce qui n'a PAS été committé / touché

Aucun fichier de démo runtime (déjà value-first, non modifié) ; aucun `git add -A` ; aucune
homepage/hero/slogan/checkout/webhook/Partner/Pierre ; `tsconfig.json` (auto-modifié par
`next dev`) **rétabli** avant tout commit (jamais inclus). Concurrence Pierre intercalée
(`b588cc4a…`) : commit basé sur le HEAD réel courant, aucun reset/revert.

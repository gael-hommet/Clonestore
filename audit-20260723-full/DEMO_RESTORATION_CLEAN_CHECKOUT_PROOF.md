# Demo Restoration — Clean Checkout Proof

Matérialisation stricte depuis les blobs Git du HEAD final, dans un répertoire vierge hors dépôt.

| Étape | Résultat |
|---|---|
| HEAD matérialisé | `79f2a3792d42baf602415e1c1ce5b6c14d805f92` |
| Répertoire | `C:\Users\homme\clonestore-clean-exact-demo-restoration` (vierge) |
| Blobs écrits | **8245**, **0 mismatch** sha256, ~921 Mo |
| Fichiers critiques présents | `DemoExperience.tsx`, `acts/ValueShock.tsx`, `__tests__/demo-value-first-order.test.ts` ✅ |
| `node_modules` copié ? | Non | 
| `.env.local` copié ? | Non — reconstruit fictif (Stripe test fictif, Supabase/Postgres local, email `.invalid`, `PRODUCTION_AUTHORIZED=false`) |
| `npm ci --prefer-offline --no-audit` | **531 paquets, exit 0** |
| Tests démo (7 fichiers, dont le verrou anti-régression) | **85/85 verts** |
| `next build` | **`REAL_EXIT_CODE=0`** |
| `BUILD_ID` | **`vKRVaJQqRRM5sTiAVP2jR`** |
| Routes | `/demo` (60.3 kB), `/demo/pierre` (27 kB), `/api/analytics/events`, dashboard analytics — compilées |

## Conclusion

Le HEAD final `79f2a379…` est autonome : matérialisation stricte, `npm ci` propre, environnement
fictif, démo value-first + verrou anti-régression verts, build `REAL_EXIT_CODE=0`. Aucun secret,
aucun push, aucun déploiement, aucune migration distante. Le verrou anti-régression value-first
passe **aussi** depuis un checkout strict Git (pas seulement le worktree).

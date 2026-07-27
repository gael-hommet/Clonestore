# Analytics Runtime — Clean Checkout Proof (Correlation Re-Closure)

Matérialisation stricte depuis les blobs Git du HEAD final, dans un répertoire vierge hors dépôt.

## Découverte pendant le checkout propre — gap de reproductibilité PRÉ-EXISTANT

La première matérialisation (HEAD `9a2617d5`, avant le correctif démo) a **échoué au build** :
`next build` → `Module not found: './acts/ModesChapter'`, `REAL_EXIT_CODE=1`. Cause :
`src/components/demo/DemoExperience.tsx` (committé par le bloc RUNTIME WIRING, commit
`90932a0bc`) importe des fichiers de démo jamais committés (`ModesChapter`, `ValueShock`) et passe
des props que les versions committées de `Act6Pierre`/`DemoConversion` n'acceptaient pas. **Le
`REAL_EXIT_CODE=0` du bloc précédent était un faux positif** — le HEAD identique `e7845354`
présentait exactement le même défaut (blob DemoExperience identique, `ModesChapter`/`ValueShock`
absents de l'arbre). Gap PRÉ-EXISTANT, sans rapport avec l'analytics.

**Correctif** (ISSUE-44) : commit dédié `fix(reproducibility)` (`a998eba5…`) — clôture exacte de
38 fichiers de démo (`src/components/demo/**` + `src/lib/demo/**`), allowlist explicite (jamais
`git add -A`), 3 dépendances externes vérifiées déjà committées, 74/74 tests démo verts, blobs
vérifiés. Les 4 commits analytics + les 5 commits du bloc précédent restent intacts (aucun amend).

## Matérialisation finale (preuve retenue)

- **HEAD** : `a998eba58dc3aaee7d074afaae8049b721fc9519`.
- **Répertoire** : `C:\Users\homme\clonestore-clean-analytics-runtime-reclosure` (vierge).
- **Blobs écrits** : 8213, **0 mismatch sha256**, ~920 Mo.
- `node_modules` **non copié** ; `.env.local` **non copié** (reconstruit fictif : Stripe test
  fictif, Supabase/Postgres local, email `.invalid`, Make vide, `PRODUCTION_AUTHORIZED=false`).
- `npm ci --prefer-offline --no-audit` : **531 paquets, exit 0**.
- `next build` : **`REAL_EXIT_CODE=0`**, **`BUILD_ID=3h1SjcpydSSbOReQKoWKh`**.
- Routes compilées confirmées : `/api/analytics/events`, `/internal/[slug]/command-center/analytics`,
  `/api/checkout`, `/api/checkout/confirm`, `/api/webhooks/stripe`, `/demo`, `/reserver/pierre`,
  `/activate/pierre`, `/partenaires` — aucune route manquante.
- `tsc --noEmit` : voir ci-dessous (résidu pré-existant isolé uniquement).

## `tsc --noEmit` (résidu honnête)

Après le correctif démo, le seul résidu attendu est `embedded-postgres` (déjà classé
`UNRELATED_PREEXISTING` par le bloc Clean Head Reproducibility), sans rapport avec l'analytics ni
la démo. Voir le fichier de résultat pour la valeur exacte.

## Conclusion

Le HEAD final `a998eba5…` est réellement autonome : matérialisation stricte, `npm ci` propre,
environnement fictif, build `REAL_EXIT_CODE=0`. Aucun secret, aucun push, aucun déploiement,
aucune migration distante.

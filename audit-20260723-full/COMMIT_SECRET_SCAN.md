# Commit Secret Scan — Validated Worktree Preservation and Commit Closure

Scan exécuté sur les **161 fichiers candidats au commit** (les seuls que ce bloc envisage de
committer — voir `WORKTREE_FULL_STATUS_MATRIX.md` pour la classification complète des ~1940
fichiers modifiés/ajoutés du dépôt) : 10 P0_GOVERNANCE + 12 PAYMENT_PATH + 7 LEGAL_TRUST + 17
DEMO_MOBILE + 114 AUDIT_DOCUMENTATION + 1 GITIGNORE_FIX.

## Motifs recherchés

`sk_live_*`, `sk_test_*`, `pk_live_*`, `whsec_*`, valeurs `service_role`, tokens JWT complets
(forme `eyJ...eyJ...` à 3 segments), tokens GitHub (`ghp_*`, `github_pat_*`), clés AWS
(`AKIA*`), clés privées PEM, URLs de webhook Make/Zapier concrètes. Les **noms** de variables
d'environnement (`MAKE_EMAIL_WEBHOOK_URL`, `STRIPE_PRICE_PIERRE_CHF_MONTHLY`, etc.) ne sont pas
recherchés — seules les **valeurs** réelles le sont, conformément au prompt maître.

Fichiers de plus de 2 Mo signalés séparément sans être lus intégralement (aucun trouvé parmi
les 161 candidats).

## Résultat

**0 correspondance sur les 161 fichiers scannés.**

Aucun fichier suspect, aucune valeur de secret réelle, aucun fichier surdimensionné. Tous les
161 fichiers candidats sont autorisés au commit du point de vue de ce scan.

## Fichiers explicitement exclus de tout commit (rappel, non scannés car non candidats)

`.env`, `.env.local`, `.env.p87-runtime.local`, `.env.p87-webhooks.local`, `.env.example`,
`node_modules/**`, `.next/**`, `.next-*/**` (dont les 5 répertoires `.next-p10/p11/p12/p13/p96`
**déjà committés dans un HEAD historique bien antérieur à ce bloc** — non retirés, hors
périmètre, voir `VALIDATED_WORKTREE_REMAINING_RISKS.md`), `.claude/**`, tous les fichiers
`UNRELATED_PREEXISTING`/`LOCAL_ENVIRONMENT`/`TEMPORARY` listés dans
`WORKTREE_FULL_STATUS_MATRIX.md`.

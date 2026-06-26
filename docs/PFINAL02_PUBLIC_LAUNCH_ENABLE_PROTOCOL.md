# P-FINAL 02 — Protocole d'activation du lancement public

**Ce protocole doit être suivi à la lettre. Aucun raccourci autorisé.**

---

## Condition unique pour activer le lancement public

`buildGoLiveVerdictFromProofs(proofs).status === "go"`

Cette condition est programmatiquement vérifiable et ne peut être contournée.

---

## Séquence d'activation

### T-24h
1. Tous les proof IDs required_for_public_launch sont à `status: "verified"` dans `go-live-proofs.local.json`
2. `npm run test:pfinal02` → 0 erreur
3. `npm test` → 0 erreur
4. `npm run build` → clean
5. `buildGoLiveVerdictFromProofs().status === "go"`

### T-0 (activation)
1. Déployer la version production finale
2. Setter `B48_PUBLIC_LAUNCH_ENABLED=true` dans les variables d'env production
3. Setter `CLONESTORE_PUBLIC_LAUNCH_APPROVED=true`
4. Vérifier l'application live (homepage, demo, checkout, legal)
5. Surveiller les métriques pendant 2h

### Post-activation
- Surveiller les webhooks Stripe
- Surveiller les erreurs RLS
- Surveiller le taux d'erreur 5xx

---

## Ce qui NE DOIT PAS arriver

- Passer les flags à true avant que `verdict.status === "go"`
- Lancer sans avoir testé le paiement complet
- Lancer sans les pages légales validées
- Lancer sans le RLS production vérifié

---

*P-FINAL 02 — Protocole d'activation lancement public*

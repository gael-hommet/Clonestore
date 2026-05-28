# B48 — Go-Live Runbook

Checklist opérationnelle pour le lancement public de CloneStore/Pierre.

---

## Phase 1 — Préparation juridique (J-30)

- [ ] Mandater un conseil juridique (avocat en droit du travail + droit numérique)
- [ ] Faire relire B47_FINAL_LEGAL_REVIEW_CHECKLIST.md
- [ ] Rédiger CGU (Conditions Générales d'Utilisation)
- [ ] Rédiger CGV (Conditions Générales de Vente — 449€/mois, annulation, remboursement)
- [ ] Compléter politique de confidentialité (RGPD, DPO, sous-traitants, durées rétention)
- [ ] Préparer template DPA pour clients B2B
- [ ] Valider les mentions légales
- [ ] Créer les pages `/legal/cgu`, `/legal/cgv` dans Next.js

## Phase 2 — Infrastructure production (J-14)

- [ ] Créer projet Supabase production (distinct du dev/staging)
- [ ] Appliquer toutes les migrations SQL
- [ ] Activer et tester RLS sur chaque table
- [ ] Configurer SUPABASE_SERVICE_ROLE_KEY en variable serveur uniquement
- [ ] Créer compte Stripe production
- [ ] Créer produit et prix récurrent 449€/mois (live)
- [ ] Enregistrer webhook Stripe production → `/api/stripe/return`
- [ ] Configurer STRIPE_SECRET_KEY=sk_live_*, STRIPE_WEBHOOK_SECRET=whsec_live_*
- [ ] Configurer Resend avec domaine vérifié
- [ ] Configurer le domaine de production + SSL
- [ ] Définir NEXT_PUBLIC_APP_URL en production

## Phase 3 — Sécurité (J-7)

- [ ] Audit des endpoints API publics
- [ ] Test d'accès non authentifié sur toutes les routes sensibles
- [ ] Vérifier headers sécurité (CSP, HSTS, X-Frame-Options)
- [ ] Configurer monitoring (Sentry ou équivalent)
- [ ] Activer alertes sur erreurs 5xx et downtime
- [ ] Configurer backups Supabase automatiques
- [ ] Test de bout en bout : inscription → paiement → activation → Pierre

## Phase 4 — Validation technique (J-3)

- [ ] `npm run tsc` — 0 erreurs
- [ ] `npm test` — tous les tests passent
- [ ] `npm run build` — build clean
- [ ] `GET /api/clonestore/launch-readiness?[tous_flags=true]` → `public_launch_ready`
- [ ] `GET /api/pierre/launch-readiness?legal_review_done=true` → `pierre_launch_ready`
- [ ] Test du flux paiement complet en mode Stripe live
- [ ] Vérification visuelle de toutes les pages légales

## Phase 5 — Lancement (J-0)

- [ ] Définir `CLONESTORE_PUBLIC_LAUNCH_APPROVED=true`
- [ ] Définir `PIERRE_LEGAL_GUARDRAILS_ENABLED=true`
- [ ] Définir `PIERRE_OUTPUT_VALIDATION_ENABLED=true`
- [ ] Définir `PIERRE_DEMO_MODE=false` en production
- [ ] Déployer sur Vercel / plateforme de production
- [ ] Vérifier que le domaine répond en HTTPS
- [ ] Envoyer le premier email de lancement (via Resend, avec approbation)
- [ ] Monitorer les logs les 24 premières heures

---

## Variables d'environnement requises au lancement

```env
# Supabase (production)
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciO...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciO...  # SERVEUR UNIQUEMENT

# Stripe (LIVE)
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PRICE_ID=price_live_...

# Email
RESEND_API_KEY=re_live_...

# App
NEXT_PUBLIC_APP_URL=https://clonestore.fr

# Pierre
PIERRE_LEGAL_GUARDRAILS_ENABLED=true
PIERRE_MONTHLY_PRICE_EUR=449
PIERRE_DEMO_MODE=false
PIERRE_OUTPUT_VALIDATION_ENABLED=true

# B48
CLONESTORE_LAUNCH_READINESS_ENABLED=true
CLONESTORE_PUBLIC_LAUNCH_APPROVED=true  # SEULEMENT après validation complète
```

---

## Rollback

Si un problème critique est détecté dans les 24h suivant le lancement :
1. Définir `CLONESTORE_PUBLIC_LAUNCH_APPROVED=false`
2. Redéployer la version précédente
3. Investiguer via `/api/clonestore/launch-readiness` et les logs

---

## Contacts d'urgence

- Problème paiement → Stripe dashboard + STRIPE_WEBHOOK_SECRET à vérifier
- Problème auth → Supabase dashboard Auth
- Problème légal → Conseil juridique mandaté en Phase 1
- Problème technique → Pierre ne garantit pas la conformité — revue humaine systématique

# P-FINAL 02 — Checklist Finale Gaël

**Ultra-concrète. Pas à pas. Aucune ambiguïté.**

---

## Avant de commencer

Vérifier que le code est prêt :
```bash
npx tsc --noEmit    # → 0 erreur
npm test            # → 7000+ tests passing
npm run build       # → build propre
```

Si ces 3 commandes passent → continuer.

---

## ÉTAPE 1 — Informations société dans les mentions légales

**Durée estimée : 15 min**

1. Ouvrir [src/app/legal/mentions/page.tsx](src/app/legal/mentions/page.tsx)
2. Chercher tous les `[...]` et les remplacer avec les vraies données
3. Données à remplir :
   - Raison sociale et forme juridique (ex: CloneStore SAS)
   - Capital social (ex: 1 000 €)
   - SIREN/SIRET
   - Numéro de TVA intracommunautaire
   - Adresse du siège social
   - Nom du directeur de publication (toi)
   - Hébergeur : Vercel Inc., 340 Pine Street, Suite 1501, San Francisco, CA 94104
   - Contact RGPD : email de contact
4. Vérifier sur `/legal/mentions` → aucun placeholder visible
5. Proof IDs à valider : `LEGAL_MENTIONS_VALIDATED`, `LEGAL_ENTITY_INFO_COMPLETED`

---

## ÉTAPE 2 — Envoyer le packet juridique au juriste

**Durée estimée : 1h (rédaction) + 1-3 semaines (attente juriste)**

1. Lire [docs/PFINAL02_LEGAL_REVIEW_PACKET.md](docs/PFINAL02_LEGAL_REVIEW_PACKET.md)
2. Utiliser le template : [docs/PFINAL02_LEGAL_REVIEW_EMAIL_TEMPLATE.md](docs/PFINAL02_LEGAL_REVIEW_EMAIL_TEMPLATE.md)
3. Envoyer au juriste les URLs des pages légales + les docs B47
4. Attendre email de validation pour CGU, CGV, DPA, Politique de confidentialité
5. Proof IDs à valider : `LEGAL_CGU_VALIDATED`, `LEGAL_CGV_VALIDATED`, `LEGAL_DPA_VALIDATED`, `LEGAL_PRIVACY_VALIDATED`, `LEGAL_HUMAN_REVIEW_COMPLETED`

---

## ÉTAPE 3 — Appliquer RLS sur staging Supabase

**Durée estimée : 1h**

1. Lancer le guide : `npm run check:supabase-rls`
2. Ouvrir Dashboard Supabase STAGING → SQL Editor
3. Coller et exécuter [docs/sql/PFINAL01_RLS_PRODUCTION_PACK.sql](docs/sql/PFINAL01_RLS_PRODUCTION_PACK.sql)
4. Vérifier : `SELECT COUNT(*) FROM pg_policies WHERE schemaname='public'` → 23+
5. Screenshot et enregistrer dans `go-live-evidence/supabase/`
6. Proof IDs à valider : `SUPABASE_RLS_STAGING_APPLIED`

---

## ÉTAPE 4 — Tester l'isolation cross-company sur staging

**Durée estimée : 30 min**

1. Créer User A (company A) et User B (company B) sur staging
2. Connecté en User A : `SELECT * FROM employees` → 0 rows de company B
3. Connecté en User B : `SELECT * FROM employees` → 0 rows de company A
4. Avec clé anon : `SELECT * FROM employees` → 0 rows
5. Documenter le résultat dans `go-live-evidence/supabase/cross-company-test-staging.txt`
6. Proof IDs à valider : `SUPABASE_RLS_STAGING_VERIFIED`

---

## ÉTAPE 5 — Appliquer RLS sur production Supabase

**Durée estimée : 30 min (après staging validé)**

⚠️ **Faire le backup production avant d'appliquer.**

1. Dashboard Supabase PRODUCTION → Settings → Database → Backups
2. Créer un backup point-in-time
3. SQL Editor → `BEGIN;`
4. Coller le contenu de `docs/sql/PFINAL01_RLS_PRODUCTION_PACK.sql`
5. Vérifier le count des politiques → `COMMIT;`
6. Screenshot post-application
7. Proof IDs à valider : `SUPABASE_RLS_PRODUCTION_APPLIED`

---

## ÉTAPE 6 — Vérifier isolation RLS en production

**Durée estimée : 20 min**

1. Test avec clé anon : `SELECT * FROM employees` → 0 rows
2. Test User A / User B production (si 2 comptes test dispo) → 0 rows cross-company
3. Proof IDs à valider : `SUPABASE_RLS_PRODUCTION_VERIFIED`, `SUPABASE_USER_A_CANNOT_READ_USER_B`, `SUPABASE_SERVICE_ROLE_ROUTES_VERIFIED`

---

## ÉTAPE 7 — Créer le produit Stripe live 449€/an

**Durée estimée : 30 min**

1. Lancer : `npm run check:stripe-live`
2. Dashboard Stripe → Mode Live (toggle en haut)
3. Products → Add product
   - Nom : Pierre — Assistant RH Annual
   - Prix : 449,00 € / EUR / Annuel / Recurring
4. Copier le Price ID (price_...)
5. Setter `STRIPE_PIERRE_ANNUAL_PRICE_ID=price_...` en production
6. Proof IDs à valider : `STRIPE_LIVE_PRICE_PIERRE_449_CREATED`

---

## ÉTAPE 8 — Configurer le webhook Stripe

**Durée estimée : 20 min**

1. Dashboard Stripe → Developers → Webhooks → Add endpoint
2. URL : `https://[votre-domaine]/api/stripe/webhook`
3. Events : `checkout.session.completed`, `customer.subscription.*`, `invoice.*`
4. Copier le Signing secret (whsec_...)
5. Setter `STRIPE_WEBHOOK_SECRET=whsec_...` en production
6. Proof IDs à valider : `STRIPE_LIVE_WEBHOOK_CONFIGURED`

---

## ÉTAPE 9 — Configurer les clés Stripe live

**Durée estimée : 15 min**

1. Dashboard Stripe → Developers → API keys → Reveal live key
2. Copier `sk_live_...` et `pk_live_...`
3. Setter en production :
   - `STRIPE_SECRET_KEY=sk_live_...`
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...`
4. Proof IDs à valider : `STRIPE_LIVE_SECRET_SET`

---

## ÉTAPE 10 — Tester le flux de paiement complet

**Durée estimée : 1h**

1. Lancer : `npm run check:paid-customer`
2. Créer compte test production
3. Aller sur `/checkout?agent=pierre` → screenshot (449€)
4. Payer avec vraie carte (rembourser immédiatement après)
5. Vérifier success page, order en DB, webhook delivery
6. Vérifier accès `/agents/pierre/use`
7. Proof IDs à valider : `STRIPE_LIVE_CHECKOUT_TESTED`, `STRIPE_LIVE_PAYMENT_SUCCESS_TESTED`, `PAID_CUSTOMER_PRODUCTION_E2E_VERIFIED`, `PIERRE_ACCESS_AFTER_PAYMENT_VERIFIED`

---

## ÉTAPE 11 — Vérifier la démo publique

**Durée estimée : 15 min**

1. Lancer : `npm run test:pfinal01-demo`
2. Ouvrir `/demo/pierre` sans être connecté
3. Vérifier bannière orange "DÉMO — Données fictives"
4. Inspecter réseau → aucun appel API externe
5. Proof IDs à valider : `DEMO_PUBLIC_SAFE_VERIFIED`, `DEMO_NO_REAL_AI_VERIFIED`, `DEMO_NO_REAL_EMAIL_VERIFIED`, `DEMO_NO_REAL_ACTION_VERIFIED`

---

## ÉTAPE 12 — Scanner le copy public

**Durée estimée : 15 min**

1. Lancer : `npm run check:go-live`
2. Vérifier résultat : aucune violation bloquante
3. Vérifier manuellement homepage/pricing/demo : aucune claim interdite
4. Vérifier liens légaux sur `/checkout`
5. Proof IDs à valider : `PUBLIC_COPY_SCAN_CLEAN`, `PUBLIC_SITE_NO_FORBIDDEN_CLAIMS`, `CHECKOUT_LEGAL_LINKS_PRESENT`

---

## ÉTAPE 13 — Remplir go-live-proofs.local.json

**Durée estimée : 30 min**

1. Créer le fichier `go-live-proofs.local.json` à la racine
2. Utiliser le format décrit dans [docs/PFINAL02_GO_LIVE_MANUAL_PROOFS.md](docs/PFINAL02_GO_LIVE_MANUAL_PROOFS.md)
3. Remplir chaque proof ID avec `status: "verified"` + `evidence_ref` réel
4. Ne pas laisser de `evidence_ref` vide pour les preuves `verified`
5. Vérifier que `go-live-proofs.local.json` est dans `.gitignore`

---

## ÉTAPE 14 — Lancer la validation complète

```bash
npm run check:go-live        # Copy scan
npm run test:pfinal02        # Tests P-FINAL 02
npm run test:pfinal01        # Tests P-FINAL 01
npm run test:b48             # Tests B48
npm test                     # Suite complète
npm run build                # Build production
```

Tout doit passer. 0 erreur.

---

## ÉTAPE 15 — Vérifier le verdict programmatique

```typescript
import { buildGoLiveVerdictFromProofs } from "./src/lib/go-live/go-live-verdict";
import { parseGoLiveProofFile } from "./src/lib/go-live/proofs/proof-file";
import * as fs from "fs";

const raw = JSON.parse(fs.readFileSync("go-live-proofs.local.json", "utf-8"));
const { file } = parseGoLiveProofFile(raw);
const verdict = buildGoLiveVerdictFromProofs(file?.proofs ?? []);

console.log("Status:", verdict.status);
// Doit retourner "go" pour continuer
```

**Si `verdict.status !== "go"` → NE PAS CONTINUER.**

---

## ÉTAPE 16 — Passer le flag uniquement si verdict "go"

```bash
# Uniquement si verdict.status === "go" ET toutes les preuves vérifiées

# Dans les variables d'environnement production :
B48_PUBLIC_LAUNCH_ENABLED=true
CLONESTORE_PUBLIC_LAUNCH_APPROVED=true
```

⚠️ **Ce sont les DERNIERS flags à toucher. Ne pas les passer avant l'étape 15.**

---

## ÉTAPE 17 — Lancement 🚀

1. Déployer la version production finale
2. Vérifier le runbook : [docs/PFINAL01_PUBLIC_LAUNCH_RUNBOOK.md](docs/PFINAL01_PUBLIC_LAUNCH_RUNBOOK.md)
3. Surveiller les métriques pendant 2h
4. Félicitations — Pierre est en production publique.

---

*P-FINAL 02 — Checklist finale de lancement — Ne pas modifier sans revue*

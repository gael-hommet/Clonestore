# P-FINAL 02 — Go-Live Manual Proofs

**Phase: P-FINAL 02 — Go-Live Manual Proofs & Production Activation Gate**
**État: En attente des preuves humaines réelles**

---

## Vue d'ensemble

P-FINAL 02 fournit le système de gestion des preuves manuelles requis avant le lancement public de Pierre.

Ce système ne peut pas être contourné. Le verdict programmatique `buildGoLiveVerdictFromProofs()` retourne `"no_go"` tant que les preuves ne sont pas collectées et enregistrées.

---

## Proof IDs — Catégories

### LEGAL (7 preuves — 7 bloquantes pour lancement public)

| Proof ID | Requis lancement | Requis pilot |
|----------|-----------------|--------------|
| LEGAL_CGU_VALIDATED | ✅ | ❌ |
| LEGAL_CGV_VALIDATED | ✅ | ❌ |
| LEGAL_DPA_VALIDATED | ✅ | ❌ |
| LEGAL_PRIVACY_VALIDATED | ✅ | ❌ |
| LEGAL_MENTIONS_VALIDATED | ✅ | ✅ |
| LEGAL_ENTITY_INFO_COMPLETED | ✅ | ✅ |
| LEGAL_HUMAN_REVIEW_COMPLETED | ✅ | ❌ |

### SUPABASE (6 preuves — toutes bloquantes)

| Proof ID | Requis lancement | Requis pilot |
|----------|-----------------|--------------|
| SUPABASE_RLS_STAGING_APPLIED | ✅ | ✅ |
| SUPABASE_RLS_STAGING_VERIFIED | ✅ | ✅ |
| SUPABASE_RLS_PRODUCTION_APPLIED | ✅ | ❌ |
| SUPABASE_RLS_PRODUCTION_VERIFIED | ✅ | ❌ |
| SUPABASE_USER_A_CANNOT_READ_USER_B | ✅ | ❌ |
| SUPABASE_SERVICE_ROLE_ROUTES_VERIFIED | ✅ | ❌ |

### STRIPE (7 preuves — 5 bloquantes)

| Proof ID | Requis lancement | Requis pilot |
|----------|-----------------|--------------|
| STRIPE_LIVE_SECRET_SET | ✅ | ❌ |
| STRIPE_LIVE_PRICE_PIERRE_449_CREATED | ✅ | ❌ |
| STRIPE_LIVE_WEBHOOK_CONFIGURED | ✅ | ❌ |
| STRIPE_LIVE_CHECKOUT_TESTED | ✅ | ❌ |
| STRIPE_LIVE_PAYMENT_SUCCESS_TESTED | ✅ | ❌ |
| STRIPE_LIVE_PAYMENT_FAILURE_TESTED | ❌ | ❌ |
| STRIPE_LIVE_SUBSCRIPTION_CANCEL_TESTED | ❌ | ❌ |

### EMAIL (4 preuves — 1 bloquante)

| Proof ID | Requis lancement | Requis pilot |
|----------|-----------------|--------------|
| EMAIL_DOMAIN_VERIFIED | ❌ | ❌ |
| EMAIL_FROM_ADDRESS_VERIFIED | ❌ | ❌ |
| EMAIL_SANDBOX_SEND_TESTED | ❌ | ❌ |
| EMAIL_SENSITIVE_SEND_BLOCKED_VERIFIED | ✅ | ✅ |

### DEMO (4 preuves — toutes bloquantes pour lancement et pilot)

| Proof ID | Requis lancement | Requis pilot |
|----------|-----------------|--------------|
| DEMO_PUBLIC_SAFE_VERIFIED | ✅ | ✅ |
| DEMO_NO_REAL_AI_VERIFIED | ✅ | ✅ |
| DEMO_NO_REAL_EMAIL_VERIFIED | ✅ | ✅ |
| DEMO_NO_REAL_ACTION_VERIFIED | ✅ | ✅ |

### PAID CUSTOMER (3 preuves — 2 bloquantes)

| Proof ID | Requis lancement | Requis pilot |
|----------|-----------------|--------------|
| PAID_CUSTOMER_PRODUCTION_E2E_VERIFIED | ✅ | ❌ |
| PIERRE_ACCESS_AFTER_PAYMENT_VERIFIED | ✅ | ❌ |
| PIERRE_BLOCK_AFTER_CANCEL_VERIFIED | ❌ | ❌ |

### COPY (3 preuves — toutes bloquantes)

| Proof ID | Requis lancement | Requis pilot |
|----------|-----------------|--------------|
| PUBLIC_COPY_SCAN_CLEAN | ✅ | ✅ |
| PUBLIC_SITE_NO_FORBIDDEN_CLAIMS | ✅ | ✅ |
| CHECKOUT_LEGAL_LINKS_PRESENT | ✅ | ❌ |

### BUILD (2 preuves — toutes bloquantes)

| Proof ID | Requis lancement | Requis pilot |
|----------|-----------------|--------------|
| FINAL_BUILD_CLEAN | ✅ | ✅ |
| FINAL_TESTS_CLEAN | ✅ | ✅ |

---

## Format du fichier de preuves

Créer `go-live-proofs.local.json` à la racine du projet (jamais commis).

```json
{
  "generated_at": "2026-05-29T12:00:00.000Z",
  "environment": "production",
  "verified_by": "Gael Hommet",
  "proofs": [
    {
      "proof_id": "LEGAL_CGU_VALIDATED",
      "status": "verified",
      "verified_at": "2026-05-29T14:30:00.000Z",
      "verified_by": "Gael Hommet",
      "evidence_type": "document",
      "evidence_ref": "go-live-evidence/legal/cgu-validation-email.pdf",
      "notes": "Email de validation de Me Dupont en date du 29/05/2026"
    }
  ]
}
```

---

## Fichiers à ajouter dans .gitignore

```
go-live-proofs.local.json
go-live-evidence/
*.proof.local.json
```

---

## Scripts de vérification

| Script | Commande | Objectif |
|--------|----------|---------|
| Scan copy | `npm run check:go-live` | Détecter violations de copy |
| Vérif Stripe | `npm run check:stripe-live` | Vérifier config Stripe |
| Guide RLS | `npm run check:supabase-rls` | Guide RLS Supabase |
| Paid customer | `npm run check:paid-customer` | Checklist paid customer |
| Tests P-FINAL 02 | `npm run test:pfinal02` | Tests automatisés |

---

## Verdict programmatique

```typescript
import { buildGoLiveVerdictFromProofs } from "@/lib/go-live/go-live-verdict";
import { parseGoLiveProofFile } from "@/lib/go-live/proofs/proof-file";

// Lire et parser le fichier de preuves
const proofFile = JSON.parse(fs.readFileSync("go-live-proofs.local.json", "utf-8"));
const { file } = parseGoLiveProofFile(proofFile);

// Calculer le verdict
const verdict = buildGoLiveVerdictFromProofs(file?.proofs ?? []);

console.log(verdict.status); // "go" seulement si toutes les preuves sont vérifiées
console.log(verdict.missing_for_public_launch); // liste des proof IDs manquants
```

---

*P-FINAL 02 — Manuel des preuves de lancement public*

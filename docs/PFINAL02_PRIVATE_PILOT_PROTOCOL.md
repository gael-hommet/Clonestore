# P-FINAL 02 — Protocole pilote privé

**Le pilote privé est possible avec un subset de preuves.**

---

## Preuves requises pour le pilote privé

| Proof ID | Catégorie |
|----------|-----------|
| LEGAL_MENTIONS_VALIDATED | legal |
| LEGAL_ENTITY_INFO_COMPLETED | legal |
| SUPABASE_RLS_STAGING_APPLIED | supabase |
| SUPABASE_RLS_STAGING_VERIFIED | supabase |
| EMAIL_SENSITIVE_SEND_BLOCKED_VERIFIED | email |
| DEMO_PUBLIC_SAFE_VERIFIED | demo |
| DEMO_NO_REAL_AI_VERIFIED | demo |
| DEMO_NO_REAL_EMAIL_VERIFIED | demo |
| DEMO_NO_REAL_ACTION_VERIFIED | demo |
| PUBLIC_COPY_SCAN_CLEAN | copy |
| PUBLIC_SITE_NO_FORBIDDEN_CLAIMS | copy |
| FINAL_BUILD_CLEAN | build |
| FINAL_TESTS_CLEAN | build |

---

## Ce qui n'est PAS requis pour le pilote privé

- Validation juridique des CGU/CGV par un avocat (mais en cours)
- RLS production (staging suffisant en phase pilote)
- Stripe live (test keys OK en pilote)
- Paiement réel testé (simulation OK en pilote)
- Pages légales validées par juriste (draft OK en pilote)

---

## Conditions du pilote privé

1. **Clients triés :** Uniquement des early adopters en connaissance de cause
2. **Communication claire :** Indiquer que le service est en version pilote
3. **Données réelles limitées :** Préférer les données de test en phase pilote
4. **Pas de marketing public :** Aucune campagne, aucune annonce publique
5. **Legal en cours :** Informer les pilots que les CGU sont en cours de validation

---

## Verdict programmatique pilote privé

```typescript
import { isPrivatePilotReady } from "@/lib/go-live/go-live-verdict";

const pilotReady = isPrivatePilotReady(proofs);
// true si toutes les preuves required_for_private_pilot sont verified
```

---

*P-FINAL 02 — Protocole pilote privé*

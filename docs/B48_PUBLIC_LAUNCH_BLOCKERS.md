# B48 — Public Launch Blockers

**5 actions manuelles bloquantes** doivent être résolues avant le lancement public.

---

## Blockers critiques (bloquant lancement public)

### 1. CGU/CGV manquantes
- **Où :** `/legal/cgu` et `/legal/cgv` — pages inexistantes
- **Impact :** Lancement illégal sans CGU/CGV publiées
- **Action :** Rédiger avec conseil juridique. Créer les pages Next.js.
- **Surface :** `legal`

### 2. Politique de confidentialité à valider
- **Où :** `/legal/confidentialite` — existe mais incomplète
- **Impact :** Non-conformité RGPD
- **Action :** Compléter avec DPO, sous-traitants, durées de rétention. Valider juridiquement.
- **Surface :** `rgpd`

### 3. Revue juridique humaine non effectuée
- **Où :** B47 guardrails, claims commerciales, limitations responsabilité
- **Impact :** B47 est une base technique — pas un avis juridique
- **Action :** Faire relire B47_FINAL_LEGAL_REVIEW_CHECKLIST.md par un juriste/avocat.
- **Surface :** `legal`

### 4. RLS Supabase non vérifié en production
- **Où :** Toutes les tables Supabase contenant des données utilisateur
- **Impact :** Risque de cross-tenant data leak
- **Action :** Activer RLS. Tester avec utilisateur non-admin. Documenter les politiques.
- **Surface :** `security`

### 5. Stripe production non configuré
- **Où :** Variables d'environnement — clés test en place
- **Impact :** Aucun paiement réel possible
- **Action :** Remplacer `sk_test_*` par `sk_live_*`. Enregistrer webhook production. Créer prix live 449€/mois.
- **Surface :** `billing`

---

## Blockers non-critiques (recommandés avant lancement)

| Blocker | Surface | Priorité |
|---------|---------|----------|
| DPA/accord sous-traitance à préparer | rgpd | Recommandé |
| Domaine et DNS à configurer | operations | Recommandé |
| SMTP/Resend production à configurer | email | Recommandé |
| Audit sécurité initial | security | Recommandé |

---

## Processus de résolution

Pour chaque blocker résolu, passer le flag correspondant à `true` dans l'appel à `/api/clonestore/launch-readiness`:

```
GET /api/clonestore/launch-readiness?cgu_cgu_validated=true&legal_review_done=true&rls_production_verified=true&stripe_production_configured=true&privacy_policy_validated=true
```

Quand tous les flags bloquants sont `true`, le verdict passe à `public_launch_ready`.

**IMPORTANT :** Ne pas passer ces flags à `true` sans avoir effectivement résolu les actions correspondantes.

---

## État au 2026-05-28

```
Verdict: technical_ready_public_blocked
Blocs complétés: 15/15 (B33–B47)
Tests validés: 6909+
Blockers restants: 5 critiques
Score: ~50/100
```

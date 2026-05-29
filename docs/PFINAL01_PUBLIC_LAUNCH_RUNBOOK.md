# P-FINAL 01 — Runbook de lancement public

**Phase: 9 — Public Launch Closure**
**Audience: Responsable technique + fondateur**
**À exécuter le jour J uniquement — dans l'ordre**

---

## Pré-requis : Tous les items du GO-LIVE CHECKLIST cochés

Ne pas démarrer ce runbook si un seul item bloquant est non-coché.

Vérification programmatique :
```typescript
import { buildFinalGoLiveVerdict, getAllBlockingProofIds } from "@/lib/launch-readiness/final-go-live-verdict";

const verdict = buildFinalGoLiveVerdict({
  b48_flags: { /* tous les flags réels */ },
  verified_proof_ids: getAllBlockingProofIds(),
});

if (verdict.status !== "go") {
  throw new Error(`NOT READY: ${verdict.status}. Blockers: ${verdict.blockers.join(", ")}`);
}

console.log("✅ GO — Lancement autorisé");
```

**Arrêter si `verdict.status !== "go"`.**

---

## T-24h — Préparation

### Actions
- [ ] Backup complet de la base production effectué
- [ ] Backup des variables d'environnement actuel noté
- [ ] Équipe notifiée de la date/heure de lancement
- [ ] Canal de support (email/chat) testé et prêt
- [ ] Monitoring activé et alertes configurées
- [ ] Page de maintenance prête (en cas de besoin d'urgence)

### Vérifications techniques
- [ ] `npm run type-check` — 0 erreurs TypeScript
- [ ] `npm run test` — tous les tests passent
- [ ] `npm run build` — build réussi
- [ ] Application déployée en staging et fonctionnelle

---

## T-2h — Vérifications finales

### Stripe
- [ ] Dashboard Stripe → mode Live → `Payments` visible
- [ ] Webhook endpoint actif et testé
- [ ] Prix Pierre 449€ visible dans `Products`

### Supabase  
- [ ] Dashboard Supabase → `Authentication → Policies` → RLS actif sur 10 tables
- [ ] Test de connexion avec compte de test réussi

### Legal
- [ ] Pages légales accessibles: `/legal/cgu`, `/legal/cgv`, `/legal/dpa`, `/legal/mentions`, `/legal/confidentialite`
- [ ] Bannière "BROUILLON" retirée (si pages validées par juriste)
- [ ] Aucun placeholder `[...]` visible sur `/legal/mentions`

### Copie publique
```typescript
import { scanMultiplePages } from "@/lib/production-readiness/public-copy/copy-scanner";

const result = scanMultiplePages([
  { content: homepageContent, context: "homepage" },
  { content: pricingContent, context: "pricing" },
  { content: demoContent, context: "demo" },
]);

if (!result.all_safe) {
  throw new Error(`Copy violations: ${result.unsafe_contexts.join(", ")}`);
}
```

---

## T-0 — Procédure de lancement

### Ordre d'opération

**Étape 1 — Activer les flags en base (si applicable)**
```typescript
// UNIQUEMENT si les flags sont stockés en base:
// Ne passer ces flags à true QUE si toutes les preuves sont réelles
// B48_PUBLIC_LAUNCH_ENABLED = true  ← DERNIER FLAG, seulement quand tout est prêt
```

**Étape 2 — Déployer la version production**
```bash
# Exemple avec Vercel:
vercel --prod

# Ou via CI/CD:
git tag v1.0.0-launch
git push origin v1.0.0-launch
```

**Étape 3 — Vérification post-déploiement (5 premières minutes)**

| Vérification | URL | Attendu |
|-------------|-----|---------|
| Homepage | `/` | Chargement < 3s |
| Demo Pierre | `/demo/pierre` | Bannière démo visible |
| CGU | `/legal/cgu` | Page affichée, pas d'erreur |
| Pricing | `/pricing` | Prix 449€ affiché |
| Health check | `/api/health` | `{ status: "ok" }` |

**Étape 4 — Test de paiement de confirmation**
```
1. Ouvrir un onglet privé
2. Créer un compte → aller sur /checkout
3. Vérifier que le montant est 449€
4. NE PAS finaliser le paiement (arrêter avant la carte)
   OU utiliser une carte de test Stripe si en mode test encore
```

**Étape 5 — Vérifier les logs**
```bash
# Chercher des erreurs dans les logs de déploiement
# Aucune erreur 5xx dans les 5 premières minutes
# Aucune erreur TypeScript/runtime dans les logs
```

---

## Post-lancement — T+1h

### Monitoring actif

| Métrique | Objectif | Alerte si |
|----------|----------|-----------|
| Uptime | 100% | < 99.9% |
| Temps de réponse | < 2s | > 5s |
| Taux d'erreur 5xx | 0% | > 1% |
| Erreurs RLS 403 | < 5/min | > 10/min |
| Webhook Stripe delivery | 100% | < 95% |

### Actions post-lancement
- [ ] Notifier l'équipe du succès du lancement
- [ ] Partager le lien de production avec les premiers testeurs
- [ ] Surveiller les métriques pendant 2h
- [ ] Vérifier que le premier paiement (si applicable) est traité correctement

---

## Plan de rollback d'urgence

Si un problème critique est détecté dans les 2 premières heures :

### Rollback applicatif
```bash
# Revenir au déploiement précédent
vercel rollback [deployment-url]

# Ou via git:
git revert HEAD
git push origin main
```

### Rollback RLS (si problème de sécurité)
```sql
-- DANGER: Désactiver RLS temporairement si bloquant des opérations légitimes
-- Uniquement en dernier recours, correction à appliquer dans l'heure
ALTER TABLE [table_problematique] DISABLE ROW LEVEL SECURITY;
-- Investiguer et réappliquer dès que possible
```

### Communication en cas de rollback
1. Notifier l'équipe immédiatement
2. Poster un message de maintenance si nécessaire
3. Ne pas communiquer publiquement avant d'avoir un diagnostic

---

## Critères d'annulation avant lancement

**ARRÊTER le lancement si :**
- `buildFinalGoLiveVerdict()` ne retourne pas `status: "go"`
- Un item bloquant du GO-LIVE CHECKLIST n'est pas coché
- La build échoue (`npm run build`)
- Des erreurs TypeScript existent (`npm run type-check`)
- Des tests échouent (`npm run test`)
- Le test de paiement démo échoue
- Les pages légales affichent des placeholders non-remplis

---

## Contacts d'urgence

À compléter avant le jour J :

| Rôle | Contact | Disponible |
|------|---------|------------|
| Responsable technique | [À compléter] | Oui — T-0 |
| Fondateur | [À compléter] | Oui — T-0 |
| Support Stripe | +1-888-926-2289 | 24/7 |
| Support Supabase | support@supabase.io | Jours ouvrés |

---

## Log de lancement

| Heure | Action | Statut | Responsable |
|-------|--------|--------|-------------|
| | Pré-requis vérifiés | | |
| | RLS production confirmé | | |
| | Stripe live confirmé | | |
| | Build déployé | | |
| | Vérifications post-déploiement | | |
| | Équipe notifiée | | |

---

*P-FINAL 01 — Phase 9 — Runbook de lancement public Pierre*
*Ce document est le point d'entrée unique pour le go-live. Ne pas s'en écarter.*

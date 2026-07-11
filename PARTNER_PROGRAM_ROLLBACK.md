# Cabinets Fondateurs — Rollback

Aucune donnée financière n'est jamais supprimée. Le rollback **désactive** ; il n'efface pas.

## 1. Arrêt d'urgence (aucun redéploiement de code nécessaire)

Les trois interrupteurs sont des variables d'environnement Vercel, lues à l'exécution.
Après modification, redéployer (ou re-promouvoir) pour qu'elles prennent effet.

| Objectif | Variable | Valeur |
|---|---|---|
| Geler les versements (garder tout le reste) | `PARTNER_PAYOUTS_ENABLED` | `false` |
| Forcer la simulation, jamais de transfert | `PARTNER_PAYOUT_DRY_RUN` | `true` |
| Interdire tout transfert Live | `PARTNER_PAYOUT_LIVE_AUTHORIZED` | `false` |
| Fermer le programme entier (candidatures, attribution, commissions) | `PARTNER_PROGRAM_ENABLED` | `false` |

`PARTNER_PROGRAM_ENABLED=false` coupe le pont Stripe : les événements continuent d'arriver,
mais aucune commission n'est enregistrée. Les webhooks ne sont **pas** cassés — le webhook
canonique répond toujours 200 à Stripe, donc Stripe ne rejoue pas en boucle.

## 2. Rollback applicatif (Vercel)

Re-promouvoir le déploiement précédent :

```
vercel rollback <URL_DU_DÉPLOIEMENT_PRÉCÉDENT> --token $VERCEL_TOKEN
```

Le déploiement précédent de `clonestore-xcwi` reste disponible dans l'historique Vercel.

## 3. Ce qui est PRÉSERVÉ dans tous les cas

- Les ledgers (`clonestore_pp_commission_entries`, `clonestore_pp_commission_events`) sont
  **append-only** : un trigger refuse toute suppression et toute mutation d'un montant.
- Les commissions `disponible` restent disponibles : elles seront versées au cycle suivant.
- Les attributions verrouillées restent verrouillées.
- Les migrations `_04` / `_05` sont **additives** : aucun rollback de schéma n'est requis.
  Les revenir en arrière n'apporterait rien et détruirait des colonnes utilisées.

## 4. Reprise des événements sans double traitement

`clonestore_pp_stripe_events` porte un index unique sur `stripe_event_id`. Rejouer un
événement Stripe (manuellement depuis le dashboard, ou par un renvoi de Stripe) est
**sans effet** : il est reconnu comme doublon et ignoré. Aucune seconde commission.

## 5. Lots en `reconciliation_required`

Un lot dont l'issue Stripe est inconnue reste verrouillé : ses commissions ne peuvent pas
partir dans un second transfert. Au prochain run, le système **interroge Stripe avant toute
recréation** (`findTransfer`) :

- le transfert existait → il est adopté, les commissions passent `paid` ;
- il n'existait pas → il est réémis avec la **même** clé d'idempotence.

Ne jamais « débloquer » un tel lot à la main dans la base : le run suivant s'en charge, et
une intervention manuelle est le seul moyen de créer un double versement.

## 6. Ce qu'il ne faut JAMAIS faire

- Modifier un montant en base pour « corriger » : le trigger le refuse, et c'est voulu.
  Toute correction passe par une écriture compensatoire (reversal).
- Supprimer une ligne de `clonestore_pp_transfers` en `reconciliation_required`.
- Passer `PARTNER_PAYOUT_LIVE_AUTHORIZED=true` sans avoir lu un rapport de dry-run.

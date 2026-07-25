# Analytics Partner Attribution Wiring Report

Module : `src/lib/analytics/adapters/partner-attribution-resolver.ts`. **Lecture seule**, ne
réimplémente AUCUNE logique d'attribution.

## Source

Lit `clonestore_pp_customers` (jointe à `clonestore_pp_partners`) — table écrite EXCLUSIVEMENT par
`lockAttributionOnFirstPayment` **après** la validation complète du Partner Program
(anti-auto-parrainage, anti-fraude, verrouillage). Lire `partner_id` de cette table = réutiliser
un résultat déjà validé, pas le recalculer.

```sql
select c.partner_id
  from clonestore_pp_customers c
  join clonestore_pp_partners p on p.id = c.partner_id
 where c.subject_user_id = $1
   and c.status in ('active','past_due')
   and p.status = 'active'
 order by c.started_at desc limit 1
```

## Gates (hérités + explicites)

- **Attribution révoquée/supersédée** → jamais de ligne customer → null.
- **Auto-parrainage / token invalide** → jamais verrouillé → jamais de ligne → null.
- **Attribution expirée** → jamais verrouillée après expiration → null.
- **Partenaire suspendu** → filtré explicitement (`p.status = 'active'`) → null.
- `subject_user_id` DOIT être un UUID serveur (metadata abonnement Stripe), jamais client.

## Sortie

Identifiant **interne borné** : `pp_` + `sha256(partner_id).slice(0,16)`. Jamais l'UUID Partner
brut, jamais un nom de cabinet, jamais une donnée personnelle. Aucun calcul de commission, aucune
modification de payout, aucune écriture Partner.

## Best-effort

Toute erreur/indisponibilité → `null` (aucune attribution plutôt qu'une attribution douteuse),
jamais un throw jusqu'au webhook.

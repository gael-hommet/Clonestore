# Analytics Correlated Synthetic End-to-End Proof

Test : `src/lib/analytics/__tests__/correlated-funnel-e2e.test.ts` — PGlite réel, environnement
100 % fictif, aucun réseau/Stripe/webhook/email réel.

**Supersède** `ANALYTICS_SYNTHETIC_END_TO_END_PROOF.md** : la première preuve montrait la présence
et l'idempotence des événements ; celle-ci prouve leur **corrélation** sous un même parcours
visiteur, y compris pour les vérités serveur émises **sans cookie**.

## Mécanisme

Une table de liaison `clonestore_analytics_conversion_links_v1` (append/upsert, keyée par
`(reservation_id, environment)`, indexée par `order_ref`) mémorise le `visitor_id`/`session_id`
d'origine au moment où le cookie signé est disponible (réservation, checkout), puis permet aux
étapes serveur sans cookie (email confirmé, activation, webhook paiement) de les retrouver par
`reservation_id` ou `order_ref` (abonnement haché). Aucune PII, références Stripe hachées.

## Parcours prouvé (1 visiteur)

home → demo (run) → pierre (run) → CTA réservation → formulaire soumis → **réservation serveur
liée au visiteur** → **email confirmé corrélé (sans cookie)** → **checkout lié (session Stripe
hachée + user)** → **activation corrélée (webhook, sans cookie)** → **paiement corrélé (résolu par
order_ref, sans cookie)**.

## Assertions vertes

| Assertion | Résultat |
|---|---|
| `reservation_created.visitor_id` = visiteur démo | ✅ |
| `reservation_email_confirmed` corrélé au visiteur d'origine (pas le navigateur qui ouvre le lien) | ✅ |
| `checkout_session_created.visitor_id` = visiteur démo | ✅ |
| `activation_completed.visitor_id` corrélé (webhook, sans cookie) | ✅ |
| `payment_succeeded` = même visiteur que la démo (résolu par `order_ref`) | ✅ |
| Toutes les étapes majeures récupérables sous le même `visitor_id` — cohorte de 1 | ✅ |
| Aucun double paiement / double checkout / double activation | ✅ |
| Attribution Partner correcte (`pp_corr_partner`), aucune PII (`@` absent) | ✅ |
| `countFunnelStages` reconstruit la cohorte de 1 visiteur de la démo au paiement | ✅ |

## Ce que ce test ne fait plus

Il n'utilise plus `totalEvents` comme substitut à la corrélation : chaque assertion vérifie le
`visitor_id` réel de chaque vérité serveur, prouvant l'appartenance au même parcours.

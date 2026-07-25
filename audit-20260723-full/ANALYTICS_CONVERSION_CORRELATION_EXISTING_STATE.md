# Analytics Conversion Correlation — Existing State (Phase A)

Inspection des mécanismes de corrélation déjà présents, avant toute migration.

| Mécanisme | Nature | Signé/serveur | Durable | PII | Forgeable client | Dispo étapes aval | Verdict de réutilisation |
|---|---|---|---|---|---|---|---|
| `cs_visitor_id` (canonique) | Cookie HMAC first-party, UUID v4 | Oui (serveur) | 90j | Non | Non (signé) | Oui (présent tant que le cookie vit) | **RÉUTILISÉ** comme `visitor_id` d'origine (lecture seule via `readVisitorId`) |
| `cs_session_id` (canonique) | Cookie HMAC first-party | Oui | 30 min glissant | Non | Non | Oui (dans la même session) | **RÉUTILISÉ** comme `session_id` (lecture seule via `readSessionId`) |
| `cs_analytics_session` (founder-access) | Cookie HMAC, 30j | Oui | 30j | Non | Non | Oui | Non réutilisé pour le sink canonique (identité d'un autre système ; on ne mélange pas les espaces d'identité) |
| `cs_conversion_session` (BLOC3) | Cookie HMAC, 7j | Oui | 7j | Non | Non | Oui mais BLOC3 inerte en prod | Non réutilisé |
| `cs_anon_sid` | sessionStorage client | Non (client) | Session | Non | **Oui** (généré client, ignoré serveur) | — | **Rejeté** (forgeable, jamais fait foi) |
| `founder_reservation_id` (metadata Stripe) | Produit **serveur** au checkout, mis en metadata | Oui | Persistant (session/abonnement Stripe) | Non | Non (le client ne choisit pas la réservation liée sans y avoir droit) | Oui (webhook) | **Clé de corrélation serveur** entre checkout/webhook et réservation |
| `reservation_id` (`clonestore_founder_reservations.id`) | UUID persisté serveur | Oui | Durable | Non | Non | Oui | **Clé primaire de corrélation** |
| `subscription_id` / `order` (webhook + ledger) | Produit par Stripe, vérité serveur | Oui | Durable | Non | Non | Oui | **Clé secondaire** (hachée) pour retrouver la corrélation depuis un événement facture sans cookie |
| `stripe checkout session id` | Produit par `stripe.checkout.sessions.create` | Oui | Durable | Non | Non | Oui | Référence (hachée) `checkout_session_ref` |
| `partner_attribution_id` | Résolu par le runtime Partner (lecture seule) | Oui | Durable | Non | Non | Oui | Déjà branché, conservé |

## Conclusion

Aucune structure existante ne relie **durablement** `visitor_id`/`session_id` à
`reservation_id`/`checkout_session`/`order` de façon interrogeable par le webhook (qui n'a pas de
cookie). Les cookies canoniques donnent le visiteur/session à la requête (réservation, checkout),
mais le webhook n'a que la metadata Stripe (`founder_reservation_id`, `subscription_id`). Il faut
donc **une petite table de liaison append/upsert** keyée par `reservation_id` et indexée par
`order_ref` (subscription hachée), qui mémorise le visiteur/session d'origine au moment où le
cookie est disponible (réservation/checkout) et permet au webhook de les retrouver ensuite.

→ Décision : migration additive locale `clonestore_analytics_conversion_links_v1` (Phase C).

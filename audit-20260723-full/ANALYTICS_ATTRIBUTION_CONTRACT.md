# Analytics Attribution Contract

Implémenté par `src/lib/analytics/attribution.ts`, 15 tests verts.

## Dimensions autorisées

`direct` · `organic_search` · `referral` · `social_organic` · `email` · `partner` ·
`paid_campaign` (réservé, aucune campagne payante active aujourd'hui) · `internal` · `unknown`.

## UTM — allowlist stricte

`utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`. Valeurs bornées à 64
caractères, charset `[a-zA-Z0-9_.-]` uniquement (testé : « rejects values containing characters
outside the bounded charset »), toute autre clé de query string supprimée par défaut.

## First-touch / last-touch

Fenêtre d'attribution : **30 jours**, documentée comme valeur conservatrice par défaut (aucune
décision préexistante trouvée dans le code lu — pas présentée comme définitive). Règle testée explicitement : un touch `direct` n'écrase jamais un touch non-direct valide et au
moins aussi récent (« a direct touch does not overwrite a valid prior non-direct last-touch »),
mais il devient le last-touch légitime s'il est réellement le plus récent événement dans la
fenêtre.

## Partner — jamais recalculé ici

`resolveAttributionChannel` accepte un `partnerAttributionId` **déjà résolu et validé** par
`src/lib/partner-program/server/attribution.ts` (non modifié, non relu en profondeur dans ce
bloc) — ce module d'attribution analytics ne lit, ne parse et ne fait confiance à aucun cookie
Partner Program lui-même. Preuve structurelle testée : la fonction n'a qu'un seul paramètre
(l'objet d'entrée déjà résolu), aucune voie pour lui faire accepter un `partner_id` brut du
client. Le champ `partnerAttributionId` de l'enveloppe serveur (`schema.ts`) n'existe que côté
`AnalyticsServerEnrichedEvent`, jamais dans l'enveloppe client acceptée par l'endpoint
d'ingestion — un client ne peut donc structurellement pas le fournir.

## Non câblé dans ce bloc

La résolution réelle (appel à la fonction d'attribution Partner Program existante depuis la
route d'ingestion analytics) n'est pas branchée — `partnerAttributionId` vaut toujours `null`
dans l'enveloppe enrichie produite par `route.ts` aujourd'hui. Documenté dans
`ANALYTICS_LEGACY_MIGRATION_MATRIX.md` comme un câblage différé, pas oublié : le contrat est prêt
à recevoir la valeur dès qu'un futur bloc branche cet appel en lecture seule.

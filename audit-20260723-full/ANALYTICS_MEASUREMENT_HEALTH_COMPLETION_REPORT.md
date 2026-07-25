# Analytics Measurement Health Completion Report

Ce bloc branche les vraies vérités du funnel ; la santé de mesure reste calculable depuis la
table canonique (toutes les colonnes nécessaires existent). État réel :

| Métrique | Statut | Détail |
|---|---|---|
| Événements acceptés | ✅ implémenté | `measurementHealthSnapshot` (bloc précédent), affiché au dashboard |
| Répartition par niveau de confiance | ✅ implémenté | idem — le funnel synthétique montre les 5 niveaux réels (CLIENT_OBSERVED → PAYMENT_PROVIDER_CONFIRMED) |
| Événements rejetés / schéma invalide | Partiel | comptés au niveau HTTP 422 par l'endpoint, pas encore agrégés dans une table de suivi dédiée |
| Doublons évités | Prouvé (test), pas encore surfacé | `on conflict do nothing` renvoie `outcome:"duplicate"` — mesurable, non encore affiché comme compteur temps réel |
| Erreurs stockage | Observable (logs) | `getAnalyticsDbForIngestion` journalise un nom d'erreur seul |
| Événements sans session / page views sans visitor / demo steps sans demo run | Calculable | colonnes `session_id`/`visitor_id`/`page_view_id`/`demo_run_id` présentes ; requête directe possible |
| Conversions serveur sans attribution | Calculable | `partner_attribution_id is null and event_name='payment_succeeded'` |
| Checkout sans paiement / paiement sans checkout canonique | Calculable | jointure `checkout_session_created` ↔ `payment_succeeded` par fenêtre |
| Délai moyen received_at - occurred_at | Calculable | les deux colonnes existent |
| Version de schéma | ✅ | toujours 1 |

## Honnêteté

Aucun compteur n'est fabriqué. Les métriques marquées « calculable/partiel » disposent de toutes
les colonnes nécessaires en base mais n'ont pas de vue de santé temps-réel dédiée construite dans
ce bloc — la priorité de ce bloc était le **branchement des vérités**, pas l'exhaustivité du
tableau de santé. Le funnel synthétique complet (`ANALYTICS_SYNTHETIC_END_TO_END_PROOF.md`)
démontre que les données sous-jacentes sont présentes et correctes. Les refus restent agrégés
sans payload ni PII.

## Mise à jour 2026-07-25 (CORRELATION RE-CLOSURE) — statut retenu : `PARTIALLY_COMPLETE`

Le bloc de re-fermeture n'a **pas** ajouté toutes les vues de santé manquantes. La corrélation
ajoutée rend désormais réellement **calculables et significatives** plusieurs métriques qui ne
l'étaient pas (`conversions serveur sans attribution`, `checkout sans paiement`, `paiement sans
checkout canonique`, `événements sans session`) car `visitor_id`/`session_id`/`partner_
attribution_id` et la table de liaison existent maintenant. Mais le verdict **ne déclare pas la
santé « complète »** : ces vues ne sont pas encore surfacées au dashboard. Statut honnête :
**santé de mesure partiellement complète** — les données existent, plusieurs graphiques restent à
construire dans un bloc ultérieur (non bloquant pour la corrélation ni la non-blocabilité).

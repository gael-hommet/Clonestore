# Analytics Remaining Risks

| Risque | Sévérité | Détail |
|---|---|---|
| Aucun trafic réel n'a encore traversé le nouveau système | Attendu | 0 événement canonique produit en dehors des tests — le tracker est monté et actif, mais aucune donnée de production n'existe encore au moment de la fermeture de ce bloc |
| Adaptateur founder-access non câblé | Moyen | `bridgeFounderServerEvent` est construit, testé, prêt — mais non appelé depuis `founder-access/store.ts` ; tant qu'il n'est pas branché, le dashboard canonique restera vide même si founder-access continue de fonctionner normalement en parallèle |
| Démo/Pierre non re-instrumentés | Moyen | Triple instrumentation (Systèmes A/B/C) toujours active telle quelle ; le tracker canonique ne reçoit aucun événement `demo_*`/`pierre_demo_*` réel tant que `DemoExperience.tsx`/`DemoEventTracker.tsx` ne sont pas migrés |
| GuidedTour toujours sans télémétrie | Faible | Lacune préexistante documentée, événements canoniques prêts mais non câblés |
| Webhook Stripe non branché | Moyen-élevé si différé trop longtemps | `payment_succeeded`/`activation_completed` réels ne remonteront jamais au dashboard tant que ce câblage n'est pas fait — fichier protégé, nécessite un bloc dédié avec sa propre suite de non-régression Payment Path complète |
| Dérive CRLF potentielle sur les nouveaux fichiers | Faible | Aucun `.gitattributes` dans le dépôt (déjà noté dans le bloc Partner Program) — les nouveaux fichiers analytics pourraient un jour subir la même dérive cosmétique ; sans impact fonctionnel documenté |
| Durée de rétention production non validée | Attendu (décision propriétaire) | `OWNER_APPROVAL_REQUIRED`, fonction de purge existe mais n'est appelée par aucun cron |
| Filtres dashboard non implémentés | Faible | v1 livre le funnel global + santé de mesure uniquement, pas de segmentation interactive |
| Cohortes non matérialisées | Faible | Colonnes prêtes en base, aucune requête de cohorte construite |
| Couverture sécurité partielle (3 scénarios `⚠️`) | Faible | Prototype pollution, brute-force dédié, accès dashboard non-owner authentifié — voir `ANALYTICS_SECURITY_TEST_MATRIX.md` |
| Aucun test E2E navigateur réel du tracker | Faible-moyen | La garantie "une seule vue par navigation" repose sur la lecture de code + tests unitaires, pas sur un test Playwright réel contre un vrai navigateur |
| 0/30 testeurs externes réels | Attendu | Protocole écrit, jamais exécuté — le bloc suivant en dépend explicitement |

Aucun de ces risques ne concerne une perte de données, une fuite de PII, ou une régression d'un
système déjà en production — tous concernent des extensions **non encore activées**, documentées
comme telles plutôt que fabriquées.

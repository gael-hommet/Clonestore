# Analytics Existing Systems Matrix

Cartographie exhaustive (Phase 1), produite par lecture directe de code (2 agents de recherche
en parallèle, orientation Graphify préalable) — 2026-07-25. Base : HEAD
`9d53a2ddd00ae88a78017745b85e64cc0273eed6`.

## Vue d'ensemble — cinq systèmes parallèles, aucune identité partagée

| # | Système | Producteur | Endpoint | Stockage | Identité | Persistance | Confiance | Problème principal |
|---|---|---|---|---|---|---|---|---|
| A | Founder-access analytics | `src/lib/founder-access/*` (`PresencePing.tsx`, `ReservationForm.tsx`, `funnel-events.ts`) | `POST /api/founder-access/presence`, `POST /api/founder-access/funnel`, `POST /api/founder-access/reservations` | **Postgres réel**, 9 tables (`clonestore_founder_*`, `clonestore_web_*`) | Cookie signé serveur `cs_analytics_session` (30j) | **Oui — le seul système réellement durable en prod** | Élevée pour les écritures métier (échouent fort) ; best-effort pour presence/funnel (`catch{}` volontaire) | `cs_anon_sid` généré client mais toujours ignoré serveur ; `founder_subscription_active` invisible du dashboard funnel |
| B | BLOC3 conversion | `src/lib/clonestore/conversion/*` (`client-emitter.ts`, `DemoEventTracker.tsx`, `checkout-bridge.ts`) | `POST /api/conversion/events`, `/p/[token]` | Déclare `in_memory \| runtime_pg` mais **`runtime_pg` n'a jamais été implémenté** | Cookie signé serveur `cs_conversion_session` (7j) | **Non — inerte en production**, `resolveBackend()` lève systématiquement en prod, capturé fail-closed partout | Nulle en pratique (rien n'est écrit) | Abandon silencieux total en prod (checkout/paiement/activation/démo inclus, pas seulement l'organique) ; schéma SQL déclaré ne correspond pas au type TS |
| C | Démo — analytics de présentation | `src/lib/demo/presentation/analytics.ts` (`emitDemoEvent`) | Aucun — pas d'appel réseau | `window.__cloneDemoAnalytics[]` (mémoire navigateur, perdu au refresh) | Aucune | **Non — ne quitte jamais le navigateur** | Nulle (code mort côté durabilité) | ~20 types d'événements émis dans `/demo` invisibles de tout backend |
| D | Guided Tour | `src/lib/guided-tour/*`, `GuidedTourProvider.tsx` | Aucun | `localStorage` uniquement (progression UI) | Aucune | Non applicable (état UI local, pas un événement) | N/A | **Zéro télémétrie** — démarrage/étape/fin/skip d'un tour n'est visible nulle part |
| E | `cs_anon_sid` (identité orpheline) | `PresencePing.tsx`, `ReservationForm.tsx` (deux implémentations dupliquées) | Transmis dans le corps de A | `sessionStorage` | Générée client, jamais réconciliée | Transmise mais **toujours ignorée côté serveur** | N/A | Code mort/confusant, piège d'audit |

## Détail des tables Système A (Postgres réel)

| Table | Rôle | Append-only forcé | RLS |
|---|---|---|---|
| `clonestore_founder_reservations` | État de la réservation, qualification, Stripe | Non (mutable, machine à états) | Oui, forcée |
| `clonestore_founder_funnel_events` | Événements funnel (client + serveur) | Oui (trigger `clonestore_forbid_mutation`) | Oui |
| `clonestore_web_sessions` | Session presence/heartbeat | Non (upsert) | Oui |
| `clonestore_web_events` | Événements client bruts (beacon) | Oui | Oui |
| `clonestore_founder_stripe_events` | Journal vérité Stripe | Oui, insertion via fonction `SECURITY DEFINER` réservée à un rôle dédié | Oui |
| `clonestore_founder_email_jobs` | Files d'emails (jamais réels dans ce bloc) | Non (état de job) | Oui |
| `clonestore_founder_admin_audit` | Audit admin | Oui | Oui |
| `clonestore_rate_limits` | Anti-abus (clé = hash SHA-256, jamais IP brute) | Non | Oui |
| `clonestore_founder_cron_runs` | Preuve d'exécution du worker email | Non | Oui |

Aucune de ces tables n'est exposée via Supabase REST — accès exclusivement par routes serveur.

## Détail Système B (déclaré, jamais connecté)

Table déclarée dans `supabase/sql/BLOC_3_CONVERSION_INTEGRATION.sql` (hors `supabase/migrations/`,
appliquée seulement via une commande manuelle d'opérateur, jamais en CI) :
`clonestore_bloc3_attribution_grants`, `clonestore_bloc3_conversion_sessions`,
`clonestore_bloc3_conversion_events` — cette dernière n'a **pas** de colonne `event_type`/
`eventType` alors que le type TS `ConversionEvent` en a besoin : même en connectant un backend
Postgres aujourd'hui, le schéma actuel ne pourrait pas contenir les données produites par le code.

## Risque de double-écriture conceptuelle (déjà identifié, avant même le rebuild)

Un même événement métier (démo terminée, checkout démarré, paiement/activation) est actuellement
émis par 2 à 3 systèmes indépendants sous 2 identités non réconciliées (`cs_analytics_session` vs
`cs_conversion_session`), sans double comptage réel aujourd'hui uniquement parce que B est inerte
et C ne quitte jamais le navigateur — ce risque redeviendrait actif si B était un jour connecté
sans réconciliation.

## Conclusion de cartographie

La fondation à préserver et étendre, pas à remplacer : **Système A** (`founder-access`) est le
seul système réellement durable, testé, RLS-protégé, avec écriture fail-loud sur le chemin
métier critique et fail-safe (volontaire) sur le chemin presence/beacon. Le rebuild canonique
(Phases 3+) introduit une **nouvelle table d'événements canonique unique** (append-only,
identités distinctes visitor/session/page-view/demo-run) comme sink de vérité future, avec des
adaptateurs additifs vers/depuis les systèmes A et B — sans jamais dupliquer l'écriture, sans
toucher aux chemins métier critiques déjà fail-loud de Système A.

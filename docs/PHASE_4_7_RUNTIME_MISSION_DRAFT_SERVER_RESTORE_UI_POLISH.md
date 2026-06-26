# PHASE 4.7 — Runtime Mission Draft Server Restore UI Polish

## 1. Objectif

Polir l'UI de restauration/synchronisation serveur des `RuntimeMissionDraft` dans
`/profile/messages`. PHASE 4.7 = **UI / observability polish uniquement**. Elle
n'ajoute **aucune nouvelle persistance**, **aucun write**, **aucune exécution**.
Elle rend lisible : où le brouillon est sauvegardé, pourquoi le serveur est
désactivé, ce que le fallback local protège, ce que le restore fait, ce qui reste
manuel, et pourquoi **aucune mission réelle** n'est créée.

## 2. État P4.6

- Manual Activation QA (32 étapes) + script read-only PASS + evidence template.
- Procédure : flag false → POST 423 → SQL manuel → table/RLS/policies/constraints
  → flag true local → POST 200 → row Supabase (safety_flags false) → rollback → POST 423.
- Aucun SQL appliqué auto, aucun flag activé, aucun write depuis script.

## 3. Pourquoi améliorer l'UI restore

Avant P4.7, le statut local/serveur n'apparaissait qu'après une sauvegarde
(badges/cards safe apply), sans **source effective** nommée, sans flag serveur
visible, sans rappel de l'**activation manuelle P4.6**, et avec un risque de
confusion entre « brouillon sauvegardé » et « mission lancée ». P4.7 ajoute un
panneau **« Statut brouillon runtime »** clair et permanent.

## 4. Restore UI model

`src/lib/clonestore/runtime-integration/runtime-mission-draft-restore-ui.ts` —
module **pur / read-only**. Il consomme les résultats P4.5 existants
(`lastPersistResult`, `lastRestoreResult`, `serverCapabilities`, `featureFlagEnabled`,
timestamps) et produit un `RuntimeMissionDraftRestoreUiSnapshot` + badges + cards +
timeline + warnings + actions. Aucune base de données, aucun appel réseau, aucun
import Pierre, jamais throw brut.

Fonctions : `buildRuntimeMissionDraftRestoreUiSnapshot`,
`buildRuntimeMissionDraftRestoreUiBadges`, `buildRuntimeMissionDraftRestoreUiCards`,
`buildRuntimeMissionDraftRestoreUiTimeline`, `buildRuntimeMissionDraftRestoreUiWarnings`,
`buildRuntimeMissionDraftRestoreUiActions`, `getRuntimeMissionDraftRestoreUiStatusLabel`,
`getRuntimeMissionDraftRestoreUiSourceLabel`, `getRuntimeMissionDraftRestoreUiTone`,
`explainRuntimeMissionDraftRestoreUiStatus`.

## 5. Statuses local / server / fallback

`local_only`, `local_saved`, `local_restored`, `server_disabled`, `server_attempted`,
`server_synced`, `server_restored`, `server_failed`, `auth_required`,
`table_unavailable`, `rls_blocked`, `restored_none`, `pending`, `unknown`.

Microcopy clé :

- **server_disabled** : « Serveur désactivé » — « Le brouillon reste sauvegardé
  localement. Le serveur nécessite l'activation manuelle P4.6. »
- **local_saved** : « Brouillon sauvegardé localement » — « localStorage reste le fallback actif. »
- **local_restored** : « Brouillon restauré depuis localStorage » — « Aucune mission réelle n'a été créée. »
- **server_synced** : « Brouillon synchronisé serveur » — « Le serveur a sauvegardé un brouillon uniquement, sans exécution. »
- **server_restored** : « Brouillon restauré depuis serveur » — « Le snapshot serveur a été relu, puis conservé localement si nécessaire. »
- **server_failed** : « Serveur indisponible — fallback local » — « La sauvegarde locale reste disponible. »
- **auth_required** : « Connexion requise » — « Connectez-vous pour tester la synchronisation serveur. »
- **table_unavailable** : « Table serveur à vérifier » — « Le SQL P4.4 doit être appliqué manuellement dans Supabase. »
- **rls_blocked** : « RLS/permissions à vérifier » — « La session ou les policies empêchent la lecture/écriture du brouillon. »

## 6. Sources localStorage / server

`localstorage`, `server`, `local_newer_than_server`, `server_newer_than_local`,
`fallback_local`, `server_disabled`, `manual_activation_required`, `unknown`.

La source effective est dérivée du statut + des timestamps local/serveur
(comparaison local vs serveur quand les deux existent).

## 7. Badges

`localStorage-first` · `Brouillon local` · `Serveur feature-flaggé` ·
`Aucune mission réelle` · `No-execution` · `Aucun appel Pierre` · `Aucun appel IA` ·
`CloneVoice non actif` · `Scale 80k non prouvé` · `Lancement public externe non validé`.

## 8. Cards

Source effective · Statut local · Statut serveur · Dernière sauvegarde locale ·
Dernière tentative serveur · Flag serveur · Safety flags (tous false) · Fallback local.

## 9. Timeline

`draft_created` · `local_saved` · `local_restored` · `server_skipped_disabled` ·
`server_attempted` · `server_synced` · `server_failed` · `server_restored` ·
`rollback_ready` · `execution_not_started`.

## 10. Warnings auth / table / RLS / flag

- **Flag serveur false** : persistance serveur désactivée (default false), POST → 423.
- **SQL non appliqué** : activation manuelle P4.6 requise.
- **Connexion requise** : fallback local actif.
- **Table/RLS à vérifier** : SQL P4.4 à appliquer manuellement.
- **RLS/permissions à vérifier** : session/policies à vérifier.
- **Safety flags** : tous false — aucune mission réelle, aucune exécution.

## 11. Intégration /profile/messages

Panneau **« Statut brouillon runtime »** ajouté sous le bloc Safe Apply P4.5 :
source effective, statut local/serveur, dernière sauvegarde locale, dernière
tentative serveur, flag serveur, fallback local, warnings et rappel d'activation
P4.6. Le snapshot est dérivé via `buildRuntimeMissionDraftRestoreUiSnapshot` à
partir des états existants (persist/restore). Les boutons
« Sauvegarder le brouillon localement » et « Restaurer le dernier brouillon local »
restent présents et n'agissent **qu'au clic**. Aucun restore/save au mount.

## 12. Invariant no-execution

P4.7 ne déclenche aucune exécution. `execution_not_started` est un élément terminal
de la timeline. La restauration ne crée **pas** de mission réelle.

## 13. Aucun write ajouté

Aucun write base de données, aucun POST, aucun upsert, aucun appel réseau ajouté.
Le module restore UI est pur ; la page réutilise les fonctions P4.5 existantes.

## 14. Aucun moteur Pierre

Aucun import `src/lib/pierre`, aucune route `/api/pierre`, aucun appel moteur Pierre.

## 15. Aucun appel IA

Aucun appel OpenAI/Anthropic/Stripe. `ai_call_performed` reste false.

## 16. Aucun email/message/document

Aucun email, message, document ou PDF généré ou envoyé.

## 17. CloneVoice non actif

CloneVoice n'est pas activé.

## 18. Scale 80k non prouvé

Le badge « Scale 80k non prouvé » est affiché. Préparation scale uniquement —
**scale 80k non prouvé**.

## 19. Ce qui est activé maintenant

- Modèle UI restore (snapshot/badges/cards/timeline/warnings/actions).
- Panneau « Statut brouillon runtime » dans `/profile/messages`.
- Module QA restore UI + doc + evidence template + tests + package script.

## 20. Ce qui reste non activé

- Table SQL non créée · flag serveur = false · persistance serveur non opérationnelle
  (activation manuelle P4.6 requise).
- **Lancement public externe : toujours non validé.**

## 21. Ce qui n'a PAS été fait en PHASE 4.7

- Aucune nouvelle persistance · aucun SQL appliqué · aucun `.env.local` modifié · aucun flag activé.
- Aucun write · aucun POST ajouté · aucune mission réelle · aucune exécution CloneOS.
- Aucun appel moteur Pierre · aucun appel IA · aucun email/message/document/PDF.
- Aucune activation CloneVoice · aucune modification de `go-live-proofs.local.json`.
- PHASE 5 (safe apply detail polish) jugée **non nécessaire** : le statut est
  entièrement dérivé des résultats P4.5 existants — `safe-apply.ts` inchangé.

**P4.7 ne change pas la persistance P4.5. Le serveur reste feature-flaggé.
L'activation serveur reste manuelle via P4.6. La restauration ne crée aucune mission
réelle. Aucune exécution. Aucun appel Pierre. Aucun appel IA. Aucun email/message/document.
CloneVoice non actif. scale 80k non prouvé. lancement public externe non validé.**

## 22. Prochain bloc recommandé

**PHASE 4.8 — Runtime Mission Promotion Contract / Draft → Controlled Mission**
Concevoir (design-only) le contrat de promotion d'un brouillon vers une mission
gouvernée contrôlée, toujours sans exécution réelle.

Alternative :
- **PHASE 4.8 — Pierre Mission Runtime Bridge / No-Autonomous Execution**

# PHASE 3.17 — Profile Messages CloneOS History Feed Merge

## Objectif

Fusionner dans `/profile/messages` le feed Empreinte Entreprise (P3.16) avec
l'historique CloneOS local déjà présent dans le repo, pour former un panneau
contextuel unifié **read-only**.

Objectif produit :
- "Voici le contexte entreprise connu."
- "Voici les dernières demandes CloneOS locales."
- "Voici ce qui est en attente / à compléter."
- "Voici les validations ou limites."
- "Voici les prochaines actions recommandées."

En PHASE 3.17 : feed read-only, aucun message envoyé, aucune action exécutée,
aucun write serveur, aucune route POST appelée, aucune exécution CloneOS.

---

## État avant PHASE 3.17

- P3.16 : `/profile/messages` affiche un panneau Empreinte Entreprise read-only
  (`loadEnterpriseFootprintForMessagesFeed`).
- Historique CloneOS local disponible via `loadCloneOSHistoryItemsFromLocalStorage()`
  (clé `clonestore.cloneos.commandHistory.v1`, PHASE 2.4 / 3.2).
- 4 tabs opérationnels intacts (suivis/briefings/livraisons/alertes).

---

## Feed Empreinte P3.16

Réutilisé tel quel via `loadEnterpriseFootprintForMessagesFeed()` :
- snapshot localStorage → onboarding draft → empty state.
- read-only, localStorage-only.

---

## Feed CloneOS history

Fichier : `src/lib/clonestore/messages/profile-messages-cloneos-history-feed.ts`

Bridge read-only localStorage-only autour de `loadCloneOSHistoryItemsFromLocalStorage()`.

Fonctions :
- `loadProfileMessagesCloneOSHistoryFeed()`
- `buildProfileMessagesCloneOSHistorySummary(history)`
- `buildProfileMessagesCloneOSHistoryItems(history)`
- `buildProfileMessagesCloneOSHistoryActions(result)`
- `buildEmptyProfileMessagesCloneOSHistoryFeed()`
- `getProfileMessagesCloneOSHistoryStatusLabel(status)`
- `getProfileMessagesCloneOSHistorySourceLabel(source)`

Source localStorage : `clonestore.cloneos.commandHistory.v1` (best-effort, aucune
nouvelle clé écrite en P3.17).

Invariants :
- Aucun Supabase. Aucun API. Aucun POST. Aucune exécution CloneOS.
- Tous les items `read_only: true`, plan-only.

---

## Bridge context feed

Fichier : `src/lib/clonestore/messages/profile-messages-context-feed.ts`

Fusionne le feed Empreinte + le feed CloneOS history en une source unique.

Fonctions :
- `loadProfileMessagesContextFeed()`
- `buildProfileMessagesContextFeedSummary(enterpriseFeed, cloneosHistory)`
- `buildProfileMessagesContextFeedSections(enterpriseFeed, cloneosHistory)`
- `buildProfileMessagesContextFeedItems(enterpriseFeed, cloneosHistory)`
- `buildProfileMessagesContextFeedRecommendations(enterpriseFeed, cloneosHistory)`
- `buildProfileMessagesContextFeedActions(result)`
- `buildEmptyProfileMessagesContextFeed()`
- `getProfileMessagesContextFeedStatusLabel(status)`
- `getProfileMessagesContextFeedSourceLabel(source)`

Summary expose :
`has_enterprise_footprint`, `has_cloneos_history`, `enterprise_items_count`,
`cloneos_items_count`, `total_items_count`, `warnings_count`, `actions_count`,
`read_only: true`, `updated_at`.

---

## Merge rules

1. Toujours afficher le contexte Empreinte si disponible.
2. Toujours afficher l'historique CloneOS si disponible.
3. Si les deux absents → empty state unique : "Aucun contexte système disponible
   pour l'instant." + CTA `/profile/onboarding` et `/profile/agents`.
4. Empreinte sans CloneOS → item "Aucun historique CloneOS local disponible."
5. CloneOS sans Empreinte → item "Historique CloneOS disponible, mais Empreinte
   Entreprise manquante."
6. Affichage limité à 5–8 items pour ne pas surcharger `/profile/messages`.
7. Tous les items `read_only: true`.
8. Aucun item ne dit qu'un message/action a été envoyé/exécuté.
9. Toute action proposée est un lien/CTA, pas une exécution.

---

## Intégration /profile/messages

Le panneau Empreinte P3.16 est remplacé visuellement par un panneau unifié
**"Contexte système CloneStore"** qui réutilise le feed Empreinte à l'intérieur.

- Summary : Empreinte oui/non · Historique CloneOS oui/non · items count · warnings count.
- Sections : Empreinte Entreprise · Historique CloneOS.
- Recommendations.
- Empty state si aucune source.
- Les 4 tabs existants restent intacts.

---

## Badges / microcopy obligatoires

Présents dans la page :
- `"Contexte système CloneStore"`
- `"Empreinte Entreprise"`
- `"Historique CloneOS local"`
- `"Lecture seule"`
- `"Aucune action exécutée"`
- `"Aucun message envoyé"`
- `"localStorage reste le fallback actif"`

---

## Recommendations

- Recommendations Empreinte (réutilisées de P3.16).
- Si validations CloneOS en attente : "X demande(s) CloneOS en attente de validation humaine."
- Si Empreinte présente sans CloneOS : "Lancer une demande CloneOS pour enrichir le contexte des messages."

---

## CTAs

`/profile/onboarding` · `/profile/agents#empreinte-entreprise` ·
`/profile/technologies` · `/agents/pierre/setup` · `/agents/pierre/use`

---

## Read-only invariant

- `/profile/messages` ne fait **aucun** write DB.
- **Aucun** appel POST `/api/profile/enterprise-footprint`.
- **Aucune** route CloneOS write.
- **Aucun** import Supabase ajouté pour le contexte.
- **Aucun** import `src/lib/pierre` dans les bridges.

---

## Aucun message / action envoyé

- **Aucun** message envoyé depuis la messagerie.
- **Aucune** action exécutée.
- Toute action proposée est un lien/CTA.

---

## Aucune exécution CloneOS

- Le feed lit l'historique CloneOS local (plan-only).
- **Aucune** commande CloneOS n'est exécutée.
- Le feed est strictement read-only.

---

## QA module

Fichier : `src/lib/clonestore/messages/profile-messages-context-feed-qa.ts`

Checklist 16 étapes :

```
context_feed_bridge_exists · enterprise_feed_reused
cloneos_history_feed_reused_or_created · context_summary_builds
context_sections_build · context_items_build
profile_messages_context_panel_visible · read_only_badge_visible
no_db_write · no_api_post · no_supabase_import · no_pierre_engine_import
no_message_sent · no_cloneos_execution · fallback_empty_state_available
public_launch_external_not_validated
```

---

## Ce qui est activé maintenant

✅ Bridge CloneOS history feed (localStorage, read-only).  
✅ Bridge context feed unifié (Empreinte + CloneOS).  
✅ Merge rules implémentées.  
✅ QA module (16 étapes).  
✅ Panneau "Contexte système CloneStore" dans `/profile/messages`.  
✅ Badges read-only.  
✅ Empty state propre avec CTAs.  
✅ Recommendations adaptées.  
✅ Exports `messages/index.ts`.  

---

## Ce qui reste non activé

- Table SQL `clonestore_enterprise_footprints` non créée (P3.15 manuel requis).
- Persistence serveur CloneOS history non activée (localStorage_only).
- Feature flags = false.
- **Lancement public externe : toujours non validé.**

---

## Ce qui n'a PAS été fait en PHASE 3.17

- Write en DB depuis `/profile/messages`.
- Appel POST `/api/profile/enterprise-footprint`.
- Route CloneOS write.
- Exécution d'une commande CloneOS.
- Modification du moteur Pierre.
- Appel OpenAI / Anthropic.
- Envoi d'email ou message réel.
- Application automatique du SQL.
- Modification de `.env.local`.
- Modification de `go-live-proofs.local.json`.

---

## Prochain bloc recommandé

**PHASE 3.18 — Enterprise Footprint Server Restore UI Polish**

Améliorer l'UI du status de restauration serveur de l'Empreinte dans
`/profile/onboarding` (affichage source server/local, dernière sync), read-only.

Alternatives :
- PHASE 3.18 — CloneOS History Manual Activation QA
- PHASE 3.18 — Global Employee Context Registry Design

# PHASE 3.16 — Profile Messages Enterprise Footprint Feed

## Objectif

Intégrer l'Empreinte Entreprise en lecture seule dans `/profile/messages`.

Objectif produit :
- Donner du contexte entreprise à l'utilisateur dans la messagerie.
- Signaler les manques de configuration (approbateurs, règles, documents).
- Préparer le terrain pour un futur feed opérationnel.
- Rester strictement read-only — aucun message envoyé, aucun write serveur.

---

## État avant PHASE 3.16

- PHASE 3.14 : Route API GET/POST feature-flaggée. Runtime localStorage-first.
- PHASE 3.15 : Manual Activation QA. SQL non appliqué. Flag false. .env non modifié.
- `/profile/messages` : 4 tabs opérationnels (suivis/briefings/livraisons/alertes), mock data.
  **Aucune section Empreinte Entreprise** avant cette phase.
- `loadEnterpriseFootprintForCockpit()` : fallback chain complète disponible.

---

## Bridge messages feed

Fichier : `src/lib/clonestore/enterprise-footprint/enterprise-footprint-messages-feed.ts`

### Fallback chain

```
snapshot localStorage (enterprise_footprint_snapshot)
  → onboarding_draft_fallback (via loadEnterpriseFootprintForCockpit)
  → empty state avec CTA /profile/onboarding
```

localStorage reste le fallback actif dans tous les cas.

### Fonctions

- `loadEnterpriseFootprintForMessagesFeed()` — point d'entrée principal
- `buildEnterpriseFootprintMessagesFeedSummary(fp, source)` — résumé read-only
- `buildEnterpriseFootprintMessagesFeedCards(fp)` — 4 cards contextuelles
- `buildEnterpriseFootprintMessagesFeedItems(fp, source)` — feed items read-only
- `buildEnterpriseFootprintMessagesFeedRecommendations(fp | null)` — recommendations adaptées
- `buildEnterpriseFootprintMessagesFeedActions(result)` — CTAs vers onboarding/agents/Pierre
- `buildEmptyEnterpriseFootprintMessagesFeedState()` — empty state propre
- `getEnterpriseFootprintMessagesFeedStatusLabel(status)` — label status
- `getEnterpriseFootprintMessagesFeedSourceLabel(source)` — label source

### Invariants

- Aucun import Supabase.
- Aucun appel réseau.
- Aucun write DB.
- Aucun POST `/api/profile/enterprise-footprint`.
- Aucun import `src/lib/pierre`.
- `typeof window` guard pour SSR.
- Jamais de throw brut.

---

## Feed items read-only

6 items possibles :

1. **"Contexte entreprise disponible"** — si footprint existe (company_name).
2. **"Empreinte Entreprise incomplète"** — si `missing_items > 0`.
3. **"Validations humaines configurées"** — si approbateurs présents.
4. **"Documents RH référencés"** — si documents présents.
5. **"Warnings Empreinte"** — si warnings présents.
6. **"Aucune Empreinte Entreprise"** — empty state avec CTA.

Tous les items ont `read_only: true`.  
Aucun item ne prétend qu'un message a été envoyé.  
Aucun item ne déclenche une action.

---

## Intégration /profile/messages

Position : entre le panneau d'erreur et les onglets principaux.

### Panneau avec Empreinte

- Titre : nom de l'entreprise ou "Contexte Entreprise".
- Badges : "Empreinte Entreprise", "Lecture seule", "Aucune action exécutée", "Aucun message envoyé".
- Source label (snapshot / brouillon onboarding).
- 4 cards : Empreinte, Validation, Documents, À compléter.
- Feed items (max 3 affichés).
- Recommendations.
- CTAs vers `/profile/onboarding`, `/agents/pierre/use`.

### Empty state

- "Empreinte Entreprise manquante".
- "Les messages peuvent être consultés, mais le contexte entreprise global n'est pas encore disponible."
- CTA `/profile/onboarding`.

---

## Badges / microcopy obligatoires

Présents dans la page :
- `"Lecture seule"`
- `"Aucune action exécutée"`
- `"Aucun message envoyé"`
- `"localStorage reste le fallback actif"`
- `/profile/onboarding` (CTA)

---

## Recommendations

- Si aucun approbateur : "Ajouter un approbateur avant les futures validations sensibles."
- Si aucune règle : "Définir les règles de validation dans l'onboarding."
- Si aucun document : "Référencer les documents nécessaires."
- Si readiness ≥ 60 : "Le contexte est exploitable en lecture seule pour guider les messages."
- Si empty state : "Créer l'Empreinte Entreprise dans l'onboarding."

---

## CTAs

- `/profile/onboarding` — créer/modifier l'Empreinte.
- `/profile/agents#empreinte-entreprise` — voir dans Mon espace.
- `/profile/technologies` — technologies.
- `/agents/pierre/setup` — Pierre Setup.
- `/agents/pierre/use` — Cockpit Pierre.

---

## QA module

Fichier : `src/lib/clonestore/enterprise-footprint/enterprise-footprint-messages-feed-qa.ts`

Checklist 16 étapes :

```
messages_feed_bridge_exists
footprint_snapshot_or_empty_state
onboarding_fallback_available
feed_summary_builds
feed_cards_build
feed_items_build
feed_recommendations_build
profile_messages_panel_visible
read_only_badge_visible
no_db_write
no_api_post
no_supabase_import
no_pierre_engine_import
no_message_sent
rollback_empty_state_available
public_launch_external_not_validated
```

---

## Read-only invariant

- `/profile/messages` ne fait **aucun** write DB.
- **Aucun** appel POST `/api/profile/enterprise-footprint`.
- **Aucun** import Supabase ajouté pour l'Empreinte.
- **Aucun** import `src/lib/pierre` dans le bridge.
- **Aucun** message envoyé depuis la messagerie.
- **Aucune** mission exécutée.

---

## Ce qui est activé maintenant

✅ Bridge messages feed (localStorage-only, read-only).  
✅ 8 types de feed, 9 fonctions.  
✅ Feed items read-only (6 catégories).  
✅ QA module (16 étapes).  
✅ Panneau Empreinte dans `/profile/messages`.  
✅ Badges "Lecture seule", "Aucune action exécutée", "Aucun message envoyé".  
✅ Empty state propre avec CTA.  
✅ Recommendations adaptées.  
✅ CTAs vers onboarding/agents/Pierre.  

---

## Ce qui reste non activé

- Table SQL `clonestore_enterprise_footprints` non encore créée (PHASE 3.15 manuel requis).
- Feature flag = false.
- Sync serveur non opérationnelle.
- **Lancement public externe : toujours non validé.**

---

## Ce qui n'a PAS été fait en PHASE 3.16

- Write en DB depuis `/profile/messages`.
- Appel POST `/api/profile/enterprise-footprint`.
- Modification du moteur Pierre.
- Appel OpenAI / Anthropic.
- Envoi d'email ou message réel.
- Application automatique du SQL.
- Modification de `.env.local`.
- Modification de `go-live-proofs.local.json`.
- Création de vrais multi-agents.

---

## Prochain bloc recommandé

**PHASE 3.17 — Profile Messages CloneOS History Feed Merge**

Fusionner le feed Empreinte Entreprise avec l'historique CloneOS dans un panneau contextuel unifié dans `/profile/messages`.

Alternatives :
- PHASE 3.17 — Enterprise Footprint Server Restore UI Polish
- PHASE 3.17 — CloneOS History Manual Activation QA

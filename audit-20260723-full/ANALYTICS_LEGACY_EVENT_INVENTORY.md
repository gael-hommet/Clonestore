# Analytics Legacy Event Inventory

Inventaire exhaustif de tous les identifiants d'événements trouvés dans le code (4 taxonomies
distinctes, 83 identifiants), avec classification obligatoire selon les 10 catégories du master
prompt. Base : HEAD `9d53a2ddd00ae88a78017745b85e64cc0273eed6`. Toutes les enumerations
ci-dessous sont lues directement depuis le code source (pas de reconstruction par recherche
approximative).

Légende des catégories : `CANONICAL_KEEP` · `CANONICAL_RENAME` · `LEGACY_ALIAS` ·
`DUPLICATE_REMOVE` · `LOCAL_ONLY` · `SERVER_TRUTH` · `CLIENT_SIGNAL` · `UNSAFE_PAYLOAD` ·
`OBSOLETE` · `UNKNOWN_REVIEW_REQUIRED`.

## A. `src/lib/founder-access/types.ts` — `CLIENT_ANALYTICS_EVENTS` (26 événements)

| Événement legacy | Fichier producteur | Catégorie | Mapping canonique |
|---|---|---|---|
| `site_viewed` | `PresencePing.tsx` (`src/app/page.tsx`) | `CANONICAL_RENAME` | `page_viewed` (route=`/`) |
| `demo_viewed` | `PresencePing.tsx` (`src/app/demo/page.tsx`) | `CANONICAL_RENAME` | `page_viewed` (route=`/demo`) |
| `demo_started` | `DemoExperience.tsx` | `CANONICAL_KEEP` | `demo_started` |
| `demo_scene_viewed` | (déclaré, émetteur non confirmé actif) | `UNKNOWN_REVIEW_REQUIRED` | à vérifier avant retrait |
| `demo_completed` | `DemoExperience.tsx` | `CANONICAL_KEEP` | `demo_completed` |
| `demo_pierre_reveal_viewed` | `DemoExperience.tsx` (`handleRevealViewed`) | `CANONICAL_RENAME` | `demo_pierre_reveal_viewed` (conservé, ajouté au canon) |
| `discover_pierre_clicked` | `DemoExperience.tsx` (`handleDiscoverPierre`) | `CANONICAL_KEEP` | `discover_pierre_clicked` |
| `product_page_viewed` | `/agents/pierre` (fiche produit) | `CANONICAL_RENAME` | `page_viewed` (route=`/agents/pierre`) |
| `product_demo_clicked` | fiche produit → cockpit | `CANONICAL_KEEP` | `product_demo_clicked` |
| `pierre_demo_started` | `DemoEventTracker.tsx` | `CANONICAL_KEEP` | `pierre_demo_started` |
| `pierre_demo_completed` | `DemoEventTracker.tsx` | `CANONICAL_KEEP` | `pierre_demo_completed` |
| `founder_cta_viewed` | (déclaré) | `UNKNOWN_REVIEW_REQUIRED` | émetteur non confirmé par la recherche |
| `founder_cta_clicked` | `DemoEventTracker.tsx` (`purchase_cta_clicked` path) | `CANONICAL_RENAME` | `reservation_cta_clicked` |
| `founder_form_viewed` | `ReservationForm.tsx` | `CANONICAL_RENAME` | `reservation_form_started` (déclenché au montage — voir doublon ci-dessous) |
| `founder_form_step1_started` | `ReservationForm.tsx` | `CANONICAL_KEEP` | `reservation_form_started` (source de vérité — `founder_form_viewed` en devient un doublon de fait) |
| `founder_form_step1_completed` | `ReservationForm.tsx` | `CLIENT_SIGNAL` | signal client seul — la vérité reste `SERVER_TRUTH: founder_reservation_created` |
| `founder_form_step2_viewed` | `ReservationForm.tsx` | `CLIENT_SIGNAL` | conservé comme signal intermédiaire |
| `founder_form_step2_completed` | `ReservationForm.tsx` | `CANONICAL_RENAME` | `reservation_submitted` (signal client — la vérité reste serveur) |
| `founder_form_step2_failed` | `ReservationForm.tsx` | `CLIENT_SIGNAL` | conservé (diagnostic UX) |
| `founder_activation_viewed` | `page.tsx` **et** `ActivatePierre.tsx` (double émission confirmée) | `DUPLICATE_REMOVE` | une seule émission après rebuild, voir `ANALYTICS_LEGACY_MIGRATION_MATRIX.md` |
| `founder_activation_started` | `ActivatePierre.tsx` | `CANONICAL_RENAME` | `activation_started` (signal client) |
| `founder_checkout_started` | `PresencePing` sur `/checkout` (vue de page, pas une action) **et** `ActivatePierre.tsx` (après URL Stripe réelle — sémantique différente, même nom) | `UNSAFE_PAYLOAD` → à corriger | collision de nom entre deux sémantiques ; scindé en `page_viewed` (route=`/checkout`) vs `checkout_started` (signal client réel) |
| `founder_checkout_failed` | `ActivatePierre.tsx` | `CANONICAL_KEEP` | `checkout_failed` (signal client ; vérité reste webhook Stripe) |
| `homepage_demo_prompt_seen` | `DemoContextualPrompt.tsx` | `CANONICAL_KEEP` | `homepage_demo_prompt_seen` |
| `homepage_demo_prompt_clicked` | `DemoContextualPrompt.tsx` | `CANONICAL_KEEP` | `homepage_demo_prompt_clicked` |
| `homepage_demo_prompt_dismissed` | `DemoContextualPrompt.tsx` | `CANONICAL_KEEP` | `homepage_demo_prompt_dismissed` |

## B. `src/lib/founder-access/types.ts` — `SERVER_FUNNEL_EVENTS` (12 événements, jamais acceptés du client)

| Événement legacy | Producteur | Catégorie | Mapping canonique |
|---|---|---|---|
| `founder_reservation_created` | `store.ts` | `SERVER_TRUTH` | `reservation_submitted` (niveau `SERVER_PERSISTED`) |
| `founder_qualification_completed` | `store.ts` | `SERVER_TRUTH` | conservé tel quel (étape qualification, hors funnel principal v1) |
| `founder_qualification_partial_failed` | `store.ts` | `SERVER_TRUTH` | conservé tel quel |
| `founder_verification_sent` | `email-worker.ts` | `SERVER_TRUTH` | conservé (email, hors funnel visiteur) |
| `founder_verification_resent` | `email-worker.ts` | `SERVER_TRUTH` | conservé |
| `founder_email_verified` | `store.ts` | `SERVER_TRUTH` | `reservation_email_confirmed` (niveau `SERVER_CONFIRMED`) |
| `founder_unsubscribed` | `store.ts` | `SERVER_TRUTH` | conservé (hors funnel principal) |
| `founder_contact_requested` | `store.ts` | `SERVER_TRUTH` | conservé |
| `founder_payment_completed` | webhook Stripe → `store.ts` | `SERVER_TRUTH` | `payment_succeeded` (niveau `PAYMENT_PROVIDER_CONFIRMED`) |
| `founder_subscription_active` | webhook Stripe → `store.ts` | `SERVER_TRUTH` | `activation_completed` (niveau `PAYMENT_PROVIDER_CONFIRMED`) — **bug confirmé : absent de `FUNNEL_DEFS`, corrigé dans le funnel canonique** |
| `founder_subscription_canceled` | webhook Stripe → `store.ts` | `SERVER_TRUTH` | conservé (hors funnel d'acquisition v1) |
| `founder_subscription_past_due` | webhook Stripe → `store.ts` | `SERVER_TRUTH` | conservé |

## C. `src/lib/clonestore/conversion/contract.ts` — `EVENT_TYPES` BLOC3 (23 événements)

| Événement legacy | Catégorie | Mapping canonique |
|---|---|---|
| `landing_viewed` | `CANONICAL_RENAME` | `page_viewed` |
| `demo_started` | `DUPLICATE_REMOVE` | fusionné avec A.`demo_started` |
| `demo_completed` | `DUPLICATE_REMOVE` | fusionné avec A.`demo_completed` |
| `demo_step_viewed` | `CANONICAL_RENAME` | `pierre_demo_step_completed` |
| `purchase_cta_clicked` | `DUPLICATE_REMOVE` | fusionné avec A.`founder_cta_clicked`→`reservation_cta_clicked` |
| `assistance_cta_clicked` | `CANONICAL_KEEP` | conservé (CTA distinct, non couvert par A) |
| `checkout_started` | `DUPLICATE_REMOVE` | fusionné avec A → `checkout_started` |
| `checkout_completed` | `CANONICAL_RENAME` | `checkout_session_created` (BLOC3 le nomme "completed" au sens "session créée", pas paiement — clarifié) |
| `checkout_failed` | `DUPLICATE_REMOVE` | fusionné avec A.`founder_checkout_failed` |
| `pierre_activated` | `DUPLICATE_REMOVE` | fusionné avec B.`founder_subscription_active`→`activation_completed` |
| `variant_assigned` | `SERVER_TRUTH` | conservé (attribution, hors funnel principal v1) |
| `diagnostic_started` | `CLIENT_SIGNAL` | conservé (fonctionnalité BLOC3 spécifique, non couverte par A) |
| `diagnostic_step_completed` | `CLIENT_SIGNAL` | conservé |
| `diagnostic_completed` | `SERVER_TRUTH` | conservé |
| `onboarding_started` | `OBSOLETE` | aucun émetteur actif trouvé dans le code lu |
| `onboarding_completed` | `OBSOLETE` | aucun émetteur actif trouvé |
| `meeting_started` | `OBSOLETE` | aucun émetteur actif (héritage LeadForge) |
| `meeting_booked` | `OBSOLETE` | aucun émetteur actif (héritage LeadForge) |
| `message_preview_generated` | `OBSOLETE` | provient du serveur LeadForge externe, jamais CloneStore |
| `positive_reply` | `OBSOLETE` | provient du serveur LeadForge externe |
| `reply_received` | `OBSOLETE` | provient du serveur LeadForge externe |
| `result_viewed` | `UNKNOWN_REVIEW_REQUIRED` | émetteur non confirmé par la recherche |
| `unsubscribe` | `OBSOLETE` | provient du serveur LeadForge externe, doublon de A.`founder_unsubscribed` côté CloneStore |

## D. `src/lib/demo/presentation/analytics.ts` — `DEMO_EVENTS` (22 clés, système C, aucune persistance)

Tous classés `LOCAL_ONLY` — ce système n'effectue aucun appel réseau (poussé uniquement dans
`window.__cloneDemoAnalytics[]`, perdu au rafraîchissement). Aucun n'est actuellement dupliqué
avec A/B en termes de **stockage** (puisqu'il n'y a pas de stockage), mais plusieurs le sont en
termes de **sémantique** (même action utilisateur déjà couverte par A ou B) :

| Clé | Nom legacy | Catégorie | Note |
|---|---|---|---|
| `viewed` | `clone_demo_viewed` | `LOCAL_ONLY` | sémantiquement doublon de A.`demo_viewed` |
| `started` | `clone_demo_started` | `LOCAL_ONLY` | doublon de A.`demo_started` |
| `directPierreClicked` | `clone_demo_direct_pierre_clicked` | `LOCAL_ONLY` | à réémettre en canonique (`discover_pierre_clicked` variante directe) |
| `reservationClicked` | `clone_demo_reservation_clicked` | `LOCAL_ONLY` | à réémettre → `reservation_cta_clicked` |
| `problemSectionViewed` | `clone_demo_problem_section_viewed` | `LOCAL_ONLY` | conservable en propriété `properties.section` d'un futur `demo_section_viewed` (hors v1) |
| `categorySectionViewed` | idem | `LOCAL_ONLY` | idem |
| `systemSectionViewed` | idem | `LOCAL_ONLY` | idem |
| `footprintSectionViewed` | idem | `LOCAL_ONLY` | idem |
| `scaleSectionViewed` | idem | `LOCAL_ONLY` | idem |
| `trustSectionViewed` | idem | `LOCAL_ONLY` | idem |
| `costSectionViewed` | idem | `LOCAL_ONLY` | idem — **aucune donnée saisie jamais attachée (confirmé par commentaire code)** |
| `costScenarioSelected` | idem | `LOCAL_ONLY` | idem |
| `costCalculatorAdjusted` | idem | `LOCAL_ONLY` | idem |
| `firstMissionSelected` | `clone_demo_first_mission_selected` | `LOCAL_ONLY` | mesure la décision, jamais son contenu (confirmé) |
| `cloneChatCtaClicked` | idem | `LOCAL_ONLY` | à réémettre en canonique (hors v1) |
| `pierreScopeSectionViewed` | idem | `LOCAL_ONLY` | idem section |
| `organizationSectionViewed` | idem | `LOCAL_ONLY` | idem section |
| `completionViewed` | idem | `LOCAL_ONLY` | doublon sémantique de `demo_completed` |
| `pierreCtaVisible` | idem | `LOCAL_ONLY` | doublon sémantique de A.`founder_cta_viewed` |
| `pierreCtaClicked` | idem | `LOCAL_ONLY` | doublon sémantique de `reservation_cta_clicked` |
| `directReservationClicked` | idem | `LOCAL_ONLY` | doublon sémantique de `reservation_cta_clicked` |
| `completed` | `clone_demo_completed` | `LOCAL_ONLY` | doublon sémantique de A.`demo_completed` |

**Décision Phase 10** : Système C (`emitDemoEvent`) est déprécié proprement (voir
`ANALYTICS_LEGACY_MIGRATION_MATRIX.md`) — son rôle de "seam pluggable jamais branché" est repris
par le tracker canonique unique ; le fichier n'est pas supprimé dans ce bloc (pas de preuve que
rien ne le lit encore côté build/tests) mais n'est plus le chemin recommandé.

## E. Guided Tour — aucun événement existant

Aucune entrée : le système n'émettait aucun signal analytique avant ce bloc (confirmé par grep,
0 résultat). Les nouveaux événements `guided_tour_started`, `guided_tour_step_completed`,
`guided_tour_completed`, `guided_tour_skipped` sont des ajouts nets, classés `CANONICAL_KEEP`
dans le nouveau contrat — ils comblent une lacune, ils ne remplacent rien.

## F. `cs_anon_sid` — identité, pas un événement

Non classée dans les 10 catégories d'événements (ce n'est pas un événement) — traitée séparément
dans `ANALYTICS_IDENTITY_CONTRACT.md` : identité orpheline, dépréciée au profit de `visitor_id`/
`session_id` serveur-signés dès ce bloc.

## Synthèse chiffrée

- **83 identifiants d'événements** inventoriés au total (26 + 12 + 23 + 22, système E sans
  événement propre).
- `SERVER_TRUTH` : 15 (12 de A + `variant_assigned`/`diagnostic_completed` de B partiellement).
- `CANONICAL_KEEP` ou `CANONICAL_RENAME` : 24.
- `DUPLICATE_REMOVE` : 8 (fusionnés vers un seul événement canonique).
- `CLIENT_SIGNAL` : 6.
- `LOCAL_ONLY` : 22 (système C au complet).
- `OBSOLETE` : 7 (héritage LeadForge externe jamais émis par CloneStore lui-même).
- `UNKNOWN_REVIEW_REQUIRED` : 3 (`demo_scene_viewed`, `founder_cta_viewed`, `result_viewed` —
  déclarés dans une taxonomie mais aucun émetteur actif confirmé par la lecture de code ; ni
  supprimés ni portés au canon tant que non confirmés).

Aucun des 83 identifiants ne reste sans catégorie.

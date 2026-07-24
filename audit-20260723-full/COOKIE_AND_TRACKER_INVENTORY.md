# Cookie and Tracker Inventory

Full technical inventory: evidence file `03-cookies-trackers-raw.md`. Summary + classification below.

## Cookies (all first-party)

| Cookie | Classification | Notes |
|---|---|---|
| `cs_conversion_session` | Mesure d'audience / attribution marketing potentiellement soumise à consentement | 7 jours, HttpOnly, sert aussi de session technique d'attribution — l'exemption "mesure d'audience" CNIL pourrait s'appliquer selon les critères réels (finalité strictement statistique, pas de croisement avec d'autres traceurs) ; **non tranché ici**, `PROFESSIONAL_REVIEW_REQUIRED` |
| `cs_owner_gate` | Strictement nécessaire (sécurité) | Auth admin interne, 12h, jamais posé pour un visiteur public |
| `cs_founder_reservation` | Strictement nécessaire (sécurité/fonctionnel) | Preuve de possession, 2h, propre au parcours de réservation |
| `cs_analytics_session` | Mesure d'audience potentiellement exemptée | 30 jours, aucune donnée personnelle directe stockée dans le cookie lui-même (juste un identifiant) |
| `cs_pp_ref` | Marketing/attribution (commission partenaire) | 90 jours — le plus long TTL, sert à l'attribution de commission, pas de la simple mesure d'audience ; **candidat le plus probable à nécessiter un consentement explicite** |
| `pierre_e2e_session` | Strictement nécessaire (test uniquement) | Jamais posé en production (`guardE2E()`/`PIERRE_E2E_TEST_MODE`) |
| Cookie(s) Supabase Auth (`sb-<ref>-auth-token`) | Strictement nécessaire (authentification) | Standard, comportement de la librairie |

## localStorage / sessionStorage
Tous premier-parti, état UI ou mesure produit (voir liste complète évidence 03) : aucun traceur tiers, aucune donnée personnelle directement identifiante stockée en clair.

## Scripts/pixels tiers
**Aucun** — recherche exhaustive (posthog, mixpanel, gtag/GA, segment, plausible, clarity, hotjar, fullstory, LinkedIn insight tag, Meta/Facebook pixel, TikTok pixel, growthbook/optimizely/launchdarkly/split.io/statsig, logrocket/smartlook) : zéro correspondance. Stripe.js n'est pas chargé côté client (flux 100% redirection serveur vers la page hébergée Stripe).

## CMP (bandeau de consentement)
**N'existe pas.** Confirmé par recherche de code (zéro composant) ET par le texte même de `/legal/mentions` §Cookies, qui reconnaît déjà que "une bannière de consentement peut être requise selon la réglementation applicable (CNIL, ePrivacy)".

## Décision requise (Phase 11 du master prompt)
Le master prompt interdit de "créer un faux bandeau complexe" si tous les traceurs sont réellement strictement nécessaires ou exemptés. Ici, **la situation n'est pas aussi simple** : `cs_pp_ref` (90 jours, attribution de commission partenaire) et, dans une moindre mesure, `cs_conversion_session` (7 jours, attribution marketing) sont des cas limites qui ne relèvent pas clairement de la seule mesure d'audience CNIL-exemptée — ils servent une finalité commerciale (rémunération de partenaires, attribution de campagne), pas uniquement statistique.

**Ce bloc ne tranche donc pas lui-même** entre "aucun bandeau nécessaire" et "un CMP complet est requis" — cette décision est explicitement renvoyée au DPO/avocat (`PROFESSIONAL_REVIEW_REQUIRED`, voir `OWNER_LEGAL_INPUT_REQUIRED.md` item 17), avec le rappel que la CNIL a sanctionné 21 entités en 2025 pour un total d'environ 32M€ sur ce sujet précis (source officielle, voir dossier de preuves item 11, source #3) — ce n'est pas un risque théorique.

Si la décision finale est "CMP requis", les règles à respecter sont déjà connues du code de ce dépôt et documentées ici pour l'implémentation future : pas de case précochée, aucun tracking avant consentement, boutons Accepter/Refuser de visibilité comparable, préférences granulaires, retrait permanent accessible, version du consentement journalisée, preuve technique conservée.

## Ce qui N'A PAS été fait dans ce bloc
Aucun bandeau de consentement n'a été créé (ni un faux bandeau simplifié, ni un CMP complet) — car la décision préalable (lesquels des 2 cookies limites nécessitent réellement un consentement) n'a pas été tranchée par un professionnel. Créer un bandeau maintenant, avant cette décision, risquerait soit de bloquer inutilement des cookies exemptés, soit de donner une fausse impression de conformité sur des cookies qui en ont réellement besoin.

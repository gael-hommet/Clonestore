# Analytics External Validation Protocol

**Statut : `NOT_EXECUTED`.** Aucun des 30 testeurs externes n'a réellement participé dans ce
bloc — ce document produit uniquement le protocole et la grille de mesure, conformément à
l'instruction du master prompt (« tant que les 30 personnes n'ont pas réellement participé...
ne jamais écrire 30/30 »).

## Cohorte

Identifiant de campagne fermé : `external_validation_2026_08` (correspond à
`utm_campaign=external_validation_2026_08`, allowlisté par le contrat UTM existant — aucune
modification requise à `attribution.ts`). Aucune identité personnelle collectée : les
participants sont identifiés uniquement par leur `visitor_id` canonique, jamais par nom/email.

## Répartition minimale recommandée

- Mobile iOS (Safari)
- Mobile Android (Chrome)
- Desktop Chrome
- Desktop Safari
- Desktop Firefox ou Edge
- Au moins 3 tailles d'écran distinctes
- Au moins 2 sources d'entrée distinctes (lien direct, réseau social, email)

## Grille de mesure par testeur

| Mesure | Source canonique |
|---|---|
| Session reçue | `session_started` (dérivé, `session_id` distinct observé) |
| Page view reçue | `page_viewed` |
| Demo run reçu | `demo_started` avec `demo_run_id` |
| Pierre run reçu | `pierre_demo_started` avec `demo_run_id`, `demoType=demo_pierre` |
| Étape finale atteinte ou non | dernier `pierre_demo_step_completed`/`pierre_demo_completed` observé pour ce `demo_run_id` |
| Erreur | absence d'événement attendu dans une fenêtre raisonnable (calculé, jamais un événement `*_error` fabriqué) |
| CTA | `reservation_cta_clicked` |
| Formulaire | `reservation_form_started`/`reservation_submitted` |
| Appareil coarse | `properties.device` (`mobile`/`tablet`/`desktop`) |
| Source | `utm_source=external_validation_2026_08` ou équivalent |

Aucun testeur n'est identifié nominativement dans le dashboard — uniquement des `visitor_id`
anonymes agrégés sous la campagne `external_validation_2026_08`, visible via le filtre `campagne`
du dashboard (non implémenté en v1, voir `ANALYTICS_DASHBOARD_SPEC.md` — une requête directe sur
`campaign_key` reste possible en attendant).

## Prochaine étape

L'exécution réelle de ce protocole (recrutement des 30 testeurs, collecte, analyse) est le
contenu du bloc suivant : **EXTERNAL VALIDATION AND LAUNCH REHEARSAL CLOSURE**, gated sur cette
fermeture.

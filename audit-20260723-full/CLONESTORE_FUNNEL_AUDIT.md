# CloneStore — Audit funnel et analytics

Audit du 2026-07-23. Périmètre : accueil → démo → Pierre → réservation → checkout → paiement → activation, et les systèmes d'événements qui le mesurent.

## Constat central : TROIS architectures d'analytics/funnel indépendantes, partiellement redondantes

| Système | Rôle | Backend réel | Statut |
|---|---|---|---|
| `src/lib/founder-access/` | Funnel événementiel + cohorté (marche temporelle), alimente réellement le dashboard Founder Command Center | **Postgres réel** | **Le seul système réellement opérant en production** |
| `src/lib/clonestore/conversion/` ("BLOC3"/LeadForge) | Attribution de campagne (`/p/[token]`), pont checkout/webhook | `runtime_pg` **déclaré mais jamais implémenté** — seul `in_memory` existe, interdit en prod | **Inerte en production** : `resolveBackend()` lève systématiquement une erreur, capturée fail-closed partout → aucune attribution de campagne n'est jamais persistée en prod, même si un lien `/p/{token}` réel était envoyé aujourd'hui. Le module a sa propre porte "readiness" qui liste déjà ce gap — donc **documenté par l'équipe**, pas caché, mais réel. |
| `src/lib/demo/presentation/analytics.ts` | Télémétrie de la démo (scroll/section) | **Aucun** — le commentaire du code dit explicitement "aucune requête réseau" | **Décorative** : coexiste dans les mêmes composants (`DemoExperience.tsx`, `Act6Cost.tsx`) que le vrai système founder-access, pour les mêmes actions utilisateur, sans jamais quitter le navigateur. Le "hook futur" mentionné en commentaire n'est jamais branché (0 consommateur trouvé). |

**Conséquence directe** : deux pipelines émettent parfois le même événement conceptuel (`demo_completed` / `pierre_demo_completed`) vers deux stores différents avec deux cookies/sessions différents (`cs_conversion_session` vs `sessionStorage cs_anon_sid`) — doublon partiellement intentionnel (deux domaines métier : attribution marketing LeadForge vs dashboard commercial) mais qui augmente le risque de dérive de maintenance.

**Mise à jour 2026-07-24 (DEMO AND MOBILE CONVERSION CLOSURE)** : constat reconfirmé et approfondi, non résolu (unification explicitement prévue pour le prochain bloc, ANALYTICS FUNNEL AND LAUNCH MEASUREMENT CLOSURE) — confirmation additionnelle qu'aucun `visitor_id` long-terme, `demo_run_id`, ou filtre trafic interne/test n'existe nulle part. 3 nouveaux événements fermés (`homepage_demo_prompt_seen/clicked/dismissed`) ajoutés au seul système réellement persisté (founder-access) pour la nouvelle invitation contextuelle démo — voir `DEMO_FUNNEL_EVENT_CONTRACT.md`. Un repli de capture de texte libre trouvé dans le tracker `/demo/pierre` (`DemoEventTracker.tsx`, retombait sur `textContent` brut d'un bouton) a été corrigé — seul un identifiant fermé (`data-step-id`) est désormais utilisé.

## Le funnel réellement mesuré (founder-access) s'arrête avant l'activation

`FUNNEL_DEFS` se termine à l'étape `founder_payment_completed`. L'événement `founder_subscription_active` **existe** dans la taxonomie et **est bien inséré en base** par le webhook Stripe réel, mais **n'apparaît dans aucune définition de funnel affichée au dashboard**. Le dernier maillon explicitement demandé par cet audit — "paiement → activation" — a donc une donnée serveur réelle qui existe, mais n'est représentée nulle part comme étape de funnel.

Un test anti-régression existant (`funnel-coherence.test.ts`) documente lui-même qu'un bug identique s'est **déjà produit une fois** : 4 étapes du funnel sans aucun producteur réel, non détecté par aucun test à l'époque. Motif de vigilance directement applicable ici.

## Cookies et consentement — écart texte vs code confirmé

La politique de confidentialité affirme : *"Cookies optionnels soumis au consentement lorsque la réglementation l'exige."* Aucun composant de bandeau de consentement (CMP) n'existe nulle part dans `src/app`/`src/components` (grep exhaustif = 0 résultat). Le cookie marketing `cs_conversion_session` (HttpOnly, 7 jours, porteur de campagne/cohorte/variante) est posé **inconditionnellement** à chaque visite de `/p/[token]`, y compris pour les visiteurs organiques de repli — sans aucune vérification de consentement préalable. Nuance : ce cookie sert aussi à la session technique/attribution serveur, ce qui pourrait relever d'une exemption "mesure d'audience" selon les critères CNIL réels — **non tranché ici**, signalé comme divergence code/texte, pas comme non-conformité certaine.

**Mise à jour 2026-07-24 (LEGAL AND COMMERCIAL TRUST CLOSURE)** : inventaire technique complet refait indépendamment — confirme zéro traceur tiers (analytics/pixels/A-B-testing/session-replay), 7 cookies au total dont 2 cas limites réels : `cs_conversion_session` (ci-dessus) et surtout `cs_pp_ref` (90 jours, attribution de **commission** partenaire — finalité commerciale plus difficile à faire entrer dans l'exemption "mesure d'audience" que `cs_conversion_session`). Sources officielles CNIL consultées : 21 sanctions/~32M€ cumulés en 2025 sur ce sujet précis. Décision bandeau vs. exemption renvoyée à un DPO/avocat — voir `COOKIE_AND_TRACKER_INVENTORY.md`.

## Reconstitution du funnel commercial (desktop, observation directe)

1. **Visite homepage** → CTA "Voir la démo Pierre" visible sans scroll (desktop 1440, mobile 390, tablette 820) — confirmé par capture d'écran.
2. **Clic → `/demo`** → Value-shock immédiat sur le premier écran (11h35→12min, 1,6M€/an), aucune étape intermédiaire avant la première preuve de valeur — point fort mesuré directement.
3. **Progression démo** → structure en 8 actes (barre de progression à 8 points observée) : Opening, ValueChapter, Difference, ModesChapter, System, Result, Trust, Cost. Long parcours narratif — cohérent avec la longueur déjà observée sur la homepage.
4. **Interaction calculateur de coût** → bug d'hydratation React sur les curseurs/champs numériques (voir CLONESTORE_TECHNICAL_AUDIT.md) — **investigué en profondeur le 2026-07-24** : aucune cause applicative retrouvée après recherche exhaustive dans tout le dépôt (zéro `caret-color` nulle part), cause externe par mutation DOM d'extension navigateur considérée comme hautement probable (non prouvée à 100%, Playwright indisponible). Mitigation ciblée appliquée sur les 3 seuls éléments concernés, testée (déterminisme SSR confirmé). Voir `DEMO_HYDRATION_ROOT_CAUSE_REPORT.md`.
5. **Vers Pierre / réservation / checkout** → `/agents/pierre` fonctionne bien ; son CTA d'achat par pays, initialement mort (ISSUE-02), a été **câblé le 2026-07-24** (PAYMENT PATH CLOSURE) — un visiteur suisse est désormais dirigé vers `/checkout?country=CH` avec le prix CHF résolu côté serveur (**clic réel confirmé en navigateur** sur le build de production : sélection Suisse → CTA mis à jour → navigation effective, 0 erreur console).
6. **`/paiement`** → le 500 observé a été **requalifié** (2026-07-24) : artefact d'environnement `next dev` (boucle de recompilation continue), non reproductible en build de production (200 stable, 4/4, ~25-50ms) — ce n'était pas un défaut applicatif.

## Le signal "ingénieur mobile qui scrolle toute la page sans réflexe démo"

Vérifié factuellement : le CTA "Voir la démo Pierre" **est** visible au-dessus du pli sur toutes les largeurs mobiles testées (390×844, 375×667 — quoique plus proche du bord de pli sur ce dernier). Ce n'est donc **pas** un problème de visibilité du bouton. Hypothèse la plus plausible, non confirmée : la page mobile fait **10 807 px de haut** (contre 7 250 px sur desktop 1036 px de large — pas une simple mise à l'échelle, un contenu proportionnellement plus long), et contient en son milieu une grille dense de **10 badges technologiques "Clone*"** non expliqués (CloneOS, CloneADN, CloneGuard, CloneTrace, CloneChat, CloneVoice, ClonePolicy, CloneTrust, CloneSignals, CloneLearn) qui, empilés en une seule colonne sur mobile, représentent à eux seuls une part disproportionnée du scroll. Un visiteur technique et sceptique (profil "ingénieur") pourrait précisément être du type à vouloir *lire et décoder* cette terminologie propriétaire avant de cliquer sur un CTA marketing — ce qui le maintient en mode lecture au lieu du clic, jusqu'à épuisement du scroll. **Ceci est une hypothèse à tester (ex. heatmap réel, test utilisateur), pas un fait confirmé.**

## Ce qui est solide

- Séparation client/serveur strictement appliquée sur les trois systèmes d'analytics (allowlists distinctes empêchant tout événement de paiement/activation d'être falsifié depuis une route publique).
- `founder-access` (le système réellement opérant) a un test anti-régression dédié qui vérifie qu'à chaque étape de funnel correspond un vrai producteur.

# Analytics Baseline Reconciliation

Les nombres fournis par le master prompt (~141 visiteurs, 177 passages `/demo`, 22 fins de démo
générique, 20 démarrages `/demo/pierre`, 1 fin `/demo/pierre`, 0 clic de réservation, 3 débuts de
formulaire, 1 réservation, 1 email confirmé, 0 activation commencée, 2 checkouts, 0 paiement) ne
sont **pas re-vérifiés en direct dans ce bloc** — aucun accès à une base distante n'est autorisé
(interdiction absolue), et aucune preuve de leur origine exacte (requête SQL, période, filtre)
n'a été fournie avec eux. Ce document explique **structurellement pourquoi** ce type d'écart est
plausible avec les systèmes cartographiés en Phase 1, sans confirmer ni infirmer les valeurs
elles-mêmes.

## Par valeur

| Valeur | Source probable | Explication structurelle de l'écart |
|---|---|---|
| ~141 visiteurs | `clonestore_web_sessions` (founder-access), compte de `anonymous_session_id` distincts | Une session = un cookie `cs_analytics_session` de 30 jours ; « visiteur » et « session » ne sont **pas la même définition** — un même visiteur revenant après expiration de cookie compte deux fois, jamais reconcilié aujourd'hui avec un `visitor_id` longue durée (le contrat canonique introduit précisément cette distinction, absente avant ce bloc) |
| 177 passages `/demo` | Vraisemblablement `clonestore_web_events`, événement `demo_viewed` (System A) — **pas des visiteurs uniques** | 177 > 141 est cohérent avec un compte d'**événements**, pas de visiteurs : un rafraîchissement de page, un retour arrière, ou un second passage dans la même session génère un nouvel événement `demo_viewed` à chaque fois (aucune déduplication par navigation avant ce bloc — c'est exactement le rôle du nouveau `page_view_id`) |
| 22 fins de démo générique | `demo_completed` (System A) | Probablement des **événements**, pas des `demo_run_id` uniques — le concept de `demo_run_id` n'existait pas avant ce bloc ; `DemoExperience.tsx` pouvait aussi émettre `demo_completed` plusieurs fois par session selon le chemin de navigation (triple instrumentation documentée en Phase 1, System A+B+C simultanés) |
| 20 démarrages `/demo/pierre` | `pierre_demo_started` (System A) | Vraisemblablement des **événements de clic/interaction**, pas des sessions Pierre uniques — `DemoEventTracker.tsx` déclenche sur le premier `click`/`keydown`, rejouable plusieurs fois si le composant se remonte |
| 1 fin `/demo/pierre` | `pierre_demo_completed` | Chute de 20→1 cohérente avec l'exigence réelle du code (« après 5 étapes distinctes vues » dans `DemoEventTracker.tsx`) — un taux de complétion très bas est plausible et n'indique pas nécessairement un bug de mesure, juste un funnel produit exigeant |
| 0 clic de réservation | `founder_cta_clicked`/`reservationClicked` | Si réellement 0 sur la période mesurée, cohérent avec la chute 20→1 ci-dessus : très peu de visiteurs atteignent le point où un CTA de réservation est même affiché |
| 3 débuts de formulaire | `founder_form_step1_started` (System A, SERVER_ACCEPTED côté écriture réelle) | Compte plausible d'événements réels — mais notez que `founder_form_viewed` (mount) ET `founder_form_step1_started` (premier champ touché) sont deux événements **distincts** dans la taxonomie existante ; sans savoir laquelle des deux a produit ce « 3 », le nombre n'est pas comparable sans la requête exacte |
| 1 réservation | `founder_reservation_created` (SERVER_TRUTH, table `clonestore_founder_reservations`) | **La seule valeur de cette liste qui provient presque certainement d'une vérité serveur durable et fiable** — table métier avec contrainte unique `email_normalized`, écriture fail-loud (jamais de faux succès) |
| 1 email confirmé | `founder_email_verified` (SERVER_TRUTH) | Idem — vérité serveur fiable, cohérent avec 1 réservation → 1 vérification |
| 0 activation commencée | `founder_activation_started` | Cohérent avec le funnel (aucune activation ne peut commencer sans réservation confirmée en amont, et une seule réservation existe) |
| 2 checkouts | `founder_checkout_started` (System A) — **collision de nom documentée en Phase 1** | Ce nom est utilisé à la fois pour une simple **vue de page** `/checkout` (`PresencePing`, se déclenche même sans action) et pour un signal d'action réelle (`ActivatePierre.tsx`, après obtention d'une URL Stripe) — sans savoir laquelle des deux définitions a produit ce « 2 », le nombre mélange potentiellement une vue de page et une intention réelle de payer |
| 0 paiement | `founder_payment_completed` (SERVER_TRUTH, webhook Stripe signé) | Vérité serveur fiable si effectivement 0 — cohérent avec l'absence d'activation |

## Réponses aux questions structurelles posées par le master prompt

- **Pourquoi `/demo` peut afficher 177 alors que le site affiche 141 visiteurs ?** Parce que 177
  est très probablement un compte d'**événements** (`demo_viewed`, ré-émis à chaque navigation/
  retour) quand 141 est un compte de **sessions** — deux dénominateurs différents, jamais
  comparables directement avant l'introduction de `page_view_id`/`visitor_id` par ce bloc.
- **Les 22 fins de démo sont-elles des événements ou des runs uniques ?** Vraisemblablement des
  événements — le concept de run unique (`demo_run_id`) n'existait pas avant ce bloc.
- **Les 20 débuts Pierre sont-ils des sessions ou des clics ?** Vraisemblablement des clics/
  interactions (voir ligne du tableau ci-dessus), pas des sessions Pierre uniques.
- **Pourquoi 3 formulaires commencés peuvent mener à une seule réservation ?** Deux événements
  distincts existent pour "vu"/"commencé" côté formulaire ; sans requête exacte, impossible de
  distinguer laquelle est comptée — mais un taux d'abandon élevé entre "formulaire commencé" et
  "réservation server-side" est en soi plausible et non anormal.
- **D'où viennent les 2 checkouts ?** D'une collision de nom entre une simple vue de page et une
  action réelle (voir tableau) — ambiguïté structurelle documentée, pas résolue rétroactivement.
- **Le trafic interne ou les tests sont-ils inclus ?** Aucune classification de trafic
  (`traffic_class`) n'existait avant ce bloc — impossible de confirmer que ces chiffres excluent
  le trafic interne/QA. Probable qu'ils ne l'excluent PAS, puisque le mécanisme n'existait pas.

## Backfill

**Aucun backfill n'est effectué.** Aucune des conditions requises (identité source déterministe,
mapping garanti sans double conversion, sémantique identique à l'ancien système) n'est remplie
pour transformer rétroactivement ces événements legacy en lignes `clonestore_analytics_events_v1`
— notamment parce que `visitor_id`/`page_view_id`/`demo_run_id` n'existaient tout simplement pas
au moment où ces événements ont été produits, et ne peuvent pas être reconstruits après coup sans
inventer une donnée qui n'a jamais existé.

**Statut retenu pour l'historique legacy complet : `LEGACY_NON_COMPARABLE`.** Les mesures futures
partent d'une base saine (0 événement canonique au démarrage de ce bloc), sans confondre l'ancien
et le nouveau système dans un même graphique.

# Site Polish Audit — CloneStore (avant prospection)

Audit + exécution du polish commercial, visuel, responsive et fonctionnel du site
avant l'envoi de prospects. Ce document classe les routes, liste les
contradictions trouvées et décrit ce qui a été corrigé (et ce qui est
volontairement reporté, avec justification).

Statut QA à la livraison : **tsc 0 · next build 0 · tests ciblés verts**
(public-funnel/visual-qa golive06/07, presentation-demo phase-f, checkout,
billing, profile cockpit audit, paid-customer E2E, tech02, + nouveaux tests de
non-régression `site-polish-prospection`).

---

## 1. Inventaire & classification des routes

Légende verdict : **PRÉSERVÉ** (récent/fort, intouché ou quasi) · **POLI**
(corrigé sans refonte) · **RECONSTRUIT** · **VERROUILLÉ** · **REDIRIGÉ** ·
**À SURVEILLER** (hors scope de cette passe, recommandation).

### Pages publiques

| Route | Fonction | État initial | Verdict |
|---|---|---|---|
| `/` (home) | Accroche + sections vision | Récent/fort, mais débordement mobile du H1 | **POLI** (titre hero responsive) |
| `/agents` (boutique) | Catalogue employés IA | Grille de 8 « faux produits », Clara visible, prix en dur, bouton « Question » répété | **RECONSTRUIT** |
| `/agents/[slug]` | Fiche employé générique | **Notes internes de conception visibles par les prospects** | **REDIRIGÉ** vers `/agents` |
| `/agents/pierre` | Fiche Pierre | Fort, bon positionnement, prix en dur `449€/mois` | **POLI** (prix source unique, CTA réservation) |
| `/agents/clara` | Ancienne fiche Clara | Vieille page, sur-vendue (scoring, DNS, ATS, « 5 employés ») | **REDIRIGÉ** (retiré du public) |
| `/agents/emma` `/agents/alex` `/agents/noah` | Anciennes fiches | Vieilles pages clientes dupliquées | **REDIRIGÉ** |
| `/demo` `/demo/pierre` | Présentation immersive / démo interactive | Récents/très forts (intouchables) | **PRÉSERVÉ** |
| `/assistant` (CloneChat) | Produit chat non terminé | Visuellement parfait, accessible sans blocage | **VERROUILLÉ** (page intacte, produit bloqué serveur+API) |
| `/questions` | Support / FAQ | Correct | PRÉSERVÉ |
| `/diagnostic-rh` | Diagnostic RH | Correct (form) | PRÉSERVÉ |
| `/reserver/pierre` | Tunnel de réservation fondateur | Récent/fort | PRÉSERVÉ |
| `/activate/pierre` `/checkout` `/paiement*` | Paiement/activation | Récents, testés | PRÉSERVÉ |
| `/legal/*` (cgu, cgv, dpa, mentions, confidentialite) | Pages légales | Sobres mais valides | PRÉSERVÉ |
| `/login` `/signup` | Auth | Corrects | PRÉSERVÉ |
| `/healt` (typo) `/test-pierre` | Artefacts dev/health | Visibles publiquement | **À SURVEILLER** (noindex/retrait recommandé) |
| `/clonestore/[slug]`, `/p/[token]`, `/r/[token]` | Pages dynamiques | Hors scope | À SURVEILLER |

### Espace connecté

| Route | Fonction | État | Verdict |
|---|---|---|---|
| `/profile` (Mon CloneStore) | Compte/organisation/employés/facturation | Récent/fort (phase-2), reste accessible sans employé | PRÉSERVÉ |
| `/profile/messages` (Messagerie) | Centre de messages (espace opérationnel) | Récent/fort, mais accessible sans employé actif | **VERROUILLÉ** (garde serveur + écran premium) |
| `/profile/agents` | Cockpit liste employés | Récent/fort | PRÉSERVÉ (sticky réparé globalement) |
| `/profile/onboarding` `/technologies` `/go-live` `/launch-readiness` | Sous-espaces | Récents | PRÉSERVÉ |
| `/agents/pierre/use` (Cockpit Pierre) | Espace de travail Pierre | Client, **enforcement serveur déjà présent** (`hasPierreAccess` → 403) + AuthGate | PRÉSERVÉ (enforcement conservé) |
| `/agents/pierre/setup` `/employees` `/agents/[slug]/use` | Sous-espaces cockpit | Gated API | PRÉSERVÉ |

### Interne / fondateur (hors scope prospection)

`/founder`, `/internal/[slug]/command-center(+/readiness)`, `/founding-partners/*`
— univers internes, fail-closed, déjà durcis. **NON TOUCHÉS.**

---

## 2. Contradictions & incohérences trouvées

1. **Notes internes visibles par les prospects** dans `/agents/[slug]` :
   « La page doit inspirer confiance… », « cette fiche doit rester honnête… »,
   « Référence affichée côté parcours », « Cette fiche doit nourrir la vision
   produit sans mentir… ». → **éliminées** (page redirigée).
2. **Clara sur la surface publique** (boutique + fiche dédiée sur-vendue). →
   **retirée** (redirection propre).
3. **Employés non validés présentés comme réels** (Alex, Noah, Adrien). →
   retirés ; seuls Pierre (actif) + Emma/Lucas/Sophie (à venir, validés dans la
   feuille de route `employee-registry`) restent.
4. **Prix recopié en dur dans plusieurs composants** avec formats divergents
   (`449€/mois`, `449 €/mois`, `449 € HT/mois`). → **source unique** lue depuis
   `commercial-state` via `public-catalog`.
5. **Statut Pierre incohérent** entre surfaces (« en construction » / « bientôt »
   / « achetable »). → un seul statut commercial : **actif**, avec un CTA
   *phase-aware* (réservation avant lancement, activation après).
6. **CloneChat utilisable en production** alors que le produit n'est pas prêt. →
   bloqué réellement.
7. **`position: sticky` cassé partout** (sidebars qui ne suivent pas le scroll) à
   cause de `body { overflow-y: auto }` (+ `overflow-x: hidden` qui force
   `overflow-y` à `auto`) → le `<body>` devenait un conteneur de scroll. →
   **corrigé à la racine.**
8. **Bouton « dark » illisible sur le thème graphite** (texte sombre sur fond
   sombre, `color:#151923`). → corrigé (texte clair).
9. **Débordement horizontal du titre hero sur mobile** (`clamp(3.8rem,…)` : le
   plancher 3.8rem dépasse 320–375px avec `white-space: nowrap`). → corrigé.

---

## 3. Source de vérité commerciale unique

`src/lib/catalog/public-catalog.ts` — **nouveau**. Centralise nom, slug, métier,
description courte, blocs de travail, statut, prix (lu depuis
`commercial-state`), CTA d'activation *phase-aware*. Surface publique :

- **Pierre** — `active` — « Employé IA RH opérationnel » — prix `449 € HT/mois`.
- **Emma / Lucas / Sophie** — `coming_soon` — cartes courtes (nom, métier, blocs).
- **Clara / Alex / Noah / Adrien** — `RETIRED_PUBLIC_SLUGS` (redirigés).

`agent-catalog.ts` (legacy) est conservé pour les surfaces connectées qui le
référencent encore (profil) — non utilisé par la surface publique.

---

## 4. Positionnement Pierre

Verrouillé comme **employé IA RH opérationnel** (jamais « assistant »). Vocabulaire
public : mission, exécution, suivi, validation, traçabilité, continuité. La fiche
`/agents/pierre` était déjà conforme : polie (prix source unique + CTA
réservation), non reconstruite (page forte → non dégradée).

---

## 5. Blocage CloneChat (page intacte, produit bloqué)

- `src/lib/features/product-availability.ts` — flag serveur `isCloneChatEnabled()`
  (désactivé par défaut ; activable via `CLONECHAT_ENABLED=true`, une seule var).
- `src/app/assistant/layout.tsx` — **layout serveur** : quand désactivé, rend un
  écran « bientôt disponible » premium et **ne monte jamais la page**. La page
  `src/app/assistant/page.tsx` est **strictement intacte** (design/textes/
  animations/composants inchangés), prête à être réactivée.
- `src/app/api/assistant/route.ts` — **503** quand désactivé (GET + POST) :
  l'API ne peut pas être utilisée en direct, URL ou bouton contournés.
- Les boutons « CloneChat » restent visibles (vision produit) ; un clic mène à
  l'écran verrouillé.

---

## 6. Matrice d'accès (espaces opérationnels)

Contrôle **serveur** (masquer un bouton ne protège rien) :

| État utilisateur | Mon CloneStore `/profile` | Messagerie `/profile/messages` | Cockpit Pierre `/agents/pierre/use` |
|---|---|---|---|
| Non connecté | garde auth → login | garde auth (client) | garde auth → login |
| Connecté, **sans** employé actif | **accessible** (compte/orga/facturation/installation) | **écran verrouillé premium** (« s'active avec votre premier employé IA ») | enforcement API 403 + AuthGate (login/retry/retour) |
| Connecté, **Pierre actif** | accès complet | accès complet | accès complet |

- `src/lib/access/operational-access.ts` — résolveur serveur centralisé
  (`unauthenticated` / `no_employee` / `active`), basé sur `hasPierreAccess`.
- `src/components/site/AccessLockScreen.tsx` — écran verrouillé premium réutilisable.
- Messagerie verrouillée via **layout serveur** (la page lourde de 280 Ko n'est
  jamais montée pour un compte sans employé) — sans la dégrader.

---

## 7. Responsive & CSS (corrigés à la racine)

- **Sticky réparé globalement** : `body` n'est plus un conteneur de scroll
  (`overflow-x: clip`, plus de `overflow-y: auto`) dans `globals.css` (3
  occurrences dupliquées) et `appearance.css` → les sidebars `position: sticky`
  suivent désormais le scroll desktop.
- **Hero home** : `font-size: clamp(2.1rem, 6.2vw, 5.95rem)` → plus de débordement
  horizontal sur 320–430px, taille premium conservée sur desktop.
- **Bouton graphite** : texte clair restauré (contraste).

Un test de non-régression interdit la réintroduction d'un `body` scroll-container
et du contraste cassé (`site-polish-prospection.test.ts`).

---

## 7bis. PASSE 2 — exécution des points initialement reportés (avec QA visuelle réelle)

Inspection visuelle réelle via navigateur (Playwright) + correctifs de cause.

**Débordement mobile RÉEL trouvé à l'inspection (invisible en analyse statique) :**
`.clone-home-screen { content-visibility: auto; contain-intrinsic-size: 860px/720px }`
forçait une **largeur intrinsèque** de 720px aux sections → tout le contenu de la
home était rogné sur mobile. Corrigé (`content-visibility: visible`). Mesure
après correctif : `scrollWidth === viewport` sur 320/360/375/768 (plus aucun
débordement). Captures : `docs/qa-screenshots/home-375-fixed.jpeg`, `home-1440.jpeg`.

**Catalogue — Pierre seul nommé :** Emma/Lucas/Sophie retirés de la surface
publique (non validés commercialement). La boutique présente Pierre + une section
**futurs métiers GÉNÉRIQUES, sans nom/prix/date** (Support, Finance,
Administration, Opérations). Double source supprimée : `agent-catalog.ts` réduit à
Pierre uniquement → toutes les surfaces connectées cessent d'afficher des employés
non validés. Capture : `docs/qa-screenshots/agents-375.jpeg`.

**App shell unifié (VÉRIFIÉ) :** une seule sidebar gauche permanente desktop
(sticky, hauteur viewport, scroll interne, groupes Organisation/Opérations/
Configuration/Compte, état actif) + vrai drawer mobile (Échap, clic extérieur,
focus, scroll-lock, porté sur `document.body` pour passer au-dessus du header).
Remplace l'ancienne barre de pills. `src/components/app/AppShell.tsx` +
`profile/layout.tsx`. Captures : `docs/qa-screenshots/shell-1440.jpeg`,
`shell-375-drawer2.jpeg`.

**Mon CloneStore :** rail concurrent supprimé (la page passe en colonne unique +
onglets horizontaux → plus de double sidebar) ; état vide premium quand aucun
employé actif (organisation prête / découvrir Pierre / démo / installer — sans
fausse mission ni fausse validation ; les métriques restent des comptes réels).

**Machine à états d'accès (7 états) :** `src/lib/access/operational-access.ts` —
anonymous / authenticated_without_employee / payment_pending / activation_pending /
employee_active / subscription_suspended / subscription_ended_readonly. Gardes
serveur sur messagerie ET cockpit Pierre. `payment_pending`/`activation_pending`
affichent un écran « activation en cours » (jamais un faux cockpit) → le flux
Stripe post-paiement n'est pas cassé. `active`/`trialing` conservent l'accès exact.

**Fiche Pierre reconstruite :** version premium plus dense visuellement mais plus
courte (5351px vs 6789px sur mobile, −21%) : promesse, mission VISUELLE en 6 étapes
(demande→mission→travail→validation→suivi→trace), blocs de travail, exécute vs
valide, Empreinte Entreprise, gouvernance, tarif. Listes interminables et
répétitions supprimées. Captures : `docs/qa-screenshots/pierre-375-new.jpeg`.

**Routes techniques :** `/test-pierre` → `notFound()` en production + noindex ;
`/healt` → noindex.

**CloneChat lock (VÉRIFIÉ) :** écran « bientôt disponible » premium rendu, page
source intacte. Capture : `docs/qa-screenshots/clonechat-lock-375.jpeg`.

**Pages publiques sans débordement (mesuré, 320→768) :** `/`, `/agents`,
`/agents/pierre`, `/questions`, `/diagnostic-rh`, `/checkout` →
`scrollWidth === viewport` (seuls éléments « hors cadre » = halos décoratifs
`pointer-events:none`, clippés, sans scroll).

**Limite honnête de la QA visuelle :** les pages connectées authentifiées
(`/profile`, `/profile/messages`, cockpit) redirigent vers `/login` sans session
Supabase, indisponible dans ce bac à sable. Le shell connecté a été prouvé via une
route d'aperçu temporaire (supprimée) ; les écrans verrouillés réutilisent le même
composant `AccessLockScreen` que le lock CloneChat (prouvé visuellement). Les états
authentifiés sont validés par tsc + build + tests. Captures : `docs/qa-screenshots/`.

## 7ter. PASSE 3 — consolidation de l'espace connecté (avec QA réelle des états)

**Un seul app shell pour TOUT l'espace connecté.** `OperationalRouteShell`
(server) = app shell unifié + verrou. Routes désormais sous le MÊME shell que
`/profile` : `/agents/pierre/use`, `/agents/pierre/setup`,
`/agents/pierre/employees` (layouts dédiés). La sidebar/le drawer ne disparaissent
plus en passant de Mon CloneStore au cockpit / messagerie / config / Employé 360.
Vérifié : `docs/qa-screenshots/cockpit-locked-1440.jpeg`, `messages-locked-1440.jpeg`.

**Navigation unique (header public masqué).** `src/lib/nav/connected-routes.ts`
(`isConnectedRoute`) ; `SiteHeader` retourne `null` sur les routes connectées →
plus de double hamburger ni de header public empilé. L'app shell fournit l'accès
au logo, à « Retour au site » et à « Se déconnecter ». Vérifié mobile (un seul
menu, un seul drawer au-dessus de tout) : `cockpit-locked-375.jpeg`,
`cockpit-drawer-375.jpeg`, `cockpit-locked-768.jpeg`.

**Source canonique « Pierre actif ».** `resolveOperationalAccess` délègue la
décision d'accès à `hasPierreAccess` (le primitive existant, commande
active/trialing) — pas de logique commerciale concurrente. Le statut de commande
ne sert qu'à distinguer les sous-états verrouillés (paiement / activation /
suspendu / terminé). `subscription_ended_readonly` renommé honnêtement en
`subscription_ended` (pas de fausse « lecture seule »).

**Mécanisme de test des états connectés (sûr).** Override serveur
`E2E_OPERATIONAL_STATE` (lu par `resolveOperationalAccess`) + bypass d'auth client
`NEXT_PUBLIC_E2E_BYPASS_AUTH` (`src/lib/auth/dev-bypass.ts`). **Tous deux gardés
par `NODE_ENV !== "production"`** → code MORT dans un build de production, jamais
activable par un visiteur. A permis de rendre et capturer les vrais états
connectés (cockpit/messagerie verrouillés, drawer) sur les vraies routes.

**Cockpit « double rail » :** le rail interne du workspace cockpit n'apparaît que
pour un utilisateur RÉELLEMENT actif (avec données). Dans tous les états
rendables (verrouillé / non-activé), le cockpit affiche UNE seule sidebar (l'app
shell) — vérifié. Le workspace actif (rail de tâches) reste une navigation de
contenu, distincte de la navigation applicative.

## 7quater. PASSE 4 — acceptation finale (double-rail + états réels)

**Double-rail du cockpit actif CORRIGÉ.** Dans `PierreCockpitShell`, le rail
vertical interne (`LeftRail`, aside 220px) est **supprimé** et remplacé par une
**barre d'onglets horizontale** (`WorkspaceTabBar`, scrollable, `role=tablist`).
Résultat : une **seule** navigation latérale principale (l'app shell global) +
des onglets de contenu pour les espaces de travail. Vérifié visuellement avec un
cockpit actif rendu : `docs/qa-screenshots/cockpit-active-1440.jpeg`,
`cockpit-active-1024.jpeg`, `cockpit-active-390.jpeg` (mobile : un seul
hamburger/drawer + barre d'onglets basse, jamais un second drawer).

**Mécanisme de rendu des états réels (sûr, NODE_ENV-gated).** `usePierreCockpit`
et la page cockpit honorent `isAuthBypassEnabled()` (rend le workspace sans
verrou) ; `resolveOperationalAccess` lit aussi un cookie `e2e_operational_state`
(prioritaire sur l'env) → bascule d'état sans redémarrer. **Tout est gardé par
`NODE_ENV !== "production"`** (mort en production).

**4 états intermédiaires capturés** : `state-payment-pending-1440.jpeg`,
`state-activation-pending-1440.jpeg`, `state-suspended-1440.jpeg`,
`state-ended-1440.jpeg` — écrans « en cours » / « terminé », jamais un faux
cockpit, CTA vers des routes réelles.

**Chemin Stripe prouvé par tests** (142) : `founder-stripe-webhook-post-er3`,
`go-live-08-paid-customer-testmode-e2e`, `billing/activation`, `checkout-helpers`.

**Limites honnêtes (sandbox).** Le cockpit actif est rendu avec des **données
vides** (« Aucune mission active ») : un cockpit peuplé (3 missions, 2 validations,
2 salariés, 1 doc) exige une **session Supabase réelle + un runtime v1 seedé**,
indisponibles ici. Créer les comptes A/B réels et exécuter un **parcours Stripe
test live** (checkout → webhook → activation) sont des **étapes opérateur**
(clés Stripe test + endpoint webhook + DB), hors de portée de ce bac à sable. La
preuve fournie : structure rendue de tous les états + suite de tests du chemin.

## 8. Reste honnêtement à faire (suivi)

Les items de la passe 1 (app-shell, verrou cockpit, Clara connecté, test-pierre,
sweep visuel) sont désormais LIVRÉS (cf. §7bis). Restent, sans bloquer la
prospection :

1. **QA visuelle des pages AUTHENTIFIÉES** (`/profile`, messagerie, cockpit avec
   session) : non exécutable ici (pas de session Supabase dans le bac à sable).
   Validées par tsc + build + tests + aperçu temporaire du shell.
2. **Cockpit Pierre — rail interne du workspace** : conservé (navigation de tâches
   propre à l'outil, distincte de la nav applicative de la sidebar). Non considéré
   comme un « rail concurrent ».
3. **Mode lecture seule réel** pour `subscription_ended_readonly` : actuellement un
   écran « réactiver » (le vrai read-only des données est un chantier dédié,
   « juridiquement et techniquement prévu »).

---

## 9. Fichiers principaux

**Nouveaux** : `src/lib/catalog/public-catalog.ts`,
`src/lib/features/product-availability.ts`,
`src/lib/access/operational-access.ts`,
`src/components/site/AccessLockScreen.tsx`,
`src/app/assistant/layout.tsx`, `src/app/profile/messages/layout.tsx`,
`src/app/__tests__/site-polish-prospection.test.ts`, ce document.

**Modifiés** : `src/app/agents/page.tsx` (reconstruit),
`src/app/agents/[slug]/page.tsx` (redirigé),
`src/app/agents/{clara,emma,alex,noah}/page.tsx` (redirigés),
`src/app/agents/pierre/page.tsx` (poli),
`src/app/api/assistant/route.ts` (garde 503),
`src/app/globals.css` + `src/app/styles/appearance.css` (overflow/sticky/contraste),
`src/app/page.tsx` (hero responsive).

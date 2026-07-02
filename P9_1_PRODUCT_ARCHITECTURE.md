# P9.1 — Architecture Produit & Découverte Guidée

> Phase **P9.1** — Fondations produit et UX définitives de CloneStore **avant**
> toute refonte des cockpits, de la messagerie, de l'empreinte, de CloneChat ou
> de CloneVoice. Ce document **cartographie** l'existant, **clarifie** les
> responsabilités de chaque espace et **prépare** les contrats UX des phases
> suivantes. Il ne lance **aucune** refonte. La homepage et les pages publiques
> restent visuellement intactes (hors onboarding actif).

Statut : **fondation posée**. P9.2 pourra démarrer sur des espaces séparés, des
responsabilités définies, un registre de navigation central et un moteur de
guided onboarding réutilisable et testé.

---

## 1. Vue d'ensemble des espaces

CloneStore se décompose en **sept espaces produit**, plus un univers
institutionnel isolé (CloneStory / Partenaires Fondateurs) qui reste hors du
périmètre de refonte P9.

| # | Espace | Rôle | Audience | Refonte future |
|---|--------|------|----------|----------------|
| 1 | **Site public** | Vendre, expliquer, convertir | Visiteur anonyme | — (validé) |
| 2 | **Guided discovery** | Faire comprendre l'essentiel en < 1 min | Visiteur anonyme | P9.1 (ce livrable) |
| 3 | **My CloneStore** | Espace du client (compte, employés, facturation) | Client authentifié | P9.2 |
| 4 | **Cockpit opérationnel client** | Piloter les employés IA, valider, suivre | Client authentifié actif | P9.2+ |
| 5 | **Cockpit Production** | Exploitation interne CloneStore | Interne (owner/allowlist) | hors P9 |
| 6 | **CloneChat** | Point de contact conversationnel | Public / client | P9.2+ |
| 7 | **CloneVoice** | Couche vocale **de** CloneChat | Client (futur) | ultérieure |
| — | *CloneStory (Partenaires Fondateurs)* | Univers institutionnel séparé | Public gated | hors P9 |

Registre machine correspondant : [`src/lib/nav/route-registry.ts`](src/lib/nav/route-registry.ts)
(`ProductSpace`), source de vérité centrale pour labels, audience, statut et
phase future.

---

## 2. Détail des espaces

### 2.1 Site public

- **Objectif** : présenter CloneStore, ses employés IA, Pierre, les technologies,
  la démonstration, la tarification, la sécurité, et convertir (réservation /
  paiement).
- **Utilisateurs** : visiteurs non authentifiés.
- **Routes principales** : `/`, `/agents`, `/agents/pierre`, `/demo`,
  `/demo/pierre`, `/reserver/pierre`, `/checkout`, `/login`, `/signup`,
  `/questions`, `/diagnostic-rh`, `/legal/*`.
- **Lui appartient** : discours commercial, catalogue public, fiches produit,
  démonstration fictive, tunnel de réservation/paiement, contenu légal.
- **Ne lui appartient pas** : données client réelles, cockpit, missions,
  messagerie, exploitation interne.
- **Liens** : mène vers la démo, la boutique, la réservation ; après connexion,
  vers **My CloneStore**.
- **Statut** : **design validé — aucune refonte P9.1**. Seules des cibles
  invisibles `data-tour-id` ont été ajoutées à la homepage (voir §5).

### 2.2 Guided discovery (public)

- **Objectif** : onboarding **public facultatif** — expliquer en quelques
  secondes ce qu'est CloneStore, où découvrir les employés IA, ce que fait
  Pierre, ce qu'est CloneChat, la démo, et ce qu'on obtient une fois client.
- **Utilisateurs** : visiteurs première visite (proposition non intrusive).
- **Implémentation** : ce n'est **pas une route** mais un **overlay global**
  (provider + portail vers `<body>`) qui recouvre la homepage sans la modifier.
- **Lui appartient** : le moteur de tour réutilisable et le tour public
  (6 étapes + étape finale d'action).
- **Ne lui appartient pas** : la modification du layout des pages, tout tunnel
  commercial bloquant.
- **Détail complet** : §4 (moteur) et §5 (tour public).

### 2.3 My CloneStore (espace client)

- **Objectif** : espace unique du client — catalogue acheté, employés possédés,
  missions, messages, documents, équipe, facturation, paramètres, onboarding.
- **Utilisateurs** : clients authentifiés.
- **Routes** : `/profile` (+ onglets : overview, account, company, billing,
  employees, technologies, footprint, privacy, notifications, appearance),
  `/profile/agents`, `/profile/messages`, `/profile/onboarding`,
  `/profile/technologies`, `/profile/launch-readiness`, `/profile/go-live`.
- **Shell** : `AppShell` (sidebar + drawer mobile) via `profile/layout.tsx`
  (garde serveur `resolveOperationalAccess`).
- **Lui appartient** : identité entreprise, gestion du compte, facturation,
  liste des employés possédés, empreinte entreprise, préférences.
- **Ne lui appartient pas** : l'exécution opérationnelle fine (missions en
  cours, validations) → **Cockpit opérationnel client** ; l'exploitation
  système → **Cockpit Production**.
- **Refonte** : **P9.2** (contrats UX préparés ici, §6).

### 2.4 Cockpit opérationnel client

- **Objectif** : activité des employés IA, validations, missions, résultats,
  documents, incidents nécessitant l'attention du client.
- **Utilisateurs** : clients **actifs** (abonnement `active`/`trialing`).
- **Routes** : `/agents/pierre/use` (cockpit), `/agents/pierre/setup`
  (configuration), `/agents/pierre/employees` (Employé 360).
- **Shell** : `OperationalRouteShell` (AppShell + verrou d'accès selon l'état).
- **Lui appartient** : missions, tâches, statuts, validations humaines,
  livrables, incidents opérationnels.
- **Ne lui appartient pas** : facturation/compte (→ My CloneStore),
  santé système/tenants (→ Cockpit Production).
- **Refonte** : **P9.2+**.

### 2.5 Cockpit Production CloneStore

- **Objectif** : exploitation interne — santé système, providers, workers,
  tenants, incidents, audit, déploiements.
- **Utilisateurs** : interne (owner-gate + allowlist).
- **Routes** : `/founder`, `/internal/[slug]/command-center`,
  `/internal/[slug]/command-center/readiness`.
- **Lui appartient** : observabilité, exploitation, décisions d'activation.
- **Ne lui appartient pas** : tout ce qui est visible du client.
- **Périmètre** : **hors P9** — appartient largement à la lane **P8**
  (migrations, rôles, webhooks, workers). **Non touché par P9.1.**

### 2.6 CloneChat

- **Objectif** : interface conversationnelle — consultation, orientation,
  analyse, création de mission, exécution gouvernée, validations, résultats.
- **Utilisateurs** : public (orientation) et client (opérationnel).
- **Route** : `/assistant`.
- **État actuel** : **verrouillé serveur** par feature flag
  (`isCloneChatEnabled`, off par défaut) — la page reste intacte, l'API renvoie
  503, le layout affiche un écran d'accès premium. **Non modifié par P9.1.**
- **Refonte** : **P9.2+**.

### 2.7 CloneVoice

- **Objectif** : couche **vocale de CloneChat** — parler naturellement à
  CloneStore, futur mode copilote vocal.
- **Principe structurant** : CloneVoice **n'est pas** un système parallèle
  indépendant ; c'est une modalité de CloneChat.
- **État** : non implémentée en tant qu'espace ; présente comme technologie sur
  la homepage. Aucune route dédiée. Aucune action P9.1.

### 2.8 CloneStory — Partenaires Fondateurs (isolé)

- Univers institutionnel séparé (`/founding-partners/*`). Documenté pour
  éviter toute confusion produit. **Hors périmètre de refonte P9** et régi par
  ses propres règles (voir mémoire projet CloneStory).

---

## 3. Liens entre espaces (parcours cible)

```
Anonyme ─▶ Site public ─▶ (Guided discovery en surimpression)
             │  ├─▶ Démo (/demo/pierre)
             │  ├─▶ Boutique (/agents ─▶ /agents/pierre)
             │  ├─▶ CloneChat (/assistant)  [gated flag]
             │  └─▶ Réserver / Payer (/reserver/pierre, /checkout)
             ▼
        Connexion (/login, /signup)
             ▼
     My CloneStore (/profile)  ──▶  Cockpit opérationnel client (/agents/pierre/use)
             │                            │
             └────────────── AppShell (sidebar unique) ──────────────┘

Interne ─▶ Cockpit Production (/founder, /internal/[slug]/command-center)   [isolé]
```

Le **contrat de navigation** central ([`route-registry.ts`](src/lib/nav/route-registry.ts))
+ le contrat connecté existant ([`connected-routes.ts`](src/lib/nav/connected-routes.ts))
gouvernent : header public (se masque sur l'espace connecté), AppShell (nav
unique connectée), et — à terme — breadcrumbs, permissions, labels, tour
cross-page, analytics, prévention des doublons.

---

## 4. Moteur de guided onboarding (réutilisable)

### 4.1 Principe

Un moteur **générique**, monté une seule fois dans le layout racine, qui joue
des tours **par-dessus** les pages existantes sans les redessiner. Cœur en
**TypeScript pur** (testable en environnement `node`, sans jsdom) + fine couche
React qui porte l'UI dans un **portail vers `<body>`**.

### 4.2 Cœur pur — `src/lib/guided-tour/`

| Module | Rôle |
|--------|------|
| [`types.ts`](src/lib/guided-tour/types.ts) | Tour, TourStep, placements, état, géométrie |
| [`tour-machine.ts`](src/lib/guided-tour/tour-machine.ts) | Réducteur déterministe (start/next/prev/goTo/skip/complete/stop) + sélecteurs. Aucune boucle. |
| [`positioning.ts`](src/lib/guided-tour/positioning.ts) | Placement de carte (préféré + **repli** haut/bas/gauche/droite/centre), spotlight, ancre du pointeur |
| [`target-resolver.ts`](src/lib/guided-tour/target-resolver.ts) | Résolution par `data-tour-id` **uniquement** (pas de sélecteur fragile) |
| [`progress-storage.ts`](src/lib/guided-tour/progress-storage.ts) | Persistance **versionnée** injectable (localStorage / faux store), reprise, proposition |
| [`tour-registry.ts`](src/lib/guided-tour/tour-registry.ts) | Registre des tours |
| [`registry/public-discovery-tour.ts`](src/lib/guided-tour/registry/public-discovery-tour.ts) | Le tour public + copy + invitation |

### 4.3 Couche React — `src/components/guided-tour/`

| Composant | Rôle |
|-----------|------|
| `GuidedTourProvider` | Orchestrateur : machine, mesure de cible (attente d'apparition, cible absente → repli centré), scroll doux, recalcul scroll/resize, cross-route, clavier (Escape / flèches), persistance, invitation, reprise, `prefers-reduced-motion` |
| `GuidedTourPortal` | Portail `createPortal` vers `document.body` (`display:contents`), rien avant hydratation |
| `GuidedTourOverlay` | 3 couches : **block** (capte les clics), **scrim** (flou + teinte, avec **trou doux** laissant la cible nette), **ring** (liseré premium) |
| `GuidedTourPointer` | Curseur **SVG premium** (graphite + accent violet) avec halo qui respire — pas d'emoji |
| `GuidedTourCard` | Bulle de texte (dialog, focus + focus-trap Tab), se positionne via la géométrie pure |
| `GuidedTourControls` | Points de progression, précédent/suivant, passer/terminer, actions d'étape |
| `GuidedTourWelcome` | Invitation discrète (offer / resume), non intrusive |
| `useGuidedTour` | Hook public réutilisable (démarrer/piloter un tour depuis n'importe quel composant) |

### 4.4 Comportements couverts

Ouverture / fermeture / suivant / précédent / skip / completion / **persistance**
/ **reprise cross-route auto** (après refresh, à l'étape exacte, sur toute page)
/ **versionnement** (v2 ⇒ ancienne progression single-page invalidée) / cible
trouvée / **cible absente** (repli centré) / **cible chargée avec délai** (polling
+ timeout) / **cross-route réel** (6 routes traversées) / **identité de résolution
anti stale-step** / **auto-scroll intelligent** (skip si déjà visible, header pris
en compte) / **positionnement + repli** (source unique carte+pointeur) /
**resize** / **mobile** / **Escape / flèches / Tab / Shift+Tab (wrap 2 sens)** /
**focus initial sauvegardé + restauré** (repli déterministe si nœud détaché) /
**inert + aria-hidden réversibles** sur l'arrière-plan / **reduced-motion**
(animations décoratives coupées) / **snooze « Plus tard »** (24 h, pas un skip) /
**cleanup des écouteurs** / **aucune modification permanente** après fermeture
(portail démonté, aucun `inert`/`aria-hidden`/scroll-lock résiduel).

### 4.4bis Transitions (anti-flash)

À chaque changement d'étape : l'ancienne carte/pointeur **sortent** en fondu
(`AnimatePresence mode="wait"`, states `exit`), l'UI est **masquée** pendant la
navigation/résolution (verrou `resolved` par identité), puis la nouvelle carte /
pointeur / liseré **entrent** une fois la cible résolue. Aucun saut brutal, aucun
usage du rectangle de l'étape précédente.

### 4.5 Expérience visuelle

Fond réel visible et **flouté** ; cible **mise en lumière** (trou doux, liseré) ;
texte au-dessus ; **pointeur** SVG ; transitions fluides (framer-motion, courbe
`cubic-bezier(0.22,1,0.36,1)` du site) ; aucun saut brutal, aucun clignotement.
Habillage **100 % tokens CloneStore** (`--cs-*`) — aucune nouvelle direction
artistique. En `prefers-reduced-motion` : révélation immédiate, halo statique.

---

## 5. Tour public de découverte (v2 — parcours MULTI-PAGE)

Le tour public **traverse réellement** six pages publiques puis revient à la
homepage pour la finale. Toutes les routes sont publiques : jamais d'espace
authentifié inaccessible au visiteur. `/assistant` reste **verrouillé** (aucune
fonctionnalité CloneChat construite) — c'est son écran public de verrouillage qui
porte la cible.

| Étape | Route | Cible (`data-tour-id`) | Élément ciblé | Preuve |
|-------|-------|------------------------|---------------|--------|
| 1 — CloneStore | `/` | `homepage-primary` | `<section id="overview">` (hero) | mp-step1-home-1440.png |
| 2 — Boutique | `/agents` | `boutique-entry` | header `<section>` boutique | mp-step2-agents-1440.png |
| 3 — Pierre | `/agents/pierre` | `pierre-page-entry` | hero `<section>` fiche Pierre | mp-step3-pierre-1440.png |
| 4 — CloneChat | `/assistant` | `clonechat-entry` | écran public de verrouillage | mp-step4-assistant-1440.png |
| 5 — Démo | `/demo/pierre` | `demo-entry` | `<main id="demo-pierre-cockpit">` | mp-step5-demo-1440.png |
| 6 — My CloneStore | `/login` | `client-space-entry` | titre `<div>` « Entrez dans… » | mp-step6-login-1440.png |
| Final | `/` (retour) | *(aucune)* | carte centrée | mp-step7-final-1440.png |

**Robustesse cross-route** : à chaque étape, `router.push(route)` puis attente de
l'apparition de la cible ; l'UI d'étape (carte/pointeur/ring) n'est rendue que
lorsque la géométrie a été résolue **pour l'étape exactement courante**
(identité de résolution `tourId:version:index`), donc **jamais** avec le
rectangle de l'étape précédente (anti stale-step, prouvé frame-par-frame). Cible
absente ⇒ repli centré. Aucune boucle.

**Déclenchement** : invitation discrète au **premier passage** sur `/` (portail,
bas de l'écran), après un court délai. **« Plus tard » = snooze temporaire (24 h)**
— aucune progression `skipped` écrite, une progression réellement commencée
reste reprenable. **Reprise cross-route automatique après refresh** (auto-resume
à l'étape exacte, sur n'importe quelle page). **Aucun gros bouton permanent** sur
la homepage. Après fermeture, la page revient exactement à son état normal
(portail démonté, focus restauré, aucun `inert`/`aria-hidden` résiduel).

**Cibles invisibles** ajoutées (zéro style, zéro layout) — une seule par page :
`homepage-primary`, `boutique-entry`, `pierre-page-entry`, `clonechat-entry`
(via prop optionnel `dataTourId` sur `AccessLockScreen`), `demo-entry`,
`client-space-entry`.

---

## 6. Fondations de l'onboarding client (contrats — P9.2)

P9.1 **ne construit pas** l'onboarding post-achat. Seuls les **contrats** sont
posés : [`src/lib/onboarding-foundations/client-onboarding-contracts.ts`](src/lib/onboarding-foundations/client-onboarding-contracts.ts)
(types uniquement, aucune UI, aucun runtime).

### Quick Start (< 5 min)
Identité entreprise minimale (nom, taille, secteur, pays) + **premier objectif**
en langage naturel → arrivée rapide dans Pierre. Contrat : `QuickStartContract`.

### Empreinte guidée
Progression claire par sections, **sauvegarde automatique**, reprise plus tard,
import, complétude, validations. Contrats : `FootprintSectionState`,
`GuidedFootprintContract`, helper pur `deriveOverallCompletion`.

### Empreinte continue
Enrichissement pendant l'usage ; informations **proposées par Pierre** ⇒
**validation humaine** ; **provenance**, historique, confiance. Contrat :
`ContinuousFootprintEntryContract` (`provenance`, `requiresHumanValidation`).

> Ces contrats s'alignent volontairement sur le vocabulaire d'empreinte existant
> (`src/lib/clonestore/onboarding`) pour éviter toute divergence en P9.2. Le
> moteur de guided tour (découverte publique) et l'onboarding client partagent le
> **principe** « progression guidée, persistée, reprenable » mais restent
> distincts.

---

## 7. Doublons, pages obsolètes ou ambiguës (constats — aucune suppression P9.1)

| Constat | Détail | Recommandation (phase future) |
|---------|--------|-------------------------------|
| Fiches employés retirées | `/agents/[slug]`, `/agents/{clara,emma,alex,noah}` → redirect stubs | Conserver comme stubs ; nettoyer quand le catalogue s'étoffera |
| Double surface de nav | `site-header` (public) vs `AppShell` (connecté) | Déjà réconciliés par `connected-routes` ; centraliser labels via `route-registry` en P9.2 |
| Cockpit vs My CloneStore | Frontière « compte » vs « opérationnel » parfois floue | Formaliser en P9.2 (voir §2.3/§2.4) |
| Routes techniques | `/healt`, `/test-pierre` (dev-only, noindex / notFound en prod) | Laisser en l'état ; ne pas exposer |
| CloneChat | Page complète mais verrouillée (flag) | Réactiver/raffiner en P9.2 |
| CloneVoice | Mentionnée mais pas d'espace | Rester une modalité de CloneChat, pas un système à part |

Aucune route n'est supprimée en P9.1 (règle absolue). Les ambiguïtés sont
**documentées**, pas résolues par une refonte.

---

## 8. Recommandations pour P9.2+

1. **My CloneStore** : refondre autour des contrats du §6 (Quick Start →
   empreinte guidée → empreinte continue), en réutilisant le principe du moteur
   de tour pour l'onboarding **client** (pas le tour public).
2. **Navigation** : migrer progressivement labels/breadcrumbs vers
   `route-registry` (sans casser les navs existantes).
3. **Cockpit opérationnel** : séparer nettement « compte » (My CloneStore) et
   « opérations » (cockpit) selon §2.3/§2.4.
4. **CloneChat / CloneVoice** : traiter CloneVoice comme une couche de CloneChat.
5. **Tours** : ajouter des tours **authentifiés** (cockpit, empreinte) via le
   même moteur — la seule nouveauté sera de nouvelles entrées de registre + des
   `data-tour-id`.

---

## 9. Fichiers P9.1 (inventaire réel)

**34 fichiers nouveaux** :
- Moteur pur : `src/lib/guided-tour/` (types, tour-machine, positioning, target-resolver, progress-storage, **a11y**, tour-registry, registry/public-discovery-tour, index).
- Couche React : `src/components/guided-tour/` (Provider, Portal, Overlay, Pointer, Card, Controls, Welcome, context, hook, css, index).
- Contrat de navigation : `src/lib/nav/route-registry.ts`.
- Fondations onboarding client (contrats seulement) : `src/lib/onboarding-foundations/client-onboarding-contracts.ts`.
- Tests (9 fichiers) : `src/lib/guided-tour/__tests__/`, `src/lib/nav/__tests__/route-registry.test.ts`, `src/lib/onboarding-foundations/__tests__/`.
- Docs : `P9_1_PRODUCT_ARCHITECTURE.md`, `P9_1_ROUTE_NAVIGATION_MATRIX.md`.

**8 fichiers existants** touchés — chirurgicalement, **impact visuel hors tour =
aucun** (montage provider + cibles `data-tour-id` invisibles + 1 prop optionnel).
Diff P9.1 prouvé absent de HEAD pour chacun ; aucune ligne P9.1 backend :
- `src/app/layout.tsx` — montage `<GuidedTourProvider>`.
- `src/app/page.tsx` — `data-tour-id="homepage-primary"`.
- `src/app/agents/page.tsx` — `data-tour-id="boutique-entry"`.
- `src/app/agents/pierre/page.tsx` — `data-tour-id="pierre-page-entry"`.
- `src/app/assistant/layout.tsx` — `dataTourId="clonechat-entry"` (passé au lock).
- `src/app/demo/pierre/page.tsx` — `data-tour-id="demo-entry"`.
- `src/app/login/page.tsx` — `data-tour-id="client-space-entry"`.
- `src/components/site/AccessLockScreen.tsx` — prop optionnel `dataTourId` (invisible).

> Correction : la version précédente affirmait « seuls layout.tsx et page.tsx
> modifiés ». Le parcours étant devenu multi-page, **8** fichiers existants sont
> touchés (une cible invisible chacun). Aucun fichier P8/backend n'est modifié.

## 10. Preuve de non-régression (baseline réelle)

Baseline avant/après produite en **révertant en place** les deux éditions de la
homepage (provider + `data-tour-id`), capture « BEFORE » (pré-P9.1), puis
restauration exacte (vérifiée par `tsc` + test de non-régression) et capture
« AFTER » (P9.1, tour inactif) — même viewport (1440×900), même navigateur, même
`reduced-motion`, mêmes délais.

**Pixel-diff objectif** : `0.1529 %` (1 982 / 1 296 000 px), **100 % localisés**
dans la zone de l'animation `CloneCoreOrbit` du hero (dots en rotation continue —
différence **temporelle**, pas P9.1). Le reste de la page est **identique au
pixel**. Fichiers : `baseline-BEFORE-prep91-1440.png`,
`baseline-AFTER-p91-idle-1440.png`, `baseline-DIFF-1440.png`.

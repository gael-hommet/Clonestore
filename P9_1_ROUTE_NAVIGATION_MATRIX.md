# P9.1 — Matrice Routes / Navigation

> Cartographie des routes de CloneStore (App Router, `src/app`). Colonnes :
> **Route**, **Espace** produit, **Accès** (public / authentifié / interne),
> **Nav principale**, **Nav secondaire**, **Owner produit**, **Statut actuel**,
> **Action recommandée**, **Phase future**.
>
> Aucune route n'est supprimée en P9.1 (règle absolue). Les stubs/redirections
> volontaires sont conservés. Le registre machine associé :
> [`src/lib/nav/route-registry.ts`](src/lib/nav/route-registry.ts) (routes
> principales) ; le contrat connecté :
> [`src/lib/nav/connected-routes.ts`](src/lib/nav/connected-routes.ts).

Légende accès : **P** public · **A** authentifié · **I** interne ·
**G** gated (droit/état/flag/phase).

---

## 1. Site public

| Route | Espace | Accès | Nav principale | Nav secondaire | Owner | Statut | Action recommandée | Phase |
|-------|--------|:----:|:--------------:|----------------|-------|--------|--------------------|:-----:|
| `/` | public | P | oui (Accueil) | rail d'ancres (overview…trust) | Marketing | active | conserver ; cibles tour ajoutées | — |
| `/agents` | public | P | oui (Employés IA) | — | Marketing | active | conserver | — |
| `/agents/pierre` | public | P | — | depuis `/agents` | Produit Pierre | active | conserver | — |
| `/agents/[slug]` | public | P | — | — | Produit | **stub** (→ `/agents`) | conserver le stub | — |
| `/agents/{clara,emma,alex,noah}` | public | P | — | — | Produit | **stub** | conserver | — |
| `/demo` | public | P | oui (Démo) | — | Marketing | active | conserver | — |
| `/demo/pierre` | public | P | — | depuis hero/fiche | Produit Pierre | active | conserver | — |
| `/reserver/pierre` | public | P·G | header (Réserver) | — | Growth | gated (phase founder) | conserver | — |
| `/activate/pierre` | public | P·G | — | email/lien | Growth | gated (fenêtre founder) | conserver | — |
| `/checkout` | public | P·G | — | depuis boutique | Billing | gated (agent+session+ordre) | conserver | — |
| `/paiement`, `/paiement/success`, `/paiement/cancel` | public | P·G | — | retour Stripe | Billing | active | conserver | — |
| `/login` | public | P | header (auth slot) | — | Auth | active | conserver | — |
| `/signup` | public | P | header (auth slot) | — | Auth | active | conserver | — |
| `/assistant` (CloneChat) | clonechat | P·G | header (CloneChat) | — | Produit CloneChat | **gated (flag off)** | réactiver/raffiner | **P9.2** |
| `/questions` | public | P | oui (Support) | footer | Support | active | conserver | — |
| `/diagnostic-rh` | public | P | — | — | Growth | active | conserver | — |
| `/legal/{cgu,cgv,confidentialite,dpa,mentions}` | public | P | — | footer | Legal | active | conserver | — |

## 2. Guided discovery (public) — parcours MULTI-PAGE (v2)

| Route/Élément | Espace | Accès | Nav principale | Nav secondaire | Owner | Statut | Action recommandée | Phase |
|-------|--------|:----:|:--------------:|----------------|-------|--------|--------------------|:-----:|
| *(overlay global, pas une route)* `#guided-discovery` | guided-discovery | P | invitation 1ʳᵉ visite | — | Produit UX | **active (P9.1)** | conserver ; étendre aux tours authentifiés | P9.2 |

Parcours réellement traversé (une cible invisible `data-tour-id` par page) :

| # | Route | `data-tour-id` | Élément ciblé |
|---|-------|----------------|---------------|
| 1 | `/` | `homepage-primary` | hero `<section id="overview">` |
| 2 | `/agents` | `boutique-entry` | header boutique `<section>` |
| 3 | `/agents/pierre` | `pierre-page-entry` | hero fiche `<section>` |
| 4 | `/assistant` | `clonechat-entry` | écran public de verrouillage (CloneChat reste verrouillé) |
| 5 | `/demo/pierre` | `demo-entry` | `<main id="demo-pierre-cockpit">` |
| 6 | `/login` | `client-space-entry` | titre `<div>` « Entrez dans… » |
| 7 | `/` (retour) | *(aucune, centré)* | finale d'action non bloquante |

Détails moteur : snooze « Plus tard » 24 h ; reprise cross-route auto après
refresh ; auto-scroll intelligent ; identité de résolution (anti stale-step) ;
focus sauvegardé/restauré (repli si nœud détaché) ; `inert`+`aria-hidden`
réversibles. Aucune page ci-dessus n'est redessinée : seule une cible invisible
est ajoutée par page.

## 3. My CloneStore (client)

| Route | Espace | Accès | Nav principale | Nav secondaire | Owner | Statut | Action recommandée | Phase |
|-------|--------|:----:|:--------------:|----------------|-------|--------|--------------------|:-----:|
| `/profile` | my-clonestore | A·G | AppShell (Mon CloneStore) | onglets internes | Produit Client | gated | refonte espace client | **P9.2** |
| `/profile/agents` | my-clonestore | A·G | AppShell (Mes employés) | — | Produit Client | gated | refonte | P9.2 |
| `/profile/messages` | my-clonestore | A·G | AppShell (Messagerie) | — | Produit Client | gated | refonte messagerie | P9.2 |
| `/profile/onboarding` | my-clonestore | A·G | AppShell (Empreinte) | — | Produit Client | gated | Quick Start/empreinte (contrats §6) | P9.2 |
| `/profile/technologies` | my-clonestore | A·G | AppShell (Technologies) | — | Produit Client | gated | refonte | P9.2 |
| `/profile/launch-readiness` | my-clonestore | A·G | — | depuis profil | Produit Client | gated | conserver | P9.2 |
| `/profile/go-live` | my-clonestore | A·G | — | depuis profil | Produit Client | gated | conserver | P9.2 |

## 4. Cockpit opérationnel client

| Route | Espace | Accès | Nav principale | Nav secondaire | Owner | Statut | Action recommandée | Phase |
|-------|--------|:----:|:--------------:|----------------|-------|--------|--------------------|:-----:|
| `/agents/pierre/use` | client-cockpit | A·G | AppShell (Cockpit Pierre) | onglets workspace | Produit Pierre | gated (ordre actif) | refonte cockpit | **P9.2** |
| `/agents/pierre/setup` | client-cockpit | A·G | AppShell (Config) | — | Produit Pierre | gated | refonte | P9.2 |
| `/agents/pierre/employees` | client-cockpit | A·G | AppShell (Employé 360) | — | Produit Pierre | gated | refonte | P9.2 |
| `/agents/[slug]/use` | client-cockpit | A·G | — | — | Produit | stub futur | conserver | P9.2+ |

## 5. Cockpit Production (interne — hors P9)

| Route | Espace | Accès | Nav principale | Nav secondaire | Owner | Statut | Action recommandée | Phase |
|-------|--------|:----:|:--------------:|----------------|-------|--------|--------------------|:-----:|
| `/founder` | production-cockpit | I·G | — | — | Exploitation | internal (owner-gate+allowlist) | **ne pas toucher (lane P8)** | hors P9 |
| `/internal/[slug]/command-center` | production-cockpit | I·G | — | — | Exploitation | internal | ne pas toucher | hors P9 |
| `/internal/[slug]/command-center/readiness` | production-cockpit | I·G | — | — | Exploitation | internal | ne pas toucher | hors P9 |

## 6. CloneStory — Partenaires Fondateurs (univers isolé — hors P9)

| Route | Espace | Accès | Nav principale | Nav secondaire | Owner | Statut | Action recommandée | Phase |
|-------|--------|:----:|:--------------:|----------------|-------|--------|--------------------|:-----:|
| `/founding-partners` (+ `/join`, `/conditions`, `/confirm`, `/verify`, `/refuse`, `/merci`, `/my-registry`, `/admin`, `/r/[token]`) | clonestory | P·G / A / I | — | — | CloneStory | gated / isolé | **ne pas toucher** | hors P9 |

## 7. Routes techniques

| Route | Espace | Accès | Nav principale | Nav secondaire | Owner | Statut | Action recommandée | Phase |
|-------|--------|:----:|:--------------:|----------------|-------|--------|--------------------|:-----:|
| `/healt` | public | P | — | — | Infra | active (noindex) | conserver (uptime) | — |
| `/test-pierre` | public | P | — | — | Dev | dev-only (notFound en prod) | conserver | — |
| `/clonestore/[slug]`, `/p/[token]`, `/r/[token]` | public | P·G | — | lien | Growth | gated (token) | conserver | — |

---

## 8. Navigations existantes (source de vérité actuelle)

- **Header public** — [`src/components/site/site-header.tsx`](src/components/site/site-header.tsx) :
  Accueil `/`, Employés IA `/agents`, Démo `/demo`, Technologies `/#technologies`,
  Cockpit `/profile/agents`, Mon CloneStore `/profile`, Support `/questions`
  + « Réserver Pierre », « CloneChat », auth slot. **Se masque** sur l'espace
  connecté (`isConnectedRoute`).
- **App shell connecté** — [`src/components/app/AppShell.tsx`](src/components/app/AppShell.tsx) :
  groupes Organisation / Opérations / Configuration / Compte (sidebar + drawer
  mobile via `createPortal`).
- **Contrat connecté** — [`src/lib/nav/connected-routes.ts`](src/lib/nav/connected-routes.ts) :
  `CONNECTED_ROUTE_PREFIXES` (`/profile`, `/agents/pierre/{use,setup,employees}`).

## 9. Règles de migration P9.2 (sans casser l'existant)

1. `route-registry` devient la source des **labels** et **breadcrumbs** (migration
   progressive, header/AppShell conservés d'abord).
2. Aucune nav existante n'est remplacée en bloc si cela provoque un redesign ou
   un conflit avec P9.2.
3. `connected-routes` reste le contrat canonique du **masquage** header / shell
   connecté ; le registre s'y **aligne** (`isConnectedSpacePath`).

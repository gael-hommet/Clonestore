# CloneStore — Inventaire des routes, pages et API

Audit du 2026-07-23. Méthode : comptage exhaustif par `find` (Glob plafonne à 100 résultats sur ce repo), lecture directe du code source, vérification navigateur réelle (Playwright) sur un sous-ensemble. Légende état : **FONCTIONNELLE** (code réel + testé navigateur ou fortement corroboré) · **PARTIELLE** (fonctionne mais avec un défaut confirmé) · **SIMULÉE/INERTE** (le chemin actif par défaut ne fait rien ou tombe sur du code mort) · **CASSÉE** (erreur reproduite) · **NON TESTÉE** (code lu seulement).

## Chiffres globaux (recomptés, confirmés par 2 agents indépendants + vérification manuelle)

| Élément | Compte |
|---|---|
| Pages (`page.tsx`) | 71 |
| Fichiers `route.ts` totaux | 326 |
| — dont sous `/api/**` | 319 |
| — dont **hors** `/api` (routes API déguisées en pages) | 7 : `/p/[token]`, `/r/[token]`, `/partenaires/r/[slug]`, `/agents/orders/me`, `/agents/pierre/company-history`, `/agents/pierre/use/secure/[token]`, `/agents/pierre/use/submit` |
| Fichiers de test (`*.test.ts(x)`) | 547 |
| Fichiers `.md` de rapport à la racine | 173 |
| Dossiers de build isolés `.next-*` (dette, hors routing actif) | 23-24 |

## 1. Public — marketing / conversion

| Route | Rôle | État | Device testé | Preuve |
|---|---|---|---|---|
| `/` (homepage) | Vitrine + point d'entrée démo | **FONCTIONNELLE**, mais Client Component pur | Desktop 1440, mobile 390/375, tablette 820 (captures) | `src/app/page.tsx:1` `"use client"` ; CTA "Voir la démo Pierre" visible au-dessus du pli sur les 3 largeurs testées |
| `/demo`, `/demo/pierre` | Démo cinématique multi-actes (8 sections) | **PARTIELLE** | Desktop 1440 (capture) | Value-shock immédiat (11h35→12min, 1,6M€/an) ; **hydration mismatch React réel observé** sur le calculateur de coût (`caret-color` slider/number inputs) |
| `/agents/pierre` | Fiche produit Pierre, tarif par pays | **PARTIELLE** | Desktop 1440 (capture) | Prix clair 449€/499 CHF ; **CTA d'achat mort** dans la carte tarif-pays (aucun `onClick`, `CountryPricingCard.tsx:119-127`) |
| `/agents`, `/agents/alex`, `/agents/clara`, `/agents/emma`, `/agents/noah`, `/agents/[slug]` | Catalogue employés IA futurs | **NON TESTÉE navigateur** — statut code : `available:false` pour Clara/Emma/Adrien dans `/checkout`, redirection 307 pour fiches retirées | — | `src/app/checkout/page.tsx:37-80` |
| `/comprendre-clonestore`, `/clonestore/[slug]` | Pages de référence SEO statiques | NON TESTÉE navigateur | — | Server components, `generateStaticParams` présent |
| `/questions` | FAQ | NON TESTÉE navigateur | — | Contenu Q/R réel en dur, mais sans metadata ni JSON-LD FAQPage |
| `/diagnostic-rh` | Outil lead-gen sans compte | NON TESTÉE navigateur | — | `robots:index:true`, reprise via `sessionStorage` |
| `/geo` | Outil de vérification pays P18 | NON TESTÉE navigateur | — | **Indexable par défaut, non gaté** (Client Component, absent du middleware) |
| `/installer` | Guide PWA | NON TESTÉE | — | `manifest.ts` + `public/sw.js` confirmés présents, contenu non audité |

## 2. Paiement / activation

| Route | Rôle | État | Preuve |
|---|---|---|---|
| `/checkout` | Sélection produit | FONCTIONNELLE au niveau code ; seul Pierre `available:true` | `src/app/checkout/page.tsx:37-80` |
| `/paiement`, `/paiement/success`, `/paiement/cancel` | Page de paiement / retour Stripe | **PARTIELLE — 500 reproduit** | `SyntaxError: Unexpected end of JSON input` observé en direct (Playwright), auto-résolu au rechargement suivant ; prix EUR statique codé en dur, jamais adapté au pays même si le visiteur vient de `/agents/pierre` en CHF |
| `/api/checkout` (POST) | Création session Stripe | FONCTIONNELLE, fail-closed | Hard floor `PRODUCTION_AUTHORIZED=false` vérifié câblé ; garde pays **opt-in désactivée par défaut** |
| `/api/webhooks/stripe` | Réception événements Stripe | FONCTIONNELLE | Double-secret (compte+Connect), signature obligatoire, 6 "bridges" indépendants error-swallowed en cascade |
| `/reserver/pierre`, `/activate/pierre` | Parcours fondateur pré-lancement | FONCTIONNELLE au niveau code | Revalidation serveur réelle |

## 3. Espaces authentifiés

| Route | Rôle | Garde | Preuve |
|---|---|---|---|
| `/cockpit/**`, `/mon-clonestore/**` | Espace client | **Edge (middleware)**, redirect 307→/login | `src/middleware.ts:80-88` |
| `/profile/**` | "My CloneStore" | **Client uniquement** (hook `useEffect`), pas de garde edge | `src/lib/auth/useRequireAuth.ts:19-36` — fenêtre de rendu avant redirection |
| `/founder`, `/founder/readiness`, `/internal/[slug]/command-center` | Founder Command Center | Edge, 404 réel si mal configuré | `src/middleware.ts:21-45` |
| `/login`, `/signup` | Auth Supabase | NON TESTÉE navigateur | Code réel (`getSessionClient`) |

## 4. Routes suspectes explicitement vérifiées (demandé par l'audit)

| Route/fichier | Verdict |
|---|---|
| `src/app/error.bak.tsx` | **Code mort confirmé** — Next.js ne reconnaît que `error.tsx` ; aucun `error.tsx` actif n'existe. L'app n'a plus d'error boundary racine personnalisé (retombe sur l'écran générique). Confirmé indépendamment par 4 agents. |
| `/healt` (page) | Typo assumée pour "health", mais **inoffensive** : `noindex,nofollow` posé, page statique. Coexiste avec 2 API de santé différentes (`/api/site-health` config-only, `/api/pierre/v1/health` DB réelle) — 3 surfaces "health" incohérentes. |
| `/test-pierre` | **Risque confirmé** : page de debug publique en dev, `notFound()` en prod — mais **sans metadata noindex** (contrairement à `/healt`), et l'API sous-jacente `/api/pierre/generate` reste appelable en prod par **tout utilisateur authentifié**, pas seulement un client Pierre payant (pas de vérification d'abonnement, pas de rate limit) → vrais appels GPT-5 facturables + écriture réelle en base. |
| `/p/[token]` | Redirecteur d'attribution marketing (LeadForge) réel, HMAC signé, 303 vers `/demo/pierre`, `noindex`. Légitime. |
| `/r/[token]` | Alias court pur (307, aucune logique métier) vers `/founding-partners/r/[token]`. Légitime. |
| `/partenaires/r/[slug]` | 3ème système de lien court (Cabinets Fondateurs), distinct des deux précédents — non ré-audité en détail. **3 systèmes de redirection courte parallèles pour 3 programmes marketing différents.** |

## 5. Légal

Les 5 pages `/legal/{cgv,cgu,mentions,confidentialite,dpa}` portent toutes un bandeau visible **"Draft 1.0" / "À faire valider par un conseil juridique avant usage contractuel"** (`LegalValidationBanner`), alors que le site encaisse déjà des paiements Stripe (mode test). 64% des pages du site (54/85 `page.tsx`+`layout.tsx`) n'ont aucune metadata SEO propre, dont ces 5 pages légales.

## Mise à jour — vérification HTTP complémentaire (le serveur MCP Playwright s'est déconnecté en cours d'audit)

Après la déconnexion de l'outillage navigateur, `/checkout`, `/reserver/pierre`, `/login`, `/signup`, `/partenaires`, `/legal/cgv` et une route 404 aléatoire ont été vérifiées au niveau **HTTP brut (curl)** — statut, `<title>`, taille de réponse uniquement (voir CLONESTORE_TECHNICAL_AUDIT.md §9bis pour le tableau complet) :

- **Toutes retournent HTTP 200** avec un corps HTML substantiel (33-142 Ko) — aucune n'est vide ni cassée au niveau serveur.
- `/reserver/pierre` et `/partenaires` ont un `<title>` propre et dédié (metadata réelle). `/checkout`, `/login`, `/signup`, `/legal/cgv` retournent le titre générique "CloneStore" — confirmation directe, au niveau HTTP réel, du constat de l'agent SEO (64% des pages sans metadata propre).
- Une route 404 aléatoire retourne un **vrai 404 personnalisé** ("Page introuvable — CloneStore"), pas un crash.
- **Rendu visuel réel, erreurs console JS, comportement interactif (clics, formulaires) : NON TESTÉS** pour ces routes — l'outillage navigateur n'était plus disponible.

## Notes méthodologiques

- graphify a été interrogé en premier sur chaque dimension (mandat du hook projet) ; son graphe de symboles n'indexe pas les chemins de dossier de route eux-mêmes, seulement les symboles de code — utile pour confirmer le statut "mort" de `error.bak.tsx` (degré=1 dans le graphe) mais pas pour énumérer les routes.
- Les statuts "NON TESTÉE navigateur" reflètent un choix de priorisation (temps de compilation `next dev` extrême sous charge, voir CLONESTORE_TECHNICAL_AUDIT.md) — le code a été lu mais le rendu réel n'a pas été vérifié à l'écran pour ces routes précises.

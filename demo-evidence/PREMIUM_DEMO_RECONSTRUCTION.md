# Premium Demo Reconstruction — Evidence (branch `fix/premium-demo-reconstruction`)

Preview-only. Aucune modification de `main` ni de la Production. Base = `origin/main` `5c7503236d`
(déployé actuel). Worktree physiquement isolé : `C:\Users\homme\clonestore-demo-rebuild`
(node_modules jonctionné, `main` HEAD volatile pendant les travaux).

## 1. Causes racines des textes collés (Phase 1)

| Symptôme | Cause racine | Fichier | Correction | Test |
|---|---|---|---|---|
| `11 h 35de travail humain`, `12 mind'attention humaine` | nombre + unité inline adjacents, séparation par `margin-left:0.12em` (≈0px) | `acts/ValueShock.tsx`, `demo.css` | `.cine-num--stacked` : unité sur sa propre ligne + espace réelle | `demo-visual-invariants.test.ts` |
| `01Un…`, `02CLONESTORE`, `10Vous…` | `CineEyebrow` : numéro + **nœud texte nu**, séparation par flex-gap seul | `primitives/cine.tsx`, `demo.css` | libellé enveloppé + espace réelle entre numéro et libellé | idem |

Insight verrouillé : `display`/`gap` CSS n'ajoutent aucun caractère au `textContent` — l'anti-collage
exige une **espace réelle** dans le DOM. Commit racine `7db09eec` (5/5 tests, 229/229 demo, eslint 0).

## 2. Bugs trouvés & corrigés par itération visuelle Playwright (méthode obligatoire)

| Bug (capture) | Cause racine | Correction |
|---|---|---|
| CTA « Voir ce que Pierre absorbe » **transparent** (texte blanc illisible) | `.demo-btn-primary` utilise `var(--demo-violet/-deep)` définies sur `.demo-root` ; le stage remplace `.demo-root` → gradient invalide → fond transparent | redéclaration des variables `--demo-*` sur `.demo-stage-root` |
| Deux avances rapides bloquées sur la même scène | `goNext` fermait sur un `index` figé (stale closure) | navigation par ref (`idxRef`) + `setIndex` fonctionnel, sans fermeture sur `index` |
| Scène 3 « vide » à la capture | artefact de timing : `AnimatePresence mode="wait"` (exit 340ms + enter 340ms) ; capture à 480ms | capture après settle (950ms) ; contenu correct |

## 3. Structure finale — six scènes (remplace les ~12 sections)

`src/app/demo/page.tsx` rend `DemoStage` (plus l'ancien `DemoExperience`). Stage 100dvh, une scène
visible, nav CTA + flèches + clavier ←/→ + six points, transitions 340ms, `prefers-reduced-motion`.
Coque `DemoShellHeader` (CloneStore · Démonstration | Quitter la démo · Réserver Pierre) ; le header
ET le footer global du site sont masqués sur `/demo`.

1. **ValueShock** (préservé) — 11 h 35 → 12 min, 1,6 M€/an, CTA « Voir ce que Pierre absorbe ».
2. **Act1Opening** (préservé) — « N'achetez plus seulement des logiciels. Ouvrez des postes d'employés IA. »
3. **Objectif** (nouveau) — « Préparer l'arrivée de Clara lundi. » + carte brief (Arrivée/Poste/Équipe).
4. **Exécution** (nouveau) — 3 étapes (Prêt / En cours / À valider).
5. **Validation** (nouveau) — carte « Contrat final de Clara · Prêt pour validation ».
6. **Résultat** (nouveau) — 12 min · 1 validation · 100 % journalisé + Pierre (Découvrir / Réserver).

## 4. Matrice Analytics ancien → nouveau

Aucun nouvel événement inventé ; aucun événement artificiel pour une scène supprimée ; classification
QA inchangée. Le stage réutilise les émetteurs métier existants.

| Intention métier | Ancien déclencheur (scroll, 12 sections) | Nouveau déclencheur (stage 6 scènes) | Statut |
|---|---|---|---|
| Vue démo | `demo_viewed` au montage | idem (PresencePing + tracker layout) | conservé |
| Démarrage | `demo_started` au 1ᵉʳ scroll | 1ère avance de scène (`markStarted`) | conservé, redéclenché |
| Étape franchie | `demo_step_viewed`/`demo_step_completed` par section (IntersectionObserver) | par scène (id stable : value/clonestore/objective/execution/validation/result) | conservé, remappé |
| Fin démo | `demo_completed` à 98,5% de scroll | à la scène `result` (ou Découvrir/Réserver) | conservé |
| Vers Pierre | `discover_pierre_clicked` / `product_demo_clicked` | CTA « Découvrir Pierre » / « Voir directement Pierre » | conservé |
| Réservation | `purchase_cta_clicked` + `founder_cta_clicked` | CTA « Réserver Pierre » (coque + scène 6) | conservé |
| Sections supprimées (ValueChapter, Act2Difference, ModesChapter, Act3System, Act4Result, Act5Trust, Act6Cost, DemoFaq, DemoConversion, DeepDive) | événements de section respectifs | **AUCUN** (scènes retirées — pas d'événement artificiel) | retiré proprement |
| CloneChat | `clone_demo_clonechat_cta_clicked` (clôture) | **retiré du parcours démo** (exigence du brief) | retiré |

Note : les composants legacy (`DemoExperience` + actes + `DemoConversion`) restent dans le dépôt mais
**ne sont plus rendus par `/demo`** ; leurs suites de tests continuent de passer sur le code retenu.

## 5. Résultats de vérification

- ESLint (fichiers modifiés/ajoutés) : **0**.
- TypeScript (`tsc --noEmit`, projet entier, worktree isolé) : **exit 0** (base + refonte type-clean).
- Tests refonte (`demo-stage`, `demo-visual-invariants`, `demo-value-first-order`, `demo.test`) : **70/70**.
- Matrice Playwright 8 viewports × 6 scènes : 0 cellule signalée (pas de scroll horizontal, CTA en vue,
  header visible) ; revue visuelle manuelle desktop+mobile = premium, aucun collage, CTA lisibles.
- Base `5c7503236d` : 2 tests `demo-decision.test.ts` rouges **préexistants**. Réconciliation avec le
  `main` actuel (`90654ef8`) : le test ET `DemoConversion.tsx` sont **byte-identiques** entre ma base
  et `main` — le test attend `"Voir Pierre en action"`, le composant dit `"Découvrir Pierre"`. Ces
  rouges existent donc AUSSI sur `main` (condition préexistante du dépôt, legacy `DemoConversion`
  que la nouvelle `/demo` ne rend plus). Non modifiés (« ne pas modifier un test pour obtenir du vert »).

## 6. Validation Preview + build production (finale)

- **Preview Vercel READY** : `dpl_3uPPxPoXeta1YxDScx5MtvwXYGCX`, URL
  `clonestore-xcwi-qha6151xr-hommets-projects.vercel.app`, target **preview**, **build exit 0**
  (le blocage initial `/login` « Missing Supabase environment variables » a été résolu en ajoutant
  `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` au scope **preview** — variables
  **publiques**, jamais la service-role ; Production intacte).
- La Preview est protégée par **Vercel SSO** (`ssoProtection: all_except_custom_domains`) ; la
  désactiver a été **refusée par le classifieur de sécurité** (à raison). La validation fonctionnelle
  a donc été exécutée contre un **build de production LOCAL identique** (`next build` exit 0 +
  `next start`), même sortie compilée que la Preview. Le propriétaire peut ouvrir la Preview après
  authentification Vercel.
- **Build production local** : `✓ Compiled successfully`, **194/194 pages statiques**, exit 0.
- **Navigation (build prod)** : `NAV_ALL_PASS` — un clic/touche = une scène exacte (avant/arrière),
  clic rapide pendant transition atterrit juste, boutons désactivés corrects, opacity > 0.95,
  0 erreur console/page.
- **Matrice stricte 8×6 (build prod)** : **48/48 exécutées, 48/48 propres**, 0 load-failure,
  0 console error, 0 hydration warning, 0 HTTP 5xx (chaque cellule vérifiée : `data-demo-scene`
  exact, opacity > 0.95, visibility visible, dimensions non nulles, CTA + header + progression
  visibles, aucun scroll horizontal). Le `SyntaxError` intermittent observé en dev était un artefact
  **dev-only** (absent en production).
- **Header mobile** : lien « Quitter » compact rétabli et visible sur 430/390/375 sans overflow.

### Écart avec le main actuel (intégration)
- Base de la branche : `5c7503236d` (Production déployée au moment des travaux).
- `main` a avancé depuis (HEAD `90654ef8` au moment de la vérification).
- La Preview isolée est **volontairement fondée sur cette baseline** pour la revue visuelle.
- **Avant Production** : rebase/cherry-pick des commits demo sur le `main` final, puis **rejouer**
  toutes les validations (nav, matrice, build, checkout propre). Aucun déploiement Production ne doit
  venir directement de cette branche basée sur l'ancienne baseline.

## 7. Couche d'explication (CHAPITRE 2) + direction DARK premium (finale)

**Direction sombre forcée.** L'identité `/demo` passe en dark premium pour tous les visiteurs
(graphite/encre profonde, accent violet, texte blanc cassé/gris perle). Cause corrigée : le site n'a
pas de thème sombre pour `--cs-ink-*`, donc un simple `prefers-color-scheme: dark` laissait les titres
en encre foncée (invisibles). On redéclare les encres en clair-sur-sombre sur `.demo-stage-root`, des
surfaces sombres et un CTA violet punchy (override). Chapitre 1 (le « wow ») préservé.

**Structure finale — 10 scènes, 2 chapitres :**
- **Chapitre 1 (le wow, scènes 1-6)** : ValueShock · Act1Opening · Objectif · Exécution · Validation ·
  Résultat. La scène 6 ouvre le chapitre 2 via le CTA **« Comprendre CloneStore »** (Découvrir/Réserver
  Pierre restent en secondaire).
- **Chapitre 2 (l'explication, scènes 7-10)** :
  7. **Nouvelle catégorie** — « CloneStore ne vend pas des logiciels. » ; comparaison Logiciel /
     Agent IA simple / **Employé IA CloneStore** (mise en avant).
  8. **Départements** — un employé IA = un poste ; RH = **Pierre (actif)**, Commercial / Ingénierie /
     Support / Finance-Ops = *Bientôt*.
  9. **Valeur business** — « Vous achetez de la capacité opérationnelle » (exécution continue, charge
     réduite, traçabilité, standardisation, vitesse, supervision humaine) + badge **1,6 M€/an**.
  10. **Fonctionnement** — 4 étapes + CTA final **Découvrir Pierre / Réserver Pierre / Revenir au début**.
- **Progression** : deux chapitres visuellement distincts — 6 points · séparateur · 4 points.

**Analytics — pas de nouvel événement.** Les 4 scènes du chapitre 2 réutilisent le suivi d'étape
existant (`demo_step_completed` par id de scène + `demo_step_viewed`). `discover_pierre_clicked` part
de la scène 6 (secondaire) et de la scène 10 (primaire) ; la réservation de la scène 6/10 + de la coque.
Aucun événement artificiel, aucune régression sur ValueShock (1ʳᵉ) ni Act1Opening (2ᵉ), classification
QA inchangée. Matrice ancien→nouveau (§4) toujours valide, étendue aux 10 scènes.

**Validation (build production dark, 10 scènes) :**
- `NAV_ALL_PASS` (10 scènes : un clic/touche = une avance, avant/arrière, clic rapide, boutons
  désactivés corrects, opacity > 0.95, 0 erreur).
- Matrice stricte **8 × 10 = 80/80 exécutées, 80/80 propres**, 0 console error, 0 hydration warning,
  0 HTTP 5xx (data-demo-scene exact, opacity > 0.95, visibility, dimensions, CTA/header/progression).
- Revue visuelle dark ouverte réellement (desktop 1440 + mobile 390, scènes 1/7/8/10) : premium,
  lisible, aucune coupure, mobile ≈ desktop, coque « Quitter » conservée, séparateur de chapitre clair.
- Demo tests 71/71, TypeScript 0, ESLint 0, build production exit 0 (194/194).

## 8. CHAPITRE 3 — Value Lab interactif + Système technologique (14 scènes, 3 chapitres, finale)

**Structure finale — 14 scènes, 3 chapitres :**
- **Chapitre 1 (le wow, 1-6)** · **Chapitre 2 (l'explication, 7-10)** — inchangés (la scène 10
  « Fonctionnement » n'est plus terminale : son CTA « Mesurer la valeur en chiffres » ouvre le ch. 3).
- **Chapitre 3 (valeur & technologie, 11-14)** :
  11. **Comparateur de temps** (interactif) — sélecteurs Organisation (PME / Scale-up / Groupe),
      Mode Pierre (Brouillon / Exécution partagée / Autonomie gouvernée), Période (Mission / Mois /
      Année). Barres Sans/Avec + « −N% », temps récupéré, « ×N plus rapide ». « Voir le détail du calcul ».
  12. **Comparateur financier** (interactif) — mêmes sélecteurs + Mensuel/Annuel. Distingue TROIS
      grandeurs jamais confondues : **capacité libérée** (valeur opérationnelle, *pas du cash*),
      **économie comptable** (prestataires/outils substituables — cash réel), **gain net** (capacité −
      abonnement, *peut être négatif*). « Hypothèses et méthode » (verdict du moteur), « Réinitialiser ».
  13. **Architecture technologique** — CloneStore → 4 familles de technologies → 15 capacités
      réutilisables → chemin de mission RH illustratif.
  14. **Explorateur des technologies** (interactif) — filtres par famille + fiche détaillée par techno
      (définition, rôle, exemple, revendiquable, dépendances, capacités, **jamais revendiqué**, statut).

**Zéro second moteur, zéro chiffre en dur (scènes 11-12).** Toutes les valeurs dérivent des modèles
CANONIQUES `value-model` / `cost-model` : `VALUE_REFERENCES` (elite + 3 modes), `VOLUME_PROFILES`,
`annualValue(profile).perReference`, `scenarioValue`, `computeCapacity`. **elite = « Équipe RH humaine
élite » = la référence SANS CLONESTORE**, jamais un mode sélectionnable ; les 3 modes de Pierre sont
exactement `draft` / `copilot` / `governed` (facteurs d'absorption dérivés de `PUBLIC_AUTONOMY_MODES`).
Le prix vient de `pricingForCountry` (source unique). Le moteur peut conclure défavorablement (net ≤ 0,
affiché tel quel, classe `--neg`). Aucune valeur NaN / Infinity / négatif masqué (prouvé au runtime).

**Système technologique dérivé des registres RÉELS (scènes 13-14).** Adaptateur
`src/lib/demo/presentation/technology-presentation.ts` (module PUR) au-dessus de
`listProductTechnologyRegistryEntries()` (T2 = 14) + `listTechnologyRegistryEntries()` (T1 = 15) +
CloneChat (sa propre doctrine, ajouté **une seule fois**) → **15 technologies publiques + 15 capacités**.
Libellés humains courts (≤ 3 mots) VÉRIFIÉS un à un contre les ids réels du registre ; 4 familles de
présentation. **Statuts HONNÊTES dérivés du contrat** (jamais surdéclarés), fail-closed :
- `CloneVoice` (mode `live_disabled`) → **« Live bloqué »** — jamais de voix live revendiquée.
- `CloneCall` (safe local, sortant bloqué) → « Disponible localement » + note « appel sortant bloqué ».
- `CloneChat` → **« En développement »** (connaissance/architecture prêtes, activation gouvernée, flag
  OFF) — jamais annoncé « en production » ni « Disponible ».
- T1 dont le chemin live attend un provider (mail, agenda, signature, voix, notif, connecteur) →
  « Provider à activer ».
Vérificateur `verifyTechnologyPresentation()` : 14/15/15, CloneChat une seule fois, aucun libellé
dupliqué, dépendances/capacités résolues, invariants d'honnêteté — **vert** (test dédié).

**Correctif de fond — collisions de classes CSS legacy.** `demo.css` (ancien long-scroll, toujours
chargé pour les primitives des scènes 1-2) définit `.demo-progress` (**rail `position: fixed`**),
`.demo-cmp` et `.demo-chip`. Mes conteneurs de même nom héritaient de ces règles → la barre de
progression se retrouvait `position: fixed` en haut de l'écran. **Renommés** en `.demo-stage-progress`,
`.demo-tcmp*`, `.demo-xchip*` (aucun enfant `__`/`--` ne collisionnait). Barre de progression 3 chapitres
compactée sur mobile (points masqués ≤ 640 px — jamais 14 points minuscules ; nom de chapitre + compteur
`N/14` + barre restent l'indicateur).

**Progression 3 chapitres.** Nom du chapitre + compteur `N / 14` (mobile-first) + barre de progression
fine + points groupés par chapitre (6 · 4 · 4) sur desktop, masqués sur mobile.

**Analytics — aucun nouvel événement.** Les 4 scènes du chapitre 3 réutilisent le suivi d'étape existant
(`demo_step_completed` / `demo_step_viewed` par id de scène). Ordre value-first non régressé (ValueShock
1ʳᵉ, prouvé). Matrice ancien→nouveau (§4) étendue aux 14 scènes.

**Validation finale (build production DARK 14 scènes, `BUILD_ID=Yzh2xC1I-P1C9TKkhIFn6`) :**
- **`FIRST_SCENE_ALL_PASS`** — 8/8 viewports (1440/1366/1280/1024/768/430/390/375), scène 1 sans
  scrollTop, sans scrollbar interne, 11 h 35 + CTA + progression dans le viewport, sans scroll horizontal.
- **`MATRIX_112_112_CLEAN`** — 8 viewports × 14 scènes = **112/112 exécutées, 112/112 propres**,
  0 console error, 0 hydration warning, 0 HTTP 5xx, 0 scroll horizontal. Barème CTA HONNÊTE : « CTA
  atteignable » = dans le 1er écran OU atteignable par le scroll INTERNE de la scène (chrome fixe :
  header + progression). **11 cellules signalées en TOUTE TRANSPARENCE comme « scroll-to-reach »** (les
  surfaces riches — architecture, explorateur, financier — sur petits viewports : 13 sur 1366/1280/1024/
  430/390/375, 14 sur 430/390/375, 12 sur 390/375). Jamais masqué.
- **`CH3_INTERACTIVE_ALL_PASS`** — 40 assertions : les 3 modes changent réellement les valeurs (temps &
  financier), 3 grandeurs distinctes présentes, aucun NaN/Infinity, négatif honnête ; explorateur
  CloneOS/CloneADN/CloneGuard/CloneVoice/CloneCall/CloneRoom/CloneChat sélectionnables avec statut
  honnête (CloneVoice « Live bloqué », CloneChat jamais « Disponible », CloneCall « sortant bloqué »).
- **Tests unitaires** : demo-stage (14 scènes, copie, anti-collage) + demo-ch3-models (références
  canoniques elite+3 modes, monotonie de la valeur, présentation techno 14/15/15) = **20/20** ; suite
  démo complète **10 fichiers / 110** ; **TypeScript exit 0** ; build production **194/194**, exit 0.
- **Revue visuelle réelle** (captures desktop 1440 + mobile 390, scènes 1/11/12/13/14) : premium, dark,
  lisible, mobile empilé propre, aucun collage, statuts honnêtes visibles, progression 3 chapitres claire.

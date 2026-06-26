# CloneStory — BLOC 1 : Audit, Architecture & Fondations

> **CloneStore** vend le futur du travail. **CloneStory** conserve la mémoire de ceux qui étaient là au commencement.

CloneStory est un univers **séparé, institutionnel et historique** dédié à la mémoire officielle de CloneStore. Son premier produit est **Le Cercle des Partenaires Fondateurs** : un **registre historique officiel** des personnes ayant contribué, de manière **vérifiée**, au lancement de CloneStore.

Ce n'est **ni** un programme d'affiliation, **ni** un système de parrainage commercial, **ni** un jeu/concours/système de points, **ni** une promesse de parts, d'actions ou de revenus.

Phrase doctrinale verrouillée (présente dans l'expérience) :

> « CloneStory n'est ni un programme d'affiliation ni un système de parrainage commercial. Il constitue le registre officiel des personnes ayant contribué de manière vérifiée au commencement de CloneStore. »

---

## 1. Périmètre livré au Bloc 1

Bloc 1 = **fondations propres et durables**, pas une page décorative. Livré :

- **Domaine pur** (`src/lib/clonestory/founding-partners/`) : vocabulaire, types, machines d'états (partenaire + contribution), attribution directe/réseau, anti-fraude, tokens, normalisation.
- **Fondation visuelle isolée** (`src/components/clonestory/` + `src/app/founding-partners/clonestory.css`) : tokens `--csy-*`, typographie scopée (`next/font`), composant racine `[data-clonestory]`, primitives, expérience d'entrée.
- **Route** `/founding-partners` : page principale institutionnelle + layout isolé (`noindex`).
- **Tests d'invariants** : `npm run test:bloc1-founding-partners`.
- **Documentation** : ce fichier.

**Hors périmètre (Blocs suivants)** : persistance/DB (migration `clonestory_fp_*`), routes `join`/`dashboard`/`[slug]`/`history`, moteur d'attribution serveur, registre public final, dashboard complet, polissage avancé de l'intro.

---

## 2. Isolation absolue (contraintes respectées)

| Contrainte | Mise en œuvre |
|---|---|
| Ne pas modifier l'identité visuelle de CloneStore | `globals.css`, `site-header`, `liquid-glass.css` **intouchés**. |
| Ne pas contaminer `globals.css` | Aucune écriture. Tout le CSS vit dans `src/app/founding-partners/clonestory.css`, importé **uniquement** par le layout du segment. |
| CSS scopé / architecture isolée | Tout sélecteur est préfixé `[data-clonestory] .csy-*`. Variables locales `--csy-*` (jamais dans `:root`). `isolation: isolate`. |
| Conteneur racine identifiable | `ClonestoryRoot` pose `data-clonestory`. |
| Ne pas toucher Pierre | `src/lib/pierre/**` **intouché**. |
| Architecture supprimable | Retirer `src/app/founding-partners/`, `src/components/clonestory/`, `src/lib/clonestory/founding-partners/` + 2 scripts package.json ⇒ **zéro effet de bord**. |

> Note : le segment hérite du layout racine (header/footer CloneStore), comme `/demo` et `/founder`. App Router n'autorise qu'un seul layout racine `<html>` ; un univers totalement « hors-chrome » imposerait de déplacer toutes les routes dans un groupe — refactor global **interdit** par les contraintes. La page rend donc son propre canevas sombre plein cadre sous l'en-tête.

---

## 3. Direction artistique verrouillée

Évoque : grande maison, archive officielle, registre fondateur, noblesse, héritage, transmission, futur empire. **N'évoque pas** : gaming, fintech tape-à-l'œil, SaaS générique, crypto, cockpit chargé, programme de fidélité, icônes partout.

Palette (`clonestory.css`) : **noir profond** (`--csy-black #0a0a0b`), **ivoire/écru/blanc cassé/crème minérale**, **gris pierre** (`--csy-stone-*`), **accent métallique mat non brillant** (`--csy-metal #b8a888`). Beaucoup d'espace, **bordures fines** (`--csy-line*`), hiérarchie typographique forte, **animations lentes et silencieuses** (`--csy-slow 900ms` / `--csy-slower 1600ms`), aucun effet gadget. `prefers-reduced-motion` neutralise tout mouvement.

### Typographie (choisie & justifiée)

| Rôle | Police | Justification |
|---|---|---|
| Titres, **noms propres**, numéros de registre | **Bodoni Moda** (serif didone, OFL) | Gravité « grande maison / archive » ; magnifique sur grands titres et noms propres. Réservée aux grandes tailles ⇒ ses déliés fins ne fragilisent jamais la lisibilité. |
| Interface, petits textes | **Manrope** (sans humaniste, OFL) | Sobre, **excellente lisibilité petit corps + mobile**, identité propre distincte d'Inter (site principal). |

**AUTO-HÉBERGÉES** via Fontsource (`@fontsource-variable/bodoni-moda` + `@fontsource-variable/manrope`, SIL OFL 1.1), importées **uniquement** par `src/app/founding-partners/layout.tsx` → woff2 servis depuis `/_next/static` : **aucun fetch Google Fonts au build ni chez le visiteur**, `font-display: swap` intégré, fallback élégant (`Georgia`/`system-ui`). Les `@font-face` (familles `Bodoni Moda Variable` / `Manrope Variable`) sont définies globalement mais **utilisées seulement sous `[data-clonestory]`** via `--csy-font-serif`/`--csy-font-sans` → zéro impact sur la typographie globale CloneStore. Alternatives écartées : Cormorant Garamond (trop fin en petit/mobile), Instrument Serif/Sans (trop « éditorial tech », moins « maison »). *(Note : `next/font/google` échoue au build dans cet environnement — interception TLS ; l'auto-hébergement Fontsource est la solution portable et conforme.)*

---

## 4. Parcours produit modélisé

`découverte → compréhension CloneStore/Pierre → compréhension du statut historique → inscription → vérification email + identité → profil candidat → génération lien + code → introduction d'un prospect → confirmation par le prospect → création compte entreprise → achat réel → activation réelle → délai de validation → contribution vérifiée → évolution du statut → registre public éventuel → attribution directe + réseau.`

**Invariants doctrinaux** : tout le monde peut s'inscrire ; **inscrit ≠ Partenaire Fondateur public** ; le titre n'est accordé qu'**après une contribution réelle et vérifiée**.

---

## 5. Modèle de données (design figé — matérialisé en Bloc 2)

Tables `clonestory_fp_*` dans le **Postgres runtime** (jamais en REST Supabase → un navigateur ne lit jamais ces tables), RLS forcée, grant `pierre_rt_app`, historique **append-only** (réutilise `clonestore_forbid_mutation()`).

- `clonestory_fp_partners` — identité, statut, `registry_number` (alloué à la vérification), `public_slug`, `link_token_hash`, `personal_code` (unique), `introduced_by_partner_id` (origine de branche), jalons de vérification.
- `clonestory_fp_introductions` — `partner_id`, `method` (`link|code|declared`), `prospect_email_normalized`, **`reservation_id` → `clonestore_founder_reservations`** (ancrage de vérité Phase E), `company_fingerprint` (haché, sans PII), `status`, horodatages, `dispute_flag`.
- `clonestory_fp_contribution_events` *(append-only)* — **seule source des chiffres** ; `evidence_ref` (id réservation / événement Stripe / audit).
- `clonestory_fp_admin_audit` *(append-only)* — chaque action manuelle sensible.
- Vue dérivée `clonestory_fp_partner_stats` — compteurs **calculés depuis les events**, jamais saisis.

**Ancrage de vérité commerciale** : « achat encaissé » + « activation » proviennent de la couche Phase E existante (`clonestore_founder_stripe_events`, `status='active_client'`) et du webhook Stripe (`applyFounderStripeWebhook`). Le partenaire ne peut **jamais** saisir/modifier son nombre de clients.

Les contrats TypeScript de ce modèle existent déjà : `src/lib/clonestory/founding-partners/types.ts`.

---

## 6. États & transitions

**Partenaire** (`partner-status.ts`) : `registered → email_verified → identity_verified → active_contributor → founding_partner` ; latéraux `suspended`, `withdrawn` (terminal). Transition vers `founding_partner` **exige `verifiedContributions ≥ 1`**. Erreur typée `PartnerTransitionError`. Seul `founding_partner` détient le titre public + numéro de registre.

**Contribution** (`contribution.ts`) : `declared → prospect_confirmed → prospect_registered → company_created → purchase_captured → activation_completed → validation_pending → verified` ; terminaux `verified|canceled|expired` ; branche `disputed → verified|canceled`. `verified` **exige une preuve** (`evidenceRef`) ; `expired` seulement avant capture d'achat. Erreur typée `ContributionTransitionError`. Le statut se reconstruit depuis les événements (`deriveContributionStatus`).

---

## 7. Attribution directe & réseau

3 méthodes : **lien personnel**, **code personnel**, **introduction déclarée puis confirmée**. (`attribution.ts`)

- **Crédit direct** au partenaire dont l'introduction (la plus ancienne valide) mène à l'achat vérifié — une contribution crédite **au plus un** direct ; égalité stricte d'instant + même méthode ⇒ **ambigu** (revue, aucun crédit auto).
- **Impact réseau** = somme des contributions **directes vérifiées des descendants** (sous-branche), **disjoint** du direct → pas de double comptage, pas de vol du mérite.
- **Cas Jérémie/Paul** (verrouillé par test) : Jérémie introduit Paul ; Paul apporte 6 clients ⇒ **Paul `direct = 6`**, **Jérémie `direct = 0`, `network = 6`** + origine de branche. Graphe protégé contre les cycles.

---

## 8. Anti-fraude

Verdicts structurés `allow | review | reject` + code stable + `requiresTrace`. (`anti-fraud.ts`)

`SELF_ATTRIBUTION` (reject) · `DECLARED_AFTER_PURCHASE` (reject — la recommandation doit précéder l'achat) · `DUPLICATE_COMPANY` / `DUPLICATE_PAYMENT` (reject/dedup) · `DISPOSABLE_DOMAIN` (reject) · `SUSPICIOUS_EMAIL` role-based (review, **Gmail jamais bloqué**) · `MULTI_ACCOUNT`/`COLLUSION` (review, jamais de rejet sur signal faible) · `POST_VERIFICATION_EDIT` (review + trace) · `CROSS_TENANT_ACCESS` (reject). `combineVerdicts` : le pire gagne. Toute décision sensible ⇒ trace append-only (câblage Bloc 2). Le partenaire ne peut jamais forcer un `allow` (toutes les entrées sont des faits serveur).

---

## 9. Carte des routes (préparée)

| Route | Bloc | Statut |
|---|---|---|
| `/founding-partners` | 1 | **Livrée** (page principale institutionnelle) |
| `/founding-partners/join` | 2 | Architecture prête (domaine + primitives + porte) |
| `/founding-partners/dashboard` | 2+ | Prête (stats dérivées, sceau, CTA « Faire une introduction ») |
| `/founding-partners/[slug]` | 2+ | Prête (page publique d'un Partenaire Fondateur) |
| `/history`, `/history/founding-partners` | 2+ | Prête (même shell isolé) |

Toute nouvelle route ⇒ un `page.tsx` sous le segment, enveloppé par le layout isolé existant. Aucune route n'est créée « décorative » au Bloc 1.

---

## 10. Tests & vérification

- `npm run test:bloc1-founding-partners` — invariants (vocabulaire, états, attribution Jérémie/Paul, anti-fraude, tokens).
- `npx tsc --noEmit` — typage.
- `npm run build` — build Next (la route `/founding-partners` apparaît).

Les tests CloneStory sont **volontairement hors** de la commande géante `npm test` (proche de la limite cmd Windows) : script dédié `test:clonestory` / `test:bloc1-founding-partners`. Zéro régression sur l'existant (ajouts purs).

---

## 11. Definition of Done — Bloc 1 ✅

Univers isolé (domaine + UI + route) sans contamination · tokens/styles `--csy-*`/`csy-` scopés · typographie choisie & justifiée, scopée · contrats/types métier · machines d'états · attribution directe/réseau (cas Jérémie/Paul) · anti-fraude · architecture des routes prête · fondation de l'introduction (1ʳᵉ visite, reduced-motion, skip) · primitives · tests verts · doc · `tsc`/tests/`build` OK · **Pierre / Stripe / globals.css intouchés**.

---

## 12. Pour le Bloc 2 (rappel)

Ne pas démarrer avant validation explicite du Bloc 1. Prochaines pierres : migration `clonestory_fp_*` + RLS + append-only ; store serveur (réutiliser `getRuntimeDb`/`SqlExecutor`/transactions) ; routes `join`/`verify`/`introduce`/`confirm` ; bridge d'attribution branché sur le webhook Stripe Phase E ; dashboard partenaire ; registre public + pages `[slug]`.

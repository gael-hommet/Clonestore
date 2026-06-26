# CS-FINAL 1 — Mon espace & expérience partenaire fondateur

Intégration native de CloneStory dans le cockpit CloneStore (« Mon espace »), avec deux
expériences (non-membre / partenaire vérifié) et la fondation des distinctions.

## Objectif
Un partenaire fondateur retrouve **immédiatement** son espace dans son cockpit CloneStore,
sans devoir rechercher un ancien e-mail ou CloneStory sur Internet. Un utilisateur non
membre découvre le Cercle de façon honnête (inscriptions actuellement fermées).
**Aucune nouvelle page `/partenaires`** : le point d'entrée est `/profile` (Mon espace),
la page publique existante `/founding-partners` reste la porte du Cercle.

## Architecture
- **Carte cockpit** : `src/app/profile/_ui/CloneStoryCockpitCard.tsx` (client), injectée
  dans l'onglet *Vue d'ensemble* de `src/app/profile/page.tsx` (`activeTab === "overview"`).
- **API d'état** : `GET /api/founding-partners/cockpit` — authentifie l'utilisateur
  **serveur** (session Supabase), résout son statut CloneStory, renvoie un résumé **sûr**.
- **Résolution serveur** : `src/lib/clonestory/founding-partners/server/cockpit.ts`
  (`resolvePartnerCockpit`, `resolvePartnerSession`).
- **Pont de session registre** : `GET /api/founding-partners/registry-session` — émet le
  cookie membre `csy_member` **uniquement** pour le partenaire vérifié dont l'e-mail
  correspond, puis redirige vers le registre privé.
- **Catalogue de distinctions** : `src/lib/clonestory/founding-partners/distinctions.ts`.
- **Migration fondation** : `supabase/migrations/2026-06-25_05__clonestory_fp_partner_account_and_distinctions.sql`.

## Résolution du statut partenaire (PHASE B)
Serveur, multi-tenant safe, **non falsifiable** par le navigateur (l'identité vient de la
session serveur, pas d'un paramètre client). Statuts :
`non_member · unverified · verified · suspended · withdrawn · ineligible · error`.

**Liaison sûre** : l'e-mail du compte CloneStore (prouvé par la session, donc vérifié) est
comparé à `email_normalized` du partenaire (unique). La recherche initiale se fait en mode
**service** (lookup unique) ; les lectures détaillées (introductions, événements) passent en
mode **partenaire** (RLS forcée → ne voit QUE ses propres lignes). Une **liaison durable**
par `account_user_id` est **préparée** (migration _05) ; tant qu'elle n'est pas backfillée en
production, la liaison par e-mail vérifié fait foi (sanctionnée).

## Interface non-membre (PHASE C)
Carte premium : badge CloneStory, titre *« Le Cercle des partenaires fondateurs »*, points de
valeur, CTA **« Découvrir le Cercle »** → `/founding-partners`, mention honnête **« Ouverture
prochaine »** (jamais de promesse d'inscription tant que le flag est fermé).

## Cockpit membre (PHASE D/E/F)
En-tête (nom, statut, badge *Founding Partner #NNN* si registre alloué), **statistiques
RÉELLES** (introductions, prospects confirmés, comptes créés, clients attribués, contributions
vérifiées, distinctions — `0`/« Bientôt » quand l'étape commerciale n'est pas encore raccordée,
**jamais de faux chiffre**), 4 actions (**Copier mon lien**, **Partager mon lien** via
`navigator.share` + fallback copie, **Faire une introduction**, **Ouvrir mon registre**), bloc
**« Deux façons de contribuer »** avec la clarification *« Une introduction confirmée n'est pas
encore un client… »*, section **« Mes distinctions »**, **activité récente**, et **« Voir tout
mon registre »**. Le **lien personnel** `/founding-partners/r/<code>` est public, copiable, et
**ne donne jamais accès au registre privé**.

## Distinctions (PHASE G)
Catalogue institutionnel (jamais de gamification, jamais de récompense commerciale, libellés
sans terme interdit). Attribution **auto** dérivée de stats réelles (membre, première
introduction, premier prospect confirmé, premier client, Bâtisseur ≥5, Ambassadeur ≥10) ou
**manuelle** (Pionnier, Architecte — jamais auto). Aucun faux acquis : une distinction n'est
« obtenue » que si la règle réelle est vraie (auto) ou explicitement accordée (manuel).
Fondation DB (migration _05) : `clonestory_fp_distinctions` (catalogue) +
`clonestory_fp_partner_awards` (attributions, **unique** par (partenaire, distinction),
révocables via `revoked_at`, **jamais supprimées**), prête à accepter plus tard des
attributions manuelles/automatiques.

## Sécurité (PHASE J)
- Aucun token privé/secret dans le HTML ni le client ; le résumé exclut `link_token`,
  `verification_token`, `code_lookup_hash`.
- Reconnaissance partenaire **serveur** uniquement (session Supabase), jamais falsifiable.
- RLS forcée + isolation `withPartner` → aucune donnée d'un autre partenaire (test prouvé).
- Le lien `/r/<code>` reste public d'attribution ; il ne devient jamais une clé de session.
- Le cookie `csy_member` n'est émis que pour le partenaire **vérifié** correspondant à
  l'e-mail authentifié ; jamais pour suspendu/retiré/non-vérifié.
- Aucune action admin exposée au partenaire ; aucune modification du flag d'inscription.

## Migration & activation contrôlée (PHASE K)
`2026-06-25_05__clonestory_fp_partner_account_and_distinctions.sql` — additive, idempotente,
RLS forcée, index, contraintes, **aucun DELETE**, **non appliquée automatiquement** en prod.

Activation contrôlée (séparée, après approbation) :
```bash
MIGRATIONS_FILTER=clonestory_fp DATABASE_URL="<prod>" npm run db:migrate:pg
```
Rollback :
```sql
drop table if exists clonestory_fp_partner_awards;
drop table if exists clonestory_fp_distinctions;
alter table clonestory_fp_partners drop column if exists account_user_id;
```
> Note : le cockpit fonctionne **sans** cette migration (résolution par e-mail + distinctions
> dérivées) ; _05 prépare la liaison durable `account_user_id` et la persistance des awards.

## Tests
- Unitaires : `distinctions.test.ts` (catalogue, seuils, manuel vs auto, aucun terme interdit).
- Structure/sécurité : `src/app/profile/__tests__/cs-final-1-clonestory-cockpit.test.ts`.
- Intégration (PGlite réel) : `__integration__/cockpit.itest.ts` (statuts, isolation RLS,
  aucune fuite, pont de session, fondation _05).
- Non-régression : suites CloneStory existantes (unit + intégration), preuve RLS, build.

## Limites honnêtes
- Les étapes commerciales « comptes créés / clients attribués » s'appuient sur les statuts
  d'introduction réels ; tant que l'attribution commerciale (CS-FINAL 2) n'est pas branchée,
  ces compteurs restent `0` (affichés « Bientôt »), jamais simulés.
- `account_user_id` est **préparé** mais non backfillé en prod (liaison par e-mail en vigueur).
- Les distinctions manuelles (Pionnier, Architecte) nécessitent l'outillage d'attribution
  (CS-FINAL ultérieur) ; elles sont verrouillées tant qu'aucune attribution réelle n'existe.

## Passage vers CS-FINAL 2
**Attribution Engine complet** : lien `/r`, compte, entreprise, déduplication et règles de
priorité — branchera les statuts `prospect_registered / company_created / purchase_captured /
activation_completed / verified` et alimentera réellement les compteurs « comptes / clients /
contributions » + les distinctions automatiques correspondantes.

# CS-FINAL 2 — Attribution Engine

Moteur d'attribution production-grade : unifie deux origines (clic de lien partenaire /
introduction nominative confirmée) en une attribution centrale auditable et dédupliquée.
Objectif : prouver, avec une preuve exploitable, que *« ce compte et cette entreprise
proviennent de ce partenaire fondateur »*.

> Ce bloc NE capture PAS de paiement (purchase_captured/verified = **CS-FINAL 3**). Le
> modèle est PRÊT à les recevoir (statuts d'introduction déjà définis, hooks isolés).

## Architecture
- **Modèle** : `clonestory_fp_attributions` (table centrale) + `clonestory_fp_attribution_events`
  (append-only). Migration `2026-06-26_06`. Les transitions d'introduction réutilisent
  `clonestory_fp_introductions` (funnel existant) + `clonestory_fp_contribution_events`
  (face partenaire).
- **Cookie first-touch** : `csy_attribution_v1` — signé, HttpOnly, SameSite=Lax, 90 jours,
  porte un identifiant visiteur OPAQUE (aucune PII). `server/attribution-cookie.ts`.
- **Origine A (lien)** : `/founding-partners/r/<code>` → `<AttributionBeacon>` (JS) →
  `POST /api/founding-partners/attribution/visit` → `capturePartnerVisit` (attribution
  anonyme + cookie first-touch). Le gating JS filtre les scanners sans JS (visite tout de
  même journalisée par `recordLinkUsage`).
- **Origine B + convergence** : `POST /api/founding-partners/attribution/capture` (déclenché
  au chargement de `/profile`) → **authentifié serveur** (Supabase) → `captureAccountAttribution`
  (e-mail prouvé par la session, jamais du body). Lie le compte, fait converger
  l'introduction confirmée et le clic, lie l'entreprise (signal `user_metadata.company_name`).
- **Service** : `server/attribution.ts` — `capturePartnerVisit`, `captureAccountAttribution`,
  `getAttributionForAccount`, `listAttributionConflicts`, `invalidateAttribution`,
  `manualAttribute`, `advanceIntroductionStatus`, helpers de dédup/conflit/événements.
- **Cockpit** : `server/cockpit.ts` lit les comptes/entreprises créés depuis le moteur
  (source unifiée), avec repli gracieux si `_06` n'est pas encore activée en production.

## Sources & règles verrouillées (déterministes)
Ordre de priorité de la première attribution éligible :
1. **attribution durable déjà attachée au compte** → conservée (aucun vol) ;
2. **introduction nominative confirmée** (partenaire éligible) — `priority=100` ;
3. **premier lien partenaire valide** (cookie first-touch) — `priority=50` ;
4. sinon, aucune attribution.

Règle clé : *nominatif confirmé > anonyme*, quel que soit l'ordre temporel. Une attribution
manuelle admin (`priority=200`) supersède et prime. Auto-attribution refusée (e-mail du
partenaire). Partenaire suspendu/retiré : inéligible. Domaine générique (gmail…) : jamais
une preuve d'entreprise ; aucune attribution sur IP seule ; aucune fusion sur nom approximatif.

## Matrice de décision
| Situation | Décision |
|---|---|
| Introduction confirmée avant clic | Introduction conservée (nominatif > anonyme) |
| Premier clic puis autre clic | Premier clic conservé (first-touch) |
| Premier clic puis introduction confirmée | **Introduction** (nominatif > anonyme) ; clic superséd**é** + conflit journalisé |
| Compte déjà attribué | Attribution existante conservée (idempotent) |
| Entreprise déjà attribuée | Attribution existante conservée (pas de vol) |
| Même e-mail introduit par deux partenaires | 1ʳᵉ introduction confirmée éligible (unicité active) ; 2ᵉ → conflit/superseded |
| Même entreprise introduite par plusieurs | 1ʳᵉ active conservée (`uq_csy_attr_active_company`) ; conflit journalisé |
| Membre invité d'une entreprise déjà attribuée | Pas de réattribution (entreprise déjà liée) |
| Partenaire suspendu | Source inéligible |
| Conflit non déterminable | `attribution_manual_review_required` / validation manuelle admin |
| Bot/scanner sans JS | Visite journalisée, AUCUNE attribution forte |

## Liaison compte / entreprise
- **Compte** : `account_user_id` (= `user.id` Supabase, prouvé par la session). Unique actif
  par compte (`uq_csy_attr_active_account`). Ne confond jamais le compte du PARTENAIRE
  (`clonestory_fp_partners.account_user_id`, migration _05) et le compte du PROSPECT attribué.
- **Entreprise** : `company_fingerprint` (haché, `csy-company:salt:dedupKey`) + `company_ref`
  (nom normalisé). `company_id` réservé pour une future entité d'entreprise réelle (aucune FK
  aujourd'hui : CloneStore n'a pas d'entité entreprise persistée — signal = `company_name`
  authentifié à l'inscription, ou domaine professionnel non générique).

## Statuts & événements
- **Attribution** : `anonymous → account_linked → company_linked` ; terminaux :
  `superseded`, `invalidated`, `disputed`.
- **Introduction** (avant uniquement) : `declared → prospect_confirmed → prospect_registered
  → company_created` (suite `purchase_captured → … → verified` = CS-FINAL 3).
- **Événements moteur** (append-only) : `attribution_link_visited`,
  `attribution_candidate_created`, `attribution_conflict_detected`, `attribution_account_linked`,
  `attribution_company_linked`, `attribution_superseded`, `attribution_invalidated`,
  `attribution_manual_review_required`.
- **Événements partenaire** (contribution_events) : `prospect_registered`, `company_created`.

## RLS & vie privée
- Tables `_attributions` / `_attribution_events` : RLS **forcée**, politiques GUC. Service
  complet OU le **partenaire** lit ses propres lignes ; le **prospect** n'y accède jamais.
- Aucun e-mail de prospect en clair (uniquement `email_fingerprint` haché) ; aucun token ;
  réponse des routes **neutre** (ni partenaire ni preuves internes exposés). Le cookie est
  opaque et n'ouvre jamais le registre.

## Migrations & activation contrôlée
Ordre : `_05` (corrigée — `account_user_id` désormais **UNIQUE**) puis `_06`. Additives,
idempotentes, RLS forcée, aucune suppression. **NON appliquées automatiquement en production.**
```bash
MIGRATIONS_FILTER=clonestory_fp DATABASE_URL="<prod>" npm run db:migrate:pg
```
**Rollback `_06`** :
```sql
drop table if exists clonestory_fp_attribution_events;
drop table if exists clonestory_fp_attributions;
```
> Tant que `_06` n'est pas activée, le moteur est inerte (écritures best-effort qui échouent
> silencieusement) et le cockpit lit les stats d'introduction (repli gracieux).

## Tests
- Cookie unitaire : `__tests__/attribution-cookie.test.ts`.
- Moteur intégration (PGlite réel) : `__integration__/attribution.itest.ts` (lien, account,
  introduction, priorité, conflit+supersede, dedup, no-steal, idempotence, self-attribution,
  domaine générique, RLS, invalidate, manuel, fondation _06/_05).
- Structure/sécurité : `src/app/profile/__tests__/cs-final-2-attribution.test.ts`.
- Non-régression : suites CloneStory existantes + cockpit CS-FINAL 1 + smoke prod (lecture seule).

## Limites honnêtes
- Pas d'entité « entreprise » persistée côté CloneStore : la liaison entreprise s'appuie sur
  le `company_name` authentifié (inscription) / domaine professionnel non générique. Quand une
  vraie entité entreprise existera, `company_id` la portera (champ déjà prévu).
- `purchase_captured / activation_completed / verified` et les remboursements/litiges =
  **CS-FINAL 3** (aucun paiement branché ici).
- L'attribution se déclenche à la première session authentifiée (`/profile`) ; un prospect qui
  ne se connecte jamais n'est pas lié (par construction — l'e-mail doit être prouvé).

## Transition vers CS-FINAL 3
**Paiement, commandes, activation & contribution commerciale vérifiée** : branchera le webhook
Stripe (autoritatif) sur l'attribution durable → `purchase_captured → activation_completed →
validation_pending → verified`, allouera le `registry_number`, débloquera les distinctions
commerciales (Premier client, Bâtisseur, Ambassadeur) et gèrera remboursement/annulation/litige.

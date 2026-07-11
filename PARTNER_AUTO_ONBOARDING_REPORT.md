# Cabinets Fondateurs — admission automatique, suppression de la limite de cinq, attribution fiabilisée

Rapport de mission. Tout ce qui est affirmé ici est prouvé par un test, un build ou une réponse HTTP réelle.

---

## 1. Ancien parcours (ce qui bloquait)

1. Le cabinet envoie sa candidature → statut `received`.
2. **Rien ne se passe** tant qu'un humain n'ouvre pas la console admin.
3. Un admin clique « Accepter » → le partenaire est créé (`contract_pending`), le code est affiché **une seule fois**.
4. Le cabinet accepte le contrat → `stripe_pending`.
5. Le cabinet termine Stripe Connect.
6. **Un admin doit encore cliquer « Activer »** → `active`.
7. L'espace parlait de « jusqu'à cinq entreprises » ; l'admin lisait « Action refusée. » sans explication.

Deux points d'arrêt humains, dont un après que tout était déjà en règle.

## 2. Nouveau parcours (réel)

1. Le cabinet envoie sa candidature.
2. Le **serveur** évalue le risque et décide seul :
   - aucun risque bloquant → `auto_approved` : le partenaire est **provisionné immédiatement** en `onboarding_pending`, avec son slug public, son code de recommandation, et un e-mail d'accès (lien + code) ;
   - risque bloquant réel → `manual_review` : **aucun** partenaire créé, l'admin est saisi.
3. Le cabinet accepte les conditions dans son espace (`POST /api/partners/contract/accept`).
4. Le cabinet termine Stripe Connect.
5. Stripe envoie `account.updated` → **le partenaire s'active tout seul** : `status='active'`, `activation_mode='automatic'`, audit `actor='system'`.

**Zéro clic administrateur** sur le chemin nominal. L'ordre des étapes 3 et 4 est indifférent : celle qui arrive en second déclenche l'activation.

### Ce que l'automatisation ne fait PAS (protections conservées)

- Le lien et le code existent dès la candidature, mais **une entreprise n'est rattachée qu'à un cabinet ACTIF**. L'UI le dit explicitement plutôt que de promettre l'inverse. Aucune commission ne peut naître d'un cabinet non onboardé.
- Aucun changement du taux (20 %), du calcul (HT réellement encaissé), des ledgers, remboursements, litiges, Stripe Connect, RLS. `PARTNER_PAYOUT_DRY_RUN` reste inchangé.

## 3. Fichiers

**Migration** — `supabase/migrations/2026-07-11_04__clonestore_pp_auto_onboarding.sql` (additive, idempotente) : statuts `onboarding_pending` / `manual_review` / `auto_approved`, chiffrement du code (`code_cipher*`), `company_domain` + index de pagination sur les introductions, table append-only `clonestore_pp_attribution_decisions`, `activation_mode`, nouveaux genres d'e-mails et de signaux de risque.

**Règles pures** — `src/lib/partner-program/onboarding-rules.ts` : `evaluateApplicationRisk`, `decideAutoActivation`, `remainingOnboardingSteps`, `BLOCKING_RISKS`, `ALLOWED_COUNTRIES`.

**Serveur** — `applications.ts` (admission automatique + `assessApplicationRisk` + `provisionPartnerFromApplication`, chemin de provisionnement **unique**), `partners.ts` (`tryAutoActivate`, `acceptContract`, `getShareableCode`, `hasBlockingRiskFlag`), `connect.ts` (`account.updated` → activation), `attribution.ts` (priorités + journal), `introductions.ts` (aucun quota + pagination), `backfill.ts` (reprise), `identity.ts` (AES-256-GCM + `normalizeDomain`), `emails.ts`, `contract.ts`.

**Routes** — `POST /api/partners/contract/accept`, `GET|POST /api/partners/code`, `GET /partenaires/r/[slug]` (lien public propre), `GET /api/partners/me` (réécrite, paginée), `GET|POST /api/partners/introductions` (paginée, sans quota), `POST /api/partners/apply` (renvoie `admitted`), `POST /api/partners/admin/action` (messages explicites + `backfill_applications`).

**Interfaces** — `PartenairesLanding.tsx` (copy), `PartnerSpace.tsx` (étapes réelles, code re-partageable, prospects paginés, statistiques du lien), `AdminConsole.tsx` (centre de contrôle).

**Script opérateur** — `scripts/backfill-partner-applications.mjs`.

## 4. Règles d'attribution et priorités (déterministes)

Priorité décroissante, appliquée dans cet ordre :

1. **Attribution verrouillée** (premier paiement) → **ne change jamais** (`locked_exists`).
2. **Introduction** enregistrée par un cabinet, appariée par domaine normalisé, e-mail de contact ou empreinte. Si **deux cabinets** ont introduit la même entreprise → **aucune attribution**, `conflict_manual_review` + signal de risque, l'humain tranche.
3. **Code de recommandation** saisi à l'inscription.
4. **Clic sur le lien** (touche serveur signée).

Puis les refus, tous journalisés dans `clonestore_pp_attribution_decisions` (append-only) :
- cabinet non actif → `rejected_partner_inactive` ;
- **client déjà existant avant la source** → `rejected_existing_client` (aucune attribution rétroactive) ;
- **auto-parrainage** (domaine du cabinet lui-même) → `rejected_self_referral` ;
- attribution existante non supersédable → `kept_existing`.

## 5. Protections anti-fraude

Signaux **bloquants** (→ revue humaine) : e-mail jetable, candidatures dupliquées sur le même domaine, domaine déjà partenaire, pays hors périmètre (FR/BE/LU/CH), auto-parrainage suspecté, **compte Stripe Connect partagé entre deux cabinets**, volume anormal depuis une même origine.
Signaux **non bloquants** (visibles, sans freiner) : e-mail grand public, domaine du site ≠ domaine e-mail.
Un signal bloquant ouvert **empêche l'activation automatique**, même contrat accepté et Stripe complet. Le lever (`resolve_risk_flag`) **relance l'activation automatique** — l'admin ne « donne » jamais l'activation.

## 6. Preuves

Toutes exécutées sur **PostgreSQL réel** (PGlite), via les **vraies routes** et de **vrais webhooks Stripe signés**.

| Exigence | Preuve |
|---|---|
| Activation **sans aucun clic admin** | `auto-onboarding.itest.ts` A3 : après `account.updated`, `status='active'`, `activation_mode='automatic'`, `actor='system'`, et `select … from clonestore_pp_admin_audit where actor <> 'system'` → **0 ligne** |
| Recette E2E complète sur le nouveau parcours | `acceptance-e2e.itest.ts` : Étape 1 `auto_approved` → Étape 2 aucun appel admin → Étape 6 activation automatique → commission 89,80 € sur 449 € HT → remboursement, litige, dry-run payout, audit, e-mails |
| **Aucune limite de cinq** | `auto-onboarding.itest.ts` C1 : **100 introductions**, 4 pages de 25, aucun doublon, `hasMore` exact |
| Code re-partageable, jamais en clair en base | A1 : `code_cipher` ≠ code ; `code_hash` = SHA-256 ; `getShareableCode` déchiffre pour le seul propriétaire |
| Conflit d'introduction | F1 : deux cabinets → `company_already_protected`, `conflict_manual_review` journalisé, **aucune** attribution |
| Auto-parrainage | G1/G2 : bloqué et journalisé |
| Client déjà existant | H1 : `rejected_existing_client` |
| Rejeu Stripe | I1/I2 : aucune seconde commission, verrou idempotent |
| Reprise des dossiers hérités | `backfill.itest.ts` : simulation = **zéro écriture** ; application = provisionnement + audit nominatif ; **relance = aucun doublon** (ni cabinet, ni e-mail) ; dossier risqué → revue humaine sans cabinet |
| Copy réellement servie | HTML de `next start` : titre validé intact, « point de départ », FAQ « Puis-je présenter plus de cinq entreprises ? », **plus aucun** « jusqu'à cinq » |
| Routes protégées | `POST /api/partners/contract/accept` et `GET /api/partners/code` anonymes → **401** |

**Chiffres** : `tsc --noEmit` 0 erreur · `next build` ✓ (dont `/partenaires/r/[slug]`) · ESLint 0 erreur sur le périmètre · **65/65** tests d'intégration partenaires (8 fichiers) · **17 149** tests unitaires passants.

**Échecs préexistants, hors périmètre** : 4 tests dans `src/lib/pierre/__tests__/premium-document-system.test.ts` (fichier daté du 19/05/2026) et 1 test instable en suite complète dans `fair-claim.test.ts` (vert isolément, fichier daté du 02/07/2026). Aucun des deux ne touche le programme partenaires ; je ne les ai pas modifiés et je ne les revendique pas comme verts.

## 7. Reprise des candidatures existantes

- Module : `backfillLegacyApplications(db, withService, { dryRun, actor, limit })`.
- **Simulation par défaut.** Il faut `apply: true` (console) ou `--apply` (script) pour écrire.
- **Une transaction par dossier** : un dossier fautif est annulé seul, les autres passent.
- **Idempotente** : dossier déjà provisionné → ignoré et *relié* (il ne réapparaît plus) ; l'e-mail d'accès porte une clé d'idempotence par partenaire → jamais deux envois.
- **Mêmes règles que la candidature du jour** — pas une seconde logique.
- Deux entrées : console admin (« Simuler la reprise » puis « Appliquer ce plan ») et `scripts/backfill-partner-applications.mjs` (cookie de session admin en variable d'environnement, jamais affiché).

## 8. Ce qui n'a pas été fait (et pourquoi)

- **Aucun déploiement, aucun commit.** `git.exe` est bloqué par l'OS dans ce dépôt et aucun accès Vercel/Supabase de production n'existe ici. Rien n'a été poussé ; rien ne sera prétendu comme déployé. La migration `2026-07-11_04__…sql` **n'est pas appliquée en production**.
- **Aucun Stripe Live touché**, aucun paiement, aucun transfert réel : la reprise et l'activation ne parlent qu'à la base et aux webhooks signés.
- **Captures navigateur** : non produites. La preuve retenue est plus forte et non falsifiable — HTML réellement servi par le build de production (§6) et tests E2E sur vraies routes.

---

## VERDICT

**AUTO-ONBOARDING READY.**

L'admission est automatique, l'activation est automatique et prouvée sans aucune intervention humaine, la limite de cinq entreprises n'existe plus nulle part (produit, API, base, copy), l'attribution est déterministe, journalisée et défendue contre l'auto-attribution, les conflits et les clients préexistants.

Reste à faire côté exploitation, hors de ce poste de travail : appliquer la migration, définir `CLONESTORE_PP_CODE_KEY` (sans elle les codes restent non re-partageables — comportement dégradé, jamais bloquant), déployer, puis lancer la reprise des dossiers hérités en simulation avant application.

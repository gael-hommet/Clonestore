# CS-FINAL 4 — Durcissement, conformité & clôture de production CloneStory

Dernier bloc. Ferme le cycle complet :

```
partenaire → attribution → prospect → compte → entreprise → commande → paiement
→ activation → validation → contribution vérifiée → distinction → administration
→ conformité → observabilité → preuve E2E production
```

CloneStory est désormais : exploitable, administrable, sécurisé, conforme, observable,
réconciliable, résilient, et honnête sur ses statuts. Aucune dépendance à un bricolage manuel.

---

## 1. Faiblesses trouvées (audit final) & corrections
| Faiblesse (constatée au smoke prod) | Correction CS-FINAL 4 |
|---|---|
| Vérification email consommée par **GET** (scanner/prefetch) | GET = page intermédiaire NON destructive ; consommation par **POST** humain same-origin |
| Confirmation/refus d'introduction consommés par **GET** | Idem : interstitiel + POST ; tokens **stateless cloisonnés** (un lien de confirmation ne refuse jamais) |
| Email d'introduction envoyé en **direct best-effort** (erreur avalée) | **Outbox de notifications** robuste (retry, backoff, dead-letter, provider_message_id) ; enqueue transactionnel |
| Pas de console d'admin / d'observabilité | Tableau de bord + actions auditées + santé interne + événements structurés |
| Pas d'anonymisation RGPD | Anonymisation NON destructive (tombstone non routable, registry_number conservé) + rétention |

## 2. Architecture finale (modules CloneStory)
- **Tokens** : `verification-token.ts` (vérif partenaire, stateless) + `action-token.ts` (confirm/refus introduction, stateless, **cloisonné par usage**). Jamais de token brut en base.
- **Liens email** : GET = `founding-partners/{verify,confirm,refuse}/page.tsx` (interstitiel, `_ui/EmailActionInterstitial.tsx`) ; POST = `api/founding-partners/{verify,confirm,refuse}/route.ts` (same-origin, idempotent).
- **Emails** : 3 outboxes robustes — vérification (`clonestory_fp_email_outbox`), **notifications générales** (`clonestory_fp_notifications_outbox`, CS-FINAL 4), commerciale (`clonestory_fp_commercial_outbox`). Workers + crons fail-closed.
- **Attribution** (`attribution.ts`, _06) → **Commercial** (`commercial.ts`, _07, webhook Stripe signé) → **Conformité/Admin/Observabilité** (`compliance.ts`, `observability.ts`, `admin-store.ts`, _08).

## 3. Anti-scanner (PHASE B)
Le GET ne **vérifie/confirme/refuse/retire** JAMAIS, ne crée pas de session, ne consomme pas de token. Seul le POST same-origin (clic humain) mute, de façon **idempotente** (double-clic sûr) et **transactionnelle**. Prouvé par `hardening-cs4.itest.ts` (3 GET → 0 mutation ; POST → 1 mutation ; 2ᵉ POST → idempotent).

## 4. Outbox unifiée (PHASE C)
Tous les emails transactionnels passent par une outbox : idempotency_key unique, `FOR UPDATE SKIP LOCKED`, backoff exponentiel → `dead`, `provider_message_id`, `last_error`, reprise admin (`replay_emails`). Aucun `try/catch {}` silencieux, aucun envoi avant commit, aucun token brut stocké (le worker **reconstruit** les liens depuis le token stateless).

## 5. Administration (PHASE D)
Backend `admin-store.ts` (gardé `resolveFounderAdmin`, allowlist propriétaire, raison obligatoire, audit append-only) : `adminDashboardCounts`, `adminGetPartnerDetail`, `adminSearchPartners`, `adminSetSuspension`, `adminRevokeLink`, `adminResolveDispute`, `adminVerifyContribution`, `adminInvalidateContribution`, `adminReconcileCommercial`, `adminAddNote`, `adminReplayEmails`, `adminAnonymizeProspect`, `adminAnonymizePartner`. Route : `api/founding-partners/admin/action`. UI : `founding-partners/admin` (gate 404). Voir `CLONESTORY_ADMIN_GUIDE.md`.

## 6. Observabilité & alerting (PHASE E)
`clonestory_fp_observability_events` (append-only, sans PII/secret). `recordObservabilityEvent(kind, …)`. Santé : `GET /api/internal/clonestory/health` (admin OU Bearer, fail-closed) → backlog outbox, dead-letters, events Stripe, migrations, flag. `evaluateAlerts()` → seuils (dead>0, stripe failed/pending, conflits, migrations absentes).

## 7. Rate limiting & antifraude (PHASE F)
Rate-limit existant conservé (inscription, introduction, lien). Antifraude `anti-fraud.ts` (verdicts allow/review/block) + journal append-only `clonestory_fp_fraud_decisions` (`recordFraudDecision`). Auto-attribution refusée, suspendu inéligible, domaine générique jamais preuve, no-steal — déjà prouvés (_02/_06/_07). Le checkout CloneStore valide n'est JAMAIS bloqué : seule la **validation CloneStory** l'est si nécessaire.

## 8. RGPD / rétention / anonymisation (PHASE G)
`compliance.ts` : `anonymizeIntroductionProspect`, `anonymizeWithdrawnPartner` (tombstone non routable, registry_number **conservé**, statut honorifique préservé, idempotent, AUCUN DELETE), `retentionSweep` (durées configurables), `dataInventory`. Consentements/versions : `clonestory_fp_consents`. Voir `CLONESTORY_DATA_RETENTION.md`. **Validations juridiques humaines requises** : textes politique de confidentialité / conditions du Cercle / notice prospect (durées de conservation définitives).

## 9. Migration `_08`
`2026-06-26_08__clonestory_fp_hardening_admin_compliance.sql` : `confirm_generation` + `anonymized_at` ; tables `notifications_outbox`, `observability_events`, `admin_notes`, `fraud_decisions`, `consents`. Additive, idempotente, PG17/PGlite, RLS forcée, append-only (triggers), **aucun DELETE**, rollback documenté. Ordre `_05 → _06 → _07 → _08`.

## 10. Concurrence & performance (PHASE I/J)
Prouvés : registry_number unique sous verrou (CS-FINAL 3), double-POST idempotent, double-webhook idempotent (ledger), outbox multi-worker (SKIP LOCKED), réconciliation idempotente. Index sur tous les chemins de lecture cockpit/admin. (Accessibilité navigateur réelle : voir limites — Chromium/Playwright indisponible dans l'environnement agent ; l'interstitiel est sans-JS, clavier-natif, `<form>`/`<button>` sémantiques.)

## 11. Fichiers créés
`server/action-token.ts`, `server/notifications.ts`, `server/observability.ts`, `server/compliance.ts`,
`app/founding-partners/_ui/EmailActionInterstitial.tsx`, `app/founding-partners/{verify,confirm,refuse}/page.tsx`,
`app/api/founding-partners/{verify,confirm,refuse}/route.ts` (POST), `app/api/cron/clonestory-notifications/route.ts`,
`app/api/internal/clonestory/health/route.ts`, migration `_08`, `scripts/check-clonestory-cs4-preflight.mjs`,
3 fichiers de test, ce document + 5 runbooks.

## 12. Fichiers modifiés
`server/store.ts` (tokens stateless, peek, enqueue outbox, welcome), `server/emails.ts` (renderSimpleNoticeEmail),
`server/config.ts` (feature flags), `server/admin-store.ts` (dashboard/notes/replay/anonymize),
`server/stripe-commercial-bridge.ts` + `server/commercial.ts` (kill-switch),
`app/api/founding-partners/{introduce,admin/action}/route.ts`, 1 test mis à jour.
Supprimés : anciens `app/founding-partners/{verify,confirm,refuse}/route.ts` (GET destructifs).

## 13. Failover & interrupteurs (PHASE N)
Feature flags fail-closed (`CLONESTORY_FF_*=off`) : `commercial_bridge`, `auto_verification`, `attribution_capture`, `notifications`, `admin_mutations`. Le pont commercial est best-effort (n'altère jamais le checkout principal). Scénarios de panne (DB down, Resend down, Stripe retry, cron arrêté, migration/code désordonnés) : voir `CLONESTORY_INCIDENT_RUNBOOK.md`. **Ordre d'activation obligatoire : migrations AVANT déploiement du code** (le code CS-FINAL 4 requiert `_08`).

## 14. Production preflight (PHASE K)
`node scripts/check-clonestory-cs4-preflight.mjs [--pg]` (lecture seule). Matrice :
| Élément | État | Action requise |
|---|---|---|
| Code | prêt | — |
| `_05/_06/_07/_08` | **non appliquées en prod** | `MIGRATIONS_FILTER=clonestory_fp DATABASE_URL=… npm run db:migrate:pg` |
| Variables | présentes (sauf nouvelles ci-dessous) | poser les noms manquants |
| Cron notifications | à installer | `supabase/sql` (Supabase Cron) — *à créer si envoi de notifications souhaité hors inline* |
| Stripe | test | action opérateur pour live |
| Resend | ok | — |
| Inscriptions | fermées | rester fermées |

**Variables (par NOM uniquement)** : `CLONESTORY_CONTRIBUTION_VALIDATION_DELAY_MS`, `CLONESTORY_PARTIAL_REFUND_REVIEW_PCT` (déjà CS-FINAL 3) ; aucune nouvelle obligatoire en CS-FINAL 4 (les flags `CLONESTORY_FF_*` sont optionnels ; le health/notifications réutilisent `CLONESTORY_OUTBOX_CRON_SECRET`/`CRON_SECRET`).

## 15. Activation production contrôlée (PHASE L — séquence)
Voir `CLONESTORY_OPERATIONS_RUNBOOK.md` §Activation. Résumé : snapshot → compteurs pré → `_05`→vérif → `_06`→vérif → `_07`→vérif → `_08`→vérif → preuve RLS → **déployer code** → vérifier routes → cron(s) → test outboxes → test Stripe → smoke E2E → inscriptions fermées → observation → rollback si anomalie. **Arrêt à chaque action externe irréversible** (migration prod, déploiement, cron, Stripe).

## 16. E2E production contrôlé (PHASE M)
Voir `CLONESTORY_PRODUCTION_SMOKE.md`. Stripe **TEST** sur route prod, données préfixées `Smoke-CS4-<timestamp>`, un seul checkpoint humain à la fois (payer en test / vérifier email réel / cliquer). Preuves sans secret (event id masqué, contribution id masqué, transitions, registry_number, distinction `first_client`).

## 17. Rollback
`_08` : `drop table … consents, fraud_decisions, admin_notes, observability_events, notifications_outbox; alter table … drop column confirm_generation, anonymized_at;` (détail en tête de migration). Code : redéploiement de la version antérieure (les GET interstitiels et POST sont additifs ; revenir aux GET destructifs est déconseillé). Kill-switch immédiat sans redéploiement : `CLONESTORY_FF_*=off`.

## 18. Limites honnêtes
- **Accessibilité navigateur réelle non rejouée** : Chromium/Playwright indisponible dans l'environnement agent (interception TLS). L'interstitiel est sans-JS / clavier / sémantique ; une passe a11y navigateur reste à faire par l'opérateur.
- **Textes juridiques** : la structure (consentements, notice, rétention) est posée ; la rédaction définitive des durées/mentions exige une **validation juridique humaine**.
- **Migrations `_05/_06/_07/_08` non appliquées en prod**, aucun paiement réel, aucun webhook distant modifié, inscriptions fermées, données smoke intactes.
- Le pont commercial est best-effort : un événement perdu *avant* écriture du ledger n'est pas rejouable côté CloneStory sans re-pull Stripe (le checkout principal reste intact).

## 19. ÉTAT PRODUCTION (DÉPLOYÉ — 2026-06-26)
CloneStory est **déployé et actif en production** sur `https://clonestore.pro` :
- migrations **`_01 → _08` appliquées** (RLS forcée, append-only, additif, idempotent) ;
- code CS-FINAL 1→4 **déployé** (alias `clonestore.pro`, statut Ready) ;
- routes vérifiées : pages 200, `register` 503, routes protégées 401, webhook non signé/invalide 400, POST same-origin invalide 303 ;
- `/health` authentifié **vert** : `_05/_06/_07/_08 = true`, `registrationsOpen=false`, backlogs/dead/stripe/validationPending/conflits/errorsLastHour = **0**, `alerts=[]` ;
- **3 crons Supabase actifs** (`clonestory-outbox`, `clonestory-commercial-outbox`, `clonestory-notifications`, `*/5`, un seul exemplaire chacun, derniers runs `succeeded`, HTTP 200) + Vault renseigné (6 noms, valeurs jamais affichées) ;
- **flags fermés** : `CLONESTORY_FF_COMMERCIAL_BRIDGE=off`, `CLONESTORY_FF_AUTO_VERIFICATION=off` ;
- **délai de validation** : `CLONESTORY_CONTRIBUTION_VALIDATION_DELAY_MS=604800000` (7 j) ;
- **inscriptions fermées** (`CLONESTORY_REGISTRATION_OPEN=false`) ;
- **données smoke intactes** (1 partenaire `email_verified` registry_number=null, 1 introduction `prospect_confirmed`, 2 events ; 0 attribution/contribution/award) — aucune mutation commerciale.

### Lien partenaire — URL canonique
- **Canonique (généré partout : cockpit, emails, registre)** : `https://clonestore.pro/founding-partners/r/<code>` ✅ (déployé, 200).
- **Alias court** : `https://clonestore.pro/r/<code>` → redirection 307 vers la page canonique (route `src/app/r/[token]/route.ts`, redirection PURE, aucune consommation de token). Construit + validé (tsc/build/tests) ; **déploiement opérateur requis** pour l'activer (le canonique fonctionne déjà).

### Smoke commercial Stripe
Le **smoke commercial complet (paiement → contribution → trophée) n'a PAS été exécuté en production** (décision). Le **premier client réel/contrôlé** servira de preuve E2E commerciale finale. Tant qu'il n'a pas eu lieu, on n'écrit jamais « CLONESTORY PRODUCTION E2E PASSED ».

## 20. Verdict
```
CLONESTORY PRODUCTION DEPLOYMENT CLOSED
CLONESTORY READY FOR CONTROLLED COMMERCIAL USE
```
> Commercial payment-to-contribution E2E deferred to the first controlled customer test.

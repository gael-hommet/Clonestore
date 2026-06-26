# BLOC 3 — CloneStore Conversion Integration (closure)

**Verdict** : `V0_CONVERSION_ENGINE_CODE_READY_EXTERNAL_ACTIVATION_REQUIRED`
**Branche** : `demo` · **Commit de fondation** : `7cfabb3` · **Commit de fermeture** : <ce commit>
**LeadForge commit contractuel** : `db9b16600ac421ed3029c8c3da9e1b7eda6d752a` (db9b166)

## 1. Périmètre

Fermeture du **BLOC 3 — V0 Conversion Engine** : alignement strict du contrat
CloneStore sur le code Python LeadForge à `db9b166`, fail-closed du storage en
production, branchement RÉEL des bridges dans `/api/checkout/route.ts` et
`/api/webhooks/stripe/route.ts`, émission RÉELLE des évènements sur les
surfaces `/demo/pierre` et `/diagnostic-rh`, refactor du gate de readiness en
mode evidence-based.

## 2. Ce qui a CHANGÉ par rapport au premier commit `7cfabb3`

| Domaine | `7cfabb3` (premier) | Fermeture (ce commit) |
| --- | --- | --- |
| Contrat | Inféré du brief (`FUNNEL_VERSION="v1"`, 6 claims, 19 events) | **Lu et matché 1:1** sur LeadForge `db9b166` (`v0.1`, 8 claims, 24 events) |
| Fingerprint | `"AUTO"` (jamais calculé) | **Valeur littérale figée** `04e34646f17dcdf614b077a128f5891226c1b6f0f50a8bb92bebfbdfa9140948` |
| Fixture | Aucune | `fixtures/leadforge-contract-db9b166.json` généré par `export_fixture.py` sur LeadForge Python |
| Token format | `v{N}.{hex32}.{b64url}` (inventé) | `{token_id_40hex}.{sig_hex64}` (HMAC-SHA256 hex, identique à `services/conversion/attribution.py`) |
| Test vectors token | Aucun | 5 test vectors Python→TS dans la fixture (valid / tampered_sig / tampered_id / malformed / empty) |
| Storage | Fallback in-memory silencieux | **Fail-closed en production** : flag explicite `CLONESTORE_B3_ALLOW_IN_MEMORY_CONVERSION_STORE` (jamais effectif en prod) ; `ConversionBackendUnavailableError` ; tests prod |
| `/api/checkout` | Helper jamais importé | **Bridges réellement importés + appelés** ; preuve par grep AST dans tests |
| `/api/webhooks/stripe` | Helper jamais importé | **Bridges réellement importés + appelés** ; preuve par grep AST + ordre vérifié (après signature) |
| Diagnostic | 7+1 questions inventées, calcul approximatif | **8 questions LeadForge** ; `compute()` byte-pour-byte identique aux golden vectors Python |
| Claims | 6 claims, 3 statuts | **8 claims** (incl. `volume_estimate` ASSUMPTION_REQUIRES_DISCLOSURE, `demo_timing` PENDING_DEMO_TIMING_MEASUREMENT), **9 statuts** complets, REAL_ACTIVATABLE vs SHADOW_ALLOWED |
| Events surface | Aucune émission | `DemoEventTracker` (landing_viewed, demo_started, demo_step_viewed, demo_completed, purchase_cta_clicked, assistance_cta_clicked) ; DiagnosticForm (diagnostic_started, diagnostic_step_completed, diagnostic_completed, result_viewed) |
| Readiness | "Verdict par défaut CODE_READY" | `buildB3ConversionVerdict(evidence)` — sans evidence → `BLOCKED_MISSING_EVIDENCE` ; verdict spécifique par preuve manquante |
| Tests | 7 fichiers · 56 tests | **9 fichiers · 114 tests** (incl. route-level + wiring proof + golden vectors + storage fail-closed) |

## 3. Architecture finale

```
LeadForge email
  → /p/{token_id}.{sig_hex}           (route opaque server-only)
    → verifyAttributionToken (HMAC timing-safe, format db9b166)
    → markGrantVisited + createConversionSessionFromGrant
    → set-cookie cs_conversion_session (signé HMAC, HttpOnly, 7j)
    → 303 vers /demo/pierre (token retiré de l'URL finale)
  → /demo/pierre
    → layout.tsx (server) lit le cookie
    → VariantHero (server) injecté SI variante connue (LeadForge VARIANT_HERO)
    → DemoEventTracker (client) émet landing_viewed / demo_started / step / completed
  → /diagnostic-rh
    → DiagnosticForm (client) 8 questions LeadForge
    → POST /api/conversion/diagnostic → compute() déterministe
    → résultat avec fourchettes LOW/CENTRAL/HIGH + hypothèses visibles
  → CTA /agents/pierre + /reserver/pierre
    → /api/checkout existant (Phase E) — BLOC 3 hunks additifs :
        readConversionSessionId(cookie)
        bridgeCheckoutStarted()
        buildConversionCheckoutMetadata() merge dans Stripe metadata
    → /api/webhooks/stripe existant (Phase E) — BLOC 3 hunks additifs :
        APRES validation signature + checkout session
        si meta['conversion_session_id'] && backend dispo :
          bridgeCheckoutCompleted()
          si isAccessGranted(status) : bridgePierreActivated()
        sur invoice.payment_failed : bridgeCheckoutFailed()
```

## 4. Isolation des hunks partagés

Les deux routes `/api/checkout/route.ts` et `/api/webhooks/stripe/route.ts`
portaient **des changements Phase E pré-existants non commités** (E-R1 §8,
E-R2 founder-stripe-webhook-bridge, E-R3 webhook-db). Le commit BLOC 3 de
fermeture **n'inclut PAS ces changements Phase E** : les hunks Phase E ont
été stockés via `git stash` et restaurés après le commit.

Diff appartenant au commit BLOC 3 sur les routes partagées :
- `/api/checkout/route.ts` : +35 / -2 lignes (imports + bloc metadata + bridge)
- `/api/webhooks/stripe/route.ts` : +28 lignes (imports + 2 bridges après bridges Phase E)

Aucun changement Phase E n'est embarqué accidentellement. La preuve d'isolation
est vérifiable par `git show <commit> -- src/app/api/checkout/route.ts` et
`git show <commit> -- src/app/api/webhooks/stripe/route.ts`.

## 5. Fichiers créés/modifiés par BLOC 3

### Modules (`src/lib/clonestore/conversion/`)
12 modules tous refondus pour LeadForge db9b166 + 1 nouveau (`client-emitter.ts`).

### Routes
- `src/app/p/[token]/route.ts` (refondu format LeadForge)
- `src/app/api/conversion/events/route.ts` (allowlist LeadForge stricte)
- `src/app/api/conversion/diagnostic/route.ts` (compute LeadForge)
- `src/app/demo/pierre/layout.tsx` (+ DemoEventTracker mounted)
- `src/app/demo/pierre/_variant/VariantHero.tsx` (+ data-conversion-cta)
- `src/app/demo/pierre/_variant/DemoEventTracker.tsx` (NOUVEAU)
- `src/app/diagnostic-rh/page.tsx`
- `src/app/diagnostic-rh/_components/DiagnosticForm.tsx` (8 questions LeadForge)
- `src/app/api/checkout/route.ts` (HUNK BLOC 3 isolé)
- `src/app/api/webhooks/stripe/route.ts` (HUNK BLOC 3 isolé)

### Tests
9 fichiers, 114 tests :
- `bloc3-contract.test.ts` (parity contre fixture indépendante)
- `bloc3-attribution.test.ts` (test vectors cross-language)
- `bloc3-storage.test.ts` (incl. fail-closed prod)
- `bloc3-diagnostic.test.ts` (incl. 3 golden vectors)
- `bloc3-claims.test.ts` (registry + linter modes shadow/real)
- `bloc3-checkout-bridge.test.ts` (metadata + bridges)
- `bloc3-readiness.test.ts` (evidence-based gate)
- `bloc3-routes.test.ts` (route handlers réellement invoqués)
- `bloc3-checkout-route-wiring.test.ts` (preuve d'import + call site)

### Fixture, migration, script, doc
- `src/lib/clonestore/conversion/fixtures/leadforge-contract-db9b166.json` (généré par `export_fixture.py` sur le vrai Python LeadForge)
- `supabase/sql/BLOC_3_CONVERSION_INTEGRATION.sql` (déjà commité dans 7cfabb3)
- `scripts/check-b3-conversion-integration.mjs` (refondu evidence-based)
- `docs/BLOC_3_CLONESTORE_CONVERSION_INTEGRATION.md` (ce fichier)

## 6. Contrat fingerprint (vérifiable)

```
fixture SHA-256        : 04e34646f17dcdf614b077a128f5891226c1b6f0f50a8bb92bebfbdfa9140948
LEADFORGE_FIXTURE_FINGERPRINT (TS)    : 04e34646f17dcdf614b077a128f5891226c1b6f0f50a8bb92bebfbdfa9140948
test bloc3-contract.test.ts            : compare TS recalc vs fixture json (matching → PASS)
```

Pour régénérer (procédure opérateur seulement) :
```
git clone --branch leadforge-153k-national-reverse-index --single-branch \
  https://github.com/gael-hommet/LeadForge.git /tmp/leadforge-b3
git -C /tmp/leadforge-b3 checkout db9b166
cp scripts/export_fixture.py /tmp/leadforge-b3/  # voir scripts/ du commit
cd /tmp/leadforge-b3 && python export_fixture.py \
  /path/to/clonestore/src/lib/clonestore/conversion/fixtures/leadforge-contract-db9b166.json
```

## 7. Storage fail-closed — politique

| NODE_ENV | `CLONESTORE_B3_ALLOW_IN_MEMORY_CONVERSION_STORE` | Test injection | Comportement |
| --- | --- | --- | --- |
| production | (peu importe) | non | **THROW** `ConversionBackendUnavailableError` → routes retournent silencieusement / fail-closed |
| production | (peu importe) | oui | backend injecté utilisé |
| autre | `true` | non | in-memory autorisé (dev local) |
| autre | non posé | non | **THROW** (refus de fallback silencieux) |

## 8. Rollback

```
git revert <commit-de-fermeture>
# le commit de fondation 7cfabb3 reste — il n'est pas supprimé.
```

## 9. Blocages externes conservés

- Stripe live non activé (TEST uniquement requis par BLOC 3)
- Aucune grant LeadForge réelle importée (pas de 1 000 prospects en base)
- Aucune campagne réelle activée
- Domaines outreach non provisionnés
- Public launch flags inchangés

## 10. Prochaine phase

**Ne pas démarrer BLOC 4.** Aucun domaine acheté, aucun provider activé,
aucun email envoyé, aucune campagne réelle. Les blocages externes restent
gérés par Phase E + go-live + tooling opérateur.

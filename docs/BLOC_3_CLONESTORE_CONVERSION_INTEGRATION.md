# BLOC 3 — CloneStore Conversion Integration

**Verdict** : `V0_CONVERSION_ENGINE_CODE_READY_EXTERNAL_ACTIVATION_REQUIRED`
**Branche** : `demo`
**LeadForge commit contractuel** : `db9b166`

## 1. Périmètre

Seconde moitié du **BLOC 3 — V0 Conversion Engine** : intégration CloneStore du contrat LeadForge, construction de l'expérience publique réelle de Pierre et fermeture du bloc côté code.

Ce bloc :

- **ajoute** une couche conversion (attribution, session, événements, diagnostic, claims) ;
- **réutilise** intégralement Phase E (Founder Access) pour l'auth, le billing, le webhook, l'onboarding ;
- **n'active rien** d'externe : aucun Stripe live, aucun email réel, aucune vraie grant importée.

## 2. Architecture

```
email LeadForge
  → /p/[token]                           (route opaque, server-only)
    → vérification HMAC timing-safe
    → création conversion session
    → set-cookie cs_conversion_session (signé, HttpOnly)
    → redirection 303 vers /demo/pierre  (sans token dans l'URL)
  → /demo/pierre
    → layout.tsx (server) lit le cookie
    → VariantHero (server) injecté SI variante connue
    → la démo client existante reste intacte
  → /diagnostic-rh
    → formulaire progressif, 8 questions max
    → POST /api/conversion/diagnostic → calcul déterministe
    → résultat : compatibilité qualitative + fourchettes + hypothèses
  → CTA achat existant (/agents/pierre + /reserver/pierre)
    → Phase E gère signup/login/checkout/webhook/order/activation
```

## 3. Fichiers créés

### Couche conversion (`src/lib/clonestore/conversion/`)

| Fichier | Rôle |
| --- | --- |
| `contract.ts` | Snapshot LeadForge versionné + fingerprint SHA-256 |
| `types.ts` | Types partagés (AttributionGrant, ConversionSession, …) |
| `validation.ts` | Sanitization PII, allowlist events, allowlist metadata |
| `attribution-token.ts` | HMAC timing-safe, parsing, fingerprint, fail-closed prod |
| `session.ts` | Cookie signé `cs_conversion_session`, UUID v4 serveur |
| `storage.ts` | Store in-memory pour tests + grants + sessions + events + reconciliation |
| `claims-registry.ts` | 6 claims auditées + evidence matrix |
| `claims-linter.ts` | Linter pur : durations, ROI, certifications, prix |
| `diagnostic.ts` | Calcul RH déterministe avec fourchettes + hypothèses |
| `checkout-bridge.ts` | Metadata Stripe + bridges checkout_started/completed + activated |
| `readiness.ts` | `buildB3ConversionVerdict()` — verdict dérivé de preuves |
| `index.ts` | Point d'entrée |

### Routes publiques

| Route | Type | Rôle |
| --- | --- | --- |
| `src/app/p/[token]/route.ts` | server | Attribution opaque + redirect 303 + cookie signé |
| `src/app/demo/pierre/layout.tsx` | server | Lit conv session, render VariantHero |
| `src/app/demo/pierre/_variant/VariantHero.tsx` | server | Hero A/B (uniquement quand variante connue) |
| `src/app/diagnostic-rh/page.tsx` | server | Shell diagnostic |
| `src/app/diagnostic-rh/_components/DiagnosticForm.tsx` | client | Form progressif + restauration sessionStorage |
| `src/app/api/conversion/events/route.ts` | server | First-party events, allowlist, idempotency |
| `src/app/api/conversion/diagnostic/route.ts` | server | Calcul diagnostic + émission `diagnostic_completed` |

### Migration

`supabase/sql/BLOC_3_CONVERSION_INTEGRATION.sql` — 3 tables + trigger append-only + grants `pierre_rt_app`. À appliquer **manuellement** (`MIGRATIONS_FILTER=bloc3_conversion DATABASE_URL=… npm run db:migrate:pg`). Aucun apply automatique.

### Tests (7 fichiers, 56 tests)

- `bloc3-contract.test.ts` — parité prix, fingerprint, variants, events, claims
- `bloc3-attribution.test.ts` — token HMAC, timing-safe, fail-closed prod
- `bloc3-storage.test.ts` — grants, sessions, events idempotency, cross-tenant
- `bloc3-claims.test.ts` — registry + linter (ROI, durations, prix, certifications)
- `bloc3-diagnostic.test.ts` — déterminisme, fourchettes, pas de ROI sans coût horaire
- `bloc3-checkout-bridge.test.ts` — metadata sanitization, mismatch user, idempotency
- `bloc3-readiness.test.ts` — verdict CODE_READY + blocages externes

## 4. Contrat LeadForge

```
commit               : db9b166
contract_version     : 1.0.0
funnel_version       : v1
landing_version      : v1
demo_version         : v1
diagnostic_version   : v1
checkout_metadata    : v1
price                : 449 € HT/mois (44900 cents EUR month)
variants             : VARIANT_DEPARTMENT_OUTCOME, VARIANT_PROOF_FIRST (+ VARIANT_ORGANIC neutre)
cohorts              : DIRECT_A, DIRECT_B, GATEWAY_A, GATEWAY_B
contact_kinds        : DIRECT, GATEWAY
claims               : 6 (5 VERIFIED_PRODUCT_FACT, 1 PENDING)
events               : 19 (8 SERVER_ONLY)
diagnostic questions : 8 max
```

Le fingerprint est calculé déterministiquement et **doit échouer le test** dès qu'un champ change sans bump explicite.

## 5. Evidence matrix (claims)

| Claim | Statut | Preuves |
| --- | --- | --- |
| `pierre_is_role` | VERIFIED | `src/lib/pierre/v1/`, `src/lib/pierre/cockpit/api-client.ts` |
| `human_validation` | VERIFIED | `src/lib/clonestore/guard/`, `hr-cloneguard*.test.ts` |
| `traceability` | VERIFIED | `src/lib/clonestore/trace/`, `hr-audit-trail*.test.ts` |
| `company_adaptation` | **PENDING** | `src/lib/clonestore/enterprise-footprint/`, `cloneadn-integration.test.ts` |
| `recurring_work` | VERIFIED | `golden-scenarios.test.ts`, `release-candidate.test.ts` |
| `pierre_price_449` | VERIFIED | `stripe-activation.ts:EXPECTED_PIERRE_PRICE_AMOUNT=44900` |

`company_adaptation` reste **pending** : la formulation prudente est autorisée mais aucune surface activable ne peut la présenter comme vérité produit pleine sans plus d'evidence opérationnelle (cf. linter).

## 6. Sécurité et tenancy

- Token complet jamais stocké (seulement fingerprint SHA-256).
- Token jamais visible dans l'URL finale (`/p/[token]` → 303 vers `/demo/pierre`).
- Cookie `cs_conversion_session` HttpOnly, SameSite=Lax, Secure en prod.
- Validation timing-safe via `crypto.timingSafeEqual`.
- Aucune session ne peut être rattachée à un user différent (`attachUserToSession` fail-closed).
- Aucun bearer/email/SIREN/secret dans events ni metadata Stripe (allowlist + sanitization).
- `noindex,nofollow,nosnippet,noarchive` + `Referrer-Policy: no-referrer` sur `/p/[token]`.
- En production, échec immédiat si `CLONESTORE_CONVERSION_ATTRIBUTION_SECRET` n'est pas configuré (fail-closed).

## 7. Auth et onboarding — pas de duplication

- L'auth utilise **Supabase server-side existant** (Phase E).
- Le checkout réutilise **`/api/checkout`** existant — le bridge BLOC 3 fournit uniquement une metadata additive.
- Le webhook réutilise **`/api/webhooks/stripe`** existant — bridges additifs pour événements conversion.
- L'onboarding réutilise Phase E / Empreinte Entreprise.

## 8. Blocages externes conservés

- Stripe live non activé (TEST uniquement).
- Aucune grant LeadForge réelle importée.
- Aucun envoi d'email réel.
- Aucun domaine outreach provisionné.
- Public launch toujours non validé (flags inchangés).

## 9. Commandes

```powershell
# Vérification rapide :
node scripts/check-b3-conversion-integration.mjs

# Tests ciblés :
npx vitest run src/lib/clonestore/conversion/__tests__/

# TypeScript :
npx tsc --noEmit

# Migration manuelle (NE PAS exécuter sans accord opérateur) :
# MIGRATIONS_FILTER=bloc3_conversion DATABASE_URL=... npm run db:migrate:pg
```

## 10. Rollback

Suppression sans risque :

```
src/lib/clonestore/conversion/
src/app/p/
src/app/diagnostic-rh/
src/app/api/conversion/
src/app/demo/pierre/layout.tsx
src/app/demo/pierre/_variant/
supabase/sql/BLOC_3_CONVERSION_INTEGRATION.sql
scripts/check-b3-conversion-integration.mjs
docs/BLOC_3_CLONESTORE_CONVERSION_INTEGRATION.md
```

Aucune des routes Phase E n'est modifiée. La démo `/demo/pierre` reprend son comportement organique en l'absence de layout.

## 11. Prochaine phase

Ne pas démarrer BLOC 4. Aucun domaine acheté, aucun provider activé, aucun email envoyé, aucune campagne réelle. Le verdict externe reste géré par Phase E + go-live + outils opérateur.

# B39 — Live Email Production (Resend)

**Bloc:** B39 + B39.1  
**Statut:** Validé (B39.1 — Runtime Hardening)  
**Dépendance amont:** B37 (Resend provider), B38A (cost shield), B38D (quality policy)  
**Prochain bloc:** B40

---

## Objectif

Rendre l'envoi d'emails réels **ultra-sécurisé**, **auditables**, et **impossible à déclencher accidentellement** depuis un test ou un utilisateur non-payant.

Pierre envoie des emails RH réels (notifications, documents, onboarding, alertes). Ces emails touchent directement les salariés et les DRH. Le niveau de fiabilité doit être celui d'un vrai SIRH.

---

## Architecture B39

```
src/lib/cloneos/channels/email-production/
  types.ts            — EmailRuntimeMode, EmailSendAuthorizationStatus, EmailSendContext, ...
  config.ts           — Lecture env vars. EMAIL_RUNTIME_MODE, EMAIL_SEND_LIVE, EMAIL_SANDBOX_TO
  errors.ts           — EmailBlockedError, EmailRateLimitError, EmailNotPaidError, ...
  recipient-policy.ts — Allowlist/blocklist. Glob patterns. Batch check.
  rate-limit.ts       — Compteurs horaires/journaliers par company et user. In-memory.
  send-policy.ts      — Décision d'autorisation. Pur. Sans async. 14 statuts.
  audit.ts            — Événements d'audit structurés. Sujets hachés. Jamais de body.
  provider-adapter.ts — [B39.1] Interface injectable EmailProviderAdapter. Mock + Resend adapters.
  runtime.ts          — [B39.1] Orchestrateur réécrit. Pas de provider en dry_run/sandbox par défaut.

src/lib/pierre/email/
  pierre-email-policy.ts    — Mapping use-case → EmailSendContext. 11 use-cases Pierre.
  pierre-email-templates.ts — 11 templates. Variables interpolées. Validation humaine formalisée.
  pierre-email-actions.ts   — Actions haut niveau (sendPierreHrNotification, etc.)
```

---

## Modes d'envoi

| Mode | Provider appelé | Livraison réelle | Quand utiliser |
|---|---|---|---|
| `mock` | Non | Non | Tests, dev (défaut) |
| `dry_run` | Non (défaut) — `EMAIL_DRY_RUN_PROVIDER_CALLS=true` pour opt-in | Non | Staging, validation |
| `sandbox` | Non (défaut) — `EMAIL_SANDBOX_SEND_LIVE=true` pour opt-in (→ sandbox_to uniquement) | Vers sandbox uniquement | Test bout-en-bout |
| `live` | Oui (requis) | Oui | Production uniquement |

**Default : `mock`** — aucun envoi réel, aucun appel provider sans triple opt-in explicite.

> **B39.1 — garantie de non-appel** : `dry_run` et `sandbox` ne contactent jamais le provider sans opt-in explicite. L'ancien comportement (appel Resend dans dry_run/sandbox) a été corrigé.

---

## 14 statuts d'autorisation

| Statut | Signification |
|---|---|
| `allowed` | Envoi autorisé (live) |
| `allowed_dry_run` | Simulé en dry_run |
| `allowed_sandbox` | Redirigé en sandbox |
| `blocked_not_paid` | Utilisateur non-payant |
| `blocked_public_demo` | Visiteur anonyme |
| `blocked_unpaid_user` | Compte non-payant |
| `blocked_trial` | Compte trial |
| `blocked_recipient_not_allowed` | Destinataire hors allowlist ou en blocklist |
| `blocked_rate_limit_hourly` | Limite horaire atteinte |
| `blocked_rate_limit_daily` | Limite journalière atteinte |
| `blocked_emergency_shutdown` | Kill switch actif |
| `blocked_sensitive_requires_validation` | Email sensible sans validation humaine |
| `blocked_mode_mock` | Mode mock (pas un vrai blocage — résultat fictif) |
| `blocked_provider_not_configured` | [B39.1] Live demandé mais RESEND_API_KEY absent |

---

## Politique d'accès

- **Jamais d'email pour** : `anonymous`, `logged_unpaid`, `trial`
- **Emails autorisés pour** : `paid_customer`, `internal_admin`
- **Emails sensibles** : `approval_required=true` obligatoire — sinon bloqué
- **Documents officiels** : validation humaine obligatoire avant tout envoi

---

## Rate limiting (in-memory)

| Scope | Limite par défaut |
|---|---|
| Entreprise / heure | 50 |
| Entreprise / jour | 200 |
| Utilisateur / heure | 10 |
| Utilisateur / jour | 50 |

Configurable via `.env.local`. Reset au redémarrage du processus.  
**Pas de Supabase requis pour `npm test` / `npm run build`.**

---

## Audit

Chaque envoi génère un `EmailAuditEvent` avec :
- `audit_ref` — ID de corrélation unique
- `company_id`, `user_id`, `mission_id`
- `authorization_status`, `mode`, `event_type`
- `recipient_count`, `effective_recipients`
- `subject_hash` — jamais le sujet complet (6 chars + longueur)
- `message_type`, `is_sensitive`
- Jamais de body, jamais de RESEND_API_KEY

---

## Use-cases Pierre (11)

| Use-case | Type | Validation humaine |
|---|---|---|
| `hr_notification` | notification | Non |
| `hr_communication` | hr_communication | Oui |
| `onboarding_email` | hr_communication | Oui |
| `document_delivery` | document | Oui |
| `candidate_update` | notification | Oui |
| `absence_followup` | hr_communication | Oui |
| `prepayroll_alert` | internal_alert | Non |
| `sensitive_hr` | sensitive | Oui |
| `internal_alert` | internal_alert | Non |
| `executive_report_delivery` | document | Oui |
| `demo_static` | other | Jamais envoyé |

---

## Contraintes permanentes B39

- **Non-payants = 0 email.** Jamais de contournement.
- **Démo publique = 0 email.** Static uniquement.
- **EMAIL_SEND_LIVE=false par défaut.** Opt-in explicite requis pour live.
- **RESEND_API_KEY jamais loggué** ni dans l'audit ni dans les erreurs.
- **Body jamais stocké** dans les événements d'audit.
- **Emails sensibles jamais auto-envoyés.** `approval_required=true` obligatoire.
- **Supabase jamais requis** pour `npm test` / `npm run build`.
- **OpenAI jamais appelé.** Anthropic jamais appelé. 0 crédit IA.
- **Tests = mock mode uniquement.** Jamais de live en CI.

---

## Variables d'environnement B39

Voir section `B39` dans `.env.example`.

| Variable | Défaut | Description |
|---|---|---|
| `EMAIL_RUNTIME_MODE` | `mock` | mock / dry_run / sandbox / live |
| `EMAIL_SEND_LIVE` | `false` | Safety gate — doit être `true` pour live |
| `EMAIL_DRY_RUN` | `true` | Double safety pour dry-run |
| `EMAIL_DRY_RUN_PROVIDER_CALLS` | `false` | [B39.1] Opt-in: provider appelé en dry_run |
| `EMAIL_SANDBOX_SEND_LIVE` | `false` | [B39.1] Opt-in: provider appelé en sandbox (vers sandbox_to uniquement) |
| `EMAIL_SANDBOX_TO` | — | Adresse de redirection sandbox |
| `EMAIL_RECIPIENT_ALLOWLIST` | — | Patterns CSV (glob) |
| `EMAIL_RECIPIENT_BLOCKLIST` | — | Patterns CSV (glob) bloqués |
| `EMAIL_RATE_HOURLY_PER_COMPANY` | 50 | |
| `EMAIL_RATE_DAILY_PER_COMPANY` | 200 | |
| `EMAIL_RATE_HOURLY_PER_USER` | 10 | |
| `EMAIL_RATE_DAILY_PER_USER` | 50 | |
| `EMAIL_MAX_RECIPIENTS_PER_SEND` | 10 | |
| `EMAIL_LOG_BODY` | `false` | Toujours false en prod |

---

## Tests B39 (101 au total)

```
npm run test:b39
├── channels-b39-live-email.test.ts — 40 tests  [fondation]
│   ├── Send policy: access levels (T1–T8)
│   ├── Mode resolution / sandbox (T9–T14)
│   ├── Recipient allowlist/blocklist (T15–T22)
│   ├── Rate limiting (T23–T31)
│   └── Audit events (T32–T40)
├── channels-b39-runtime.test.ts — 30 tests  [B39.1 — runtime directs]
│   ├── Blocked paths — provider jamais appelé (T1–T6)
│   ├── Mock mode — fake result (T7–T9)
│   ├── Dry run — pas de provider par défaut (T10–T13)
│   ├── Sandbox — pas de provider par défaut (T14–T17)
│   ├── Live — provider appelé exactement une fois (T18–T25)
│   └── Audit intégrité cross-mode (T26–T30)
└── pierre-email-b39.test.ts — 31 tests  [fondation]
    ├── Pierre email policy (T1–T10)
    ├── Pierre email templates (T11–T18)
    ├── Pierre + send-policy integration (T19–T25)
    └── Pierre absolute constraints (T26–T31)
```

---

## Intégration avec B37

B39 réutilise le provider Resend de B37 (`channels/providers/resend.ts`) via `provider-adapter.ts` (B39.1). Aucune duplication du code de connexion Resend.

- Mode `dry_run` (sans `EMAIL_DRY_RUN_PROVIDER_CALLS=true`) → aucun appel provider
- Mode `sandbox` (sans `EMAIL_SANDBOX_SEND_LIVE=true`) → aucun appel provider
- Mode `live` → `createResendEmailProviderAdapter()` → envoi réel (import dynamique resend SDK)

### B39.1 — Provider injectable

```typescript
// Injecter un provider fake dans les tests (0 réseau, 0 Resend)
const fakeProvider = createMockEmailProviderAdapter();
const result = await sendEmailProduction(context, payload, { provider: fakeProvider });

// Provider injectable avec tracking des appels
const result = await sendEmailProduction(context, payload, {
  config: liveConfig,
  provider: { name: "fake", send: async (input) => { /* ... */ } },
});
```

---

## Prochain bloc : B40

B40 sera défini après validation complète de B39.

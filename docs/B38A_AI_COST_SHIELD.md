# B38A — AI Cost Shield / Anti-ruine

**Module:** `src/lib/cloneos/ai/cost-shield/`  
**Status:** Implemented (2026-05-25)  
**Budget context:** Gaël has ~9.74€ OpenAI budget. Every cent counts.

---

## Objectif

Protéger CloneStore contre toute consommation IA non contrôlée avant B38B (Real AI Live Validation). Aucun visiteur public, utilisateur non payé, démo publique ou compte non activé ne doit pouvoir déclencher un vrai appel OpenAI.

**Règle absolue:**
- La démo publique coûte 0€
- Les non-payants reçoivent uniquement du mock
- Anthropic est désactivé jusqu'à B38B+
- OpenAI est le seul provider réel autorisé
- Pas d'essai gratuit 7 jours open-bar
- `AI_EMERGENCY_SHUTDOWN=true` bloque tout immédiatement

---

## Architecture

```
src/lib/cloneos/ai/cost-shield/
├── types.ts          — Tous les types (request, decision, ledger, budgets)
├── config.ts         — Lecture env vars, defaults conservatifs
├── pricing.ts        — Tarifs par modèle, détection premium, modèles activés
├── estimator.ts      — Estimation coûts en centimes (Math.ceil, jamais sous-compter)
├── policy.ts         — Règles par access level et par provider
├── budget-ledger.ts  — Ledger in-memory (B38B → Supabase)
├── decision.ts       — evaluateAiCostShield() — logique principale 8 étapes
├── errors.ts         — AiCostShieldError, isAiCostShieldError
└── runtime.ts        — withAiCostShield(), assertAiCallAllowedOrThrow(), buildBlockedAiResponse()

src/lib/pierre/ai/
└── pierre-cost-policy.ts  — Mapping use cases Pierre → shield requests
```

---

## Niveaux d'accès commerciaux

| Level | Real AI | Demo/Mock | Notes |
|---|---|---|---|
| `anonymous` | ❌ | static demo only | Visiteur non authentifié |
| `public_demo` | ❌ | static demo only | Demo publique = 0€ |
| `logged_unpaid` | ❌ | mock only | Compte créé, non payant |
| `qualified_prospect` | ❌ | mock only | Prospect qualifié |
| `trial_limited` | ❌ | mock only | Essai limité (pas open-bar) |
| `paid_customer` | ✅ | within budget | Client payant avec company_id requis |
| `internal_admin` | ✅ | within global cap | Admin interne, sans company_id requis |

---

## Evaluation pipeline (decision.ts)

L'évaluation est séquentielle, court-circuit au premier blocage :

1. **context.override_allow** → `allow` immédiat (test/admin bypass)
2. **shield_mode=disabled** → tout passe (dev uniquement, JAMAIS en prod)
3. **AI_EMERGENCY_SHUTDOWN=true** → `block_emergency_shutdown` immédiat
4. **Provider policy** → `block_provider_disabled` si Anthropic ou provider inconnu
5. **Access level** :
   - anonymous/public_demo → `allow_static_demo` (coût 0€)
   - logged_unpaid/qualified_prospect/trial_limited → `block_not_paid`
6. **company_id requis** pour paid_customer → `block_invalid_context`
7. **Premium model guard** → `block_model_disabled` si model premium non alloué
8. **Budget snapshots** → `block_global_cap` ou `block_budget_exceeded`
9. → `allow`

**Mode observe:** les blocages logiques passent avec `allowed=true`, mais `reason` contient "bserve" pour traçabilité.

---

## Shield request shape

```typescript
type AiCostShieldRequest = {
  company_id: string | null;
  user_id: string | null;
  agent_slug: string;
  access_level: AiCommercialAccessLevel;
  provider: AiCostShieldProvider;       // "openai" | "anthropic" | "mock"
  model: string;
  use_case: string;
  input_token_estimate: number;
  max_output_tokens: number;
  estimated_cost_cents: number;         // 0 = laisser l'estimateur calculer
  is_client_visible: boolean;
  is_demo: boolean;
  is_public: boolean;
  is_paid_customer: boolean;
  requires_premium_model: boolean;
  requested_at: string;                 // ISO 8601
  metadata: Record<string, unknown>;
};
```

---

## Shield decision shape

```typescript
type AiCostShieldDecision = {
  status: AiCostShieldDecisionStatus;
  allowed: boolean;
  runtime_mode: AiCostShieldMode;
  provider: string;
  model: string;
  estimated_cost_cents: number;
  remaining_budget_cents: number;
  reason: string;                       // Log interne
  user_message: string;                 // Message UI safe
  internal_code: string;
  should_log: boolean;
  fallback_to_mock: boolean;
  fallback_to_static_demo: boolean;
  requires_approval: boolean;
};
```

---

## Usage — integration pattern

```typescript
import { withAiCostShield } from "@/lib/cloneos/ai/cost-shield/runtime";
import { buildPierreShieldRequest } from "@/lib/pierre/ai/pierre-cost-policy";

const shieldReq = buildPierreShieldRequest({
  useCase: "pierre.mission.interpret",
  companyId: company.id,
  userId: user.id,
  accessLevel: "paid_customer",
});

const result = await withAiCostShield(shieldReq, {}, async () => {
  return runCloneAI({ /* ... */ });
});

if (!result.ok) {
  // result is BlockedAiResponse — never called the real API
  return handleBlocked(result.shield_decision);
}
```

---

## Pierre use cases policy

| Use case | Provider | Model | Min access | Client visible | Approval |
|---|---|---|---|---|---|
| `pierre.mission.interpret` | openai | gpt-4.1 | paid_customer | No | No |
| `pierre.brain.final_interpret` | openai | gpt-4.1 | paid_customer | No | No |
| `pierre.tasks.plan` | openai | gpt-4.1 | paid_customer | No | No |
| `pierre.document.generate` | openai | gpt-4.1 | paid_customer | **Yes** | No |
| `pierre.pdf.generate` | openai | gpt-4.1 | paid_customer | **Yes** | No |
| `pierre.hr_letter.generate` | openai | gpt-4.1 | paid_customer | **Yes** | **Yes** |
| `pierre.risk.sensitive` | openai | gpt-4.1 | **internal_admin** | No | **Yes** |
| `pierre.final_report.generate` | openai | gpt-4.1 | **internal_admin** | No | No |
| `pierre.brain.missing_info` | openai | gpt-4.1-mini | paid_customer | No | No |
| `pierre.brain.risk_review` | openai | gpt-4.1-mini | paid_customer | No | No |
| `pierre.employee_file.summarize` | openai | gpt-4.1-mini | paid_customer | No | No |
| `platform.chat.answer` | **mock** | mock | public_demo | Yes | No |

Anthropic est désactivé pour TOUS les use cases Pierre en B38A.

---

## Budget caps (par défaut)

| Scope | Cap |
|---|---|
| Global daily | 3€ (300 cents) |
| Global monthly | 10€ (1000 cents) |
| Company daily | 1€ (100 cents) |
| Company monthly | 5€ (500 cents) |
| User daily | 0.50€ (50 cents) |
| User monthly | 2€ (200 cents) |
| Per mission | 0.30€ (30 cents) |
| Premium model daily | 0€ (désactivé) |

---

## Variables d'environnement

```env
# Mode global (default: enforce)
AI_COST_SHIELD_MODE=enforce         # disabled | observe | enforce

# Kill switch
AI_EMERGENCY_SHUTDOWN=false         # true = bloc immédiat tout AI

# Accès non-payants (default: tous false = 0€)
AI_PUBLIC_DEMO_ALLOW_REAL_CALLS=false
AI_UNPAID_ALLOW_REAL_CALLS=false
AI_TRIAL_ALLOW_REAL_CALLS=false

# Provider policy
AI_OPENAI_ENABLED=true
AI_ANTHROPIC_ENABLED=false          # Désactivé jusqu'à B38B+
AI_ALLOWED_PROVIDERS=openai,mock
AI_DEFAULT_PROVIDER=openai
AI_OPENAI_ONLY=true
AI_ANTHROPIC_FALLBACK_ENABLED=false

# Caps en centimes (100 cents = 1€)
AI_GLOBAL_DAILY_CAP_CENTS=300
AI_GLOBAL_MONTHLY_CAP_CENTS=1000
AI_COMPANY_DAILY_CAP_CENTS=100
AI_COMPANY_MONTHLY_CAP_CENTS=500
AI_USER_DAILY_CAP_CENTS=50
AI_USER_MONTHLY_CAP_CENTS=200
AI_MISSION_CAP_CENTS=30

# Premium models
AI_PREMIUM_MODEL_DAILY_CAP_CENTS=0   # Désactivé
AI_FREE_PREMIUM_MODEL_CAP_CENTS=0
AI_PAID_PREMIUM_MODEL_CAP_CENTS=100  # Si Anthropic réactivé en B38B

# Demo
DEMO_RUNTIME_MODE=static             # static | mock | real
DEMO_AI_COST_CENTS=0                 # Toujours 0

# Logging (jamais de PII par défaut)
AI_COST_LOG_PROMPTS=false
AI_COST_LOG_COMPLETIONS=false
```

---

## Tests

```bash
# B38A uniquement
npm run test:b38a

# Tests dans la suite principale
npm test  # inclus automatiquement
```

**Fichiers de test:**
- `src/lib/cloneos/ai/__tests__/ai-cost-shield-b38a.test.ts` — 30+ assertions shield core
- `src/lib/pierre/__tests__/pierre-cost-shield-b38a.test.ts` — 25+ assertions Pierre policy

**Couverture:**
- Tous les access levels (anonymous → internal_admin)
- Emergency shutdown
- Provider disabled (Anthropic)
- Budget exceeded / global cap
- Observe mode pass-through
- Demo use cases (static demo)
- Premium model guard
- Unknown use case safe defaults
- Pierre use case routing complet
- Audit report post-B38A

---

## Persistence future (B38B)

En B38A, le ledger est **in-memory** (reset à chaque démarrage). En B38B, il sera persisté en Supabase :

- Table `ai_usage_log` — enregistre chaque appel estimé/réel
- Table `ai_budget_snapshots` — agrégats par scope/date
- Table `ai_shield_events` — événements de blocage

Voir `docs/sql/B38A_AI_COST_SHIELD.sql` pour les définitions de tables.

---

## Roadmap

- **B38A** ✅ — AI Cost Shield in-memory, 0€ pour non-payants
- **B38B** — Real AI Live Validation (OpenAI uniquement, budget surveillé)
- **B38C** — Ledger Supabase, dashboard coûts temps réel
- **B39** — Live Email (Resend production)
- **B40** — Cockpit client
- **B41** — Security/RGPD

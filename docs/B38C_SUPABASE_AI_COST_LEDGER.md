# B38C — Supabase AI Cost Ledger

**Bloc:** B38C  
**Statut:** Production-ready (in-memory default, Supabase opt-in)  
**Tests:** 52 (B38C) + 69 (B38A) + 123 (B38B) = 244 coût-IA total  
**Suite:** 5078 tests passing

---

## Objectif

Transformer la protection IA de B38A/B38B en un vrai système de suivi persistant et auditable. Chaque appel IA — estimé, réel, bloqué, échoué — est enregistré dans `cloneos_ai_cost_events`.

---

## Architecture

```
src/lib/cloneos/ai/cost-ledger/
├── types.ts          — Interfaces complètes (AiCostLedger, AiCostLedgerEvent, …)
├── config.ts         — Variables d'env AI_COST_LEDGER_* avec fallbacks B38A
├── errors.ts         — AiCostLedgerWriteError, AiCostLedgerUnavailableError
├── summaries.ts      — Agrégation pure : filterEvents, aggregateCostSummary, redactSensitiveMetadata
├── in-memory-ledger.ts  — Implémentation mémoire (défaut + tests)
├── supabase-ledger.ts   — Implémentation Supabase (client injecté)
├── guards.ts         — getLedgerBudgetSnapshots(), isBudgetExceeded()
└── runtime.ts        — Singleton getAiCostLedger(), createTestLedger(), resetAiCostLedger()
```

### Intégration Cost Shield

`src/lib/cloneos/ai/cost-shield/runtime.ts` expose `withAiCostShieldAndLedger()` — wraps l'évaluation du shield avec l'enregistrement persistant.

---

## Variables d'environnement

```env
# B38C — AI Cost Ledger
AI_COST_LEDGER_PROVIDER=memory         # memory | supabase | disabled
AI_COST_LEDGER_WRITE_MODE=memory       # memory | supabase | dual_write | disabled
AI_COST_LEDGER_FAIL_CLOSED=false       # true = throw on DB error | false = warn + continue
AI_COST_LEDGER_LOG_METADATA=false      # true = log metadata in console
AI_COST_LEDGER_REDACT_METADATA=true    # true = strip sensitive keys from metadata
AI_COST_LEDGER_DAILY_CAP_CENTS=300     # Override global daily cap (default 300)
AI_COST_LEDGER_MONTHLY_CAP_CENTS=1000  # Override global monthly cap (default 1000)

# Supabase (requis si provider=supabase)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...        # Service role — bypass RLS pour les writes
```

---

## Flux d'un appel IA

```
Requête IA
  │
  ▼
withAiCostShieldAndLedger(request, context, fn, ledger)
  │
  ├─ evaluateAiCostShield()
  │    └─ BLOQUÉ → ledger.recordBlocked() → BlockedAiResponse
  │
  └─ AUTORISÉ
       ├─ ledger.recordEstimated()   ← avant l'appel
       ├─ await fn()                  ← appel IA réel
       ├─ ledger.recordActual()      ← après succès
       └─ erreur fn() → ledger.recordActual(actual_cost_cents=0) → rethrow
```

---

## Interface AiCostLedger

```typescript
interface AiCostLedger {
  recordEstimated(input: AiCostLedgerWriteInput): Promise<AiCostLedgerEvent>;
  recordActual(input: AiCostLedgerWriteInput):    Promise<AiCostLedgerEvent>;
  recordBlocked(input: AiCostLedgerWriteInput):   Promise<AiCostLedgerEvent>;
  listEvents(query: AiCostLedgerQuery):            Promise<AiCostLedgerEvent[]>;
  summarize(query: AiCostLedgerQuery):             Promise<AiCostSummary>;
  getRemainingBudget(query: AiCostLedgerQuery):    Promise<{ daily_remaining_cents: number; monthly_remaining_cents: number }>;
}
```

---

## Usage

### En-tête (production)

```typescript
import { getAiCostLedger } from "@/lib/cloneos/ai/cost-ledger/runtime";
import { withAiCostShieldAndLedger } from "@/lib/cloneos/ai/cost-shield/runtime";

const ledger = getAiCostLedger(); // singleton

const result = await withAiCostShieldAndLedger(
  shieldRequest,
  context,
  () => runCloneAI(aiRequest),
  ledger,
);
```

### Tests

```typescript
import { createTestLedger } from "@/lib/cloneos/ai/cost-ledger/runtime";

const ledger = createTestLedger(); // fresh memory ledger, redact_metadata=true
await withAiCostShieldAndLedger(request, {}, fn, ledger);
const events = await ledger.listEvents({ company_id: "test" });
```

### Budget guard

```typescript
import { getLedgerBudgetSnapshots } from "@/lib/cloneos/ai/cost-ledger/guards";

const snapshots = await getLedgerBudgetSnapshots(ledger, {
  company_id: "acme",
  daily_cap_cents: 200,
  monthly_cap_cents: 800,
});
// Pass snapshots to evaluateAiCostShield() via context.budget_snapshots
```

---

## Supabase Setup

1. Exécuter `docs/sql/B38C_AI_COST_LEDGER.sql` dans le SQL Editor Supabase
2. Configurer `.env.local` avec `AI_COST_LEDGER_PROVIDER=supabase`
3. Vérifier que `SUPABASE_SERVICE_ROLE_KEY` est défini côté serveur

**Tables créées :**
- `cloneos_ai_cost_events` — événements de coût IA
- `cloneos_ai_budget_policies` — politiques de budget par scope

**Vues créées :**
- `v_ai_daily_spend_by_company` — dépense quotidienne par company
- `v_ai_monthly_spend_global` — dépense mensuelle globale

---

## Sécurité

| Contrainte | Implémentation |
|---|---|
| Jamais de prompt/completion stockés | `redactSensitiveMetadata()` sur tous les events |
| Jamais de clé API | Champs `metadata` filtrés avant insertion |
| Service role uniquement en write | `tryCreateSupabaseAdminClient()` utilise `SUPABASE_SERVICE_ROLE_KEY` |
| RLS activé | Policy `company_read_own_events` pour les lectures authentifiées |
| Pas de dépendance Supabase en test | `require()` lazy + fallback mémoire si vars manquantes |
| fail_closed=false par défaut | Write failure → warn + continue, jamais de crash IA |

---

## Redaction des métadonnées

Les clés suivantes sont supprimées automatiquement de `metadata` avant stockage :

```
prompt, input, content, completion, output, response, text,
system_prompt, user_message, assistant_message, raw_response
```

Les clés non-sensibles (`use_case`, `agent_slug`, `scenario_id`, etc.) sont conservées.

---

## Tests (52 — ai-cost-ledger-b38c.test.ts)

| Groupe | Tests | Couverture |
|---|---|---|
| T1–T6 | 6 | Config — env vars, defaults, B38A fallback |
| T7–T23 | 17 | In-memory ledger — recordEstimated/Actual/Blocked, listEvents, summarize, budget |
| T24–T31 | 8 | Supabase ledger — fake client, fail_closed, filters |
| T32–T43 | 12 | withAiCostShieldAndLedger — blocked/allowed/error flows |
| T44–T52 | 9 | Pierre integration — agent_slug, metadata redaction, budget guards |

```bash
npm run test:b38c    # 52 tests
npm run test:b38a    # 69 tests (régression B38A)
npm run test:b38b    # 123 tests (régression B38B)
npm test             # 5078 tests (suite complète)
```

---

## Compatibilité B38A / B38B

- B38A `budget-ledger.ts` (in-memory) conservé intégralement — aucun changement
- B38B live validation non affectée — `withAiCostShieldAndLedger` est opt-in
- `npm run b38b:dry-run` passe sans modification
- Supabase n'est **jamais** requis pour `npm test` ou `npm run build`

---

## Constantes de statut d'événement

| Statut | Quand |
|---|---|
| `estimated` | Avant l'appel IA (coût prévu) |
| `actual` | Après l'appel IA (coût réel) |
| `blocked` | Refusé par le Cost Shield |
| `failed` | Erreur provider IA ou write DB (fail_closed=false) |
| `refunded` | Remboursement manuel (usage futur) |
| `adjusted` | Correction manuelle (usage futur) |

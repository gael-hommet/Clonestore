# OPS — Autonomie Pierre (Queue + Tick + Execute)

## Objectif
- enqueue -> insère une tâche dans `pierre_queue`
- tick -> prend les tâches `queued` arrivées à échéance, lock, appelle `/api/pierre/execute`
- execute -> fait l’action (Make / doc / email / hris)
- la tâche passe `done` ou repart `queued` avec retry

---

## Pré-requis (DB)
Table: public.pierre_queue
Champs attendus (minimum):
- id uuid
- client_id text
- action text NOT NULL
- payload jsonb
- status text (queued|processing|done|dead)
- run_at timestamptz
- attempts int
- locked_at timestamptz
- lock_token text
- last_error text
- created_at timestamptz
- updated_at timestamptz

Table: public.agent_configs
- doit contenir une ligne (client_id, agent_key='pierre')
- company_name est NOT NULL => toujours remplir company_name

Contrainte unique obligatoire:
- UNIQUE(client_id, agent_key)

---

## ENV (local + vercel)
NEXT_PUBLIC_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
ROUTER_HMAC_SECRET
CRON_SECRET
MAKE_EMAIL_WEBHOOK_URL
MAKE_DOC_WEBHOOK_URL
MAKE_INTEGRATIONS_WEBHOOK_URL

---

## Tests rapides (local)
1) npm run dev
2) enqueue doc
   node --env-file .env.local scripts/pierre-enqueue.mjs doc
3) tick
   node --env-file .env.local scripts/pierre-tick.mjs

Attendu:
- done > 0
- failed = 0

---

## Tests rapides (prod)
Enqueue depuis ton PC:
node --env-file .env.local scripts/pierre-enqueue.mjs doc --prod

Tick:
https://clonestore.pro/api/pierre/tick?secret=CRON_SECRET&limit=5

---

## Si ça casse
- 403 FORBIDDEN => agent_configs n’a pas la ligne pierre pour ce client
- 500 DB_ERROR => colonnes manquantes / trigger cassé / schema cache supabase
- 405 sur tick => mauvaise méthode (tick est en GET)

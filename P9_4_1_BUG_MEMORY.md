# P9.4.1 — Durable bug/support memory + verified-reuse policy

**Avant (P9.4)** : `createInMemoryBugStore` via `globalThis` (par processus, 2 seeds,
perdu au restart). **Après (P9.4.1)** : store Postgres durable + **politique de
réutilisation VÉRIFIÉE** — un bug signalé ne devient JAMAIS automatiquement une solution
globale.

## Schéma
- `clonechat_bug_occurrences` — signalements TENANT-LOCAUX (RLS company), symptôme **redigé**.
- `clonechat_bug_cases` — connaissance GLOBALE neutralisée ; `reusable=false` par défaut, `reusable=true` **seulement après vérification interne**. RLS : lecture des lignes `reusable=true` (ou GUC interne), écriture interne uniquement.
- `clonechat_support_cases` — cas de support TENANT-SCOPED (RLS company).

## Machine à états (`support-memory.ts`)
`reported → triaged → investigating → workaround_candidate → workaround_verified →
solution_candidate → solution_verified → resolved / rejected / security_escalation`.
`findReusable()` ne retourne QUE `reusable=true` (workaround/solution vérifiés).
`report()` : occurrence tenant-locale + upsert cas global `reported`/`reusable=false`
(occurrence agrégée sans fuite cross-tenant). `verify(fp, kind, by, text, at)` (interne)
→ `reusable=true`.

## Tenant-safety (`bug-memory.ts redactSymptom`)
E-mails, nombres, noms propres neutralisés AVANT tout stockage dans le magasin global.
Le fingerprint ignore l'ordre des mots + les identifiants volatils (uuid/nombres).

## Outils de support (§7)
`find_known_issue` (advisory), `report_issue` (wired), `create_support_case` (wired,
gouverné + confirmé → `/api/assistant/support` → store durable). Routage
`security_escalation` réservé (statut) sans exposer de détail interne.

## Preuves
- Repo : `clonechat-durable.itest.ts` — un signalement N'est PAS réutilisable ; occurrence agrégée cross-tenant sans fuite ; après `verify` → réutilisable ; **survie au restart** (occurrence pré-restart + 1). Isolation des support cases A/B.
- Full-stack : `multi-device-continuity.json` — `known_issue_reused:true` (contournement VÉRIFIÉ servi via la route réelle).

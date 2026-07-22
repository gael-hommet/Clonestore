// src/lib/clonestore/cloneadn/canonical/canonical-adn-store.ts
// P19 — DURABLE canonical CloneADN store. The canonical CloneADN (canonical-adn.ts) is now persisted in a
// real, company-scoped + entity-aware Postgres table with an optimistic version — NOT the in-memory TECH-05
// Map (which is never a company's truth). Written against the same SqlExecutor the V1 runtime uses, so it
// runs on PGlite (integration tests) and on real Postgres identically. The DDL is applied by the integration
// test today and is prepared as a local migration for P20 (never a remote/prod migration here).
//
// Single write path: `save` (upsert + version bump on change). Legacy substrates remain READ-only adapters
// feeding `resolveCanonicalAdn` upstream; nothing else writes this table. Pure SQL, parameterized, isolated.

import type { SqlExecutor, SqlRow } from "../../../pierre/v1/sql";
import type { CanonicalAdn } from "./canonical-adn";

export const CANONICAL_ADN_DDL = `
create table if not exists clonestore_canonical_adn (
  company_id       text        not null,
  entity_id        text        not null default '',
  version          integer     not null default 1,
  legal_country    text,
  fields           jsonb       not null default '{}'::jsonb,
  field_provenance jsonb       not null default '{}'::jsonb,
  conflicts        jsonb       not null default '[]'::jsonb,
  provenance       jsonb       not null default '[]'::jsonb,
  updated_at       timestamptz not null default now(),
  primary key (company_id, entity_id)
);
`;

export interface CanonicalAdnStore {
  /** Upsert the canonical ADN for (company, entity). Version bumps when the stored value changes. */
  save(adn: CanonicalAdn): Promise<CanonicalAdn>;
  /** Read the canonical ADN for (company, entity). Null when absent. Strictly company/entity-scoped. */
  get(companyId: string, entityId?: string | null): Promise<CanonicalAdn | null>;
}

const ENTITY = (e: string | null | undefined): string => e ?? "";

function rowToAdn(r: SqlRow): CanonicalAdn {
  const j = (v: unknown, d: unknown) => (v == null ? d : (typeof v === "string" ? JSON.parse(v) : v));
  return {
    company_id: String(r.company_id),
    entity_id: (r.entity_id as string) === "" ? null : (r.entity_id as string),
    version: Number(r.version),
    legal_country: (r.legal_country as string | null) ?? null,
    fields: j(r.fields, {}) as Record<string, unknown>,
    field_provenance: j(r.field_provenance, {}) as CanonicalAdn["field_provenance"],
    conflicts: j(r.conflicts, []) as CanonicalAdn["conflicts"],
    provenance: j(r.provenance, []) as CanonicalAdn["provenance"],
    nonAuthoritativeIgnored: [],
  };
}

export function createDurableCanonicalAdnStore(db: SqlExecutor): CanonicalAdnStore {
  return {
    async get(companyId, entityId) {
      const { rows } = await db.query<SqlRow>(
        `select * from clonestore_canonical_adn where company_id = $1 and entity_id = $2 limit 1`,
        [companyId, ENTITY(entityId)],
      );
      return rows.length ? rowToAdn(rows[0]) : null;
    },

    async save(adn) {
      // Do ALL work with the transaction's own executor. Never read the same row via the outer `db` while
      // this transaction holds a FOR UPDATE lock (that would block/deadlock on a single-connection engine).
      return db.transaction(async (tx): Promise<CanonicalAdn> => {
        const entity = ENTITY(adn.entity_id);
        const cur = await tx.query<SqlRow>(
          `select version, fields, legal_country from clonestore_canonical_adn where company_id = $1 and entity_id = $2 for update`,
          [adn.company_id, entity],
        );
        const fields = JSON.stringify(adn.fields);
        const fieldProv = JSON.stringify(adn.field_provenance);
        const conflicts = JSON.stringify(adn.conflicts);
        const provenance = JSON.stringify(adn.provenance);

        let version: number;
        if (cur.rows.length === 0) {
          version = 1;
          await tx.query(
            `insert into clonestore_canonical_adn (company_id, entity_id, version, legal_country, fields, field_provenance, conflicts, provenance)
             values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb)`,
            [adn.company_id, entity, version, adn.legal_country, fields, fieldProv, conflicts, provenance],
          );
        } else {
          const prev = cur.rows[0];
          const changed = (typeof prev.fields === "string" ? prev.fields : JSON.stringify(prev.fields)) !== fields
            || (prev.legal_country ?? null) !== adn.legal_country;
          version = changed ? Number(prev.version) + 1 : Number(prev.version);
          await tx.query(
            `update clonestore_canonical_adn
               set version = $3, legal_country = $4, fields = $5::jsonb, field_provenance = $6::jsonb,
                   conflicts = $7::jsonb, provenance = $8::jsonb, updated_at = now()
             where company_id = $1 and entity_id = $2`,
            [adn.company_id, entity, version, adn.legal_country, fields, fieldProv, conflicts, provenance],
          );
        }
        return { ...adn, entity_id: adn.entity_id ?? null, version };
      });
    },
  };
}

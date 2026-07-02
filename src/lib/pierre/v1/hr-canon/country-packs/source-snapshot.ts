// src/lib/pierre/v1/hr-canon/country-packs/source-snapshot.ts
// PHASE 8.12 — immutable, versioned snapshot of an OFFICIAL source's content. A snapshot can only be
// built from content that was actually retrieved+archived from the official URL — the content hash is
// of the ARCHIVED official text, never of model output. P8.12 defines the mechanism; no snapshot is
// fabricated here (there is no authenticated retrieval pipeline in this environment).

import { createHash } from "crypto";
import type { HrOfficialLegalSource } from "./source-registry";

export type SourceSnapshot = {
  snapshotId: string;
  sourceId: string;
  jurisdiction: string;
  version: number;
  officialUrl: string;
  retrievedAt: string;       // ISO — supplied by the retrieval pipeline (never invented)
  contentHash: string;       // sha256 of the archived official bytes
  byteLength: number;
  archivedRef: string;       // where the immutable copy lives
};

/** Build a snapshot from ARCHIVED official bytes. Throws if the source was not actually retrieved. */
export function buildSnapshot(source: HrOfficialLegalSource, archivedBytes: Buffer, retrievedAt: string, archivedRef: string, version = 1): SourceSnapshot {
  if (source.retrievalStatus === "POINTER_ONLY") throw new Error(`cannot snapshot a POINTER_ONLY source (${source.id}): retrieve + archive first`);
  if (!archivedBytes || archivedBytes.length === 0) throw new Error(`cannot snapshot empty content (${source.id})`);
  const contentHash = createHash("sha256").update(archivedBytes).digest("hex");
  return {
    snapshotId: `${source.id}@v${version}`, sourceId: source.id, jurisdiction: source.jurisdiction,
    version, officialUrl: source.officialUrl, retrievedAt, contentHash, byteLength: archivedBytes.length, archivedRef,
  };
}

/** A snapshot is valid iff it carries a real content hash + retrieval time + archive reference. */
export function validateSnapshot(s: SourceSnapshot): string[] {
  const e: string[] = [];
  if (!/^[0-9a-f]{64}$/.test(s.contentHash)) e.push(`${s.snapshotId}: contentHash must be a sha256`);
  if (!s.retrievedAt || Number.isNaN(Date.parse(s.retrievedAt))) e.push(`${s.snapshotId}: retrievedAt must be an ISO instant`);
  if (!s.archivedRef) e.push(`${s.snapshotId}: archivedRef required`);
  if (s.byteLength <= 0) e.push(`${s.snapshotId}: byteLength must be > 0`);
  return e;
}

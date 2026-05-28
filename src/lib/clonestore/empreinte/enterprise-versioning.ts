// B44 — EnterpriseEmpreinte versioning
// Semantic version management for empreinte updates.
// Pure: no async, no Supabase, no Next.js, no side effects.

import { EMPREINTE_CURRENT_VERSION } from "./enterprise-defaults";
import type { EnterpriseEmpreinte } from "./types";

export type EmpreinteVersionBump = "major" | "minor" | "patch";

export function parseEmpreinteVersion(version: string): { major: number; minor: number; patch: number } {
  const parts = version.split(".");
  return {
    major: parseInt(parts[0] ?? "1", 10) || 1,
    minor: parseInt(parts[1] ?? "0", 10) || 0,
    patch: parseInt(parts[2] ?? "0", 10) || 0,
  };
}

export function bumpEmpreinteVersion(version: string, bump: EmpreinteVersionBump): string {
  const { major, minor, patch } = parseEmpreinteVersion(version);
  switch (bump) {
    case "major": return `${major + 1}.0.0`;
    case "minor": return `${major}.${minor + 1}.0`;
    case "patch": return `${major}.${minor}.${patch + 1}`;
  }
}

export function isVersionNewer(a: string, b: string): boolean {
  const pa = parseEmpreinteVersion(a);
  const pb = parseEmpreinteVersion(b);
  if (pa.major !== pb.major) return pa.major > pb.major;
  if (pa.minor !== pb.minor) return pa.minor > pb.minor;
  return pa.patch > pb.patch;
}

export function isVersionCurrent(version: string): boolean {
  return version === EMPREINTE_CURRENT_VERSION;
}

export function needsMigration(empreinte: EnterpriseEmpreinte): boolean {
  return isVersionNewer(EMPREINTE_CURRENT_VERSION, empreinte.version);
}

export function migrateEnterpriseEmpreinte(
  empreinte: EnterpriseEmpreinte,
): EnterpriseEmpreinte {
  // Future: add migration logic between versions here.
  // For now, update version to current without changing data.
  if (!needsMigration(empreinte)) return empreinte;
  return {
    ...empreinte,
    version: EMPREINTE_CURRENT_VERSION,
    updated_at: new Date().toISOString(),
  };
}

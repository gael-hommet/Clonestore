// B44 — PierreEmpreinte versioning
// Pure: no async, no Supabase, no Next.js, no side effects.

import { PIERRE_EMPREINTE_CURRENT_VERSION } from "./pierre-defaults";
import type { PierreEmpreinte } from "./types";

export type PierreEmpreinteVersionBump = "major" | "minor" | "patch";

export function parsePierreEmpreinteVersion(version: string): { major: number; minor: number; patch: number } {
  const parts = version.split(".");
  return {
    major: parseInt(parts[0] ?? "1", 10) || 1,
    minor: parseInt(parts[1] ?? "0", 10) || 0,
    patch: parseInt(parts[2] ?? "0", 10) || 0,
  };
}

export function bumpPierreEmpreinteVersion(version: string, bump: PierreEmpreinteVersionBump): string {
  const { major, minor, patch } = parsePierreEmpreinteVersion(version);
  switch (bump) {
    case "major": return `${major + 1}.0.0`;
    case "minor": return `${major}.${minor + 1}.0`;
    case "patch": return `${major}.${minor}.${patch + 1}`;
  }
}

export function isPierreVersionNewer(a: string, b: string): boolean {
  const pa = parsePierreEmpreinteVersion(a);
  const pb = parsePierreEmpreinteVersion(b);
  if (pa.major !== pb.major) return pa.major > pb.major;
  if (pa.minor !== pb.minor) return pa.minor > pb.minor;
  return pa.patch > pb.patch;
}

export function isPierreVersionCurrent(version: string): boolean {
  return version === PIERRE_EMPREINTE_CURRENT_VERSION;
}

export function pierreEmpreinteNeedsMigration(empreinte: PierreEmpreinte): boolean {
  return isPierreVersionNewer(PIERRE_EMPREINTE_CURRENT_VERSION, empreinte.version);
}

export function migratePierreEmpreinte(
  empreinte: PierreEmpreinte,
): PierreEmpreinte {
  if (!pierreEmpreinteNeedsMigration(empreinte)) return empreinte;
  return {
    ...empreinte,
    version: PIERRE_EMPREINTE_CURRENT_VERSION,
    updated_at: new Date().toISOString(),
  };
}

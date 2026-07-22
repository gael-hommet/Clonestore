// src/lib/clonestore/technologies/canonical/public-technology-projection.ts
// P20 — THE SINGLE CANONICAL AUTHORITY for public technology identity/membership/status/ownership.
// Composes:
//   - the P19 canonical runtime registry (14 P20-owned T2 product technologies, real, tested) —
//     identity, membership, provider state, ownership are ALL derived from here, never re-declared.
//   - a public overlay: CloneChat as an EXTERNAL technology (owned by a separate workstream —
//     C1.x / CloneChat True-AI) plus the founder-validated launch status (CloneCall/CloneRoom
//     "À venir" at launch; everything else P20-owned is "Disponible"). The launch-status split is a
//     product decision, not something derivable from runtime state, so it is declared explicitly here
//     and ONLY here — no other file may re-declare which technologies are "Disponible"/"À venir".
//
// CloneChat here is PURE METADATA (id + ownership + launch status). This module NEVER imports any
// CloneChat runtime module and NEVER makes a certification/wiring claim about CloneChat — that
// belongs entirely to the CloneChat workstream.
//
// Consumers (TECH-03/TECH-04/demo catalog) MUST derive their id-set and public status from this
// module. They may still attach their own presentation content (copy, icons, tenant config) keyed
// by these ids, but they must not invent, drop, or re-order the id set itself.

import { buildCanonicalTechnologyRegistry, type CanonicalTechnologyEntry } from "./runtime-technology-registry";

export type PublicTechnologyOwnership = "P20_INTERNAL" | "EXTERNAL_CLONECHAT_WORKSTREAM";
export type PublicLaunchStatus = "Disponible" | "À venir";

export type PublicTechnologyEntry = {
  readonly id: string;
  /** Human-facing product name. Declared here so no consumer ever renders a raw lowercase id. */
  readonly displayName: string;
  readonly ownership: PublicTechnologyOwnership;
  readonly launchStatus: PublicLaunchStatus;
  /** The full canonical (P19/T2-derived) entry — null only for the external CloneChat metadata entry. */
  readonly canonical: CanonicalTechnologyEntry | null;
  readonly displayOrder: number;
};

/** The single canonical source of human-facing technology names. */
const DISPLAY_NAMES: Readonly<Record<string, string>> = {
  cloneos: "CloneOS", cloneadn: "CloneADN", clonecontinuum: "CloneContinuum",
  clonepolicy: "ClonePolicy", clonesignals: "CloneSignals", cloneguard: "CloneGuard",
  clonetrace: "CloneTrace", clonetrust: "CloneTrust", clonereview: "CloneReview",
  clonebrief: "CloneBrief", clonelearn: "CloneLearn", clonechat: "CloneChat",
  clonevoice: "CloneVoice", clonecall: "CloneCall", cloneroom: "CloneRoom",
};

function displayNameFor(id: string): string {
  const name = DISPLAY_NAMES[id];
  if (!name) throw new Error(`P20: aucun nom d'affichage canonique pour « ${id} ».`);
  return name;
}

// Founder-validated launch truth (see src/components/demo/acts/technologies-catalog.ts header comment
// for the commercial decision record). Anything not listed here defaults to "Disponible".
const LAUNCH_STATUS_OVERRIDE: Readonly<Record<string, PublicLaunchStatus>> = {
  clonecall: "À venir",
  cloneroom: "À venir",
};

// CloneChat: owned by a separate, parallel workstream. Metadata only — id/ownership/status.
// NEVER import a CloneChat runtime module here or elsewhere in this projection.
const EXTERNAL_OVERLAY: readonly { id: string; ownership: PublicTechnologyOwnership; launchStatus: PublicLaunchStatus }[] = [
  { id: "clonechat", ownership: "EXTERNAL_CLONECHAT_WORKSTREAM", launchStatus: "Disponible" },
];

// Stable public display order (matches the pre-existing demo catalog grouping: organiser → encadrer →
// communiquer). Declared once, here, so no consumer needs its own ordering logic.
const DISPLAY_ORDER: readonly string[] = [
  "cloneos", "cloneadn", "clonecontinuum", "clonepolicy", "clonesignals",
  "cloneguard", "clonetrace", "clonetrust", "clonereview", "clonebrief", "clonelearn",
  "clonechat", "clonevoice", "clonecall", "cloneroom",
];

function displayOrderFor(id: string): number {
  const idx = DISPLAY_ORDER.indexOf(id);
  return idx === -1 ? DISPLAY_ORDER.length : idx;
}

/** Build the single public technology projection (15 entries: 14 P20-owned + 1 external). Pure. */
export function buildPublicTechnologyProjection(): readonly PublicTechnologyEntry[] {
  const canonical = buildCanonicalTechnologyRegistry();

  const internal: PublicTechnologyEntry[] = canonical.map((entry) => ({
    id: entry.id,
    displayName: displayNameFor(entry.id),
    ownership: "P20_INTERNAL",
    launchStatus: LAUNCH_STATUS_OVERRIDE[entry.id] ?? "Disponible",
    canonical: entry,
    displayOrder: displayOrderFor(entry.id),
  }));

  const external: PublicTechnologyEntry[] = EXTERNAL_OVERLAY.map((e) => ({
    id: e.id,
    displayName: displayNameFor(e.id),
    ownership: e.ownership,
    launchStatus: e.launchStatus,
    canonical: null,
    displayOrder: displayOrderFor(e.id),
  }));

  return [...internal, ...external].sort((a, b) => a.displayOrder - b.displayOrder);
}

export function getPublicTechnologyEntry(id: string): PublicTechnologyEntry | undefined {
  return buildPublicTechnologyProjection().find((e) => e.id === id);
}

/** Cross-check: exactly 14 P20-internal + 1 external = 15, exactly 2 "À venir", no duplicate ids. Pure. */
export function crossCheckPublicTechnologyProjection(): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  const proj = buildPublicTechnologyProjection();

  if (proj.length !== 15) issues.push(`Projection publique: ${proj.length} technologies au lieu de 15.`);

  const internalCount = proj.filter((e) => e.ownership === "P20_INTERNAL").length;
  if (internalCount !== 14) issues.push(`Technologies P20 internes: ${internalCount} au lieu de 14.`);

  const externalCount = proj.filter((e) => e.ownership === "EXTERNAL_CLONECHAT_WORKSTREAM").length;
  if (externalCount !== 1) issues.push(`Technologies externes: ${externalCount} au lieu de 1 (CloneChat).`);

  const upcoming = proj.filter((e) => e.launchStatus === "À venir");
  if (upcoming.length !== 2) issues.push(`Technologies "À venir": ${upcoming.length} au lieu de 2.`);
  if (!upcoming.some((e) => e.id === "clonecall")) issues.push(`CloneCall doit être "À venir".`);
  if (!upcoming.some((e) => e.id === "cloneroom")) issues.push(`CloneRoom doit être "À venir".`);

  const ids = proj.map((e) => e.id);
  const dupIds = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupIds.length > 0) issues.push(`IDs en double: ${[...new Set(dupIds)].join(", ")}.`);

  const clonechat = proj.find((e) => e.id === "clonechat");
  if (!clonechat || clonechat.ownership !== "EXTERNAL_CLONECHAT_WORKSTREAM") {
    issues.push(`CloneChat doit avoir ownership=EXTERNAL_CLONECHAT_WORKSTREAM.`);
  }
  if (clonechat && clonechat.canonical !== null) {
    issues.push(`CloneChat ne doit avoir aucune entrée canonique P20 (metadata uniquement).`);
  }

  return { ok: issues.length === 0, issues };
}

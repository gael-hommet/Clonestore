// src/lib/cloneos/files/fingerprint.ts
// B34 — File checksum and ID generation. Pure, server-side only.

import { createHash } from "node:crypto";

// ── djb2 for file ID generation (consistent with B33) ────────────────────────

function djb2(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
    h = h >>> 0;
  }
  return h;
}

// ── SHA-256 checksum ──────────────────────────────────────────────────────────

export function computeChecksum(content: string | Buffer): string {
  const hash = createHash("sha256");
  if (Buffer.isBuffer(content)) {
    hash.update(content);
  } else {
    hash.update(content, "utf8");
  }
  return hash.digest("hex");
}

// ── File ID ───────────────────────────────────────────────────────────────────

export function makeFileId(companyId: string, checksum: string, ts: string): string {
  const seed = `${companyId}:${checksum}:${ts}`;
  return `file_${djb2(seed).toString(36)}_${Date.now().toString(36)}`;
}

// ── Event ID ──────────────────────────────────────────────────────────────────

export function makeFileEventId(fileId: string, eventType: string, ts: string): string {
  const seed = `${fileId}:${eventType}:${ts}`;
  return `fevt_${djb2(seed).toString(36)}_${Date.now().toString(36)}`;
}

// ── Comparison ────────────────────────────────────────────────────────────────

export function isSameFileChecksum(checksumA: string | null, checksumB: string | null): boolean {
  if (!checksumA || !checksumB) return false;
  return checksumA.toLowerCase() === checksumB.toLowerCase();
}

// ── Safe storage path ─────────────────────────────────────────────────────────

export function buildStoragePath(companyId: string, fileId: string, safeFilename: string): string {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return `${companyId}/${date}/${fileId}/${safeFilename}`;
}

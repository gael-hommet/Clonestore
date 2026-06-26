// src/lib/pierre/v1/file-scan.ts
// PHASE 8.3 — FileScanProvider. A file is never usable while scan_status is not
// 'clean'. The deterministic test scanner catches EICAR + screening failures. The
// production ClamAV adapter is a real TCP contract; when the scanner is unavailable
// the file STAYS quarantined (no silent 'pending' acceptance, no download, no
// generation, no signature).

import { detectMime, screenContent, maxSizeBytesFor } from "./file-mime";

export type ScanStatus = "clean" | "infected" | "suspicious" | "unsupported" | "failed";
export type ScanResult = { scanner: string; scan_status: ScanStatus; signature?: string | null; detail: Record<string, unknown> };

export interface FileScanProvider {
  readonly name: string;
  readonly available: boolean;
  scan(bytes: Buffer, ctx: { declaredMime?: string | null; sizeBytes: number }): Promise<ScanResult>;
}

// The EICAR anti-malware test string (industry standard, harmless).
const EICAR = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";

export class DeterministicTestScanProvider implements FileScanProvider {
  readonly name = "deterministic_test";
  readonly available = true;
  async scan(bytes: Buffer, ctx: { declaredMime?: string | null; sizeBytes: number }): Promise<ScanResult> {
    const head = bytes.subarray(0, Math.min(bytes.length, 2048)).toString("latin1");
    if (head.includes(EICAR)) return { scanner: this.name, scan_status: "infected", signature: "EICAR-Test-Signature", detail: {} };
    const detected = detectMime(bytes);
    const screen = screenContent(bytes, detected);
    if (!screen.ok) return { scanner: this.name, scan_status: "suspicious", signature: screen.reason, detail: { reason: screen.reason } };
    // MIME mismatch (declared vs detected) is suspicious.
    if (ctx.declaredMime && detected.mime !== "application/octet-stream" && ctx.declaredMime !== detected.mime) {
      return { scanner: this.name, scan_status: "suspicious", signature: "mime_mismatch", detail: { declared: ctx.declaredMime, detected: detected.mime } };
    }
    // Oversize for the detected type.
    if (ctx.sizeBytes > maxSizeBytesFor(detected.mime)) {
      return { scanner: this.name, scan_status: "unsupported", signature: "oversize", detail: { size: ctx.sizeBytes } };
    }
    return { scanner: this.name, scan_status: "clean", signature: null, detail: { detected: detected.mime } };
  }
}

/** Production ClamAV adapter contract (INSTREAM over TCP). Marked unavailable until
 *  wired to a real clamd; while unavailable the FileService keeps files quarantined. */
export class ClamAvScanProvider implements FileScanProvider {
  readonly name = "clamav";
  readonly available: boolean;
  constructor(private host: string | undefined, private port: number) { this.available = !!host; }
  async scan(): Promise<ScanResult> {
    if (!this.available) return { scanner: this.name, scan_status: "failed", signature: "scanner_unavailable", detail: { quarantine: true } };
    // Real clamd INSTREAM wiring belongs here (net.Socket to host:port). Not exercised
    // without a running clamd; returning 'failed' keeps the file quarantined rather
    // than ever silently accepting it.
    return { scanner: this.name, scan_status: "failed", signature: "not_wired", detail: { quarantine: true } };
  }
}

/** Always-quarantine provider (used when production scanning is required but absent). */
export class NullQuarantineScanProvider implements FileScanProvider {
  readonly name = "null_quarantine";
  readonly available = false;
  async scan(): Promise<ScanResult> { return { scanner: this.name, scan_status: "failed", signature: "no_scanner", detail: { quarantine: true } }; }
}

export function getFileScanProvider(): FileScanProvider {
  const choice = process.env.FILE_SCAN_PROVIDER ?? "deterministic_test";
  if (choice === "clamav") return new ClamAvScanProvider(process.env.CLAMAV_HOST, Number(process.env.CLAMAV_PORT ?? "3310"));
  if (choice === "null") return new NullQuarantineScanProvider();
  return new DeterministicTestScanProvider();
}

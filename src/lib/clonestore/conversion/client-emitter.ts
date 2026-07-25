// BLOC 3 — Émetteur d'événements first-party côté navigateur.
//
// Politique :
//   • best-effort (jamais d'erreur visible utilisateur) ;
//   • `idempotency_key` stable par "occurrence logique" pour éviter
//     les doubles émissions en React StrictMode ;
//   • aucun event critique côté client (l'allowlist serveur refusera) ;
//   • aucun bearer dans le payload ;
//   • garde contre l'appel au moment du simple import du module
//     (aucune émission au top-level).

const CSRF_HEADER = "Content-Type";

export interface ClientEmitOptions {
  metadata?: Record<string, unknown>;
  /** Clé stable pour éviter les doublons en StrictMode. */
  idempotencyKey?: string;
  sourcePage?: string;
}

export async function emitConversionEvent(
  eventType: string,
  opts: ClientEmitOptions = {},
): Promise<void> {
  if (typeof window === "undefined") return; // top-level safety
  const key =
    opts.idempotencyKey ??
    `${eventType}:${Math.random().toString(36).slice(2, 12)}:${Date.now().toString(36).slice(-6)}`;
  const payload = {
    event_type: eventType,
    idempotency_key: key,
    source_page: opts.sourcePage ?? (typeof location !== "undefined" ? location.pathname.slice(0, 80) : ""),
    metadata: opts.metadata ?? {},
  };
  try {
    await fetch("/api/conversion/events", {
      method: "POST",
      credentials: "include",
      headers: { [CSRF_HEADER]: "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // best-effort
  }
}

/**
 * Génère/réutilise une clé d'idempotency stable pour une "occurrence logique"
 * dans la session navigateur (StrictMode, double-mount tolérés).
 */
export function stableEventKey(scope: string): string {
  if (typeof sessionStorage === "undefined") {
    return `${scope}:${Math.random().toString(36).slice(2, 14)}`;
  }
  const k = `cs_b3_emit:${scope}`;
  let v = sessionStorage.getItem(k);
  if (!v) {
    v = `${scope}:${Math.random().toString(36).slice(2, 14)}`;
    try {
      sessionStorage.setItem(k, v);
    } catch { /* stockage indisponible — id volatile conservé en mémoire uniquement */ }
  }
  return v;
}

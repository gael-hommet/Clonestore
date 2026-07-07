// src/lib/clonechat/server/v1-loopback.ts
// P9.4.2 r2 (§3) — Client SERVEUR→SERVEUR (loopback) vers l'API Pierre V1. CloneChat
// EXÉCUTE l'effet côté serveur en appelant l'API V1 PUBLIQUE (consommation, jamais de
// modification de la lane P8) avec l'identité RÉELLE de l'utilisateur (cookies/bearer
// transmis) + l'entreprise résolue épinglée (`x-pierre-company`, que V1 re-vérifie contre
// le membership). L'idempotency_key = fingerprint SHA-256 de la commande → V1 dédoublonne
// la création de mission (exactly-once en reprise). Server-only.

const ACTIVE_STATUSES = new Set(["queued", "running", "waiting", "paused", "blocked", "planned", "analyzing", "awaiting_validation", "awaiting_approval"]);

export interface V1Ctx {
  readonly base: string;
  readonly headers: Record<string, string>;
}

/** Contexte loopback : origine de la requête + en-têtes d'identité transmis + entreprise épinglée. */
export function buildV1Ctx(req: Request, companyId: string): V1Ctx {
  const base = new URL(req.url).origin;
  const headers: Record<string, string> = { "Content-Type": "application/json", "x-pierre-company": companyId };
  const cookie = req.headers.get("cookie");
  if (cookie) headers["cookie"] = cookie;                 // session Supabase + cookie E2E signé
  const auth = req.headers.get("authorization");
  if (auth) headers["authorization"] = auth;              // bearer éventuel
  const rid = req.headers.get("x-request-id");
  if (rid) headers["x-request-id"] = rid;
  return { base, headers };
}

/** Classe une réponse d'échec : 4xx (hors 429) = TERMINAL (permission/validation/version/
 *  introuvable/guard), sinon RÉCUPÉRABLE (429/5xx/réseau → le lease pourra reprendre). */
function isTerminalStatus(status: number): boolean {
  return status >= 400 && status < 500 && status !== 429 && status !== 408;
}

interface FetchOut { ok: boolean; status: number; body: Record<string, unknown> | null; }
async function v1Fetch(v1: V1Ctx, path: string, method: "GET" | "POST", body?: unknown): Promise<FetchOut> {
  const res = await fetch(`${v1.base}${path}`, { method, headers: v1.headers, credentials: "same-origin", ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  return { ok: res.ok, status: res.status, body: json };
}

export interface V1EffectResult { ok: boolean; targetRef?: string | null; result?: unknown; terminal?: boolean; error?: string; }

function missionIdOf(body: Record<string, unknown> | null): string | null {
  if (!body) return null;
  return (body.mission_id as string) ?? (body.id as string) ?? null;
}

/** Crée une mission (idempotent V1 sur idempotency_key = fingerprint) puis RE-LIT la cible. */
export async function createMissionV1(v1: V1Ctx, instruction: string, idempotencyKey: string): Promise<V1EffectResult> {
  const r = await v1Fetch(v1, "/api/pierre/v1/missions", "POST", { instruction, source: `clonechat:${idempotencyKey.slice(0, 12)}`, idempotency_key: idempotencyKey });
  if (!r.ok) return { ok: false, terminal: isTerminalStatus(r.status), error: `mission_create_${r.status}` };
  const missionId = missionIdOf(r.body);
  if (!missionId) return { ok: false, terminal: false, error: "mission_create_no_id" };
  // RE-READ : confirmer que la mission existe réellement côté V1 avant de committer SUCCEEDED.
  const read = await readMissionV1(v1, missionId);
  if (!read.exists) return { ok: false, terminal: false, error: "mission_reread_missing" };
  return { ok: true, targetRef: missionId, result: { missionId, status: read.status } };
}

export async function readMissionV1(v1: V1Ctx, missionId: string): Promise<{ exists: boolean; status?: string }> {
  const r = await v1Fetch(v1, `/api/pierre/v1/missions/${encodeURIComponent(missionId)}`, "GET");
  if (!r.ok) return { exists: false };
  return { exists: true, status: (r.body?.status as string) ?? undefined };
}

/** Annule une mission. Le 2xx de V1 (autorité de sa propre machine à états) EST le succès ;
 *  la re-lecture est CONFIRMATOIRE (enrichit le résultat avec le statut courant, best-effort). */
export async function cancelMissionV1(v1: V1Ctx, missionId: string): Promise<V1EffectResult> {
  const r = await v1Fetch(v1, `/api/pierre/v1/missions/${encodeURIComponent(missionId)}/cancel`, "POST", {});
  if (!r.ok) return { ok: false, terminal: isTerminalStatus(r.status), error: `mission_cancel_${r.status}` };
  const read = await readMissionV1(v1, missionId); // confirmatoire (statut courant), pas un gate
  return { ok: true, targetRef: missionId, result: { missionId, status: read.status } };
}

const DECISION_PATH = { approve: "approve", reject: "reject", request_changes: "request-changes" } as const;

/** Décide une validation. V1 est version-checké + idempotent : son 2xx EST le succès autoritatif.
 *  La re-lecture (via la mission) est CONFIRMATOIRE — elle enrichit le résultat avec le statut
 *  courant quand un missionId est connu, sans être un gate (statut potentiellement asynchrone). */
export async function decideValidationV1(v1: V1Ctx, missionId: string | null, validationId: string, decision: "approve" | "reject" | "request_changes", version: number): Promise<V1EffectResult> {
  const seg = DECISION_PATH[decision];
  const r = await v1Fetch(v1, `/api/pierre/v1/validations/${encodeURIComponent(validationId)}/${seg}`, "POST", { version });
  if (!r.ok) return { ok: false, terminal: isTerminalStatus(r.status), error: `validation_decide_${r.status}` };
  // Re-lecture confirmatoire (best-effort) du statut courant.
  let status: string | undefined;
  if (missionId) {
    const list = await v1Fetch(v1, `/api/pierre/v1/missions/${encodeURIComponent(missionId)}/validations`, "GET");
    if (Array.isArray(list.body)) {
      const found = (list.body as Array<Record<string, unknown>>).find((x) => x.id === validationId);
      status = (found?.status as string) ?? undefined;
    }
  }
  return { ok: true, targetRef: validationId, result: { validationId, decision, status } };
}

// ── Résolution SERVEUR des cibles au moment de la PROPOSITION (identité stable) ──────

/** Résout une mission annulable réelle (référence du modèle sinon 1re active). null si aucune. */
export async function resolveCancellableMissionV1(v1: V1Ctx, hintId: string): Promise<{ id: string; title: string } | null> {
  const r = await v1Fetch(v1, "/api/pierre/v1/missions?limit=25", "GET");
  const items = (r.body?.items as Array<Record<string, unknown>> | undefined) ?? [];
  const active = items.filter((m) => ACTIVE_STATUSES.has(String(m.status)));
  const byHint = hintId ? items.find((m) => m.id === hintId) : null;
  const pick = byHint ?? active[0] ?? null;
  if (!pick) return null;
  return { id: String(pick.id), title: String(pick.summary ?? "mission") };
}

/** Résout une validation en attente réelle (référence du modèle sinon 1re pending) + version. */
export async function resolvePendingValidationV1(v1: V1Ctx, hintId: string): Promise<{ id: string; missionId: string; version: number } | null> {
  const r = await v1Fetch(v1, "/api/pierre/v1/missions?limit=25", "GET");
  const items = (r.body?.items as Array<Record<string, unknown>> | undefined) ?? [];
  for (const m of items) {
    const list = await v1Fetch(v1, `/api/pierre/v1/missions/${encodeURIComponent(String(m.id))}/validations`, "GET");
    if (!Array.isArray(list.body)) continue;
    const vals = list.body as Array<Record<string, unknown>>;
    const byHint = hintId ? vals.find((v) => v.id === hintId && String(v.status) === "pending") : null;
    const pending = byHint ?? vals.find((v) => String(v.status) === "pending");
    if (pending) return { id: String(pending.id), missionId: String(m.id), version: Number(pending.version ?? 1) };
  }
  return null;
}

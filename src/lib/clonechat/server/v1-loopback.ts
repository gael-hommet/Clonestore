// src/lib/clonechat/server/v1-loopback.ts
// P9.4.2 r2 (§3) — Client SERVEUR→SERVEUR (loopback) vers l'API Pierre V1. CloneChat
// EXÉCUTE l'effet côté serveur en appelant l'API V1 PUBLIQUE (consommation, jamais de
// modification de la lane P8) avec l'identité RÉELLE de l'utilisateur (cookies/bearer
// transmis) + l'entreprise résolue épinglée (`x-pierre-company`, que V1 re-vérifie contre
// le membership). L'idempotency_key = fingerprint SHA-256 de la commande → V1 dédoublonne
// la création de mission (exactly-once en reprise). Server-only.

import { AUTONOMY_MODES } from "@/lib/pierre/v1/autonomy";

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
async function v1Fetch(v1: V1Ctx, path: string, method: "GET" | "POST" | "PATCH", body?: unknown): Promise<FetchOut> {
  const res = await fetch(`${v1.base}${path}`, { method, headers: v1.headers, credentials: "same-origin", ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  return { ok: res.ok, status: res.status, body: json };
}

export interface V1EffectResult { ok: boolean; targetRef?: string | null; result?: unknown; terminal?: boolean; error?: string; }

function missionIdOf(body: Record<string, unknown> | null): string | null {
  if (!body) return null;
  return (body.mission_id as string) ?? (body.id as string) ?? null;
}

/** Crée une mission (idempotent V1 sur idempotency_key = fingerprint) puis RE-LIT la cible.
 *  `autonomyMode` = mode moteur P8 RÉSOLU CÔTÉ SERVEUR (défaut d'entreprise) : passé à V1 qui
 *  gouverne la mission via decideValidation. Jamais fourni par le client. */
export async function createMissionV1(v1: V1Ctx, instruction: string, idempotencyKey: string, autonomyMode?: string): Promise<V1EffectResult> {
  const body: Record<string, unknown> = { instruction, source: `clonechat:${idempotencyKey.slice(0, 12)}`, idempotency_key: idempotencyKey };
  // N'inclure autonomy_mode QUE si c'est un mode moteur P8 valide (garde-fou anti-mode-inconnu).
  if (autonomyMode && (AUTONOMY_MODES as readonly string[]).includes(autonomyMode)) body.autonomy_mode = autonomyMode;
  const r = await v1Fetch(v1, "/api/pierre/v1/missions", "POST", body);
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

/**
 * Résout une mission annulable réelle. P16D §3.A — JAMAIS de cible devinée :
 *   · un `hintId` FOURNI mais introuvable (id halluciné par le modèle) ⇒ `null` (on ne retarge
 *     PAS vers une autre mission — annuler la mauvaise mission est irréversible) ;
 *   · SANS hint, on n'auto-choisit QUE s'il existe exactement UNE mission active (sans ambiguïté) ;
 *     0 ou plusieurs ⇒ `null` (Pierre redemande laquelle).
 * Avant P16D : `byHint ?? active[0]` ⇒ un id halluciné annulait la 1re mission active.
 */
export async function resolveCancellableMissionV1(v1: V1Ctx, hintId: string): Promise<{ id: string; title: string } | null> {
  const r = await v1Fetch(v1, "/api/pierre/v1/missions?limit=25", "GET");
  const items = (r.body?.items as Array<Record<string, unknown>> | undefined) ?? [];
  const active = items.filter((m) => ACTIVE_STATUSES.has(String(m.status)));
  if (hintId) {
    const byHint = items.find((m) => m.id === hintId) ?? null;
    if (!byHint) return null;                       // id fourni mais introuvable ⇒ pas de retarget
    return { id: String(byHint.id), title: String(byHint.summary ?? "mission") };
  }
  if (active.length !== 1) return null;             // ambigu (0 ou >1) ⇒ on ne devine pas
  return { id: String(active[0].id), title: String(active[0].summary ?? "mission") };
}

/**
 * Résout une validation en attente réelle + version. Même doctrine P16D §3.A :
 *   · `hintId` fourni mais introuvable parmi les validations pending ⇒ `null` (jamais de retarget
 *     vers une autre validation — approuver/rejeter la mauvaise est une décision RH sensible) ;
 *   · sans hint, auto-résolution UNIQUEMENT s'il existe exactement UNE validation pending.
 * Avant P16D : `byHint ?? 1re pending` ⇒ un id halluciné visait une validation arbitraire.
 */
export async function resolvePendingValidationV1(v1: V1Ctx, hintId: string): Promise<{ id: string; missionId: string; version: number } | null> {
  const r = await v1Fetch(v1, "/api/pierre/v1/missions?limit=25", "GET");
  const items = (r.body?.items as Array<Record<string, unknown>> | undefined) ?? [];
  const pendings: Array<{ id: string; missionId: string; version: number }> = [];
  for (const m of items) {
    const list = await v1Fetch(v1, `/api/pierre/v1/missions/${encodeURIComponent(String(m.id))}/validations`, "GET");
    if (!Array.isArray(list.body)) continue;
    for (const v of list.body as Array<Record<string, unknown>>) {
      if (String(v.status) === "pending") pendings.push({ id: String(v.id), missionId: String(m.id), version: Number(v.version ?? 1) });
    }
  }
  if (hintId) {
    return pendings.find((p) => p.id === hintId) ?? null;   // introuvable ⇒ jamais une autre
  }
  if (pendings.length !== 1) return null;                   // ambigu ⇒ on redemande
  return pendings[0];
}

// ── P9.5 — Réglage d'AUTONOMIE d'entreprise (colonne P8 pierre_rt_companies.default_autonomy_mode) ──
// Source de vérité UNIQUE = la colonne P8, lue/écrite via l'API V1 company (consommation, jamais
// de modification de fichier P8). Le mode moteur ainsi résolu gouverne createMission (decideValidation).

/** Lit le mode d'autonomie moteur (défaut) de l'entreprise + sa version (concurrence optimiste). */
export async function readCompanyAutonomyV1(v1: V1Ctx): Promise<{ engineMode: string; version: number } | null> {
  const r = await v1Fetch(v1, "/api/pierre/v1/company", "GET");
  if (!r.ok || !r.body) return null;
  const raw = String(r.body.default_autonomy_mode ?? "");
  const engineMode = (AUTONOMY_MODES as readonly string[]).includes(raw) ? raw : "normal"; // garde-fou
  return { engineMode, version: Number(r.body.version ?? 1) };
}

/** Écrit le mode d'autonomie moteur (PATCH gouverné + version-checké côté P8). `engineMode` DOIT
 *  être un mode moteur P8 valide (validé par l'appelant produit avant appel). */
export async function patchCompanyAutonomyV1(v1: V1Ctx, engineMode: string, version: number): Promise<{ ok: boolean; status: number; version?: number; engineMode?: string; terminal?: boolean }> {
  if (!(AUTONOMY_MODES as readonly string[]).includes(engineMode)) return { ok: false, status: 400, terminal: true };
  const r = await v1Fetch(v1, "/api/pierre/v1/company", "PATCH", { default_autonomy_mode: engineMode, version });
  if (!r.ok) return { ok: false, status: r.status, terminal: isTerminalStatus(r.status) };
  return { ok: true, status: r.status, version: Number(r.body?.version ?? version + 1), engineMode: String(r.body?.default_autonomy_mode ?? engineMode) };
}

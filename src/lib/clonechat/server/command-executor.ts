// src/lib/clonechat/server/command-executor.ts
// P9.4.2 r2 (§3) — Exécution GOUVERNÉE des commandes effectives CÔTÉ SERVEUR :
//   CONFIRM (proposition persistée) → CLAIM atomique (registre durable + lease) →
//   EXECUTE l'effet réel → RE-READ la cible réelle → COMMIT la référence de résultat.
// L'orchestration (claim/commit/fail + reprise) est séparée de l'effet injecté, donc
// testable : une seule exécution, reprise après lease expiré (crash), doublon renvoie le
// résultat existant, in_flight pour une exécution concurrente. Server-only.

import { commandFingerprint, type CommandLedger, type CanonicalCommand } from "../durable/command-ledger";

export interface EffectResult {
  readonly ok: boolean;
  readonly targetRef?: string | null;
  readonly result?: unknown;
  readonly terminal?: boolean;   // échec non rejouable (ex. refus de permission, version périmée)
  readonly error?: string;
}

export type CommandExecResult =
  | { readonly status: "succeeded"; readonly targetRef: string | null; readonly result: unknown; readonly recovered: boolean }
  | { readonly status: "duplicate"; readonly targetRef: string | null; readonly result: unknown }
  | { readonly status: "in_flight" }
  | { readonly status: "failed"; readonly terminal: boolean; readonly error: string };

/**
 * Exécute une commande gouvernée via le registre durable. `effect` réalise l'effet réel
 * (contrat V1 / support) et DOIT être idempotent (rejouable en reprise). Le serveur re-lit
 * la cible dans `effect` avant de renvoyer targetRef.
 */
export async function runGovernedCommand(
  ledger: CommandLedger,
  cmd: CanonicalCommand,
  effect: () => Promise<EffectResult>,
  opts: { leaseOwner: string; leaseMs: number },
): Promise<CommandExecResult> {
  const claim = await ledger.claim(cmd, opts.leaseOwner, opts.leaseMs);

  if (claim.kind === "duplicate_succeeded") {
    return { status: "duplicate", targetRef: claim.command.targetRef, result: claim.command.result };
  }
  if (claim.kind === "in_flight") return { status: "in_flight" };
  if (claim.kind === "terminal") {
    return { status: "failed", terminal: claim.command.status === "failed_terminal" || claim.command.status === "cancelled", error: claim.command.status };
  }

  // acquired | recovered → exécuter l'effet (idempotent) puis re-lire + commit FENCÉ.
  const recovered = claim.kind === "recovered";
  const owner = opts.leaseOwner;
  try {
    const r = await effect();
    if (!r.ok) {
      const applied = await ledger.fail(cmd, !!r.terminal, owner, { error: r.error ?? null });
      // Lease volé pendant l'effet (un autre worker a repris + réglé) → NE PAS écraser :
      // on reconcilie sur l'état réel du registre (jamais un faux échec sur un succès réel).
      if (!applied) return reconcile(ledger, cmd);
      return { status: "failed", terminal: !!r.terminal, error: r.error ?? "effect_failed" };
    }
    const applied = await ledger.commit(cmd, r.targetRef ?? null, r.result ?? null, owner);
    if (!applied) return reconcile(ledger, cmd);
    return { status: "succeeded", targetRef: r.targetRef ?? null, result: r.result ?? null, recovered };
  } catch (e) {
    // Panne pendant l'exécution : échec RÉCUPÉRABLE (le lease expirera → reprise possible).
    const applied = await ledger.fail(cmd, false, owner, { error: (e as { message?: string })?.message ?? "exception" });
    if (!applied) return reconcile(ledger, cmd);
    return { status: "failed", terminal: false, error: "execution_error" };
  }
}

/** Le lease a été repris par un autre worker : on renvoie l'état AUTORITATIF du registre. */
async function reconcile(ledger: CommandLedger, cmd: CanonicalCommand): Promise<CommandExecResult> {
  const row = await ledger.get(commandFingerprint(cmd), { companyId: cmd.companyId, actorId: cmd.actorId });
  if (row?.status === "succeeded") return { status: "duplicate", targetRef: row.targetRef, result: row.result };
  if (row?.status === "executing") return { status: "in_flight" };
  const terminal = row?.status === "failed_terminal" || row?.status === "cancelled";
  return { status: "failed", terminal, error: row?.status ?? "superseded" };
}

// Programme partenaires — paramètres commerciaux configurables CÔTÉ SERVEUR.
// Défauts dans le code ; surcharges persistées dans clonestore_pp_settings (service only),
// modifiables uniquement par une action admin auditée. Aucun paramètre financier n'est
// jamais lu depuis le navigateur.

import type { SqlExecutor } from "@/lib/pierre/v1/sql";
import { DEFAULT_COMMISSION_RATE_BPS } from "../money";

export type ProgramSettings = {
  commissionRateBps: number; // 20 % = 2000 bps
  attributionWindowDays: number; // fenêtre d'attribution par lien/code
  protectionWindowDays: number; // protection d'une mise en relation nominative validée
  reserveDays: number; // délai de réserve avant qu'une commission devienne disponible
  payoutThresholdMinor: number; // seuil minimum de versement (centimes)
  payoutDayOfMonth: number; // jour de versement mensuel (1-28)
  currency: string; // devise de versement
  programStatus: "open" | "paused" | "closed";
};

export const DEFAULT_PROGRAM_SETTINGS: ProgramSettings = {
  commissionRateBps: DEFAULT_COMMISSION_RATE_BPS,
  attributionWindowDays: 90,
  protectionWindowDays: 180,
  reserveDays: 30,
  payoutThresholdMinor: 10_000, // 100,00 €
  payoutDayOfMonth: 5,
  currency: "eur",
  programStatus: "open",
};

const SETTINGS_KEY = "program";

function coerce(raw: unknown): ProgramSettings {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const int = (v: unknown, d: number) => (Number.isInteger(v) ? (v as number) : d);
  const status = o.programStatus === "paused" || o.programStatus === "closed" ? o.programStatus : "open";
  return {
    commissionRateBps: int(o.commissionRateBps, DEFAULT_PROGRAM_SETTINGS.commissionRateBps),
    attributionWindowDays: int(o.attributionWindowDays, DEFAULT_PROGRAM_SETTINGS.attributionWindowDays),
    protectionWindowDays: int(o.protectionWindowDays, DEFAULT_PROGRAM_SETTINGS.protectionWindowDays),
    reserveDays: int(o.reserveDays, DEFAULT_PROGRAM_SETTINGS.reserveDays),
    payoutThresholdMinor: int(o.payoutThresholdMinor, DEFAULT_PROGRAM_SETTINGS.payoutThresholdMinor),
    payoutDayOfMonth: int(o.payoutDayOfMonth, DEFAULT_PROGRAM_SETTINGS.payoutDayOfMonth),
    currency: typeof o.currency === "string" && o.currency ? o.currency : DEFAULT_PROGRAM_SETTINGS.currency,
    programStatus: status,
  };
}

/** Lit les paramètres effectifs (défauts fusionnés avec la surcharge persistée). tx en mode service. */
export async function getProgramSettings(tx: SqlExecutor): Promise<ProgramSettings> {
  const { rows } = await tx.query<{ value_json: unknown }>(
    `select value_json from clonestore_pp_settings where key = $1`,
    [SETTINGS_KEY],
  );
  if (!rows.length) return { ...DEFAULT_PROGRAM_SETTINGS };
  return coerce(rows[0].value_json);
}

/** Écrit une surcharge de paramètres (action admin ; l'audit est écrit par l'appelant). */
export async function setProgramSettings(tx: SqlExecutor, updatedBy: string, patch: Partial<ProgramSettings>): Promise<ProgramSettings> {
  const current = await getProgramSettings(tx);
  const next = coerce({ ...current, ...patch });
  await tx.query(
    `insert into clonestore_pp_settings (key, value_json, updated_by, updated_at)
     values ($1, $2::jsonb, $3, now())
     on conflict (key) do update set value_json = excluded.value_json, updated_by = excluded.updated_by, updated_at = now()`,
    [SETTINGS_KEY, JSON.stringify(next), updatedBy],
  );
  return next;
}

// src/lib/client-cockpit/permissions.ts
// P9.3 — Permissions client dérivées des clés RÉELLES reçues du runtime
// (voir tenant-context V1 : mission.create, validation.decide, mission.cancel…).
// Le client ne fait qu'HONORER ce que le serveur autorise : jamais d'élévation.

export interface CockpitPermissions {
  readonly canCreateMission: boolean;
  readonly canDecideValidations: boolean;
  readonly canCancelMission: boolean;
  readonly canRescheduleTask: boolean;
  readonly canDownloadDocuments: boolean;
}

/** Permissions par défaut sûres : lecture + création + décision autorisées tant
 *  que le serveur ne restreint pas (le serveur reste l'autorité finale à chaque
 *  mutation ; ce défaut évite un cockpit inutilisable si les clés ne sont pas
 *  transmises). Utiliser `permissionsFromKeys` dès que les clés sont connues. */
export const DEFAULT_PERMISSIONS: CockpitPermissions = {
  canCreateMission: true,
  canDecideValidations: true,
  canCancelMission: true,
  canRescheduleTask: true,
  canDownloadDocuments: true,
};

/** Dérive les permissions à partir des clés canoniques renvoyées par le runtime. */
export function permissionsFromKeys(keys: readonly string[] | null | undefined): CockpitPermissions {
  if (!keys || keys.length === 0) return DEFAULT_PERMISSIONS;
  const set = new Set(keys.map((k) => k.trim().toLowerCase()));
  const has = (k: string) => set.has(k) || set.has("company.*") || set.has("*");
  return {
    canCreateMission: has("mission.create"),
    canDecideValidations: has("validation.decide"),
    canCancelMission: has("mission.cancel"),
    canRescheduleTask: has("task.write") || has("mission.cancel"),
    canDownloadDocuments: has("document.read") || has("mission.read"),
  };
}

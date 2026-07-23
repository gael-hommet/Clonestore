// C1.9 — DRAPEAU DE MIGRATION. Fail-closed : tout ce qui n'est pas reconnu vaut `off`.
//
//   off    — la pipeline C1.9 n'est jamais construite (défaut, y compris en production)
//   shadow — elle s'exécute et sa réponse est TRACÉE, mais l'utilisateur reçoit la voie
//            stable. Les outils sont désactivés : aucun effet ne peut être joué deux fois.
//   on     — elle sert la réponse.
export type C19Mode = "off" | "shadow" | "on";

export function readC19Mode(env: NodeJS.ProcessEnv = process.env): C19Mode {
  const raw = (env.CLONECHAT_C19_MODE ?? "").trim().toLowerCase();
  if (raw === "on") return "on";
  if (raw === "shadow") return "shadow";
  return "off";
}

export function c19ToolsEnabled(mode: C19Mode): boolean {
  // En shadow, aucun outil ne s'exécute : la voie stable a déjà produit les effets du tour.
  return mode === "on";
}

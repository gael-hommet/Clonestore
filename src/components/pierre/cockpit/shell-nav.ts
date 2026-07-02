// P9.3 — Configuration de la navigation interne du cockpit (6 vues).
// Query param stable `?view=`, cibles de tour, libellés humains.

export type CockpitView = "overview" | "missions" | "validations" | "documents" | "employees" | "activity";

export interface CockpitNavItem {
  readonly view: CockpitView;
  readonly label: string;
  readonly tourId: string;
}

export const COCKPIT_NAV: readonly CockpitNavItem[] = [
  { view: "overview", label: "Vue d'ensemble", tourId: "pierre-attention" },
  { view: "missions", label: "Missions", tourId: "pierre-missions" },
  { view: "validations", label: "Validations", tourId: "pierre-validations" },
  { view: "documents", label: "Documents", tourId: "pierre-documents" },
  { view: "employees", label: "Salariés", tourId: "pierre-employees" },
  { view: "activity", label: "Activité", tourId: "pierre-activity" },
];

const ALL: readonly CockpitView[] = COCKPIT_NAV.map((n) => n.view);

export function isCockpitView(v: string | null | undefined): v is CockpitView {
  return !!v && (ALL as readonly string[]).includes(v);
}

export function parseCockpitView(v: string | null | undefined): CockpitView {
  return isCockpitView(v) ? v : "overview";
}

// Client Onboarding — machine d'autosave (P9.2, cœur PUR).
//
// Réducteur déterministe de l'état de sauvegarde (débounce et I/O gérés par la
// couche React ; ici, uniquement la logique d'état → testable en `node`).
// idle → dirty (édition) → saving → saved | error. Depuis `saved`, une nouvelle
// édition repasse en `dirty`. Un échec n'écrase jamais la dernière sauvegarde
// réussie.

export type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

export interface AutosaveState {
  readonly status: SaveStatus;
  /** Horodatage ISO de la dernière sauvegarde RÉUSSIE (persiste malgré une erreur). */
  readonly lastSavedAt: string | null;
  readonly error: string | null;
}

export type AutosaveAction =
  | { readonly type: "EDIT" }
  | { readonly type: "SAVE_START" }
  | { readonly type: "SAVE_SUCCESS"; readonly at: string }
  | { readonly type: "SAVE_ERROR"; readonly error: string }
  | { readonly type: "RESET" };

export const AUTOSAVE_INITIAL: AutosaveState = {
  status: "idle",
  lastSavedAt: null,
  error: null,
};

export function autosaveReducer(state: AutosaveState, action: AutosaveAction): AutosaveState {
  switch (action.type) {
    case "EDIT":
      // Une édition rend l'état « sale » ; on efface l'erreur transitoire.
      return { ...state, status: "dirty", error: null };
    case "SAVE_START":
      return { ...state, status: "saving", error: null };
    case "SAVE_SUCCESS":
      return { status: "saved", lastSavedAt: action.at, error: null };
    case "SAVE_ERROR":
      // On garde lastSavedAt (dernière réussite) → aucune perte affichée.
      return { ...state, status: "error", error: action.error };
    case "RESET":
      return AUTOSAVE_INITIAL;
    default:
      return state;
  }
}

/** Doit-on déclencher une sauvegarde ? (état sale, pas déjà en cours). */
export function shouldPersist(state: AutosaveState): boolean {
  return state.status === "dirty";
}

/** Libellé lisible de l'indicateur d'autosave. */
export function autosaveLabel(state: AutosaveState): string {
  switch (state.status) {
    case "saving":
      return "Enregistrement…";
    case "saved":
      return "Enregistré";
    case "error":
      return "Échec de l'enregistrement";
    case "dirty":
      return "Modifications non enregistrées";
    case "idle":
    default:
      return "";
  }
}

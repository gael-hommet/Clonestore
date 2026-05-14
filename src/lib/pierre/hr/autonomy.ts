import {
  type PierreAutonomyLevel,
  PIERRE_AUTONOMY_LEVELS,
} from "./contracts";

// ══════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════

export type PierreAutonomyDecision = {
  autonomy_level: PierreAutonomyLevel;
  can_execute: boolean;
  approval_required: boolean;
  blocked: boolean;
  final_status_hint: "queued" | "awaiting_approval" | "blocked";
  reason: string;
  human_note: string;
};

// ══════════════════════════════════════════════════════════
// RÉSOLUTION DU NIVEAU D'AUTONOMIE
// ══════════════════════════════════════════════════════════

/**
 * Résout une valeur inconnue en PierreAutonomyLevel.
 * Fallback : "validation_smart" (comportement prudent par défaut).
 */
export function resolvePierreAutonomyLevel(value: unknown): PierreAutonomyLevel {
  if (typeof value !== "string") return "validation_smart";
  const trimmed = value.trim().toLowerCase();
  return (PIERRE_AUTONOMY_LEVELS as readonly string[]).includes(trimmed)
    ? (trimmed as PierreAutonomyLevel)
    : "validation_smart";
}

// ══════════════════════════════════════════════════════════
// DÉCISION D'EXÉCUTION
// ══════════════════════════════════════════════════════════

type DecideInput = {
  hr_action_class?: unknown;
  hr_approval_policy?: unknown;
  hr_risk_level?: unknown;
  autonomy_level?: unknown;
};

function isBlackAction(input: DecideInput): boolean {
  return (
    input.hr_action_class === "blocked_without_human" ||
    input.hr_approval_policy === "human_only"
  );
}

function makeBlocked(level: PierreAutonomyLevel): PierreAutonomyDecision {
  return {
    autonomy_level: level,
    can_execute: false,
    approval_required: false,
    blocked: true,
    final_status_hint: "blocked",
    reason: "Action humaine exclusive : décision non délégable à Pierre.",
    human_note:
      "Action réservée à la décision humaine exclusive. Pierre ne peut pas exécuter cette tâche seul.",
  };
}

function makeAwaiting(
  level: PierreAutonomyLevel,
  reason: string,
  human_note: string,
): PierreAutonomyDecision {
  return {
    autonomy_level: level,
    can_execute: false,
    approval_required: true,
    blocked: false,
    final_status_hint: "awaiting_approval",
    reason,
    human_note,
  };
}

function makeAuto(
  level: PierreAutonomyLevel,
  reason: string,
): PierreAutonomyDecision {
  return {
    autonomy_level: level,
    can_execute: true,
    approval_required: false,
    blocked: false,
    final_status_hint: "queued",
    reason,
    human_note: "",
  };
}

function makeTracked(
  level: PierreAutonomyLevel,
  reason: string,
  human_note: string,
): PierreAutonomyDecision {
  return {
    autonomy_level: level,
    can_execute: true,
    approval_required: true,
    blocked: false,
    final_status_hint: "queued",
    reason,
    human_note,
  };
}

// ── Niveaux ───────────────────────────────────────────────

function decideDraftOnly(level: PierreAutonomyLevel): PierreAutonomyDecision {
  return makeAwaiting(
    level,
    "Niveau draft_only : Pierre prépare uniquement, aucune exécution automatique.",
    "L'entreprise opère en mode draft uniquement. Toutes les actions nécessitent une validation humaine avant exécution.",
  );
}

function decideLowRiskExecution(
  hrActionClass: unknown,
  level: PierreAutonomyLevel,
): PierreAutonomyDecision {
  if (hrActionClass === "auto_executable") {
    return makeAuto(level, "Action verte auto-exécutable dans le niveau low_risk_execution.");
  }
  return makeAwaiting(
    level,
    "Niveau low_risk_execution : seules les actions vertes s'exécutent automatiquement.",
    "Cette action dépasse le seuil d'autonomie low_risk. Validation humaine requise.",
  );
}

function decideValidationSmart(
  hrActionClass: unknown,
  level: PierreAutonomyLevel,
): PierreAutonomyDecision {
  if (hrActionClass === "auto_executable") {
    return makeAuto(level, "Action verte auto-exécutable en mode validation_smart.");
  }
  if (hrActionClass === "validation_recommended") {
    return makeAwaiting(
      level,
      "Action orange en validation_smart : Pierre prépare, validation recommandée avant diffusion.",
      "Pierre a préparé cette action. Relecture humaine recommandée avant tout usage ou envoi.",
    );
  }
  return makeAwaiting(
    level,
    "Action à risque élevé en validation_smart : validation obligatoire avant exécution.",
    "Cette action nécessite une validation humaine explicite avant que Pierre puisse l'exécuter.",
  );
}

function decideAdvancedOperations(
  hrActionClass: unknown,
  level: PierreAutonomyLevel,
): PierreAutonomyDecision {
  if (hrActionClass === "auto_executable") {
    return makeAuto(level, "Action verte auto-exécutable en mode advanced_operations.");
  }
  if (hrActionClass === "validation_recommended") {
    return makeTracked(
      level,
      "Action orange en advanced_operations : Pierre exécute et trace, revue recommandée.",
      "Pierre a exécuté et produit le livrable. Revue humaine recommandée avant diffusion finale.",
    );
  }
  return makeAwaiting(
    level,
    "Action rouge en advanced_operations : validation humaine obligatoire.",
    "Cette action dépasse le seuil d'autonomie autorisé même en mode avancé. Validation requise.",
  );
}

function decideEnterpriseRules(
  hrActionClass: unknown,
  level: PierreAutonomyLevel,
): PierreAutonomyDecision {
  // Même base que advanced_operations.
  // Placeholder pour overrides futurs via règles entreprise configurables.
  return decideAdvancedOperations(hrActionClass, level);
}

// ── Point d'entrée ────────────────────────────────────────

/**
 * Calcule la politique d'exécution finale en combinant la classe d'action HR
 * et le niveau d'autonomie de l'entreprise.
 *
 * Règle invariante : les actions noires (blocked_without_human / human_only)
 * sont toujours bloquées, quel que soit le niveau d'autonomie.
 */
export function decidePierreHrExecutionPolicy(
  input: DecideInput,
): PierreAutonomyDecision {
  const level = resolvePierreAutonomyLevel(input.autonomy_level);

  if (isBlackAction(input)) {
    return makeBlocked(level);
  }

  switch (level) {
    case "draft_only":
      return decideDraftOnly(level);
    case "low_risk_execution":
      return decideLowRiskExecution(input.hr_action_class, level);
    case "validation_smart":
      return decideValidationSmart(input.hr_action_class, level);
    case "advanced_operations":
      return decideAdvancedOperations(input.hr_action_class, level);
    case "enterprise_rules":
      return decideEnterpriseRules(input.hr_action_class, level);
  }
}

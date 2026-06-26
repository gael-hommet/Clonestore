// TECH-11 — Technology Readiness Final Gate — Sources
// Références aux modules et docs TECH-01 → TECH-10.
// Pure functions: no async, no Supabase, no Next.js, no side effects.

import type { GlobalTechnologyKey } from "../technologies/global-tech-config";
import { DEFAULT_GLOBAL_TECH_CONFIGS } from "../technologies/global-tech-defaults";
import {
  EMPLOYEE_RUNTIME_REGISTRY,
  getEmployeeRuntimeContract,
} from "../employees/employee-registry";

// ── Source map ────────────────────────────────────────────────────────────────

export interface TechnologySourceEntry {
  key: GlobalTechnologyKey;
  tech_number: string;      // TECH-XX
  module_path: string;
  doc_path: string;
  is_implemented: boolean;
  is_global_layer: boolean; // TECH-05+ = couche globale
}

export const TECHNOLOGY_SOURCE_MAP: Record<GlobalTechnologyKey, TechnologySourceEntry> = {
  cloneos: {
    key: "cloneos",
    tech_number: "TECH-08",
    module_path: "src/lib/clonestore/cloneos/",
    doc_path: "docs/TECH_08_CLONEOS_COMMAND_CENTER_ALIGNMENT.md",
    is_implemented: true,
    is_global_layer: true,
  },
  cloneadn: {
    key: "cloneadn",
    tech_number: "TECH-05",
    module_path: "src/lib/clonestore/adn/",
    doc_path: "docs/TECH_05_CLONEADN_GLOBAL_ENTERPRISE_MEMORY.md",
    is_implemented: true,
    is_global_layer: true,
  },
  cloneguard: {
    key: "cloneguard",
    tech_number: "TECH-06",
    module_path: "src/lib/clonestore/guard/",
    doc_path: "docs/TECH_06_CLONEGUARD_CLONEPOLICY_GLOBAL_RULES.md",
    is_implemented: true,
    is_global_layer: true,
  },
  clonetrace: {
    key: "clonetrace",
    tech_number: "TECH-07",
    module_path: "src/lib/clonestore/trace/",
    doc_path: "docs/TECH_07_CLONETRACE_GLOBAL_AUDIT_TIMELINE.md",
    is_implemented: true,
    is_global_layer: true,
  },
  clonevoice: {
    key: "clonevoice",
    tech_number: "TECH-10",
    module_path: "src/lib/clonestore/voice/",
    doc_path: "docs/TECH_10_CLONEVOICE_READINESS_LAYER.md",
    is_implemented: true,  // Readiness layer implémentée
    is_global_layer: true,
  },
  clonechat: {
    key: "clonechat",
    tech_number: "TECH-01",
    module_path: "src/lib/cloneos/channels/",
    doc_path: "docs/TECH_01_CLONESTORE_TECHNOLOGIES_REAL_AUDIT.md",
    is_implemented: true,  // Partiellement — chat API via CloneOS channels
    is_global_layer: false,
  },
  clonepolicy: {
    key: "clonepolicy",
    tech_number: "TECH-06",
    module_path: "src/lib/clonestore/guard/",  // Interne à CloneGuard
    doc_path: "docs/TECH_06_CLONEGUARD_CLONEPOLICY_GLOBAL_RULES.md",
    is_implemented: true,  // Interne dans CloneGuard pipeline
    is_global_layer: true,
  },
  clonecontinuum: {
    key: "clonecontinuum",
    tech_number: "TECH-01",
    module_path: "src/lib/pierre/",  // Pierre-level uniquement en V1
    doc_path: "docs/TECH_01_CLONESTORE_TECHNOLOGIES_REAL_AUDIT.md",
    is_implemented: true,  // Partiellement via Pierre
    is_global_layer: false,
  },
  clonetrust: {
    key: "clonetrust",
    tech_number: "TECH-06",
    module_path: "src/lib/clonestore/guard/",  // Dans CloneGuard pipeline
    doc_path: "docs/TECH_06_CLONEGUARD_CLONEPOLICY_GLOBAL_RULES.md",
    is_implemented: true,  // Dans CloneGuard — autonomie graduelle
    is_global_layer: true,
  },
  clonereview: {
    key: "clonereview",
    tech_number: "TECH-01",
    module_path: "",  // Roadmap — non implémenté
    doc_path: "docs/TECH_01_CLONESTORE_TECHNOLOGIES_REAL_AUDIT.md",
    is_implemented: false,
    is_global_layer: false,
  },
  clonesignals: {
    key: "clonesignals",
    tech_number: "TECH-01",
    module_path: "",  // Roadmap — non implémenté
    doc_path: "docs/TECH_01_CLONESTORE_TECHNOLOGIES_REAL_AUDIT.md",
    is_implemented: false,
    is_global_layer: false,
  },
  clonelearn: {
    key: "clonelearn",
    tech_number: "TECH-01",
    module_path: "",  // Roadmap — non implémenté
    doc_path: "docs/TECH_01_CLONESTORE_TECHNOLOGIES_REAL_AUDIT.md",
    is_implemented: false,
    is_global_layer: false,
  },
  clonebrief: {
    key: "clonebrief",
    tech_number: "TECH-09",
    module_path: "src/lib/clonestore/brief/",
    doc_path: "docs/TECH_09_CLONEBRIEF_EXECUTIVE_SUMMARIES.md",
    is_implemented: true,
    is_global_layer: true,
  },
};

// ── Collecte des sources ──────────────────────────────────────────────────────

/**
 * Collecte toutes les sources de readiness technologique.
 */
export function collectTechnologyReadinessSources(): TechnologySourceEntry[] {
  return Object.values(TECHNOLOGY_SOURCE_MAP);
}

/**
 * Collecte les modules implémentés.
 */
export function collectTechnologyModules(): string[] {
  return Object.values(TECHNOLOGY_SOURCE_MAP)
    .filter((s) => s.is_implemented && s.module_path)
    .map((s) => s.module_path);
}

/**
 * Collecte les docs créées.
 */
export function collectTechnologyDocs(): string[] {
  const uniqueDocs = new Set(
    Object.values(TECHNOLOGY_SOURCE_MAP)
      .filter((s) => s.doc_path)
      .map((s) => s.doc_path),
  );
  return Array.from(uniqueDocs);
}

/**
 * Collecte les sources Employee Runtime Contract (TECH-02).
 */
export function collectEmployeeRuntimeSources(): {
  module_path: string;
  doc_path: string;
  employees_registered: string[];
  is_implemented: boolean;
} {
  const registered = EMPLOYEE_RUNTIME_REGISTRY.map((e) => e.slug);
  return {
    module_path: "src/lib/clonestore/employees/",
    doc_path: "docs/TECH_02_EMPLOYEE_RUNTIME_CONTRACT.md",
    employees_registered: registered,
    is_implemented: registered.length > 0,
  };
}

/**
 * Collecte les blockers externes au lancement public.
 * Ces informations proviennent des go-live proofs — pas de DB.
 */
export function collectGoLiveExternalBlockers(): Array<{
  blocker_id: string;
  label: string;
  type: string;
}> {
  return [
    {
      blocker_id: "company_legal_entity_pending",
      label: "Société légale non finalisée",
      type: "legal",
    },
    {
      blocker_id: "stripe_live_pending",
      label: "Stripe live non configuré",
      type: "payment",
    },
    {
      blocker_id: "legal_review_pending",
      label: "Validation juridique en attente",
      type: "legal",
    },
    {
      blocker_id: "production_rls_pending",
      label: "RLS production Supabase en attente",
      type: "security",
    },
    {
      blocker_id: "live_e2e_paid_customer_pending",
      label: "E2E client payant live en attente",
      type: "operational",
    },
  ];
}

/**
 * Construit la carte complète des sources technologiques.
 */
export function buildTechnologySourceMap(): {
  technology_configs_count: number;
  source_entries: TechnologySourceEntry[];
  tech_docs: string[];
  implemented_count: number;
  roadmap_count: number;
  global_layer_count: number;
  employees_registered: string[];
  external_blockers_count: number;
} {
  const entries = collectTechnologyReadinessSources();
  const docs = collectTechnologyDocs();
  const employeeSources = collectEmployeeRuntimeSources();
  const blockers = collectGoLiveExternalBlockers();

  return {
    technology_configs_count: Object.keys(DEFAULT_GLOBAL_TECH_CONFIGS).length,
    source_entries: entries,
    tech_docs: docs,
    implemented_count: entries.filter((e) => e.is_implemented).length,
    roadmap_count: entries.filter((e) => !e.is_implemented).length,
    global_layer_count: entries.filter((e) => e.is_global_layer).length,
    employees_registered: employeeSources.employees_registered,
    external_blockers_count: blockers.length,
  };
}

/**
 * Retourne la source d'une technologie spécifique.
 */
export function getTechnologySource(
  key: GlobalTechnologyKey,
): TechnologySourceEntry | undefined {
  return TECHNOLOGY_SOURCE_MAP[key];
}

/**
 * Retourne les configs de toutes les technologies (array).
 */
export function getAllTechnologyConfigs() {
  return Object.values(DEFAULT_GLOBAL_TECH_CONFIGS);
}

/**
 * Retourne le contrat Pierre.
 */
export function getPierreContract() {
  return getEmployeeRuntimeContract("pierre");
}

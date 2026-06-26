// src/lib/clonestore/runtime-integration/controlled-mission-server-persistence-api-contract.ts
// PHASE 5.4 — Controlled Mission Governed Server Persistence — API Contract (design-only)
//
// DESIGN-ONLY. Décrit la FORME future de la route serveur, qui N'EXISTE PAS et
// N'EST PAS créée en P5.4. current_phase_status = "disabled_design_only".
// route_file_created = false. Aucune route active. Aucun appel réseau.
// Aucune écriture. Aucun moteur Pierre. Aucune IA.
//
// NOTE : ce module documente volontairement le chemin de la route FUTURE. Aucun
// fichier route.ts correspondant n'est créé dans cette phase.

import type { GovernedControlledMissionServerPersistenceApiContract } from "./controlled-mission-server-persistence-types";

// Route serveur FUTURE — documentée, jamais créée en P5.4.
export const CONTROLLED_MISSION_SERVER_PERSISTENCE_FUTURE_ENDPOINT =
  "/api/clonestore/runtime/controlled-missions" as const;

export function buildControlledMissionServerPersistenceApiContract(): GovernedControlledMissionServerPersistenceApiContract {
  return {
    future_endpoint: CONTROLLED_MISSION_SERVER_PERSISTENCE_FUTURE_ENDPOINT,
    future_method: "POST",
    current_phase_status: "disabled_design_only",
    route_file_created: false,
    request_shape: {
      local_controlled_mission_id: "string",
      tenant_id: "string",
      title: "string",
      server_persistence_status: "string",
      governance_status: "string",
    },
    response_shape: {
      id: "string (future)",
      server_persistence_status: "string",
      execution_status: "string",
      execution_enabled: "false",
      server_write_performed: "false",
    },
    safety_flags: {
      execution_enabled: false,
      runtime_execution_enabled: false,
      pierre_engine_enabled: false,
      ai_execution_enabled: false,
      email_sending_enabled: false,
      document_generation_enabled: false,
      clonevoice_enabled: false,
      db_write_performed: false,
    },
  };
}

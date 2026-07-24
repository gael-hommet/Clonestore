// src/app/api/router/route.ts
//
// P0.2 SIBLING SURFACES CLOSURE (2026-07-23) — NEUTRALISÉE (Option A).
//
// Cette route forwardait auparavant N'IMPORTE QUEL payload pour N'IMPORTE QUEL "agent" vers
// un webhook Make.com CODÉ EN DUR dans le fichier, sans aucune classification d'action, sans
// CloneGuard, sans gouvernance — la seule barrière était un token opaque comparé en clair
// contre une table `api_tokens` absente de toute migration suivie du dépôt (confirmé :
// `grep -r "api_tokens" supabase/migrations` = 0 résultat), et un contrôle d'entitlement
// (`agents_owned`, clé `client_id`+`agent_name`) incohérent avec le schéma utilisé ailleurs
// (`orders`, clé `user_id`+`agent_slug`).
//
// Preuve de neutralisation sûre : recherche exhaustive de "/api/router" dans tout le dépôt
// (src/, scripts/, docs/) — SEUL ce fichier s'y référence. Aucun appelant interne, aucun
// script, aucun test ne dépend de ce endpoint.
//
// Décision : ni suppression du fichier (au cas où une intégration externe historique pointe
// encore vers cette URL — improbable mais non prouvable depuis le code seul), ni tolérance
// silencieuse de l'ancien comportement. La route répond désormais 410 Gone de façon
// explicite et systématique, SANS AUCUN appel réseau, sans lecture de la table de tokens
// dépréciée, et sans référence à l'URL Make (retirée du code — elle ne doit plus jamais
// apparaître dans ce fichier ni dans aucun log).
//
// Voir audit-20260723-full/P0_2_SIBLING_SURFACES_CLOSURE_REPORT.md pour la cartographie
// complète des appelants et la preuve d'absence d'effet externe.
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      status: "GONE",
      agent: null,
      data: null,
      error:
        "Cette route est retirée (P0.2 governance closure, 2026-07-23) : aucun appelant interne identifié, gouvernance absente. Utiliser /api/pierre/action ou /api/pierre/execute, tous deux gouvernés par CloneGuard.",
    },
    { status: 410 }
  );
}

export async function GET() {
  return NextResponse.json(
    { status: "GONE", agent: null, data: null, error: "Route retirée (410)." },
    { status: 410 }
  );
}

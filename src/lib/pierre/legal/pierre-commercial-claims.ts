// B47 — Pierre Commercial Claims
// Safe and forbidden commercial claims specific to Pierre HR assistant.
// Pure: no Supabase, no Next, no async. No throw.

import { evaluateCommercialClaim } from "../../legal-commercial/claims-policy";
import type { ClaimDecision, LegalRiskLevel, LegalCommercialClaim } from "../../legal-commercial/types";

type CommercialClaimEvaluation = { decision: ClaimDecision; risk_level: LegalRiskLevel; matched_claim: LegalCommercialClaim | null; reason: string | null };

export type PierreClaimCategory =
  | "assistant_capability"
  | "automation"
  | "document_generation"
  | "legal_compliance"
  | "payroll"
  | "hr_decision"
  | "email"
  | "time_saving"
  | "cost_reduction"
  | "expert_replacement";

export type PierreCommercialClaim = {
  id: string;
  category: PierreClaimCategory;
  claim: string;
  is_safe: boolean;
  safe_rewrite: string | null;
  forbidden_reason: string | null;
};

const PIERRE_SAFE_CLAIMS: PierreCommercialClaim[] = [
  {
    id: "p-safe-01",
    category: "assistant_capability",
    claim: "Pierre assiste vos équipes RH au quotidien.",
    is_safe: true,
    safe_rewrite: null,
    forbidden_reason: null,
  },
  {
    id: "p-safe-02",
    category: "automation",
    claim: "Pierre automatise une grande partie des tâches RH opérationnelles répétitives.",
    is_safe: true,
    safe_rewrite: null,
    forbidden_reason: null,
  },
  {
    id: "p-safe-03",
    category: "document_generation",
    claim: "Pierre prépare des brouillons de documents RH sous validation humaine.",
    is_safe: true,
    safe_rewrite: null,
    forbidden_reason: null,
  },
  {
    id: "p-safe-04",
    category: "time_saving",
    claim: "Pierre aide vos équipes à gagner du temps sur les tâches RH administratives.",
    is_safe: true,
    safe_rewrite: null,
    forbidden_reason: null,
  },
  {
    id: "p-safe-05",
    category: "cost_reduction",
    claim: "Pierre réduit le coût de traitement administratif RH.",
    is_safe: true,
    safe_rewrite: null,
    forbidden_reason: null,
  },
  {
    id: "p-safe-06",
    category: "payroll",
    claim: "Pierre structure et centralise les éléments variables de pré-paie.",
    is_safe: true,
    safe_rewrite: null,
    forbidden_reason: null,
  },
  {
    id: "p-safe-07",
    category: "document_generation",
    claim: "Pierre génère des modèles de documents RH personnalisés à valider par vos équipes.",
    is_safe: true,
    safe_rewrite: null,
    forbidden_reason: null,
  },
  {
    id: "p-safe-08",
    category: "email",
    claim: "Pierre prépare des brouillons de communications RH internes.",
    is_safe: true,
    safe_rewrite: null,
    forbidden_reason: null,
  },
];

const PIERRE_FORBIDDEN_CLAIMS: PierreCommercialClaim[] = [
  {
    id: "p-forb-01",
    category: "expert_replacement",
    claim: "Pierre remplace votre service juridique.",
    is_safe: false,
    safe_rewrite: "Pierre complète votre service RH, sans remplacer un conseil juridique.",
    forbidden_reason: "Pierre n'est pas un service juridique — ne remplace pas un avocat ou juriste.",
  },
  {
    id: "p-forb-02",
    category: "legal_compliance",
    claim: "Pierre garantit la conformité légale de vos documents RH.",
    is_safe: false,
    safe_rewrite: "Pierre prépare vos documents RH — la conformité finale reste à valider par vos équipes ou un conseil.",
    forbidden_reason: "Aucune IA ne peut garantir la conformité légale de documents officiels.",
  },
  {
    id: "p-forb-03",
    category: "payroll",
    claim: "Pierre remplace votre logiciel de paie.",
    is_safe: false,
    safe_rewrite: "Pierre prépare les éléments variables de pré-paie — il ne remplace pas un logiciel de paie certifié.",
    forbidden_reason: "Pierre n'est pas un logiciel de paie certifié, ne génère pas de bulletins officiels, ne soumet pas la DSN.",
  },
  {
    id: "p-forb-04",
    category: "hr_decision",
    claim: "Pierre prend les décisions RH à votre place.",
    is_safe: false,
    safe_rewrite: "Pierre assiste vos décisions RH — la décision finale reste humaine.",
    forbidden_reason: "Décisions RH (licenciement, sanction, promotion) exclusivement humaines.",
  },
  {
    id: "p-forb-05",
    category: "legal_compliance",
    claim: "Pierre garantit zéro erreur sur vos documents RH.",
    is_safe: false,
    safe_rewrite: "Pierre réduit les erreurs courantes sur les documents RH — validation humaine recommandée pour tout document officiel.",
    forbidden_reason: "Aucun système IA ne garantit zéro erreur.",
  },
  {
    id: "p-forb-06",
    category: "email",
    claim: "Pierre envoie automatiquement vos communications RH.",
    is_safe: false,
    safe_rewrite: "Pierre prépare vos communications RH — vous gardez le contrôle de l'envoi.",
    forbidden_reason: "Envoi automatique interdit — tout email RH requiert approbation humaine.",
  },
  {
    id: "p-forb-07",
    category: "expert_replacement",
    claim: "Pierre remplace un expert-comptable.",
    is_safe: false,
    safe_rewrite: "Pierre facilite la préparation de la pré-paie pour votre expert-comptable.",
    forbidden_reason: "Pierre ne remplace pas un expert-comptable ni un gestionnaire de paie.",
  },
  {
    id: "p-forb-08",
    category: "hr_decision",
    claim: "Pierre peut licencier un salarié automatiquement.",
    is_safe: false,
    safe_rewrite: "Pierre peut préparer un dossier de licenciement — la décision et la procédure restent humaines.",
    forbidden_reason: "Licenciement : procédure légale stricte, décision exclusivement humaine.",
  },
  {
    id: "p-forb-09",
    category: "legal_compliance",
    claim: "Pierre est juridiquement autonome.",
    is_safe: false,
    safe_rewrite: "Pierre assiste vos équipes RH dans un cadre d'autonomie encadrée.",
    forbidden_reason: "Pierre n'est pas un service juridique autonome.",
  },
  {
    id: "p-forb-10",
    category: "payroll",
    claim: "Pierre soumet votre DSN.",
    is_safe: false,
    safe_rewrite: "Pierre prépare les données pré-paie — la DSN est soumise par votre logiciel de paie ou expert-comptable.",
    forbidden_reason: "Soumission DSN : acte officiel réservé aux logiciels certifiés et experts habilités.",
  },
];

// ── Accessors ─────────────────────────────────────────────────────────────────

export function getAllPierreSafeClaims(): PierreCommercialClaim[] {
  return PIERRE_SAFE_CLAIMS;
}

export function getAllPierreForbiddenClaims(): PierreCommercialClaim[] {
  return PIERRE_FORBIDDEN_CLAIMS;
}

export function isPierreClaimSafe(claim: string): boolean {
  const lower = claim.toLowerCase();
  for (const forbidden of PIERRE_FORBIDDEN_CLAIMS) {
    if (lower.includes(forbidden.claim.toLowerCase())) return false;
  }
  return true;
}

export function getPierreSafeRewrite(claim: string): string | null {
  const lower = claim.toLowerCase();
  for (const forbidden of PIERRE_FORBIDDEN_CLAIMS) {
    if (lower.includes(forbidden.claim.toLowerCase())) {
      return forbidden.safe_rewrite;
    }
  }
  return null;
}

export function evaluatePierreCommercialClaim(claim: string): CommercialClaimEvaluation {
  return evaluateCommercialClaim(claim);
}

export function getPierrePositioningStatement(): string {
  return "Pierre est un employé IA RH : il prend en charge un périmètre opérationnel — il comprend, organise, prépare, suit, relance et trace le travail — pendant que l'humain garde la responsabilité finale des décisions officielles, légales et contractuelles.";
}

export function getPierreLegalLimitStatement(): string {
  return "Pierre n'est pas un avocat, juriste, expert-comptable, logiciel de paie certifié, ni un service de conseil légal. Il prépare et assiste — il ne décide pas seul, ne garantit pas la conformité, et ne signe pas à la place de l'humain.";
}

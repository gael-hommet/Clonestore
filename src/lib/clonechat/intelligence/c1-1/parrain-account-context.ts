// src/lib/clonechat/intelligence/c1-1/parrain-account-context.ts
// C1.1 — Contexte de compte : instantané BORNÉ et SPÉCIFIQUE À LA QUESTION du contexte
// entreprise de l'utilisateur authentifié. Règles dures : companyId résolu serveur
// (jamais du body client) ; chaque port exige le tenant ; tout élément dont le
// companyId diffère est REJETÉ ; aucun dump complet d'entreprise vers le modèle ;
// données minimales nécessaires uniquement.

import { redactSymptom } from "../../bug-memory";
import { derivedChunkId, makeParrainChunk } from "./parrain-knowledge-chunk";
import type { ParrainKnowledgeChunk, ParrainViewerContext } from "./parrain-types";

// ── Formes minimales (lecture seule, déjà autorisées côté service) ────────────
export interface AccountMissionLite {
  readonly id: string;
  readonly companyId: string;
  readonly title: string;
  readonly status: string;
  readonly updatedAt: string | null;
}
export interface AccountValidationLite {
  readonly id: string;
  readonly companyId: string;
  readonly missionId: string | null;
  readonly label: string;
  readonly status: string;
}
export interface AccountEmployeeLite {
  readonly id: string;
  readonly companyId: string;
  readonly displayName: string;
  readonly role: string | null;
}
export interface AccountArtifactLite {
  readonly id: string;
  readonly companyId: string;
  readonly missionId: string | null;
  readonly label: string;
  readonly kind: string;
  readonly version: number | null;
  readonly createdAt: string | null;
}

/** Port lecture-seule sur les services autorisés existants — TOUJOURS tenant-scopé. */
export interface ParrainAccountPort {
  listMissions(companyId: string, limit: number): Promise<readonly AccountMissionLite[]>;
  listValidations(companyId: string, limit: number): Promise<readonly AccountValidationLite[]>;
  listEmployees(companyId: string, limit: number): Promise<readonly AccountEmployeeLite[]>;
  listArtifacts(companyId: string, limit: number): Promise<readonly AccountArtifactLite[]>;
  readAutonomyLabel?(companyId: string): Promise<string | null>;
}

export interface ParrainAccountContextSnapshot {
  readonly companyId: string;
  readonly builtAt: string;
  readonly question: string;
  readonly missions: readonly AccountMissionLite[];
  readonly validations: readonly AccountValidationLite[];
  readonly employees: readonly AccountEmployeeLite[];
  readonly artifacts: readonly AccountArtifactLite[];
  readonly autonomyLabel: string | null;
  readonly bounded: true;
  readonly rejectedForeignItems: number;
}

const LIMITS = Object.freeze({ missions: 6, validations: 6, employees: 6, artifacts: 6 });

function needs(question: string): { missions: boolean; validations: boolean; employees: boolean; artifacts: boolean } {
  const q = question.toLowerCase();
  const missions = /mission|tâche|avanc|en cours|statut|bloqué|continue/.test(q);
  const validations = /validation|valider|approuv|attente|confirmer/.test(q);
  const employees = /salari|employé|collaborateur|équipe|onboard|dossier/.test(q);
  const artifacts = /document|avenant|attestation|contrat|fichier|pièce|artefact|généré/.test(q);
  const any = missions || validations || employees || artifacts;
  // Question de compte générique → aperçu minimal missions+validations.
  return any ? { missions, validations, employees, artifacts } : { missions: true, validations: true, employees: false, artifacts: false };
}

/** Garde tenant : rejette tout élément dont le companyId ne correspond pas EXACTEMENT. */
function keepOwn<T extends { readonly companyId: string }>(items: readonly T[], companyId: string): { own: T[]; rejected: number } {
  const own = items.filter((i) => i.companyId === companyId);
  return { own, rejected: items.length - own.length };
}

/** Construit l'instantané borné, spécifique à la question. Fail-closed sans tenant. */
export async function buildAccountContextSnapshot(
  port: ParrainAccountPort,
  viewer: ParrainViewerContext,
  question: string,
  at: string,
): Promise<ParrainAccountContextSnapshot | null> {
  if (viewer.mode === "public") return null; // JAMAIS de contexte compte en mode public
  const companyId = viewer.companyId;
  if (!companyId || companyId.trim().length === 0) return null;
  const want = needs(question);
  let rejected = 0;
  const take = async <T extends { readonly companyId: string }>(
    on: boolean,
    fn: () => Promise<readonly T[]>,
  ): Promise<T[]> => {
    if (!on) return [];
    try {
      const r = keepOwn(await fn(), companyId);
      rejected += r.rejected;
      return r.own;
    } catch {
      return []; // panne de service = contexte vide, jamais de fuite ni de blocage du tour
    }
  };
  const [missions, validations, employees, artifacts] = await Promise.all([
    take(want.missions, () => port.listMissions(companyId, LIMITS.missions)),
    take(want.validations, () => port.listValidations(companyId, LIMITS.validations)),
    take(want.employees, () => port.listEmployees(companyId, LIMITS.employees)),
    take(want.artifacts, () => port.listArtifacts(companyId, LIMITS.artifacts)),
  ]);
  let autonomyLabel: string | null = null;
  try {
    autonomyLabel = port.readAutonomyLabel ? await port.readAutonomyLabel(companyId) : null;
  } catch {
    autonomyLabel = null;
  }
  return Object.freeze({
    companyId,
    builtAt: at,
    question,
    missions: missions.slice(0, LIMITS.missions),
    validations: validations.slice(0, LIMITS.validations),
    employees: employees.slice(0, LIMITS.employees),
    artifacts: artifacts.slice(0, LIMITS.artifacts),
    autonomyLabel,
    bounded: true,
    rejectedForeignItems: rejected,
  });
}

/** Convertit l'instantané en chunks COMPANY_SCOPED (tenant porté par chaque chunk). */
export function accountSnapshotChunks(snapshot: ParrainAccountContextSnapshot): readonly ParrainKnowledgeChunk[] {
  const chunks: ParrainKnowledgeChunk[] = [];
  const add = (idSeed: string, title: string, text: string, sourceType: "mission" | "validation" | "employee" | "generated_document" | "company_context") => {
    chunks.push(
      makeParrainChunk({
        id: derivedChunkId("acct", `${snapshot.companyId}|${idSeed}`),
        sourceId: "src.company_context",
        title,
        text: redactSymptom(text),
        sourceType,
        authority: "tenant_data",
        visibility: "COMPANY_SCOPED",
        tenantCompanyId: snapshot.companyId,
        citationLabel: "votre espace",
      }),
    );
  };
  if (snapshot.missions.length) {
    add(
      "missions",
      "Vos missions récentes",
      snapshot.missions.map((m) => `${m.title} (statut : ${m.status})`).join(" · "),
      "mission",
    );
  }
  if (snapshot.validations.length) {
    add(
      "validations",
      "Vos validations en attente",
      snapshot.validations.map((v) => `${v.label} (${v.status})`).join(" · "),
      "validation",
    );
  }
  if (snapshot.employees.length) {
    add(
      "employees",
      "Salariés concernés",
      snapshot.employees.map((e) => `${e.displayName}${e.role ? ` (${e.role})` : ""}`).join(" · "),
      "employee",
    );
  }
  if (snapshot.artifacts.length) {
    add(
      "artifacts",
      "Documents de votre espace",
      snapshot.artifacts.map((a) => `${a.label} (${a.kind}${a.version ? `, v${a.version}` : ""})`).join(" · "),
      "generated_document",
    );
  }
  if (snapshot.autonomyLabel) {
    add("autonomy", "Mode d'autonomie de Pierre", `Pierre opère actuellement en mode « ${snapshot.autonomyLabel} ».`, "company_context");
  }
  return chunks;
}

/** Refus explicite d'un ID étranger (mission/document/salarié hors tenant). */
export function assertOwnEntity(entityCompanyId: string | null | undefined, viewer: ParrainViewerContext): boolean {
  return (
    typeof viewer.companyId === "string" &&
    viewer.companyId.length > 0 &&
    entityCompanyId === viewer.companyId
  );
}

// src/lib/clonechat/engine.ts
// P9.4 — Moteur de tour CloneChat GOUVERNÉ et DÉTERMINISTE (aucune IA, aucune
// hallucination). Entrée : message + contexte RÉEL déjà résolu (données V1 via la
// couche P9.3). Sortie : blocs riches + éventuelle action proposée (jamais exécutée
// ici). Pur → testable en node. Le serveur reste l'autorité ; l'humain confirme le
// sensible ; toute donnée affichée provient du contexte réel fourni.

import type {
  CockpitArtifact,
  CockpitEmployeeListItem,
  CockpitMissionSummary,
  CockpitOverview,
  CockpitPermissions,
  CockpitValidation,
} from "@/lib/client-cockpit";
import { classifyIntent } from "./intent";
import { proposeAction } from "./action-policy";
import {
  detectPromptInjection,
  injectionRefusalMessage,
  needsCompanyContext,
  provenanceFor,
  publicBoundaryBlock,
  publicBoundaryMessage,
  companyBoundaryBlock,
} from "./context-boundary";
import type {
  CloneChatContentBlock,
  CloneChatMode,
  CloneChatProposedAction,
  CloneChatProvenance,
} from "./types";

export interface CloneChatContext {
  readonly mode: CloneChatMode;
  readonly companyLabel: string | null;
  readonly permissions: CockpitPermissions;
  readonly overview: CockpitOverview | null;
  readonly missions: readonly CockpitMissionSummary[];
  readonly validations: readonly CockpitValidation[];
  readonly employees: readonly CockpitEmployeeListItem[];
  readonly artifacts: readonly CockpitArtifact[];
}

export interface CloneChatTurnResult {
  readonly blocks: readonly CloneChatContentBlock[];
  readonly action: CloneChatProposedAction | null;
  readonly provenance: CloneChatProvenance;
}

const COCKPIT = "/agents/pierre/use";
function text(t: string): CloneChatContentBlock { return { type: "text", text: t }; }
function norm(s: string): string {
  return (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}
function matchEmployee(list: readonly CockpitEmployeeListItem[], q: string | null): CockpitEmployeeListItem | null {
  if (!q) return null;
  const nq = norm(q);
  return list.find((e) => norm(e.name).includes(nq) || (e.role && norm(e.role).includes(nq))) ?? null;
}
function matchArtifact(list: readonly CockpitArtifact[], q: string | null): CockpitArtifact | null {
  if (!q) return null;
  const nq = norm(q);
  return list.find((a) => norm(a.title).includes(nq) || norm(a.family).includes(nq)) ?? null;
}

// ── Réponses PUBLIQUES (orientation seule, aucune donnée cliente) ────────────

function publicOrientation(intent: string, raw: string): CloneChatContentBlock[] {
  const n = norm(raw);
  const blocks: CloneChatContentBlock[] = [];
  if (/prix|tarif|combien|cout/.test(n)) {
    blocks.push(text("Pierre est votre employé IA RH. Le détail des offres et de l'activation est présenté sur sa fiche et à l'inscription. Je peux vous y orienter."));
  } else if (/demo|demonstration|exemple/.test(n)) {
    blocks.push(text("La démonstration montre une mission RH complète, de la demande jusqu'au résultat, en quelques minutes."));
  } else if (intent === "help") {
    blocks.push(text("Je suis l'assistant d'orientation CloneStore. Je peux vous expliquer Pierre, la plateforme, les cas d'usage RH, et vous guider vers la démo ou l'inscription. Une fois connecté, je deviens opérationnel sur votre entreprise."));
  } else {
    blocks.push(text("CloneStore fournit des employés IA opérationnels. Pierre, l'employé IA RH, prépare des contrats, organise des onboardings, relance des candidats et prépare vos communications — toujours sous votre validation."));
  }
  blocks.push(publicBoundaryBlock());
  return blocks;
}

// ── Moteur principal ─────────────────────────────────────────────────────────

export function runCloneChatTurn(message: string, ctx: CloneChatContext): CloneChatTurnResult {
  const raw = (message ?? "").trim();

  // 1) Anti prompt-injection (signal UX ; l'autorité reste serveur).
  if (detectPromptInjection(raw)) {
    return {
      blocks: [text(injectionRefusalMessage()), ctx.mode === "public" ? publicBoundaryBlock() : companyBoundaryBlock(ctx.companyLabel)],
      action: null,
      provenance: ctx.mode === "public" ? "public" : "company",
    };
  }

  const { intent, entities, ambiguous } = classifyIntent(raw);

  // 2) Mode PUBLIC — orientation uniquement, jamais de donnée entreprise.
  if (ctx.mode === "public") {
    if (needsCompanyContext(intent)) {
      const nav = proposeAction({ kind: "navigate", label: "Se connecter", mode: "public", permissions: ctx.permissions, href: "/login" });
      return { blocks: [text(publicBoundaryMessage()), { type: "action_preview", action: nav }, publicBoundaryBlock()], action: nav, provenance: "public" };
    }
    return { blocks: publicOrientation(intent, raw), action: null, provenance: "public" };
  }

  // 3) Mode AUTHENTIFIÉ — données réelles + actions gouvernées.
  const blocks: CloneChatContentBlock[] = [];
  let action: CloneChatProposedAction | null = null;
  let usedCompanyData = false;

  const boundary = () => companyBoundaryBlock(ctx.companyLabel);

  switch (intent) {
    case "clarify":
      blocks.push(text("Pouvez-vous préciser votre demande ? Par exemple : « montre mes missions en cours », « qu'est-ce qui attend ma validation », « prépare un contrat pour Marie »."));
      break;

    case "help":
      blocks.push(text("Je peux : résumer l'activité de Pierre, lister et ouvrir vos missions, expliquer et traiter vos validations, retrouver vos salariés et documents, et préparer une nouvelle mission — toujours avec votre confirmation pour les actions sensibles."));
      break;

    case "explain":
      blocks.push(text("Pierre est votre employé IA RH : il prépare vos documents et communications RH, structure vos missions et n'exécute rien de sensible sans votre validation."));
      break;

    case "summarize":
    case "status": {
      usedCompanyData = true;
      const ov = ctx.overview;
      if (!ov || ov.isEmpty) {
        blocks.push(text("Pierre n'a aucune mission active pour le moment. Vous pouvez lui en confier une dès maintenant."));
        action = proposeAction({ kind: "create_mission", label: "Confier une mission", mode: "authenticated", permissions: ctx.permissions, payload: { instruction: "" }, href: COCKPIT });
      } else {
        blocks.push(text(`${ov.health.summary} ${ov.indicators.missionsInProgress} mission(s) en cours, ${ov.indicators.validationsPending} à valider, ${ov.indicators.documentsProduced} document(s).`));
        for (const m of ov.inProgress.slice(0, 3)) blocks.push({ type: "mission", mission: m });
        if (ov.attention.length > 0) {
          const openVal = proposeAction({ kind: "navigate", label: "Voir ce qui attend ma décision", mode: "authenticated", permissions: ctx.permissions, href: `${COCKPIT}?view=validations` });
          blocks.push({ type: "action_preview", action: openVal });
        }
      }
      break;
    }

    case "list_missions":
    case "open_mission": {
      usedCompanyData = true;
      if (ctx.missions.length === 0) {
        blocks.push(text("Aucune mission pour le moment. Souhaitez-vous en confier une à Pierre ?"));
        action = proposeAction({ kind: "create_mission", label: "Confier une mission", mode: "authenticated", permissions: ctx.permissions, payload: { instruction: "" } });
      } else {
        blocks.push(text(`Voici vos missions (${ctx.missions.length}).`));
        for (const m of ctx.missions.slice(0, 5)) blocks.push({ type: "mission", mission: m });
        const open = proposeAction({ kind: "navigate", label: "Ouvrir dans le cockpit", mode: "authenticated", permissions: ctx.permissions, href: `${COCKPIT}?view=missions` });
        blocks.push({ type: "action_preview", action: open });
      }
      break;
    }

    case "create_mission": {
      usedCompanyData = true;
      const instruction = entities.missionInstruction ?? raw;
      blocks.push(text("Voici la mission que je m'apprête à confier à Pierre. Confirmez pour lancer."));
      action = proposeAction({
        kind: "create_mission",
        label: "Confier cette mission à Pierre",
        mode: "authenticated",
        permissions: ctx.permissions,
        payload: { instruction },
        idSeed: "create",
      });
      blocks.push({ type: "action_preview", action });
      break;
    }

    case "list_validations":
    case "open_validation": {
      usedCompanyData = true;
      const pending = ctx.validations.filter((v) => v.status === "pending");
      if (pending.length === 0) {
        blocks.push(text("Rien n'attend votre décision pour le moment."));
      } else {
        blocks.push(text(`${pending.length} validation(s) attendent votre décision.`));
        for (const v of pending.slice(0, 4)) blocks.push({ type: "validation", validation: v });
        const open = proposeAction({ kind: "navigate", label: "Décider dans le cockpit", mode: "authenticated", permissions: ctx.permissions, href: `${COCKPIT}?view=validations` });
        blocks.push({ type: "action_preview", action: open });
      }
      break;
    }

    case "explain_validation": {
      usedCompanyData = true;
      const v = ctx.validations.find((x) => x.status === "pending");
      if (!v) blocks.push(text("Aucune validation en attente à expliquer."));
      else {
        blocks.push(text(`Pierre demande votre accord : ${v.intent}. ${v.reason ?? ""} ${v.isSensitive ? "Cette action est sensible et requiert votre validation." : ""}`.trim()));
        blocks.push({ type: "validation", validation: v });
      }
      break;
    }

    case "list_employees": {
      usedCompanyData = true;
      if (ctx.employees.length === 0) {
        blocks.push(text("Aucun salarié enregistré. Vous pouvez les ajouter depuis Employee 360."));
        action = proposeAction({ kind: "navigate", label: "Ouvrir Employee 360", mode: "authenticated", permissions: ctx.permissions, href: "/agents/pierre/employees" });
      } else {
        blocks.push(text(`Vos salariés suivis (${ctx.employees.length}).`));
        for (const e of ctx.employees.slice(0, 5)) blocks.push({ type: "employee", employee: e });
      }
      break;
    }

    case "open_employee": {
      usedCompanyData = true;
      const emp = matchEmployee(ctx.employees, entities.employeeQuery);
      if (!emp) {
        blocks.push(text(entities.employeeQuery ? `Je ne trouve pas « ${entities.employeeQuery} » parmi vos salariés.` : "De quel salarié s'agit-il ?"));
      } else {
        blocks.push(text(`Voici ${emp.name}.`));
        blocks.push({ type: "employee", employee: emp });
        action = proposeAction({ kind: "open_employee", label: "Ouvrir le dossier", mode: "authenticated", permissions: ctx.permissions, href: emp.href, idSeed: emp.id });
      }
      break;
    }

    case "find_document":
    case "open_document": {
      usedCompanyData = true;
      const doc = matchArtifact(ctx.artifacts, entities.documentQuery);
      if (ctx.artifacts.length === 0) {
        blocks.push(text("Aucun document produit pour le moment."));
      } else if (!doc) {
        blocks.push(text(`${ctx.artifacts.length} document(s) disponibles.`));
        for (const a of ctx.artifacts.slice(0, 4)) blocks.push({ type: "document", document: a });
      } else {
        blocks.push(text(`Voici « ${doc.title} ».`));
        blocks.push({ type: "document", document: doc });
        if (doc.missionId) action = proposeAction({ kind: "open_mission", label: "Ouvrir la mission", mode: "authenticated", permissions: ctx.permissions, href: `${COCKPIT}?view=missions&mission=${encodeURIComponent(doc.missionId)}`, idSeed: doc.id });
      }
      break;
    }

    default:
      blocks.push(text("Je n'ai pas compris. Reformulez, ou demandez « aide » pour voir ce que je peux faire."));
  }

  blocks.push(boundary());
  return { blocks, action, provenance: provenanceFor("authenticated", usedCompanyData), };
}

export { classifyIntent };
export const AMBIGUOUS_HINT = "Précisez votre demande.";

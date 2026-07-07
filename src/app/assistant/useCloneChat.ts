"use client";

// P9.4 — Hook CloneChat. Détecte le mode (public / client authentifié), charge le
// contexte RÉEL (données V1 via les clients P9.3), gère le fil, envoie au serveur
// (mode authentifié → OpenAI réel gouverné ; public → moteur déterministe honnête),
// assemble les blocs et EXÉCUTE les actions confirmées via les contrats V1 réels.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSessionClient } from "@/lib/auth/session-client";
import {
  fetchPierreHistory,
  fetchPierreMission,
  fetchPierreMissionValidations,
  fetchPierreEmployeesV1,
} from "@/lib/pierre/cockpit/api-client";
import {
  buildOverview,
  mapV1MissionList,
  mapV1MissionView,
  mapV1Tasks,
  mapV1Validations,
  mapV1Employees,
  deriveV1Artifacts,
  DEFAULT_PERMISSIONS,
  type CockpitArtifact,
  type CockpitEmployeeListItem,
  type CockpitMissionSummary,
  type CockpitValidation,
} from "@/lib/client-cockpit";
import { runCloneChatTurn, type CloneChatContext } from "@/lib/clonechat/engine";
// Import DIRECT (pas via le barrel openai) : assembleFromStructured est une fonction
// pure ; passer par le barrel embarquerait client.ts/screenshot.ts (import dynamique
// du SDK OpenAI, code Node) dans le bundle NAVIGATEUR. On garde le SDK hors client.
import { assembleFromStructured } from "@/lib/clonechat/openai/governed-turn";
import type { CloneChatMessage, CloneChatProposedAction, CloneChatContentBlock } from "@/lib/clonechat";

export type CloneChatUiMode = "loading" | "public" | "authenticated";

// Préfixe UNIQUE par chargement de page : évite toute collision de clé React entre les
// messages hydratés depuis localStorage/serveur (ids d'une session antérieure) et les
// messages créés en direct (le compteur repart de 0 à chaque chargement de module).
let idCounter = 0;
const ID_SESSION = (() => { try { return Math.random().toString(36).slice(2, 8); } catch { return "s"; } })();
function mkId(seed: string): string { idCounter += 1; return `${seed}-${ID_SESSION}-${idCounter}`; }

function msg(role: CloneChatMessage["role"], blocks: CloneChatContentBlock[], provenance: CloneChatMessage["provenance"], status: CloneChatMessage["status"] = "complete"): CloneChatMessage {
  return { id: mkId(role), role, createdAt: nowIso(), content: blocks, status, provenance };
}
function nowIso(): string { try { return new Date().toISOString(); } catch { return ""; } }

const THREAD_KEY = "clonestore.clonechat.thread.v1";

export function useCloneChat() {
  const [mode, setMode] = useState<CloneChatUiMode>("loading");
  const [messages, setMessages] = useState<CloneChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [companyLabel, setCompanyLabel] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Array<{ id: string; title: string; lastActivityAt: string }>>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const ctxRef = useRef<CloneChatContext>({ mode: "public", companyLabel: null, permissions: DEFAULT_PERMISSIONS, overview: buildOverview({ missions: [], tasks: [], validations: [], artifacts: [] }), missions: [], validations: [], employees: [], artifacts: [] });
  const tokenRef = useRef<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const mounted = useRef(true);
  const setConv = useCallback((id: string | null) => { conversationIdRef.current = id; setConversationId(id); }, []);
  const authHeaders = useCallback((): Record<string, string> => ({ "Content-Type": "application/json", ...(tokenRef.current ? { Authorization: `Bearer ${tokenRef.current}` } : {}) }), []);
  const abortRef = useRef<AbortController | null>(null);
  const lastUserRef = useRef<{ text: string; images: string[] } | null>(null);

  // ── Détection de mode + chargement du contexte réel ────────────────────────
  useEffect(() => {
    mounted.current = true;
    // Reprise du fil local (continuité même navigateur).
    try {
      const raw = localStorage.getItem(THREAD_KEY);
      if (raw) { const t = JSON.parse(raw); if (Array.isArray(t)) setMessages(t.slice(-40)); }
    } catch { /* ignore */ }

    (async () => {
      let authed = false;
      try {
        const sb = getSessionClient();
        const { data } = await sb.auth.getSession();
        const token = data.session?.access_token ?? null;
        tokenRef.current = token;
        if (token) {
          const { data: u } = await sb.auth.getUser();
          if (u.user) { authed = true; setCompanyLabel(u.user.email?.split("@")[0] ?? null); }
        }
      } catch { /* public */ }

      if (!authed) { if (mounted.current) setMode("public"); ctxRef.current = { ...ctxRef.current, mode: "public" }; return; }

      // Authentifié : on fixe le mode opérationnel IMMÉDIATEMENT. Un échec de chargement
      // du contexte V1 (réseau, tenant non provisionné) ne doit JAMAIS rétrograder en
      // public : l'utilisateur reste opérationnel, simplement avec un contexte vide.
      ctxRef.current = { ...ctxRef.current, mode: "authenticated" };
      if (mounted.current) setMode("authenticated");

      try {
        // Charge le contexte réel (borné : missions + salariés + validations des missions actives).
        const [listRes, empRes] = await Promise.all([fetchPierreHistory({ limit: 30 }), fetchPierreEmployeesV1(30)]);
        const missions = listRes.ok ? mapV1MissionList(listRes.data).missions : [];
        const employees: CockpitEmployeeListItem[] = empRes.ok ? mapV1Employees(empRes.data) : [];
        const nonTerminal = missions.filter((m) => m.status !== "done" && m.status !== "cancelled").slice(0, 8);
        const enriched = await Promise.all(nonTerminal.map(async (m) => {
          const [d, v] = await Promise.all([fetchPierreMission(m.id), fetchPierreMissionValidations(m.id)]);
          const view = d.ok ? mapV1MissionView(d.data) : null;
          const tasks = d.ok ? mapV1Tasks(unwrap(d.data), m.id) : [];
          const validations = v.ok ? mapV1Validations(v.data, { permissions: DEFAULT_PERMISSIONS, missionId: m.id, tasksById: new Map(tasks.map((t) => [t.id, t])) }) : [];
          const artifacts = d.ok ? deriveV1Artifacts(unwrap(d.data), { permissions: DEFAULT_PERMISSIONS, missionId: m.id }) : [];
          return { view, validations, artifacts };
        }));
        const byId = new Map(nonTerminal.map((m, i) => [m.id, enriched[i]]));
        const finalMissions: CockpitMissionSummary[] = missions.map((m) => byId.get(m.id)?.view ?? m);
        const validations: CockpitValidation[] = enriched.flatMap((e) => e.validations);
        const artifacts: CockpitArtifact[] = enriched.flatMap((e) => e.artifacts);
        const overview = buildOverview({ missions: finalMissions, tasks: [], validations, artifacts });
        ctxRef.current = { mode: "authenticated", companyLabel: null, permissions: DEFAULT_PERMISSIONS, overview, missions: finalMissions, validations, employees, artifacts };
      } catch { /* contexte V1 indisponible : on reste opérationnel avec un contexte vide */ }

      // Conversations DURABLES (vérité serveur, multi-device). On reprend la plus récente
      // ou on en crée une. Le localStorage ne reste qu'un cache offline.
      try {
        const listRes = await fetch("/api/assistant/conversations", { headers: authHeaders(), credentials: "same-origin" });
        const ld = await listRes.json().catch(() => null);
        const convs: Array<{ id: string; title: string; lastActivityAt: string }> = listRes.ok && ld?.ok ? ld.conversations.map((c: { id: string; title: string; lastActivityAt: string }) => ({ id: c.id, title: c.title, lastActivityAt: c.lastActivityAt })) : [];
        if (mounted.current) setConversations(convs);
        if (convs.length > 0) {
          setConv(convs[0].id);
          const mRes = await fetch(`/api/assistant/conversations/${convs[0].id}`, { headers: authHeaders(), credentials: "same-origin" });
          const md = await mRes.json().catch(() => null);
          if (mRes.ok && md?.ok && mounted.current) {
            const hydrated = (md.messages ?? []).map((m: { role: CloneChatMessage["role"]; content: unknown[] }) => msg(m.role, (m.content ?? []) as CloneChatContentBlock[], m.role === "user" ? "user" : "company"));
            if (hydrated.length > 0) setMessages(hydrated);
          }
        } else {
          const cRes = await fetch("/api/assistant/conversations", { method: "POST", headers: authHeaders(), credentials: "same-origin", body: JSON.stringify({}) });
          const cd = await cRes.json().catch(() => null);
          if (cRes.ok && cd?.ok) { setConv(cd.conversation.id); if (mounted.current) setConversations([{ id: cd.conversation.id, title: cd.conversation.title, lastActivityAt: cd.conversation.lastActivityAt }]); }
        }
      } catch { /* pas de persistance serveur : cache local uniquement */ }
    })().catch(() => { if (mounted.current) setMode("public"); });

    return () => { mounted.current = false; };
  }, []);

  // Persistance locale du fil.
  useEffect(() => {
    try { localStorage.setItem(THREAD_KEY, JSON.stringify(messages.slice(-40))); } catch { /* ignore */ }
  }, [messages]);

  const push = useCallback((m: CloneChatMessage) => setMessages((prev) => [...prev, m]), []);

  // ── Envoi d'un message (texte + captures d'écran optionnelles) ──────────────
  const send = useCallback(async (rawText: string, images: string[] = []) => {
    const t = rawText.trim();
    if ((!t && images.length === 0) || busy) return;
    lastUserRef.current = { text: t, images };
    const userBlocks: CloneChatContentBlock[] = [];
    if (t) userBlocks.push({ type: "text", text: t });
    if (images.length) userBlocks.push({ type: "text", text: `📎 ${images.length} capture${images.length > 1 ? "s" : ""} jointe${images.length > 1 ? "s" : ""}` });
    push(msg("user", userBlocks, "user"));
    setBusy(true);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const ctx = { ...ctxRef.current, companyLabel };
      if (ctx.mode === "public") {
        if (images.length) { push(msg("assistant", [{ type: "text", text: "Connectez-vous pour que j'analyse vos captures d'écran en mode opérationnel." }, { type: "boundary", provenance: "public", text: "Assistant d'orientation — je n'accède pas aux données d'une entreprise." }], "public")); return; }
        const r = runCloneChatTurn(t, ctx);
        push(msg("assistant", [...r.blocks], r.provenance));
        return;
      }
      // Mode authentifié → route serveur (OpenAI réel gouverné, multimodal inclus).
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(tokenRef.current ? { Authorization: `Bearer ${tokenRef.current}` } : {}) },
        credentials: "same-origin",
        signal: ac.signal,
        body: JSON.stringify({ message: t, history: recentHistory(messages), conversation_id: conversationIdRef.current, ...(images.length ? { images } : {}) }),
      });
      const data = await res.json().catch(() => null);
      // Chemin multimodal : analyse structurée honnête.
      if (res.ok && data?.source === "openai_vision" && data.analysis) {
        push(msg("assistant", visionBlocks(data.analysis, data.knownBug), "company"));
        return;
      }
      if (!res.ok || !data?.structured) {
        const r = runCloneChatTurn(t, ctx);
        push(msg("assistant", [...r.blocks], r.provenance));
        return;
      }
      const assembled = assembleFromStructured(data.structured, ctx, data.usageTokens ?? 0, t);
      // P9.4.2 r2 §3 — L'exécution des actions à effet est AUTHORITATIVE CÔTÉ SERVEUR. On retire
      // les aperçus d'action dérivés client, et on n'affiche un bouton « Confirmer » QUE si le
      // serveur a persisté une PROPOSITION (référence proposalId). Le client ne détient jamais
      // le payload canonique : la confirmation appellera /api/assistant/execute avec la référence.
      const blocks: CloneChatContentBlock[] = assembled.blocks.filter((b) => !(b.type === "action_preview" && b.action.requiresConfirmation));
      const prop = data.proposal as { id?: string; kind?: CloneChatProposedAction["kind"]; label?: string } | null | undefined;
      if (prop?.id && prop.kind) {
        blocks.push({ type: "action_preview", action: {
          id: `srv-${prop.id}`, kind: prop.kind, label: prop.label ?? "Confirmer", risk: prop.kind === "cancel_mission" ? "irreversible" : "sensitive",
          requiresConfirmation: true, allowed: true, reason: null, payload: {}, href: null, proposalId: prop.id,
        } });
      }
      // Citations discrètes (« D'après … ») — jamais de chemin de fichier / table au client.
      if (Array.isArray(data.citationLabels) && data.citationLabels.length > 0) blocks.push({ type: "boundary", provenance: "system", text: `D'après ${data.citationLabels.slice(0, 3).join(", ")}.` });
      push(msg("assistant", blocks, "company"));
    } catch (e) {
      if ((e as { name?: string }).name === "AbortError") {
        push(msg("assistant", [{ type: "text", text: "Réponse interrompue." }], "system"));
        return;
      }
      const r = runCloneChatTurn(t, ctxRef.current);
      push(msg("assistant", [...r.blocks], r.provenance));
    } finally {
      abortRef.current = null;
      if (mounted.current) setBusy(false);
    }
  }, [busy, companyLabel, messages, push]);

  // Interrompre la réponse en cours.
  const stop = useCallback(() => { abortRef.current?.abort(); }, []);
  // Réémettre le dernier message utilisateur.
  const retry = useCallback(() => {
    const last = lastUserRef.current;
    if (last && !busy) void send(last.text, last.images);
  }, [busy, send]);

  // ── Exécution d'une action confirmée — AUTHORITATIVE CÔTÉ SERVEUR (P9.4.2 r2 §3) ─
  // Le client ne détient JAMAIS le payload canonique : il ne soumet que la RÉFÉRENCE de la
  // proposition persistée (proposalId). Le serveur charge la proposition, calcule l'identité
  // SHA-256, claim atomiquement, exécute l'effet gouverné (V1 loopback / support durable),
  // re-lit la cible et commit. Navigation / ouverture : pas d'effet serveur (deep-link direct).
  const executeAction = useCallback(async (action: CloneChatProposedAction, confirmed = true) => {
    if (busy) return { ok: false };
    if (!action.proposalId) {
      if (action.kind === "navigate" || action.kind.startsWith("open_")) return { ok: true, href: action.href ?? "/" };
      return { ok: false };
    }
    if (action.requiresConfirmation && !confirmed) return { ok: false };
    setBusy(true);
    try {
      const res = await fetch("/api/assistant/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(tokenRef.current ? { Authorization: `Bearer ${tokenRef.current}` } : {}) },
        credentials: "same-origin",
        body: JSON.stringify({ proposalId: action.proposalId }),
      });
      const d = await res.json().catch(() => null);
      if (!d) { push(msg("assistant", [{ type: "error", category: "runtime", message: "L'action n'a pas abouti. Réessayez.", recovery: [{ kind: "retry", label: "Réessayer", href: null }] }], "pierre")); return { ok: false }; }

      if (d.status === "executed" || d.status === "duplicate") {
        const blocks: CloneChatContentBlock[] = [{ type: "text", text: d.message ?? "C'est fait." }];
        blocks.push({ type: "boundary", provenance: "company", text: "Résultat réel confirmé par le serveur." });
        push(msg("assistant", blocks, d.status === "duplicate" ? "system" : "company"));
        return { ok: true, href: d.href ?? null };
      }
      if (d.status === "in_flight") {
        push(msg("assistant", [{ type: "text", text: d.message ?? "Votre action est en cours de traitement." }], "system"));
        return { ok: true, href: null };
      }
      // failed (terminal) ou retry (récupérable)
      push(msg("assistant", [{ type: "error", category: "runtime", message: d.message ?? "L'action n'a pas abouti.", recovery: d.terminal ? [] : [{ kind: "retry", label: "Réessayer", href: null }] }], "pierre"));
      return { ok: false };
    } catch {
      push(msg("assistant", [{ type: "error", category: "runtime", message: "L'action n'a pas abouti. Réessayez.", recovery: [{ kind: "retry", label: "Réessayer", href: null }] }], "pierre"));
      return { ok: false };
    } finally { if (mounted.current) setBusy(false); }
  }, [busy, push]);

  // ── Gestion des conversations durables (multi-device) ──────────────────────
  const refreshConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/assistant/conversations", { headers: authHeaders(), credentials: "same-origin" });
      const d = await res.json().catch(() => null);
      if (res.ok && d?.ok && mounted.current) setConversations(d.conversations.map((c: { id: string; title: string; lastActivityAt: string }) => ({ id: c.id, title: c.title, lastActivityAt: c.lastActivityAt })));
    } catch { /* ignore */ }
  }, [authHeaders]);

  const openConversation = useCallback(async (id: string) => {
    setConv(id);
    try {
      const res = await fetch(`/api/assistant/conversations/${id}`, { headers: authHeaders(), credentials: "same-origin" });
      const d = await res.json().catch(() => null);
      if (res.ok && d?.ok && mounted.current) setMessages((d.messages ?? []).map((m: { role: CloneChatMessage["role"]; content: unknown[] }) => msg(m.role, (m.content ?? []) as CloneChatContentBlock[], m.role === "user" ? "user" : "company")));
    } catch { /* ignore */ }
  }, [authHeaders, setConv]);

  const newConversation = useCallback(async () => {
    try {
      const res = await fetch("/api/assistant/conversations", { method: "POST", headers: authHeaders(), credentials: "same-origin", body: JSON.stringify({}) });
      const d = await res.json().catch(() => null);
      if (res.ok && d?.ok) { setConv(d.conversation.id); if (mounted.current) setMessages([]); await refreshConversations(); }
    } catch { /* ignore */ }
  }, [authHeaders, setConv, refreshConversations]);

  const deleteConversation = useCallback(async (id: string) => {
    try { await fetch(`/api/assistant/conversations/${id}`, { method: "DELETE", headers: authHeaders(), credentials: "same-origin" }); } catch { /* ignore */ }
    if (conversationIdRef.current === id) { setConv(null); if (mounted.current) setMessages([]); }
    await refreshConversations();
  }, [authHeaders, setConv, refreshConversations]);

  const isEmpty = messages.length === 0;
  const modeLabel = useMemo(() => (mode === "authenticated" ? "Assistant opérationnel" : mode === "public" ? "Assistant d'orientation" : "…"), [mode]);

  return { mode, modeLabel, messages, busy, isEmpty, companyLabel, conversations, conversationId, send, executeAction, stop, retry, newConversation, openConversation, deleteConversation };
}

/** Convertit une analyse de capture (structurée, honnête) en blocs affichables. */
function visionBlocks(
  a: { summary: string; visibly_proven: string[]; inference: string[]; unknown: string[]; known_issue: string | null; next_action: string | null },
  knownBug: { title: string; workaround: string | null; solution: string | null; status: string; occurrences: number } | null,
): CloneChatContentBlock[] {
  const lines: string[] = [a.summary];
  if (a.visibly_proven.length) lines.push("\nCe que je vois : " + a.visibly_proven.map((x) => `• ${x}`).join("  "));
  if (a.inference.length) lines.push("\nHypothèses : " + a.inference.map((x) => `• ${x}`).join("  "));
  if (a.unknown.length) lines.push("\nÀ vérifier : " + a.unknown.map((x) => `• ${x}`).join("  "));
  const blocks: CloneChatContentBlock[] = [{ type: "text", text: lines.join("\n") }];
  const workaround = knownBug?.workaround ?? knownBug?.solution ?? null;
  if (knownBug && workaround) blocks.push({ type: "text", text: `Problème connu (« ${knownBug.title} ») — contournement : ${workaround}` });
  else if (a.known_issue) blocks.push({ type: "text", text: `Cela ressemble à : ${a.known_issue}` });
  if (a.next_action) blocks.push({ type: "text", text: `Prochaine étape suggérée : ${a.next_action}` });
  blocks.push({ type: "boundary", provenance: "company", text: "Analyse basée uniquement sur votre capture. Rien n'a été exécuté." });
  return blocks;
}

function recentHistory(messages: CloneChatMessage[]): Array<{ role: "user" | "assistant"; text: string }> {
  return messages.slice(-6).map((m) => ({
    role: m.role === "user" ? "user" as const : "assistant" as const,
    text: m.content.map((b) => (b.type === "text" ? b.text : "")).filter(Boolean).join(" ").slice(0, 500),
  })).filter((h) => h.text);
}

function unwrap(data: unknown): unknown {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const o = data as Record<string, unknown>;
    if (Array.isArray(o.tasks)) return o.tasks;
    if (o.mission && typeof o.mission === "object" && Array.isArray((o.mission as Record<string, unknown>).tasks)) return (o.mission as Record<string, unknown>).tasks;
  }
  return data;
}

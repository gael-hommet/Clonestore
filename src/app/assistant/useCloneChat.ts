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
import type { CloneChatContext } from "@/lib/clonechat/engine";
import { validatedLinks } from "@/lib/clonechat/links/safe-links";
import { isAuthBypassEnabled } from "@/lib/auth/dev-bypass";
import { createReadinessBarrier, DEFAULT_READY_TIMEOUT_MS as READY_TIMEOUT_MS, type ReadinessBarrier } from "@/lib/clonechat/readiness-barrier";
// C1.8 FINAL PART 2 — Historique ANONYME : local au navigateur, borné, jamais serveur.
// L'historique AUTHENTIFIÉ continue de passer par le store canonique côté serveur : ce module
// ne le remplace pas, il couvre le seul cas où il n'existe aucune identité à interroger.
import {
  loadLocalConversations, createLocalConversation, appendLocalMessage,
  deleteLocalConversation, getLocalConversation, LOCAL_HISTORY_DISCLAIMER,
  type LocalStorageLike,
} from "@/lib/clonechat/conversations/local-store";
// Import DIRECT (pas via le barrel openai) : assembleFromStructured est une fonction
// pure ; passer par le barrel embarquerait client.ts/screenshot.ts (import dynamique
// du SDK OpenAI, code Node) dans le bundle NAVIGATEUR. On garde le SDK hors client.
import { assembleFromStructured } from "@/lib/clonechat/openai/governed-turn";
import type { CloneChatMessage, CloneChatProposedAction, CloneChatContentBlock } from "@/lib/clonechat";

export type CloneChatUiMode = "loading" | "public" | "authenticated";

/**
 * C1.5 — État RÉEL du rattachement entreprise, résolu par le SERVEUR (jamais fabriqué).
 *   · "unknown"  : pas encore résolu ;
 *   · "none"     : authentifié SANS entreprise active → MODE DÉCOUVERTE (chat utilisable) ;
 *   · "active"   : entreprise réelle résolue serveur.
 * Aucune fausse entreprise n'est jamais inventée à partir de l'e-mail ou d'un identifiant.
 */
export type CloneChatCompanyState = "unknown" | "none" | "active";

/**
 * C1.1 — Pièce jointe DOCUMENTAIRE (PDF/DOCX/XLSX/CSV/TXT/MD). Le client ne fait que
 * transporter : le serveur re-détecte le MIME par signature, recalcule taille et hash,
 * applique la politique fail-closed et décide seul du statut de parsing. Aucun champ
 * déclaré ici n'est digne de confiance côté serveur (par conception).
 */
export interface CloneChatDocAttachment {
  readonly filename: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  /** base64 nu (pas de data: URL) — transport en ligne borné, aucun stockage durable. */
  readonly data: string;
  /** C1.7 — chemin RELATIF dans le dossier choisi (identité du fichier). Jamais absolu. */
  readonly relativePath?: string;
}

/** Statut de pièce jointe renvoyé par le serveur (autoritaire). */
export interface CloneChatServerAttachment {
  readonly filename: string;
  readonly supportStatus: string;
  readonly format: string;
  readonly pageCount: number | null;
  readonly sheetCount: number | null;
  readonly warnings: readonly string[];
}

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

/** C1.3 — indice subtil (non bloquant) du mode découverte : authentifié SANS entreprise active. */
const DISCOVERY_MODE_HINT =
  "Mode découverte — connectez une entreprise pour que Pierre puisse agir sur vos données et vos missions.";

export function useCloneChat() {
  const [mode, setMode] = useState<CloneChatUiMode>("loading");
  const [messages, setMessages] = useState<CloneChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [companyLabel, setCompanyLabel] = useState<string | null>(null);
  const [companyState, setCompanyState] = useState<CloneChatCompanyState>("unknown");
  const [conversations, setConversations] = useState<Array<{ id: string; title: string; lastActivityAt: string }>>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const ctxRef = useRef<CloneChatContext>({ mode: "public", companyLabel: null, permissions: DEFAULT_PERMISSIONS, overview: buildOverview({ missions: [], tasks: [], validations: [], artifacts: [] }), missions: [], validations: [], employees: [], artifacts: [] });
  const tokenRef = useRef<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const mounted = useRef(true);
  const setConv = useCallback((id: string | null) => { conversationIdRef.current = id; setConversationId(id); }, []);
  const authHeaders = useCallback((): Record<string, string> => ({ "Content-Type": "application/json", ...(tokenRef.current ? { Authorization: `Bearer ${tokenRef.current}` } : {}) }), []);
  const abortRef = useRef<AbortController | null>(null);
  const lastUserRef = useRef<{ text: string; images: string[]; docs: CloneChatDocAttachment[] } | null>(null);
  // C1.3 — « mode découverte » (authentifié SANS entreprise active) : indice subtil affiché
  // UNE SEULE FOIS, jamais un blocage. Le composer reste actif et les questions publiques
  // reçoivent de vraies réponses ; le message « entreprise requise » n'apparaît que pour une
  // demande qui touche réellement aux données/actions de l'entreprise.
  const discoveryHintRef = useRef(false);

  // ── C1.5 — BARRIÈRE DE PRÊT (la correction du vrai défaut) ─────────────────
  // DÉFAUT REPRODUIT : le composer était utilisable AVANT que le mode ne soit résolu, et
  // `ctxRef` démarre en `mode: "public"`. Un utilisateur authentifié qui tapait tout de suite
  // (le cas NORMAL) voyait son message traité par le moteur DÉTERMINISTE LOCAL — la requête
  // n'atteignait JAMAIS `/api/assistant/chat` — et recevait « Réponse d'orientation — je
  // n'accède pas aux données de votre entreprise ». Ressenti : « CloneChat me bloque ».
  //
  // Correction : `send` ATTEND la résolution du mode au lieu de deviner. Le chat n'est jamais
  // désactivé — il est simplement honnête sur le fait qu'il finit de s'initialiser.
  //
  // C1.6 — LA BARRIÈRE NE DOIT JAMAIS DEVENIR UNE PORTE. Si la résolution d'identité traîne
  // (Supabase lent, throttlé, hors ligne), attendre indéfiniment REDEVIENDRAIT un blocage du
  // chat — exactement ce que C1.6 interdit. La barrière est donc BORNÉE : passé le délai, on
  // envoie quand même. C'est sans risque : le SERVEUR est l'autorité d'identité (il lit le
  // cookie de session lui-même) — au pire le tour part sur la voie PUBLIQUE, qui est une vraie
  // conversation CloneChat. Aucune donnée privée ne peut fuiter d'une identité non résolue.
  // La barrière vit dans un module PUR (`readiness-barrier.ts`) : le bornage est ainsi
  // RÉELLEMENT testable, et le code testé est exactement le code qui s'exécute.
  const barrierRef = useRef<ReadinessBarrier | null>(null);
  if (barrierRef.current === null) barrierRef.current = createReadinessBarrier(READY_TIMEOUT_MS);
  const markReady = useCallback(() => { barrierRef.current?.markReady(); }, []);
  const awaitReady = useCallback(async () => { await barrierRef.current?.awaitReady(); }, []);

  // ── Détection de mode + chargement du contexte réel ────────────────────────
  useEffect(() => {
    mounted.current = true;
    // Reprise du fil local (continuité même navigateur).
    try {
      const raw = localStorage.getItem(THREAD_KEY);
      if (raw) { const t = JSON.parse(raw); if (Array.isArray(t)) setMessages(t.slice(-40)); }
    } catch { /* ignore */ }

    // C1.8 P2 — l'historique LOCAL (anonyme) est visible dès l'ouverture. S'il s'avère ensuite
    // que l'utilisateur est authentifié, `refreshConversations()` écrasera la liste par celle du
    // SERVEUR : les deux ne se mélangent jamais.
    try {
      const st = typeof window !== "undefined" ? window.localStorage : null;
      if (st) {
        const local = loadLocalConversations(st);
        if (local.length > 0) setConversations(local.map((c) => ({ id: c.id, title: c.title, lastActivityAt: c.updatedAt })));
      }
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
          // C1.5 — On NE FABRIQUE PLUS d'entreprise à partir de l'e-mail. L'ancien
          // `email.split("@")[0]` produisait un faux libellé d'entreprise (« test-a ») et
          // faisait afficher « Données de votre entreprise (test-a) » à un utilisateur qui
          // n'en a AUCUNE. Le libellé d'entreprise ne vient QUE du serveur.
          if (u.user) authed = true;
        }
      } catch { /* public */ }

      // C1.8 — MODE TEST E2E : en l'absence de session Supabase, on peut néanmoins être
      // authentifié par le cookie d'identité signé (pont serveur). On réutilise le flag CLIENT
      // déjà existant de P16E (`NEXT_PUBLIC_E2E_BYPASS_AUTH`, inerte en production) pour que le
      // CLIENT passe en mode authentifié et emprunte les routes serveur d'historique.
      // Le bypass client seul n'accorde RIEN : le serveur exige toujours le vrai cookie signé +
      // le mode test serveur ; sinon il renvoie 401. Le serveur reste l'autorité.
      if (!authed && isAuthBypassEnabled()) authed = true;

      if (!authed) {
        // C1.6 — Visiteur ANONYME : c'est un mode de PLEIN EXERCICE de la conversation, pas un
        // mode dégradé. Aucune conversation durable (aucune identité → aucun tenant), le fil
        // vit dans le navigateur. Le composer et la route serveur sont les mêmes que pour tous.
        if (mounted.current) { setMode("public"); setCompanyState("none"); }
        ctxRef.current = { ...ctxRef.current, mode: "public", companyLabel: null };
        markReady();
        return;
      }

      // Authentifié : on fixe le mode opérationnel IMMÉDIATEMENT. Un échec de chargement
      // du contexte V1 (réseau, tenant non provisionné) ne doit JAMAIS rétrograder en
      // public : l'utilisateur reste opérationnel, simplement avec un contexte vide.
      ctxRef.current = { ...ctxRef.current, mode: "authenticated" };
      if (mounted.current) setMode("authenticated");
      // Le mode est CONNU : on libère la barrière tout de suite. Le contexte V1 et les
      // conversations peuvent finir de charger ensuite — ils ne changent pas la ROUTE prise
      // par un message, seulement sa richesse.
      markReady();

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
        // C1.5 — SIGNAL SERVEUR RÉEL du rattachement entreprise. Cette route est fail-closed :
        // sans entreprise active elle répond `{ ok: true, source: "company_required" }` — donc
        // `ld.ok` vaut VRAI dans les DEUX cas. L'ancien code faisait `ld.conversations.map(...)`
        // sur un corps sans `conversations` → TypeError silencieusement avalé. On distingue.
        const noCompany = ld?.source === "company_required" || !Array.isArray(ld?.conversations);
        if (mounted.current) setCompanyState(noCompany ? "none" : "active");
        if (noCompany) {
          // Mode découverte : aucune conversation durable (aucun tenant) — et surtout AUCUNE
          // création de fil, qui échouerait de toute façon. Le chat reste pleinement utilisable.
          if (mounted.current) setConversations([]);
          return;
        }
        const convs: Array<{ id: string; title: string; lastActivityAt: string }> = ld.conversations.map((c: { id: string; title: string; lastActivityAt: string }) => ({ id: c.id, title: c.title, lastActivityAt: c.lastActivityAt }));
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
    })().catch(() => { if (mounted.current) setMode("public"); }).finally(markReady);

    return () => { mounted.current = false; };
  }, [authHeaders, markReady, setConv]);

  // Persistance locale du fil.
  useEffect(() => {
    try { localStorage.setItem(THREAD_KEY, JSON.stringify(messages.slice(-40))); } catch { /* ignore */ }
  }, [messages]);

  // Accès au stockage local, tolérant (mode privé / stockage désactivé ⇒ null, jamais un crash).
  const localStore = useCallback((): LocalStorageLike | null => {
    try { return typeof window !== "undefined" ? window.localStorage : null; } catch { return null; }
  }, []);
  /** Anonyme = aucune identité serveur. C'est le SERVEUR qui fait foi ; ici on lit ce qu'il a dit. */
  const isAnon = useCallback(() => ctxRef.current.mode === "public" && !tokenRef.current, []);

  /** Recharge la liste locale (anonyme) dans l'état affiché. */
  const refreshLocal = useCallback(() => {
    const st = localStore();
    if (!st) return;
    const list = loadLocalConversations(st);
    if (mounted.current) {
      setConversations(list.map((c) => ({ id: c.id, title: c.title, lastActivityAt: c.updatedAt })));
    }
  }, [localStore]);

  const push = useCallback((m: CloneChatMessage) => {
    setMessages((prev) => [...prev, m]);
    // ANONYME : on écrit le message dans l'historique LOCAL (jamais serveur — aucune identité).
    if (isAnon()) {
      const st = localStore();
      if (st) {
        let id = conversationIdRef.current;
        if (!id) { id = `loc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`; setConv(id); }
        try {
          appendLocalMessage(st, id, {
            role: m.role === "user" ? "user" : "assistant",
            content: m.content as unknown[],
            at: new Date().toISOString(),
          });
          refreshLocal();
        } catch { /* un historique local ne doit JAMAIS casser une conversation */ }
      }
    }
  }, [isAnon, localStore, setConv, refreshLocal]);

  // ── Envoi d'un message (texte + captures + documents optionnels) ────────────
  const send = useCallback(async (rawText: string, images: string[] = [], docs: CloneChatDocAttachment[] = []) => {
    const t = rawText.trim();
    if ((!t && images.length === 0 && docs.length === 0) || busy) return;
    lastUserRef.current = { text: t, images, docs };
    const userBlocks: CloneChatContentBlock[] = [];
    if (t) userBlocks.push({ type: "text", text: t });
    if (images.length) userBlocks.push({ type: "text", text: `📎 ${images.length} capture${images.length > 1 ? "s" : ""} jointe${images.length > 1 ? "s" : ""}` });
    if (docs.length) userBlocks.push({ type: "text", text: `📄 ${docs.map((d) => d.filename).join(", ")}` });
    push(msg("user", userBlocks, "user"));
    setBusy(true);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      // C1.5 — On attend que le mode soit résolu (sinon le tour partait dans la mauvaise voie).
      // C1.6 — …mais l'attente est BORNÉE : une identité qui ne se résout pas ne doit jamais
      // empêcher de parler. Le serveur reste l'autorité d'identité.
      await awaitReady();
      const ctx = { ...ctxRef.current, companyLabel };

      // ── C1.8 — AUTO-CRÉATION DE CONVERSATION (utilisateur AUTHENTIFIÉ) ─────────
      // Défaut réel : la route ne persiste un message QUE si `conversation_id` est fourni. Un
      // authentifié qui tape son PREMIER message sans cliquer « Nouvelle conversation » envoyait
      // `conversation_id: null` ⇒ le message n'était JAMAIS enregistré, et son historique restait
      // vide. On crée donc la conversation à la volée, côté serveur, avant le premier message.
      // (L'anonyme, lui, persiste dans le navigateur via `push` → aucune conversation serveur.)
      if (!isAnon() && !conversationIdRef.current) {
        try {
          const cr = await fetch("/api/assistant/conversations", { method: "POST", headers: authHeaders(), credentials: "same-origin", body: JSON.stringify({}) });
          const cd = await cr.json().catch(() => null);
          if (cr.ok && cd?.ok && cd.conversation?.id) setConv(cd.conversation.id);
        } catch { /* si la création échoue, le tour se déroule quand même — simplement non persisté */ }
      }

      // ── C1.6 — IL N'Y A QU'UN SEUL CLONECHAT ──────────────────────────────────
      // L'ancien code faisait répondre les visiteurs PUBLICS par un moteur DÉTERMINISTE LOCAL
      // (`runCloneChatTurn`) : un SECOND assistant, avec une autre personnalité et une autre
      // qualité de réponse. C'était la vraie « porte » — invisible, mais bien réelle.
      // Désormais TOUS les modes — anonyme, sans entreprise, sans Pierre, avec Pierre —
      // parlent à la MÊME route serveur, avec le MÊME moteur et les mêmes sources.
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(tokenRef.current ? { Authorization: `Bearer ${tokenRef.current}` } : {}) },
        credentials: "same-origin",
        signal: ac.signal,
        body: JSON.stringify({
          message: t,
          // C1.7 §8 — on DEMANDE le streaming. Le serveur ne le sert que sur la voie publique
          // et seulement si le budget est accordé ; sinon il répond en JSON, et ce chemin
          // reste inchangé. Aucune seconde route, aucun second assistant.
          stream: true,
          history: recentHistory(messages),
          conversation_id: conversationIdRef.current,
          ...(images.length ? { images } : {}),
          ...(docs.length ? { attachments: docs.map((d) => ({ filename: d.filename, mime_type: d.mimeType, size_bytes: d.sizeBytes, transport: "inline_base64", data: d.data, relative_path: d.relativePath ?? d.filename })) } : {}),
        }),
      });
      // ── C1.7 §8 — Flux SSE : rendu incrémental des VRAIS morceaux du provider ──
      if (res.ok && (res.headers.get("content-type") ?? "").includes("text/event-stream") && res.body) {
        const streamId = mkId("assistant");
        let streamed = "";
        let finalData: Record<string, unknown> | null = null;
        let terminal: "done" | "cancelled" | "error" | null = null;

        // UN SEUL message assistant est créé, puis MIS À JOUR : jamais de doublon.
        push({ id: streamId, role: "assistant", createdAt: nowIso(), status: "streaming", provenance: "public", content: [{ type: "text", text: "" }] });
        const paint = (text: string, status: CloneChatMessage["status"]) =>
          setMessages((prev) => prev.map((m) => (m.id === streamId ? { ...m, status, content: [{ type: "text", text }] } : m)));

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const frames = buf.split("\n\n");
            buf = frames.pop() ?? "";
            for (const frame of frames) {
              const line = frame.split("\n").find((l) => l.startsWith("data: "));
              if (!line) continue;
              let ev: { type?: string; text?: string; payload?: Record<string, unknown>; message?: string; reason?: string };
              try { ev = JSON.parse(line.slice(6)); } catch { continue; }
              if (ev.type === "delta") { streamed += ev.text ?? ""; paint(streamed, "streaming"); }
              else if (ev.type === "done") { terminal = "done"; finalData = (ev.payload ?? null) as Record<string, unknown> | null; }
              else if (ev.type === "cancelled") { terminal = "cancelled"; }
              else if (ev.type === "error") { terminal = "error"; finalData = { errorMessage: ev.message }; }
            }
          }
        } catch {
          terminal = terminal ?? (ac.signal.aborted ? "cancelled" : "error");
        }

        if (terminal === "done" && finalData) {
          // La VÉRITÉ FINALE vient du serveur (citations validées + garde de claims appliquée) :
          // le texte diffusé n'est qu'un aperçu progressif, il ne fait jamais autorité.
          const st = finalData.structured as { answer?: string } | undefined;
          const blocks: CloneChatContentBlock[] = [{ type: "text", text: st?.answer ?? streamed }];
          // P17 — TRAÇABILITÉ : le payload `done` porte `citationLabels` (validées serveur) mais la
          // voie streaming les JETAIT — la provenance « D'après … » n'apparaissait que sur la voie JSON.
          // Or l'UI demande toujours le streaming, donc la source était perdue sur le chemin le plus courant.
          if (Array.isArray(finalData.citationLabels) && (finalData.citationLabels as unknown[]).length > 0) {
            blocks.push({ type: "boundary", provenance: "system", text: `D'après ${(finalData.citationLabels as string[]).slice(0, 3).join(", ")}.` });
          }
          pushCta(blocks, finalData);
          setMessages((prev) => prev.map((m) => (m.id === streamId ? { ...m, status: "complete", content: blocks } : m)));
          if (finalData.public === true && finalData.anonymous !== true && mounted.current) setCompanyState("none");
        } else if (terminal === "cancelled") {
          // Une réponse interrompue RESTE interrompue : jamais un faux « terminé ».
          setMessages((prev) => prev.map((m) => (m.id === streamId
            ? { ...m, status: "complete", content: [
                ...(streamed ? [{ type: "text" as const, text: streamed }] : []),
                { type: "boundary" as const, provenance: "system" as const, text: "Réponse interrompue — elle est incomplète." },
              ] }
            : m)));
        } else {
          const msgText = (finalData?.errorMessage as string) ?? "Je n'ai pas pu répondre à l'instant. Réessayez — votre message est conservé.";
          setMessages((prev) => prev.map((m) => (m.id === streamId
            ? { ...m, status: "complete", content: [{ type: "error", category: "runtime", message: msgText, recovery: [{ kind: "retry", label: "Réessayer", href: null }] }] }
            : m)));
        }
        return;
      }

      const data = await res.json().catch(() => null);
      // Chemin multimodal : analyse structurée honnête.
      if (res.ok && data?.source === "openai_vision" && data.analysis) {
        push(msg("assistant", visionBlocks(data.analysis, data.knownBug), "company"));
        return;
      }
      // C1.6 — Refus de PIÈCE JOINTE / accès entreprise suspendu / limitation d'abus :
      // ce sont des états CIBLÉS sur la demande. Ils n'éteignent jamais la conversation.
      const TARGETED = new Set(["attachment_requires_company", "company_access_suspended", "rate_limited"]);
      if (res.ok && typeof data?.source === "string" && TARGETED.has(data.source)) {
        const blocks: CloneChatContentBlock[] = [{ type: "text", text: (data.structured?.answer as string) ?? "" }];
        pushCta(blocks, data);
        push(msg("assistant", blocks, "public"));
        return;
      }
      if (!res.ok || !data?.structured) {
        // C1.6 — On ne SIMULE plus une réponse avec un second moteur local : on dit la vérité
        // (l'appel n'a pas abouti) et on propose de réessayer. Le chat reste utilisable.
        push(msg("assistant", [{
          type: "error", category: "runtime",
          message: "Je n'ai pas pu répondre à l'instant. Réessayez — votre message est conservé.",
          recovery: [{ kind: "retry", label: "Réessayer", href: null }],
        }], "system"));
        return;
      }
      // C1.6 — Une réponse de la voie PUBLIQUE est une VRAIE réponse CloneChat, simplement
      // fondée sur des sources publiques : aucune source tenant n'a été touchée. On l'assemble
      // donc dans un contexte public, sinon l'assembleur y ajouterait « Données de votre
      // entreprise (…) » à quelqu'un qui n'en a aucune.
      const isDiscovery = data.public === true || data.discovery === true;
      if (isDiscovery && mounted.current && data.anonymous !== true) setCompanyState("none");
      const assembleCtx = isDiscovery ? { ...ctx, mode: "public" as const, companyLabel: null } : ctx;
      const assembled = assembleFromStructured(data.structured, assembleCtx, data.usageTokens ?? 0, t);
      // P9.4.2 r2 §3 — L'exécution des actions à effet est AUTHORITATIVE CÔTÉ SERVEUR. On retire
      // les aperçus d'action dérivés client, et on n'affiche un bouton « Confirmer » QUE si le
      // serveur a persisté une PROPOSITION (référence proposalId). Le client ne détient jamais
      // le payload canonique : la confirmation appellera /api/assistant/execute avec la référence.
      const blocks: CloneChatContentBlock[] = assembled.blocks.filter((b) => !(b.type === "action_preview" && b.action.requiresConfirmation));
      const prop = data.proposal as { id?: string; kind?: CloneChatProposedAction["kind"]; label?: string; autonomy?: { productModeId: string; label: string; tagline: string; engineMode: string } } | null | undefined;
      if (prop?.id && prop.kind) {
        blocks.push({ type: "action_preview", action: {
          id: `srv-${prop.id}`, kind: prop.kind, label: prop.label ?? "Confirmer", risk: prop.kind === "cancel_mission" ? "irreversible" : "sensitive",
          requiresConfirmation: true, allowed: true, reason: null, payload: {}, href: null, proposalId: prop.id,
        } });
        // P9.5 — reflète le niveau d'autonomie (résolu serveur) sous lequel Pierre opérera la mission.
        if (prop.autonomy) blocks.push({ type: "boundary", provenance: "company", text: `Pierre opérera cette mission en mode « ${prop.autonomy.label} » — ${prop.autonomy.tagline}` });
      }
      // C1.1 — Statut HONNÊTE des pièces jointes (autoritaire serveur) + limites connues.
      // P17 — la voie PUBLIQUE émettait les pièces jointes avec la clé `name` (au lieu de `filename`)
      // et sans `supportStatus` pour les fichiers refusés ⇒ le client rendait « undefined — undefined ».
      // On lit les DEUX clés et describeSupport ne rend jamais « undefined » (défense en profondeur ;
      // le serveur émet aussi désormais `filename`/`supportStatus` — voir chat/route.ts).
      const serverAttachments = Array.isArray(data.attachments) ? (data.attachments as Array<{ filename?: string; name?: string; supportStatus?: string }>) : [];
      if (serverAttachments.length > 0) {
        blocks.push({ type: "boundary", provenance: "system", text: serverAttachments.map((a) => `${a.filename ?? a.name ?? "Fichier"} — ${describeSupport(a.supportStatus)}`).join(" · ") });
      }
      if (Array.isArray(data.knownLimitations) && data.knownLimitations.length > 0) {
        blocks.push({ type: "boundary", provenance: "system", text: (data.knownLimitations as string[]).slice(0, 2).join(" ") });
      }
      // Citations discrètes (« D'après … ») — jamais de chemin de fichier / table au client.
      if (Array.isArray(data.citationLabels) && data.citationLabels.length > 0) blocks.push({ type: "boundary", provenance: "system", text: `D'après ${data.citationLabels.slice(0, 3).join(", ")}.` });
      // C1.6 §6 — Le PRÉREQUIS s'attache à la DEMANDE : CloneChat répond d'abord, puis dit
      // ce qui manque pour aller plus loin. Jamais un blocage, jamais une bannière permanente.
      pushCta(blocks, data);

      // ── C1.8 BLOC A — AUCUNE SOURCE NE PEUT PRODUIRE UNE RÉPONSE INVISIBLE ──
      //
      // L'interface connaissait chaque source une par une. C'est précisément ainsi qu'un champ
      // finit renvoyé par le serveur et jamais affiché (`analysis` l'a été). La route fournit
      // désormais une forme CANONIQUE (`rendered`) : si, pour une raison quelconque, aucun bloc
      // de texte n'a été produit ci-dessus, on affiche la réponse canonique plutôt que RIEN.
      // Un tour muet est un faux succès — et un faux succès est pire qu'une erreur.
      const rendered = (data.rendered ?? null) as { answer?: string; retryable_error?: string | null; limitation?: string | null } | null;
      const hasVisibleText = blocks.some((b) => b.type === "text" && b.text.trim().length > 0);
      if (!hasVisibleText && rendered?.answer) {
        blocks.unshift({ type: "text", text: rendered.answer });
      }
      // Une limite honnête s'affiche À CÔTÉ de la réponse — jamais à sa place.
      if (rendered?.limitation && !blocks.some((b) => b.type === "boundary" && b.text === rendered.limitation)) {
        blocks.push({ type: "boundary", provenance: "system", text: rendered.limitation });
      }
      if (blocks.length === 0) {
        blocks.push({
          type: "error", category: "runtime",
          message: "Je n'ai pas réussi à produire une réponse complète. Réessayez.",
          recovery: [{ kind: "retry", label: "Réessayer", href: null }],
        });
      }

      push(msg("assistant", blocks, isDiscovery ? "public" : "company"));

      // C1.8 — L'authentifié voit sa conversation apparaître/monter dans l'historique dès qu'elle
      // a reçu son premier échange (elle vient d'être créée + persistée côté serveur).
      if (!isAnon()) { void refreshConversations(); }
    } catch (e) {
      if ((e as { name?: string }).name === "AbortError") {
        push(msg("assistant", [{ type: "text", text: "Réponse interrompue." }], "system"));
        return;
      }
      push(msg("assistant", [{
        type: "error", category: "runtime",
        message: "Je n'ai pas pu répondre à l'instant. Réessayez — votre message est conservé.",
        recovery: [{ kind: "retry", label: "Réessayer", href: null }],
      }], "system"));
    } finally {
      abortRef.current = null;
      if (mounted.current) setBusy(false);
    }
  }, [busy, companyLabel, messages, push, awaitReady]);

  // Interrompre la réponse en cours.
  /**
   * C1.7 §4 — TRANSPORT CANONIQUE UNIQUE. Le manifeste (fichiers, images, DOSSIER, glisser-déposer,
   * collage) est converti ici en charge utile réelle, puis part par le MÊME `send()` que le texte.
   * Les chemins RELATIFS du dossier sont préservés ; aucun chemin absolu du disque n'est transmis.
   */
  const sendWithFiles = useCallback(async (
    text: string,
    files: ReadonlyArray<{ entry: { category: string; displayName: string; relativePath: string; mime: string }; file: File }>,
  ) => {
    const images: string[] = [];
    const docs: CloneChatDocAttachment[] = [];
    for (const { entry, file } of files) {
      const dataUrl = await new Promise<string | null>((res) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result));
        r.onerror = () => res(null);
        r.readAsDataURL(file);
      });
      if (!dataUrl) continue;
      if (entry.category === "image") {
        images.push(dataUrl); // le serveur assainit (EXIF retiré) — le client ne fait que transporter
        continue;
      }
      const comma = dataUrl.indexOf(",");
      const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : "";
      if (!b64) continue;
      docs.push({ filename: entry.displayName, mimeType: entry.mime || file.type, sizeBytes: file.size, data: b64, relativePath: entry.relativePath });
    }
    await send(text, images, docs);
  }, [send]);

  /**
   * C1.7 §13 — ÉDITION + RENVOI D'UN MESSAGE UTILISATEUR (sûr par construction).
   *
   * Le danger n'est pas l'édition : c'est la RÉUTILISATION. Une réponse déjà générée peut porter
   * une proposition d'action (proposalId) approuvée. Réécrire la question SANS invalider ce qui
   * suit permettrait de faire exécuter une action approuvée pour une AUTRE demande.
   *
   * Règles appliquées ici :
   *   · toute génération en cours est ANNULÉE d'abord ;
   *   · le message édité et TOUT ce qui le suit sont retirés du fil — donc aucune proposition,
   *     aucune approbation, aucune empreinte d'action antérieure ne survit ;
   *   · rien n'est renvoyé automatiquement : l'utilisateur doit envoyer explicitement ;
   *   · le renvoi passe par le MÊME `send()` → aucun appel provider dupliqué, aucun message double.
   */
  const beginEdit = useCallback((messageId: string): { text: string } | null => {
    const idx = messages.findIndex((m) => m.id === messageId);
    if (idx < 0 || messages[idx].role !== "user") return null;

    abortRef.current?.abort(); // une génération en cours ne doit jamais survivre à une édition

    const text = messages[idx].content
      .map((b) => (b.type === "text" ? b.text : ""))
      .filter(Boolean)
      .join(" ")
      .replace(/^📄 .*/gm, "")
      .trim();

    // Le message ET toute la suite disparaissent : les propositions/approbations qui en
    // dépendaient disparaissent avec eux. Aucune autorisation ne peut être « recyclée ».
    setMessages((prev) => prev.slice(0, idx));
    lastUserRef.current = null;
    return { text };
  }, [messages]);

  const stop = useCallback(() => { abortRef.current?.abort(); }, []);
  // Réémettre le dernier message utilisateur.
  const retry = useCallback(() => {
    if (busy) return;
    const last = lastUserRef.current;
    if (last) { void send(last.text, last.images, last.docs); return; }
    // P17 — après un RECHARGEMENT, `lastUserRef` est null (jamais reconstruit depuis l'hydratation)
    // alors que le bouton « Réessayer » du footer reste visible (`!isEmpty && !busy`) : cliquer était
    // un no-op silencieux. On reconstitue le DERNIER tour utilisateur depuis le fil hydraté (texte seul —
    // les pièces jointes base64 ne survivent pas au rechargement, seul leur résumé « 📄 … » est stocké).
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role !== "user") continue;
      const text = messages[i].content
        .map((b) => (b.type === "text" ? b.text : ""))
        .filter(Boolean).join(" ")
        .replace(/^📎.*$/gm, "").replace(/^📄.*$/gm, "").trim();
      if (text) void send(text, [], []);
      return;
    }
  }, [busy, send, messages]);

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
    // ANONYME : aucun serveur à interroger — il n'y a pas d'identité. On lit le navigateur.
    if (isAnon()) { refreshLocal(); return; }
    try {
      const res = await fetch("/api/assistant/conversations", { headers: authHeaders(), credentials: "same-origin" });
      const d = await res.json().catch(() => null);
      if (res.ok && d?.ok && mounted.current) setConversations(d.conversations.map((c: { id: string; title: string; lastActivityAt: string }) => ({ id: c.id, title: c.title, lastActivityAt: c.lastActivityAt })));
    } catch { /* ignore */ }
  }, [authHeaders, isAnon, refreshLocal]);

  const openConversation = useCallback(async (id: string) => {
    setConv(id);
    if (isAnon()) {
      const st = localStore();
      const conv = st ? getLocalConversation(st, id) : null;
      if (conv && mounted.current) {
        setMessages(conv.messages.map((m) => msg(m.role, (m.content ?? []) as CloneChatContentBlock[], m.role === "user" ? "user" : "company")));
      }
      return;
    }
    try {
      const res = await fetch(`/api/assistant/conversations/${id}`, { headers: authHeaders(), credentials: "same-origin" });
      const d = await res.json().catch(() => null);
      if (res.ok && d?.ok && mounted.current) setMessages((d.messages ?? []).map((m: { role: CloneChatMessage["role"]; content: unknown[] }) => msg(m.role, (m.content ?? []) as CloneChatContentBlock[], m.role === "user" ? "user" : "company")));
    } catch { /* ignore */ }
  }, [authHeaders, setConv, isAnon, localStore]);

  const newConversation = useCallback(async () => {
    if (isAnon()) {
      // Une conversation VIDE n'est pas une conversation : on ne l'écrit pas dans l'historique.
      // On ouvre un fil neuf, et il n'apparaîtra dans la liste qu'au PREMIER message réel
      // (`push` → `appendLocalMessage` le crée à ce moment-là). Sinon la liste se remplirait
      // de « Nouvelle conversation » sans contenu.
      const id = `loc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      setConv(id);
      if (mounted.current) setMessages([]);
      refreshLocal();
      return;
    }
    try {
      const res = await fetch("/api/assistant/conversations", { method: "POST", headers: authHeaders(), credentials: "same-origin", body: JSON.stringify({}) });
      const d = await res.json().catch(() => null);
      if (res.ok && d?.ok) { setConv(d.conversation.id); if (mounted.current) setMessages([]); await refreshConversations(); }
    } catch { /* ignore */ }
  }, [authHeaders, setConv, refreshConversations]);

  const deleteConversation = useCallback(async (id: string) => {
    if (isAnon()) {
      const st = localStore();
      if (st) deleteLocalConversation(st, id);
    } else {
      try { await fetch(`/api/assistant/conversations/${id}`, { method: "DELETE", headers: authHeaders(), credentials: "same-origin" }); } catch { /* ignore */ }
    }
    if (conversationIdRef.current === id) { setConv(null); if (mounted.current) setMessages([]); }
    await refreshConversations();
  }, [authHeaders, setConv, refreshConversations, isAnon, localStore]);

  const isEmpty = messages.length === 0;
  // C1.5 — Le libellé dit la VÉRITÉ : authentifié SANS entreprise ⇒ « Mode découverte »,
  // jamais « connecté à votre entreprise ».
  // C1.6 §7 — Statut NEUTRE : ni « orientation », ni « découverte », ni aucun mot qui
  // suggère un CloneChat au rabais. Il n'y a qu'un CloneChat. Le statut dit seulement si le
  // contexte privé de l'entreprise est branché — il ne qualifie jamais la conversation.
  const modeLabel = useMemo(() => {
    if (mode === "loading") return "…";
    return companyState === "active" ? "Assistant opérationnel" : "Conversation générale";
  }, [mode, companyState]);

  /** Conserve pour compat interne : plus AUCUNE bannière permanente n'en dépend (§6). */
  const discoveryMode = mode === "authenticated" && companyState === "none";

  return { mode, modeLabel, messages, busy, isEmpty, companyLabel, companyState, discoveryMode, discoveryHint: DISCOVERY_MODE_HINT, conversations, conversationId, send, sendWithFiles, beginEdit, executeAction, stop, retry, newConversation, openConversation, deleteConversation };
}

/**
 * C1.6 §6 — Ajoute le PRÉREQUIS CONTEXTUEL à une réponse, sous forme de note + CTA cliquable.
 * Il complète la réponse ; il ne la remplace pas. Il n'est jamais affiché quand rien ne manque,
 * et jamais transformé en bannière permanente : il appartient au TOUR de conversation.
 */
function pushCta(blocks: CloneChatContentBlock[], data: Record<string, unknown>): void {
  const message = typeof data.prerequisiteMessage === "string" ? data.prerequisiteMessage : null;
  const cta = data.cta as { route?: string; label?: string } | null | undefined;
  if (message) blocks.push({ type: "boundary", provenance: "system", text: message });

  // ── C1.8 P2 §7 — LES LIENS STRUCTURÉS ARRIVENT ENFIN JUSQU'AU CLIENT ──
  //
  // La route renvoyait déjà `suggestedCTA` ET `relevantLinks`. Seul le premier était consommé :
  // les liens utiles étaient calculés côté serveur puis **jetés** côté navigateur. On les rend,
  // mais UNIQUEMENT après validation par le REGISTRE de routes : une route inventée, un
  // `javascript:` ou un domaine non autorisé ne deviennent jamais une carte cliquable.
  const seen = new Set<string>();
  const emit = (href: string, label: string) => {
    if (seen.has(href)) return;                      // pas de doublon
    seen.add(href);
    blocks.push({
      type: "action_preview",
      action: {
        id: `cta-${href}`, kind: "navigate", label, risk: "low",
        requiresConfirmation: false, allowed: true, reason: null, payload: {}, href, proposalId: null,
      },
    });
  };

  // Priorité : la CTA la plus utile d'abord, puis quelques alternatives — jamais un mur de boutons.
  for (const l of validatedLinks(cta ? [cta] : [])) emit(l.href, l.label);
  const relevant = validatedLinks(data.relevantLinks as Array<{ route?: string; label?: string }> | undefined);
  for (const l of relevant.slice(0, 3)) emit(l.href, l.label);
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

/** Traduit le statut de support serveur en langage clair — jamais de jargon de parseur. */
function describeSupport(status: string | undefined): string {
  switch (status) {
    case "fully_parsed": return "lu intégralement";
    case "text_extracted": return "texte extrait";
    case "structured_partial": return "valeurs lues (aucune formule exécutée)";
    case "image_only": return "contenu visuel (aucun texte lu)";
    case "metadata_only": return "métadonnées seulement";
    case "unsupported": return "format non pris en charge";
    case "parse_failed": return "lecture impossible";
    case "manual_review_required": return "mis en quarantaine (revue manuelle)";
    // P17 — JAMAIS « undefined » : un statut absent ou inconnu (ex. voie publique qui omet
    // `supportStatus` sur un fichier refusé) se dit simplement « reçu » — le fichier est bien là.
    default: return status && status.trim().length > 0 ? status : "reçu";
  }
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

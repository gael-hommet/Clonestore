"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabaseBrowser } from "@/lib/supabase";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Loader2,
  MessageSquare,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";

type MsgRole = "user" | "assistant";

type Msg = {
  id: string;
  role: MsgRole;
  content: string;
  ts: number;
  links?: UsefulLink[];
};

type Thread = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Msg[];
};

type AssistantAccountContext = {
  isAuthenticated: boolean;
  hasPierreAccess: boolean;
  onboardingCompleted: boolean;
  companyName: string;
  contactFirstName: string;
  contactJobTitle: string;
  usualTone: string;
  preferredLanguage: string;
  senderMode: string;
  senderStatus: string;
  domainStatus: string;
  senderEmailRequested: string;
  senderEmailEffective: string;
  replyToEmail: string;
};

type AssistantLinkCard = {
  label: string;
  href: string;
  description: string;
};

type BootstrapResponse = {
  ok: boolean;
  context: AssistantAccountContext;
  welcome: string;
  linkCards: AssistantLinkCard[];
  warning?: string;
};

type ChatResponse = {
  answer?: string;
  error?: string;
  detail?: string;
};

type UsefulLink = {
  label: string;
  href: string;
  description: string;
};

type UsefulLinkRule = UsefulLink & {
  keywords: string[];
  when?: (context: AssistantAccountContext | null) => boolean;
};

type UiPrefs = {
  sidebarOpen: boolean;
};

const THREADS_KEY = "clonestore:assistant:threads:v2";
const ACTIVE_THREAD_KEY = "clonestore:assistant:active-thread:v2";
const PREFS_KEY = "clonestore:assistant:prefs:v2";
const DRAFT_KEY = "clonestore:assistant:draft:v2";
const MAX_LOCAL_THREADS = 60;
const MAX_LOCAL_MESSAGES = 120;

function uid() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function clip(text: string, max: number) {
  const clean = (text || "").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1)}…`;
}

function formatTime(ts: number) {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function formatDate(ts: number) {
  try {
    return new Date(ts).toLocaleDateString([], {
      day: "2-digit",
      month: "2-digit",
    });
  } catch {
    return "";
  }
}

function safeJsonParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function normalizeMessages(raw: unknown): Msg[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .filter(Boolean)
    .map((item) => item as Partial<Msg>)
    .filter(
      (item) =>
        typeof item.content === "string" &&
        (item.role === "user" || item.role === "assistant")
    )
    .map((item) => ({
      id: typeof item.id === "string" ? item.id : uid(),
      role: item.role as MsgRole,
      content: item.content as string,
      ts: typeof item.ts === "number" ? item.ts : Date.now(),
      links: Array.isArray(item.links)
        ? item.links
            .filter(Boolean)
            .map((link) => link as UsefulLink)
            .filter(
              (link) =>
                typeof link.label === "string" &&
                typeof link.href === "string" &&
                typeof link.description === "string"
            )
        : undefined,
    }))
    .slice(-MAX_LOCAL_MESSAGES);
}

function normalizeThreads(raw: unknown): Thread[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .filter(Boolean)
    .map((item) => item as Partial<Thread>)
    .filter((item) => Array.isArray(item.messages))
    .map((item) => ({
      id: typeof item.id === "string" ? item.id : uid(),
      title:
        typeof item.title === "string" && item.title.trim()
          ? item.title
          : "Nouvelle conversation",
      createdAt: typeof item.createdAt === "number" ? item.createdAt : Date.now(),
      updatedAt: typeof item.updatedAt === "number" ? item.updatedAt : Date.now(),
      messages: normalizeMessages(item.messages),
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_LOCAL_THREADS);
}

function buildWelcomeText(payload?: BootstrapResponse | null) {
  if (payload?.welcome?.trim()) return payload.welcome.trim();
  return "Salut. Je suis l’assistant CloneStore. Pose-moi ta question simplement et je te réponds de façon claire, directe et utile.";
}

function buildWelcomeMessage(payload?: BootstrapResponse | null): Msg {
  return {
    id: uid(),
    role: "assistant",
    content: buildWelcomeText(payload),
    ts: Date.now(),
    links: payload?.linkCards?.slice(0, 3) || [],
  };
}

function buildInitialThread(payload?: BootstrapResponse | null): Thread {
  const now = Date.now();
  return {
    id: uid(),
    title: "Nouvelle conversation",
    createdAt: now,
    updatedAt: now,
    messages: [buildWelcomeMessage(payload)],
  };
}

function buildThreadTitle(messages: Msg[], context: AssistantAccountContext | null) {
  const firstUser = messages.find((msg) => msg.role === "user")?.content?.trim();
  if (firstUser) return clip(firstUser, 52);
  if (context?.companyName) return `CloneStore — ${context.companyName}`;
  return "Nouvelle conversation";
}

function threadPreview(thread: Thread) {
  const last = [...thread.messages]
    .reverse()
    .find((msg) => msg.role === "user" || msg.role === "assistant");
  if (!last) return "Aucun message";
  return clip(last.content, 70);
}

function makeUserMessage(content: string): Msg {
  return {
    id: uid(),
    role: "user",
    content: content.trim(),
    ts: Date.now(),
  };
}

function normalizeContentForSearch(text: string) {
  return (text || "").toLowerCase();
}

function mergeLinks(...groups: UsefulLink[][]) {
  const map = new Map<string, UsefulLink>();
  for (const group of groups) {
    for (const link of group) {
      const key = `${link.label}__${link.href}`;
      if (!map.has(key)) map.set(key, link);
    }
  }
  return Array.from(map.values()).slice(0, 4);
}

function buildBootstrapLinks(payload: BootstrapResponse | null | undefined): UsefulLink[] {
  if (!payload?.linkCards?.length) return [];
  return payload.linkCards.map((link) => ({
    label: link.label,
    href: link.href,
    description: link.description,
  }));
}

const LINK_RULES: UsefulLinkRule[] = [
  {
    label: "Utiliser Pierre",
    href: "/agents/pierre/use",
    description: "Rédiger, modifier, envoyer un email ou générer un PDF.",
    keywords: ["utiliser pierre", "page use", "rédiger", "email", "pdf", "modifier"],
    when: (context) => Boolean(context?.hasPierreAccess),
  },
  {
    label: "Formulaire 1",
    href: "/agents/pierre/setup",
    description: "Configurer l’entreprise, la signature, les règles et l’identité email.",
    keywords: ["formulaire 1", "onboarding", "setup", "configuration", "configurer"],
    when: (context) => Boolean(context?.hasPierreAccess),
  },
  {
    label: "Guide Pierre",
    href: "/agents/pierre/onboarding",
    description: "Voir le parcours simple pour bien démarrer avec Pierre.",
    keywords: ["comment marche pierre", "démarrer", "guide", "commencer", "onboarding"],
  },
  {
    label: "Fiche Pierre",
    href: "/agents/pierre",
    description: "Voir clairement ce que Pierre fait, son autonomie et ses limites.",
    keywords: ["pierre", "clone rh", "que fait pierre", "agent pierre"],
  },
  {
    label: "Paiement Pierre",
    href: "/paiement?agent=pierre",
    description: "Activer Pierre et accéder à l’espace d’utilisation.",
    keywords: ["payer", "paiement", "activer pierre", "acheter pierre", "embaucher pierre"],
    when: (context) => !context?.hasPierreAccess,
  },
  {
    label: "Mes clones",
    href: "/profile/agents",
    description: "Retrouver les accès et l’état de tes clones actifs.",
    keywords: ["mon compte", "mes clones", "accès", "compte"],
    when: (context) => Boolean(context?.isAuthenticated),
  },
  {
    label: "Boutique CloneStore",
    href: "/agents",
    description: "Voir les agents disponibles et leur statut réel.",
    keywords: ["clara", "emma", "alex", "noah", "clone", "agent", "boutique"],
  },
  {
    label: "Support / questions",
    href: "/questions",
    description: "Passer par la page de support si tu veux aller plus loin.",
    keywords: ["support", "aide", "question", "bug", "problème"],
  },
  {
    label: "Connexion",
    href: "/login",
    description: "Te connecter pour récupérer ton accès, ton onboarding et tes réglages.",
    keywords: ["connexion", "login", "connecter", "session manquante"],
    when: (context) => !context?.isAuthenticated,
  },
];

function inferUsefulLinks(
  question: string,
  answer: string,
  context: AssistantAccountContext | null,
  bootstrapLinks: UsefulLink[]
) {
  const haystack = normalizeContentForSearch(`${question}\n${answer}`);

  const matched = LINK_RULES.filter((rule) => {
    if (rule.when && !rule.when(context)) return false;
    return rule.keywords.some((keyword) => haystack.includes(keyword));
  }).map(({ label, href, description }) => ({ label, href, description }));

  const contextual: UsefulLink[] = [];

  if (context?.hasPierreAccess && !context.onboardingCompleted) {
    contextual.push({
      label: "Terminer le formulaire 1",
      href: "/agents/pierre/setup",
      description: "Compléter la base mémoire de Pierre pour le rendre cohérent tout de suite.",
    });
  }

  if (context?.hasPierreAccess && context.onboardingCompleted) {
    contextual.push({
      label: "Ouvrir Pierre",
      href: "/agents/pierre/use",
      description: "Passer directement à la rédaction et aux actions.",
    });
  }

  return mergeLinks(matched, contextual, bootstrapLinks);
}

async function readAccessToken() {
  const supabase = supabaseBrowser();
  if (!supabase) return "";
  const sessionRes = await supabase.auth.getSession();
  return sessionRes.data.session?.access_token ?? "";
}

function MessageLinks({ links }: { links?: UsefulLink[] }) {
  if (!links?.length) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {links.map((link) => (
        <Link
          key={`${link.label}_${link.href}`}
          href={link.href}
          className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs text-violet-700 transition hover:bg-violet-100"
        >
          <span>{link.label}</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      ))}
    </div>
  );
}

export default function AssistantPage() {
  const [context, setContext] = useState<AssistantAccountContext | null>(null);
  const [bootstrapLinks, setBootstrapLinks] = useState<UsefulLink[]>([]);
  const [bootstrapWarning, setBootstrapWarning] = useState<string | null>(null);
  const [bootstrapLoading, setBootstrapLoading] = useState(true);

  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [renamingThreadId, setRenamingThreadId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [prefs, setPrefs] = useState<UiPrefs>({ sidebarOpen: true });

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId) || null,
    [activeThreadId, threads]
  );

  const visibleThreads = useMemo(() => {
    const q = normalizeContentForSearch(search);
    if (!q) return threads;
    return threads.filter((thread) => {
      const haystack = normalizeContentForSearch(
        `${thread.title}\n${thread.messages.map((msg) => msg.content).join("\n")}`
      );
      return haystack.includes(q);
    });
  }, [search, threads]);

  const persistThreads = useCallback((nextThreads: Thread[]) => {
    setThreads(nextThreads);
    try {
      localStorage.setItem(THREADS_KEY, JSON.stringify(nextThreads));
    } catch {
      // ignore
    }
  }, []);

  const persistActiveThreadId = useCallback((threadId: string | null) => {
    setActiveThreadId(threadId);
    try {
      if (threadId) localStorage.setItem(ACTIVE_THREAD_KEY, threadId);
      else localStorage.removeItem(ACTIVE_THREAD_KEY);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      const storedPrefs = safeJsonParse<UiPrefs>(localStorage.getItem(PREFS_KEY), {
        sidebarOpen: true,
      });
      setPrefs(storedPrefs);
      setDraft(localStorage.getItem(DRAFT_KEY) || "");
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      // ignore
    }
  }, [prefs]);

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, draft);
    } catch {
      // ignore
    }
  }, [draft]);

  const createThread = useCallback(
    (payload?: BootstrapResponse | null) => {
      const thread = buildInitialThread(payload);
      persistThreads([thread, ...threads].slice(0, MAX_LOCAL_THREADS));
      persistActiveThreadId(thread.id);
      setServerError(null);
      setDraft("");
      setRenamingThreadId(null);
      return thread;
    },
    [persistActiveThreadId, persistThreads, threads]
  );

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      setBootstrapLoading(true);
      let payload: BootstrapResponse | null = null;

      try {
        const token = await readAccessToken();
        const res = await fetch("/api/assistant", {
          method: "GET",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          cache: "no-store",
        });

        if (res.ok) {
          payload = (await res.json()) as BootstrapResponse;
        }
      } catch {
        payload = null;
      }

      if (!mounted) return;

      setContext(payload?.context || null);
      setBootstrapLinks(buildBootstrapLinks(payload));
      setBootstrapWarning(payload?.warning || null);

      const storedThreads = normalizeThreads(
        safeJsonParse<unknown[]>(localStorage.getItem(THREADS_KEY), [])
      );
      const storedActiveId = localStorage.getItem(ACTIVE_THREAD_KEY);

      if (storedThreads.length) {
        setThreads(storedThreads);
        const stillExists = storedThreads.some((thread) => thread.id === storedActiveId);
        const nextActiveId = stillExists ? storedActiveId : storedThreads[0].id;
        persistActiveThreadId(nextActiveId);
      } else {
        const thread = buildInitialThread(payload);
        setThreads([thread]);
        persistActiveThreadId(thread.id);
        try {
          localStorage.setItem(THREADS_KEY, JSON.stringify([thread]));
        } catch {
          // ignore
        }
      }

      setBootstrapLoading(false);
    }

    bootstrap();

    return () => {
      mounted = false;
    };
  }, [persistActiveThreadId]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [activeThread?.messages, loading]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [draft]);

  const updateThread = useCallback(
    (threadId: string, updater: (thread: Thread) => Thread) => {
      const next = threads.map((thread) => (thread.id === threadId ? updater(thread) : thread));
      const sorted = [...next].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_LOCAL_THREADS);
      persistThreads(sorted);
    },
    [persistThreads, threads]
  );

  const renameThread = useCallback(() => {
    if (!renamingThreadId) return;
    const clean = renameValue.trim();
    if (!clean) {
      setRenamingThreadId(null);
      setRenameValue("");
      return;
    }

    updateThread(renamingThreadId, (thread) => ({
      ...thread,
      title: clip(clean, 60),
      updatedAt: Date.now(),
    }));

    setRenamingThreadId(null);
    setRenameValue("");
  }, [renameValue, renamingThreadId, updateThread]);

  const deleteThread = useCallback(
    (threadId: string) => {
      const remaining = threads.filter((thread) => thread.id !== threadId);
      if (!remaining.length) {
        const fresh = buildInitialThread({
          ok: true,
          context:
            context || {
              isAuthenticated: false,
              hasPierreAccess: false,
              onboardingCompleted: false,
              companyName: "",
              contactFirstName: "",
              contactJobTitle: "",
              usualTone: "",
              preferredLanguage: "",
              senderMode: "",
              senderStatus: "",
              domainStatus: "",
              senderEmailRequested: "",
              senderEmailEffective: "",
              replyToEmail: "",
            },
          welcome: buildWelcomeText(),
          linkCards: bootstrapLinks,
        });
        persistThreads([fresh]);
        persistActiveThreadId(fresh.id);
        return;
      }

      persistThreads(remaining);
      if (activeThreadId === threadId) {
        persistActiveThreadId(remaining[0].id);
      }
    },
    [activeThreadId, bootstrapLinks, context, persistActiveThreadId, persistThreads, threads]
  );

  const startNewChat = useCallback(() => {
    createThread({
      ok: true,
      context:
        context || {
          isAuthenticated: false,
          hasPierreAccess: false,
          onboardingCompleted: false,
          companyName: "",
          contactFirstName: "",
          contactJobTitle: "",
          usualTone: "",
          preferredLanguage: "",
          senderMode: "",
          senderStatus: "",
          domainStatus: "",
          senderEmailRequested: "",
          senderEmailEffective: "",
          replyToEmail: "",
        },
      welcome: buildWelcomeText(),
      linkCards: bootstrapLinks,
    });
  }, [bootstrapLinks, context, createThread]);

  const copyMessage = useCallback(async (msg: Msg) => {
    try {
      await navigator.clipboard.writeText(msg.content);
      setCopiedMessageId(msg.id);
      setTimeout(() => setCopiedMessageId(null), 1200);
    } catch {
      // ignore
    }
  }, []);

  const send = useCallback(async () => {
    const content = draft.trim();
    if (!content || loading) return;

    let thread = activeThread;
    if (!thread) {
      thread = startNewChat();
    }
    if (!thread) return;

    const userMsg = makeUserMessage(content);
    const optimisticMessages = [...thread.messages, userMsg].slice(-MAX_LOCAL_MESSAGES);
    const optimisticTitle = buildThreadTitle(optimisticMessages, context);

    updateThread(thread.id, (current) => ({
      ...current,
      title: optimisticTitle,
      updatedAt: Date.now(),
      messages: optimisticMessages,
    }));

    persistActiveThreadId(thread.id);
    setDraft("");
    setLoading(true);
    setServerError(null);

    try {
      const token = await readAccessToken();
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          messages: optimisticMessages.map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
        }),
      });

      const payload = (await res.json().catch(() => ({}))) as ChatResponse;

      if (!res.ok) {
        const errText = payload.error || "Erreur serveur. Réessaie.";
        const assistantError: Msg = {
          id: uid(),
          role: "assistant",
          content: "Je n’ai pas réussi à répondre correctement cette fois. Réessaie juste après.",
          ts: Date.now(),
          links: bootstrapLinks.slice(0, 2),
        };

        updateThread(thread.id, (current) => ({
          ...current,
          updatedAt: Date.now(),
          messages: [...optimisticMessages, assistantError].slice(-MAX_LOCAL_MESSAGES),
        }));

        setServerError(payload.detail ? `${errText}\n\n${payload.detail}` : errText);
        setLoading(false);
        return;
      }

      const answer = (payload.answer || "").trim() || "Je n’ai rien reçu de concret du serveur.";
      const links = inferUsefulLinks(content, answer, context, bootstrapLinks);

      const assistantMsg: Msg = {
        id: uid(),
        role: "assistant",
        content: answer,
        ts: Date.now(),
        links,
      };

      const finalMessages = [...optimisticMessages, assistantMsg].slice(-MAX_LOCAL_MESSAGES);
      const finalTitle = buildThreadTitle(finalMessages, context);

      updateThread(thread.id, (current) => ({
        ...current,
        title: finalTitle,
        updatedAt: Date.now(),
        messages: finalMessages,
      }));
    } catch {
      const assistantError: Msg = {
        id: uid(),
        role: "assistant",
        content: "Erreur réseau. Réessaie dans un instant.",
        ts: Date.now(),
        links: bootstrapLinks.slice(0, 2),
      };

      updateThread(thread.id, (current) => ({
        ...current,
        updatedAt: Date.now(),
        messages: [...optimisticMessages, assistantError].slice(-MAX_LOCAL_MESSAGES),
      }));

      setServerError("Erreur réseau.");
    } finally {
      setLoading(false);
    }
  }, [
    activeThread,
    bootstrapLinks,
    context,
    draft,
    loading,
    persistActiveThreadId,
    startNewChat,
    updateThread,
  ]);

  const memoryText = useMemo(() => {
    if (context?.companyName) {
      return `Mémoire locale active. Tes conversations sont conservées dans ce navigateur pour ${context.companyName}.`;
    }
    return "Mémoire locale active. Tes conversations sont conservées dans ce navigateur pour que tu puisses les rouvrir plus tard.";
  }, [context]);

  return (
    <main className="h-screen w-screen overflow-hidden bg-background text-foreground">
      <div className="flex h-full w-full">
        <aside
          className={[
            "border-r bg-background/95 transition-all duration-200",
            prefs.sidebarOpen ? "w-[320px]" : "w-[78px]",
          ].join(" ")}
        >
          <div className="flex h-full flex-col">
            <div className="border-b p-3">
              <div className="flex items-center justify-between gap-2">
                {prefs.sidebarOpen ? (
                  <div>
                    <p className="text-sm font-semibold tracking-tight">Assistant CloneStore</p>
                    <p className="text-xs text-muted-foreground">Conversations récentes</p>
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={() => setPrefs((prev) => ({ ...prev, sidebarOpen: !prev.sidebarOpen }))}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border bg-background text-muted-foreground transition hover:text-foreground"
                  aria-label="Toggle sidebar"
                >
                  {prefs.sidebarOpen ? (
                    <ChevronLeft className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
              </div>

              <div className="mt-3">
                <Button className="w-full gap-2" onClick={startNewChat}>
                  <Plus className="h-4 w-4" />
                  {prefs.sidebarOpen ? "Nouveau chat" : ""}
                </Button>
              </div>

              {prefs.sidebarOpen ? (
                <div className="mt-3 relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Rechercher un ancien chat"
                    className="w-full rounded-xl border bg-background py-2 pl-10 pr-3 text-sm outline-none"
                  />
                </div>
              ) : null}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              <div className="space-y-2">
                {visibleThreads.map((thread) => {
                  const active = thread.id === activeThreadId;
                  const isRenaming = renamingThreadId === thread.id;

                  return (
                    <div
                      key={thread.id}
                      className={[
                        "rounded-2xl border transition",
                        active ? "border-violet-300 bg-violet-50/60" : "border-transparent hover:border-border hover:bg-muted/40",
                      ].join(" ")}
                    >
                      {prefs.sidebarOpen ? (
                        <div className="p-3">
                          {isRenaming ? (
                            <div className="space-y-2">
                              <input
                                autoFocus
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") renameThread();
                                  if (e.key === "Escape") {
                                    setRenamingThreadId(null);
                                    setRenameValue("");
                                  }
                                }}
                                className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none"
                              />
                              <div className="flex gap-2">
                                <Button size="sm" onClick={renameThread}>Valider</Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setRenamingThreadId(null);
                                    setRenameValue("");
                                  }}
                                >
                                  Annuler
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => persistActiveThreadId(thread.id)}
                                className="w-full text-left"
                              >
                                <p className="text-sm font-medium leading-tight">{thread.title}</p>
                                <p className="mt-1 text-xs text-muted-foreground">{threadPreview(thread)}</p>
                                <p className="mt-2 text-[11px] text-muted-foreground">
                                  {formatDate(thread.updatedAt)} • {formatTime(thread.updatedAt)}
                                </p>
                              </button>

                              <div className="mt-3 flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRenamingThreadId(thread.id);
                                    setRenameValue(thread.title);
                                  }}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border bg-background text-muted-foreground hover:text-foreground"
                                  aria-label="Renommer"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteThread(thread.id)}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border bg-background text-muted-foreground hover:text-red-600"
                                  aria-label="Supprimer"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => persistActiveThreadId(thread.id)}
                          className="flex h-14 w-full items-center justify-center"
                          title={thread.title}
                        >
                          <MessageSquare className="h-4 w-4 text-muted-foreground" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <div className="mx-auto flex h-full w-full max-w-5xl flex-col">
            <header className="border-b px-6 py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-violet-200 bg-violet-50 text-violet-700">
                      <Sparkles className="h-4 w-4" />
                    </span>
                    <div>
                      <h1 className="text-lg font-semibold tracking-tight">Assistant CloneStore</h1>
                      <p className="text-sm text-muted-foreground">Direct, utile, centré produit.</p>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{memoryText}</p>
                  {bootstrapWarning ? (
                    <p className="mt-2 text-xs text-amber-700">{bootstrapWarning}</p>
                  ) : null}
                </div>

                <div className="flex items-center gap-2">
                  <Button asChild variant="outline">
                    <Link href="/agents">Boutique</Link>
                  </Button>
                  {context?.isAuthenticated ? (
                    <Button asChild variant="outline">
                      <Link href="/profile/agents">Mes clones</Link>
                    </Button>
                  ) : (
                    <Button asChild>
                      <Link href="/login">Connexion</Link>
                    </Button>
                  )}
                </div>
              </div>
            </header>

            <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-6 py-8">
              <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
                {bootstrapLoading && !activeThread ? (
                  <div className="rounded-3xl border bg-background p-5 text-sm text-muted-foreground">
                    Chargement de l’assistant CloneStore…
                  </div>
                ) : null}

                {activeThread?.messages.map((msg) => {
                  const isAssistant = msg.role === "assistant";

                  return (
                    <div
                      key={msg.id}
                      className={[
                        "flex w-full",
                        isAssistant ? "justify-start" : "justify-end",
                      ].join(" ")}
                    >
                      <div className={["max-w-[88%]", isAssistant ? "w-full" : ""].join(" ")}>
                        <div
                          className={[
                            "rounded-3xl border px-4 py-3 shadow-sm",
                            isAssistant
                              ? "bg-background"
                              : "border-transparent bg-muted",
                          ].join(" ")}
                        >
                          {isAssistant ? (
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <span className="inline-flex h-8 w-8 items-center justify-center rounded-2xl border border-violet-200 bg-violet-50 text-violet-700">
                                  <Sparkles className="h-4 w-4" />
                                </span>
                                <span className="text-sm font-medium">Assistant CloneStore</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => copyMessage(msg)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-xl border bg-background text-muted-foreground transition hover:text-foreground"
                                aria-label="Copier la réponse"
                              >
                                {copiedMessageId === msg.id ? (
                                  <Check className="h-4 w-4 text-emerald-600" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                              </button>
                            </div>
                          ) : null}

                          <div className="whitespace-pre-wrap text-sm leading-7">{msg.content}</div>

                          <div className="mt-3 text-[11px] text-muted-foreground">{formatTime(msg.ts)}</div>
                        </div>

                        {isAssistant ? <MessageLinks links={msg.links} /> : null}
                      </div>
                    </div>
                  );
                })}

                {loading ? (
                  <div className="flex justify-start">
                    <div className="rounded-3xl border bg-background px-4 py-3 text-sm text-muted-foreground shadow-sm">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Réponse en cours…
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="border-t px-6 py-4">
              <div className="mx-auto w-full max-w-3xl">
                {serverError ? (
                  <div className="mb-3 rounded-2xl border border-red-200 bg-red-50/50 p-3 text-xs text-red-700 whitespace-pre-wrap">
                    {serverError}
                  </div>
                ) : null}

                <div className="rounded-[28px] border bg-background p-3 shadow-sm">
                  <textarea
                    ref={textareaRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    placeholder="Écris ta question sur CloneStore, Pierre, l’onboarding, l’email, le PDF, l’accès ou le setup…"
                    className="min-h-[54px] max-h-[220px] w-full resize-none bg-transparent px-1 py-2 text-sm outline-none"
                  />

                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">
                      Entrée pour envoyer • Shift + Entrée pour une nouvelle ligne
                    </p>
                    <Button onClick={send} disabled={loading || !draft.trim()} className="gap-2">
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      Envoyer
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

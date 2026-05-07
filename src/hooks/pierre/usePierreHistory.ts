"use client";

import * as React from "react";

export type PierreHistoryKind =
  | "mission"
  | "task"
  | "document"
  | "email"
  | "pdf"
  | "log"
  | "history";

export type PierreHistoryItem = {
  id: string;
  title: string;
  subtitle: string | null;
  status: string | null;
  kind: PierreHistoryKind;
  mission_id: string | null;
  task_id: string | null;
  document_id: string | null;
  email_id: string | null;
  pdf_id: string | null;
  pinned: boolean;
  favorite: boolean;
  created_at: string | null;
  updated_at: string | null;
  raw: Record<string, unknown>;
};

type RefreshOptions = {
  includeTasks?: boolean;
};

type HistoryResponse = {
  ok?: boolean;
  items?: unknown[];
  nextCursor?: string | null;
  next_cursor?: string | null;
  hasMore?: boolean;
  has_more?: boolean;
  error?: string;
  message?: string;
};

type UsePierreHistoryReturn = {
  items: PierreHistoryItem[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  refresh: (options?: RefreshOptions) => Promise<void>;
  loadMore: () => Promise<void>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function bool(value: unknown): boolean {
  return value === true;
}

function toKind(value: unknown): PierreHistoryKind {
  const raw = String(value ?? "").trim().toLowerCase();

  switch (raw) {
    case "mission":
      return "mission";
    case "task":
      return "task";
    case "document":
      return "document";
    case "email":
      return "email";
    case "pdf":
      return "pdf";
    case "log":
      return "log";
    default:
      return "history";
  }
}

function dateValue(value?: string | null): number {
  if (!value) return 0;
  const date = new Date(value);
  const time = date.getTime();
  return Number.isNaN(time) ? 0 : time;
}

function extractStableId(raw: Record<string, unknown>): string | null {
  return (
    text(raw.id) ??
    text(raw.history_id) ??
    text(raw.event_id) ??
    text(raw.mission_id) ??
    text(raw.task_id) ??
    text(raw.document_id) ??
    text(raw.email_id) ??
    text(raw.pdf_id)
  );
}

function buildTitle(raw: Record<string, unknown>): string {
  return (
    text(raw.title) ??
    text(raw.name) ??
    text(raw.subject) ??
    text(raw.doc_title) ??
    text(raw.event) ??
    "Élément Pierre"
  );
}

function buildSubtitle(raw: Record<string, unknown>): string | null {
  return (
    text(raw.subtitle) ??
    text(raw.summary) ??
    text(raw.description) ??
    text(raw.request_text) ??
    text(raw.message) ??
    text(raw.note) ??
    null
  );
}

function normalizeItem(value: unknown): PierreHistoryItem | null {
  if (!isRecord(value)) return null;

  const id = extractStableId(value);
  if (!id) return null;

  return {
    id,
    title: buildTitle(value),
    subtitle: buildSubtitle(value),
    status: text(value.status),
    kind: toKind(value.kind ?? value.type),
    mission_id: text(value.mission_id),
    task_id: text(value.task_id),
    document_id: text(value.document_id),
    email_id: text(value.email_id),
    pdf_id: text(value.pdf_id),
    pinned: bool(value.pinned),
    favorite: bool(value.favorite ?? value.favourited),
    created_at: text(value.created_at),
    updated_at: text(value.updated_at),
    raw: value,
  };
}

function sortItems(items: PierreHistoryItem[]) {
  return [...items].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;

    const da = dateValue(a.updated_at) || dateValue(a.created_at);
    const db = dateValue(b.updated_at) || dateValue(b.created_at);
    return db - da;
  });
}

function mergeItems(
  current: PierreHistoryItem[],
  incoming: PierreHistoryItem[]
): PierreHistoryItem[] {
  const map = new Map<string, PierreHistoryItem>();

  for (const item of current) {
    map.set(item.id, item);
  }

  for (const item of incoming) {
    const existing = map.get(item.id);
    map.set(item.id, existing ? { ...existing, ...item, raw: { ...existing.raw, ...item.raw } } : item);
  }

  return sortItems(Array.from(map.values()));
}

async function safeJson<T>(response: Response): Promise<T | null> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return null;

  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function extractError(payload: unknown): string | null {
  if (!isRecord(payload)) return null;
  return text(payload.error) ?? text(payload.message);
}

export function usePierreHistory(): UsePierreHistoryReturn {
  const [items, setItems] = React.useState<PierreHistoryItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [hasMore, setHasMore] = React.useState(false);

  const mountedRef = React.useRef(true);
  const lastRefreshOptionsRef = React.useRef<RefreshOptions | undefined>(undefined);

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = React.useCallback(async (options?: RefreshOptions) => {
    lastRefreshOptionsRef.current = options;
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (options?.includeTasks) params.set("includeTasks", "true");

      const url = `/api/pierre/history/list${params.toString() ? `?${params.toString()}` : ""}`;

      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
      });

      const payload = await safeJson<HistoryResponse>(response);

      if (!response.ok) {
        const message =
          extractError(payload) ??
          (response.status === 401
            ? "Session indisponible pour charger l’historique Pierre."
            : response.status === 404
            ? "Route d’historique Pierre introuvable."
            : "Impossible de charger l’historique Pierre.");

        if (mountedRef.current) {
          setItems([]);
          setCursor(null);
          setHasMore(false);
          setError(message);
        }
        return;
      }

      const normalized = Array.isArray(payload?.items)
        ? payload.items
            .map(normalizeItem)
            .filter((item): item is PierreHistoryItem => Boolean(item))
        : [];

      if (mountedRef.current) {
        setItems(sortItems(normalized));
        setCursor(payload?.nextCursor ?? payload?.next_cursor ?? null);
        setHasMore(Boolean(payload?.hasMore ?? payload?.has_more ?? false));
        setError(null);
      }
    } catch {
      if (mountedRef.current) {
        setItems([]);
        setCursor(null);
        setHasMore(false);
        setError("Erreur réseau pendant le chargement de l’historique Pierre.");
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  const loadMore = React.useCallback(async () => {
    if (!cursor || loading) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set("cursor", cursor);
      if (lastRefreshOptionsRef.current?.includeTasks) {
        params.set("includeTasks", "true");
      }

      const response = await fetch(`/api/pierre/history/list?${params.toString()}`, {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
      });

      const payload = await safeJson<HistoryResponse>(response);

      if (!response.ok) {
        const message =
          extractError(payload) ??
          (response.status === 401
            ? "Session indisponible pour charger la suite de l’historique."
            : "Impossible de charger la suite de l’historique Pierre.");

        if (mountedRef.current) {
          setError(message);
        }
        return;
      }

      const normalized = Array.isArray(payload?.items)
        ? payload.items
            .map(normalizeItem)
            .filter((item): item is PierreHistoryItem => Boolean(item))
        : [];

      if (mountedRef.current) {
        setItems((prev) => mergeItems(prev, normalized));
        setCursor(payload?.nextCursor ?? payload?.next_cursor ?? null);
        setHasMore(Boolean(payload?.hasMore ?? payload?.has_more ?? false));
        setError(null);
      }
    } catch {
      if (mountedRef.current) {
        setError("Erreur réseau pendant le chargement complémentaire de l’historique.");
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [cursor, loading]);

  return {
    items,
    loading,
    error,
    hasMore,
    refresh,
    loadMore,
  };
}
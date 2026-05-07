"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type SenderIdentityResolved = {
  senderName: string | null;
  senderEmail: string | null;
  senderDomain: string | null;
  replyTo?: string | null;
  source: "memory" | "fallback" | "none";
};

type CompanyMemoryRecord = {
  id?: string | null;
  company_id?: string | null;
  tone_guide?: string | null;
  communication_style?: string | null;
  preferred_language?: string | null;
  sender_name?: string | null;
  sender_email?: string | null;
  sender_domain?: string | null;
  sender_identity?: unknown;
  company_rules?: unknown;
  approval_rules?: unknown;
  memory?: unknown;
  preferences?: unknown;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
};

type HookError = {
  message: string;
  status?: number;
  code?: string | null;
  details?: unknown;
};

export type UsePierreCompanyMemoryOptions = {
  autoLoad?: boolean;
};

export type UsePierreCompanyMemoryReturn = {
  memory: CompanyMemoryRecord | null;
  loading: boolean;
  refreshing: boolean;
  saving: boolean;
  error: HookError | null;
  lastUpdatedAt: string | null;
  senderIdentityResolved: SenderIdentityResolved;
  refresh: () => Promise<CompanyMemoryRecord | null>;
  refetch: () => Promise<CompanyMemoryRecord | null>;
  reload: () => Promise<CompanyMemoryRecord | null>;
  updateMemory: (patch: Record<string, unknown>) => Promise<CompanyMemoryRecord | null>;
  clearError: () => void;
};

const DEFAULT_OPTIONS: Required<UsePierreCompanyMemoryOptions> = {
  autoLoad: true,
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function normalizeError(error: unknown): HookError {
  if (error instanceof Error) {
    return { message: error.message || "Une erreur est survenue." };
  }

  if (isObject(error)) {
    return {
      message:
        asString(error.message) ||
        asString(error.error) ||
        asString(error.detail) ||
        "Une erreur est survenue.",
      status:
        typeof error.status === "number" && Number.isFinite(error.status)
          ? error.status
          : undefined,
      code: asString(error.code),
      details: error.details,
    };
  }

  return { message: "Une erreur est survenue." };
}

function nowIso() {
  return new Date().toISOString();
}

async function safeReadJson(response: Response): Promise<unknown | null> {
  const text = await response.text();

  if (!text) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

async function requestJson<T>(
  url: string,
  init?: RequestInit,
): Promise<T | null> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  const data = await safeReadJson(response);

  if (!response.ok) {
    const source = isObject(data) ? data : {};
    throw {
      message:
        asString(source.message) ||
        asString(source.error) ||
        asString(source.detail) ||
        `HTTP ${response.status}`,
      status: response.status,
      code: asString(source.code),
      details: data,
    };
  }

  return (data as T | null) ?? null;
}

function normalizeCompanyMemory(raw: unknown): CompanyMemoryRecord | null {
  if (!isObject(raw)) return null;

  return {
    ...raw,
    id: asString(raw.id),
    company_id: asString(raw.company_id),
    tone_guide: asString(raw.tone_guide),
    communication_style: asString(raw.communication_style),
    preferred_language: asString(raw.preferred_language),
    sender_name: asString(raw.sender_name),
    sender_email: asString(raw.sender_email),
    sender_domain: asString(raw.sender_domain),
    created_at: asString(raw.created_at),
    updated_at: asString(raw.updated_at),
  };
}

function extractMemoryPayload(data: unknown): CompanyMemoryRecord | null {
  const source = isObject(data) ? data : {};
  const dataBlock = isObject(source.data) ? source.data : null;
  const resultBlock = isObject(source.result) ? source.result : null;

  return (
    normalizeCompanyMemory(source.memory) ||
    normalizeCompanyMemory(source.companyMemory) ||
    normalizeCompanyMemory(dataBlock?.memory) ||
    normalizeCompanyMemory(dataBlock?.companyMemory) ||
    normalizeCompanyMemory(resultBlock?.memory) ||
    normalizeCompanyMemory(resultBlock?.companyMemory) ||
    normalizeCompanyMemory(data)
  );
}

function resolveSenderIdentity(memory: CompanyMemoryRecord | null): SenderIdentityResolved {
  const fallbackEmail =
    typeof process !== "undefined"
      ? asString(process.env.NEXT_PUBLIC_PIERRE_FALLBACK_SENDER_EMAIL)
      : null;

  const fallbackName =
    typeof process !== "undefined"
      ? asString(process.env.NEXT_PUBLIC_PIERRE_FALLBACK_SENDER_NAME)
      : null;

  const senderIdentityBlock = isObject(memory?.sender_identity)
    ? memory?.sender_identity
    : null;

  const senderName =
    asString(memory?.sender_name) ||
    asString(senderIdentityBlock?.sender_name) ||
    asString(senderIdentityBlock?.name) ||
    fallbackName ||
    null;

  const senderEmail =
    asString(memory?.sender_email) ||
    asString(senderIdentityBlock?.sender_email) ||
    asString(senderIdentityBlock?.email) ||
    fallbackEmail ||
    null;

  const senderDomain =
    asString(memory?.sender_domain) ||
    asString(senderIdentityBlock?.sender_domain) ||
    (senderEmail && senderEmail.includes("@") ? senderEmail.split("@")[1] : null);

  if (asString(memory?.sender_email) || asString(memory?.sender_name) || senderIdentityBlock) {
    return {
      senderName,
      senderEmail,
      senderDomain,
      source: "memory",
    };
  }

  if (fallbackEmail || fallbackName) {
    return {
      senderName,
      senderEmail,
      senderDomain,
      source: "fallback",
    };
  }

  return {
    senderName: null,
    senderEmail: null,
    senderDomain: null,
    source: "none",
  };
}

export default function usePierreCompanyMemory(
  options?: UsePierreCompanyMemoryOptions,
): UsePierreCompanyMemoryReturn {
  const resolvedOptions = { ...DEFAULT_OPTIONS, ...(options ?? {}) };

  const [memory, setMemory] = useState<CompanyMemoryRecord | null>(null);
  const [loading, setLoading] = useState<boolean>(resolvedOptions.autoLoad);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<HookError | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  const mountedRef = useRef<boolean>(true);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const refresh = useCallback(async (): Promise<CompanyMemoryRecord | null> => {
    setRefreshing(true);
    setError(null);

    try {
      const data = await requestJson<unknown>("/api/pierre/company-memory", {
        method: "GET",
      });

      const nextMemory = extractMemoryPayload(data);
      setMemory(nextMemory);
      setLastUpdatedAt(nowIso());

      return nextMemory;
    } catch (caught) {
      const normalized = normalizeError(caught);
      setError(normalized);
      throw normalized;
    } finally {
      if (mountedRef.current) {
        setRefreshing(false);
        setLoading(false);
      }
    }
  }, []);

  const updateMemory = useCallback(
    async (patch: Record<string, unknown>): Promise<CompanyMemoryRecord | null> => {
      setSaving(true);
      setError(null);

      try {
        const data = await requestJson<unknown>("/api/pierre/company-memory", {
          method: "PATCH",
          body: JSON.stringify(patch),
        });

        const nextMemory = extractMemoryPayload(data);
        setMemory(nextMemory);
        setLastUpdatedAt(nowIso());

        return nextMemory;
      } catch (caught) {
        const normalized = normalizeError(caught);
        setError(normalized);
        throw normalized;
      } finally {
        if (mountedRef.current) {
          setSaving(false);
          setLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!resolvedOptions.autoLoad) {
      setLoading(false);
      return;
    }

    void refresh();
  }, [refresh, resolvedOptions.autoLoad]);

  const senderIdentityResolved = useMemo(() => {
    return resolveSenderIdentity(memory);
  }, [memory]);

  return {
    memory,
    loading,
    refreshing,
    saving,
    error,
    lastUpdatedAt,
    senderIdentityResolved,
    refresh,
    refetch: refresh,
    reload: refresh,
    updateMemory,
    clearError,
  };
}
export { usePierreCompanyMemory };



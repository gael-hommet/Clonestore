"use client";

// PHASE 8.4-R1.11 — the recipient's REAL P8.4 in-app messages (pierre_rt_notifications), served by the
// authenticated runtime API (GET /api/pierre/v1/messages). Recipient-only, active-tenant-only, real
// unread count, real mark-as-read + archive, a working action path (the secure link / cockpit deep
// link). NO fictitious legacy data, NO global data: every row is a genuine governed delivery to THIS
// user. The surrounding 4-tab message center design is unchanged — this is an additive real-data band.

import { useCallback, useEffect, useState } from "react";
import { Bell, CheckCircle2, Archive, ArrowRight, Loader2, Inbox } from "lucide-react";
import { getSessionClient } from "@/lib/auth/session-client";

type RealMessage = {
  id: string;
  title: string | null;
  body_text: string | null;
  action_path: string | null;
  priority: string | null;
  read_at: string | null;
  created_at: string;
};

async function authHeaders(): Promise<Record<string, string>> {
  try {
    const { data } = await getSessionClient().auth.getSession();
    const token = data.session?.access_token;
    return token ? { authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

export default function PierreInboxPanel() {
  const [items, setItems] = useState<RealMessage[]>([]);
  const [unread, setUnread] = useState(0);
  const [state, setState] = useState<"loading" | "ready" | "error" | "empty">("loading");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/pierre/v1/messages?limit=50", { credentials: "include", headers: await authHeaders() });
      if (!res.ok) { setState("error"); return; }
      const body = (await res.json()) as { items?: RealMessage[]; unread?: number };
      const list = Array.isArray(body.items) ? body.items : [];
      setItems(list);
      setUnread(typeof body.unread === "number" ? body.unread : 0);
      setState(list.length === 0 ? "empty" : "ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const markRead = useCallback(async (id: string) => {
    await fetch(`/api/pierre/v1/messages/${id}/read`, { method: "POST", credentials: "include", headers: await authHeaders() });
    await load();
  }, [load]);

  const archive = useCallback(async (id: string) => {
    await fetch(`/api/pierre/v1/messages/${id}/archive`, { method: "POST", credentials: "include", headers: await authHeaders() });
    await load();
  }, [load]);

  // The panel is invisible when the runtime has no real message for this recipient — it never invents one.
  if (state === "loading") {
    return (
      <section data-testid="pierre-real-inbox" className="rounded-2xl border border-white/50 bg-white/40 p-5">
        <div className="flex items-center gap-2 text-sm text-[var(--cs-ink-3)]"><Loader2 className="h-4 w-4 animate-spin" /> Chargement de votre messagerie Pierre…</div>
      </section>
    );
  }
  if (state === "error" || state === "empty") {
    return (
      <section data-testid="pierre-real-inbox" data-state={state} className="rounded-2xl border border-white/50 bg-white/40 p-5">
        <div className="flex items-center gap-2 text-sm text-[var(--cs-ink-3)]">
          <Inbox className="h-4 w-4 text-[#667cff]" />
          {state === "empty" ? "Aucun message Pierre pour le moment." : "Messagerie Pierre momentanément indisponible."}
        </div>
      </section>
    );
  }

  return (
    <section data-testid="pierre-real-inbox" data-state="ready" className="rounded-2xl border border-white/60 bg-white/46 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--cs-ink-1)]">
          <Bell className="h-4 w-4 text-[#667cff]" /> Messagerie Pierre
        </div>
        <span data-testid="pierre-real-inbox-unread" className="rounded-full bg-[#667cff]/12 px-2.5 py-0.5 text-xs font-semibold text-[#3a4cc0]">
          {unread} non lu{unread !== 1 ? "s" : ""}
        </span>
      </header>
      <ul className="space-y-2">
        {items.map((m) => (
          <li key={m.id} data-testid="pierre-real-message" data-read={m.read_at ? "true" : "false"} className="rounded-xl border border-white/50 bg-white/55 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[var(--cs-ink-1)]">{m.title ?? "Notification"}</p>
                {m.body_text ? <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-[var(--cs-ink-3)]">{m.body_text}</p> : null}
              </div>
              {!m.read_at ? <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[#667cff]" aria-label="non lu" /> : null}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {m.action_path ? (
                <a href={m.action_path} className="inline-flex items-center gap-1 rounded-lg border border-white/60 bg-white/60 px-2.5 py-1 text-xs font-semibold text-[#3a4cc0]">
                  Ouvrir <ArrowRight className="h-3 w-3" />
                </a>
              ) : null}
              {!m.read_at ? (
                <button type="button" onClick={() => void markRead(m.id)} className="inline-flex items-center gap-1 rounded-lg border border-white/60 bg-white/60 px-2.5 py-1 text-xs font-semibold text-[var(--cs-ink-2)]">
                  <CheckCircle2 className="h-3 w-3" /> Marquer lu
                </button>
              ) : null}
              <button type="button" onClick={() => void archive(m.id)} className="inline-flex items-center gap-1 rounded-lg border border-white/60 bg-white/60 px-2.5 py-1 text-xs font-semibold text-[var(--cs-ink-4)]">
                <Archive className="h-3 w-3" /> Archiver
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

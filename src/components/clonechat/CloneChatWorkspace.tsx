"use client";

// P9.4 — Interface conversationnelle CloneChat. Fil de messages, blocs riches
// (missions/validations/salariés/documents), aperçu d'action + CONFIRMATION explicite,
// résultat réel, provenance affichée, deep-links cockpit. Public = orientation ;
// authentifié = opérationnel (OpenAI réel gouverné). Responsive + accessible.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Bot, FileText, Loader2, Paperclip, RotateCcw, Send, ShieldAlert, Sparkles, Square, UserRound, Workflow, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusChip } from "@/components/pierre/cockpit/primitives";
import { useCloneChat, type CloneChatUiMode } from "@/app/assistant/useCloneChat";
import type { CloneChatContentBlock, CloneChatMessage, CloneChatProposedAction } from "@/lib/clonechat";

const EXAMPLES_PUBLIC = ["Qu'est-ce que Pierre ?", "Comment fonctionne CloneStore ?", "Montrez-moi la démo"];
const EXAMPLES_AUTH = ["Où en est Pierre ?", "Qu'est-ce qui attend ma validation ?", "Prépare le contrat CDI de Marie"];

const MAX_ATTACH = 2;
const MAX_ATTACH_BYTES = 4 * 1024 * 1024;

export function CloneChatWorkspace() {
  const chat = useCloneChat();
  const [draft, setDraft] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const router = useRouter();
  const threadRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" }); }, [chat.messages, chat.busy]);

  const submit = () => {
    const t = draft.trim();
    if ((!t && images.length === 0) || chat.busy) return;
    setDraft(""); const imgs = images; setImages([]); setAttachError(null);
    void chat.send(t, imgs);
  };
  const examples = chat.mode === "authenticated" ? EXAMPLES_AUTH : EXAMPLES_PUBLIC;

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setAttachError(null);
    const next: string[] = [...images];
    for (const f of Array.from(files)) {
      if (next.length >= MAX_ATTACH) { setAttachError(`Maximum ${MAX_ATTACH} captures.`); break; }
      if (!["image/png", "image/jpeg", "image/webp"].includes(f.type)) { setAttachError("Formats acceptés : PNG, JPEG, WebP."); continue; }
      if (f.size > MAX_ATTACH_BYTES) { setAttachError("Image trop lourde (max 4 Mo)."); continue; }
      const dataUrl = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(new Error("read")); r.readAsDataURL(f); }).catch(() => null);
      if (dataUrl) next.push(dataUrl);
    }
    setImages(next.slice(0, MAX_ATTACH));
    if (fileRef.current) fileRef.current.value = "";
  };

  const onAction = async (a: CloneChatProposedAction) => {
    const r = await chat.executeAction(a);
    if (r.ok && r.href) router.push(r.href);
  };

  return (
    <main className="cs-page">
      <div className="cs-page-shell flex min-h-[70vh] flex-col gap-4">
        {/* Header */}
        <section data-tour-id="clonechat-header" className="cs-panel flex items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--cs-line-soft)] bg-white/58 text-[var(--cs-violet)]">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-[1.1rem] font-semibold tracking-[-0.03em] text-[var(--cs-ink-1)]">CloneChat</h1>
              <p className="text-[0.8rem] text-[var(--cs-ink-4)]">{chat.modeLabel}{chat.mode === "authenticated" ? " · connecté à votre entreprise" : ""}</p>
            </div>
          </div>
          <Link href="/agents/pierre/use" data-tour-id="clonechat-cockpit-link" className="cs-liquid-button">
            <Workflow className="h-4 w-4" /><span className="hidden sm:inline">Cockpit Pierre</span>
          </Link>
        </section>

        {/* Fil */}
        <div ref={threadRef} data-tour-id="clonechat-thread" className="cs-panel min-h-0 flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
          {chat.isEmpty ? (
            <Welcome mode={chat.mode} />
          ) : (
            chat.messages.map((m) => <MessageRow key={m.id} message={m} onAction={onAction} busy={chat.busy} />)
          )}
          {chat.busy ? (
            <div className="flex items-center gap-2 text-[0.84rem] text-[var(--cs-ink-4)]"><Loader2 className="h-4 w-4 animate-spin" /> CloneChat réfléchit…</div>
          ) : null}
        </div>

        {/* Exemples */}
        {chat.isEmpty ? (
          <div className="flex flex-wrap gap-2">
            {examples.map((ex) => (
              <button key={ex} type="button" onClick={() => { setDraft(ex); }} className="rounded-full border border-[var(--cs-line-soft)] bg-white/50 px-3 py-1.5 text-[0.8rem] text-[var(--cs-ink-3)] hover:bg-white/80">
                {ex}
              </button>
            ))}
          </div>
        ) : null}

        {/* Composer */}
        <section data-tour-id="clonechat-input" className="cs-panel p-3">
          {/* Aperçus des captures jointes */}
          {images.length > 0 ? (
            <div className="mb-2 flex flex-wrap gap-2" data-tour-id="clonechat-attachments">
              {images.map((src, i) => (
                <span key={i} className="relative inline-flex h-14 w-14 overflow-hidden rounded-lg border border-[var(--cs-line-soft)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`Capture ${i + 1}`} className="h-full w-full object-cover" />
                  <button type="button" aria-label={`Retirer la capture ${i + 1}`} onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))} className="absolute right-0 top-0 inline-flex h-5 w-5 items-center justify-center rounded-bl-lg bg-black/55 text-white hover:bg-black/75">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : null}
          {attachError ? <p className="mb-1.5 px-1 text-[0.72rem] text-[var(--cs-danger)]" role="alert">{attachError}</p> : null}

          <div className="flex items-end gap-2">
            {chat.mode === "authenticated" ? (
              <>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" multiple className="hidden" aria-hidden="true" tabIndex={-1} onChange={(e) => void onFiles(e.target.files)} />
                <button type="button" onClick={() => fileRef.current?.click()} disabled={chat.busy || images.length >= MAX_ATTACH} aria-label="Joindre une capture d'écran" className={cn("cs-liquid-button h-[46px]", (chat.busy || images.length >= MAX_ATTACH) && "pointer-events-none opacity-60")}>
                  <Paperclip className="h-4 w-4" />
                </button>
              </>
            ) : null}
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
              rows={1}
              placeholder={chat.mode === "authenticated" ? "Demandez à CloneChat (missions, validations, salariés, documents…)" : "Posez une question sur CloneStore et Pierre…"}
              aria-label="Message pour CloneChat"
              disabled={chat.busy}
              className="max-h-40 min-h-[46px] flex-1 resize-none rounded-[1.1rem] border border-[var(--cs-line-soft)] bg-white/60 px-4 py-3 text-[0.9rem] leading-6 text-[var(--cs-ink-1)] outline-none focus-visible:border-[var(--cs-violet)]"
            />
            {chat.busy ? (
              <button type="button" onClick={chat.stop} aria-label="Interrompre" className="cs-liquid-button h-[46px]">
                <Square className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={submit}
                disabled={draft.trim().length === 0 && images.length === 0}
                aria-label="Envoyer"
                className={cn("cs-liquid-button cs-liquid-button--primary h-[46px]", (draft.trim().length === 0 && images.length === 0) && "pointer-events-none opacity-60")}
              >
                <Send className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-2 px-1">
            <p className="text-[0.72rem] text-[var(--cs-ink-4)]">
              {chat.mode === "authenticated" ? "Rien de sensible n'est exécuté sans votre confirmation." : "Assistant d'orientation — je n'accède pas aux données d'une entreprise."}
            </p>
            {!chat.isEmpty && !chat.busy ? (
              <button type="button" onClick={chat.retry} aria-label="Réessayer le dernier message" className="inline-flex items-center gap-1 text-[0.72rem] text-[var(--cs-ink-4)] hover:text-[var(--cs-ink-2)]">
                <RotateCcw className="h-3 w-3" /> Réessayer
              </button>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}

function Welcome({ mode }: { mode: CloneChatUiMode }) {
  return (
    <div className="mx-auto max-w-lg py-8 text-center">
      <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--cs-line-soft)] bg-white/58 text-[var(--cs-violet)]"><Sparkles className="h-6 w-6" /></div>
      <p className="text-[1.05rem] font-semibold text-[var(--cs-ink-1)]">Bonjour, je suis CloneChat.</p>
      <p className="mt-2 text-[0.88rem] leading-6 text-[var(--cs-ink-3)]">
        {mode === "authenticated"
          ? "Je connais votre espace : je peux résumer l'activité de Pierre, retrouver vos missions, salariés et documents, expliquer vos validations et préparer une action — avec votre confirmation."
          : "Je vous explique CloneStore et Pierre, et je vous oriente. Connectez-vous pour que je devienne opérationnel sur votre entreprise."}
      </p>
    </div>
  );
}

function MessageRow({ message, onAction, busy }: { message: CloneChatMessage; onAction: (a: CloneChatProposedAction) => void; busy: boolean }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
      <span className={cn("mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--cs-line-soft)]", isUser ? "bg-[var(--cs-violet-soft)] text-[var(--cs-violet)]" : "bg-white/58 text-[var(--cs-ink-3)]")}>
        {isUser ? <UserRound className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </span>
      <div className={cn("min-w-0 max-w-[85%] space-y-2", isUser && "text-right")}>
        {message.content.map((b, i) => <BlockView key={i} block={b} onAction={onAction} busy={busy} isUser={isUser} />)}
      </div>
    </div>
  );
}

function BlockView({ block, onAction, busy, isUser }: { block: CloneChatContentBlock; onAction: (a: CloneChatProposedAction) => void; busy: boolean; isUser: boolean }) {
  switch (block.type) {
    case "text":
      return <div className={cn("inline-block rounded-[1.1rem] px-3.5 py-2 text-[0.9rem] leading-6", isUser ? "bg-[var(--cs-violet)] text-white" : "bg-white/70 text-[var(--cs-ink-1)]")}>{block.text}</div>;
    case "boundary":
      return <p className="text-[0.72rem] italic text-[var(--cs-ink-4)]">{block.text}</p>;
    case "mission":
      return (
        <Link href={`/agents/pierre/use?view=missions&mission=${encodeURIComponent(block.mission.id)}`} className="cs-card cs-card-tight cs-hover-lift block text-left">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 min-w-0"><Workflow className="h-4 w-4 shrink-0 text-[var(--cs-violet)]" /><span className="truncate text-[0.86rem] font-medium text-[var(--cs-ink-1)]">{block.mission.title}</span></span>
            <StatusChip view={block.mission.statusView} />
          </div>
        </Link>
      );
    case "validation":
      return (
        <div className="cs-card cs-card-tight text-left">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 min-w-0"><ShieldAlert className="h-4 w-4 shrink-0 text-[var(--cs-warn)]" /><span className="truncate text-[0.86rem] font-medium text-[var(--cs-ink-1)]">{block.validation.intent}</span></span>
            <StatusChip view={block.validation.statusView} />
          </div>
          {block.validation.reason ? <p className="mt-1 text-[0.78rem] text-[var(--cs-ink-3)]">{block.validation.reason}</p> : null}
        </div>
      );
    case "employee":
      return (
        <Link href={block.employee.href} className="cs-card cs-card-tight cs-hover-lift block text-left">
          <span className="flex items-center gap-2"><UserRound className="h-4 w-4 text-[var(--cs-violet)]" /><span className="text-[0.86rem] font-medium text-[var(--cs-ink-1)]">{block.employee.name}</span><span className="text-[0.76rem] text-[var(--cs-ink-4)]">{block.employee.role ?? ""}</span></span>
        </Link>
      );
    case "document":
      return (
        <div className="cs-card cs-card-tight text-left">
          <span className="flex items-center gap-2"><FileText className="h-4 w-4 text-[var(--cs-violet)]" /><span className="text-[0.86rem] font-medium text-[var(--cs-ink-1)]">{block.document.title}</span><StatusChip view={block.document.statusView} /></span>
        </div>
      );
    case "action_preview": {
      const a = block.action;
      return (
        <div className="cs-card cs-card-tight border-l-4 border-l-[var(--cs-violet)] text-left">
          <p className="text-[0.86rem] font-medium text-[var(--cs-ink-1)]">{a.label}</p>
          {a.requiresConfirmation ? <p className="mt-0.5 text-[0.76rem] text-[var(--cs-warn)]">Action {a.risk === "irreversible" ? "irréversible" : "sensible"} — votre confirmation est requise.</p> : null}
          {a.allowed ? (
            <button type="button" disabled={busy} onClick={() => onAction(a)} className={cn("cs-liquid-button cs-liquid-button--primary mt-2", busy && "pointer-events-none opacity-60")}>
              <span>{a.requiresConfirmation ? "Confirmer" : a.label}</span><ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <p className="mt-2 text-[0.78rem] text-[var(--cs-ink-4)]">{a.reason}</p>
          )}
        </div>
      );
    }
    case "error":
      return (
        <div className="cs-card cs-card-tight border-l-4 border-l-[var(--cs-danger)] text-left" role="alert">
          <p className="text-[0.86rem] text-[var(--cs-danger)]">{block.message}</p>
          {block.recovery.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {block.recovery.map((r) => r.href ? (
                <Link key={r.kind} href={r.href} className="cs-liquid-button">{r.label}</Link>
              ) : (
                <span key={r.kind} className="text-[0.78rem] text-[var(--cs-ink-4)]">{r.label}</span>
              ))}
            </div>
          ) : null}
        </div>
      );
    default:
      return null;
  }
}

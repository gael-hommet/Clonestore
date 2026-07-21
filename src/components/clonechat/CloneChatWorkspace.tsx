"use client";

// P9.4 — Interface conversationnelle CloneChat. Fil de messages, blocs riches
// (missions/validations/salariés/documents), aperçu d'action + CONFIRMATION explicite,
// résultat réel, provenance affichée, deep-links cockpit. Public = orientation ;
// authentifié = opérationnel (OpenAI réel gouverné). Responsive + accessible.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SafeText } from "./SafeText";
import { HistoryPanel, HistoryDrawer } from "./HistoryPanel";
import { useRouter } from "next/navigation";
import { ArrowRight, Bot, FileText, FolderOpen, ImageIcon, Mic, Paperclip as PaperclipIcon, Square as SquareIcon, Loader2, MessageSquarePlus, Paperclip, RotateCcw, Send, ShieldAlert, Sparkles, Square, Trash2, UserRound, Workflow, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusChip } from "@/components/pierre/cockpit/primitives";
import { useCloneChat, type CloneChatDocAttachment, type CloneChatCompanyState } from "@/app/assistant/useCloneChat";
import { useVoiceDictation } from "@/app/assistant/useVoiceDictation";
// C1.7 §10 — manifeste CANONIQUE : sélectionner ≠ téléverser ≠ analyser.
import { buildManifest, manifestSummary, type AttachmentEntry } from "@/lib/clonechat/attachments/manifest";
import type { CloneChatContentBlock, CloneChatMessage, CloneChatProposedAction } from "@/lib/clonechat";

const EXAMPLES_PUBLIC = ["C'est quoi Pierre ?", "Comment Pierre peut-il me faire gagner du temps ?", "Quels sont les prix ?"];
const EXAMPLES_AUTH = ["Où en est Pierre ?", "Qu'est-ce qui attend ma validation ?", "Prépare le contrat CDI de Marie"];

const MAX_ATTACH = 2;
const MAX_ATTACH_BYTES = 4 * 1024 * 1024;

// C1.1 — Documents réellement pris en charge (parseurs installés et testés). PPTX exclu :
// aucun parseur approuvé. La validation client n'est qu'un confort : le SERVEUR décide.
const DOC_MIME = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "text/plain",
  "text/markdown",
];
const DOC_EXT = /\.(pdf|docx|xlsx|csv|txt|md)$/i;
const MAX_DOCS = 3;
const MAX_DOC_BYTES = 6 * 1024 * 1024;
const ACCEPT_ATTR = "image/png,image/jpeg,image/webp,.pdf,.docx,.xlsx,.csv,.txt,.md";

export function CloneChatWorkspace() {
  const chat = useCloneChat();
  const [draft, setDraft] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [docs, setDocs] = useState<CloneChatDocAttachment[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  // C1.7 §8 — DICTÉE : le transcript est INSÉRÉ dans le composer et reste ÉDITABLE.
  // Il n'est JAMAIS envoyé automatiquement. Le texte déjà saisi est préservé, et
  // l'insertion est annulable (undo) tant que l'utilisateur n'a rien retapé.
  const [undoDraft, setUndoDraft] = useState<string | null>(null);
  // C1.7 §10 — Manifeste des pièces jointes. Elles sont SÉLECTIONNÉES ici ; elles ne partent
  // qu'à l'envoi du message, et ne sont « analysées » que lorsque le serveur l'a fait.
  const [manifest, setManifest] = useState<AttachmentEntry[]>([]);
  const [pickedFiles, setPickedFiles] = useState<File[]>([]);
  const [attachMenu, setAttachMenu] = useState(false);
  const [dragging, setDragging] = useState(false);
  const filesRef = useRef<HTMLInputElement | null>(null);
  const imagesRef = useRef<HTMLInputElement | null>(null);
  const folderRef = useRef<HTMLInputElement | null>(null);
  // P17 — a11y du menu pièce jointe : fermeture au clic extérieur + Escape (avec retour du focus).
  const attachWrapRef = useRef<HTMLDivElement | null>(null);
  const attachBtnRef = useRef<HTMLButtonElement | null>(null);

  /** Ajoute des fichiers au manifeste — SANS rien téléverser. */
  const addFiles = (list: FileList | File[]) => {
    const incoming = Array.from(list);
    const all = [...pickedFiles, ...incoming];
    const m = buildManifest(all.map((file) => ({
      name: file.name,
      mime: file.type,
      size: file.size,
      // `webkitRelativePath` est renseigné pour une sélection de DOSSIER.
      relativePath: (file as File & { webkitRelativePath?: string }).webkitRelativePath || undefined,
    })));
    setManifest(m);
    setPickedFiles(all);
    setAttachMenu(false);
  };

  const removeAttachment = (id: string) => {
    const idx = manifest.findIndex((e) => e.id === id);
    if (idx < 0) return;
    const nextFiles = pickedFiles.filter((_, i) => i !== idx);
    setPickedFiles(nextFiles);
    setManifest(buildManifest(nextFiles.map((file) => ({
      name: file.name, mime: file.type, size: file.size,
      relativePath: (file as File & { webkitRelativePath?: string }).webkitRelativePath || undefined,
    }))));
  };

  const clearAttachments = () => { setManifest([]); setPickedFiles([]); };
  const summary = manifestSummary(manifest);
  const dictation = useVoiceDictation({
    onTranscript: (text) => {
      setDraft((prev) => {
        setUndoDraft(prev);                       // permet d'annuler l'insertion
        return prev.trim().length > 0 ? `${prev.trim()} ${text}` : text;
      });
    },
  });
  const router = useRouter();
  const threadRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // C1.8 §18 — DÉFAUT TROUVÉ EN QA NAVIGATEUR RÉELLE (erreur d'hydratation React sur /assistant).
  //
  // `dictation.supported` interroge `navigator.mediaDevices` : il vaut FALSE au rendu serveur et
  // TRUE au rendu client. Le bouton micro n'existait donc que d'un côté, et React reconstruisait
  // tout le sous-arbre du composeur (« server rendered HTML didn't match the client »).
  // On attend le montage : le PREMIER rendu client est alors identique au rendu serveur.
  const [historyOpen, setHistoryOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const micAvailable = mounted && dictation.supported;

  // P17 — le menu pièce jointe (role="menu") n'avait ni Escape, ni fermeture au clic extérieur :
  // annuler la boîte de dialogue native (ou cliquer ailleurs) le laissait ouvert. On ferme au clic
  // hors du menu et à Escape (le focus revient au déclencheur), sans piéger le Tab.
  useEffect(() => {
    if (!attachMenu) return;
    const onDocDown = (e: PointerEvent) => {
      if (attachWrapRef.current && !attachWrapRef.current.contains(e.target as Node)) setAttachMenu(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setAttachMenu(false); attachBtnRef.current?.focus(); }
    };
    document.addEventListener("pointerdown", onDocDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDocDown); document.removeEventListener("keydown", onKey); };
  }, [attachMenu]);

  useEffect(() => { threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" }); }, [chat.messages, chat.busy]);

  const attachCount = manifest.filter((e) => e.state !== "rejected").length;

  // C1.7 §4 — UN SEUL TRANSPORT. Le manifeste est la SOURCE DE VÉRITÉ de ce qui part.
  // (Défaut corrigé : l'ancien `submit` envoyait `images`/`docs` et ABANDONNAIT silencieusement
  //  les fichiers choisis via le menu, le dossier, le glisser-déposer et le collage.)
  const submit = () => {
    const t = draft.trim();
    const accepted = manifest.filter((e) => e.state !== "rejected");
    if ((!t && accepted.length === 0) || chat.busy) return;
    const files = accepted.map((e) => ({ entry: e, file: pickedFiles[manifest.indexOf(e)] })).filter((x) => x.file);
    setDraft("");
    clearAttachments();
    setAttachError(null);
    void chat.sendWithFiles(t, files);
  };
  const examples = chat.companyState === "active" ? EXAMPLES_AUTH : EXAMPLES_PUBLIC;

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setAttachError(null);
    const nextImages: string[] = [...images];
    const nextDocs: CloneChatDocAttachment[] = [...docs];
    for (const f of Array.from(files)) {
      const isImage = ["image/png", "image/jpeg", "image/webp"].includes(f.type);
      const isDoc = DOC_MIME.includes(f.type) || DOC_EXT.test(f.name);

      if (isImage) {
        if (nextImages.length >= MAX_ATTACH) { setAttachError(`Maximum ${MAX_ATTACH} captures.`); continue; }
        if (f.size > MAX_ATTACH_BYTES) { setAttachError("Image trop lourde (max 4 Mo)."); continue; }
        const dataUrl = await readAs(f, "dataUrl");
        if (dataUrl) nextImages.push(dataUrl);
        continue;
      }

      if (isDoc) {
        // Sans entreprise active (public OU découverte) : aucun document — le serveur reste
        // l'autorité, ce refus client n'est qu'un confort honnête.
        if (chat.mode !== "authenticated") { setAttachError("Connectez-vous pour joindre un document."); continue; }
        if (chat.companyState !== "active") { setAttachError("Connectez une entreprise active pour analyser un document."); continue; }
        if (nextDocs.length >= MAX_DOCS) { setAttachError(`Maximum ${MAX_DOCS} documents.`); continue; }
        if (f.size > MAX_DOC_BYTES) { setAttachError("Document trop lourd (max 6 Mo)."); continue; }
        const b64 = await readAs(f, "base64");
        if (b64) nextDocs.push({ filename: f.name, mimeType: f.type || "application/octet-stream", sizeBytes: f.size, data: b64 });
        continue;
      }

      // Confort uniquement : le serveur reste l'autorité (MIME re-détecté par signature).
      setAttachError("Formats acceptés : PNG, JPEG, WebP, PDF, DOCX, XLSX, CSV, TXT, MD.");
    }
    setImages(nextImages.slice(0, MAX_ATTACH));
    setDocs(nextDocs.slice(0, MAX_DOCS));
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeDoc = (i: number) => setDocs((prev) => prev.filter((_, k) => k !== i));

  const onAction = async (a: CloneChatProposedAction) => {
    const r = await chat.executeAction(a);
    if (r.ok && r.href) router.push(r.href);
  };

  return (
    // C1.2 — la surface réelle porte la cible du tour public `clonechat-entry`
    // (auparavant sur l'écran de lancement obsolète, désormais retiré).
    <main className="cs-page" data-tour-id="clonechat-entry">
      <HistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        conversations={chat.conversations}
        activeId={chat.conversationId}
        anonymous={chat.mode !== "authenticated"}
        onNew={() => { void chat.newConversation(); setHistoryOpen(false); }}
        onOpen={(id) => { void chat.openConversation(id); setHistoryOpen(false); }}
        onDelete={(id) => void chat.deleteConversation(id)}
      />
      <div className="cs-page-shell flex min-h-[70vh] flex-col gap-4">
        {/* Header — C1.5 : le sous-titre dit la VÉRITÉ (plus de « connecté à votre entreprise »
            affiché à un utilisateur qui n'a aucune entreprise active). */}
        <section data-tour-id="clonechat-header" className="cs-panel flex items-center justify-between gap-3 p-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="cc-brand-mark shrink-0">
              <Sparkles className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-[1.1rem] font-semibold tracking-[-0.03em] text-[var(--cs-ink-1)]">CloneChat</h1>
              <p className="truncate text-[0.8rem] text-[var(--cs-ink-4)]">
                {chat.modeLabel}
                {chat.mode === "authenticated" && chat.companyState === "active" ? " · connecté à votre entreprise" : ""}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {/* C1.8 P2 — L'historique existe pour TOUT LE MONDE : durable côté serveur pour un
                compte, local au navigateur pour un visiteur anonyme (et on le lui DIT).
                Auparavant le bouton n'apparaissait qu'avec une entreprise active : l'immense
                majorité des utilisateurs n'avait donc aucun historique visible. */}
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              aria-label="Ouvrir l'historique"
              className="cs-liquid-button lg:hidden"
              data-testid="history-open"
            >
              <MessageSquarePlus className="h-4 w-4" /><span className="hidden sm:inline">Historique</span>
            </button>
            <Link href="/agents/pierre/use" data-tour-id="clonechat-cockpit-link" className="cs-liquid-button">
              <Workflow className="h-4 w-4" /><span className="hidden sm:inline">Cockpit Pierre</span>
            </Link>
          </div>
        </section>

        {/* Fil */}
        {/* C1.8 P2 — Fil + HISTORIQUE côte à côte sur desktop. Le panneau reste discret
            (colonne étroite, aucun mur de boutons) et disparaît sous `lg`. */}
        <div className="flex min-h-0 flex-1 gap-4">
        <HistoryPanel
          conversations={chat.conversations}
          activeId={chat.conversationId}
          anonymous={chat.mode !== "authenticated"}
          onNew={() => void chat.newConversation()}
          onOpen={(id) => void chat.openConversation(id)}
          onDelete={(id) => void chat.deleteConversation(id)}
        />
        <div ref={threadRef} data-tour-id="clonechat-thread" className="cs-panel min-h-0 flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
          {chat.isEmpty ? (
            <Welcome companyState={chat.companyState} />
          ) : (
            chat.messages.map((m) => (
              <MessageRow
                key={m.id}
                message={m}
                onAction={onAction}
                onRetry={chat.retry}
                busy={chat.busy}
                onEdit={(id) => {
                  const r = chat.beginEdit(id);
                  if (r) { setDraft(r.text); clearAttachments(); } // l'utilisateur renvoie EXPLICITEMENT
                }}
              />
            ))
          )}
          {chat.busy ? (
            <div className="flex items-center gap-2 text-[0.84rem] text-[var(--cs-ink-4)]"><Loader2 className="h-4 w-4 animate-spin" /> CloneChat réfléchit…</div>
          ) : null}
        </div>
        </div>

        {/* Exemples */}
        {chat.isEmpty ? (
          <div className="flex flex-wrap gap-2">
            {examples.map((ex) => (
              <button key={ex} type="button" onClick={() => { setDraft(ex); }} className="cc-chip">
                {ex}
              </button>
            ))}
          </div>
        ) : null}

        {/* Composer — C1.5 §4C : intégré, premium, et TOUJOURS actif en mode découverte. */}
        <section
          data-tour-id="clonechat-input"
          className={cn("cc-composer", dragging && "cc-composer--drop")}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files); }}
          onPaste={(e) => {
            // Collage d'image depuis le presse-papiers (§10).
            const files = Array.from(e.clipboardData?.files ?? []);
            if (files.length > 0) { e.preventDefault(); addFiles(files); }
          }}
        >
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
          {/* C1.1 — Documents joints (nom + type + retrait avant envoi) */}
          {docs.length > 0 ? (
            <ul className="mb-2 flex flex-wrap gap-2" data-tour-id="clonechat-documents">
              {docs.map((d, i) => (
                <li key={`${d.filename}-${i}`} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--cs-line-soft)] bg-white/60 px-2 py-1 text-[0.75rem] text-[var(--cs-ink-3)]">
                  <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="max-w-[14rem] truncate" title={d.filename}>{d.filename}</span>
                  <span className="text-[var(--cs-ink-4)]">{formatBytes(d.sizeBytes)}</span>
                  <button type="button" aria-label={`Retirer le document ${d.filename}`} onClick={() => removeDoc(i)} className="inline-flex h-4 w-4 items-center justify-center rounded hover:bg-black/10">
                    <X className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {manifest.length > 0 ? (
            <div className="mb-2 space-y-1.5" data-tour-id="clonechat-manifest">
              <p className="px-1 text-[0.72rem] text-[var(--cs-ink-4)]">
                {summary.accepted} fichier{summary.accepted > 1 ? "s" : ""} prêt{summary.accepted > 1 ? "s" : ""} · {formatBytes(summary.totalBytes)}
                {summary.rejected > 0 ? ` · ${summary.rejected} écarté${summary.rejected > 1 ? "s" : ""}` : ""}
                {" — "}<span className="italic">rien n&apos;est envoyé tant que vous n&apos;envoyez pas le message.</span>
                {" "}<button type="button" onClick={clearAttachments} className="underline">Tout retirer</button>
              </p>
              <ul className="flex flex-wrap gap-1.5">
                {manifest.map((e) => (
                  <li key={e.id} className={cn("cc-chip inline-flex max-w-full items-center gap-1.5", e.state === "rejected" && "cc-chip--rejected")}>
                    {e.category === "image" ? <ImageIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                    <span className="max-w-[13rem] truncate" title={e.relativePath}>{e.relativePath}</span>
                    <span className="text-[var(--cs-ink-4)]">{formatBytes(e.size)}</span>
                    {/* Un refus est TOUJOURS visible et motivé — jamais un silence. */}
                    {e.rejection ? <span className="text-[var(--cs-danger)]" title={e.rejection.message}>· {e.rejection.message}</span> : null}
                    <button type="button" aria-label={`Retirer ${e.displayName}`} onClick={() => removeAttachment(e.id)} className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded hover:bg-black/10">
                      <X className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {attachError ? <p className="mb-1.5 px-1 text-[0.72rem] text-[var(--cs-danger)]" role="alert">{attachError}</p> : null}
          {dictation.state === "recording" ? (
            <p className="mb-1.5 px-1 text-[0.72rem] text-[var(--cs-ink-3)]" role="status">Enregistrement… — le texte sera inséré, jamais envoyé automatiquement.</p>
          ) : null}
          {dictation.state === "transcribing" ? (
            <p className="mb-1.5 px-1 text-[0.72rem] text-[var(--cs-ink-3)]" role="status">Transcription…</p>
          ) : null}
          {dictation.error ? (
            <p className="mb-1.5 flex items-center gap-2 px-1 text-[0.72rem] text-[var(--cs-danger)]" role="alert">
              {dictation.error.message}
              <button type="button" onClick={() => { dictation.reset(); void dictation.start(); }} className="underline">Réessayer la dictée</button>
            </p>
          ) : null}
          {undoDraft !== null && dictation.state === "idle" ? (
            <p className="mb-1.5 px-1 text-[0.72rem] text-[var(--cs-ink-4)]">
              Texte dicté inséré — relisez-le avant d'envoyer.{" "}
              <button type="button" onClick={() => { setDraft(undoDraft); setUndoDraft(null); }} className="underline">Annuler l'insertion</button>
            </p>
          ) : null}

          <div className="flex items-end gap-2">
            {/* C1.7 §10 — UN contrôle de pièce jointe, ouvert à TOUS (C1.6 : la conversation est
                universelle). Un anonyme peut discuter SES fichiers dans la session ; il n'obtient
                pour autant aucun stockage tenant, aucune récupération privée, aucune action. */}
            <input ref={filesRef} type="file" multiple className="hidden" aria-hidden="true" tabIndex={-1} onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
            <input ref={imagesRef} type="file" accept="image/*" multiple className="hidden" aria-hidden="true" tabIndex={-1} onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
            {/* Sélection de DOSSIER : amélioration progressive. Les navigateurs qui ne la
                supportent pas retombent naturellement sur une sélection multiple de fichiers. */}
            <input ref={folderRef} type="file" multiple className="hidden" aria-hidden="true" tabIndex={-1}
              {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
              onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
            <div ref={attachWrapRef} className="relative">
              <button ref={attachBtnRef} type="button" onClick={() => setAttachMenu((v) => !v)} disabled={chat.busy} aria-label="Ajouter des fichiers, des images ou un dossier" aria-haspopup="menu" aria-expanded={attachMenu} data-tour-id="clonechat-attach" className={cn("cs-liquid-button h-[46px]", chat.busy && "pointer-events-none opacity-60")}>
                <PaperclipIcon className="h-4 w-4" />
              </button>
              {attachMenu ? (
                // P17 — on ferme le menu AVANT d'ouvrir la boîte de dialogue native : annuler le
                // dialogue (onChange jamais émis) ne laisse plus le menu ouvert.
                <div role="menu" className="cc-attach-menu">
                  <button type="button" role="menuitem" onClick={() => { setAttachMenu(false); filesRef.current?.click(); }}><FileText className="h-4 w-4" /> Ajouter des fichiers</button>
                  <button type="button" role="menuitem" onClick={() => { setAttachMenu(false); imagesRef.current?.click(); }}><ImageIcon className="h-4 w-4" /> Ajouter des images</button>
                  <button type="button" role="menuitem" onClick={() => { setAttachMenu(false); folderRef.current?.click(); }}><FolderOpen className="h-4 w-4" /> Ajouter un dossier</button>
                </div>
              ) : null}
            </div>
            {/* C1.7 §8A — Micro : disponible pour TOUS (dicter, c'est parler). Aucun compte,
                aucune entreprise, aucun droit Pierre requis — doctrine C1.6 préservée.
                C1.8 : `micAvailable` (et non `dictation.supported`) — la capacité micro n'est
                connue qu'APRÈS montage ; s'en servir au premier rendu cassait l'hydratation. */}
            {micAvailable ? (
              dictation.state === "recording" ? (
                <div className="flex items-center gap-1" data-tour-id="clonechat-recording">
                  <button type="button" onClick={dictation.stop} aria-label="Arrêter la dictée" className="cs-liquid-button cs-liquid-button--primary h-[46px]">
                    <SquareIcon className="h-4 w-4" />
                    <span className="tabular-nums text-[0.78rem]">{formatSeconds(dictation.seconds)}</span>
                    <span aria-hidden="true" className="ml-1 inline-block h-3 w-1 rounded-full bg-white/80" style={{ transform: `scaleY(${0.4 + dictation.level * 1.6})` }} />
                  </button>
                  <button type="button" onClick={dictation.cancel} aria-label="Annuler la dictée" className="cs-liquid-button h-[46px]">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => void dictation.start()}
                  disabled={chat.busy || dictation.state === "transcribing" || dictation.state === "requesting_permission"}
                  aria-label="Dicter"
                  title="Dicter"
                  data-tour-id="clonechat-mic"
                  className={cn("cs-liquid-button h-[46px]", (chat.busy || dictation.state === "transcribing") && "pointer-events-none opacity-60")}
                >
                  {dictation.state === "transcribing" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
                </button>
              )
            ) : null}
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
              rows={1}
              // C1.8 FINAL §9 — UN SEUL texte d'invite, court, identique dans tous les modes.
              // L'invite variable listait les capacités (« missions, validations, salariés… ») :
              // c'était de la documentation dans un champ de saisie. Ce qu'il faut expliquer se dit
              // AUTOUR du composeur, pas DEDANS.
              placeholder="Posez une question"
              aria-label="Message pour CloneChat"
              disabled={chat.busy}
              className="max-h-40 min-h-[46px] flex-1 resize-none px-3 py-3 text-[0.9rem] leading-6"
            />
            {chat.busy ? (
              <button type="button" onClick={chat.stop} aria-label="Interrompre" className="cs-liquid-button h-[46px]">
                <Square className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={submit}
                disabled={draft.trim().length === 0 && attachCount === 0}
                aria-label="Envoyer"
                className={cn("cs-liquid-button cs-liquid-button--primary h-[46px]", (draft.trim().length === 0 && attachCount === 0) && "pointer-events-none opacity-60")}
              >
                <Send className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-2 px-1">
            <p className="text-[0.72rem] text-[var(--cs-ink-4)]">
              {chat.companyState === "active"
                ? "Rien de sensible n'est exécuté sans votre confirmation."
                : "Aucune donnée d'entreprise n'est consultée sans contexte vérifié."}
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

/** Lecture d'un fichier : data URL (images, pipeline existant) ou base64 nu (documents). */
async function readAs(file: File, kind: "dataUrl" | "base64"): Promise<string | null> {
  const dataUrl = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(new Error("read"));
    r.readAsDataURL(file);
  }).catch(() => null);
  if (!dataUrl) return null;
  if (kind === "dataUrl") return dataUrl;
  const comma = dataUrl.indexOf(",");
  return comma >= 0 ? dataUrl.slice(comma + 1) : null;
}

function formatSeconds(n: number): string {
  const m = Math.floor(n / 60), s = n % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} Ko`;
  return `${(n / (1024 * 1024)).toFixed(1)} Mo`;
}

function Welcome({ companyState }: { companyState: CloneChatCompanyState }) {
  return (
    <div className="mx-auto max-w-lg py-8 text-center">
      <div className="cc-brand-mark mx-auto mb-3 h-12 w-12"><Sparkles className="h-6 w-6" /></div>
      <p className="text-[1.05rem] font-semibold text-[var(--cs-ink-1)]">Bonjour, je suis CloneChat.</p>
      {/* C1.6 §5 — MÊME accueil, MÊME identité pour tous. Aucune invitation à se connecter
          pour avoir le droit de parler : on annonce ce qu'on sait faire, tout de suite. */}
      <p className="mt-2 text-[0.88rem] leading-6 text-[var(--cs-ink-3)]">
        {companyState === "active"
          ? "Je connais votre espace : je peux résumer l'activité de Pierre, retrouver vos missions, salariés et documents, expliquer vos validations et préparer une action — avec votre confirmation."
          : "Posez-moi vos questions sur CloneStore, Pierre, les prix ou vos sujets RH — je réponds tout de suite. Avec une entreprise active, je travaille en plus sur vos données réelles."}
      </p>
    </div>
  );
}

function MessageRow({ message, onAction, onRetry, busy, onEdit }: { message: CloneChatMessage; onAction: (a: CloneChatProposedAction) => void; onRetry?: () => void; busy: boolean; onEdit?: (id: string) => void }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
      <span className={cn("mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full", isUser ? "cc-avatar-user" : "cc-avatar-assistant")}>
        {isUser ? <UserRound className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </span>
      <div className={cn("cc-msg-col min-w-0 max-w-[85%] space-y-2", isUser && "text-right")}>
        {message.content.map((b, i) => <BlockView key={i} block={b} onAction={onAction} onRetry={onRetry} busy={busy} isUser={isUser} />)}
        {/* C1.7 §13 — Modifier : le message ET tout ce qui suit sont retirés (aucune approbation
            ni proposition antérieure ne peut être recyclée). Rien n'est renvoyé automatiquement. */}
        {isUser && onEdit && !busy ? (
          <button type="button" onClick={() => onEdit(message.id)} className="text-[0.72rem] text-[var(--cs-ink-4)] underline hover:text-[var(--cs-ink-2)]">
            Modifier
          </button>
        ) : null}
      </div>
    </div>
  );
}

function BlockView({ block, onAction, onRetry, busy, isUser }: { block: CloneChatContentBlock; onAction: (a: CloneChatProposedAction) => void; onRetry?: () => void; busy: boolean; isUser: boolean }) {
  switch (block.type) {
    // C1.5 §4A/B — Le violet vif est SUPPRIMÉ. Bulle utilisateur = dégradé sombre CloneStore
    // (graphite → bleu nuit, halo bleu discret), bulle assistant = surface claire secondaire.
    case "text":
      return (
        <div className={cn("inline-block px-3.5 py-2 text-left text-[0.9rem] leading-6", isUser ? "cc-bubble-user" : "cc-bubble-assistant")}>
          {/* C1.8 FINAL §7 — Les routes CloneStore deviennent de VRAIS liens cliquables.
              Le message de l'utilisateur, lui, reste du texte brut : on ne transforme jamais
              ce que l'utilisateur a tapé en lien (ce serait lui prêter une intention). */}
          {isUser ? block.text : <SafeText text={block.text} />}
        </div>
      );
    case "boundary":
      return <p className="text-[0.72rem] italic text-[var(--cs-ink-4)]">{block.text}</p>;
    case "mission":
      return (
        <Link href={`/agents/pierre/use?view=missions&mission=${encodeURIComponent(block.mission.id)}`} className="cs-card cs-card-tight cs-hover-lift block text-left">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 min-w-0"><Workflow className="h-4 w-4 shrink-0 text-[var(--cs-ink-3)]" /><span className="truncate text-[0.86rem] font-medium text-[var(--cs-ink-1)]">{block.mission.title}</span></span>
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
          <span className="flex items-center gap-2"><UserRound className="h-4 w-4 text-[var(--cs-ink-3)]" /><span className="text-[0.86rem] font-medium text-[var(--cs-ink-1)]">{block.employee.name}</span><span className="text-[0.76rem] text-[var(--cs-ink-4)]">{block.employee.role ?? ""}</span></span>
        </Link>
      );
    case "document":
      return (
        <div className="cs-card cs-card-tight text-left">
          <span className="flex items-center gap-2"><FileText className="h-4 w-4 text-[var(--cs-ink-3)]" /><span className="text-[0.86rem] font-medium text-[var(--cs-ink-1)]">{block.document.title}</span><StatusChip view={block.document.statusView} /></span>
        </div>
      );
    case "action_preview": {
      const a = block.action;
      return (
        <div className="cs-card cs-card-tight border-l-4 border-l-[var(--cs-blue)] text-left">
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
              ) : r.kind === "retry" && onRetry ? (
                // P17 — la récup « retry » n'a PAS de href (ce n'est pas une navigation) : elle était
                // rendue en <span> INERTE. On la câble au vrai `retry()` du hook (bouton cliquable).
                <button key={r.kind} type="button" onClick={onRetry} disabled={busy} className={cn("cs-liquid-button", busy && "pointer-events-none opacity-60")}>
                  <RotateCcw className="h-3.5 w-3.5" /> {r.label}
                </button>
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

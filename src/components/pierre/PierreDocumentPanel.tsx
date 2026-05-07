"use client";

import React, { useMemo } from "react";

type DocumentRecord = {
  id?: string | null;
  mission_id?: string | null;
  task_id?: string | null;
  title?: string | null;
  doc_type?: string | null;
  status?: string | null;
  text_content?: string | null;
  html_content?: string | null;
  content?: unknown;
  metadata?: unknown;
  created_at?: string | null;
  updated_at?: string | null;
  filename?: string | null;
  [key: string]: unknown;
};

export type PierreDocumentPanelProps = {
  documents?: DocumentRecord[];
  selectedDocumentId?: string | null;
  onSelectDocument?: (documentId: string) => void;
  missionId?: string | null;
};

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function formatDate(value?: string | null) {
  if (!value) return "â€”";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "â€”";

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function inferTitle(document: DocumentRecord) {
  return (
    asString(document.title) ||
    asString(document.filename) ||
    (isObject(document.metadata) ? asString(document.metadata.title) : null) ||
    "Document sans titre"
  );
}

function inferDocType(document: DocumentRecord) {
  return (
    asString(document.doc_type) ||
    (isObject(document.metadata) ? asString(document.metadata.doc_type) : null) ||
    "document_rh"
  );
}

function inferStatus(document: DocumentRecord) {
  return asString(document.status) || "unknown";
}

function inferPlainText(document: DocumentRecord) {
  if (asString(document.text_content)) return asString(document.text_content) as string;

  if (typeof document.content === "string" && document.content.trim()) {
    return document.content.trim();
  }

  if (isObject(document.content)) {
    return (
      asString(document.content.text) ||
      asString(document.content.body) ||
      asString(document.content.content) ||
      asString(document.content.final_text) ||
      asString(document.content.final_text_html) ||
      null
    );
  }

  if (isObject(document.metadata)) {
    return (
      asString(document.metadata.preview) ||
      asString(document.metadata.summary) ||
      null
    );
  }

  return null;
}

function inferHtml(document: DocumentRecord) {
  if (asString(document.html_content)) return asString(document.html_content);
  if (isObject(document.content)) {
    return (
      asString(document.content.html) ||
      asString(document.content.body_html) ||
      asString(document.content.final_text_html) ||
      null
    );
  }
  return null;
}

function inferPreview(document: DocumentRecord) {
  const plainText = inferPlainText(document);
  if (plainText) return plainText;

  const html = inferHtml(document);
  if (html) {
    return html
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  return "Aucun aperÃ§u disponible.";
}

function normalizeTypeLabel(type: string) {
  const value = type.toLowerCase();

  if (value.includes("offer") || value.includes("offre")) return "Offre dâ€™emploi";
  if (value.includes("convocation")) return "Convocation";
  if (value.includes("refus")) return "Refus";
  if (value.includes("relance")) return "Relance";
  if (value.includes("onboarding")) return "Onboarding";
  if (value.includes("note")) return "Note RH";
  if (value.includes("courrier")) return "Courrier RH";
  if (value.includes("compte")) return "Compte rendu";
  if (value.includes("procedure")) return "ProcÃ©dure";
  return "Document RH";
}

function statusTone(status: string) {
  const value = status.toLowerCase();

  if (value === "ready" || value === "completed" || value === "generated") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
  if (value === "draft" || value === "pending") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }
  if (value === "failed" || value === "blocked" || value === "error") {
    return "border-rose-200 bg-rose-50 text-rose-800";
  }

  return "border-stone-200 bg-stone-100 text-stone-700";
}

function buildRenderedHtml(document: DocumentRecord) {
  const html = inferHtml(document);
  if (html) return html;

  const plainText = inferPlainText(document);
  if (!plainText) return null;

  const escaped = plainText
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n{2,}/g, "</p><p>")
    .replace(/\n/g, "<br />");

  return `<p>${escaped}</p>`;
}

function SmallMeta({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-[20px] border border-stone-200 bg-[#fcfaf6] px-4 py-4">
      <div className="text-[11px] uppercase tracking-[0.16em] text-stone-500">{label}</div>
      <div className="mt-2 text-sm font-medium text-stone-900">{value}</div>
    </div>
  );
}

function Pill({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "good" | "warn" | "critical";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em]",
        tone === "good"
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : tone === "warn"
            ? "border-amber-200 bg-amber-50 text-amber-800"
            : tone === "critical"
              ? "border-rose-200 bg-rose-50 text-rose-800"
              : "border-stone-200 bg-stone-100 text-stone-700",
      )}
    >
      {children}
    </span>
  );
}

export default function PierreDocumentPanel({
  documents = [],
  selectedDocumentId = null,
  onSelectDocument,
  missionId = null,
}: PierreDocumentPanelProps) {
  const sortedDocuments = useMemo(() => {
    return [...documents].sort((a, b) => {
      const left = new Date(a.updated_at || a.created_at || 0).getTime();
      const right = new Date(b.updated_at || b.created_at || 0).getTime();
      return right - left;
    });
  }, [documents]);

  const selectedDocument = useMemo(() => {
    if (selectedDocumentId) {
      const found = sortedDocuments.find((document) => asString(document.id) === selectedDocumentId);
      if (found) return found;
    }
    return sortedDocuments[0] || null;
  }, [selectedDocumentId, sortedDocuments]);

  const renderedHtml = useMemo(
    () => (selectedDocument ? buildRenderedHtml(selectedDocument) : null),
    [selectedDocument],
  );

  const selectedType = selectedDocument ? inferDocType(selectedDocument) : null;
  const selectedStatus = selectedDocument ? inferStatus(selectedDocument) : null;
  const selectedPreview = selectedDocument ? inferPreview(selectedDocument) : null;

  return (
    <section className="rounded-[32px] border border-stone-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(250,246,239,0.96))] p-5 shadow-[0_16px_48px_rgba(28,25,23,0.06)]">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-[980px]">
            <div className="text-[11px] uppercase tracking-[0.22em] text-stone-500">Documents Pierre</div>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-stone-950">
              Lecture premium des livrables RH
            </h2>
            <p className="mt-3 text-sm leading-7 text-stone-600">
              Ce panneau doit permettre de parcourir, sÃ©lectionner et lire proprement les documents gÃ©nÃ©rÃ©s
              par Pierre, avec une sensation de cockpit haut de gamme et non dâ€™outil SaaS bricolÃ©.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Pill>{documents.length} document(s)</Pill>
              {missionId ? <Pill>Mission liÃ©e</Pill> : <Pill>Aucun filtre mission</Pill>}
              {selectedDocument ? (
                <Pill tone={selectedStatus?.toLowerCase() === "failed" ? "critical" : selectedStatus?.toLowerCase() === "draft" ? "warn" : "good"}>
                  {selectedStatus}
                </Pill>
              ) : null}
            </div>
          </div>

          <div className="w-full max-w-[420px] rounded-[26px] border border-stone-200 bg-white/85 p-5">
            <div className="text-[11px] uppercase tracking-[0.18em] text-stone-500">Document sÃ©lectionnÃ©</div>
            <div className="mt-3 text-lg font-semibold text-stone-900">
              {selectedDocument ? inferTitle(selectedDocument) : "Aucun document"}
            </div>
            <div className="mt-3 text-sm leading-7 text-stone-700">
              {selectedDocument
                ? "Le livrable sÃ©lectionnÃ© est affichÃ© avec sa structure, son contexte, son statut et un rendu lisible orientÃ© usage rÃ©el."
                : "Aucun document nâ€™est actuellement disponible dans cette vue."}
            </div>
          </div>
        </div>

        <div className="grid gap-6 2xl:grid-cols-[0.92fr_1.38fr]">
          <div className="rounded-[28px] border border-stone-200 bg-white/85 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-stone-500">Liste des documents</div>
                <div className="mt-2 text-lg font-semibold text-stone-900">BibliothÃ¨que de livrables</div>
              </div>
              <Pill>{sortedDocuments.length}</Pill>
            </div>

            <div className="mt-4 space-y-3">
              {sortedDocuments.length === 0 ? (
                <div className="rounded-[22px] border border-dashed border-stone-200 bg-[#fcfaf6] px-4 py-8 text-sm text-stone-500">
                  Aucun document disponible pour le moment.
                </div>
              ) : (
                sortedDocuments.map((document, index) => {
                  const id = asString(document.id) || `document-${index}`;
                  const active = selectedDocument && asString(selectedDocument.id) === id;
                  const title = inferTitle(document);
                  const type = inferDocType(document);
                  const status = inferStatus(document);
                  const preview = inferPreview(document);

                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => onSelectDocument?.(id)}
                      className={cn(
                        "w-full rounded-[24px] border px-4 py-4 text-left transition",
                        active
                          ? "border-stone-900 bg-stone-900 text-stone-50 shadow-[0_12px_40px_rgba(28,25,23,0.16)]"
                          : "border-stone-200 bg-[#fcfaf6] text-stone-800 hover:border-stone-300 hover:bg-white",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={cn(
                                "inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
                                active
                                  ? "border-white/15 bg-white/10 text-stone-100"
                                  : "border-stone-200 bg-stone-100 text-stone-700",
                              )}
                            >
                              {normalizeTypeLabel(type)}
                            </span>
                            <span
                              className={cn(
                                "inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
                                active ? "border-white/15 bg-white/10 text-stone-100" : statusTone(status),
                              )}
                            >
                              {status}
                            </span>
                          </div>

                          <div className="mt-3 truncate text-sm font-semibold">{title}</div>
                          <div className={cn("mt-2 line-clamp-3 text-xs leading-6", active ? "text-stone-300" : "text-stone-500")}>
                            {preview}
                          </div>
                        </div>

                        <div className={cn("shrink-0 text-[11px]", active ? "text-stone-300" : "text-stone-400")}>
                          {formatDate(document.updated_at || document.created_at || null)}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="grid gap-6">
            <div className="rounded-[28px] border border-stone-200 bg-white/85 p-5">
              {!selectedDocument ? (
                <div className="flex min-h-[420px] items-center justify-center rounded-[24px] border border-dashed border-stone-200 bg-[#fcfaf6] text-sm text-stone-500">
                  SÃ©lectionne un document pour afficher son contenu.
                </div>
              ) : (
                <div className="flex flex-col gap-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="max-w-[900px]">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-stone-500">Document actif</div>
                      <h3 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">
                        {inferTitle(selectedDocument)}
                      </h3>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Pill>{normalizeTypeLabel(selectedType || "document_rh")}</Pill>
                        <Pill
                          tone={
                            (selectedStatus || "").toLowerCase() === "failed"
                              ? "critical"
                              : (selectedStatus || "").toLowerCase() === "draft"
                                ? "warn"
                                : "good"
                          }
                        >
                          {selectedStatus}
                        </Pill>
                      </div>
                    </div>

                    <div className="grid min-w-[260px] gap-2 text-right text-xs text-stone-500">
                      <div>CrÃ©Ã© : {formatDate(selectedDocument.created_at || null)}</div>
                      <div>Mise Ã  jour : {formatDate(selectedDocument.updated_at || selectedDocument.created_at || null)}</div>
                      <div>Mission : {asString(selectedDocument.mission_id) || "â€”"}</div>
                      <div>TÃ¢che : {asString(selectedDocument.task_id) || "â€”"}</div>
                    </div>
                  </div>

                  <div className="grid gap-3 xl:grid-cols-4">
                    <SmallMeta label="Type" value={normalizeTypeLabel(selectedType || "document_rh")} />
                    <SmallMeta label="Statut" value={selectedStatus || "unknown"} />
                    <SmallMeta label="Mission liÃ©e" value={asString(selectedDocument.mission_id) || "â€”"} />
                    <SmallMeta label="TÃ¢che liÃ©e" value={asString(selectedDocument.task_id) || "â€”"} />
                  </div>

                  <div className="rounded-[24px] border border-stone-200 bg-[#fcfaf6] px-5 py-5">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-stone-500">AperÃ§u texte</div>
                    <div className="mt-3 whitespace-pre-wrap text-sm leading-7 text-stone-700">
                      {selectedPreview}
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-stone-200 bg-white px-5 py-5 shadow-[0_10px_30px_rgba(28,25,23,0.04)]">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-stone-500">Rendu document</div>
                    <div className="mt-4 min-h-[420px] rounded-[20px] border border-stone-200 bg-[#fffdf9] p-6">
                      {renderedHtml ? (
                        <div
                          className="prose prose-stone max-w-none prose-p:leading-7 prose-headings:text-stone-900 prose-p:text-stone-700 prose-li:text-stone-700"
                          dangerouslySetInnerHTML={{ __html: renderedHtml }}
                        />
                      ) : (
                        <div className="text-sm text-stone-500">Aucun rendu disponible.</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {selectedDocument && isObject(selectedDocument.metadata) ? (
              <div className="rounded-[28px] border border-stone-200 bg-white/85 p-5">
                <div className="text-[11px] uppercase tracking-[0.18em] text-stone-500">MÃ©tadonnÃ©es utiles</div>
                <div className="mt-4 rounded-[24px] border border-stone-200 bg-[#fcfaf6] p-5">
                  <pre className="whitespace-pre-wrap break-words text-sm leading-7 text-stone-700">
                    {JSON.stringify(selectedDocument.metadata, null, 2)}
                  </pre>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
export { PierreDocumentPanel };


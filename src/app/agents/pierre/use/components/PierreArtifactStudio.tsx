// src/app/agents/pierre/use/components/PierreArtifactStudio.tsx
// Unified docs / emails / PDF view — Pierre Cockpit B31.

import * as React from "react";
import { FileDown, FileText, Mail } from "lucide-react";
import type {
  PierreCockpitDocumentSummary,
} from "@/lib/pierre/cockpit/types";
import { StatusBadge, RiskBadge, ValidationRequiredBadge } from "./PierreStatusBadges";
import { EmptyState } from "./PierreEmptyStates";
import { cn } from "@/lib/utils";

type ArtifactTab = "documents" | "emails" | "pdf";

function DocumentCard({ doc }: { doc: PierreCockpitDocumentSummary }) {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: "var(--cs-surface-strong)",
        border: "1px solid var(--cs-line)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate" style={{ color: "var(--cs-ink-1)" }}>
            {doc.title}
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--cs-ink-4)" }}>
            {doc.docType}
            {doc.createdAt && ` · ${new Date(doc.createdAt).toLocaleDateString("fr-FR")}`}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <StatusBadge status={doc.status} />
          {doc.qualityScore !== null && (
            <span
              className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
              style={{
                background: doc.qualityScore >= 80
                  ? "var(--cs-success-bg)"
                  : doc.qualityScore >= 50
                  ? "var(--cs-warn-bg)"
                  : "var(--cs-danger-bg)",
                color: doc.qualityScore >= 80
                  ? "var(--cs-success)"
                  : doc.qualityScore >= 50
                  ? "var(--cs-warn)"
                  : "var(--cs-danger)",
              }}
            >
              Qualité {doc.qualityScore}%
            </span>
          )}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {doc.riskLevel !== "low" && <RiskBadge level={doc.riskLevel} />}
        {doc.requiresValidation && <ValidationRequiredBadge />}
        {doc.isPdf && (
          <span
            className="text-[11px] px-2 py-0.5 rounded-full font-medium"
            style={{ background: "var(--cs-blue-soft)", color: "var(--cs-blue)" }}
          >
            PDF
          </span>
        )}
      </div>

      {doc.contentText && (
        <>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="mt-2 text-xs font-medium transition-opacity hover:opacity-70"
            style={{ color: "var(--cs-blue)" }}
            aria-expanded={expanded}
          >
            {expanded ? "Masquer le contenu" : "Voir le contenu"}
          </button>
          {expanded && (
            <pre
              className="mt-2 whitespace-pre-wrap rounded-lg px-3 py-2 text-xs leading-relaxed overflow-auto max-h-64"
              style={{
                background: "var(--cs-bg-2)",
                color: "var(--cs-ink-2)",
                fontFamily: "ui-monospace, monospace",
              }}
            >
              {doc.contentText}
            </pre>
          )}
        </>
      )}
    </div>
  );
}

export function PierreArtifactStudio({
  documents,
}: {
  documents: PierreCockpitDocumentSummary[];
}) {
  const [activeTab, setActiveTab] = React.useState<ArtifactTab>("documents");

  const docs    = documents.filter((d) => !d.isPdf && d.docType !== "email");
  const emails  = documents.filter((d) => d.docType === "email");
  const pdfs    = documents.filter((d) => d.isPdf);

  const tabData: { id: ArtifactTab; label: string; count: number }[] = [
    { id: "documents", label: "Documents", count: docs.length },
    { id: "emails",    label: "Emails",    count: emails.length },
    { id: "pdf",       label: "PDF",       count: pdfs.length },
  ];

  const active =
    activeTab === "documents" ? docs :
    activeTab === "emails"    ? emails :
    pdfs;

  return (
    <div className="flex flex-col gap-4">
      {/* Tab bar */}
      <div
        className="flex gap-1 rounded-xl p-1"
        style={{ background: "var(--cs-bg-2)" }}
        role="tablist"
      >
        {tabData.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all",
              activeTab === tab.id
                ? "shadow-sm"
                : "opacity-60 hover:opacity-80",
            )}
            style={
              activeTab === tab.id
                ? { background: "var(--cs-surface-strong)", color: "var(--cs-ink-1)" }
                : { color: "var(--cs-ink-3)" }
            }
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="ml-1 opacity-70">({tab.count})</span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {active.length === 0 ? (
        <EmptyState
          icon={
            activeTab === "emails" ? <Mail className="h-5 w-5" /> :
            activeTab === "pdf"    ? <FileDown className="h-5 w-5" /> :
            <FileText className="h-5 w-5" />
          }
          title={`Aucun ${activeTab === "emails" ? "email" : activeTab === "pdf" ? "PDF" : "document"}`}
          subtitle="Pierre génèrera les artéfacts lors de l'exécution de la mission."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {active.map((doc) => (
            <DocumentCard key={doc.id} doc={doc} />
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

// PIERRE COCKPIT — presentational panels for the three zones.
// Pure, data-driven from the scenario. No side effects, no personal data leaks.
// Reuses the shared status/chip primitives so every surface stays consistent.

import type { ReactNode } from "react";
import {
  Inbox, Mail, StickyNote, FolderOpen, MessageSquare, AlertTriangle, Lock,
  CalendarClock, FileText, ArrowRight, Bot, UserCheck,
} from "lucide-react";
import type {
  DemoScenario, DemoIncomingRequest, DemoWeekEvent, RoleSplit as RoleSplitData,
} from "@/lib/pierre/demo";
import { Chip } from "../parts";

const TONE_COLOR: Record<DemoWeekEvent["tone"], string> = {
  ok: "var(--pd-ok)",
  warn: "var(--pd-warn)",
  block: "var(--pd-block)",
  info: "var(--pd-cool)",
};

const CHANNEL: Record<DemoIncomingRequest["channel"], { label: string; Icon: typeof Mail }> = {
  message: { label: "Message", Icon: MessageSquare },
  email: { label: "Email", Icon: Mail },
  note: { label: "Note", Icon: StickyNote },
  rh: { label: "Dossier", Icon: FolderOpen },
};

export function PanelTitle({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <div className="pdc-panel__head">
      {icon}
      <span className="pdc-panel__title">{children}</span>
    </div>
  );
}

export function LockedPanel({ children }: { children: ReactNode }) {
  return (
    <div className="pdc-locked">
      <Lock className="h-3.5 w-3.5" aria-hidden style={{ flex: "none" }} />
      <span>{children}</span>
    </div>
  );
}

// ── Left zone ────────────────────────────────────────────────────────────────
export function IncomingRequests({ scenario }: { scenario: DemoScenario }) {
  const items = scenario.incoming ?? [];
  return (
    <div className="pdc-panel">
      <PanelTitle icon={<Inbox className="h-4 w-4" aria-hidden style={{ color: "var(--pd-ink-3)" }} />}>
        Ce qui est arrivé cette semaine
      </PanelTitle>
      <div style={{ display: "grid", gap: 8 }}>
        {items.map((r) => {
          const chan = CHANNEL[r.channel];
          return (
            <div key={r.id} className="pdc-req">
              <div className="pdc-req__top">
                <span className={`pdc-req__dot pdc-req__dot--${r.urgency}`} aria-hidden />
                <span className="pdc-req__from">{r.from}</span>
                <span className="pdc-req__chan">
                  <chan.Icon className="h-3 w-3" aria-hidden style={{ verticalAlign: "-2px", marginRight: 3 }} />
                  {chan.label}
                </span>
              </div>
              <p className="pdc-req__text">{r.text}</p>
            </div>
          );
        })}
      </div>
      <p className="pdc-note" style={{ marginTop: 10 }}>
        Une semaine RH ne commence pas par une tâche bien formulée. Elle commence par plusieurs demandes dispersées.
      </p>
    </div>
  );
}

export function ContextGaps({ scenario }: { scenario: DemoScenario }) {
  const { context } = scenario;
  return (
    <div className="pdc-panel">
      <PanelTitle icon={<FolderOpen className="h-4 w-4" aria-hidden style={{ color: "var(--pd-ink-3)" }} />}>
        Ce que Pierre retrouve — {context.subject}
      </PanelTitle>
      <dl className="pdc-ctx">
        {context.rows.map((row) => (
          <div key={row.label} className="pdc-ctx__row">
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
      {context.missing.length > 0 ? (
        <div className="pdc-missing">
          <AlertTriangle className="h-4 w-4" aria-hidden style={{ flex: "none", color: "var(--pd-block)", marginTop: 1 }} />
          <span>
            <strong>Information manquante&nbsp;:</strong> {context.missing.join(", ")}. Pierre la signale —
            il ne l&apos;invente jamais.
          </span>
        </div>
      ) : null}
    </div>
  );
}

// ── Center zone ──────────────────────────────────────────────────────────────
export function WeekContinuity({ scenario }: { scenario: DemoScenario }) {
  const items = scenario.week ?? [];
  return (
    <div className="pdc-panel">
      <PanelTitle icon={<CalendarClock className="h-4 w-4" aria-hidden style={{ color: "var(--pd-cool)" }} />}>
        Plus tard dans la semaine
      </PanelTitle>
      <div className="pdc-week">
        {items.map((e) => (
          <div key={e.id} className="pdc-week__row">
            <div className="pdc-week__when">
              <div className="pdc-week__day">{e.day}</div>
              <div className="pdc-week__time">{e.time}</div>
            </div>
            <div>
              <div className="pdc-week__label">
                <span className="pdc-week__dot" style={{ background: TONE_COLOR[e.tone] }} aria-hidden />
                {e.label}
              </div>
              {e.detail ? <div className="pdc-week__detail">{e.detail}</div> : null}
              <div style={{ marginTop: 5 }}>
                <span style={{ fontSize: "0.66rem", color: "var(--pd-ink-4)", fontWeight: 700 }}>{e.actor}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="pdc-note" style={{ marginTop: 10 }}>
        Pierre ne s&apos;arrête pas après avoir répondu&nbsp;: il garde la mission active, attend, relance et reprend
        jusqu&apos;au résultat.
      </p>
    </div>
  );
}

// ── Right zone ───────────────────────────────────────────────────────────────
export function DeliverablesList({
  scenario,
  onOpen,
}: {
  scenario: DemoScenario;
  onOpen: (docId: string) => void;
}) {
  return (
    <div className="pdc-panel">
      <PanelTitle icon={<FileText className="h-4 w-4" aria-hidden style={{ color: "var(--pd-cool)" }} />}>
        Livrables préparés
      </PanelTitle>
      <div style={{ display: "grid", gap: 8 }}>
        {scenario.documents.map((d) => (
          <button
            key={d.id}
            type="button"
            className="pdc-req pdc-deliv"
            onClick={() => onOpen(d.id)}
            data-step-id={`cockpit-doc:${d.id}`}
          >
            <div className="pdc-deliv__top">
              <FileText className="h-4 w-4 pdc-deliv__ico" aria-hidden />
              <span className="pdc-deliv__title">{d.title}</span>
              <ArrowRight className="h-3.5 w-3.5 pdc-deliv__badge" aria-hidden style={{ color: "var(--pd-ink-4)" }} />
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <Chip variant="warn">{d.badge}</Chip>
            </div>
          </button>
        ))}
      </div>
      <p className="pdc-note" style={{ marginTop: 10 }}>
        <Lock className="h-3.5 w-3.5" aria-hidden style={{ flex: "none", marginTop: 1 }} />
        Documents de démonstration — ouvrables, mais aucun fichier réel ni donnée privée.
      </p>
    </div>
  );
}

// ── Bilan (right) ────────────────────────────────────────────────────────────
export function RoleSplit({ data }: { data: RoleSplitData }) {
  return (
    <div className="pdc-panel">
      <PanelTitle>Qui fait quoi</PanelTitle>
      <div className="pdc-roles">
        <div className="pdc-role pdc-role--pierre">
          <div className="pdc-role__h">
            <Bot className="h-4 w-4" aria-hidden style={{ color: "var(--pd-cool)" }} /> Pierre a pris en charge
          </div>
          <ul>
            {data.pierre.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
        <div className="pdc-role pdc-role--human">
          <div className="pdc-role__h">
            <UserCheck className="h-4 w-4" aria-hidden style={{ color: "var(--pd-ink-2)" }} /> Votre équipe a conservé
          </div>
          <ul>
            {data.humans.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

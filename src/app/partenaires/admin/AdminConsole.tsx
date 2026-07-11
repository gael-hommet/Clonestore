"use client";

// Programme partenaires — console d'administration (client). Lit /api/partners/admin/overview
// et pilote /api/partners/admin/action (même session admin, credentials same-origin).
// Toute action sensible EXIGE une raison saisie (le submit est bloqué si vide) sauf le
// dry-run de versement. L'overview est rechargé après chaque action.

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatMinorAmount } from "@/lib/partner-program/money";
import styles from "./admin-console.module.css";

// ————————————————————————————————————————————————————————————————
// Types du contrat d'API (overview)
// ————————————————————————————————————————————————————————————————

type Application = {
  id: string;
  cabinetName: string;
  email: string;
  country: string;
  cabinetType: string;
  status: string;
  createdAt: string;
};

type Partner = {
  id: string;
  displayName: string;
  publicSlug: string;
  status: string;
  stripeOnboardingStatus: string;
  payoutsEnabled: boolean;
  activatedAt: string | null;
};

type Introduction = {
  id: string;
  partnerId: string;
  companyName: string;
  status: string;
  submittedAt: string;
};

type RiskFlag = {
  id: string;
  partnerId: string;
  kind: string;
  severity: string;
  explanation: string;
  status: string;
  createdAt: string;
};

type PayoutRun = {
  id: string;
  runKey: string;
  dryRun: boolean;
  status: string;
  partnersConsidered: number;
  transfersCreated: number;
  totalAmountMinor: number;
  startedAt: string;
};

// Les sommes du ledger arrivent en chaîne (sum SQL) ; on les normalise en nombre.
type LedgerRaw = { gross: string | number; reversals: string | number; paid: string | number; frozen: string | number };

type Overview = {
  applications: Application[];
  partners: Partner[];
  introductions: Introduction[];
  riskFlags: RiskFlag[];
  payoutRuns: PayoutRun[];
  ledger: LedgerRaw;
};

type PayoutResult = {
  periodKey: string;
  dryRun: boolean;
  partnersConsidered: number;
  transfersCreated: number;
  totalAmountMinor: number;
  perPartner: Array<{ partnerId: string; amountMinor: number; status: string; reason?: string }>;
};

type RiskStatus = "confirmed" | "dismissed" | "reviewed_ok";

// Action confirmable via le dialogue (raison obligatoire).
type ConfirmAction = {
  action:
    | "review_application"
    | "accept_application"
    | "reject_application"
    | "validate_introduction"
    | "reject_introduction"
    | "suspend_partner"
    | "reinstate_partner"
    | "activate_partner"
    | "resolve_risk_flag";
  id: string;
  title: string;
  body: string;
  /** Pour resolve_risk_flag : statut cible choisi avant confirmation. */
  riskStatus?: RiskStatus;
  danger?: boolean;
};

// ————————————————————————————————————————————————————————————————
// Utilitaires
// ————————————————————————————————————————————————————————————————

const CURRENCY = "eur";
const fmt = (minor: number): string => formatMinorAmount(Number.isFinite(minor) ? Math.trunc(minor) : 0, CURRENCY);
const toMinor = (v: string | number): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
};
const fmtDate = (iso: string | null): string => (iso ? new Date(iso).toLocaleString("fr-FR") : "—");

type ActionResponse = {
  ok: boolean;
  error?: string;
  /** Message EXPLICITE fourni par le serveur (source de vérité de l'explication). */
  message?: string;
  activated?: boolean;
  partnerId?: string;
  publicSlug?: string;
  referralCode?: string;
  settings?: Record<string, unknown>;
  result?: PayoutResult;
  report?: BackfillReport;
};

/**
 * L'explication vient du SERVEUR (`message`) : une seule source de vérité, jamais deux
 * catalogues d'erreurs qui divergent. L'admin ne doit jamais lire un « Action refusée. » nu.
 */
function humanError(status: number, res: { error?: string; message?: string } | null): string {
  if (status === 401 || status === 404) return "Session admin invalide ou expirée. Reconnectez-vous.";
  if (res?.message) return res.message;
  if (res?.error) return `L’action n’a pas pu être appliquée (${res.error}).`;
  return "L’action n’a pas pu être appliquée : le serveur n’a pas répondu comme attendu.";
}

type BackfillReport = {
  dryRun: boolean;
  scanned: number;
  provisioned: number;
  manualReview: number;
  skipped: number;
  errors: number;
  items: { applicationId: string; email: string; cabinetName: string; action: string; blocking: string[] }[];
};

// Statut → style de puce.
function statusChip(status: string): string {
  const ok = ["active", "accepted", "auto_approved", "complete", "validated", "verified", "paid", "completed", "provision"];
  const warn = ["submitted", "under_review", "reviewing", "pending", "running", "paused", "onboarding_pending", "manual_review", "received", "skipped_already_provisioned"];
  const danger = ["suspended", "rejected", "closed", "failed", "revoked", "confirmed", "error"];
  const s = status.toLowerCase();
  if (ok.includes(s)) return `${styles.chip} ${styles.chipOk}`;
  if (danger.includes(s)) return `${styles.chip} ${styles.chipDanger}`;
  if (warn.includes(s)) return `${styles.chip} ${styles.chipWarn}`;
  return styles.chip;
}

// ————————————————————————————————————————————————————————————————
// Composant principal
// ————————————————————————————————————————————————————————————————

type Tab = "applications" | "partners" | "introductions" | "risk" | "ledger" | "payouts" | "settings";

export default function AdminConsole({ adminEmail }: { adminEmail: string }): React.JSX.Element {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [tab, setTab] = useState<Tab>("applications");

  // Dialogue de confirmation générique (raison obligatoire).
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState("");

  // Modale d'affichage du code de recommandation (rendu une seule fois).
  const [accepted, setAccepted] = useState<{ publicSlug: string; referralCode: string } | null>(null);

  const loadOverview = useCallback(async (): Promise<void> => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetch("/api/partners/admin/overview", {
        method: "GET",
        credentials: "same-origin",
        headers: { accept: "application/json" },
      });
      const json = (await res.json().catch(() => ({}))) as Partial<Overview> & { ok?: boolean };
      if (!res.ok || !json.ok) {
        setLoadError(humanError(res.status, null));
        return;
      }
      setOverview({
        applications: json.applications ?? [],
        partners: json.partners ?? [],
        introductions: json.introductions ?? [],
        riskFlags: json.riskFlags ?? [],
        payoutRuns: json.payoutRuns ?? [],
        ledger: json.ledger ?? { gross: 0, reversals: 0, paid: 0, frozen: 0 },
      });
    } catch {
      setLoadError("Erreur réseau au chargement.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  // Envoie une action générique. Renvoie la réponse pour les cas particuliers (accept, settings, dryrun).
  const postAction = useCallback(async (body: Record<string, unknown>): Promise<{ res: Response; json: ActionResponse }> => {
    const res = await fetch("/api/partners/admin/action", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({ ok: false }))) as ActionResponse;
    return { res, json };
  }, []);

  // Confirmation d'une action sensible (raison obligatoire).
  const runConfirm = useCallback(async (): Promise<void> => {
    if (!confirmAction) return;
    const trimmed = reason.trim();
    if (!trimmed) {
      setDialogError("Une raison est obligatoire.");
      return;
    }
    setBusy(true);
    setDialogError("");
    try {
      const body: Record<string, unknown> = { action: confirmAction.action, id: confirmAction.id, reason: trimmed };
      if (confirmAction.action === "resolve_risk_flag") body.status = confirmAction.riskStatus ?? "reviewed_ok";
      const { res, json } = await postAction(body);
      if (!res.ok || !json.ok) {
        setDialogError(humanError(res.status, json));
        return;
      }
      // Accept → afficher le code de recommandation (une seule fois).
      if (confirmAction.action === "accept_application" && json.referralCode && json.publicSlug) {
        setAccepted({ publicSlug: json.publicSlug, referralCode: json.referralCode });
      }
      setConfirmAction(null);
      setReason("");
      await loadOverview();
    } catch {
      setDialogError("Erreur réseau.");
    } finally {
      setBusy(false);
    }
  }, [confirmAction, reason, postAction, loadOverview]);

  const openConfirm = useCallback((a: ConfirmAction): void => {
    setConfirmAction(a);
    setReason("");
    setDialogError("");
  }, []);

  const tabs = useMemo(
    () =>
      [
        { key: "applications" as const, label: "Candidatures", count: overview?.applications.length },
        { key: "partners" as const, label: "Partenaires", count: overview?.partners.length },
        { key: "introductions" as const, label: "Introductions", count: overview?.introductions.length },
        { key: "risk" as const, label: "Risk flags", count: overview?.riskFlags.length },
        { key: "ledger" as const, label: "Ledger", count: undefined },
        { key: "payouts" as const, label: "Versements", count: overview?.payoutRuns.length },
        { key: "settings" as const, label: "Paramètres", count: undefined },
      ] satisfies Array<{ key: Tab; label: string; count: number | undefined }>,
    [overview],
  );

  return (
    <div className={styles.root}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>Programme partenaires — Administration</h1>
            <p className={styles.subtitle}>Connecté : {adminEmail}</p>
          </div>
          <button type="button" className={styles.btn} onClick={() => void loadOverview()} disabled={loading}>
            {loading ? <span className={styles.spin} aria-hidden /> : null} Rafraîchir
          </button>
        </header>

        <nav className={styles.tabs} role="tablist" aria-label="Sections de la console">
          {tabs.map((t) => (
            <button
              key={t.key}
              role="tab"
              type="button"
              aria-selected={tab === t.key}
              className={styles.tab}
              onClick={() => setTab(t.key)}
            >
              {t.label}
              {typeof t.count === "number" ? <span className={styles.tabCount}>{t.count}</span> : null}
            </button>
          ))}
        </nav>

        {loadError ? <p className={`${styles.notice} ${styles.noticeError}`}>{loadError}</p> : null}

        {loading && !overview ? (
          <div className={styles.loadingRow}>
            <span className={styles.spin} aria-hidden /> Chargement de la console…
          </div>
        ) : overview ? (
          <>
            {tab === "applications" ? <ApplicationsPanel data={overview.applications} onAction={openConfirm} postAction={postAction} onDone={loadOverview} /> : null}
            {tab === "partners" ? <PartnersPanel onAction={openConfirm} /> : null}
            {tab === "introductions" ? <IntroductionsPanel data={overview.introductions} onAction={openConfirm} /> : null}
            {tab === "risk" ? <RiskPanel data={overview.riskFlags} onAction={openConfirm} /> : null}
            {tab === "ledger" ? <LedgerPanel ledger={overview.ledger} /> : null}
            {tab === "payouts" ? <PayoutsPanel runs={overview.payoutRuns} postAction={postAction} onDone={loadOverview} /> : null}
            {tab === "settings" ? <SettingsPanel postAction={postAction} /> : null}
          </>
        ) : null}
      </div>

      {confirmAction ? (
        <ConfirmDialog
          action={confirmAction}
          reason={reason}
          setReason={setReason}
          busy={busy}
          error={dialogError}
          onCancel={() => {
            setConfirmAction(null);
            setDialogError("");
          }}
          onConfirm={() => void runConfirm()}
          onRiskStatus={(s) => setConfirmAction({ ...confirmAction, riskStatus: s })}
        />
      ) : null}

      {accepted ? (
        <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Code de recommandation">
          <div className={styles.dialog}>
            <h2 className={styles.dialogTitle}>Candidature acceptée</h2>
            <p className={styles.dialogBody}>
              À transmettre au cabinet. Le code de recommandation en clair n'est affiché
              <strong> qu'une seule fois</strong> et ne sera pas ré-affiché.
            </p>
            <div className={styles.codeRow}>
              <span className={styles.small}>Slug public</span>
              <span className={styles.code}>{accepted.publicSlug}</span>
            </div>
            <div className={styles.codeRow}>
              <span className={styles.small}>Code de recommandation</span>
              <span className={styles.code}>{accepted.referralCode}</span>
              <button
                type="button"
                className={styles.btn}
                onClick={() => void navigator.clipboard?.writeText(accepted.referralCode)}
              >
                Copier
              </button>
            </div>
            <div className={styles.dialogActions}>
              <button type="button" className={styles.btnPrimary + " " + styles.btn} onClick={() => setAccepted(null)}>
                J'ai transmis le code
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ————————————————————————————————————————————————————————————————
// Panneaux
// ————————————————————————————————————————————————————————————————

function Panel({ title, note, children }: { title: string; note?: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <section className={styles.panel}>
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>{title}</h2>
        {note ? <p className={styles.panelNote}>{note}</p> : null}
      </div>
      {children}
    </section>
  );
}

/** Les candidatures que l'admin doit RÉELLEMENT traiter : celles bloquées en revue. */
const NEEDS_HUMAN = new Set(["manual_review", "received", "under_review"]);

/**
 * Centre de contrôle des candidatures. L'admission est AUTOMATIQUE : l'admin ne valide plus
 * les dossiers sains — il ne voit et ne tranche que les exceptions réellement signalées.
 */
function ApplicationsPanel({
  data, onAction, postAction, onDone,
}: {
  data: Application[];
  onAction: (a: ConfirmAction) => void;
  postAction: (b: Record<string, unknown>) => Promise<{ res: Response; json: ActionResponse }>;
  onDone: () => Promise<void>;
}): React.JSX.Element {
  const review = data.filter((a) => NEEDS_HUMAN.has(a.status));
  const automatic = data.filter((a) => !NEEDS_HUMAN.has(a.status));

  return (
    <>
      <Panel
        title={`À trancher — ${review.length}`}
        note="L'admission est automatique. Seuls les dossiers portant un risque réel arrivent ici : ce sont les seuls que vous devez traiter."
      >
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Cabinet</th><th>Email</th><th>Pays</th><th>Type</th><th>Statut</th><th>Reçue</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {review.map((a) => (
                <tr key={a.id}>
                  <td>{a.cabinetName}</td>
                  <td>{a.email}</td>
                  <td>{a.country}</td>
                  <td>{a.cabinetType}</td>
                  <td><span className={statusChip(a.status)}>{a.status}</span></td>
                  <td className={styles.small}>{fmtDate(a.createdAt)}</td>
                  <td>
                    <div className={styles.actions}>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnPrimary}`}
                        onClick={() => onAction({ action: "accept_application", id: a.id, title: `Admettre ${a.cabinetName}`, body: "Le cabinet est provisionné comme une admission automatique : lien, code et e-mail d'accès. Les signaux de risque de ce dossier sont levés, l'activation reprend son cours automatique." })}
                      >
                        Admettre malgré le signal
                      </button>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnDanger}`}
                        onClick={() => onAction({ action: "reject_application", id: a.id, title: `Refuser ${a.cabinetName}`, body: "La candidature sera refusée. Le cabinet en est informé.", danger: true })}
                      >
                        Refuser
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {review.length === 0 ? (
                <tr><td colSpan={7} className={styles.empty}>Rien à trancher. Toutes les candidatures ont été admises automatiquement.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Panel>

      <BackfillPanel postAction={postAction} onDone={onDone} />

      <Panel title={`Admises automatiquement — ${automatic.length}`} note="Observation seule : ces dossiers n'ont demandé aucune décision humaine.">
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr><th>Cabinet</th><th>Email</th><th>Pays</th><th>Statut</th><th>Reçue</th></tr>
            </thead>
            <tbody>
              {automatic.map((a) => (
                <tr key={a.id}>
                  <td>{a.cabinetName}</td>
                  <td>{a.email}</td>
                  <td>{a.country}</td>
                  <td><span className={statusChip(a.status)}>{a.status}</span></td>
                  <td className={styles.small}>{fmtDate(a.createdAt)}</td>
                </tr>
              ))}
              {automatic.length === 0 ? <tr><td colSpan={5} className={styles.empty}>Aucune candidature.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}

/**
 * Reprise des dossiers hérités du parcours manuel. SIMULATION obligatoire d'abord :
 * le bouton « Appliquer » n'apparaît qu'après avoir vu le plan exact.
 */
function BackfillPanel({
  postAction, onDone,
}: {
  postAction: (b: Record<string, unknown>) => Promise<{ res: Response; json: ActionResponse }>;
  onDone: () => Promise<void>;
}): React.JSX.Element {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [plan, setPlan] = useState<BackfillReport | null>(null);
  const [applied, setApplied] = useState<BackfillReport | null>(null);

  const run = useCallback(async (apply: boolean): Promise<void> => {
    setBusy(true);
    setError("");
    try {
      const { res, json } = await postAction({
        action: "backfill_applications",
        reason: apply ? "reprise appliquée des dossiers hérités" : "simulation de reprise",
        apply,
      });
      if (!res.ok || !json.ok || !json.report) {
        setError(humanError(res.status, json));
        return;
      }
      if (apply) { setApplied(json.report); setPlan(null); await onDone(); }
      else { setPlan(json.report); setApplied(null); }
    } catch {
      setError("Erreur réseau.");
    } finally {
      setBusy(false);
    }
  }, [postAction, onDone]);

  const report = applied ?? plan;

  return (
    <Panel
      title="Dossiers hérités du parcours manuel"
      note="Les candidatures restées en attente avant l'admission automatique. La simulation ne modifie rien."
    >
      <div className={styles.actions}>
        <button type="button" className={styles.btn} disabled={busy} onClick={() => void run(false)}>
          {busy ? "Analyse…" : "Simuler la reprise"}
        </button>
        {plan && plan.scanned > 0 ? (
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} disabled={busy} onClick={() => void run(true)}>
            Appliquer ce plan
          </button>
        ) : null}
      </div>

      {error ? <p className={`${styles.notice} ${styles.noticeError}`} role="alert">{error}</p> : null}

      {report ? (
        <>
          <p className={styles.small} style={{ marginTop: 12 }}>
            {applied ? "APPLIQUÉ" : "SIMULATION — aucune écriture"} · {report.scanned} examiné(s) ·{" "}
            {report.provisioned} provisionné(s) · {report.manualReview} en revue humaine ·{" "}
            {report.skipped} déjà provisionné(s) · {report.errors} erreur(s)
          </p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr><th>Cabinet</th><th>Email</th><th>Décision</th><th>Signaux bloquants</th></tr>
              </thead>
              <tbody>
                {report.items.map((i) => (
                  <tr key={i.applicationId}>
                    <td>{i.cabinetName}</td>
                    <td>{i.email}</td>
                    <td><span className={statusChip(i.action)}>{i.action}</span></td>
                    <td className={styles.small}>{i.blocking.length ? i.blocking.join(", ") : "—"}</td>
                  </tr>
                ))}
                {report.items.length === 0 ? <tr><td colSpan={4} className={styles.empty}>Aucun dossier hérité.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </Panel>
  );
}

// ————————————————————————————————————————————————————————————————
// Onglet Partenaires — ce que CHAQUE cabinet a réellement apporté.
// Les agrégats viennent de PostgreSQL (route /api/partners/admin/partners) : rien n'est
// recalculé ici. La pagination, le tri et les filtres sont SERVEUR.
// ————————————————————————————————————————————————————————————————

type PartnerAnalytics = {
  id: string; displayName: string; email: string; country: string; publicSlug: string;
  status: string; activationMode: string | null; activatedAt: string | null; lastActivityAt: string | null;
  connectState: string; payoutsEnabled: boolean; openRiskFlags: number;
  activeClients: number; totalClients: number; canceledClients: number;
  clientMrrMinor: number; commissionMrrMinor: number;
  grossMinor: number; reversalsMinor: number; reserveMinor: number;
  availableMinor: number; frozenMinor: number; paidMinor: number;
  currency: string; payoutThresholdMinor: number; lastPayoutAt: string | null;
};

/** Libellés Stripe Connect — jamais une donnée bancaire, uniquement un état. */
const CONNECT_LABEL: Record<string, { label: string; cls: "ok" | "warn" | "danger" | "" }> = {
  not_started: { label: "Connect non commencé", cls: "" },
  in_progress: { label: "Connect en cours", cls: "warn" },
  missing_info: { label: "Informations manquantes", cls: "warn" },
  restricted: { label: "Restreint", cls: "danger" },
  ready: { label: "Prêt à recevoir", cls: "ok" },
};

function connectChip(state: string): React.JSX.Element {
  const c = CONNECT_LABEL[state] ?? { label: state, cls: "" as const };
  const cls =
    c.cls === "ok" ? `${styles.chip} ${styles.chipOk}`
    : c.cls === "warn" ? `${styles.chip} ${styles.chipWarn}`
    : c.cls === "danger" ? `${styles.chip} ${styles.chipDanger}`
    : styles.chip;
  return <span className={cls}>{c.label}</span>;
}

function PartnersPanel({ onAction }: { onAction: (a: ConfirmAction) => void }): React.JSX.Element {
  const [rows, setRows] = useState<PartnerAnalytics[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [country, setCountry] = useState("");
  const [connect, setConnect] = useState("");
  const [sort, setSort] = useState("recent");
  const [openId, setOpenId] = useState<string | null>(null);
  const LIMIT = 25;

  const load = useCallback(async (nextOffset: number): Promise<void> => {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({ limit: String(LIMIT), offset: String(nextOffset), sort });
      if (search.trim()) qs.set("search", search.trim());
      if (status) qs.set("status", status);
      if (country) qs.set("country", country);
      if (connect) qs.set("connect", connect);
      const res = await fetch(`/api/partners/admin/partners?${qs.toString()}`, { credentials: "same-origin", headers: { accept: "application/json" } });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; items?: PartnerAnalytics[]; total?: number; message?: string };
      if (!res.ok || !json.ok || !json.items) {
        setError(humanError(res.status, json));
        return;
      }
      setRows(json.items);
      setTotal(json.total ?? 0);
      setOffset(nextOffset);
    } catch {
      setError("Erreur réseau au chargement des partenaires.");
    } finally {
      setLoading(false);
    }
  }, [search, status, country, connect, sort]);

  useEffect(() => { void load(0); }, [load]);

  return (
    <>
      <Panel
        title={`Partenaires — ${total}`}
        note="Ce que chaque cabinet a réellement apporté. Agrégats calculés côté base ; pagination, tri et filtres côté serveur."
      >
        <div className={styles.actions} style={{ marginBottom: 14 }}>
          <input
            className={styles.input} placeholder="Rechercher un cabinet…" value={search}
            onChange={(e) => setSearch(e.target.value)} aria-label="Rechercher un cabinet"
          />
          <select className={styles.input} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filtrer par statut">
            <option value="">Tous les statuts</option>
            <option value="active">Actifs</option>
            <option value="onboarding_pending">Activation en cours</option>
            <option value="manual_review">En revue</option>
            <option value="suspended">Suspendus</option>
          </select>
          <select className={styles.input} value={country} onChange={(e) => setCountry(e.target.value)} aria-label="Filtrer par pays">
            <option value="">Tous les pays</option>
            <option value="FR">France</option>
            <option value="BE">Belgique</option>
            <option value="LU">Luxembourg</option>
            <option value="CH">Suisse</option>
          </select>
          <select className={styles.input} value={connect} onChange={(e) => setConnect(e.target.value)} aria-label="Filtrer par état Stripe Connect">
            <option value="">Tout Stripe Connect</option>
            <option value="ready">Prêt à recevoir</option>
            <option value="incomplete">Incomplet</option>
            <option value="none">Non commencé</option>
          </select>
          <select className={styles.input} value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Trier">
            <option value="recent">Plus récents</option>
            <option value="active_clients">Clients actifs</option>
            <option value="client_mrr">MRR clients</option>
            <option value="commission_mrr">MRR commission</option>
            <option value="available">Commissions disponibles</option>
          </select>
        </div>

        {error ? <p className={`${styles.notice} ${styles.noticeError}`} role="alert">{error}</p> : null}

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Cabinet</th><th>Statut</th>
                <th>Clients actifs</th><th>Clients totaux</th>
                <th>MRR clients</th><th>MRR commission</th>
                <th>En réserve</th><th>Disponible</th><th>Versé</th>
                <th>Stripe Connect</th><th>Dernière activité</th><th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.displayName}
                    {p.openRiskFlags > 0 ? <span className={`${styles.chip} ${styles.chipWarn}`} style={{ marginLeft: 6 }}>{p.openRiskFlags} risque(s)</span> : null}
                    <div className={styles.small}>{p.email}</div>
                  </td>
                  <td><span className={statusChip(p.status)}>{p.status}</span></td>
                  <td>{p.activeClients}</td>
                  <td>{p.totalClients}</td>
                  <td>{fmt(p.clientMrrMinor)}</td>
                  <td>{fmt(p.commissionMrrMinor)}</td>
                  <td>{fmt(p.reserveMinor)}</td>
                  <td>{fmt(p.availableMinor)}</td>
                  <td>{fmt(p.paidMinor)}</td>
                  <td>{connectChip(p.connectState)}</td>
                  <td className={styles.small}>{fmtDate(p.lastActivityAt)}</td>
                  <td>
                    <button type="button" className={styles.btn} onClick={() => setOpenId(p.id)}>Détail</button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && !loading ? <tr><td colSpan={12} className={styles.empty}>Aucun cabinet ne correspond.</td></tr> : null}
            </tbody>
          </table>
        </div>

        <div className={styles.actions} style={{ marginTop: 14, justifyContent: "space-between" }}>
          <span className={styles.small}>
            {total === 0 ? "0" : `${offset + 1}–${offset + rows.length}`} sur {total}
          </span>
          <span className={styles.actions}>
            <button type="button" className={styles.btn} disabled={loading || offset === 0} onClick={() => void load(Math.max(0, offset - LIMIT))}>Précédent</button>
            <button type="button" className={styles.btn} disabled={loading || offset + rows.length >= total} onClick={() => void load(offset + LIMIT)}>Suivant</button>
          </span>
        </div>
      </Panel>

      {openId ? <PartnerDetailPanel partnerId={openId} onClose={() => setOpenId(null)} onAction={onAction} /> : null}
    </>
  );
}

type DetailPayload = {
  partner: PartnerAnalytics;
  onboarding: {
    contractAccepted: boolean; connectState: string; detailsSubmitted: boolean; payoutsEnabled: boolean;
    hasConnectedAccount: boolean; requirementsDue: string[]; disabledReason: string | null; remainingSteps: string[];
  };
  acquisition: {
    clicks: number; introductions: number; introductionsPending: number; introductionsMatched: number;
    prospectsSignedUp: number; attributionsPending: number; attributionsLocked: number; conflicts: number; clientsLost: number;
  };
  clients: { items: Array<{ id: string; companyLabel: string | null; status: string; stripeSubscriptionId: string | null; currency: string; firstPaymentAt: string | null; lastPaymentAt: string | null; commissionMinor: number }>; total: number; limit: number; offset: number; hasMore: boolean };
  nextPayout: { estimatedMinor: number; thresholdMinor: number; thresholdReached: boolean; blockedReason: string | null };
  transfers: Array<{ id: string; periodStart: string; periodEnd: string; amountMinor: number; status: string; stripeTransferId: string | null; failureReason: string | null; requiredAction: string | null; attempts: number; paidAt: string | null }>;
  riskFlags: Array<{ id: string; kind: string; severity: string; explanation: string; status: string; createdAt: string }>;
  audit: Array<{ actor: string; action: string; reason: string; occurredAt: string }>;
  commissions: Array<{ id: string; createdAt: string; entryType: string; status: string; commissionMinor: number; stripeInvoiceId: string }>;
  introductions: Array<{ id: string; companyName: string; status: string; submittedAt: string }>;
};

function PartnerDetailPanel({ partnerId, onClose, onAction }: { partnerId: string; onClose: () => void; onAction: (a: ConfirmAction) => void }): React.JSX.Element {
  const [d, setD] = useState<DetailPayload | null>(null);
  const [error, setError] = useState("");
  const [clientsOffset, setClientsOffset] = useState(0);

  const load = useCallback(async (offset: number): Promise<void> => {
    setError("");
    try {
      const res = await fetch(`/api/partners/admin/partners/${partnerId}?clientsLimit=25&clientsOffset=${offset}`, {
        credentials: "same-origin", headers: { accept: "application/json" },
      });
      const json = (await res.json().catch(() => ({}))) as ({ ok?: boolean; message?: string } & DetailPayload);
      if (!res.ok || !json.ok) { setError(humanError(res.status, json)); return; }
      setD(json);
      setClientsOffset(offset);
    } catch {
      setError("Erreur réseau au chargement du détail.");
    }
  }, [partnerId]);

  useEffect(() => { void load(0); }, [load]);

  if (error) {
    return (
      <Panel title="Détail du cabinet" note="">
        <p className={`${styles.notice} ${styles.noticeError}`} role="alert">{error}</p>
        <button type="button" className={styles.btn} onClick={onClose}>Fermer</button>
      </Panel>
    );
  }
  if (!d) return <Panel title="Détail du cabinet" note="Chargement…"><p className={styles.small}>Chargement…</p></Panel>;

  const p = d.partner;
  return (
    <Panel title={`${p.displayName} — détail`} note={`${p.email} · ${p.country} · /partenaires/r/${p.publicSlug}`}>
      <div className={styles.actions} style={{ marginBottom: 14 }}>
        <button type="button" className={styles.btn} onClick={onClose}>Fermer</button>
        {p.status === "suspended" ? (
          <button type="button" className={styles.btn} onClick={() => onAction({ action: "reinstate_partner", id: p.id, title: `Réintégrer ${p.displayName}`, body: "Le cabinet redevient actif." })}>Réintégrer</button>
        ) : (
          <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={() => onAction({ action: "suspend_partner", id: p.id, title: `Suspendre ${p.displayName}`, body: "Le cabinet sera suspendu : plus aucune attribution ni versement.", danger: true })}>Suspendre</button>
        )}
      </div>

      <h4 className={styles.panelTitle}>Onboarding</h4>
      <p className={styles.small}>
        Conditions {d.onboarding.contractAccepted ? "acceptées" : "non acceptées"} · {CONNECT_LABEL[d.onboarding.connectState]?.label ?? d.onboarding.connectState}
        {" · "}payouts {d.onboarding.payoutsEnabled ? "activés" : "non activés"}
        {d.onboarding.requirementsDue.length ? ` · informations Stripe manquantes : ${d.onboarding.requirementsDue.join(", ")}` : ""}
        {d.onboarding.remainingSteps.length ? ` · étapes restantes : ${d.onboarding.remainingSteps.join(", ")}` : " · aucune étape restante"}
      </p>

      <h4 className={styles.panelTitle} style={{ marginTop: 18 }}>Acquisition</h4>
      <p className={styles.small}>
        {d.acquisition.clicks} clic(s) · {d.acquisition.introductions} introduction(s) ({d.acquisition.introductionsPending} en attente, {d.acquisition.introductionsMatched} rapprochées)
        {" · "}{d.acquisition.prospectsSignedUp} prospect(s) inscrit(s) · {d.acquisition.attributionsPending} attribution(s) en attente, {d.acquisition.attributionsLocked} verrouillée(s)
        {" · "}{d.acquisition.conflicts} conflit(s) · {d.acquisition.clientsLost} client(s) perdu(s)
      </p>

      <h4 className={styles.panelTitle} style={{ marginTop: 18 }}>Argent</h4>
      <p className={styles.small}>
        MRR clients {fmt(p.clientMrrMinor)} · MRR commission {fmt(p.commissionMrrMinor)} · brut {fmt(p.grossMinor)} · remboursements {fmt(p.reversalsMinor)}
        {" · "}réserve {fmt(p.reserveMinor)} · disponible {fmt(p.availableMinor)} · gelé {fmt(p.frozenMinor)} · versé {fmt(p.paidMinor)}
      </p>
      <p className={styles.small}>
        Prochain versement estimé : <strong>{fmt(d.nextPayout.estimatedMinor)}</strong> (seuil {fmt(d.nextPayout.thresholdMinor)})
        {d.nextPayout.blockedReason ? ` — bloqué : ${d.nextPayout.blockedReason}` : ""}
        {" · "}dernier versement : {fmtDate(p.lastPayoutAt)}
      </p>

      <h4 className={styles.panelTitle} style={{ marginTop: 18 }}>Entreprises apportées — {d.clients.total}</h4>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th>Entreprise</th><th>Statut</th><th>Abonnement</th><th>1er paiement</th><th>Dernier paiement</th><th>Commissions</th></tr></thead>
          <tbody>
            {d.clients.items.map((c) => (
              <tr key={c.id}>
                <td>{c.companyLabel ?? "—"}</td>
                <td><span className={statusChip(c.status)}>{c.status}</span></td>
                <td className={styles.small}>{c.stripeSubscriptionId ?? "—"} ({c.currency.toUpperCase()})</td>
                <td className={styles.small}>{fmtDate(c.firstPaymentAt)}</td>
                <td className={styles.small}>{fmtDate(c.lastPaymentAt)}</td>
                <td>{fmt(c.commissionMinor)}</td>
              </tr>
            ))}
            {d.clients.items.length === 0 ? <tr><td colSpan={6} className={styles.empty}>Aucune entreprise apportée.</td></tr> : null}
          </tbody>
        </table>
      </div>
      <div className={styles.actions} style={{ marginTop: 10 }}>
        <button type="button" className={styles.btn} disabled={clientsOffset === 0} onClick={() => void load(Math.max(0, clientsOffset - 25))}>Précédent</button>
        <button type="button" className={styles.btn} disabled={!d.clients.hasMore} onClick={() => void load(clientsOffset + 25)}>Suivant</button>
      </div>

      <h4 className={styles.panelTitle} style={{ marginTop: 18 }}>Versements</h4>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th>Période</th><th>Montant</th><th>Statut</th><th>Transfert Stripe</th><th>Motif / action nécessaire</th></tr></thead>
          <tbody>
            {d.transfers.map((t) => (
              <tr key={t.id}>
                <td className={styles.small}>{t.periodStart} → {t.periodEnd}</td>
                <td>{fmt(t.amountMinor)}</td>
                <td><span className={statusChip(t.status)}>{t.status}</span></td>
                <td className={styles.small}>{t.stripeTransferId ?? "—"}</td>
                <td className={styles.small}>
                  {t.failureReason ? <>{t.failureReason}{t.requiredAction ? <> — <strong>{t.requiredAction}</strong></> : null}</> : "—"}
                </td>
              </tr>
            ))}
            {d.transfers.length === 0 ? <tr><td colSpan={5} className={styles.empty}>Aucun versement.</td></tr> : null}
          </tbody>
        </table>
      </div>

      <h4 className={styles.panelTitle} style={{ marginTop: 18 }}>Commissions (ledger)</h4>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th>Date</th><th>Type</th><th>Statut</th><th>Facture</th><th>Montant</th></tr></thead>
          <tbody>
            {d.commissions.slice(0, 25).map((c) => (
              <tr key={c.id}>
                <td className={styles.small}>{fmtDate(c.createdAt)}</td>
                <td>{c.entryType === "reversal" ? "Remboursement" : "Commission"}</td>
                <td><span className={statusChip(c.status)}>{c.status}</span></td>
                <td className={styles.small}>{c.stripeInvoiceId}</td>
                <td>{fmt(c.commissionMinor)}</td>
              </tr>
            ))}
            {d.commissions.length === 0 ? <tr><td colSpan={5} className={styles.empty}>Aucune écriture.</td></tr> : null}
          </tbody>
        </table>
      </div>

      <h4 className={styles.panelTitle} style={{ marginTop: 18 }}>Introductions</h4>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th>Entreprise</th><th>Statut</th><th>Présentée le</th></tr></thead>
          <tbody>
            {d.introductions.map((i) => (
              <tr key={i.id}>
                <td>{i.companyName}</td>
                <td><span className={statusChip(i.status)}>{i.status}</span></td>
                <td className={styles.small}>{fmtDate(i.submittedAt)}</td>
              </tr>
            ))}
            {d.introductions.length === 0 ? <tr><td colSpan={3} className={styles.empty}>Aucune introduction.</td></tr> : null}
          </tbody>
        </table>
      </div>

      <h4 className={styles.panelTitle} style={{ marginTop: 18 }}>Risques</h4>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th>Signal</th><th>Gravité</th><th>Explication</th><th>Statut</th></tr></thead>
          <tbody>
            {d.riskFlags.map((f) => (
              <tr key={f.id}>
                <td>{f.kind}</td>
                <td>{f.severity}</td>
                <td className={styles.small}>{f.explanation}</td>
                <td><span className={statusChip(f.status)}>{f.status}</span></td>
              </tr>
            ))}
            {d.riskFlags.length === 0 ? <tr><td colSpan={4} className={styles.empty}>Aucun signal.</td></tr> : null}
          </tbody>
        </table>
      </div>

      <h4 className={styles.panelTitle} style={{ marginTop: 18 }}>Audit</h4>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th>Quand</th><th>Acteur</th><th>Action</th><th>Motif</th></tr></thead>
          <tbody>
            {d.audit.map((a, i) => (
              <tr key={`${a.action}-${i}`}>
                <td className={styles.small}>{fmtDate(a.occurredAt)}</td>
                <td className={styles.small}>{a.actor}</td>
                <td>{a.action}</td>
                <td className={styles.small}>{a.reason}</td>
              </tr>
            ))}
            {d.audit.length === 0 ? <tr><td colSpan={4} className={styles.empty}>Aucune trace.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function IntroductionsPanel({ data, onAction }: { data: Introduction[]; onAction: (a: ConfirmAction) => void }): React.JSX.Element {
  return (
    <Panel title="Introductions en attente" note="Valider ou refuser une mise en relation soumise. Raison obligatoire.">
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Entreprise</th>
              <th>Partenaire</th>
              <th>Statut</th>
              <th>Soumise</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.map((i) => (
              <tr key={i.id}>
                <td>{i.companyName}</td>
                <td className={styles.small}>{i.partnerId}</td>
                <td><span className={statusChip(i.status)}>{i.status}</span></td>
                <td className={styles.small}>{fmtDate(i.submittedAt)}</td>
                <td>
                  <div className={styles.actions}>
                    <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => onAction({ action: "validate_introduction", id: i.id, title: `Valider ${i.companyName}`, body: "Valide la mise en relation nominative. Refusé si l'entreprise est déjà protégée par un autre cabinet." })}>Valider</button>
                    <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={() => onAction({ action: "reject_introduction", id: i.id, title: `Refuser ${i.companyName}`, body: "La mise en relation sera refusée.", danger: true })}>Refuser</button>
                  </div>
                </td>
              </tr>
            ))}
            {data.length === 0 ? <tr><td colSpan={5} className={styles.empty}>Aucune introduction en attente.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function RiskPanel({ data, onAction }: { data: RiskFlag[]; onAction: (a: ConfirmAction) => void }): React.JSX.Element {
  const [choice, setChoice] = useState<Record<string, RiskStatus>>({});
  const statusOf = (id: string): RiskStatus => choice[id] ?? "reviewed_ok";
  return (
    <Panel title="Risk flags ouverts" note="Résoudre en confirmé, écarté ou revu-conforme. Raison obligatoire.">
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Type</th>
              <th>Gravité</th>
              <th>Explication</th>
              <th>Partenaire</th>
              <th>Ouvert</th>
              <th>Résolution</th>
            </tr>
          </thead>
          <tbody>
            {data.map((f) => (
              <tr key={f.id}>
                <td>{f.kind}</td>
                <td><span className={statusChip(f.severity)}>{f.severity}</span></td>
                <td>{f.explanation}</td>
                <td className={styles.small}>{f.partnerId}</td>
                <td className={styles.small}>{fmtDate(f.createdAt)}</td>
                <td>
                  <div className={styles.actions}>
                    <select
                      className={styles.select}
                      aria-label="Statut de résolution"
                      value={statusOf(f.id)}
                      onChange={(e) => setChoice((c) => ({ ...c, [f.id]: e.target.value as RiskStatus }))}
                    >
                      <option value="reviewed_ok">Revu — conforme</option>
                      <option value="confirmed">Confirmé</option>
                      <option value="dismissed">Écarté</option>
                    </select>
                    <button
                      type="button"
                      className={styles.btn}
                      onClick={() => onAction({ action: "resolve_risk_flag", id: f.id, riskStatus: statusOf(f.id), title: `Résoudre le flag « ${f.kind} »`, body: `Statut cible : ${statusOf(f.id)}.` })}
                    >
                      Résoudre
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {data.length === 0 ? <tr><td colSpan={6} className={styles.empty}>Aucun risk flag ouvert.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function LedgerPanel({ ledger }: { ledger: LedgerRaw }): React.JSX.Element {
  const cards = [
    { label: "Commissions brutes", value: toMinor(ledger.gross) },
    { label: "Reversals", value: toMinor(ledger.reversals) },
    { label: "Versé (paid)", value: toMinor(ledger.paid) },
    { label: "Gelé (frozen)", value: toMinor(ledger.frozen) },
  ];
  return (
    <Panel title="Ledger de commissions" note="Lecture seule.">
      <div className={styles.ledgerGrid}>
        {cards.map((c) => (
          <div key={c.label} className={styles.ledgerCard}>
            <p className={styles.ledgerLabel}>{c.label}</p>
            <p className={styles.ledgerValue}>{fmt(c.value)}</p>
          </div>
        ))}
      </div>
      <p className={`${styles.notice} ${styles.noticeInfo}`} style={{ marginTop: 16 }}>
        Aucune modification directe du solde n'est possible. Toute correction financière passe
        exclusivement par une écriture compensatoire (reversal) au ledger.
      </p>
    </Panel>
  );
}

function PayoutsPanel({
  runs,
  postAction,
  onDone,
}: {
  runs: PayoutRun[];
  postAction: (body: Record<string, unknown>) => Promise<{ res: Response; json: ActionResponse }>;
  onDone: () => Promise<void>;
}): React.JSX.Element {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<PayoutResult | null>(null);

  const runDryRun = useCallback(async (): Promise<void> => {
    setBusy(true);
    setError("");
    try {
      const { res, json } = await postAction({ action: "run_payout_dryrun" });
      if (!res.ok || !json.ok || !json.result) {
        setError(humanError(res.status, json));
        return;
      }
      setResult(json.result);
      await onDone();
    } catch {
      setError("Erreur réseau.");
    } finally {
      setBusy(false);
    }
  }, [postAction, onDone]);

  return (
    <Panel
      title="Versements"
      note="La simulation est une PRÉVISUALISATION : elle n'écrit rien, ne marque aucune commission payée et n'appelle jamais Stripe. Les versements réels sont émis par le cron mensuel."
    >
      <div className={styles.actions}>
        <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => void runDryRun()} disabled={busy}>
          {busy ? <span className={styles.spin} aria-hidden /> : null} Prévisualiser le prochain versement
        </button>
      </div>
      {error ? <p className={`${styles.notice} ${styles.noticeError}`} style={{ marginTop: 12 }}>{error}</p> : null}

      {result ? (
        <div className={styles.runResult}>
          <p className={`${styles.notice} ${styles.noticeOk}`}>
            Prévisualisation · période {result.periodKey} · {result.partnersConsidered} cabinet(s) examiné(s) ·{" "}
            <strong>{fmt(result.totalAmountMinor)}</strong> seraient versés · aucune écriture, aucun transfert
          </p>
          <div className={styles.tableWrap} style={{ marginTop: 12 }}>
            <table className={styles.table}>
              <thead>
                <tr><th>Cabinet</th><th>Montant</th><th>Serait versé ?</th><th>Raison</th></tr>
              </thead>
              <tbody>
                {result.perPartner.map((pp, idx) => {
                  const included = pp.reason === "preview_would_transfer";
                  return (
                    <tr key={`${pp.partnerId}-${idx}`}>
                      <td className={styles.small}>{pp.partnerId}</td>
                      <td>{fmt(pp.amountMinor)}</td>
                      <td>
                        <span className={included ? `${styles.chip} ${styles.chipOk}` : styles.chip}>
                          {included ? "oui" : "non"}
                        </span>
                      </td>
                      <td className={styles.small}>{included ? "seuil atteint, compte prêt" : (pp.reason ?? "—")}</td>
                    </tr>
                  );
                })}
                {result.perPartner.length === 0 ? <tr><td colSpan={4} className={styles.empty}>Aucun cabinet actif.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <h3 className={styles.panelTitle} style={{ marginTop: 24, marginBottom: 12, fontSize: 15 }}>Lots récents</h3>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr><th>Clé de run</th><th>Type</th><th>Statut</th><th>Considérés</th><th>Transferts</th><th>Total</th><th>Démarré</th></tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id}>
                <td className={styles.small}>{r.runKey}</td>
                <td>{r.dryRun ? <span className={styles.chip}>dry-run</span> : <span className={`${styles.chip} ${styles.chipWarn}`}>réel</span>}</td>
                <td><span className={statusChip(r.status)}>{r.status}</span></td>
                <td>{r.partnersConsidered}</td>
                <td>{r.transfersCreated}</td>
                <td>{fmt(toMinor(r.totalAmountMinor))}</td>
                <td className={styles.small}>{fmtDate(r.startedAt)}</td>
              </tr>
            ))}
            {runs.length === 0 ? <tr><td colSpan={7} className={styles.empty}>Aucun lot pour l'instant.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

// Paramètres du programme. Défauts miroirs de DEFAULT_PROGRAM_SETTINGS (source serveur) ;
// après enregistrement, les valeurs renvoyées par l'API sont ré-affichées.
type SettingsForm = {
  commissionRateBps: string;
  attributionWindowDays: string;
  protectionWindowDays: string;
  reserveDays: string;
  payoutThresholdMinor: string;
  payoutDayOfMonth: string;
  currency: string;
  programStatus: "open" | "paused" | "closed";
};

const DEFAULT_FORM: SettingsForm = {
  commissionRateBps: "2000",
  attributionWindowDays: "90",
  protectionWindowDays: "180",
  reserveDays: "30",
  payoutThresholdMinor: "10000",
  payoutDayOfMonth: "5",
  currency: "eur",
  programStatus: "open",
};

function SettingsPanel({
  postAction,
}: {
  postAction: (body: Record<string, unknown>) => Promise<{ res: Response; json: ActionResponse }>;
}): React.JSX.Element {
  const [form, setForm] = useState<SettingsForm>(DEFAULT_FORM);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const set = <K extends keyof SettingsForm>(k: K, v: SettingsForm[K]): void => setForm((f) => ({ ...f, [k]: v }));

  const submit = useCallback(async (): Promise<void> => {
    if (!reason.trim()) {
      setError("Une raison est obligatoire.");
      return;
    }
    setBusy(true);
    setError("");
    setOk("");
    try {
      const settings = {
        commissionRateBps: Number(form.commissionRateBps),
        attributionWindowDays: Number(form.attributionWindowDays),
        protectionWindowDays: Number(form.protectionWindowDays),
        reserveDays: Number(form.reserveDays),
        payoutThresholdMinor: Number(form.payoutThresholdMinor),
        payoutDayOfMonth: Number(form.payoutDayOfMonth),
        currency: form.currency.trim().toLowerCase(),
        programStatus: form.programStatus,
      };
      const { res, json } = await postAction({ action: "update_settings", reason: reason.trim(), settings });
      if (!res.ok || !json.ok) {
        setError(humanError(res.status, json));
        return;
      }
      const s = json.settings;
      if (s) {
        setForm({
          commissionRateBps: String(s.commissionRateBps ?? form.commissionRateBps),
          attributionWindowDays: String(s.attributionWindowDays ?? form.attributionWindowDays),
          protectionWindowDays: String(s.protectionWindowDays ?? form.protectionWindowDays),
          reserveDays: String(s.reserveDays ?? form.reserveDays),
          payoutThresholdMinor: String(s.payoutThresholdMinor ?? form.payoutThresholdMinor),
          payoutDayOfMonth: String(s.payoutDayOfMonth ?? form.payoutDayOfMonth),
          currency: String(s.currency ?? form.currency),
          programStatus: (s.programStatus === "paused" || s.programStatus === "closed" ? s.programStatus : "open") as SettingsForm["programStatus"],
        });
      }
      setReason("");
      setOk("Paramètres enregistrés.");
    } catch {
      setError("Erreur réseau.");
    } finally {
      setBusy(false);
    }
  }, [form, reason, postAction]);

  return (
    <Panel title="Paramètres du programme" note="Modifiables uniquement via une action admin auditée. Raison obligatoire.">
      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <label className={styles.field}>
          <span className={styles.label}>Taux de commission (bps)</span>
          <input className={styles.input} type="number" min={0} max={10000} value={form.commissionRateBps} onChange={(e) => set("commissionRateBps", e.target.value)} />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Fenêtre d'attribution (jours)</span>
          <input className={styles.input} type="number" min={0} value={form.attributionWindowDays} onChange={(e) => set("attributionWindowDays", e.target.value)} />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Fenêtre de protection (jours)</span>
          <input className={styles.input} type="number" min={0} value={form.protectionWindowDays} onChange={(e) => set("protectionWindowDays", e.target.value)} />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Réserve (jours)</span>
          <input className={styles.input} type="number" min={0} value={form.reserveDays} onChange={(e) => set("reserveDays", e.target.value)} />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Seuil de versement (centimes)</span>
          <input className={styles.input} type="number" min={0} value={form.payoutThresholdMinor} onChange={(e) => set("payoutThresholdMinor", e.target.value)} />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Jour de versement (1-28)</span>
          <input className={styles.input} type="number" min={1} max={28} value={form.payoutDayOfMonth} onChange={(e) => set("payoutDayOfMonth", e.target.value)} />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Devise</span>
          <input className={styles.input} type="text" value={form.currency} onChange={(e) => set("currency", e.target.value)} />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Statut du programme</span>
          <select className={styles.select} value={form.programStatus} onChange={(e) => set("programStatus", e.target.value as SettingsForm["programStatus"])}>
            <option value="open">Ouvert</option>
            <option value="paused">En pause</option>
            <option value="closed">Fermé</option>
          </select>
        </label>
        <label className={styles.field} style={{ gridColumn: "1 / -1" }}>
          <span className={styles.label}>Raison (obligatoire)</span>
          <input className={styles.input} type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Justification de la modification" />
        </label>
        <div className={styles.formFooter}>
          <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={busy || !reason.trim()}>
            {busy ? <span className={styles.spin} aria-hidden /> : null} Enregistrer
          </button>
          {error ? <span className={`${styles.notice} ${styles.noticeError}`}>{error}</span> : null}
          {ok ? <span className={`${styles.notice} ${styles.noticeOk}`}>{ok}</span> : null}
        </div>
      </form>
    </Panel>
  );
}

// ————————————————————————————————————————————————————————————————
// Dialogue de confirmation (raison obligatoire)
// ————————————————————————————————————————————————————————————————

function ConfirmDialog({
  action,
  reason,
  setReason,
  busy,
  error,
  onCancel,
  onConfirm,
  onRiskStatus,
}: {
  action: ConfirmAction;
  reason: string;
  setReason: (v: string) => void;
  busy: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: () => void;
  onRiskStatus: (s: RiskStatus) => void;
}): React.JSX.Element {
  const canConfirm = reason.trim().length > 0 && !busy;
  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={action.title}>
      <div className={styles.dialog}>
        <h2 className={styles.dialogTitle}>{action.title}</h2>
        <p className={styles.dialogBody}>{action.body}</p>
        {action.action === "resolve_risk_flag" ? (
          <label className={styles.field}>
            <span className={styles.label}>Statut de résolution</span>
            <select className={styles.select} value={action.riskStatus ?? "reviewed_ok"} onChange={(e) => onRiskStatus(e.target.value as RiskStatus)}>
              <option value="reviewed_ok">Revu — conforme</option>
              <option value="confirmed">Confirmé</option>
              <option value="dismissed">Écarté</option>
            </select>
          </label>
        ) : null}
        <label className={styles.field}>
          <span className={styles.label}>Raison (obligatoire)</span>
          <input
            className={styles.input}
            type="text"
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Justification de l'action"
            onKeyDown={(e) => {
              if (e.key === "Enter" && canConfirm) onConfirm();
            }}
          />
        </label>
        {error ? <p className={`${styles.notice} ${styles.noticeError}`}>{error}</p> : null}
        <div className={styles.dialogActions}>
          <button type="button" className={styles.btn} onClick={onCancel} disabled={busy}>Annuler</button>
          <button
            type="button"
            className={`${styles.btn} ${action.danger ? styles.btnDanger : styles.btnPrimary}`}
            onClick={onConfirm}
            disabled={!canConfirm}
          >
            {busy ? <span className={styles.spin} aria-hidden /> : null} Confirmer
          </button>
        </div>
      </div>
    </div>
  );
}

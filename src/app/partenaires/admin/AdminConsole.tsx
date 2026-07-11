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
  partnerId?: string;
  publicSlug?: string;
  referralCode?: string;
  settings?: Record<string, unknown>;
  result?: PayoutResult;
};

const ERROR_LABELS: Record<string, string> = {
  reason_required: "Une raison est obligatoire.",
  company_already_protected: "Entreprise déjà protégée par un autre cabinet.",
  stripe_onboarding_incomplete: "Onboarding Stripe du cabinet incomplet.",
  contract_not_accepted: "Le contrat n'a pas encore été accepté par le cabinet.",
  id_required: "Identifiant manquant.",
  bad_request: "Requête invalide.",
  server_error: "Erreur serveur.",
  unknown_action: "Action inconnue.",
};

function humanError(status: number, error: string | undefined): string {
  if (status === 401 || status === 404) return "Session admin invalide ou expirée.";
  if (error && ERROR_LABELS[error]) return ERROR_LABELS[error];
  if (status === 409) return "Conflit : entreprise déjà protégée par un autre cabinet.";
  return error ? `Action refusée (${error}).` : "Action refusée.";
}

// Statut → style de puce.
function statusChip(status: string): string {
  const ok = ["active", "accepted", "complete", "validated", "verified", "paid", "completed"];
  const warn = ["submitted", "under_review", "reviewing", "pending", "running", "paused"];
  const danger = ["suspended", "rejected", "closed", "failed", "revoked", "confirmed"];
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
        setLoadError(humanError(res.status, undefined));
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
        setDialogError(humanError(res.status, json.error));
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
            {tab === "applications" ? <ApplicationsPanel data={overview.applications} onAction={openConfirm} /> : null}
            {tab === "partners" ? <PartnersPanel data={overview.partners} onAction={openConfirm} /> : null}
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

function ApplicationsPanel({ data, onAction }: { data: Application[]; onAction: (a: ConfirmAction) => void }): React.JSX.Element {
  return (
    <Panel title="Candidatures de cabinets" note="Accepter, refuser ou mettre en revue. Raison obligatoire.">
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Cabinet</th>
              <th>Email</th>
              <th>Pays</th>
              <th>Type</th>
              <th>Statut</th>
              <th>Reçue</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.map((a) => (
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
                      onClick={() => onAction({ action: "accept_application", id: a.id, title: `Accepter ${a.cabinetName}`, body: "Le cabinet devient partenaire. Un code de recommandation sera généré et affiché une seule fois." })}
                    >
                      Accepter
                    </button>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnDanger}`}
                      onClick={() => onAction({ action: "reject_application", id: a.id, title: `Refuser ${a.cabinetName}`, body: "La candidature sera refusée.", danger: true })}
                    >
                      Refuser
                    </button>
                    <button
                      type="button"
                      className={styles.btn}
                      onClick={() => onAction({ action: "review_application", id: a.id, title: `Mettre en revue ${a.cabinetName}`, body: "La candidature passe en cours d'examen." })}
                    >
                      Mettre en revue
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {data.length === 0 ? <tr><td colSpan={7} className={styles.empty}>Aucune candidature.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function PartnersPanel({ data, onAction }: { data: Partner[]; onAction: (a: ConfirmAction) => void }): React.JSX.Element {
  return (
    <Panel title="Partenaires" note="Suspendre, réintégrer ou activer un cabinet. Raison obligatoire.">
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Slug</th>
              <th>Statut</th>
              <th>Onboarding Stripe</th>
              <th>Payouts</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.map((p) => (
              <tr key={p.id}>
                <td>{p.displayName}</td>
                <td className={styles.small}>{p.publicSlug}</td>
                <td><span className={statusChip(p.status)}>{p.status}</span></td>
                <td><span className={statusChip(p.stripeOnboardingStatus)}>{p.stripeOnboardingStatus}</span></td>
                <td>{p.payoutsEnabled ? <span className={`${styles.chip} ${styles.chipOk}`}>activés</span> : <span className={styles.chip}>inactifs</span>}</td>
                <td>
                  <div className={styles.actions}>
                    {p.status === "suspended" ? (
                      <button type="button" className={styles.btn} onClick={() => onAction({ action: "reinstate_partner", id: p.id, title: `Réintégrer ${p.displayName}`, body: "Le partenaire redevient actif." })}>Réintégrer</button>
                    ) : (
                      <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={() => onAction({ action: "suspend_partner", id: p.id, title: `Suspendre ${p.displayName}`, body: "Le partenaire sera suspendu.", danger: true })}>Suspendre</button>
                    )}
                    <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => onAction({ action: "activate_partner", id: p.id, title: `Activer ${p.displayName}`, body: "Activation du partenaire (exige onboarding Stripe complet et contrat accepté)." })}>Activer</button>
                  </div>
                </td>
              </tr>
            ))}
            {data.length === 0 ? <tr><td colSpan={6} className={styles.empty}>Aucun partenaire.</td></tr> : null}
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
        setError(humanError(res.status, json.error));
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
    <Panel title="Versements" note="Le dry-run calcule les lots sans émettre aucun transfert Stripe réel.">
      <div className={styles.actions}>
        <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => void runDryRun()} disabled={busy}>
          {busy ? <span className={styles.spin} aria-hidden /> : null} Lancer un dry-run
        </button>
      </div>
      {error ? <p className={`${styles.notice} ${styles.noticeError}`} style={{ marginTop: 12 }}>{error}</p> : null}

      {result ? (
        <div className={styles.runResult}>
          <p className={`${styles.notice} ${styles.noticeOk}`}>
            Dry-run {result.dryRun ? "(simulation)" : ""} · période {result.periodKey} · {result.partnersConsidered} partenaire(s) · {result.transfersCreated} transfert(s) · total {fmt(result.totalAmountMinor)}
          </p>
          <div className={styles.tableWrap} style={{ marginTop: 12 }}>
            <table className={styles.table}>
              <thead>
                <tr><th>Partenaire</th><th>Montant</th><th>Statut</th><th>Raison</th></tr>
              </thead>
              <tbody>
                {result.perPartner.map((pp, idx) => (
                  <tr key={`${pp.partnerId}-${idx}`}>
                    <td className={styles.small}>{pp.partnerId}</td>
                    <td>{fmt(pp.amountMinor)}</td>
                    <td><span className={statusChip(pp.status)}>{pp.status}</span></td>
                    <td className={styles.small}>{pp.reason ?? "—"}</td>
                  </tr>
                ))}
                {result.perPartner.length === 0 ? <tr><td colSpan={4} className={styles.empty}>Aucun partenaire éligible.</td></tr> : null}
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
        setError(humanError(res.status, json.error));
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

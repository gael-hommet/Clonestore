"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Bot,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  Clock3,
  FileText,
  Loader2,
  Mail,
  MessageSquareMore,
  Save,
  Settings2,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
  Waypoints,
} from "lucide-react";

type SaveState = "idle" | "loading" | "success" | "error";

type SetupPayload = {
  identity: {
    company_name: string;
    sector: string;
    company_size: string;
    languages: string;
    hr_context: string;
  };
  people: {
    leader_name: string;
    hr_owner_name: string;
    managers: string;
    validators: string;
    validation_flow: string;
  };
  communication: {
    global_tone: string;
    formality: string;
    pronoun_style: string;
    candidate_style: string;
    manager_style: string;
    internal_style: string;
  };
  policy: {
    recurring_documents: string;
    recurring_rules: string;
    sensitive_cases: string;
    allowed_actions: string;
    forbidden_actions: string;
  };
  autonomy: {
    can_prepare_only: boolean;
    can_send_simple_emails: boolean;
    can_follow_up: boolean;
    human_validation_required_for_sensitive: boolean;
  };
  messaging: {
    sender_email: string;
    sender_display_name: string;
    reply_to: string;
    signature: string;
    sending_policy: string;
  };
  memory: {
    preferred_phrases: string;
    reference_notes: string;
    templates_notes: string;
  };
};

const DEFAULT_PAYLOAD: SetupPayload = {
  identity: {
    company_name: "",
    sector: "",
    company_size: "",
    languages: "FranÃ§ais",
    hr_context: "",
  },
  people: {
    leader_name: "",
    hr_owner_name: "",
    managers: "",
    validators: "",
    validation_flow: "",
  },
  communication: {
    global_tone: "Professionnel et humain",
    formality: "Ã‰quilibrÃ©",
    pronoun_style: "Vouvoiement",
    candidate_style: "",
    manager_style: "",
    internal_style: "",
  },
  policy: {
    recurring_documents: "",
    recurring_rules: "",
    sensitive_cases: "",
    allowed_actions: "",
    forbidden_actions: "",
  },
  autonomy: {
    can_prepare_only: true,
    can_send_simple_emails: false,
    can_follow_up: true,
    human_validation_required_for_sensitive: true,
  },
  messaging: {
    sender_email: "",
    sender_display_name: "Pierre",
    reply_to: "",
    signature: "",
    sending_policy: "",
  },
  memory: {
    preferred_phrases: "",
    reference_notes: "",
    templates_notes: "",
  },
};

function ActionButton({
  href,
  label,
  primary = false,
  icon,
}: {
  href: string;
  label: string;
  primary?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={[
        "inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium transition-all duration-[var(--cs-speed-fast)] ease-[var(--cs-ease-premium)]",
        "border",
        primary
          ? [
              "border-[color:color-mix(in_srgb,var(--cs-account-accent)_18%,white)]",
              "bg-[linear-gradient(135deg,color-mix(in_srgb,var(--cs-account-accent)_92%,white),color-mix(in_srgb,var(--cs-accent-blue)_30%,var(--cs-account-accent)))]",
              "text-white",
              "shadow-[0_18px_40px_color-mix(in_srgb,var(--cs-account-accent)_18%,transparent)]",
              "hover:-translate-y-0.5 hover:shadow-[0_24px_52px_color-mix(in_srgb,var(--cs-account-accent)_24%,transparent)]",
            ].join(" ")
          : [
              "border-[color:color-mix(in_srgb,var(--cs-line-soft)_68%,white)]",
              "bg-[linear-gradient(to_bottom,rgba(255,255,255,0.82),rgba(255,250,244,0.56))]",
              "text-[var(--cs-ink-2)]",
              "hover:-translate-y-0.5 hover:bg-white/92",
            ].join(" "),
      ].join(" ")}
    >
      {label}
      {icon}
    </Link>
  );
}

function SectionTitle({
  kicker,
  title,
  text,
}: {
  kicker: string;
  title: string;
  text: string;
}) {
  return (
    <div className="max-w-3xl space-y-3">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--cs-ink-4)]">
        {kicker}
      </p>
      <h2 className="cs-heading text-2xl md:text-4xl">{title}</h2>
      <p className="text-sm text-[var(--cs-ink-4)] md:text-base">{text}</p>
    </div>
  );
}

function InfoCard({
  title,
  text,
  icon,
  tone = "violet",
}: {
  title: string;
  text: string;
  icon: React.ReactNode;
  tone?: "violet" | "blue" | "rose" | "green";
}) {
  const toneClass =
    tone === "violet"
      ? "text-[var(--cs-account-accent)]"
      : tone === "blue"
        ? "text-[var(--cs-info)]"
        : tone === "rose"
          ? "text-[var(--cs-danger)]"
          : "text-[var(--cs-success)]";

  return (
    <div className="cs-card h-full">
      <div className="relative flex h-full flex-col gap-4">
        <div className={`flex items-center gap-2 ${toneClass}`}>
          {icon}
          <span className="text-sm font-medium text-[var(--cs-ink-2)]">
            {title}
          </span>
        </div>
        <p className="text-sm text-[var(--cs-ink-4)]">{text}</p>
      </div>
    </div>
  );
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="cs-panel">
      <div className="space-y-5">
        <div className="space-y-2">
          <h3 className="text-xl font-semibold tracking-[-0.03em] text-[var(--cs-ink-1)]">
            {title}
          </h3>
          <p className="text-sm text-[var(--cs-ink-4)]">{description}</p>
        </div>
        <div className="grid gap-4">{children}</div>
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  icon,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  icon: React.ReactNode;
  type?: string;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-[var(--cs-ink-2)]">{label}</span>
      <div className="flex items-center gap-3 rounded-[1.2rem] border border-[color:color-mix(in_srgb,var(--cs-line-soft)_68%,white)] bg-[linear-gradient(to_bottom,rgba(255,255,255,0.78),rgba(255,250,244,0.52))] px-4 py-3 shadow-[var(--cs-shadow-soft)]">
        <span className="text-[var(--cs-account-accent)]">{icon}</span>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full border-0 bg-transparent text-sm text-[var(--cs-ink-2)] outline-none placeholder:text-[var(--cs-ink-4)]"
        />
      </div>
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  rows = 5,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  rows?: number;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-[var(--cs-ink-2)]">{label}</span>
      <textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-h-[120px] w-full resize-y rounded-[1.2rem] border border-[color:color-mix(in_srgb,var(--cs-line-soft)_68%,white)] bg-[linear-gradient(to_bottom,rgba(255,255,255,0.78),rgba(255,250,244,0.52))] px-4 py-3 text-sm text-[var(--cs-ink-2)] outline-none placeholder:text-[var(--cs-ink-4)] shadow-[var(--cs-shadow-soft)]"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-[var(--cs-ink-2)]">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-[1.2rem] border border-[color:color-mix(in_srgb,var(--cs-line-soft)_68%,white)] bg-[linear-gradient(to_bottom,rgba(255,255,255,0.78),rgba(255,250,244,0.52))] px-4 py-3 text-sm text-[var(--cs-ink-2)] outline-none shadow-[var(--cs-shadow-soft)]"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function ToggleField({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="cs-card text-left"
    >
      <div className="relative flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-[var(--cs-ink-1)]">{label}</p>
          <p className="text-sm text-[var(--cs-ink-4)]">{description}</p>
        </div>

        <div
          className={[
            "relative h-7 w-12 rounded-full border transition",
            checked
              ? "border-[color:color-mix(in_srgb,var(--cs-account-accent)_24%,white)] bg-[color:color-mix(in_srgb,var(--cs-account-accent)_18%,white)]"
              : "border-[color:color-mix(in_srgb,var(--cs-line-soft)_68%,white)] bg-white/65",
          ].join(" ")}
        >
          <span
            className={[
              "absolute top-1 h-5 w-5 rounded-full bg-white shadow-[var(--cs-shadow-soft)] transition",
              checked ? "left-6" : "left-1",
            ].join(" ")}
          />
        </div>
      </div>
    </button>
  );
}

function extractPayload(data: unknown): SetupPayload | null {
  if (!data || typeof data !== "object") return null;

  const record = data as Record<string, unknown>;
  const source =
    (record.data as Record<string, unknown> | undefined) ||
    (record.profile as Record<string, unknown> | undefined) ||
    (record.memory as Record<string, unknown> | undefined) ||
    record;

  const getSection = (key: keyof SetupPayload) => {
    const section = source[key];
    if (section && typeof section === "object") {
      return section as Record<string, unknown>;
    }
    return null;
  };

  const identity = getSection("identity");
  const people = getSection("people");
  const communication = getSection("communication");
  const policy = getSection("policy");
  const autonomy = getSection("autonomy");
  const messaging = getSection("messaging");
  const memory = getSection("memory");

  if (
    !identity &&
    !people &&
    !communication &&
    !policy &&
    !autonomy &&
    !messaging &&
    !memory
  ) {
    return null;
  }

  const payload: SetupPayload = {
    identity: {
      company_name: String(identity?.company_name ?? DEFAULT_PAYLOAD.identity.company_name),
      sector: String(identity?.sector ?? DEFAULT_PAYLOAD.identity.sector),
      company_size: String(identity?.company_size ?? DEFAULT_PAYLOAD.identity.company_size),
      languages: String(identity?.languages ?? DEFAULT_PAYLOAD.identity.languages),
      hr_context: String(identity?.hr_context ?? DEFAULT_PAYLOAD.identity.hr_context),
    },
    people: {
      leader_name: String(people?.leader_name ?? DEFAULT_PAYLOAD.people.leader_name),
      hr_owner_name: String(people?.hr_owner_name ?? DEFAULT_PAYLOAD.people.hr_owner_name),
      managers: String(people?.managers ?? DEFAULT_PAYLOAD.people.managers),
      validators: String(people?.validators ?? DEFAULT_PAYLOAD.people.validators),
      validation_flow: String(
        people?.validation_flow ?? DEFAULT_PAYLOAD.people.validation_flow,
      ),
    },
    communication: {
      global_tone: String(
        communication?.global_tone ?? DEFAULT_PAYLOAD.communication.global_tone,
      ),
      formality: String(communication?.formality ?? DEFAULT_PAYLOAD.communication.formality),
      pronoun_style: String(
        communication?.pronoun_style ?? DEFAULT_PAYLOAD.communication.pronoun_style,
      ),
      candidate_style: String(
        communication?.candidate_style ?? DEFAULT_PAYLOAD.communication.candidate_style,
      ),
      manager_style: String(
        communication?.manager_style ?? DEFAULT_PAYLOAD.communication.manager_style,
      ),
      internal_style: String(
        communication?.internal_style ?? DEFAULT_PAYLOAD.communication.internal_style,
      ),
    },
    policy: {
      recurring_documents: String(
        policy?.recurring_documents ?? DEFAULT_PAYLOAD.policy.recurring_documents,
      ),
      recurring_rules: String(
        policy?.recurring_rules ?? DEFAULT_PAYLOAD.policy.recurring_rules,
      ),
      sensitive_cases: String(
        policy?.sensitive_cases ?? DEFAULT_PAYLOAD.policy.sensitive_cases,
      ),
      allowed_actions: String(
        policy?.allowed_actions ?? DEFAULT_PAYLOAD.policy.allowed_actions,
      ),
      forbidden_actions: String(
        policy?.forbidden_actions ?? DEFAULT_PAYLOAD.policy.forbidden_actions,
      ),
    },
    autonomy: {
      can_prepare_only: Boolean(
        autonomy?.can_prepare_only ?? DEFAULT_PAYLOAD.autonomy.can_prepare_only,
      ),
      can_send_simple_emails: Boolean(
        autonomy?.can_send_simple_emails ??
          DEFAULT_PAYLOAD.autonomy.can_send_simple_emails,
      ),
      can_follow_up: Boolean(
        autonomy?.can_follow_up ?? DEFAULT_PAYLOAD.autonomy.can_follow_up,
      ),
      human_validation_required_for_sensitive: Boolean(
        autonomy?.human_validation_required_for_sensitive ??
          DEFAULT_PAYLOAD.autonomy.human_validation_required_for_sensitive,
      ),
    },
    messaging: {
      sender_email: String(
        messaging?.sender_email ?? DEFAULT_PAYLOAD.messaging.sender_email,
      ),
      sender_display_name: String(
        messaging?.sender_display_name ?? DEFAULT_PAYLOAD.messaging.sender_display_name,
      ),
      reply_to: String(messaging?.reply_to ?? DEFAULT_PAYLOAD.messaging.reply_to),
      signature: String(messaging?.signature ?? DEFAULT_PAYLOAD.messaging.signature),
      sending_policy: String(
        messaging?.sending_policy ?? DEFAULT_PAYLOAD.messaging.sending_policy,
      ),
    },
    memory: {
      preferred_phrases: String(
        memory?.preferred_phrases ?? DEFAULT_PAYLOAD.memory.preferred_phrases,
      ),
      reference_notes: String(
        memory?.reference_notes ?? DEFAULT_PAYLOAD.memory.reference_notes,
      ),
      templates_notes: String(
        memory?.templates_notes ?? DEFAULT_PAYLOAD.memory.templates_notes,
      ),
    },
  };

  return payload;
}

export default function PierreSetupPage() {
  const [form, setForm] = useState<SetupPayload>(DEFAULT_PAYLOAD);
  const [loadState, setLoadState] = useState<SaveState>("idle");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [loadMessage, setLoadMessage] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadInitialData() {
      setLoadState("loading");
      setLoadMessage(null);

      try {
        const response = await fetch("/api/pierre/onboarding", {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          if (response.status === 404 || response.status === 405) {
            if (!active) return;
            setLoadState("idle");
            return;
          }
          throw new Error("Impossible de charger la configuration actuelle.");
        }

        const data = await response.json();
        const extracted = extractPayload(data);

        if (active && extracted) {
          setForm(extracted);
        }

        if (active) {
          setLoadState("success");
        }
      } catch (error) {
        if (!active) return;
        setLoadState("error");
        setLoadMessage(
          error instanceof Error
            ? error.message
            : "Chargement impossible pour le moment.",
        );
      }
    }

    loadInitialData();

    return () => {
      active = false;
    };
  }, []);

  const companyReadyScore = useMemo(() => {
    let score = 0;
    if (form.identity.company_name.trim()) score += 1;
    if (form.people.leader_name.trim()) score += 1;
    if (form.communication.global_tone.trim()) score += 1;
    if (form.messaging.sender_email.trim()) score += 1;
    if (form.policy.allowed_actions.trim()) score += 1;
    return score;
  }, [form]);

  const completionLabel = useMemo(() => {
    if (companyReadyScore <= 1) return "DÃ©but";
    if (companyReadyScore <= 3) return "En cours";
    return "Bien avancÃ©";
  }, [companyReadyScore]);

  function updateSection<K extends keyof SetupPayload>(
    section: K,
    field: keyof SetupPayload[K],
    value: SetupPayload[K][keyof SetupPayload[K]],
  ) {
    setForm((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveState("loading");
    setSaveMessage(null);

    try {
      const response = await fetch("/api/pierre/onboarding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.error ||
            data?.message ||
            "Impossible dâ€™enregistrer cette configuration pour le moment.",
        );
      }

      setSaveState("success");
      setSaveMessage(
        "Empreinte Entreprise enregistrÃ©e. Pierre peut maintenant sâ€™appuyer sur cette base de travail.",
      );
    } catch (error) {
      setSaveState("error");
      setSaveMessage(
        error instanceof Error
          ? error.message
          : "Impossible dâ€™enregistrer cette configuration pour le moment.",
      );
    }
  }

  return (
    <div className="cs-page-shell py-10 md:py-14">
      <div className="space-y-6">
        <section className="cs-command-surface overflow-hidden">
          <div className="cs-system-halo" />

          <div className="relative grid gap-6 xl:grid-cols-[1.04fr_0.96fr] xl:items-start">
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="cs-pill">
                  <Settings2 className="h-3.5 w-3.5 text-[var(--cs-account-accent)]" />
                  <span>Empreinte Entreprise</span>
                </span>
                <span className="cs-pill">
                  <BriefcaseBusiness className="h-3.5 w-3.5 text-[var(--cs-success)]" />
                  <span>Setup maÃ®tre de Pierre</span>
                </span>
              </div>

              <div className="space-y-4">
                <h1 className="cs-heading text-3xl md:text-5xl">
                  Configurez Pierre
                  <br />
                  <span className="cs-gradient-text">
                    comme un vrai collaborateur de votre entreprise.
                  </span>
                </h1>

                <p className="max-w-3xl text-sm text-[var(--cs-ink-4)] md:text-base">
                  Cette page ne doit pas Ãªtre un formulaire banal. Elle doit
                  servir Ã  transmettre Ã  Pierre votre identitÃ©, votre ton, vos
                  rÃ¨gles, vos valideurs, votre messagerie et votre maniÃ¨re de
                  travailler, pour quâ€™il agisse comme votre entreprise et non
                  comme une IA gÃ©nÃ©rique.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <ActionButton
                  href="/agents/pierre/use"
                  label="Utiliser Pierre"
                  primary
                  icon={<ArrowRight className="h-4 w-4" />}
                />
                <ActionButton
                  href="/profile"
                  label="Retour cockpit"
                  icon={<Waypoints className="h-4 w-4" />}
                />
                <ActionButton
                  href="/questions"
                  label="Assistant"
                  icon={<Bot className="h-4 w-4" />}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <InfoCard
                  title="Base CloneADN"
                  text="Cette configuration devient la base de comportement de Pierre."
                  icon={<Sparkles className="h-4 w-4" />}
                  tone="violet"
                />
                <InfoCard
                  title="Pilotage"
                  text="Tout doit rester modifiable proprement Ã  tout moment."
                  icon={<UserCheck className="h-4 w-4" />}
                  tone="blue"
                />
                <InfoCard
                  title="Gouvernance"
                  text="Autonomie, validation et identitÃ© doivent Ãªtre cadrÃ©es dÃ¨s le dÃ©part."
                  icon={<ShieldCheck className="h-4 w-4" />}
                  tone="green"
                />
              </div>
            </div>

            <div className="grid gap-4">
              <div className="cs-card">
                <div className="relative space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--cs-ink-1)]">
                        Avancement de lâ€™empreinte
                      </p>
                      <p className="mt-1 text-sm text-[var(--cs-ink-4)]">
                        Une lecture simple de votre niveau de configuration.
                      </p>
                    </div>
                    <span className="cs-status cs-status--info">{completionLabel}</span>
                  </div>

                  <div className="space-y-2">
                    <div className="h-3 overflow-hidden rounded-full bg-[rgba(20,20,22,0.06)]">
                      <div
                        className="h-full rounded-full bg-[linear-gradient(90deg,color-mix(in_srgb,var(--cs-account-accent)_92%,white),color-mix(in_srgb,var(--cs-accent-blue)_46%,var(--cs-account-accent)))] transition-all"
                        style={{ width: `${(companyReadyScore / 5) * 100}%` }}
                      />
                    </div>
                    <p className="text-xs text-[var(--cs-ink-4)]">
                      {companyReadyScore}/5 Ã©lÃ©ments clÃ©s renseignÃ©s
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <InfoCard
                  title="Modifiable"
                  text="Lâ€™empreinte nâ€™est jamais figÃ©e. Elle doit Ã©voluer avec lâ€™entreprise."
                  icon={<Clock3 className="h-4 w-4" />}
                  tone="violet"
                />
                <InfoCard
                  title="Messagerie rÃ©elle"
                  text="Pierre doit pouvoir Ãªtre branchÃ© Ã  une vraie identitÃ© email."
                  icon={<Mail className="h-4 w-4" />}
                  tone="blue"
                />
              </div>

              <div className="cs-card">
                <div className="relative space-y-3">
                  <p className="text-sm font-semibold text-[var(--cs-ink-1)]">
                    Ã‰tat du chargement initial
                  </p>
                  <p className="text-sm text-[var(--cs-ink-4)]">
                    {loadState === "loading"
                      ? "Chargement de la configuration actuelleâ€¦"
                      : loadState === "success"
                        ? "Configuration existante chargÃ©e si elle Ã©tait disponible."
                        : loadState === "error"
                          ? loadMessage || "Chargement impossible."
                          : "Aucune erreur dÃ©tectÃ©e."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <form onSubmit={handleSave} className="space-y-6">
          <FormSection
            title="1. IdentitÃ© entreprise"
            description="Le socle de Pierre : qui vous Ãªtes, dans quel contexte RH il travaille, et dans quelles langues il doit opÃ©rer."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Nom de lâ€™entreprise"
                value={form.identity.company_name}
                onChange={(value) => updateSection("identity", "company_name", value)}
                placeholder="Exemple : Cultura"
                icon={<Building2 className="h-4 w-4" />}
              />
              <Field
                label="Secteur"
                value={form.identity.sector}
                onChange={(value) => updateSection("identity", "sector", value)}
                placeholder="Exemple : Distribution culturelle"
                icon={<BriefcaseBusiness className="h-4 w-4" />}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <SelectField
                label="Taille dâ€™entreprise"
                value={form.identity.company_size}
                onChange={(value) => updateSection("identity", "company_size", value)}
                options={[
                  "",
                  "TPE",
                  "PME",
                  "ETI",
                  "Grande entreprise",
                ]}
              />
              <Field
                label="Langues utilisÃ©es"
                value={form.identity.languages}
                onChange={(value) => updateSection("identity", "languages", value)}
                placeholder="FranÃ§ais, anglaisâ€¦"
                icon={<MessageSquareMore className="h-4 w-4" />}
              />
            </div>

            <TextAreaField
              label="Contexte RH global"
              value={form.identity.hr_context}
              onChange={(value) => updateSection("identity", "hr_context", value)}
              placeholder="DÃ©cris briÃ¨vement le contexte RH : volume de recrutement, structure, prioritÃ©s, contraintes, organisation actuelleâ€¦"
            />
          </FormSection>

          <FormSection
            title="2. Organisation humaine et validations"
            description="Pierre doit savoir qui pilote, qui valide, et comment les dÃ©cisions ou validations circulent dans lâ€™entreprise."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Dirigeant / dÃ©cideur principal"
                value={form.people.leader_name}
                onChange={(value) => updateSection("people", "leader_name", value)}
                placeholder="Nom du dÃ©cideur principal"
                icon={<Users className="h-4 w-4" />}
              />
              <Field
                label="Responsable RH / propriÃ©taire opÃ©rationnel"
                value={form.people.hr_owner_name}
                onChange={(value) => updateSection("people", "hr_owner_name", value)}
                placeholder="Nom du responsable RH"
                icon={<UserCheck className="h-4 w-4" />}
              />
            </div>

            <TextAreaField
              label="Managers concernÃ©s"
              value={form.people.managers}
              onChange={(value) => updateSection("people", "managers", value)}
              placeholder="Liste ou notes sur les managers concernÃ©s par Pierreâ€¦"
              rows={4}
            />

            <TextAreaField
              label="Valideurs"
              value={form.people.validators}
              onChange={(value) => updateSection("people", "validators", value)}
              placeholder="Qui valide quoi ? Noms, rÃ´les, cas concernÃ©sâ€¦"
              rows={4}
            />

            <TextAreaField
              label="Circuit de validation"
              value={form.people.validation_flow}
              onChange={(value) => updateSection("people", "validation_flow", value)}
              placeholder="DÃ©cris le circuit : exemples de cas, ordre de validation, exceptions, dÃ©lais attendusâ€¦"
              rows={4}
            />
          </FormSection>

          <FormSection
            title="3. Communication et ton"
            description="Câ€™est ici que Pierre apprend Ã  parler comme votre entreprise."
          >
            <div className="grid gap-4 md:grid-cols-3">
              <SelectField
                label="Ton global"
                value={form.communication.global_tone}
                onChange={(value) => updateSection("communication", "global_tone", value)}
                options={[
                  "Professionnel et humain",
                  "TrÃ¨s corporate",
                  "Chaleureux et direct",
                  "Formel et prudent",
                  "Simple et accessible",
                ]}
              />
              <SelectField
                label="Niveau de formalitÃ©"
                value={form.communication.formality}
                onChange={(value) => updateSection("communication", "formality", value)}
                options={[
                  "Ã‰quilibrÃ©",
                  "TrÃ¨s formel",
                  "PlutÃ´t simple",
                  "TrÃ¨s chaleureux",
                ]}
              />
              <SelectField
                label="Tutoiement / vouvoiement"
                value={form.communication.pronoun_style}
                onChange={(value) => updateSection("communication", "pronoun_style", value)}
                options={[
                  "Vouvoiement",
                  "Tutoiement",
                  "Selon le destinataire",
                ]}
              />
            </div>

            <TextAreaField
              label="Style candidat"
              value={form.communication.candidate_style}
              onChange={(value) => updateSection("communication", "candidate_style", value)}
              placeholder="Comment Pierre doit-il sâ€™adresser aux candidats ?"
              rows={4}
            />

            <TextAreaField
              label="Style manager"
              value={form.communication.manager_style}
              onChange={(value) => updateSection("communication", "manager_style", value)}
              placeholder="Comment Pierre doit-il sâ€™adresser aux managers ?"
              rows={4}
            />

            <TextAreaField
              label="Style interne"
              value={form.communication.internal_style}
              onChange={(value) => updateSection("communication", "internal_style", value)}
              placeholder="Comment Pierre doit-il formuler les communications internes ?"
              rows={4}
            />
          </FormSection>

          <FormSection
            title="4. RÃ¨gles RH et pÃ©rimÃ¨tre autorisÃ©"
            description="Pierre doit savoir ce quâ€™il fait souvent, ce quâ€™il peut faire, et ce quâ€™il ne doit jamais exÃ©cuter seul."
          >
            <TextAreaField
              label="Documents rÃ©currents"
              value={form.policy.recurring_documents}
              onChange={(value) => updateSection("policy", "recurring_documents", value)}
              placeholder="Convocations, refus, relances, onboarding, rappels de procÃ©dureâ€¦"
              rows={4}
            />

            <TextAreaField
              label="RÃ¨gles rÃ©currentes"
              value={form.policy.recurring_rules}
              onChange={(value) => updateSection("policy", "recurring_rules", value)}
              placeholder="DÃ©lais de relance, types de cas frÃ©quents, habitudes de fonctionnementâ€¦"
              rows={4}
            />

            <TextAreaField
              label="Cas sensibles"
              value={form.policy.sensitive_cases}
              onChange={(value) => updateSection("policy", "sensitive_cases", value)}
              placeholder="Quels cas exigent toujours validation humaine ?"
              rows={4}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <TextAreaField
                label="Actions autorisÃ©es"
                value={form.policy.allowed_actions}
                onChange={(value) => updateSection("policy", "allowed_actions", value)}
                placeholder="Ce que Pierre peut faire seul ou prÃ©parer."
                rows={5}
              />
              <TextAreaField
                label="Actions interdites"
                value={form.policy.forbidden_actions}
                onChange={(value) => updateSection("policy", "forbidden_actions", value)}
                placeholder="Ce que Pierre ne doit jamais faire."
                rows={5}
              />
            </div>
          </FormSection>

          <FormSection
            title="5. ParamÃ¨tres dâ€™autonomie"
            description="Lâ€™autonomie doit Ãªtre puissante mais gouvernÃ©e."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <ToggleField
                label="PrÃ©parer sans envoyer par dÃ©faut"
                description="Pierre peut prÃ©parer les documents et emails sans les envoyer automatiquement."
                checked={form.autonomy.can_prepare_only}
                onChange={(checked) =>
                  updateSection("autonomy", "can_prepare_only", checked)
                }
              />
              <ToggleField
                label="Envoi dâ€™emails simples autorisÃ©"
                description="Autoriser Pierre Ã  envoyer certains emails simples, si le cadre interne le permet."
                checked={form.autonomy.can_send_simple_emails}
                onChange={(checked) =>
                  updateSection("autonomy", "can_send_simple_emails", checked)
                }
              />
              <ToggleField
                label="Relances automatiques autorisÃ©es"
                description="Autoriser Pierre Ã  relancer automatiquement dans le cadre dÃ©fini."
                checked={form.autonomy.can_follow_up}
                onChange={(checked) =>
                  updateSection("autonomy", "can_follow_up", checked)
                }
              />
              <ToggleField
                label="Validation humaine obligatoire sur le sensible"
                description="Les cas sensibles remontent toujours avant exÃ©cution."
                checked={form.autonomy.human_validation_required_for_sensitive}
                onChange={(checked) =>
                  updateSection(
                    "autonomy",
                    "human_validation_required_for_sensitive",
                    checked,
                  )
                }
              />
            </div>
          </FormSection>

          <FormSection
            title="6. IdentitÃ© de messagerie"
            description="Pierre doit paraÃ®tre rÃ©ellement intÃ©grÃ© Ã  lâ€™entreprise, avec une identitÃ© mail claire et contrÃ´lÃ©e."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Adresse email liÃ©e"
                value={form.messaging.sender_email}
                onChange={(value) => updateSection("messaging", "sender_email", value)}
                placeholder="pierre@entreprise.com"
                icon={<Mail className="h-4 w-4" />}
                type="email"
              />
              <Field
                label="Nom dâ€™affichage"
                value={form.messaging.sender_display_name}
                onChange={(value) =>
                  updateSection("messaging", "sender_display_name", value)
                }
                placeholder="Pierre / RH Entreprise"
                icon={<Users className="h-4 w-4" />}
              />
            </div>

            <Field
              label="Reply-to"
              value={form.messaging.reply_to}
              onChange={(value) => updateSection("messaging", "reply_to", value)}
              placeholder="recrutement@entreprise.com"
              icon={<Mail className="h-4 w-4" />}
              type="email"
            />

            <TextAreaField
              label="Signature"
              value={form.messaging.signature}
              onChange={(value) => updateSection("messaging", "signature", value)}
              placeholder="Signature email de Pierreâ€¦"
              rows={4}
            />

            <TextAreaField
              label="Politique dâ€™envoi"
              value={form.messaging.sending_policy}
              onChange={(value) => updateSection("messaging", "sending_policy", value)}
              placeholder="Dans quels cas Pierre peut envoyer ? Dans quels cas il prÃ©pare seulement ?"
              rows={4}
            />
          </FormSection>

          <FormSection
            title="7. MÃ©moire utile et rÃ©fÃ©rences"
            description="Ajoute ici ce que Pierre doit garder en tÃªte pour mieux sâ€™aligner sur votre entreprise."
          >
            <TextAreaField
              label="Formulations et phrases prÃ©fÃ©rÃ©es"
              value={form.memory.preferred_phrases}
              onChange={(value) => updateSection("memory", "preferred_phrases", value)}
              placeholder="Exemples de formulations, expressions, styles prÃ©fÃ©rÃ©sâ€¦"
              rows={4}
            />

            <TextAreaField
              label="Notes de rÃ©fÃ©rence"
              value={form.memory.reference_notes}
              onChange={(value) => updateSection("memory", "reference_notes", value)}
              placeholder="Informations importantes Ã  rÃ©utiliser rÃ©guliÃ¨rementâ€¦"
              rows={5}
            />

            <TextAreaField
              label="Templates / remarques utiles"
              value={form.memory.templates_notes}
              onChange={(value) => updateSection("memory", "templates_notes", value)}
              placeholder="Notes sur les modÃ¨les de documents, habitudes dâ€™onboarding, rÃ¨gles de formeâ€¦"
              rows={5}
            />
          </FormSection>

          <section className="cs-panel overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_top,color-mix(in_srgb,var(--cs-account-accent)_12%,transparent),transparent_72%)]" />

            <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--cs-ink-4)]">
                  Enregistrement
                </p>
                <h3 className="cs-heading text-2xl">
                  Enregistrer lâ€™Empreinte Entreprise de Pierre
                </h3>
                <p className="max-w-2xl text-sm text-[var(--cs-ink-4)]">
                  Cette base doit ensuite nourrir Pierre, son comportement, sa
                  mÃ©moire dâ€™entreprise, ses validations et ses futures missions.
                </p>

                {saveMessage ? (
                  <p
                    className={[
                      "text-sm",
                      saveState === "error"
                        ? "text-[var(--cs-danger)]"
                        : "text-[var(--cs-success)]",
                    ].join(" ")}
                  >
                    {saveMessage}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={saveState === "loading"}
                  className={[
                    "inline-flex h-12 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium transition-all duration-[var(--cs-speed-fast)] ease-[var(--cs-ease-premium)]",
                    "border",
                    saveState === "loading"
                      ? "border-[color:color-mix(in_srgb,var(--cs-line-soft)_68%,white)] bg-[linear-gradient(to_bottom,rgba(255,255,255,0.62),rgba(255,249,242,0.42))] text-[var(--cs-ink-4)] opacity-80"
                      : "border-[color:color-mix(in_srgb,var(--cs-account-accent)_18%,white)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--cs-account-accent)_92%,white),color-mix(in_srgb,var(--cs-accent-blue)_30%,var(--cs-account-accent)))] text-white shadow-[0_18px_40px_color-mix(in_srgb,var(--cs-account-accent)_18%,transparent)] hover:-translate-y-0.5",
                  ].join(" ")}
                >
                  {saveState === "loading" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Enregistrementâ€¦</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      <span>Enregistrer</span>
                    </>
                  )}
                </button>

                <ActionButton
                  href="/agents/pierre/use"
                  label="Aller dans Pierre"
                  primary={false}
                  icon={<ArrowRight className="h-4 w-4" />}
                />
              </div>
            </div>
          </section>
        </form>

        <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <div className="cs-panel">
            <SectionTitle
              kicker="Pourquoi cette page est stratÃ©gique"
              title="Lâ€™onboarding de Pierre doit dÃ©jÃ  vendre sa profondeur."
              text="Cette page doit montrer que Pierre ne sort pas de nulle part : il apprend le ton, les rÃ¨gles, la messagerie, lâ€™autonomie et le cadre de lâ€™entreprise."
            />

            <div className="mt-6 grid gap-3">
              <InfoCard
                title="Empreinte forte"
                text="Pierre doit travailler comme votre entreprise, pas comme un modÃ¨le gÃ©nÃ©rique."
                icon={<Sparkles className="h-4 w-4" />}
                tone="violet"
              />
              <InfoCard
                title="ContrÃ´le rÃ©el"
                text="Le client doit sentir quâ€™il peut tout ajuster proprement."
                icon={<ShieldCheck className="h-4 w-4" />}
                tone="green"
              />
              <InfoCard
                title="ContinuitÃ©"
                text="Cette base conditionne ensuite la qualitÃ© des missions, des relances et des sorties."
                icon={<FileText className="h-4 w-4" />}
                tone="blue"
              />
            </div>
          </div>

          <div className="cs-panel">
            <SectionTitle
              kicker="RÃ¨gle produit"
              title="Ce nâ€™est pas un formulaire de plus. Câ€™est la matrice de Pierre."
              text="Le client doit comprendre que ce quâ€™il remplit ici nourrit rÃ©ellement le comportement, les validations, la voix Ã©crite et le niveau dâ€™autonomie de Pierre."
            />

            <div className="mt-6 grid gap-3">
              <InfoCard
                title="CloneADN"
                text="Lâ€™empreinte devient une base dâ€™alignement entreprise."
                icon={<Sparkles className="h-4 w-4" />}
                tone="violet"
              />
              <InfoCard
                title="CloneGuard"
                text="Les validations et interdits doivent Ãªtre visibles et cadrÃ©s ici."
                icon={<ShieldCheck className="h-4 w-4" />}
                tone="rose"
              />
              <InfoCard
                title="Messagerie rÃ©elle"
                text="Lâ€™identitÃ© email de Pierre doit Ãªtre un vrai levier de crÃ©dibilitÃ©."
                icon={<Mail className="h-4 w-4" />}
                tone="blue"
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
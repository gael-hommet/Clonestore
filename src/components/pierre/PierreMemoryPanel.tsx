"use client";

import * as React from "react";
import {
  Building2,
  CheckCircle2,
  Loader2,
  Mail,
  RefreshCw,
  Save,
  Settings2,
  Shield,
  Sparkles,
  UserRound,
} from "lucide-react";

import { cn } from "@/lib/utils";

type SenderIdentityResolved = {
  sender_name?: string | null;
  sender_email?: string | null;
  reply_to?: string | null;
  source?: string | null;
};

type PierreMemoryRecord = Record<string, unknown> | null | undefined;

type Props = {
  memory?: PierreMemoryRecord;
  loading?: boolean;
  saving?: boolean;
  onRefresh?: () => void | Promise<void>;
  onSave?: (payload: Record<string, unknown>) => void | Promise<void>;
  senderIdentityResolved?: SenderIdentityResolved | null;
};

type FormState = {
  company_name: string;
  company_tone: string;
  default_language: string;
  communication_style: string;
  candidate_tone: string;
  internal_tone: string;
  validation_mode: string;
  sender_name: string;
  sender_email: string;
  reply_to: string;
  hr_rules: string;
  signature: string;
};

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function buildInitialState(
  memory?: PierreMemoryRecord,
  resolved?: SenderIdentityResolved | null
): FormState {
  const source = record(memory);

  return {
    company_name: text(source?.company_name),
    company_tone: text(source?.company_tone, "professionnel"),
    default_language: text(source?.default_language, "fr"),
    communication_style: text(source?.communication_style, "clair, structurÃ©, fiable"),
    candidate_tone: text(source?.candidate_tone, "humain, professionnel, respectueux"),
    internal_tone: text(source?.internal_tone, "clair, direct, professionnel"),
    validation_mode: text(source?.validation_mode, "smart"),
    sender_name: text(source?.sender_name || resolved?.sender_name),
    sender_email: text(source?.sender_email || resolved?.sender_email),
    reply_to: text(source?.reply_to || resolved?.reply_to),
    hr_rules: text(source?.hr_rules),
    signature: text(source?.signature),
  };
}

function buildSavePayload(state: FormState) {
  return {
    company_name: state.company_name.trim() || null,
    company_tone: state.company_tone.trim() || null,
    default_language: state.default_language.trim() || "fr",
    communication_style: state.communication_style.trim() || null,
    candidate_tone: state.candidate_tone.trim() || null,
    internal_tone: state.internal_tone.trim() || null,
    validation_mode: state.validation_mode.trim() || "smart",
    sender_name: state.sender_name.trim() || null,
    sender_email: state.sender_email.trim() || null,
    reply_to: state.reply_to.trim() || null,
    hr_rules: state.hr_rules.trim() || null,
    signature: state.signature.trim() || null,
  };
}

function SectionCard({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[26px] border border-[#eadfce] bg-white p-5 shadow-[0_10px_30px_rgba(70,55,37,0.04)]">
      <div className="flex items-start gap-3">
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f4ebdf] text-[#6d573d]">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#241b12]">{title}</p>
          <p className="mt-1 text-sm leading-6 text-[#6b5b4b]">{subtitle}</p>
        </div>
      </div>

      <div className="mt-5">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-2">
        <p className="text-sm font-medium text-[#382d22]">{label}</p>
        {hint ? <p className="mt-1 text-xs leading-5 text-[#8a7764]">{hint}</p> : null}
      </div>
      {children}
    </label>
  );
}

function inputClass(multiline = false) {
  return cn(
    "w-full border border-[#e7d9c8] bg-white text-sm text-[#2a2118] outline-none transition placeholder:text-[#a18c77] focus:border-[#d8bd9d] focus:ring-4 focus:ring-[#f3e6d6]",
    multiline ? "min-h-[132px] rounded-[20px] px-4 py-3" : "h-12 rounded-[18px] px-4"
  );
}

function Pill({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "good" | "warn";
}) {
  return (
    <div
      className={cn(
        "rounded-[18px] border px-4 py-3",
        tone === "good" && "border-[#d7e8da] bg-[#edf8ef]",
        tone === "warn" && "border-[#ecd8b4] bg-[#fff8ea]",
        tone === "neutral" && "border-[#eadfce] bg-[#fffdf8]"
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9a856f]">{label}</p>
      <p className="mt-1 text-sm font-medium text-[#2b2118]">{value}</p>
    </div>
  );
}

export function PierreMemoryPanel({
  memory,
  loading = false,
  saving = false,
  onRefresh,
  onSave,
  senderIdentityResolved,
}: Props) {
  const [form, setForm] = React.useState<FormState>(() =>
    buildInitialState(memory, senderIdentityResolved)
  );

  const [dirty, setDirty] = React.useState(false);
  const [saveNotice, setSaveNotice] = React.useState<string | null>(null);

  React.useEffect(() => {
    setForm(buildInitialState(memory, senderIdentityResolved));
    setDirty(false);
  }, [memory, senderIdentityResolved]);

  const updateField = React.useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
      setDirty(true);
      setSaveNotice(null);
    },
    []
  );

  const handleResetResolvedIdentity = React.useCallback(() => {
    setForm((prev) => ({
      ...prev,
      sender_name: text(senderIdentityResolved?.sender_name),
      sender_email: text(senderIdentityResolved?.sender_email),
      reply_to: text(senderIdentityResolved?.reply_to),
    }));
    setDirty(true);
    setSaveNotice(null);
  }, [senderIdentityResolved]);

  const handleSave = React.useCallback(async () => {
    if (!onSave) return;

    const payload = buildSavePayload(form);
    await onSave(payload);
    setDirty(false);
    setSaveNotice("MÃ©moire entreprise mise Ã  jour.");
  }, [form, onSave]);

  const resolvedSource = senderIdentityResolved?.source || "inconnue";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-start gap-3">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f4ebdf] text-[#6d573d]">
            <Settings2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#241b12]">MÃ©moire entreprise Pierre</p>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[#6b5b4b]">
              Cette couche dÃ©termine le ton, les rÃ¨gles RH, lâ€™identitÃ© dâ€™envoi et le
              comportement par dÃ©faut de Pierre. Elle doit Ãªtre stable, crÃ©dible et
              suffisamment prÃ©cise pour homogÃ©nÃ©iser les futures missions.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void onRefresh?.()}
            className="inline-flex items-center gap-2 rounded-full border border-[#e5d7c7] bg-white px-4 py-2.5 text-sm font-semibold text-[#4c4033] transition hover:bg-[#fffaf3]"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Actualiser
          </button>

          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!dirty || saving}
            className="inline-flex items-center gap-2 rounded-full bg-[#2a2118] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1d160f] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Enregistrer
          </button>
        </div>
      </div>

      {saveNotice ? (
        <div className="rounded-[22px] border border-[#d7e8da] bg-[#edf8ef] px-4 py-3 text-sm text-[#2f6c43]">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            {saveNotice}
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="space-y-6">
          <SectionCard
            icon={Building2}
            title="IdentitÃ© entreprise"
            subtitle="Base de personnalitÃ© et de cohÃ©rence de Pierre."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nom de lâ€™entreprise" hint="Nom principal de la sociÃ©tÃ© servie par Pierre.">
                <input
                  value={form.company_name}
                  onChange={(e) => updateField("company_name", e.target.value)}
                  className={inputClass(false)}
                  placeholder="Exemple : Cultura"
                />
              </Field>

              <Field label="Langue par dÃ©faut" hint="Langue dominante de production.">
                <input
                  value={form.default_language}
                  onChange={(e) => updateField("default_language", e.target.value)}
                  className={inputClass(false)}
                  placeholder="fr"
                />
              </Field>

              <Field label="Ton entreprise" hint="Exemple : professionnel, humain, sobre, premium.">
                <input
                  value={form.company_tone}
                  onChange={(e) => updateField("company_tone", e.target.value)}
                  className={inputClass(false)}
                  placeholder="professionnel"
                />
              </Field>

              <Field
                label="Mode de validation"
                hint="Exemple : smart, toujours valider, jamais sans validation sur cas sensibles."
              >
                <input
                  value={form.validation_mode}
                  onChange={(e) => updateField("validation_mode", e.target.value)}
                  className={inputClass(false)}
                  placeholder="smart"
                />
              </Field>
            </div>

            <div className="mt-4">
              <Field
                label="Style de communication global"
                hint="DÃ©crit comment lâ€™entreprise veut apparaÃ®tre dans les communications RH."
              >
                <textarea
                  value={form.communication_style}
                  onChange={(e) => updateField("communication_style", e.target.value)}
                  className={inputClass(true)}
                  placeholder="Exemple : clair, rassurant, structurÃ©, fiable, sans excÃ¨s de familiaritÃ©."
                />
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            icon={Sparkles}
            title="TonalitÃ© mÃ©tier RH"
            subtitle="Affinage du comportement de Pierre selon la cible."
          >
            <div className="grid gap-4">
              <Field
                label="Ton candidat"
                hint="Comment Pierre doit parler aux candidats."
              >
                <textarea
                  value={form.candidate_tone}
                  onChange={(e) => updateField("candidate_tone", e.target.value)}
                  className={inputClass(true)}
                  placeholder="Exemple : humain, respectueux, professionnel, encourageant sans promesses excessives."
                />
              </Field>

              <Field
                label="Ton interne / managers"
                hint="Comment Pierre doit sâ€™adresser aux managers et interlocuteurs internes."
              >
                <textarea
                  value={form.internal_tone}
                  onChange={(e) => updateField("internal_tone", e.target.value)}
                  className={inputClass(true)}
                  placeholder="Exemple : direct, synthÃ©tique, structurÃ©, fiable, orientÃ© exÃ©cution."
                />
              </Field>

              <Field
                label="RÃ¨gles RH / garde-fous"
                hint="Rappels mÃ©tier que Pierre doit respecter en prioritÃ©."
              >
                <textarea
                  value={form.hr_rules}
                  onChange={(e) => updateField("hr_rules", e.target.value)}
                  className={inputClass(true)}
                  placeholder="Exemple : ne jamais inventer une donnÃ©e manquante, demander validation humaine sur les sujets sensibles, rester dans le pÃ©rimÃ¨tre RH simple."
                />
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            icon={Mail}
            title="IdentitÃ© dâ€™envoi"
            subtitle="Adresse et signature de communication utilisÃ©es par Pierre."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Nom dâ€™envoi"
                hint="Exemple : Pierre RH Â· Cultura"
              >
                <input
                  value={form.sender_name}
                  onChange={(e) => updateField("sender_name", e.target.value)}
                  className={inputClass(false)}
                  placeholder="Pierre RH"
                />
              </Field>

              <Field
                label="Email dâ€™envoi"
                hint="Peut Ãªtre une adresse pro, sous-domaine ou identitÃ© dÃ©diÃ©e."
              >
                <input
                  value={form.sender_email}
                  onChange={(e) => updateField("sender_email", e.target.value)}
                  className={inputClass(false)}
                  placeholder="pierre@entreprise.fr"
                />
              </Field>

              <div className="md:col-span-2">
                <Field
                  label="Reply-to"
                  hint="Adresse de rÃ©ponse prioritaire si diffÃ©rente de lâ€™adresse dâ€™envoi."
                >
                  <input
                    value={form.reply_to}
                    onChange={(e) => updateField("reply_to", e.target.value)}
                    className={inputClass(false)}
                    placeholder="rh@entreprise.fr"
                  />
                </Field>
              </div>
            </div>

            <div className="mt-4">
              <Field
                label="Signature"
                hint="Bloc de signature par dÃ©faut pour les emails et documents RH."
              >
                <textarea
                  value={form.signature}
                  onChange={(e) => updateField("signature", e.target.value)}
                  className={inputClass(true)}
                  placeholder={"Exemple :\nPierre\nAssistant RH automatisÃ©\nEntreprise\nCoordonnÃ©es utiles"}
                />
              </Field>
            </div>
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard
            icon={Shield}
            title="RÃ©sumÃ© opÃ©rationnel"
            subtitle="Lecture rapide de lâ€™Ã©tat actuel de la mÃ©moire entreprise."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Pill
                label="Entreprise"
                value={form.company_name || "Non dÃ©finie"}
                tone={form.company_name ? "good" : "warn"}
              />
              <Pill
                label="Langue"
                value={form.default_language || "fr"}
                tone="neutral"
              />
              <Pill
                label="Validation"
                value={form.validation_mode || "smart"}
                tone="neutral"
              />
              <Pill
                label="Email dâ€™envoi"
                value={form.sender_email || "Non dÃ©fini"}
                tone={form.sender_email ? "good" : "warn"}
              />
            </div>
          </SectionCard>

          <SectionCard
            icon={UserRound}
            title="IdentitÃ© rÃ©solue actuellement"
            subtitle="Ce que Pierre comprend aujourdâ€™hui comme identitÃ© effective."
          >
            <div className="space-y-3">
              <Pill
                label="Nom rÃ©solu"
                value={senderIdentityResolved?.sender_name || "Non dÃ©fini"}
                tone={senderIdentityResolved?.sender_name ? "good" : "warn"}
              />
              <Pill
                label="Email rÃ©solu"
                value={senderIdentityResolved?.sender_email || "Non dÃ©fini"}
                tone={senderIdentityResolved?.sender_email ? "good" : "warn"}
              />
              <Pill
                label="Reply-to rÃ©solu"
                value={senderIdentityResolved?.reply_to || "Non dÃ©fini"}
                tone="neutral"
              />
              <Pill
                label="Source"
                value={resolvedSource}
                tone="neutral"
              />
            </div>

            <div className="mt-4">
              <button
                type="button"
                onClick={handleResetResolvedIdentity}
                className="inline-flex items-center gap-2 rounded-full border border-[#e5d7c7] bg-white px-4 py-2.5 text-sm font-semibold text-[#4c4033] transition hover:bg-[#fffaf3]"
              >
                <RefreshCw className="h-4 w-4" />
                Reprendre lâ€™identitÃ© rÃ©solue
              </button>
            </div>
          </SectionCard>

          <SectionCard
            icon={Settings2}
            title="Lecture produit"
            subtitle="Ã€ quoi doit servir cette mÃ©moire dans le cockpit Pierre."
          >
            <div className="rounded-[20px] border border-[#eadfce] bg-[#fffdf8] p-4 text-sm leading-7 text-[#5f5144]">
              <p>
                Cette mÃ©moire ne doit pas Ãªtre un simple formulaire dÃ©coratif.
                Elle doit devenir le noyau de cohÃ©rence de Pierre :
                ton, identitÃ© dâ€™envoi, niveau de validation, rÃ¨gles RH, style
                candidat, style interne, signature et prÃ©fÃ©rences dâ€™entreprise.
              </p>
              <p className="mt-4">
                Plus cette couche est propre, plus Pierre devient perÃ§u comme un
                employÃ© RH fiable plutÃ´t quâ€™un simple outil de gÃ©nÃ©ration.
              </p>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

export default PierreMemoryPanel;
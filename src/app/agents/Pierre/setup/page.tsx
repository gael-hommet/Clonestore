"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabaseBrowser } from "@/lib/supabase";

type PierreOnboardingForm = {
  company_name: string;
  legal_company_name: string;
  company_email_domain: string;
  company_website: string;
  company_phone: string;
  company_address: string;
  company_city: string;
  company_postal_code: string;
  company_country: string;
  company_siren: string;
  company_size: string;
  company_industry: string;
  company_description: string;

  contact_first_name: string;
  contact_last_name: string;
  contact_job_title: string;
  contact_email: string;
  contact_phone: string;

  hr_team_size: string;
  recruitment_volume: string;
  main_hr_needs: string;
  typical_document_types: string;
  usual_tone: string;
  preferred_language: string;
  signature_name: string;
  signature_job_title: string;
  signature_email: string;
  signature_phone: string;
  default_email_footer: string;

  sender_mode: string;
  sender_email_requested: string;
  sender_email_effective: string;
  reply_to_email: string;
  sender_status: string;
  domain_status: string;
  domain_name: string;
  postmark_domain_id: string;
  postmark_signature_id: string;

  legal_mentions: string;
  confidentiality_notes: string;
  forbidden_words: string;
  mandatory_words: string;
  internal_policy_notes: string;

  onboarding_completed: boolean;
};

function defaultForm(): PierreOnboardingForm {
  return {
    company_name: "",
    legal_company_name: "",
    company_email_domain: "",
    company_website: "",
    company_phone: "",
    company_address: "",
    company_city: "",
    company_postal_code: "",
    company_country: "France",
    company_siren: "",
    company_size: "",
    company_industry: "",
    company_description: "",

    contact_first_name: "",
    contact_last_name: "",
    contact_job_title: "",
    contact_email: "",
    contact_phone: "",

    hr_team_size: "",
    recruitment_volume: "",
    main_hr_needs: "",
    typical_document_types: "",
    usual_tone: "professionnel",
    preferred_language: "fr",
    signature_name: "",
    signature_job_title: "",
    signature_email: "",
    signature_phone: "",
    default_email_footer: "",

    sender_mode: "clonestore_fallback",
    sender_email_requested: "",
    sender_email_effective: "clonestore@clonestore.pro",
    reply_to_email: "",
    sender_status: "draft",
    domain_status: "not_started",
    domain_name: "",
    postmark_domain_id: "",
    postmark_signature_id: "",

    legal_mentions: "",
    confidentiality_notes: "",
    forbidden_words: "",
    mandatory_words: "",
    internal_policy_notes: "",

    onboarding_completed: false,
  };
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-medium">{children}</p>;
}

function Helper({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-background/60 p-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}

export default function PierreSetupPage() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState<PierreOnboardingForm>(defaultForm());

  const setField = useCallback(
    <K extends keyof PierreOnboardingForm>(key: K, value: PierreOnboardingForm[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const load = useCallback(async () => {
    if (!supabase) {
      setErr("Supabase navigateur non configuré.");
      setLoading(false);
      return;
    }

    setErr(null);
    setMsg(null);
    setLoading(true);

    try {
      const { data: sessionRes, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr) {
        setErr(sessionErr.message);
        setLoading(false);
        return;
      }

      const token = sessionRes.session?.access_token || "";
      if (!token) {
        setErr("Session manquante. Reconnecte-toi.");
        setLoading(false);
        return;
      }

      const res = await fetch("/api/pierre/onboarding", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        onboarding?: Partial<PierreOnboardingForm> | null;
      };

      if (!res.ok) {
        setErr(data.error || "Chargement impossible.");
        setLoading(false);
        return;
      }

      if (data.onboarding) {
        setForm({
          ...defaultForm(),
          ...data.onboarding,
        });
      }

      setLoading(false);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Chargement impossible.");
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const save = useCallback(
    async (complete: boolean) => {
      if (!supabase) {
        setErr("Supabase navigateur non configuré.");
        return;
      }

      setErr(null);
      setMsg(null);
      setSaving(true);

      try {
        const { data: sessionRes, error: sessionErr } = await supabase.auth.getSession();
        if (sessionErr) {
          setSaving(false);
          setErr(sessionErr.message);
          return;
        }

        const token = sessionRes.session?.access_token || "";
        if (!token) {
          setSaving(false);
          setErr("Session manquante. Reconnecte-toi.");
          return;
        }

        const payload = {
          ...form,
          onboarding_completed: complete,
        };

        const res = await fetch("/api/pierre/onboarding", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          onboarding?: PierreOnboardingForm;
        };

        if (!res.ok) {
          setSaving(false);
          setErr(data.error || "Sauvegarde impossible.");
          return;
        }

        if (data.onboarding) {
          setForm({
            ...defaultForm(),
            ...data.onboarding,
          });
        }

        setSaving(false);
        setMsg(
          complete
            ? "Formulaire 1 enregistré et marqué comme terminé."
            : "Brouillon enregistré."
        );
      } catch (e: unknown) {
        setSaving(false);
        setErr(e instanceof Error ? e.message : "Sauvegarde impossible.");
      }
    },
    [form, supabase]
  );

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <p className="text-sm text-muted-foreground">Chargement du formulaire 1…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-4 py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Pierre — Formulaire 1</h1>
        <p className="text-sm text-muted-foreground">
          Base définitive de mémoire client pour Pierre. Tu la remplis une fois, puis tu peux la
          modifier à tout moment.
        </p>

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/agents/pierre">Retour Pierre</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/profile/agents">Mon compte</Link>
          </Button>
        </div>
      </header>

      {err ? (
        <div className="rounded-2xl border border-red-200 bg-red-50/40 p-4">
          <p className="text-sm text-red-700">{err}</p>
        </div>
      ) : null}

      {msg ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4">
          <p className="text-sm text-emerald-700">{msg}</p>
        </div>
      ) : null}

      <Section
        title="Entreprise"
        subtitle="Tout ce qui définit l’identité de l’entreprise cliente."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label>Nom commercial</Label>
            <input
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={form.company_name}
              onChange={(e) => setField("company_name", e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label>Raison sociale</Label>
            <input
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={form.legal_company_name}
              onChange={(e) => setField("legal_company_name", e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label>Domaine email entreprise</Label>
            <input
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="ex: entreprise.com"
              value={form.company_email_domain}
              onChange={(e) => setField("company_email_domain", e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label>Site web</Label>
            <input
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="https://..."
              value={form.company_website}
              onChange={(e) => setField("company_website", e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label>Téléphone entreprise</Label>
            <input
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={form.company_phone}
              onChange={(e) => setField("company_phone", e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label>SIREN</Label>
            <input
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={form.company_siren}
              onChange={(e) => setField("company_siren", e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label>Taille entreprise</Label>
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={form.company_size}
              onChange={(e) => setField("company_size", e.target.value)}
            >
              <option value="">Choisir</option>
              <option value="1-9">1-9</option>
              <option value="10-49">10-49</option>
              <option value="50-249">50-249</option>
              <option value="250+">250+</option>
            </select>
          </div>

          <div className="space-y-1">
            <Label>Secteur</Label>
            <input
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={form.company_industry}
              onChange={(e) => setField("company_industry", e.target.value)}
            />
          </div>

          <div className="space-y-1 md:col-span-2">
            <Label>Adresse</Label>
            <input
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={form.company_address}
              onChange={(e) => setField("company_address", e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label>Ville</Label>
            <input
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={form.company_city}
              onChange={(e) => setField("company_city", e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label>Code postal</Label>
            <input
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={form.company_postal_code}
              onChange={(e) => setField("company_postal_code", e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label>Pays</Label>
            <input
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={form.company_country}
              onChange={(e) => setField("company_country", e.target.value)}
            />
          </div>

          <div className="space-y-1 md:col-span-2">
            <Label>Description entreprise</Label>
            <textarea
              className="min-h-[100px] w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={form.company_description}
              onChange={(e) => setField("company_description", e.target.value)}
            />
          </div>
        </div>
      </Section>

      <Section
        title="Contact principal"
        subtitle="Personne référente côté client pour Pierre."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label>Prénom</Label>
            <input
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={form.contact_first_name}
              onChange={(e) => setField("contact_first_name", e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label>Nom</Label>
            <input
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={form.contact_last_name}
              onChange={(e) => setField("contact_last_name", e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label>Poste</Label>
            <input
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={form.contact_job_title}
              onChange={(e) => setField("contact_job_title", e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label>Email principal</Label>
            <input
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={form.contact_email}
              onChange={(e) => setField("contact_email", e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label>Téléphone principal</Label>
            <input
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={form.contact_phone}
              onChange={(e) => setField("contact_phone", e.target.value)}
            />
          </div>
        </div>
      </Section>

      <Section
        title="Contexte RH de Pierre"
        subtitle="Tout ce dont Pierre a besoin pour générer des contenus vraiment adaptés."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label>Taille équipe RH</Label>
            <input
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={form.hr_team_size}
              onChange={(e) => setField("hr_team_size", e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label>Volume de recrutement</Label>
            <input
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="ex: 5 recrutements/mois"
              value={form.recruitment_volume}
              onChange={(e) => setField("recruitment_volume", e.target.value)}
            />
          </div>

          <div className="space-y-1 md:col-span-2">
            <Label>Besoins RH principaux</Label>
            <textarea
              className="min-h-[100px] w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={form.main_hr_needs}
              onChange={(e) => setField("main_hr_needs", e.target.value)}
            />
          </div>

          <div className="space-y-1 md:col-span-2">
            <Label>Types de documents habituels</Label>
            <textarea
              className="min-h-[100px] w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="ex: refus candidats, convocations, comptes rendus, mails RH, relances..."
              value={form.typical_document_types}
              onChange={(e) => setField("typical_document_types", e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label>Ton habituel</Label>
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={form.usual_tone}
              onChange={(e) => setField("usual_tone", e.target.value)}
            >
              <option value="professionnel">Professionnel</option>
              <option value="convivial">Convivial</option>
              <option value="direct">Direct</option>
              <option value="premium">Premium</option>
            </select>
          </div>

          <div className="space-y-1">
            <Label>Langue préférée</Label>
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={form.preferred_language}
              onChange={(e) => setField("preferred_language", e.target.value)}
            >
              <option value="fr">Français</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>
      </Section>

      <Section
        title="Signature et identité d’écriture"
        subtitle="Ce que Pierre doit utiliser automatiquement dans les documents et emails."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label>Nom signature</Label>
            <input
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={form.signature_name}
              onChange={(e) => setField("signature_name", e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label>Poste signature</Label>
            <input
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={form.signature_job_title}
              onChange={(e) => setField("signature_job_title", e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label>Email signature</Label>
            <input
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={form.signature_email}
              onChange={(e) => setField("signature_email", e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label>Téléphone signature</Label>
            <input
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={form.signature_phone}
              onChange={(e) => setField("signature_phone", e.target.value)}
            />
          </div>

          <div className="space-y-1 md:col-span-2">
            <Label>Pied de mail par défaut</Label>
            <textarea
              className="min-h-[100px] w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={form.default_email_footer}
              onChange={(e) => setField("default_email_footer", e.target.value)}
            />
          </div>
        </div>
      </Section>

      <Section
        title="Configuration email de Pierre"
        subtitle="Ce que le client veut à terme comme expéditeur professionnel."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label>Mode d’envoi</Label>
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={form.sender_mode}
              onChange={(e) => setField("sender_mode", e.target.value)}
            >
              <option value="clonestore_fallback">Fallback CloneStore</option>
              <option value="client_domain_target">Adresse pro client visée</option>
            </select>
          </div>

          <div className="space-y-1">
            <Label>Adresse expéditeur souhaitée</Label>
            <input
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="ex: pierre@entreprise.com"
              value={form.sender_email_requested}
              onChange={(e) => setField("sender_email_requested", e.target.value)}
            />
            <Helper>Adresse cible premium à terme.</Helper>
          </div>

          <div className="space-y-1">
            <Label>Reply-To</Label>
            <input
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="ex: rh@entreprise.com"
              value={form.reply_to_email}
              onChange={(e) => setField("reply_to_email", e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label>Expéditeur effectif actuel</Label>
            <input
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={form.sender_email_effective}
              onChange={(e) => setField("sender_email_effective", e.target.value)}
            />
            <Helper>Par défaut : clonestore@clonestore.pro</Helper>
          </div>

          <div className="space-y-1">
            <Label>Nom de domaine cible</Label>
            <input
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="ex: entreprise.com"
              value={form.domain_name}
              onChange={(e) => setField("domain_name", e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label>Statut domaine</Label>
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={form.domain_status}
              onChange={(e) => setField("domain_status", e.target.value)}
            >
              <option value="not_started">Not started</option>
              <option value="pending">Pending</option>
              <option value="verified">Verified</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>
      </Section>

      <Section
        title="Règles internes et contraintes"
        subtitle="Ce que Pierre doit respecter strictement."
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Mentions légales obligatoires</Label>
            <textarea
              className="min-h-[100px] w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={form.legal_mentions}
              onChange={(e) => setField("legal_mentions", e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label>Notes confidentialité</Label>
            <textarea
              className="min-h-[100px] w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={form.confidentiality_notes}
              onChange={(e) => setField("confidentiality_notes", e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label>Mots / formulations interdits</Label>
            <textarea
              className="min-h-[100px] w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={form.forbidden_words}
              onChange={(e) => setField("forbidden_words", e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label>Mots / formulations obligatoires</Label>
            <textarea
              className="min-h-[100px] w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={form.mandatory_words}
              onChange={(e) => setField("mandatory_words", e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label>Notes internes supplémentaires</Label>
            <textarea
              className="min-h-[120px] w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={form.internal_policy_notes}
              onChange={(e) => setField("internal_policy_notes", e.target.value)}
            />
          </div>
        </div>
      </Section>

      <div className="sticky bottom-4 flex flex-wrap justify-end gap-3 rounded-2xl border bg-background/95 p-4 backdrop-blur">
        <Button variant="outline" onClick={() => save(false)} disabled={saving}>
          {saving ? "Enregistrement…" : "Enregistrer le brouillon"}
        </Button>
        <Button onClick={() => save(true)} disabled={saving}>
          {saving ? "Validation…" : "Valider le formulaire 1"}
        </Button>
      </div>
    </main>
  );
}
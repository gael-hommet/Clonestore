// src/app/api/pierre/generate/route.ts

import { NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";

import { PierreBrainResponseSchema } from "@/lib/pierre/schema";
import { PierreDocType } from "@/lib/pierre/docTypes";
import {
  rejectionEmailHTML,
  inviteEmailHTML,
  followupEmailHTML,
  onboardingEmailHTML,
} from "@/lib/pierre/templates/emails";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

/**
 * IMPORTANT:
 * - Cette route renvoie un objet qui DOIT matcher PierreBrainResponseSchema.
 * - Donc: actions[].type ne peut être QUE ce que le schema autorise.
 *   (chez toi: "doc.generate" et "email.send")
 */
const GenerateInputSchema = z
  .object({
    input: z.string().min(3),
    tone: z.enum(["pro", "convivial"]).optional(),
    company_name: z.string().optional(),
    // Bloc 2: réponses aux questions manquantes / overrides
    answers: z.object({}).passthrough().optional(),
  })
  .strict();

/* =========================
   Helpers
========================= */

function lc(s: string) {
  return (s || "").toLowerCase();
}

function hasAny(text: string, words: string[]) {
  const t = lc(text);
  return words.some((w) => t.includes(w));
}

function isNonEmpty(s?: string) {
  return typeof s === "string" && s.trim().length > 0;
}

function allowsToDefine(rawBrief: string) {
  const t = lc(rawBrief);
  return (
    t.includes("à définir") ||
    t.includes("a definir") ||
    t.includes("à confirmer") ||
    t.includes("a confirmer") ||
    t.includes("tbd") ||
    t.includes("to be defined") ||
    t.includes("to confirm")
  );
}

function buildMergedBrief(rawBrief: string, answers?: Record<string, any>) {
  if (!answers || Object.keys(answers).length === 0) return rawBrief;
  return `${rawBrief}

---
Réponses (JSON) - source de vérité:
${JSON.stringify(answers)}
`;
}

function pick(text: string, patterns: RegExp[]) {
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]) return m[1].trim();
  }
  return "";
}

function extractEmailFields(text: string) {
  const candidate_name = pick(text, [
    /candidat(?:e)?\s*:\s*([^\n,]+)/i,
    /pr[ée]nom\s*:\s*([^\n,]+)/i,
    /nom\s*:\s*([^\n,]+)/i,
  ]);

  const job_title = pick(text, [
    /poste\s*:\s*([^\n,]+)/i,
    /pour\s+le\s+poste\s+de\s+([^\n,]+)/i,
    /poste\s+([^\n,]+)/i,
  ]);

  const reason = pick(text, [/raison\s*:\s*([^\n]+)/i]);

  const interview_date = pick(text, [
    /date\s*:\s*([^\n,]+)/i,
    /entretien\s*:\s*([^\n,]+)/i,
  ]);

  const interview_time = pick(text, [
    /heure\s*:\s*([^\n,]+)/i,
    /(\d{1,2}h(?:\d{2})?)/i,
  ]);

  const interview_location = pick(text, [
    /lieu\s*:\s*([^\n,]+)/i,
    /adresse\s*:\s*([^\n,]+)/i,
    /visio/i.test(text) ? /(visio)/i : /$^/,
  ]);

  const duration_raw = pick(text, [
    /dur[ée]e\s*:\s*([0-9]{2,3})/i,
    /([0-9]{2,3})\s*min/i,
  ]);
  const duration_minutes = duration_raw ? Number(duration_raw) : undefined;

  const interviewers = pick(text, [
    /interlocuteurs?\s*:\s*([^\n]+)/i,
    /avec\s*:\s*([^\n]+)/i,
  ]);

  const slots_raw = pick(text, [
    /cr[ée]neaux?\s*:\s*([^\n]+)/i,
    /propose\s+([0-9]+)\s+cr[ée]neaux?\s*:?([^\n]*)/i,
    /proposer\s+([0-9]+)\s+cr[ée]neaux?\s*:?([^\n]*)/i,
  ]);

  const proposed_slots =
    slots_raw
      ? slots_raw
          .split(/,|ou|\/|;|\n/gi)
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

  const start_date = pick(text, [
    /date\s+arriv[ée]e\s*:\s*([^\n,]+)/i,
    /arriv[ée]e\s*:\s*([^\n,]+)/i,
    /d[ée]but\s*:\s*([^\n,]+)/i,
  ]);

  const start_time = pick(text, [
    /heure\s*:\s*([^\n,]+)/i,
    /(\d{1,2}h(?:\d{2})?)/i,
  ]);

  const location = pick(text, [
    /lieu\s*:\s*([^\n,]+)/i,
    /adresse\s*:\s*([^\n,]+)/i,
  ]);

  const contact_name = pick(text, [
    /contact\s*:\s*([^\n,]+)/i,
    /r[ée]f[ée]rent\s*:\s*([^\n,]+)/i,
  ]);

  const docs_raw = pick(text, [
    /documents?\s*:\s*([^\n]+)/i,
    /docs?\s*:\s*([^\n]+)/i,
  ]);
  const documents_to_bring =
    docs_raw
      ? docs_raw
          .split(/,|;|\/|\n/gi)
          .map((d) => d.trim())
          .filter(Boolean)
      : [];

  return {
    candidate_name,
    job_title,
    reason,
    interview_date,
    interview_time,
    interview_location,
    duration_minutes,
    interviewers,
    proposed_slots,
    start_date,
    start_time,
    location,
    contact_name,
    documents_to_bring,
  };
}

/* =========================
   Answers override (source of truth)
========================= */

function toStr(v: any) {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "oui" : "non";
  return "";
}

function toStrArray(v: any) {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(toStr).filter(Boolean);
  if (typeof v === "string") {
    return v
      .split(/,|;|\/|\n/gi)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function applyAnswersToFields(
  fields: ReturnType<typeof extractEmailFields>,
  answers?: Record<string, any>
) {
  if (!answers) return fields;

  const out = { ...fields };

  if (isNonEmpty(toStr(answers.candidate_name))) out.candidate_name = toStr(answers.candidate_name);
  if (isNonEmpty(toStr(answers.job_title))) out.job_title = toStr(answers.job_title);
  if (isNonEmpty(toStr(answers.reason))) out.reason = toStr(answers.reason);

  if (isNonEmpty(toStr(answers.interview_date))) out.interview_date = toStr(answers.interview_date);
  if (isNonEmpty(toStr(answers.interview_time))) out.interview_time = toStr(answers.interview_time);
  if (isNonEmpty(toStr(answers.interview_location)))
    out.interview_location = toStr(answers.interview_location);

  if (answers.duration_minutes !== undefined && answers.duration_minutes !== null) {
    const n = Number(answers.duration_minutes);
    if (!Number.isNaN(n)) out.duration_minutes = n;
  }

  if (isNonEmpty(toStr(answers.interviewers))) out.interviewers = toStr(answers.interviewers);

  const ps = toStrArray(answers.proposed_slots);
  if (ps.length) out.proposed_slots = ps;

  if (isNonEmpty(toStr(answers.start_date))) out.start_date = toStr(answers.start_date);
  if (isNonEmpty(toStr(answers.start_time))) out.start_time = toStr(answers.start_time);

  if (isNonEmpty(toStr(answers.location))) out.location = toStr(answers.location);
  if (isNonEmpty(toStr(answers.contact_name))) out.contact_name = toStr(answers.contact_name);

  const docs = toStrArray(answers.documents_to_bring);
  if (docs.length) out.documents_to_bring = docs;

  return out;
}

/* =========================
   Missing questions
========================= */

type Question = {
  id: string;
  question: string;
  priority: "high" | "medium" | "low";
  expected_format: "text" | "number" | "date" | "email" | "phone" | "choice";
  choices?: string[];
};

function ask(
  q: Question[],
  id: string,
  question: string,
  fmt: Question["expected_format"],
  priority: Question["priority"] = "high",
  choices?: string[]
) {
  q.push({
    id,
    question,
    expected_format: fmt,
    priority,
    ...(choices ? { choices } : {}),
  });
}

function missingQuestionsForDocType(
  docType: string,
  f: ReturnType<typeof extractEmailFields>
): Question[] {
  const q: Question[] = [];

  if (docType === PierreDocType.CANDIDATE_EMAIL_INVITE) {
    if (!f.job_title) ask(q, "job_title", "Quel est le poste concerné ?", "text");
    if (!f.interview_date) ask(q, "interview_date", "Quelle est la date de l’entretien ?", "text");
    if (!f.interview_time) ask(q, "interview_time", "À quelle heure a lieu l’entretien ?", "text");
    if (!f.interview_location)
      ask(q, "interview_location", "Où a lieu l’entretien (visio ou adresse) ?", "text");
    return q;
  }

  if (docType === PierreDocType.CANDIDATE_EMAIL_ONBOARDING) {
    if (!f.job_title) ask(q, "job_title", "Quel est le poste concerné ?", "text");
    if (!f.start_date) ask(q, "start_date", "Quelle est la date d’arrivée ?", "text");
    if (!f.location) ask(q, "location", "Où la personne doit-elle se présenter (adresse / site) ?", "text");
    return q;
  }

  return q;
}

/* =========================
   Brain normalization
========================= */

function normalizeBrainJson(raw: any, inputTone?: "pro" | "convivial") {
  const tone =
    raw?.tone_used === "pro" || raw?.tone_used === "convivial" ? raw.tone_used : inputTone || "pro";

  const docType =
    typeof raw?.doc_type === "string" && raw.doc_type.length > 0 ? raw.doc_type : "UNKNOWN";

  return {
    schema_version: "1.0",
    doc_type: docType,
    doc_title:
      typeof raw?.doc_title === "string" && raw.doc_title ? raw.doc_title : "Document RH — Pierre",
    tone_used: tone,
    language: typeof raw?.language === "string" && raw.language ? raw.language : "fr-FR",
    final_text_html: typeof raw?.final_text_html === "string" ? raw.final_text_html : "",
    missing_info_questions: Array.isArray(raw?.missing_info_questions) ? raw.missing_info_questions : [],
    confidence_score: typeof raw?.confidence_score === "number" ? raw.confidence_score : 0.7,
    safety_flags:
      raw?.safety_flags && typeof raw.safety_flags === "object"
        ? raw.safety_flags
        : { legal_risk: false, discrimination_risk: false, pii_risk: false },
    actions: Array.isArray(raw?.actions) ? raw.actions : [],
  };
}

/* =========================
   Routing intent (email gate)
========================= */

function looksLikeEmailIntent(text: string) {
  const t = lc(text);
  return (
    t.includes("mail") ||
    t.includes("email") ||
    t.includes("objet") ||
    t.includes("bonjour") ||
    t.includes("cordialement") ||
    t.includes("candidat") ||
    t.includes("candidature") ||
    t.includes("refus") ||
    t.includes("convocation") ||
    t.includes("entretien") ||
    t.includes("rdv") ||
    t.includes("rendez-vous") ||
    t.includes("relance") ||
    t.includes("onboarding") ||
    t.includes("bienvenue") ||
    t.includes("arrivée") ||
    t.includes("report") ||
    t.includes("décale") ||
    t.includes("décaler") ||
    t.includes("reprogrammer") ||
    t.includes("replanifier") ||
    t.includes("déplacer") ||
    t.includes("créneau") ||
    t.includes("créneaux")
  );
}

/* =========================
   Template suitability
========================= */

function shouldUseTemplate(docType: string, mergedBrief: string) {
  const t = lc(mergedBrief);

  const isLateOrNoShow = hasAny(t, [
    "retard",
    "en retard",
    "pas venu",
    "n'est pas venu",
    "ne s'est pas présenté",
    "no show",
    "absent",
    "absence",
    "15 min",
    "20 min",
  ]);

  const isReschedule = hasAny(t, ["report", "décale", "décaler", "reprogrammer", "replanifier", "déplacer"]);

  if (isLateOrNoShow) return false;
  if (isReschedule) return false;

  if (docType === PierreDocType.CANDIDATE_EMAIL_REJECTION) {
    return hasAny(t, ["refus", "ne pas retenir", "pas donner suite", "nous avons décidé"]);
  }
  if (docType === PierreDocType.CANDIDATE_EMAIL_FOLLOWUP) {
    return hasAny(t, ["relance", "relancer", "sans réponse", "pas de retour", "suivi"]);
  }
  if (docType === PierreDocType.CANDIDATE_EMAIL_INVITE) {
    return hasAny(t, ["convocation", "entretien", "rdv", "rendez-vous", "rencontre"]);
  }
  if (docType === PierreDocType.CANDIDATE_EMAIL_ONBOARDING) {
    return hasAny(t, ["onboarding", "bienvenue", "arrivée", "premier jour", "intégration"]);
  }

  return false;
}

/* =========================
   LLM fallback (email)
========================= */

const EmailLLMOutputSchema = z
  .object({
    subject: z.string().min(3),
    body_html: z.string().min(50),
  })
  .strict();

function buildEmailLLMSystem(tone: "pro" | "convivial") {
  return `
Tu es Pierre, assistant RH premium.
Tu rédiges des emails RH prêts à envoyer (France).
Ton: ${tone}.

RÈGLES:
- Sortie STRICTEMENT en JSON valide: {"subject":"...","body_html":"..."} (pas de texte autour).
- body_html = HTML simple (<p>, <strong>, <ul><li>...), pas de CSS, pas de markdown.
- Pas de contenu discriminatoire, pas de motif illégal, pas de détails sensibles.
- Ne mets jamais de placeholders du style "[NOM]" ou "{date}".
- Si une info manque: tu n'inventes pas, tu n'ajoutes pas "à définir" sauf si le brief le dit explicitement.
`.trim();
}

function buildEmailLLMUser(params: { companyName?: string; mergedBrief: string; docType: string }) {
  return `
Doc type (routing): ${params.docType}
Entreprise (signature): ${params.companyName || "CloneStore"}

Brief + réponses (source de vérité):
${params.mergedBrief}

Consigne:
Rédige un email parfaitement adapté à la situation décrite.
NE MENTIONNE PAS les infos manquantes (pas de "à définir") sauf si le brief le demande explicitement.
Réponds uniquement en JSON.
`.trim();
}

async function generateEmailWithLLM(params: {
  tone: "pro" | "convivial";
  companyName?: string;
  mergedBrief: string;
  docType: string;
}) {
  async function tryOnce(extraSystem?: string) {
    const resp = await openai.responses.create({
      model: process.env.PIERRE_BRAIN_MODEL || "gpt-4.1",
      input: [
        {
          role: "system",
          content: buildEmailLLMSystem(params.tone) + (extraSystem ? `\n\n${extraSystem}` : ""),
        },
        {
          role: "user",
          content: buildEmailLLMUser({
            companyName: params.companyName,
            mergedBrief: params.mergedBrief,
            docType: params.docType,
          }),
        },
      ],
      max_output_tokens: 900,
    });

    const raw = resp.output_text;
    if (!raw) throw new Error("LLM returned no output_text");

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("LLM did not return valid JSON");
    }

    return EmailLLMOutputSchema.parse(parsed);
  }

  try {
    return await tryOnce();
  } catch {
    return await tryOnce("IMPORTANT: JSON valide uniquement. AUCUN texte hors JSON. Pas de backticks.");
  }
}

/* =========================
   Route
========================= */

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input = GenerateInputSchema.parse(body);

    // Base URL agnostic (local / prod)
    const origin = new URL(req.url).origin;

    const mergedBrief = buildMergedBrief(input.input, input.answers);

    // Best effort brain routing
    let rawBrain: any = null;
    try {
      const brainRes = await fetch(`${origin}/api/pierre/brain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: input.input,
          tone: input.tone,
          company_name: input.company_name,
        }),
      });
      rawBrain = await brainRes.json();
    } catch {
      rawBrain = null;
    }

    const brain = normalizeBrainJson(rawBrain, input.tone);

    // Extraction + overrides
    const extracted = extractEmailFields(mergedBrief);
    const fields = applyAnswersToFields(extracted, input.answers);

    const isEmail =
      String(brain.doc_type || "").includes("EMAIL") || looksLikeEmailIntent(mergedBrief);

    // Si pas email, on renvoie une réponse guidée (schema OK) + question
    if (!isEmail) {
      const finalNonEmail = PierreBrainResponseSchema.parse({
        ...brain,
        final_text_html: "",
        missing_info_questions: [
          {
            id: "email_only_today",
            question:
              "Cette route génère des emails. Précise le mail à rédiger (refus, convocation, relance, onboarding, ou autre mail RH).",
            priority: "high",
            expected_format: "text",
          },
        ],
        confidence_score: 0.35,
        // actions => rien
        actions: [],
      });

      return NextResponse.json(finalNonEmail, { status: 200 });
    }

    // Missing questions après overrides
    const missing = missingQuestionsForDocType(brain.doc_type, fields);

    // Génération
    const allowDefine = allowsToDefine(mergedBrief);
    const useTemplate = shouldUseTemplate(brain.doc_type, mergedBrief);

    let subject = "Votre message";
    let finalHtml = "";

    if (useTemplate) {
      switch (brain.doc_type) {
        case PierreDocType.CANDIDATE_EMAIL_REJECTION: {
          subject = isNonEmpty(fields.job_title)
            ? `Votre candidature – ${fields.job_title}`
            : "Votre candidature";

          finalHtml = rejectionEmailHTML({
            candidateName: fields.candidate_name,
            jobTitle: fields.job_title || "",
            tone: brain.tone_used,
            companyName: input.company_name,
            reason:
              fields.reason ||
              "Après étude attentive de votre candidature, nous avons décidé de poursuivre avec un autre profil.",
          });
          break;
        }

        case PierreDocType.CANDIDATE_EMAIL_INVITE: {
          subject = isNonEmpty(fields.job_title) ? `Entretien – ${fields.job_title}` : "Entretien";

          const date = isNonEmpty(fields.interview_date)
            ? fields.interview_date
            : allowDefine
              ? "à définir"
              : "";
          const time = isNonEmpty(fields.interview_time)
            ? fields.interview_time
            : allowDefine
              ? "à définir"
              : "";
          const loc = isNonEmpty(fields.interview_location)
            ? fields.interview_location
            : allowDefine
              ? "à définir"
              : "";

          finalHtml = inviteEmailHTML({
            candidateName: fields.candidate_name,
            jobTitle: fields.job_title || "",
            tone: brain.tone_used,
            companyName: input.company_name,
            interviewDate: date,
            interviewTime: time,
            interviewLocation: loc,
            durationMinutes: fields.duration_minutes || undefined,
            interviewers: fields.interviewers || "",
          });
          break;
        }

        case PierreDocType.CANDIDATE_EMAIL_FOLLOWUP: {
          subject = isNonEmpty(fields.job_title) ? `Relance – ${fields.job_title}` : "Relance candidature";

          finalHtml = followupEmailHTML({
            candidateName: fields.candidate_name,
            jobTitle: fields.job_title || "",
            tone: brain.tone_used,
            companyName: input.company_name,
            proposedSlots: fields.proposed_slots,
          });
          break;
        }

        case PierreDocType.CANDIDATE_EMAIL_ONBOARDING: {
          subject = isNonEmpty(fields.job_title) ? `Bienvenue – ${fields.job_title}` : "Bienvenue";

          const startDate = isNonEmpty(fields.start_date)
            ? fields.start_date
            : allowDefine
              ? "à définir"
              : "";
          const loc = isNonEmpty(fields.location) ? fields.location : allowDefine ? "à définir" : "";

          finalHtml = onboardingEmailHTML({
            candidateName: fields.candidate_name,
            jobTitle: fields.job_title || "",
            tone: brain.tone_used,
            companyName: input.company_name,
            startDate,
            startTime: isNonEmpty(fields.start_time) ? fields.start_time : "",
            location: loc,
            contactName: isNonEmpty(fields.contact_name) ? fields.contact_name : "",
            documentsToBring: fields.documents_to_bring,
          });
          break;
        }

        default: {
          const out = await generateEmailWithLLM({
            tone: brain.tone_used,
            companyName: input.company_name,
            mergedBrief,
            docType: brain.doc_type || "UNKNOWN",
          });
          subject = out.subject;
          finalHtml = out.body_html;
          break;
        }
      }
    } else {
      const out = await generateEmailWithLLM({
        tone: brain.tone_used,
        companyName: input.company_name,
        mergedBrief,
        docType: brain.doc_type || "UNKNOWN",
      });
      subject = out.subject;
      finalHtml = out.body_html;
    }

    // ✅ FIX: actions types STRICTEMENT conformes au schema
    const final = PierreBrainResponseSchema.parse({
      ...brain,
      doc_title: subject,
      final_text_html: finalHtml,
      missing_info_questions: missing,
      actions: [
        {
          type: "doc.generate",
          payload: {
            title: subject,
            html: finalHtml,
          },
        },
        {
          type: "email.send",
          payload: {
            to: [],
            subject,
            body_html: finalHtml,
          },
        },
      ],
    });

    return NextResponse.json(final, { status: 200 });
  } catch (err: any) {
    console.error("PIERRE GENERATE ERROR:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Unknown error" },
      { status: 400 }
    );
  }
}
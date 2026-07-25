// src/lib/clonechat/bug-memory.ts
// P9.4 — Mémoire PERSISTANTE de bugs & solutions (tenant-safe). Quand un client
// signale un problème reproductible, CloneChat :
//  1) calcule une EMPREINTE stable (fingerprint) à partir des symptômes normalisés ;
//  2) cherche un cas connu → propose un contournement/solution ADOSSÉ À DES PREUVES ;
//  3) sinon crée un cas REPORTED (occurrence=1), tenant-safe (aucune donnée d'un autre
//     client, aucun secret d'infra), et incrémente l'occurrence aux répétitions.
// Le store est une interface : `createInMemoryBugStore()` par défaut (par processus) ;
// en production, brancher un store durable (Supabase/Postgres) derrière la même API.

export type BugStatus = "reported" | "investigating" | "workaround" | "resolved";

/** Preuve rattachée à un cas — TENANT-SAFE (jamais de PII, jamais d'infra). */
export interface BugEvidence {
  /** Type de preuve observable (message visible, capture décrite, étape reproduite). */
  readonly kind: "symptom" | "screenshot_finding" | "repro_step" | "resolution_note";
  /** Texte neutralisé (sans identifiants opaques ni données d'entreprise). */
  readonly text: string;
  /** Horodatage ISO (fourni par l'appelant ; le store ne lit pas l'horloge). */
  readonly at: string;
}

export interface BugCase {
  readonly fingerprint: string;
  readonly title: string;
  readonly symptoms: string[];
  readonly workaround: string | null;
  readonly solution: string | null;
  readonly status: BugStatus;
  readonly occurrences: number;
  readonly evidence: BugEvidence[];
  readonly firstSeenAt: string;
  readonly lastSeenAt: string;
}

export interface BugMatch {
  readonly matched: boolean;
  readonly case: BugCase | null;
  /** Score de correspondance [0..1] (recouvrement de tokens de symptômes). */
  readonly score: number;
}

export interface BugStore {
  find(symptoms: string): Promise<BugMatch>;
  /** Signale une occurrence : crée le cas si absent, sinon incrémente + enrichit. */
  report(input: BugReportInput): Promise<BugCase>;
  get(fingerprint: string): Promise<BugCase | null>;
  list(): Promise<BugCase[]>;
}

export interface BugReportInput {
  readonly symptoms: string;
  readonly title?: string;
  readonly evidence?: BugEvidence[];
  /** Horodatage ISO fourni par l'appelant (le store ne lit jamais l'horloge). */
  readonly at: string;
  readonly workaround?: string | null;
  readonly solution?: string | null;
}

// ── Empreinte & normalisation ───────────────────────────────────────────────

function normalize(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    // neutralise les identifiants opaques / données volatiles (tenant-safe fingerprint)
    .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/g, " ") // uuid
    .replace(/\b\d{3,}\b/g, " ") // longs nombres
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOPWORDS = new Set([
  "le", "la", "les", "un", "une", "des", "de", "du", "et", "ou", "je", "tu", "il",
  "elle", "on", "nous", "vous", "ils", "que", "qui", "quoi", "pour", "avec", "sur",
  "dans", "est", "sont", "pas", "ne", "mon", "ma", "mes", "ca", "cela", "quand",
]);

function tokens(s: string): string[] {
  return normalize(s).split(" ").filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

/**
 * Redaction TENANT-SAFE avant stockage dans le magasin partagé : retire e-mails,
 * longs nombres et séquences de mots capitalisés (noms propres probables). Le magasin
 * de bugs est partagé entre entreprises : il ne doit contenir aucune donnée cliente.
 */
export function redactSymptom(text: string): string {
  return (text ?? "")
    .replace(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, "[email]")
    .replace(/\b\d[\d\s./-]{5,}\d\b/g, "[num]") // séquences longues (tél, réf)
    .replace(/\b\d{3,}\b/g, "[num]")             // nombres de 3+ chiffres
    // séquences de 2+ mots capitalisés (noms/organisations) → [nom]
    .replace(/\b(?:[A-ZÀ-Ý][\wÀ-ÿ'-]+)(?:\s+[A-ZÀ-Ý][\wÀ-ÿ'-]+)+/g, "[nom]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}

/** Empreinte stable (déterministe) d'un ensemble de symptômes. */
export function fingerprint(symptoms: string): string {
  const sig = [...new Set(tokens(symptoms))].sort().join(" ");
  let h = 0x811c9dc5;
  for (let i = 0; i < sig.length; i++) {
    h ^= sig.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return "bug_" + h.toString(16).padStart(8, "0");
}

/** Similarité de Jaccard entre deux jeux de symptômes (recouvrement de tokens). */
export function symptomSimilarity(a: string, b: string): number {
  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const union = ta.size + tb.size - inter;
  return union === 0 ? 0 : inter / union;
}

// Seuil de correspondance floue : assez bas pour reconnaître une paraphrase réaliste
// d'un même problème, assez haut pour éviter les faux positifs entre bugs distincts.
const MATCH_THRESHOLD = 0.34;

// ── Store en mémoire (par processus) ────────────────────────────────────────

export function createInMemoryBugStore(seed: readonly BugCase[] = SEED_BUGS): BugStore {
  const byFingerprint = new Map<string, BugCase>();
  for (const c of seed) byFingerprint.set(c.fingerprint, { ...c, symptoms: [...c.symptoms], evidence: [...c.evidence] });

  return {
    async find(symptoms) {
      const fp = fingerprint(symptoms);
      const exact = byFingerprint.get(fp);
      if (exact) return { matched: true, case: exact, score: 1 };
      // fallback flou : meilleur recouvrement de symptômes
      let best: BugCase | null = null;
      let bestScore = 0;
      for (const c of byFingerprint.values()) {
        const score = Math.max(...c.symptoms.map((s) => symptomSimilarity(symptoms, s)), 0);
        if (score > bestScore) { bestScore = score; best = c; }
      }
      if (best && bestScore >= MATCH_THRESHOLD) return { matched: true, case: best, score: bestScore };
      return { matched: false, case: null, score: bestScore };
    },

    async report(input) {
      const fp = fingerprint(input.symptoms);
      const existing = byFingerprint.get(fp);
      if (existing) {
        const updated: BugCase = {
          ...existing,
          occurrences: existing.occurrences + 1,
          lastSeenAt: input.at,
          symptoms: existing.symptoms.includes(input.symptoms.trim())
            ? existing.symptoms
            : [...existing.symptoms, input.symptoms.trim()].slice(0, 12),
          evidence: [...existing.evidence, ...(input.evidence ?? [])].slice(-24),
          workaround: input.workaround ?? existing.workaround,
          solution: input.solution ?? existing.solution,
        };
        byFingerprint.set(fp, updated);
        return updated;
      }
      const created: BugCase = {
        fingerprint: fp,
        title: (input.title ?? input.symptoms).trim().slice(0, 120),
        symptoms: [input.symptoms.trim()],
        workaround: input.workaround ?? null,
        solution: input.solution ?? null,
        status: input.solution ? "resolved" : input.workaround ? "workaround" : "reported",
        occurrences: 1,
        evidence: [...(input.evidence ?? [])],
        firstSeenAt: input.at,
        lastSeenAt: input.at,
      };
      byFingerprint.set(fp, created);
      return created;
    },

    async get(fp) {
      return byFingerprint.get(fp) ?? null;
    },

    async list() {
      return [...byFingerprint.values()].sort((a, b) => b.occurrences - a.occurrences);
    },
  };
}

// ── Cas connus amorcés (tenant-safe, adossés à des preuves reproductibles) ───
// Faits produit approuvés uniquement — aucune donnée cliente, aucun secret.
export const SEED_BUGS: readonly BugCase[] = [
  {
    fingerprint: fingerprint("le bouton envoyer reste grisé le message ne part pas"),
    title: "Le bouton d'envoi reste grisé, le message ne part pas",
    symptoms: ["le bouton envoyer reste grisé le message ne part pas", "impossible d'envoyer un message dans l'assistant"],
    workaround: "Rechargez la page (Ctrl/Cmd+R). Le composer redevient actif une fois la page complètement chargée. Si le problème persiste, vérifiez votre connexion.",
    solution: null,
    status: "workaround",
    occurrences: 1,
    evidence: [{ kind: "symptom", text: "Composer inactif tant que la page n'est pas complètement chargée.", at: "2026-06-20" }],
    firstSeenAt: "2026-06-20",
    lastSeenAt: "2026-06-20",
  },
  {
    fingerprint: fingerprint("pierre ne voit pas mes missions le cockpit est vide"),
    title: "Le cockpit de Pierre semble vide",
    symptoms: ["pierre ne voit pas mes missions le cockpit est vide", "aucune mission n'apparaît dans le cockpit"],
    workaround: "Vérifiez que l'onboarding de l'entreprise est complété (/profile/onboarding). Sans empreinte d'entreprise, Pierre n'a pas encore de contexte à afficher.",
    solution: "Compléter l'empreinte d'entreprise via l'onboarding renseigne le contexte nécessaire à l'affichage des missions.",
    status: "resolved",
    occurrences: 1,
    evidence: [{ kind: "repro_step", text: "Cockpit vide lorsque l'onboarding entreprise n'est pas complété.", at: "2026-06-20" }],
    firstSeenAt: "2026-06-20",
    lastSeenAt: "2026-06-20",
  },
];

// GO-LIVE 03 -- Legal & Public Copy Final Scanner (Node.js ESM)
// Scans source files for forbidden patterns and legal placeholder markers.
// Does NOT contact any API. Does NOT modify go-live-proofs.local.json.
// Does NOT make real payments. Does NOT call OpenAI. Does NOT send email.
//
// Usage: node scripts/legal-public-copy-scan.mjs
// Output: go-live-evidence/legal-public-copy/legal-public-copy-scan.txt

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

// ── 1. Forbidden patterns (mirrors public-copy-final-registry.ts) ─────────────

const FORBIDDEN_PATTERNS = [
  { id: 'zero_erreur', pattern: /zéro erreur|aucune erreur garantie|sans erreur/i, severity: 'BLOCKING' },
  { id: 'conformite_garantie', pattern: /conformité garantie|légalement conforme|compliance garantie/i, severity: 'BLOCKING' },
  { id: 'remplace_avocat', pattern: /remplace (un |l')?avocat|remplace (un |le )?juriste/i, severity: 'BLOCKING' },
  { id: 'dsn_autonome', pattern: /DSN autonome|soumet des DSN automatiquement/i, severity: 'BLOCKING' },
  { id: 'paie_officielle_autonome', pattern: /bulletins? de paie officiels?|logiciel de paie officiel/i, severity: 'BLOCKING' },
  { id: 'licenciement_automatique', pattern: /licenciement automatique|licencie automatiquement/i, severity: 'BLOCKING' },
  { id: 'rh_juridiquement_autonome', pattern: /RH juridiquement autonome|remplace un professionnel RH/i, severity: 'BLOCKING' },
  { id: 'essai_gratuit_open_bar', pattern: /essai gratuit de 7 jours|7-day free trial|open.bar/i, severity: 'BLOCKING' },
  { id: 'cout_ia_illimite', pattern: /coût IA illimité|IA illimitée|appels IA illimités/i, severity: 'BLOCKING' },
  { id: 'donnees_100_protegees', pattern: /données 100% protégées sans réserve|sécurité absolue/i, severity: 'BLOCKING' },
];

// ── 2. Legal placeholder markers ──────────────────────────────────────────────

const PLACEHOLDER_MARKERS = [
  'Placeholder — à compléter',
  'Placeholder — à renseigner',
  'À renseigner :',
  'À préciser :',
  'Placeholder à valider juridiquement',
  'Draft 1.0',
];

// ── 3. Files to scan ──────────────────────────────────────────────────────────

const ROOT = process.cwd();

const PUBLIC_FILES_TO_SCAN = [
  { path: 'src/app/page.tsx', context: 'homepage' },
  { path: 'src/app/checkout/page.tsx', context: 'checkout' },
  { path: 'src/app/paiement/success/page.tsx', context: 'success' },
  { path: 'src/app/paiement/cancel/page.tsx', context: 'cancel' },
  { path: 'src/app/agents/pierre/page.tsx', context: 'pierre_page', optional: true },
  { path: 'src/app/questions/page.tsx', context: 'faq', optional: true },
];

const LEGAL_FILES_TO_SCAN = [
  { path: 'src/app/legal/cgu/page.tsx', context: 'cgu' },
  { path: 'src/app/legal/cgv/page.tsx', context: 'cgv' },
  { path: 'src/app/legal/dpa/page.tsx', context: 'dpa' },
  { path: 'src/app/legal/mentions/page.tsx', context: 'mentions' },
  { path: 'src/app/legal/confidentialite/page.tsx', context: 'confidentialite' },
];

// ── 4. Banner ─────────────────────────────────────────────────────────────────

console.log('');
console.log('======================================================');
console.log(' GO-LIVE 03 -- Legal & Public Copy Final Scanner');
console.log('======================================================');
console.log('  Does NOT contact any API.');
console.log('  Does NOT modify go-live-proofs.local.json.');
console.log('  Does NOT make real payments or call OpenAI.');
console.log('');

// ── 5. Scan function ──────────────────────────────────────────────────────────

function scanFile(filePath, context, optional) {
  const fullPath = join(ROOT, filePath);
  if (!existsSync(fullPath)) {
    if (optional) {
      return { path: filePath, context: context, skipped: true, violations: [], placeholders: [] };
    }
    return {
      path: filePath,
      context: context,
      missing: true,
      violations: [],
      placeholders: [],
    };
  }

  const content = readFileSync(fullPath, 'utf-8');
  const violations = [];
  const placeholders = [];

  for (const rule of FORBIDDEN_PATTERNS) {
    const match = content.match(rule.pattern);
    if (match) {
      violations.push({ id: rule.id, found: match[0], severity: rule.severity });
    }
  }

  for (const marker of PLACEHOLDER_MARKERS) {
    if (content.includes(marker)) {
      placeholders.push(marker);
    }
  }

  return { path: filePath, context: context, violations: violations, placeholders: placeholders };
}

// ── 6. Run scans ─────────────────────────────────────────────────────────────

console.log('── PUBLIC PAGES SCAN ────────────────────────────────────');
console.log('');

const publicResults = PUBLIC_FILES_TO_SCAN.map(function(f) {
  return scanFile(f.path, f.context, f.optional);
});

let publicBlockers = 0;
for (const result of publicResults) {
  if (result.skipped) {
    console.log('[SKIP]    ' + result.path + ' (optional, not found)');
    continue;
  }
  if (result.missing) {
    console.log('[MISSING] ' + result.path);
    continue;
  }

  if (result.violations.length === 0) {
    console.log('[CLEAN]   ' + result.path + ' (' + result.context + ')');
  } else {
    for (const v of result.violations) {
      console.log('[' + v.severity + '] ' + result.context + ' : ' + v.id + ' → "' + v.found + '"');
      if (v.severity === 'BLOCKING') publicBlockers++;
    }
  }
}

console.log('');
console.log('── LEGAL PAGES SCAN ─────────────────────────────────────');
console.log('');

const legalResults = LEGAL_FILES_TO_SCAN.map(function(f) {
  return scanFile(f.path, f.context, false);
});

let legalPlaceholders = 0;
for (const result of legalResults) {
  if (result.missing) {
    console.log('[MISSING] ' + result.path + ' — page légale manquante!');
    continue;
  }

  const status = result.violations.length === 0 ? '[OK]     ' : '[WARN]   ';
  console.log(status + ' ' + result.path);

  if (result.placeholders.length > 0) {
    legalPlaceholders += result.placeholders.length;
    console.log('  [PLACEHOLDER] ' + result.placeholders.length + ' placeholder(s) actifs:');
    for (const p of result.placeholders.slice(0, 3)) {
      console.log('    - "' + p + '"');
    }
  } else {
    console.log('  [OK] Aucun placeholder détecté dans le source');
  }
}

// ── 7. Legal entity check ─────────────────────────────────────────────────────

console.log('');
console.log('── LEGAL ENTITY CHECK (mentions légales) ─────────────────');
console.log('');

const ENTITY_FIELDS = [
  { key: 'company_name', label: 'Dénomination sociale', markers: ['À renseigner', 'Placeholder'] },
  { key: 'legal_form', label: 'Forme juridique', markers: ['SAS, SASU, auto-entrepreneur'] },
  { key: 'address', label: 'Adresse siège social', markers: ['adresse', 'siège social'] },
  { key: 'siren', label: 'SIREN/SIRET', markers: ['SIREN', 'SIRET', 'immatriculation'] },
  { key: 'publication_director', label: 'Directeur publication', markers: ['Placeholder — à renseigner', 'représentant légal'] },
  { key: 'contact_email', label: 'Email contact', markers: ['À renseigner', 'adresse email officielle'] },
  { key: 'hosting_provider', label: 'Hébergeur', markers: ['À préciser'] },
];

const mentionsPath = join(ROOT, 'src/app/legal/mentions/page.tsx');
let mentionsContent = '';
if (existsSync(mentionsPath)) {
  mentionsContent = readFileSync(mentionsPath, 'utf-8');
}

let missingEntityFields = 0;
for (const field of ENTITY_FIELDS) {
  const hasPlaceholder = field.markers.some(function(m) { return mentionsContent.includes(m); });
  if (hasPlaceholder) {
    console.log('[PENDING] ' + field.label + ' : placeholder actif dans mentions légales');
    missingEntityFields++;
  } else {
    console.log('[OK]      ' + field.label + ' : semble complété');
  }
}

// ── 8. Summary ────────────────────────────────────────────────────────────────

console.log('');
console.log('── SUMMARY ──────────────────────────────────────────────');
console.log('');

if (publicBlockers === 0) {
  console.log('[CLEAN]   Aucune violation bloquante dans les pages publiques.');
} else {
  console.log('[BLOCKING] ' + publicBlockers + ' violation(s) bloquante(s) dans les pages publiques.');
}

if (legalPlaceholders === 0) {
  console.log('[OK]      Aucun placeholder détecté dans les pages légales source.');
} else {
  console.log('[PENDING] ' + legalPlaceholders + ' placeholder(s) actifs dans les pages légales source.');
  console.log('          NOTE: Cela peut être attendu (les placeholders sont affichés en orange dans l\'UI).');
}

if (missingEntityFields === 0) {
  console.log('[OK]      Informations société : toutes semblent complétées.');
} else {
  console.log('[PENDING] ' + missingEntityFields + ' champ(s) société à compléter dans les mentions légales.');
}

console.log('');
console.log('── PROOF TEMPLATES (tous PENDING — jamais auto-modifiés) ──');
console.log('');

const proofIds = [
  'LEGAL_CGU_VALIDATED',
  'LEGAL_CGV_VALIDATED',
  'LEGAL_DPA_VALIDATED',
  'LEGAL_PRIVACY_VALIDATED',
  'LEGAL_MENTIONS_VALIDATED',
  'LEGAL_ENTITY_INFO_COMPLETED',
  'LEGAL_HUMAN_REVIEW_COMPLETED',
  'PUBLIC_COPY_SCAN_CLEAN',
  'PUBLIC_SITE_NO_FORBIDDEN_CLAIMS',
  'CHECKOUT_LEGAL_LINKS_PRESENT',
];

const proofTemplates = proofIds.map(function(id) {
  return {
    proof_id: id,
    status: 'pending',
    verified_at: '',
    verified_by: '',
    evidence_type: id.startsWith('LEGAL_') ? 'manual' : 'script_output',
    evidence_ref: 'go-live-evidence/legal-public-copy/legal-public-copy-scan.txt',
    notes: '',
  };
});

console.log(JSON.stringify(proofTemplates, null, 2));

// ── 9. Write evidence file ────────────────────────────────────────────────────

const evidenceDir = join(ROOT, 'go-live-evidence', 'legal-public-copy');
if (!existsSync(evidenceDir)) {
  mkdirSync(evidenceDir, { recursive: true });
}

const timestamp = new Date().toISOString();
const evidenceLines = [
  'GO-LIVE 03 -- Legal & Public Copy Final Scan Report',
  'Generated : ' + timestamp,
  '',
  '── PUBLIC PAGES ──',
  '  Blocking violations : ' + publicBlockers,
  '',
  '── LEGAL PAGES ──',
  '  Placeholders found  : ' + legalPlaceholders,
  '  Entity fields missing: ' + missingEntityFields,
  '',
  '── PROOF IDs PENDING ──',
  ...proofIds.map(function(id) { return '  ' + id; }),
  '',
  '── NOTES ──',
  '  - This script does NOT modify go-live-proofs.local.json.',
  '  - Proof must be marked verified ONLY after manual human review.',
  '  - Legal review by a lawyer is required before marking legal proofs verified.',
  '  - Public copy violations must be fixed before marking PUBLIC_COPY_SCAN_CLEAN.',
];

const evidenceFile = join(evidenceDir, 'legal-public-copy-scan.txt');
writeFileSync(evidenceFile, evidenceLines.join('\n'), 'utf-8');

console.log('');
console.log('Evidence file: go-live-evidence/legal-public-copy/legal-public-copy-scan.txt');
console.log('');
console.log('======================================================');
console.log(' END GO-LIVE 03');
console.log(' Public launch : NO-GO until all 10 proof IDs verified');
console.log(' Legal review  : PENDING — requires human lawyer review');
console.log('======================================================');
console.log('');

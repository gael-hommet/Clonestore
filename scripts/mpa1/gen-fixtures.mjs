// MPA-1 — 16 distinct synthetic companies (FR/BE/LU/CH), deterministic. No model, no network.
// All names prefixed MPA1 so test data is identifiable and removable. No real company data.

import fs from "node:fs";

const COUNTRIES = {
  FR: { currency: "EUR", price: 449, vouvoiement: true },
  BE: { currency: "EUR", price: 449, vouvoiement: true },
  LU: { currency: "EUR", price: 449, vouvoiement: true },
  CH: { currency: "CHF", price: 499, vouvoiement: true },
};

// 16 rows: sector, country, size, tone, autonomy — each combination distinct.
const ROWS = [
  ["restauration", "FR", 12, "chaleureux-direct", "brouillon"],
  ["batiment", "FR", 60, "factuel-cadre", "copilote"],
  ["clotures-amenagement-exterieur", "FR", 30, "concret-terrain", "copilote"],
  ["cabinet-comptable", "BE", 15, "formel-precis", "brouillon"],
  ["energie", "FR", 250, "institutionnel", "copilote"],
  ["e-commerce", "FR", 45, "moderne-rapide", "copilote"],
  ["industrie", "BE", 250, "rigoureux-securite", "copilote"],
  ["logistique", "FR", 120, "operationnel", "copilote"],
  ["hotellerie", "CH", 60, "soigne-service", "brouillon"],
  ["agence-marketing", "FR", 15, "creatif-informel", "brouillon"],
  ["services-informatiques", "LU", 30, "technique-clair", "copilote"],
  ["commerce-detail", "FR", 90, "accessible", "copilote"],
  ["immobilier", "CH", 20, "premium-mesure", "brouillon"],
  ["centre-formation", "BE", 30, "pedagogique", "copilote"],
  ["association", "FR", 5, "humain-proche", "brouillon"],
  ["multi-sites", "CH", 500, "structure-multi-entites", "copilote"],
];

function makeEmployees(n, seed) {
  const first = ["Nora", "Julien", "Sofia", "Marc", "Chloé", "Karim", "Emma", "Lucas", "Inès", "Théo", "Léa", "Hugo", "Manon", "Yanis", "Sarah", "Adam"];
  const last = ["Berger", "Lambert", "Moreau", "Petit", "Roux", "Girard", "Bonnet", "Dumas", "Faure", "Blanc", "Henry", "Marchand"];
  const roles = ["responsable RH", "assistant RH", "manager", "salarié", "chef d'équipe", "comptable", "commercial", "technicien"];
  const cap = Math.min(n, 8);
  const out = [];
  for (let i = 0; i < cap; i++) {
    out.push({
      name: `${first[(seed + i) % first.length]} ${last[(seed + i * 3) % last.length]}`,
      role: roles[(seed + i) % roles.length],
      contract: i % 3 === 0 ? "CDI" : i % 3 === 1 ? "CDD" : "CDI cadre",
      tenure_months: 6 + ((seed + i * 7) % 90),
    });
  }
  return out;
}

const companies = ROWS.map(([sector, country, size, tone, autonomy], idx) => {
  const c = COUNTRIES[country];
  const seed = idx * 5 + 1;
  return {
    id: `mpa1-co-${String(idx + 1).padStart(2, "0")}`,
    name: `MPA1 ${sector.replace(/-/g, " ")} ${country}-${size}`,
    country,
    currency: c.currency,
    monthly_price: c.price,
    sector,
    headcount: size,
    hr_structure:
      size <= 15 ? "dirigeant assure la RH" : size <= 60 ? "1 responsable RH" : size <= 250 ? "responsable RH + assistant" : "direction RH multi-sites",
    managers: makeEmployees(Math.max(2, Math.round(size / 30)), seed).map((e) => e.name).slice(0, Math.max(1, Math.round(size / 60) + 1)),
    employees: makeEmployees(size, seed),
    communication_tone: tone,
    formality: c.vouvoiement ? "vouvoiement" : "tutoiement",
    working_hours: size <= 15 ? "variables selon activité" : "35h base, horaires postés selon service",
    leave_policy: country === "CH" ? "vacances selon droit suisse cantonal (à valider)" : "congés selon convention applicable (à valider)",
    validation_process:
      autonomy === "brouillon" ? "toute sortie relue par le dirigeant" : "manager propose, RH valide, direction pour >5000€",
    autonomy_level: autonomy,
    writing_preferences: {
      greeting: tone.includes("informel") ? "Bonjour {prénom}," : "Bonjour {Prénom Nom},",
      signature: `L'équipe RH — MPA1 ${sector.replace(/-/g, " ")}`,
      avoid: ["promesses juridiques", "menaces", "jargon RH inutile"],
    },
    prior_missions: [
      `onboarding ${makeEmployees(1, seed)[0].name}`,
      `relance document manquant`,
    ],
    // NOTE: legal/convention specifics are intentionally left as "à valider" — Pierre must never
    // invent country law; jurisdiction certainty is a separate, source-required gate.
    legal_certainty: "SOURCE_REQUIRED",
  };
});

fs.writeFileSync(
  "C:/Users/homme/clonestore/.mpa1-proofs/MPA1_COMPANY_FIXTURES.json",
  JSON.stringify(
    {
      note: "16 synthetic companies, deterministic, test-only, MPA1-prefixed. No real company data. Legal specifics deliberately marked SOURCE_REQUIRED — Pierre must never invent country law.",
      countries: Object.keys(COUNTRIES),
      count: companies.length,
      distinctSectors: [...new Set(companies.map((c) => c.sector))].length,
      companies,
    },
    null,
    2,
  ),
);
console.log("COMPANIES:", companies.length, "| countries:", [...new Set(companies.map((c) => c.country))].join(","),
  "| sectors:", [...new Set(companies.map((c) => c.sector))].length);

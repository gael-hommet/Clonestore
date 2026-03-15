// src/lib/pierre/templates/emails.ts

type Tone = "pro" | "convivial";

function greeting(tone: Tone, candidateName?: string) {
  const name = candidateName?.trim() ? ` ${candidateName.trim()}` : "";
  return tone === "convivial" ? `Bonjour${name},` : `Bonjour${name},`;
}

function signature(companyName?: string) {
  return `${companyName || "L’équipe RH"}`;
}

export function rejectionEmailHTML(params: {
  candidateName?: string;
  jobTitle?: string;
  tone: Tone;
  companyName?: string;
  reason?: string;
}) {
  const reasonLine = params.reason?.trim()
    ? `<p>${params.reason.trim()}</p>`
    : `<p>Après étude attentive de votre candidature, nous avons décidé de poursuivre avec un autre profil.</p>`;

  return `
<p>${greeting(params.tone, params.candidateName)}</p>

<p>Merci pour l’intérêt porté au poste de <strong>${params.jobTitle || "ce poste"}</strong>.</p>

${reasonLine}

<p>Nous vous remercions pour le temps consacré à votre candidature et vous souhaitons une excellente continuation.</p>

<p>Bien cordialement,<br/>${signature(params.companyName)}</p>
`.trim();
}

export function inviteEmailHTML(params: {
  candidateName?: string;
  jobTitle?: string;
  tone: Tone;
  companyName?: string;
  interviewDate?: string;
  interviewTime?: string;
  interviewLocation?: string; // "visio" ou adresse
  durationMinutes?: number;
  interviewers?: string; // "Responsable maintenance + RH"
}) {
  const duration =
    params.durationMinutes && params.durationMinutes > 0
      ? `${params.durationMinutes} min`
      : "45 min";

  const location = params.interviewLocation || "en visioconférence / sur site (à confirmer)";
  const date = params.interviewDate || "date à confirmer";
  const time = params.interviewTime || "heure à confirmer";

  return `
<p>${greeting(params.tone, params.candidateName)}</p>

<p>Merci pour votre candidature au poste de <strong>${params.jobTitle || "ce poste"}</strong>.</p>

<p>Nous souhaiterions vous proposer un entretien le <strong>${date}</strong> à <strong>${time}</strong> (${duration}).</p>

<p><strong>Lieu / format :</strong> ${location}<br/>
${params.interviewers ? `<strong>Interlocuteurs :</strong> ${params.interviewers}<br/>` : ""}
</p>

<p>Merci de nous confirmer votre disponibilité, ou de proposer un autre créneau si besoin.</p>

<p>Bien cordialement,<br/>${signature(params.companyName)}</p>
`.trim();
}

export function followupEmailHTML(params: {
  candidateName?: string;
  jobTitle?: string;
  tone: Tone;
  companyName?: string;
  proposedSlots?: string[]; // ["Mardi 10h", "Jeudi 15h"]
}) {
  const slots =
    params.proposedSlots && params.proposedSlots.length
      ? `<ul>${params.proposedSlots.map((s) => `<li>${s}</li>`).join("")}</ul>`
      : `<p>Voici deux créneaux possibles cette semaine (à confirmer) :<br/>• Mardi 10h<br/>• Jeudi 15h</p>`;

  return `
<p>${greeting(params.tone, params.candidateName)}</p>

<p>Je me permets de revenir vers vous concernant votre candidature au poste de <strong>${params.jobTitle || "ce poste"}</strong>.</p>

<p>Seriez-vous disponible sur l’un des créneaux suivants ?</p>
${slots}

<p>Si aucun ne convient, dites-nous vos disponibilités et nous nous adapterons.</p>

<p>Bien cordialement,<br/>${signature(params.companyName)}</p>
`.trim();
}

export function onboardingEmailHTML(params: {
  candidateName?: string;
  jobTitle?: string;
  tone: Tone;
  companyName?: string;
  startDate?: string;
  startTime?: string;
  location?: string;
  contactName?: string;
  documentsToBring?: string[];
}) {
  const docs =
    params.documentsToBring && params.documentsToBring.length
      ? `<ul>${params.documentsToBring.map((d) => `<li>${d}</li>`).join("")}</ul>`
      : `<ul>
<li>Pièce d’identité</li>
<li>RIB</li>
<li>Carte Vitale</li>
<li>Justificatif de domicile</li>
</ul>`;

  return `
<p>${greeting(params.tone, params.candidateName)}</p>

<p>Bienvenue ! Nous sommes ravis de vous accueillir au poste de <strong>${params.jobTitle || "ce poste"}</strong>.</p>

<p><strong>Date d’arrivée :</strong> ${params.startDate || "à confirmer"}${
    params.startTime ? ` à ${params.startTime}` : ""
  }<br/>
<strong>Lieu :</strong> ${params.location || "à confirmer"}<br/>
${params.contactName ? `<strong>Contact :</strong> ${params.contactName}<br/>` : ""}
</p>

<p>Pour préparer votre arrivée, merci de prévoir :</p>
${docs}

<p>Si vous avez la moindre question d’ici là, vous pouvez répondre à ce message.</p>

<p>Bien cordialement,<br/>${signature(params.companyName)}</p>
`.trim();
}
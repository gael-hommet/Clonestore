// src/lib/pierre/templates/emails.ts

type Tone = "pro" | "convivial";

function greeting(tone: Tone, candidateName?: string) {
  const name = candidateName?.trim() ? ` ${candidateName.trim()}` : "";
  return tone === "convivial" ? `Bonjour${name},` : `Bonjour${name},`;
}

function signature(companyName?: string) {
  return `${companyName || "Lâ€™Ã©quipe RH"}`;
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
    : `<p>AprÃ¨s Ã©tude attentive de votre candidature, nous avons dÃ©cidÃ© de poursuivre avec un autre profil.</p>`;

  return `
<p>${greeting(params.tone, params.candidateName)}</p>

<p>Merci pour lâ€™intÃ©rÃªt portÃ© au poste de <strong>${params.jobTitle || "ce poste"}</strong>.</p>

${reasonLine}

<p>Nous vous remercions pour le temps consacrÃ© Ã  votre candidature et vous souhaitons une excellente continuation.</p>

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

  const location = params.interviewLocation || "en visioconfÃ©rence / sur site (Ã  confirmer)";
  const date = params.interviewDate || "date Ã  confirmer";
  const time = params.interviewTime || "heure Ã  confirmer";

  return `
<p>${greeting(params.tone, params.candidateName)}</p>

<p>Merci pour votre candidature au poste de <strong>${params.jobTitle || "ce poste"}</strong>.</p>

<p>Nous souhaiterions vous proposer un entretien le <strong>${date}</strong> Ã  <strong>${time}</strong> (${duration}).</p>

<p><strong>Lieu / format :</strong> ${location}<br/>
${params.interviewers ? `<strong>Interlocuteurs :</strong> ${params.interviewers}<br/>` : ""}
</p>

<p>Merci de nous confirmer votre disponibilitÃ©, ou de proposer un autre crÃ©neau si besoin.</p>

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
      : `<p>Voici deux crÃ©neaux possibles cette semaine (Ã  confirmer) :<br/>â€¢ Mardi 10h<br/>â€¢ Jeudi 15h</p>`;

  return `
<p>${greeting(params.tone, params.candidateName)}</p>

<p>Je me permets de revenir vers vous concernant votre candidature au poste de <strong>${params.jobTitle || "ce poste"}</strong>.</p>

<p>Seriez-vous disponible sur lâ€™un des crÃ©neaux suivants ?</p>
${slots}

<p>Si aucun ne convient, dites-nous vos disponibilitÃ©s et nous nous adapterons.</p>

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
<li>PiÃ¨ce dâ€™identitÃ©</li>
<li>RIB</li>
<li>Carte Vitale</li>
<li>Justificatif de domicile</li>
</ul>`;

  return `
<p>${greeting(params.tone, params.candidateName)}</p>

<p>Bienvenue ! Nous sommes ravis de vous accueillir au poste de <strong>${params.jobTitle || "ce poste"}</strong>.</p>

<p><strong>Date dâ€™arrivÃ©e :</strong> ${params.startDate || "Ã  confirmer"}${
    params.startTime ? ` Ã  ${params.startTime}` : ""
  }<br/>
<strong>Lieu :</strong> ${params.location || "Ã  confirmer"}<br/>
${params.contactName ? `<strong>Contact :</strong> ${params.contactName}<br/>` : ""}
</p>

<p>Pour prÃ©parer votre arrivÃ©e, merci de prÃ©voir :</p>
${docs}

<p>Si vous avez la moindre question dâ€™ici lÃ , vous pouvez rÃ©pondre Ã  ce message.</p>

<p>Bien cordialement,<br/>${signature(params.companyName)}</p>
`.trim();
}
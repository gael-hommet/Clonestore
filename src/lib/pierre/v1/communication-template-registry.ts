// src/lib/pierre/v1/communication-template-registry.ts
// PHASE 8.4.8 — versioned, typed, deterministic communication templates. Each template declares its
// EXACT variable set and builds a canonical structured output; the renderer escapes + hashes. No
// template interpolates raw HTML; content is professional, short, free of system jargon / ids.

import { renderFromTemplateOutput, assertDeclaredVariables, type RenderedCommunication, type TemplateOutput, TemplateRenderError } from "./communication-renderer";

export type CommunicationTemplate = {
  key: string;
  version: string;
  locale: string;
  variables: readonly string[];
  build: (v: Record<string, string>) => TemplateOutput;
};

const REGISTRY: Record<string, CommunicationTemplate> = {};
function reg(t: CommunicationTemplate) { REGISTRY[`${t.key}@${t.locale}`] = t; }

// ── French (fr) templates for the communicable events ───────────────────────────────
reg({ key: "document.ready_for_review", version: "1", locale: "fr", variables: ["object_label", "action_path"],
  build: (v) => ({ subject: `Document à valider : ${v.object_label}`, greeting: "Bonjour,",
    paragraphs: [`Un document « ${v.object_label} » est prêt et attend votre validation.`, "Vous pouvez le consulter et décider via le lien sécurisé ci-dessous."],
    action: { label: "Ouvrir le document", path: v.action_path },
    in_app_title: `Document à valider`, in_app_body: `« ${v.object_label} » attend votre validation.` }) });

reg({ key: "document.approved", version: "1", locale: "fr", variables: ["object_label", "action_path"],
  build: (v) => ({ subject: `Document validé : ${v.object_label}`, greeting: "Bonjour,",
    paragraphs: [`Le document « ${v.object_label} » a été validé.`],
    action: { label: "Voir le document", path: v.action_path },
    in_app_title: `Document validé`, in_app_body: `« ${v.object_label} » a été validé.` }) });

reg({ key: "document.signature_ready", version: "1", locale: "fr", variables: ["object_label", "action_path"],
  build: (v) => ({ subject: `Prêt pour signature : ${v.object_label}`,
    paragraphs: [`Le document « ${v.object_label} » est prêt à être envoyé en signature.`],
    action: { label: "Préparer la signature", path: v.action_path },
    in_app_title: `Prêt pour signature`, in_app_body: `« ${v.object_label} » est prêt pour la signature.` }) });

reg({ key: "contract.approved", version: "1", locale: "fr", variables: ["object_label", "action_path"],
  build: (v) => ({ subject: `Contrat validé : ${v.object_label}`,
    paragraphs: [`Le contrat « ${v.object_label} » a été validé.`],
    action: { label: "Voir le contrat", path: v.action_path },
    in_app_title: `Contrat validé`, in_app_body: `« ${v.object_label} » a été validé.` }) });

reg({ key: "contract.signature_prepared", version: "1", locale: "fr", variables: ["object_label", "action_path"],
  build: (v) => ({ subject: `Signature préparée : ${v.object_label}`,
    paragraphs: [`La signature du contrat « ${v.object_label} » a été préparée.`],
    action: { label: "Suivre la signature", path: v.action_path },
    in_app_title: `Signature préparée`, in_app_body: `Signature préparée pour « ${v.object_label} ».` }) });

reg({ key: "contract.signed", version: "1", locale: "fr", variables: ["object_label", "action_path"],
  build: (v) => ({ subject: `Contrat signé : ${v.object_label}`, greeting: "Bonjour,",
    paragraphs: [`Le contrat « ${v.object_label} » est désormais signé.`, "Le document signé est accessible via le lien sécurisé ci-dessous."],
    action: { label: "Accéder au document signé", path: v.action_path },
    in_app_title: `Contrat signé`, in_app_body: `« ${v.object_label} » est signé.` }) });

reg({ key: "contract.amendment_activated", version: "1", locale: "fr", variables: ["object_label", "action_path"],
  build: (v) => ({ subject: `Avenant activé : ${v.object_label}`,
    paragraphs: [`Un avenant au contrat « ${v.object_label} » a été activé.`],
    action: { label: "Voir l'avenant", path: v.action_path },
    in_app_title: `Avenant activé`, in_app_body: `Avenant activé pour « ${v.object_label} ».` }) });

reg({ key: "contract.blocked", version: "1", locale: "fr", variables: ["object_label", "action_path"],
  build: (v) => ({ subject: `Action requise : ${v.object_label}`,
    paragraphs: [`Le traitement du contrat « ${v.object_label} » est bloqué et nécessite une action.`],
    action: { label: "Débloquer", path: v.action_path },
    in_app_title: `Action requise`, in_app_body: `« ${v.object_label} » est bloqué.` }) });

reg({ key: "signature.completed", version: "1", locale: "fr", variables: ["object_label", "action_path"],
  build: (v) => ({ subject: `Signature terminée : ${v.object_label}`, greeting: "Bonjour,",
    paragraphs: [`La signature du document « ${v.object_label} » est terminée.`, "Le document signé est accessible via le lien sécurisé ci-dessous."],
    action: { label: "Accéder au document signé", path: v.action_path },
    in_app_title: `Signature terminée`, in_app_body: `« ${v.object_label} » est signé.` }) });

reg({ key: "signature.activated", version: "1", locale: "fr", variables: ["object_label", "action_path"],
  build: (v) => ({ subject: `Signature en cours : ${v.object_label}`,
    paragraphs: [`La demande de signature pour « ${v.object_label} » est active.`],
    action: { label: "Suivre la signature", path: v.action_path },
    in_app_title: `Signature en cours`, in_app_body: `Signature active pour « ${v.object_label} ».` }) });

reg({ key: "template.published", version: "1", locale: "fr", variables: ["object_label", "action_path"],
  build: (v) => ({ subject: `Modèle publié : ${v.object_label}`,
    paragraphs: [`Le modèle « ${v.object_label} » a été publié.`],
    action: { label: "Voir le modèle", path: v.action_path },
    in_app_title: `Modèle publié`, in_app_body: `« ${v.object_label} » a été publié.` }) });

reg({ key: "task.notification", version: "1", locale: "fr", variables: ["object_label", "action_path"],
  build: (v) => ({ subject: `Notification : ${v.object_label}`,
    paragraphs: [`${v.object_label}`],
    action: { label: "Ouvrir", path: v.action_path },
    in_app_title: `Notification`, in_app_body: `${v.object_label}` }) });

reg({ key: "member.invited", version: "1", locale: "fr", variables: ["object_label", "action_path"],
  build: (v) => ({ subject: `Invitation à rejoindre l'espace Pierre`, greeting: "Bonjour,",
    paragraphs: ["Vous avez été invité(e) à rejoindre un espace de travail Pierre.", "Cliquez sur le lien sécurisé ci-dessous pour accepter l'invitation et créer votre accès."],
    action: { label: "Accepter l'invitation", path: v.action_path },
    in_app_title: `Invitation à rejoindre`, in_app_body: `Vous avez été invité(e) à rejoindre un espace Pierre.` }) });

export function getCommunicationTemplate(key: string, locale = "fr"): CommunicationTemplate | null {
  return REGISTRY[`${key}@${locale}`] ?? REGISTRY[`${key}@fr`] ?? null;
}

/** Render a communication from the registry, validating variables and producing the content hash. */
export function renderCommunication(input: { templateKey: string; locale: string; variables: Record<string, string>; publicBase: string | null }): { rendered: RenderedCommunication; templateVersion: string } {
  const t = getCommunicationTemplate(input.templateKey, input.locale);
  if (!t) throw new TemplateRenderError(`unknown template: ${input.templateKey}`, "unknown_template");
  assertDeclaredVariables(t.variables, input.variables);
  const out = t.build(input.variables);
  const rendered = renderFromTemplateOutput({ templateKey: t.key, templateVersion: t.version, locale: t.locale, out, publicBase: input.publicBase });
  return { rendered, templateVersion: t.version };
}

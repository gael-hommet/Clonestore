// src/app/assistant/page.tsx
// P9.4 — CloneChat, l'espace conversationnel CloneStore. Cette page n'est montée
// que lorsque le flag produit est actif (voir layout.tsx : blocage serveur réel).
// Deux modes : public (orientation) et client authentifié (opérationnel, OpenAI réel
// gouverné). L'ancienne page de présentation est remplacée par l'expérience réelle.

import { CloneChatWorkspace } from "@/components/clonechat/CloneChatWorkspace";

export default function AssistantPage() {
  return <CloneChatWorkspace />;
}

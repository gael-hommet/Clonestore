// src/lib/clonechat/intelligence/c1/clonechat-answer-router.ts
// C1 — Router de questions : classe chaque question dans une catégorie fermée,
// avec confiance et signaux. Ordre de priorité pensé pour les collisions réelles
// (« Combien coûte Pierre ? » → pricing, pas pierre ; « La démo ne s'ouvre pas » →
// support, pas démo ; « Où sont les mentions légales ? » → navigation, pas legal).

import type { AnswerCategory, AnswerConfidence, AnswerMode, QuestionRouting } from "./clonechat-knowledge-types";

interface Rule {
  readonly category: AnswerCategory;
  readonly pattern: RegExp;
  readonly signal: string;
  readonly confidence: AnswerConfidence;
}

// L'ORDRE COMPTE : première règle qui matche gagne.
const RULES: readonly Rule[] = [
  // 1. Support / bug — la douleur d'abord.
  { category: "support_bug", pattern: /marche\s+pas|ne\s+fonctionne|fonctionne\s+pas|ne\s+s['’]ouvre|s['’]affiche\s+mal|cass[ée]|bug|affiche\s+une\s+erreur|message\s+d['’]erreur|erreur\s+(technique|serveur|\d{3})|\berror\b|crash|plante|bloqu[ée]|je\s+ne\s+vois\s+pas\s+le\s+bon\s+prix|je\s+vois\s+l['’]euro|pas\s+le\s+bon\s+prix|broken|doesn['’]?t\s+work|écran\s+est\s+cassé|déjà\s+eu\s+ce\s+bug|est-ce\s+que\s+c['’]est\s+connu/i, signal: "symptôme de panne/bug", confidence: "high" },
  // 2. État interne (fondateur/interne) — sinon retombera en roadmap.
  { category: "internal_status", pattern: /blocages?|blockers?|readiness|command\s+center|go[-\s]?live|état\s+interne|statut\s+interne|qu['’]est-ce\s+qui\s+bloque|prêts?\s+pour\s+la\s+production|exact\s+blockers/i, signal: "état interne / blocages", confidence: "high" },
  // 3. Navigation vers les pages légales (avant la catégorie legal).
  { category: "site_navigation", pattern: /(où|ou\s+sont|quelle?\s+page|quel\s+lien|adresse|url).*(mentions|cgu|cgv|confidentialité|dpa|légales)/i, signal: "localisation d'une page légale", confidence: "high" },
  // 4. Légal / conformité.
  { category: "legal_or_compliance", pattern: /l[ée]gal|juridique|conformit|conforme|rgpd|gdpr|\bdpa\b|responsabilit|droit\s+du\s+travail|avocat|compliance|liabilit/i, signal: "question légale/conformité", confidence: "high" },
  // 5. Pricing (avant Pierre : « Combien coûte Pierre ? »).
  { category: "pricing", pattern: /combien|coûte|cout[e]?|prix|tarif|449|499|\bchf\b|euros?|€|payer|paiement|essai\s+gratuit|free\s+trial|gratuit|abonnement|price|cost|pricing/i, signal: "prix/paiement", confidence: "high" },
  // 6. Disponibilité pays.
  { category: "country_availability", pattern: /disponible\s+(en|au|dans)|available\s+in|suisse|belgique|luxembourg|\bfrance\b|quels?\s+pays|switzerland|belgium/i, signal: "pays de lancement", confidence: "high" },
  // 7. Démo / réservation.
  { category: "demo_or_reservation", pattern: /démo|\bdemo\b|réserv|reserv|essayer|tester|voir\s+pierre\s+en\s+action|book\s+a?\s?demo|rendez-vous/i, signal: "démo/réservation", confidence: "high" },
  // 8. Objections de vente (avant Pierre : « Peut-il remplacer la RH ? »).
  { category: "sales_objection", pattern: /trop\s+cher|remplac|replace|déjà\s+(chatgpt|un\s+logiciel|un\s+sirh|un\s+outil)|confiance|trust|s['’]il\s+(?:se\s+trompe|fait\s+(?:une\s+)?erreur)|fait\s+des\s+erreurs|mistake|pas\s+prêt|vraiment\s+prêt|est-il\s+prêt|is\s+it\s+ready|pourquoi\s+maintenant|why\s+now|convainc|objection|s['’]intégr|integrat/i, signal: "objection commerciale", confidence: "high" },
  // 9. Navigation générale (« quelle page », « quel lien », « a une page »).
  { category: "site_navigation", pattern: /où\s|quelle?\s+page|quel\s+lien|\bpage\b|\blien\b|\burl\b|naviguer|trouver\s+la|meilleure?\s+page/i, signal: "navigation site", confidence: "medium" },
  // 10. Technologies (T1/T2 nommées).
  { category: "technology_explanation", pattern: /clone(os|adn|guard|trace|voice|policy|continuum|trust|review|signals|learn|brief|call|room)|technolog|documenttech|mailtech|calendartech|signaturetech|voicetech|notificationtech|connectortech|memorytech|evidencetech|workflowtech|analyticstech|filetech|exporttech|permissiontech|integration\s?bus|technology\s?bus|\bvoix\b|\bvoice\b/i, signal: "technologie nommée", confidence: "high" },
  // 11. Roadmap / futur.
  { category: "roadmap", pattern: /roadmap|feuille\s+de\s+route|quand\b|bientôt|futur|à\s+venir|prochaine?s?\s+(étape|phase|version)|what['’]?s\s+next|plus\s+tard/i, signal: "roadmap/futur", confidence: "medium" },
  // 12. Pierre.
  { category: "pierre_explanation", pattern: /pierre|employé\s+ia\s+rh|hr\s+employee|qui\s+est|missions?\s+rh/i, signal: "question Pierre", confidence: "high" },
  // 13. Produit CloneStore.
  { category: "product_explanation", pattern: /clonestore|c['’]est\s+quoi|qu['’]est-ce\s+que|what\s+is|marketplace|employés?\s+ia|boutique|produit/i, signal: "question produit", confidence: "high" },
];

export function routeCloneChatQuestion(question: string, mode: AnswerMode = "visitor"): QuestionRouting {
  const q = (question ?? "").trim();
  if (q.length === 0) {
    return { category: "unknown", confidence: "low", matchedSignals: ["question vide"] };
  }
  for (const rule of RULES) {
    if (rule.pattern.test(q)) {
      // L'état interne détaillé est réservé aux modes fondateur/interne ; pour le
      // public, la même question reçoit la réponse roadmap honnête.
      if (rule.category === "internal_status" && mode !== "founder" && mode !== "internal") {
        return { category: "roadmap", confidence: "medium", matchedSignals: [rule.signal, "reclassé public"] };
      }
      return { category: rule.category, confidence: rule.confidence, matchedSignals: [rule.signal] };
    }
  }
  return { category: "unknown", confidence: "low", matchedSignals: [] };
}

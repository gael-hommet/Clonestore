# P-FINAL 02 — Packet de revue juridique

**À envoyer au juriste avec les pages légales**
**Contexte: Pierre, assistant IA RH — Lancement public**

---

## Description du produit

**Pierre** est un assistant IA pour les RH des PME françaises.

**Ce que Pierre FAIT :**
- Produit des brouillons de documents RH (contrats, lettres, comptes-rendus)
- Génère des brouillons d'emails RH
- Aide à organiser et planifier les tâches RH
- Résume des documents et contextes RH

**Ce que Pierre NE FAIT PAS (hard limits absolues) :**
- Pierre ne signe jamais de documents officiels
- Pierre ne soumet jamais de DSN ou déclarations officielles
- Pierre n'envoie jamais d'email sans validation humaine obligatoire
- Pierre ne remplace pas un avocat, un expert-comptable ou un logiciel de paie certifié
- Pierre ne garantit pas la conformité légale de ses productions
- Pierre ne prend pas de décisions autonomes — tous les outputs nécessitent une validation humaine

**Avertissement toujours affiché aux utilisateurs :**
> "Pierre est un assistant IA. Ses productions sont des brouillons soumis à validation humaine obligatoire. Pierre ne remplace pas un conseil juridique ou comptable."

---

## Pages légales à valider

### 1. CGU — `/legal/cgu`

**Points à vérifier :**
- Définition du service (assistant IA, brouillons uniquement)
- Responsabilité limitée aux brouillons — pas aux décisions finales
- Obligation de validation humaine avant usage
- Propriété intellectuelle des brouillons générés
- Conditions de résiliation et remboursement
- Droit applicable (droit français) et juridiction compétente

### 2. CGV — `/legal/cgv`

**Points à vérifier :**
- Tarif : 449€ TTC/an (abonnement annuel)
- Renouvellement automatique avec préavis
- Pas d'essai gratuit
- Politique de remboursement (aucun remboursement au prorata, sauf cas légaux)
- Traitement des données pendant et après résiliation
- TVA applicable (20% pour clients B2B France)

### 3. DPA — `/legal/dpa`

**Points à vérifier :**
- Identification des rôles RT/ST (CloneStore comme RT, clients comme RT ou ST selon usage)
- Catégories de données traitées :
  - Données salariés (nom, contrat, poste, salaire)
  - Données RH (absences, évaluations, congés)
  - Données de connexion (email, logs)
- Sous-traitants de rang 2 : Supabase (EU), Stripe (US — CCT), Resend (US — CCT), Anthropic/OpenAI (US — CCT)
- Transferts hors UE : Anthropic, OpenAI, Stripe (encadrés par CCT)
- Durées de conservation par catégorie
- Procédures DSAR (30 jours légaux)
- Gestion des violations (notification CNIL sous 72h)

### 4. Politique de confidentialité — `/legal/confidentialite`

**Points à vérifier :**
- Base légale du traitement (contrat, intérêt légitime, consentement)
- Droits RGPD des personnes concernées (accès, rectification, effacement, portabilité)
- Politique cookies (si analytics présents)
- Transferts hors UE documentés
- Contact DPO ou point de contact RGPD
- Délai de réponse DSAR (30 jours)

### 5. Mentions légales — `/legal/mentions`

**Points à vérifier :**
- Toutes les informations de la société éditrice sont présentes et correctes
- Aucun `[placeholder]` restant
- Hébergeur identifié avec adresse et contact
- Éditeur identifié avec SIREN et adresse

---

## Claims commerciales — À valider

### Claims autorisées

- ✅ "Pierre rédige des brouillons de documents RH"
- ✅ "Pierre aide à préparer vos procédures RH"
- ✅ "Vos équipes RH gagnent du temps sur les tâches répétitives"
- ✅ "Brouillons soumis à validation humaine obligatoire"
- ✅ "Pierre suggère, vous décidez"

### Claims interdites (jamais dans les communications)

- ❌ "Pierre garantit la conformité de vos documents"
- ❌ "Pierre remplace un avocat"
- ❌ "Pierre remplace un expert-comptable"
- ❌ "Zéro erreur / sans erreur garantie"
- ❌ "Pierre prend des décisions autonomes"
- ❌ "Satisfait ou remboursé"
- ❌ "Logiciel de paie officiel"
- ❌ "Essai gratuit de 7 jours / open-bar"
- ❌ "Conforme à toutes les lois"
- ❌ "Génère des bulletins de salaire officiels"

---

## Questions spécifiques pour le juriste

1. **Responsabilité brouillons IA :** La limitation de responsabilité pour les brouillons générés par IA est-elle suffisante ? Faut-il renforcer la clause de non-garantie de conformité ?

2. **Cas sensibles RH :** Pierre bloque automatiquement les licenciements, sanctions disciplinaires, et cas de harcèlement (brouillons interdits). La politique actuelle vous semble-t-elle suffisante ou faut-il aller plus loin ?

3. **Pré-paie sans DSN :** Pierre peut générer des récapitulatifs pré-paie mais ne soumet jamais de DSN. Cette limitation est-elle correctement formulée dans les CGU ?

4. **Transferts hors UE :** Le DPA mentionne Anthropic et OpenAI (US) avec CCT. Cette approche est-elle suffisante au regard du RGPD actuel ?

5. **Droit de résiliation :** La politique actuelle (pas de remboursement au prorata) est-elle légalement défendable pour un abonnement B2B annuel ?

---

## Documents fournis

- `docs/B47_FINAL_LEGAL_REVIEW_CHECKLIST.md` — Checklist légale B47
- `docs/B47_PIERRE_ALLOWED_AND_FORBIDDEN_CLAIMS.md` — Claims autorisées/interdites
- `docs/B47_PIERRE_HR_SENSITIVE_CASE_POLICY.md` — Politique cas sensibles
- `docs/B47_LEGAL_COMMERCIAL_GUARDRAILS.md` — Guardrails légaux B47

---

*P-FINAL 02 — Packet de revue juridique — À compléter avec les infos réelles avant envoi*

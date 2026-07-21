// src/lib/clonechat/conversations/local-store.ts
// C1.8 FINAL PART 2 §5B — HISTORIQUE ANONYME : LOCAL, BORNÉ, ET HONNÊTE.
//
// Un visiteur anonyme n'a pas d'identité serveur — et on ne lui en fabrique JAMAIS une.
// Son historique vit donc UNIQUEMENT dans SON navigateur. Ce module est le seul endroit qui
// le gère, et il ne promet rien qu'il ne tienne :
//
//   · aucune persistance serveur          → pas de multi-appareil, et on le DIT ;
//   · aucun faux identifiant, aucun tenant → rien à isoler côté serveur, donc rien à fuir ;
//   · capacité BORNÉE et expiration        → le stockage local n'est pas un dépotoir ;
//   · séparation stricte de l'historique authentifié (clés distinctes, jamais fusionnés).
//
// Ce n'est PAS un second store de conversations : le store canonique (`types.ts`,
// `durable-store.ts`, `memory-store.ts`) reste la seule vérité pour les comptes AUTHENTIFIÉS.
// Ici, il n'y a par définition aucun serveur à interroger.
//
// Module PUR : il reçoit une abstraction de stockage. Il est donc testable sans navigateur.

export interface LocalStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface LocalMessage {
  readonly role: "user" | "assistant";
  readonly content: unknown[];
  readonly at: string;
}

export interface LocalConversation {
  readonly id: string;
  readonly title: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly messages: readonly LocalMessage[];
}

// ── BORNES EXPLICITES ET DOCUMENTÉES ─────────────────────────────────────────
// Elles sont choisies, pas subies : un stockage local sans limite finit par casser le
// navigateur de l'utilisateur (quota) — et il casserait en SILENCE.
export const LOCAL_LIMITS = Object.freeze({
  maxConversations: 20,
  maxMessagesPerConversation: 60,
  maxTotalBytes: 256 * 1024, // 256 Ko
  ttlDays: 30,
});

/** Clé DISTINCTE de celle de l'historique authentifié : les deux ne se mélangent jamais. */
export const LOCAL_KEY = "clonestore.clonechat.local-history.v1";

/** Titre honnête, dérivé du premier message RÉEL — jamais inventé. */
export function deriveTitle(firstUserText: string): string {
  const t = (firstUserText ?? "").trim().replace(/\s+/g, " ");
  if (t.length === 0) return "Nouvelle conversation";
  return t.length <= 48 ? t : `${t.slice(0, 47)}…`;
}

function parse(raw: string | null): LocalConversation[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? (v as LocalConversation[]).filter((c) => c && typeof c.id === "string") : [];
  } catch {
    return []; // stockage corrompu : on repart proprement, on ne fait jamais planter le chat
  }
}

/** Retire ce qui a expiré. Une conversation vieille de plus de `ttlDays` n'est plus à personne. */
function dropExpired(list: readonly LocalConversation[], now: Date): LocalConversation[] {
  const cutoff = now.getTime() - LOCAL_LIMITS.ttlDays * 24 * 3600 * 1000;
  return list.filter((c) => {
    const t = Date.parse(c.updatedAt);
    return Number.isFinite(t) ? t >= cutoff : false;
  });
}

/** Applique TOUTES les bornes : messages, nombre de fils, puis taille totale. */
function enforceBounds(list: readonly LocalConversation[]): LocalConversation[] {
  // 1) messages par conversation (on garde les plus RÉCENTS)
  let out = list.map((c) => ({
    ...c,
    messages: c.messages.slice(-LOCAL_LIMITS.maxMessagesPerConversation),
  }));

  // 2) nombre de conversations (les plus récemment actives d'abord)
  out.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  out = out.slice(0, LOCAL_LIMITS.maxConversations);

  // 3) taille totale : on retire les plus ANCIENNES jusqu'à repasser sous la borne.
  while (out.length > 1 && JSON.stringify(out).length > LOCAL_LIMITS.maxTotalBytes) {
    out.pop();
  }
  return out;
}

export function loadLocalConversations(storage: LocalStorageLike, now: Date = new Date()): LocalConversation[] {
  const list = dropExpired(parse(storage.getItem(LOCAL_KEY)), now);
  return enforceBounds(list);
}

function save(storage: LocalStorageLike, list: readonly LocalConversation[]): LocalConversation[] {
  const bounded = enforceBounds(list);
  try {
    storage.setItem(LOCAL_KEY, JSON.stringify(bounded));
  } catch {
    // Quota dépassé : on retente avec la moitié plutôt que de perdre TOUT l'historique.
    const half = bounded.slice(0, Math.max(1, Math.floor(bounded.length / 2)));
    try { storage.setItem(LOCAL_KEY, JSON.stringify(half)); return half; } catch { /* on abandonne en silence, jamais de crash */ }
  }
  return bounded;
}

export function createLocalConversation(
  storage: LocalStorageLike,
  id: string,
  now: Date = new Date(),
): LocalConversation {
  const at = now.toISOString();
  const conv: LocalConversation = { id, title: "Nouvelle conversation", createdAt: at, updatedAt: at, messages: [] };
  save(storage, [conv, ...loadLocalConversations(storage, now)]);
  return conv;
}

/** Ajoute un message. Le titre se fixe sur le PREMIER message utilisateur réel. */
export function appendLocalMessage(
  storage: LocalStorageLike,
  id: string,
  message: LocalMessage,
  now: Date = new Date(),
): LocalConversation[] {
  const list = loadLocalConversations(storage, now);
  const at = now.toISOString();
  const idx = list.findIndex((c) => c.id === id);

  const firstText = (m: LocalMessage): string => {
    const b = (m.content ?? []).find((x) => typeof x === "object" && x !== null && (x as { type?: string }).type === "text");
    return b ? String((b as { text?: string }).text ?? "") : "";
  };

  if (idx < 0) {
    const conv: LocalConversation = {
      id, createdAt: at, updatedAt: at,
      title: message.role === "user" ? deriveTitle(firstText(message)) : "Nouvelle conversation",
      messages: [message],
    };
    return save(storage, [conv, ...list]);
  }

  const cur = list[idx];
  const noTitleYet = cur.title === "Nouvelle conversation";
  const next: LocalConversation = {
    ...cur,
    updatedAt: at,
    title: noTitleYet && message.role === "user" ? deriveTitle(firstText(message)) : cur.title,
    messages: [...cur.messages, message],
  };
  const copy = [...list];
  copy[idx] = next;
  return save(storage, copy);
}

/** Suppression IDEMPOTENTE : supprimer deux fois ne casse rien et ne ressuscite rien. */
export function deleteLocalConversation(
  storage: LocalStorageLike,
  id: string,
  now: Date = new Date(),
): LocalConversation[] {
  return save(storage, loadLocalConversations(storage, now).filter((c) => c.id !== id));
}

export function getLocalConversation(
  storage: LocalStorageLike,
  id: string,
  now: Date = new Date(),
): LocalConversation | null {
  return loadLocalConversations(storage, now).find((c) => c.id === id) ?? null;
}

export function clearLocalHistory(storage: LocalStorageLike): void {
  try { storage.removeItem(LOCAL_KEY); } catch { /* ignore */ }
}

/**
 * La phrase que l'interface DOIT afficher à un visiteur anonyme. On ne laisse pas croire à une
 * durabilité qui n'existe pas : cet historique meurt avec ce navigateur.
 */
export const LOCAL_HISTORY_DISCLAIMER =
  "Cet historique est enregistré dans ce navigateur uniquement : il ne vous suivra pas sur un autre appareil.";

/* ================================================================== */
/* LEGO BLOCK — per-user draft store, one slot per (user, kind). Shaped */
/* like userPrefsStore.js on purpose: localStorage-backed, keyed by the */
/* same personal-number identity already used for dashboard-layout      */
/* personalization — drafts are inherently personal/pre-submission      */
/* content, so per-device-but-per-user storage is the right layer here  */
/* (unlike the actual submitted ticket/catalog data once real, which    */
/* needs true shared backend persistence).                              */
/*                                                                      */
/* Deliberately ONE draft per (user, kind) — "the request I'm in the    */
/* middle of filling out" — not a whole draft library. Starting a new   */
/* form when one is already saved offers to resume it instead of        */
/* silently overwriting it.                                             */
/* ================================================================== */

const LATENCY_MS = 80;

function resolve(value) {
  return new Promise((res) => setTimeout(() => res(value), LATENCY_MS));
}

function storageKey(userId, kind) {
  return `hangar-draft:${userId || "guest"}:${kind}`;
}

export async function fetchDraft(userId, kind) {
  try {
    const raw = localStorage.getItem(storageKey(userId, kind));
    return resolve(raw ? JSON.parse(raw) : null);
  } catch {
    return resolve(null);
  }
}

export async function saveDraft(userId, kind, data) {
  try {
    localStorage.setItem(storageKey(userId, kind), JSON.stringify({ data, savedAt: Date.now() }));
  } catch { /* private browsing / storage disabled */ }
  return resolve(true);
}

export async function clearDraft(userId, kind) {
  try {
    localStorage.removeItem(storageKey(userId, kind));
  } catch { /* ignore */ }
  return resolve(true);
}

/* ================================================================== */
/* LEGO BLOCK — per-user draft store, one slot per (user, kind). Real    */
/* HTTP calls to data/routes/drafts.js now (previously localStorage) —  */
/* same exported function names/signatures as before. Server-backed     */
/* storage is strictly better here: a draft now survives a device       */
/* switch, matching how a real backend should behave.                   */
/*                                                                      */
/* Deliberately ONE draft per (user, kind) — "the request I'm in the    */
/* middle of filling out" — not a whole draft library.                  */
/* ================================================================== */

import { http } from "./http.js";

export async function fetchDraft(userId, kind) {
  return http.get(`/users/${encodeURIComponent(userId || "guest")}/drafts/${kind}`);
}

export async function saveDraft(userId, kind, data) {
  await http.put(`/users/${encodeURIComponent(userId || "guest")}/drafts/${kind}`, { data });
  return true;
}

export async function clearDraft(userId, kind) {
  await http.delete(`/users/${encodeURIComponent(userId || "guest")}/drafts/${kind}`);
  return true;
}

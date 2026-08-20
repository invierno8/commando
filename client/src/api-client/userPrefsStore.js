/* ================================================================== */
/* LEGO BLOCK — per-USER preference store (not per-device). Keyed by     */
/* personal number — the same identity OpenID resolves to elsewhere in  */
/* this app — so a person's saved dashboard layout follows *them* to    */
/* whatever computer they're logged in from. Real HTTP calls to         */
/* data/routes/user-prefs.js now (previously localStorage) — same       */
/* exported function names/signatures as before, and this genuinely     */
/* syncs across devices now, which localStorage alone never could.      */
/* ================================================================== */

import { http } from "./http.js";

export async function fetchUserPref(userId, namespace) {
  return http.get(`/users/${encodeURIComponent(userId || "guest")}/prefs/${encodeURIComponent(namespace)}`);
}

export async function saveUserPref(userId, namespace, value) {
  await http.put(`/users/${encodeURIComponent(userId || "guest")}/prefs/${encodeURIComponent(namespace)}`, { value });
  return true;
}

export async function clearUserPref(userId, namespace) {
  await http.delete(`/users/${encodeURIComponent(userId || "guest")}/prefs/${encodeURIComponent(namespace)}`);
  return true;
}

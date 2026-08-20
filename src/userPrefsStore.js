/* ================================================================== */
/* LEGO BLOCK — per-USER preference store (not per-device). Keyed by    */
/* personal number — the same identity OpenID resolves to elsewhere in */
/* this app — so a person's saved dashboard layout follows *them* to   */
/* whatever computer they're logged in from, instead of living on one  */
/* machine's browser storage. In the military, the same person signs   */
/* in from many different terminals; a device-bound key is wrong.      */
/*                                                                      */
/* Shaped exactly like brigadeStore.js on purpose: async fetch/save     */
/* functions, backed by localStorage for now because this is a         */
/* frontend-only prototype with no real backend yet — swapping the     */
/* body of these functions for real calls to a real per-user database  */
/* later is a contained change, no consuming screen needs to change.   */
/* Once that swap happens, this genuinely syncs across every device a  */
/* person logs into, which localStorage alone can never do.            */
/*                                                                      */
/* Storage footprint is already minimal by construction — a layout is  */
/* just two arrays of short widget-key strings ({order, hidden}), no   */
/* redundant data — so there's nothing further to compress.            */
/* ================================================================== */

const LATENCY_MS = 120;

function resolve(value) {
  return new Promise((res) => setTimeout(() => res(value), LATENCY_MS));
}

function storageKey(userId, namespace) {
  return `hangar-user-prefs:${userId || "guest"}:${namespace}`;
}

export async function fetchUserPref(userId, namespace) {
  try {
    const raw = localStorage.getItem(storageKey(userId, namespace));
    return resolve(raw ? JSON.parse(raw) : null);
  } catch {
    return resolve(null);
  }
}

export async function saveUserPref(userId, namespace, value) {
  try {
    localStorage.setItem(storageKey(userId, namespace), JSON.stringify(value));
  } catch { /* private browsing / storage disabled */ }
  return resolve(true);
}

export async function clearUserPref(userId, namespace) {
  try {
    localStorage.removeItem(storageKey(userId, namespace));
  } catch { /* ignore */ }
  return resolve(true);
}

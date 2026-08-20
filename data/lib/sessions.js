/* ================================================================== */
/* LEGO BLOCK — opaque session tokens, in-memory only. Shared by both   */
/* the dev-user login (hangar_dev_session cookie) and the separate,     */
/* stricter admin gate (hangar_admin_session cookie) — each middleware  */
/* only ever reads its own cookie name and never trusts the other's.    */
/*                                                                      */
/* Deliberately not a JWT: no parsing/verification surface, tokens are  */
/* revocable by just deleting the map entry, and this whole module is   */
/* the one thing a real OpenID SSO integration later replaces — nothing */
/* else in the codebase should ever read a session cookie directly.     */
/* ================================================================== */

import crypto from "node:crypto";

const DEFAULT_TTL_MS = 12 * 60 * 60 * 1000; // 12 שעות

const sessions = new Map(); // token -> { payload, expiresAt }

export function createSession(payload, ttlMs = DEFAULT_TTL_MS) {
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, { payload, expiresAt: Date.now() + ttlMs });
  return token;
}

export function resolveSession(token) {
  if (!token) return null;
  const entry = sessions.get(token);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return entry.payload;
}

export function destroySession(token) {
  sessions.delete(token);
}

// ניקוי תקופתי של טוקנים שפגו — מונע דליפת זיכרון על שרת ארוך-טווח.
setInterval(() => {
  const now = Date.now();
  for (const [token, entry] of sessions) {
    if (entry.expiresAt < now) sessions.delete(token);
  }
}, 30 * 60 * 1000).unref();

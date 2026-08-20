/* ================================================================== */
/* LEGO BLOCK — in-memory store for two system-admin-only concerns:     */
/* pending destructive-action approvals, and the audit log. Same shape  */
/* as notificationStore.js on purpose (async wrappers around a plain    */
/* in-memory array) — this whole app is one browser tab/session with no */
/* real backend yet, so this is deliberately global (not per-brigade)   */
/* since system-admin actions span every brigade in the system.         */
/*                                                                      */
/* Why a separate approval queue instead of just blocking the action:   */
/* a regular system admin's destructive request must be reviewable by a */
/* super-admin from *their own* session, at their own pace — it can't   */
/* just be an in-memory flag on whoever clicked the button.             */
/* ================================================================== */

const LATENCY_MS = 60;
let pendingDeletions = [];
let auditLog = [];

function resolve(value) {
  return new Promise((res) => setTimeout(() => res(value), LATENCY_MS));
}

export async function fetchPendingDeletions() {
  return resolve([...pendingDeletions].sort((a, b) => b.requestedAt - a.requestedAt));
}

export async function requestDeletion({ targetType, targetId, targetLabel, requestedBy }) {
  const entry = { id: "del-" + Date.now(), targetType, targetId, targetLabel, requestedBy, requestedAt: Date.now(), status: "pending" };
  pendingDeletions = [entry, ...pendingDeletions];
  return resolve(entry);
}

export async function resolveDeletion(id, decision, decidedBy) {
  let entry = null;
  pendingDeletions = pendingDeletions.map((d) => {
    if (d.id !== id) return d;
    entry = { ...d, status: decision, decidedBy, decidedAt: Date.now() };
    return entry;
  });
  return resolve(entry);
}

export async function fetchAuditLog() {
  return resolve([...auditLog].sort((a, b) => b.ts - a.ts));
}

export async function logAction({ actor, action, target }) {
  const entry = { id: "log-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6), actor, action, target, ts: Date.now() };
  auditLog = [entry, ...auditLog];
  return resolve(entry);
}

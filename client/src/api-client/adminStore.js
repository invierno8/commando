/* ================================================================== */
/* LEGO BLOCK — pending destructive-action approvals + the audit log.   */
/* Global (not per-brigade), since system-admin actions span every      */
/* brigade in the system. Real HTTP calls to data/routes/admin.js now — */
/* same exported function names/signatures as before.                  */
/* ================================================================== */

import { http } from "./http.js";

export async function fetchPendingDeletions() {
  return http.get(`/admin/deletions`);
}

export async function requestDeletion({ targetType, targetId, targetLabel, requestedBy, snapshot }) {
  return http.post(`/admin/deletions`, { targetType, targetId, targetLabel, requestedBy, snapshot });
}

export async function resolveDeletion(id, decision, decidedBy) {
  return http.patch(`/admin/deletions/${id}`, { decision, decidedBy });
}

export async function fetchAuditLog() {
  return http.get(`/admin/audit-log`);
}

// targetType/snapshot אופציונליים בכוונה — רוב הפעולות ביומן (אישור/דחייה,
// שינוי סטטוס וכו') אינן הפיכות ולא צריכות snapshot. אבל פעולת מחיקה שמצרפת
// snapshot (עותק מלא של מה שנמחק) הופכת את רשומת היומן ל"גיבוי" בפועל.
export async function logAction({ actor, action, target, targetType, snapshot }) {
  return http.post(`/admin/audit-log`, { actor, action, target, targetType, snapshot });
}

export async function markLogRestored(id) {
  await http.patch(`/admin/audit-log/${id}/restore`);
  return true;
}

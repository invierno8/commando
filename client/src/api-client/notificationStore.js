/* ================================================================== */
/* LEGO BLOCK — the personal notification feed. Real HTTP calls to      */
/* data/routes/notifications.js now — same exported function names/     */
/* signatures as before, so App.jsx doesn't change.                     */
/*                                                                      */
/* Relevance (who should SEE a given notification) is still decided in  */
/* App.jsx at render time, exactly as before — this module only stores  */
/* and fetches the raw feed.                                            */
/* ================================================================== */

import { http } from "./http.js";

export const NOTIFICATION_TYPES = {
  SUBMITTED: "submitted",
  APPROVED: "approved",
  REJECTED: "rejected",
  PRIORITIZED: "prioritized",
  STATUS_CHANGED: "status_changed",
  ASSIGNED: "assigned",
  COMMENTED: "commented",
};

export async function fetchNotifications(brigadeId) {
  return http.get(`/brigades/${brigadeId}/notifications`);
}

export async function pushNotification(brigadeId, notification) {
  return http.post(`/brigades/${brigadeId}/notifications`, notification);
}

export async function markNotificationsRead(brigadeId, ids) {
  await http.patch(`/brigades/${brigadeId}/notifications/read`, { ids });
  return true;
}

export async function markAllNotificationsRead(brigadeId) {
  await http.patch(`/brigades/${brigadeId}/notifications/read-all`);
  return true;
}

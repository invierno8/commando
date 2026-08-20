/* ================================================================== */
/* LEGO BLOCK — in-memory notification feed, per brigade. Shaped like   */
/* brigadeStore.js on purpose: async fetch/push functions around a      */
/* plain in-memory bucket, so swapping this for a real push/poll        */
/* backend later is a contained change. Session-local by design — it    */
/* mirrors the ticket mutations in Tickets.jsx, which are themselves    */
/* still local React state with no write-back to brigadeStore.js, so    */
/* notifications about those mutations shouldn't outlive them either.   */
/*                                                                      */
/* Relevance (who should SEE a given notification) is deliberately NOT  */
/* decided here — every notification is stored once, and App.jsx        */
/* filters the feed per viewer (role/unit/persona) at render time,      */
/* exactly mirroring how ticket visibility itself is already scoped     */
/* elsewhere in this app (see ticketBadgeCount in App.jsx).             */
/* ================================================================== */

const LATENCY_MS = 60;
const buckets = {};

function resolve(value) {
  return new Promise((res) => setTimeout(() => res(value), LATENCY_MS));
}

function bucket(brigadeId) {
  if (!buckets[brigadeId]) buckets[brigadeId] = [];
  return buckets[brigadeId];
}

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
  return resolve([...bucket(brigadeId)].sort((a, b) => b.ts - a.ts));
}

export async function pushNotification(brigadeId, notification) {
  const entry = {
    id: "ntf-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
    read: false,
    ts: Date.now(),
    ...notification,
  };
  bucket(brigadeId).unshift(entry);
  return resolve(entry);
}

export async function markNotificationsRead(brigadeId, ids) {
  bucket(brigadeId).forEach((n) => { if (ids.includes(n.id)) n.read = true; });
  return resolve(true);
}

export async function markAllNotificationsRead(brigadeId) {
  bucket(brigadeId).forEach((n) => { n.read = true; });
  return resolve(true);
}

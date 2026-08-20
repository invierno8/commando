/* ================================================================== */
/* LEGO BLOCK — in-memory blocklist store, per brigade. A blocked person */
/* cannot use the system within the scope they were blocked at: a unit  */
/* officer can only block someone within their own unit (scoped block), */
/* a brigade officer (or system admin) can block anyone anywhere in the */
/* brigade — including a unit officer — because they manage the whole   */
/* brigade width-wise (ראו "לנהל הכל רוחבית" בבקשת המשתמש).             */
/* ================================================================== */

const LATENCY_MS = 120;

function resolve(value) {
  return new Promise((res) => setTimeout(() => res(value), LATENCY_MS));
}

const buckets = {};
function bucket(brigadeId) {
  if (!buckets[brigadeId]) buckets[brigadeId] = []; // flat list — כל רשומה נושאת scope+unit משלה
  return buckets[brigadeId];
}

export const BLOCK_SCOPE = { UNIT: "unit", BRIGADE: "brigade" };

export async function fetchBlockedList(brigadeId) {
  return resolve([...bucket(brigadeId)].sort((a, b) => b.blockedAt - a.blockedAt));
}

export async function blockUser(brigadeId, { scope, unit, personalNumber, rank, name, reason, blockedBy }) {
  const entry = {
    id: "blk-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
    scope, unit: unit || null, personalNumber, rank, name,
    reason, blockedBy, blockedAt: Date.now(),
  };
  buckets[brigadeId] = [entry, ...bucket(brigadeId)];
  return resolve(entry);
}

export async function unblockUser(brigadeId, blockId) {
  buckets[brigadeId] = bucket(brigadeId).filter((b) => b.id !== blockId);
  return resolve(true);
}

// חסימת יחידה חלה רק בתוך אותה יחידה; חסימת חטיבה חוסמת בכל מקום בחטיבה —
// כולל קציני יחידה, כי קצין אמל״ח חטיבה מנהל הכל רוחבית.
export async function isBlocked(brigadeId, personalNumber, unit) {
  if (!personalNumber) return resolve(null);
  const hit = bucket(brigadeId).find(
    (b) => b.personalNumber === personalNumber && (b.scope === BLOCK_SCOPE.BRIGADE || (b.scope === BLOCK_SCOPE.UNIT && b.unit === unit))
  );
  return resolve(hit || null);
}

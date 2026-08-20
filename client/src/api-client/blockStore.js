/* ================================================================== */
/* LEGO BLOCK — blocklist store. A blocked person cannot use the system  */
/* within the scope they were blocked at: a unit officer can only block  */
/* someone within their own unit (scoped block), a brigade officer (or   */
/* system admin) can block anyone anywhere in the brigade — including a  */
/* unit officer — because they manage the whole brigade width-wise.      */
/*                                                                       */
/* Real HTTP calls to data/routes/blocks.js now — same exported function */
/* names/signatures as before, so no consuming screen needs to change.   */
/* ================================================================== */

import { http } from "./http.js";

export const BLOCK_SCOPE = { UNIT: "unit", BRIGADE: "brigade" };

export async function fetchBlockedList(brigadeId) {
  return http.get(`/brigades/${brigadeId}/blocks`);
}

export async function blockUser(brigadeId, { scope, unit, personalNumber, rank, name, reason, blockedBy }) {
  return http.post(`/brigades/${brigadeId}/blocks`, { scope, unit, personalNumber, rank, name, reason, blockedBy });
}

export async function unblockUser(brigadeId, blockId) {
  await http.delete(`/brigades/${brigadeId}/blocks/${blockId}`);
  return true;
}

// חסימת יחידה חלה רק בתוך אותה יחידה; חסימת חטיבה חוסמת בכל מקום בחטיבה —
// כולל קציני יחידה, כי קצין אמל״ח חטיבה מנהל הכל רוחבית.
export async function isBlocked(brigadeId, personalNumber, unit) {
  if (!personalNumber) return null;
  const qs = new URLSearchParams({ personalNumber, ...(unit ? { unit } : {}) });
  return http.get(`/brigades/${brigadeId}/blocks/check?${qs.toString()}`);
}

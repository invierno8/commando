/* ================================================================== */
/* LEGO BLOCK — the per-brigade data layer. HANGAR is כלל-זרועי: every  */
/* brigade has its own catalog, tickets, roster and dashboard stats,    */
/* isolated from every other brigade's. Real HTTP calls to              */
/* data/routes/brigade-data.js now — same exported function names/      */
/* signatures for reads as before, plus new create/update/delete        */
/* functions for catalog items and tickets (there was no persistence    */
/* for those at all before this pass — Catalog.jsx/Tickets.jsx only     */
/* mutated local React state, gone on refresh).                         */
/*                                                                      */
/* Catalog.jsx/Tickets.jsx still compute every status transition        */
/* themselves (who can approve, what a rejection looks like, team-lead  */
/* gating, etc.) exactly as before — these functions only persist       */
/* whatever object the screen hands them.                               */
/* ================================================================== */

import { http } from "./http.js";
import { resolveCatalogMedia } from "./demoMediaAssets.js";

export async function fetchBrigadeUnits(brigadeId) {
  return http.get(`/brigades/${brigadeId}/units`);
}
export async function fetchBrigadeCatalog(brigadeId) {
  const catalog = await http.get(`/brigades/${brigadeId}/catalog`);
  return resolveCatalogMedia(catalog);
}
export async function fetchBrigadeTickets(brigadeId) {
  return http.get(`/brigades/${brigadeId}/tickets`);
}
export async function fetchBrigadeRoster(brigadeId) {
  return http.get(`/brigades/${brigadeId}/roster`);
}
export async function fetchBrigadeDashboard(brigadeId) {
  return http.get(`/brigades/${brigadeId}/dashboard`);
}

// כתיבה-חוזרת מאשף ההתקנה. יחידות/מרשם בלבד — קטלוג/דרישות/דשבורד נשארים
// כפי שהיו (או ריקים לחטיבה חדשה).
export async function saveBrigadeSetup(brigadeId, { units }) {
  return http.post(`/brigades/${brigadeId}/setup`, { units });
}

export async function createCatalogItem(brigadeId, item) {
  return http.post(`/brigades/${brigadeId}/catalog`, item);
}
export async function updateCatalogItem(brigadeId, itemId, patch) {
  return http.patch(`/brigades/${brigadeId}/catalog/${itemId}`, patch);
}
export async function deleteCatalogItem(brigadeId, itemId) {
  await http.delete(`/brigades/${brigadeId}/catalog/${itemId}`);
  return true;
}

export async function createTicket(brigadeId, ticket) {
  return http.post(`/brigades/${brigadeId}/tickets`, ticket);
}
export async function updateTicket(brigadeId, ticketId, patch) {
  return http.patch(`/brigades/${brigadeId}/tickets/${ticketId}`, patch);
}

/* ================================================================== */
/* LEGO BLOCK — the unit-internal team hierarchy. Real HTTP calls to     */
/* data/routes/teams.js now — same exported function names/signatures   */
/* as before, so no consuming screen needs to change.                   */
/*                                                                      */
/* Two levels of structure, on purpose: a קצין אמל״ח יחידה creates      */
/* TEAMS inside their unit (immediate, no approval). A team lead can     */
/* then propose SUBTEAMS and assign people to them (up to 3 per team) — */
/* but every such org change is a REQUEST the unit officer must         */
/* approve/reject, not an immediate write.                              */
/* ================================================================== */

import { http } from "./http.js";

export const TEAM_REQUEST_KIND = { CREATE_SUBTEAM: "create_subteam", ADD_MEMBER: "add_member" };

export async function fetchBrigadeTeams(brigadeId) {
  return http.get(`/brigades/${brigadeId}/teams`);
}

export async function fetchTeamRequests(brigadeId) {
  return http.get(`/brigades/${brigadeId}/team-requests`);
}

export async function createTeam(brigadeId, data) {
  return http.post(`/brigades/${brigadeId}/teams`, data);
}

export async function updateTeam(brigadeId, teamId, patch) {
  return http.patch(`/brigades/${brigadeId}/teams/${teamId}`, patch);
}

export async function deleteTeam(brigadeId, teamId) {
  await http.delete(`/brigades/${brigadeId}/teams/${teamId}`);
  return true;
}

// שחזור צוות שנמחק — משמש רק על ידי SystemAdmin.jsx (יומן הפעולות), מזריק
// בחזרה את ה-snapshot המלא בדיוק כפי שנשמר ברגע המחיקה.
export async function restoreTeam(brigadeId, team) {
  return http.post(`/brigades/${brigadeId}/teams/restore`, { team });
}

export async function submitTeamRequest(brigadeId, data) {
  return http.post(`/brigades/${brigadeId}/team-requests`, data);
}

export async function decideTeamRequest(brigadeId, requestId, decision, { reason, decidedBy } = {}) {
  return http.patch(`/brigades/${brigadeId}/team-requests/${requestId}`, { decision, reason, decidedBy });
}

/* ==================================================================== */
/* חיפושים נגזרים — מחושבים על גבי רשימת הצוותים שכבר מגיעה מהשרת, בלי    */
/* endpoint ייעודי לכל שאילתה קטנה. מזהה תואם הן מספר אישי (עדיפות        */
/* ראשונה) והן שם מלא (fallback, כי משתמש-קצה מדומה נכנס לרוב עם persona  */
/* אקראית ולא עם מספר אישי אמיתי שנמצא כבר ברשימת חברי תת-צוות).          */
/* ==================================================================== */

export async function getLedTeam(brigadeId, personalNumber) {
  if (!personalNumber) return null;
  const teams = await fetchBrigadeTeams(brigadeId);
  return teams.find((t) => t.leadPersonalNumber === personalNumber) || null;
}

export async function getMemberTeamInfo(brigadeId, { personalNumber, fullName }) {
  const teams = await fetchBrigadeTeams(brigadeId);
  for (const team of teams) {
    for (const sub of team.subteams) {
      const hit = sub.members.find((m) => m.identifier === personalNumber || (fullName && m.identifier === fullName));
      if (hit) return { team, subteam: sub };
    }
  }
  return null;
}

export async function requiresTeamLeadApproval(brigadeId, identity) {
  const info = await getMemberTeamInfo(brigadeId, identity);
  return info && info.team.requireLeadApproval ? info.team : null;
}

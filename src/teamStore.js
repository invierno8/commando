/* ================================================================== */
/* LEGO BLOCK — in-memory store for the unit-internal team hierarchy.   */
/* Shaped exactly like brigadeStore.js/notificationStore.js on purpose  */
/* (async wrappers around a plain in-memory bucket, per brigade).       */
/*                                                                      */
/* Two levels of structure, on purpose (no more — this mirrors what was */
/* actually asked for): a קצין אמל״ח יחידה creates TEAMS inside their   */
/* unit (name, logo, a team lead) — immediate, no approval needed, the  */
/* same authority he already has over his own unit's roster. A team     */
/* lead can then propose SUBTEAMS inside their team and assign people   */
/* to them (up to 3 subteams per team) — but every one of those org     */
/* changes is a REQUEST that the unit officer must approve/reject, not  */
/* an immediate write, because a team lead doesn't own the unit's roster*/
/* the way the unit officer does.                                       */
/* ================================================================== */

const LATENCY_MS = 150;
const MAX_SUBTEAMS_PER_TEAM = 3;

function resolve(value) {
  return new Promise((res) => setTimeout(() => res(value), LATENCY_MS));
}

const buckets = {};
function bucket(brigadeId) {
  if (!buckets[brigadeId]) buckets[brigadeId] = { teams: [], requests: [] };
  return buckets[brigadeId];
}

export const TEAM_REQUEST_KIND = { CREATE_SUBTEAM: "create_subteam", ADD_MEMBER: "add_member" };

export async function fetchBrigadeTeams(brigadeId) {
  return resolve(bucket(brigadeId).teams.map((t) => ({ ...t, subteams: t.subteams.map((s) => ({ ...s, members: [...s.members] })) })));
}

export async function fetchTeamRequests(brigadeId) {
  return resolve([...bucket(brigadeId).requests].sort((a, b) => b.requestedAt - a.requestedAt));
}

export async function createTeam(brigadeId, { unit, name, logo, leadRank, leadName, leadPersonalNumber }) {
  const team = {
    id: "team-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
    unit, name, logo: logo || null, description: "",
    leadRank: leadRank || "", leadName: leadName || "", leadPersonalNumber: leadPersonalNumber || "",
    requireLeadApproval: false,
    subteams: [],
    createdAt: Date.now(),
  };
  bucket(brigadeId).teams = [...bucket(brigadeId).teams, team];
  return resolve(team);
}

export async function updateTeam(brigadeId, teamId, patch) {
  let updated = null;
  bucket(brigadeId).teams = bucket(brigadeId).teams.map((t) => {
    if (t.id !== teamId) return t;
    updated = { ...t, ...patch };
    return updated;
  });
  return resolve(updated);
}

export async function deleteTeam(brigadeId, teamId) {
  bucket(brigadeId).teams = bucket(brigadeId).teams.filter((t) => t.id !== teamId);
  bucket(brigadeId).requests = bucket(brigadeId).requests.filter((r) => r.teamId !== teamId);
  return resolve(true);
}

// שחזור צוות שנמחק — משמש רק על ידי SystemAdmin.jsx (ראו "שחזור" ביומן
// הפעולות), מזריק בחזרה את ה-snapshot המלא (כולל תתי-צוותים וחברים) בדיוק
// כפי שנשמר ברגע המחיקה. בקשות ארגון שהיו תלויות ועומדות באותו רגע לא
// משוחזרות יחד איתו — מגבלה ידועה, לא קריטית להדגמה.
export async function restoreTeam(brigadeId, team) {
  bucket(brigadeId).teams = [...bucket(brigadeId).teams, team];
  return resolve(team);
}

// בקשת שינוי ארגוני שמגישה ראש צוות — לא נכנסת מיד ל-team, רק לתור הבקשות
// שממתין להחלטת קצין אמל״ח היחידה (ראו decideTeamRequest).
export async function submitTeamRequest(brigadeId, { teamId, unit, kind, subteamName, subteamId, personIdentifier, personNote, requestedBy }) {
  const entry = {
    id: "treq-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
    teamId, unit, kind,
    subteamName: subteamName || "", subteamId: subteamId || null,
    personIdentifier: personIdentifier || "", personNote: personNote || "",
    requestedBy, requestedAt: Date.now(),
    status: "pending", decidedBy: null, decidedAt: null, rejectionReason: null,
  };
  bucket(brigadeId).requests = [entry, ...bucket(brigadeId).requests];
  return resolve(entry);
}

export async function decideTeamRequest(brigadeId, requestId, decision, { reason, decidedBy } = {}) {
  const b = bucket(brigadeId);
  const req = b.requests.find((r) => r.id === requestId);
  if (!req) return resolve(null);

  let updatedReq = null;
  b.requests = b.requests.map((r) => {
    if (r.id !== requestId) return r;
    updatedReq = { ...r, status: decision, decidedBy, decidedAt: Date.now(), rejectionReason: decision === "rejected" ? reason : null };
    return updatedReq;
  });

  if (decision === "approved") {
    b.teams = b.teams.map((t) => {
      if (t.id !== req.teamId) return t;
      if (req.kind === TEAM_REQUEST_KIND.CREATE_SUBTEAM) {
        if (t.subteams.length >= MAX_SUBTEAMS_PER_TEAM) return t; // הגבלה — לא אמור לקרות אם ה-UI חוסם מראש
        return { ...t, subteams: [...t.subteams, { id: "sub-" + Date.now() + "-" + Math.random().toString(36).slice(2, 5), name: req.subteamName, members: [] }] };
      }
      if (req.kind === TEAM_REQUEST_KIND.ADD_MEMBER) {
        return {
          ...t,
          subteams: t.subteams.map((s) =>
            s.id === req.subteamId
              ? { ...s, members: [...s.members, { identifier: req.personIdentifier, note: req.personNote }] }
              : s
          ),
        };
      }
      return t;
    });
  }

  return resolve(updatedReq);
}

/* ==================================================================== */
/* Lookups — used both for UI gating (מי רואה מה) ולבדיקת שער האישור של  */
/* ראש צוות בזמן הגשת דרישה/פריט קטלוג (ראו requiresTeamLeadApproval).   */
/* מזהה תואם הן מספר אישי (עדיפות ראשונה) והן שם מלא (fallback, כי       */
/* משתמש-קצה מדומה נכנס לרוב עם persona אקראית ולא עם מספר אישי אמיתי    */
/* שנמצא כבר ברשימת חברי תת-צוות — ראו ה"התחזות לראש צוות" ב-App.jsx).   */
/* ==================================================================== */

export async function getLedTeam(brigadeId, personalNumber) {
  if (!personalNumber) return resolve(null);
  const found = bucket(brigadeId).teams.find((t) => t.leadPersonalNumber === personalNumber);
  return resolve(found || null);
}

export async function getMemberTeamInfo(brigadeId, { personalNumber, fullName }) {
  const teams = bucket(brigadeId).teams;
  for (const team of teams) {
    for (const sub of team.subteams) {
      const hit = sub.members.find((m) => m.identifier === personalNumber || (fullName && m.identifier === fullName));
      if (hit) return resolve({ team, subteam: sub });
    }
  }
  return resolve(null);
}

export async function requiresTeamLeadApproval(brigadeId, identity) {
  const info = await getMemberTeamInfo(brigadeId, identity);
  return info && info.team.requireLeadApproval ? info.team : null;
}

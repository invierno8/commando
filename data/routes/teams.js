/* ================================================================== */
/* Two levels of structure, on purpose: a קצין אמל״ח יחידה creates      */
/* TEAMS inside their unit — immediate, no approval, the same authority */
/* they already have over their own unit's roster. A team lead can then */
/* propose SUBTEAMS and assign people to them (up to 3 per team) — but  */
/* every one of those org changes is a REQUEST the unit officer must    */
/* approve/reject, not an immediate write.                              */
/* ================================================================== */

import { Router } from "express";
import { readCollection, writeCollection } from "../lib/jsonStore.js";
import { asyncRoute } from "../middleware/validate.js";

const router = Router();
const REL_PATH = "teams.json";
const MAX_SUBTEAMS_PER_TEAM = 3;

export const TEAM_REQUEST_KIND = { CREATE_SUBTEAM: "create_subteam", ADD_MEMBER: "add_member" };

function readAll() {
  return readCollection(REL_PATH, {});
}
function bucket(all, brigadeId) {
  return all[brigadeId] || { teams: [], requests: [] };
}

router.get("/brigades/:brigadeId/teams", asyncRoute(async (req, res) => {
  const all = readAll();
  res.json(bucket(all, req.params.brigadeId).teams);
}));

router.get("/brigades/:brigadeId/team-requests", asyncRoute(async (req, res) => {
  const all = readAll();
  res.json([...bucket(all, req.params.brigadeId).requests].sort((a, b) => b.requestedAt - a.requestedAt));
}));

router.post("/brigades/:brigadeId/teams", asyncRoute(async (req, res) => {
  const all = readAll();
  const brigadeId = req.params.brigadeId;
  const b = bucket(all, brigadeId);
  const { unit, name, logo, leadRank, leadName, leadPersonalNumber } = req.body;
  const team = {
    id: "team-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
    unit, name, logo: logo || null, description: "",
    leadRank: leadRank || "", leadName: leadName || "", leadPersonalNumber: leadPersonalNumber || "",
    requireLeadApproval: false, subteams: [], createdAt: Date.now(),
  };
  all[brigadeId] = { ...b, teams: [...b.teams, team] };
  await writeCollection(REL_PATH, all);
  res.status(201).json(team);
}));

router.patch("/brigades/:brigadeId/teams/:teamId", asyncRoute(async (req, res) => {
  const all = readAll();
  const brigadeId = req.params.brigadeId;
  const b = bucket(all, brigadeId);
  let updated = null;
  const teams = b.teams.map((t) => {
    if (t.id !== req.params.teamId) return t;
    updated = { ...t, ...req.body };
    return updated;
  });
  all[brigadeId] = { ...b, teams };
  await writeCollection(REL_PATH, all);
  res.json(updated);
}));

router.delete("/brigades/:brigadeId/teams/:teamId", asyncRoute(async (req, res) => {
  const all = readAll();
  const brigadeId = req.params.brigadeId;
  const b = bucket(all, brigadeId);
  all[brigadeId] = {
    teams: b.teams.filter((t) => t.id !== req.params.teamId),
    requests: b.requests.filter((r) => r.teamId !== req.params.teamId),
  };
  await writeCollection(REL_PATH, all);
  res.json({ ok: true });
}));

// שחזור צוות שנמחק — נקרא ע"י SystemAdmin.jsx (יומן הפעולות), מזריק בחזרה
// את ה-snapshot המלא בדיוק כפי שנשמר ברגע המחיקה.
router.post("/brigades/:brigadeId/teams/restore", asyncRoute(async (req, res) => {
  const all = readAll();
  const brigadeId = req.params.brigadeId;
  const b = bucket(all, brigadeId);
  const team = req.body.team;
  all[brigadeId] = { ...b, teams: [...b.teams, team] };
  await writeCollection(REL_PATH, all);
  res.json(team);
}));

router.post("/brigades/:brigadeId/team-requests", asyncRoute(async (req, res) => {
  const all = readAll();
  const brigadeId = req.params.brigadeId;
  const b = bucket(all, brigadeId);
  const { teamId, unit, kind, subteamName, subteamId, personIdentifier, personNote, requestedBy } = req.body;
  const entry = {
    id: "treq-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
    teamId, unit, kind, subteamName: subteamName || "", subteamId: subteamId || null,
    personIdentifier: personIdentifier || "", personNote: personNote || "",
    requestedBy, requestedAt: Date.now(), status: "pending", decidedBy: null, decidedAt: null, rejectionReason: null,
  };
  all[brigadeId] = { ...b, requests: [entry, ...b.requests] };
  await writeCollection(REL_PATH, all);
  res.status(201).json(entry);
}));

router.patch("/brigades/:brigadeId/team-requests/:requestId", asyncRoute(async (req, res) => {
  const all = readAll();
  const brigadeId = req.params.brigadeId;
  const b = bucket(all, brigadeId);
  const { decision, reason, decidedBy } = req.body;
  const reqEntry = b.requests.find((r) => r.id === req.params.requestId);
  if (!reqEntry) return res.json(null);

  let updatedReq = null;
  const requests = b.requests.map((r) => {
    if (r.id !== req.params.requestId) return r;
    updatedReq = { ...r, status: decision, decidedBy, decidedAt: Date.now(), rejectionReason: decision === "rejected" ? reason : null };
    return updatedReq;
  });

  let teams = b.teams;
  if (decision === "approved") {
    teams = teams.map((t) => {
      if (t.id !== reqEntry.teamId) return t;
      if (reqEntry.kind === TEAM_REQUEST_KIND.CREATE_SUBTEAM) {
        if (t.subteams.length >= MAX_SUBTEAMS_PER_TEAM) return t;
        return { ...t, subteams: [...t.subteams, { id: "sub-" + Date.now() + "-" + Math.random().toString(36).slice(2, 5), name: reqEntry.subteamName, members: [] }] };
      }
      if (reqEntry.kind === TEAM_REQUEST_KIND.ADD_MEMBER) {
        return {
          ...t,
          subteams: t.subteams.map((s) =>
            s.id === reqEntry.subteamId
              ? { ...s, members: [...s.members, { identifier: reqEntry.personIdentifier, note: reqEntry.personNote }] }
              : s
          ),
        };
      }
      return t;
    });
  }

  all[brigadeId] = { teams, requests };
  await writeCollection(REL_PATH, all);
  res.json(updatedReq);
}));

export default router;

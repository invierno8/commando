/* ================================================================== */
/* The per-brigade operational dataset — catalog, tickets, roster,      */
/* dashboard stats — one JSON file per brigade at                       */
/* brigade-data/<brigadeId>.json (mock or db, per the current data      */
/* mode). A brigade with no file yet reads as EMPTY_BRIGADE, which is   */
/* what "the system starts empty" means for a real, not-yet-provisioned */
/* brigade.                                                              */
/*                                                                      */
/* Catalog/ticket writes are deliberately thin here: the client still   */
/* computes every status transition (who can approve, what a rejection  */
/* looks like, team-lead gating, etc.) exactly as it always has — this  */
/* route only persists whatever object the client hands it. Moving that */
/* authorization logic server-side is a separate, larger future change, */
/* not part of this pass (there is no real per-user identity to check   */
/* against yet — see FORCLAUDE.md).                                     */
/* ================================================================== */

import { Router } from "express";
import { readCollection, writeCollection } from "../lib/jsonStore.js";
import { asyncRoute } from "../middleware/validate.js";

const router = Router();

function relPath(brigadeId) {
  return `brigade-data/${brigadeId}.json`;
}

const EMPTY_BRIGADE = {
  units: [], catalog: [], tickets: [],
  roster: { unitOfficers: [], brigadeStaff: [], unitPeople: {} },
  dashboard: { ticketsByUnit: [], priorityByUnit: {}, trendDays: [], trendByUnit: {}, activityLog: [] },
};

function readBrigade(brigadeId) {
  return readCollection(relPath(brigadeId), EMPTY_BRIGADE);
}
function writeBrigade(brigadeId, data) {
  return writeCollection(relPath(brigadeId), data);
}

router.get("/brigades/:id/units", asyncRoute(async (req, res) => {
  res.json(readBrigade(req.params.id).units);
}));
router.get("/brigades/:id/catalog", asyncRoute(async (req, res) => {
  res.json(readBrigade(req.params.id).catalog);
}));
router.get("/brigades/:id/tickets", asyncRoute(async (req, res) => {
  res.json(readBrigade(req.params.id).tickets);
}));
router.get("/brigades/:id/roster", asyncRoute(async (req, res) => {
  res.json(readBrigade(req.params.id).roster);
}));
router.get("/brigades/:id/dashboard", asyncRoute(async (req, res) => {
  res.json(readBrigade(req.params.id).dashboard);
}));

// כתיבה-חוזרת מאשף ההתקנה — יחידות/מרשם בלבד, קטלוג/דרישות/דשבורד נשארים
// כפי שהיו. originalName (שהאשף מזריק לכל יחידה קיימת שהוא טוען) מזהה
// מאיזו יחידה קודמת שורת האשף הזו הגיעה, כדי ששינוי שם יחידה (rename) יעביר
// את המרשם/הקצין הקיימים שלה יחד איתה, במקום לאבד אותם בשקט. שדה officerName
// ריק לא מוחק קצין קיים (אין כפתור "הסרת קצין" נפרד באשף).
router.post("/brigades/:id/setup", asyncRoute(async (req, res) => {
  const brigadeId = req.params.id;
  const units = req.body.units || [];
  const base = readBrigade(brigadeId);

  const unitNames = units.map((u) => u.name);
  const prevOfficers = base.roster.unitOfficers;
  const unitOfficers = units
    .map((u) => {
      const sourceKey = u.originalName || u.name;
      const prev = prevOfficers.find((o) => o.unit === sourceKey);
      const officerName = (u.officerName || "").trim();
      if (!officerName && !prev) return null;
      return {
        id: prev?.id || "uo-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        unit: u.name, rank: prev?.rank || "", name: officerName || prev.name,
        personalNumber: u.officerEmail || prev?.personalNumber || "", email: prev?.email || "",
      };
    })
    .filter(Boolean);
  const unitPeople = {};
  units.forEach((u) => { unitPeople[u.name] = base.roster.unitPeople[u.originalName || u.name] || []; });

  await writeBrigade(brigadeId, { ...base, units: unitNames, roster: { ...base.roster, unitOfficers, unitPeople } });
  res.json({ ok: true });
}));

router.post("/brigades/:id/catalog", asyncRoute(async (req, res) => {
  const brigadeId = req.params.id;
  const base = readBrigade(brigadeId);
  const item = req.body;
  await writeBrigade(brigadeId, { ...base, catalog: [item, ...base.catalog] });
  res.status(201).json(item);
}));

router.patch("/brigades/:id/catalog/:itemId", asyncRoute(async (req, res) => {
  const brigadeId = req.params.id;
  const base = readBrigade(brigadeId);
  let updated = null;
  const catalog = base.catalog.map((it) => {
    if (it.id !== req.params.itemId) return it;
    updated = { ...it, ...req.body };
    return updated;
  });
  await writeBrigade(brigadeId, { ...base, catalog });
  res.json(updated);
}));

router.delete("/brigades/:id/catalog/:itemId", asyncRoute(async (req, res) => {
  const brigadeId = req.params.id;
  const base = readBrigade(brigadeId);
  const catalog = base.catalog.filter((it) => it.id !== req.params.itemId);
  await writeBrigade(brigadeId, { ...base, catalog });
  res.json({ ok: true });
}));

router.post("/brigades/:id/tickets", asyncRoute(async (req, res) => {
  const brigadeId = req.params.id;
  const base = readBrigade(brigadeId);
  const ticket = req.body;
  await writeBrigade(brigadeId, { ...base, tickets: [ticket, ...base.tickets] });
  res.status(201).json(ticket);
}));

router.patch("/brigades/:id/tickets/:ticketId", asyncRoute(async (req, res) => {
  const brigadeId = req.params.id;
  const base = readBrigade(brigadeId);
  let updated = null;
  const tickets = base.tickets.map((t) => {
    if (t.id !== req.params.ticketId) return t;
    updated = { ...t, ...req.body };
    return updated;
  });
  await writeBrigade(brigadeId, { ...base, tickets });
  res.json(updated);
}));

export default router;

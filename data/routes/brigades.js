/* ================================================================== */
/* Brigades known to the system, at the system-admin level. HANGAR is   */
/* built to serve the whole military (כלל-זרועי), not a single brigade  */
/* — this is the tenant registry: every brigade using the system,       */
/* independent of any one brigade's own units/people/catalog (that      */
/* operational data lives in brigade-data.js instead).                  */
/* ================================================================== */

import { Router } from "express";
import { readCollection, writeCollection } from "../lib/jsonStore.js";
import { asyncRoute, requireFields } from "../middleware/validate.js";

const router = Router();
const REL_PATH = "brigades.json";

export const BRIGADE_STATUS = { PENDING: "pending", ACTIVE: "active" };

function readAll() {
  return readCollection(REL_PATH, { brigades: [], systemAdmins: [] });
}

router.get("/brigades", asyncRoute(async (_req, res) => {
  res.json(readAll().brigades);
}));

router.post("/brigades", asyncRoute(async (req, res) => {
  requireFields(req.body, ["name"]);
  const all = readAll();
  const brigade = {
    id: req.body.id || "brg-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: req.body.name, logo: req.body.logo || null,
    unitLogos: req.body.unitLogos || {}, unitMissions: req.body.unitMissions || {}, mission: req.body.mission || "",
    status: req.body.status || BRIGADE_STATUS.PENDING, units: req.body.units || 0, members: req.body.members || 0,
    contactRank: req.body.contactRank || "", contactName: req.body.contactName || "",
    contactPersonalNumber: req.body.contactPersonalNumber || "",
    createdAt: req.body.createdAt || new Date().toLocaleDateString("he-IL"),
  };
  all.brigades = [...all.brigades, brigade];
  await writeCollection(REL_PATH, all);
  res.status(201).json(brigade);
}));

router.patch("/brigades/:id", asyncRoute(async (req, res) => {
  const all = readAll();
  let updated = null;
  all.brigades = all.brigades.map((b) => {
    if (b.id !== req.params.id) return b;
    updated = { ...b, ...req.body };
    return updated;
  });
  await writeCollection(REL_PATH, all);
  res.json(updated);
}));

router.delete("/brigades/:id", asyncRoute(async (req, res) => {
  const all = readAll();
  all.brigades = all.brigades.filter((b) => b.id !== req.params.id);
  await writeCollection(REL_PATH, all);
  res.json({ ok: true });
}));

// isSuperAdmin — היררכיה בתוך מנהלי המערכת עצמם: מנהל עליון אחד (או יותר)
// שהוא היחיד שיכול לאשר סופית פעולה הרסנית שמנהל מערכת רגיל התחיל.
router.get("/system-admins", asyncRoute(async (_req, res) => {
  res.json(readAll().systemAdmins);
}));

router.post("/system-admins", asyncRoute(async (req, res) => {
  requireFields(req.body, ["name", "personalNumber"]);
  const all = readAll();
  const admin = {
    id: req.body.id || "sa-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    rank: req.body.rank || "", name: req.body.name, personalNumber: req.body.personalNumber,
    email: req.body.email || "", isSuperAdmin: !!req.body.isSuperAdmin,
  };
  all.systemAdmins = [...all.systemAdmins, admin];
  await writeCollection(REL_PATH, all);
  res.status(201).json(admin);
}));

router.delete("/system-admins/:id", asyncRoute(async (req, res) => {
  const all = readAll();
  all.systemAdmins = all.systemAdmins.filter((a) => a.id !== req.params.id);
  await writeCollection(REL_PATH, all);
  res.json({ ok: true });
}));

export default router;

import { Router } from "express";
import { readCollection, writeCollection } from "../lib/jsonStore.js";
import { asyncRoute } from "../middleware/validate.js";

const router = Router();
const REL_PATH = "notifications.json";

function readAll() {
  return readCollection(REL_PATH, {});
}
function bucket(all, brigadeId) {
  return all[brigadeId] || [];
}

router.get("/brigades/:brigadeId/notifications", asyncRoute(async (req, res) => {
  const all = readAll();
  res.json([...bucket(all, req.params.brigadeId)].sort((a, b) => b.ts - a.ts));
}));

router.post("/brigades/:brigadeId/notifications", asyncRoute(async (req, res) => {
  const all = readAll();
  const brigadeId = req.params.brigadeId;
  const entry = {
    id: "ntf-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
    read: false, ts: Date.now(), ...req.body,
  };
  all[brigadeId] = [entry, ...bucket(all, brigadeId)];
  await writeCollection(REL_PATH, all);
  res.status(201).json(entry);
}));

router.patch("/brigades/:brigadeId/notifications/read", asyncRoute(async (req, res) => {
  const ids = req.body?.ids || [];
  const all = readAll();
  const brigadeId = req.params.brigadeId;
  all[brigadeId] = bucket(all, brigadeId).map((n) => (ids.includes(n.id) ? { ...n, read: true } : n));
  await writeCollection(REL_PATH, all);
  res.json({ ok: true });
}));

router.patch("/brigades/:brigadeId/notifications/read-all", asyncRoute(async (req, res) => {
  const all = readAll();
  const brigadeId = req.params.brigadeId;
  all[brigadeId] = bucket(all, brigadeId).map((n) => ({ ...n, read: true }));
  await writeCollection(REL_PATH, all);
  res.json({ ok: true });
}));

export default router;

import { Router } from "express";
import { readCollection, writeCollection } from "../lib/jsonStore.js";
import { asyncRoute } from "../middleware/validate.js";

const router = Router();
const REL_PATH = "admin.json";

function readAll() {
  return readCollection(REL_PATH, { pendingDeletions: [], auditLog: [] });
}

router.get("/admin/deletions", asyncRoute(async (_req, res) => {
  const all = readAll();
  res.json([...all.pendingDeletions].sort((a, b) => b.requestedAt - a.requestedAt));
}));

router.post("/admin/deletions", asyncRoute(async (req, res) => {
  const all = readAll();
  const { targetType, targetId, targetLabel, requestedBy, snapshot } = req.body;
  const entry = {
    id: "del-" + Date.now(), targetType, targetId, targetLabel, requestedBy,
    requestedAt: Date.now(), status: "pending", snapshot: snapshot || null,
  };
  all.pendingDeletions = [entry, ...all.pendingDeletions];
  await writeCollection(REL_PATH, all);
  res.status(201).json(entry);
}));

router.patch("/admin/deletions/:id", asyncRoute(async (req, res) => {
  const all = readAll();
  const { decision, decidedBy } = req.body;
  let updated = null;
  all.pendingDeletions = all.pendingDeletions.map((d) => {
    if (d.id !== req.params.id) return d;
    updated = { ...d, status: decision, decidedBy, decidedAt: Date.now() };
    return updated;
  });
  await writeCollection(REL_PATH, all);
  res.json(updated);
}));

router.get("/admin/audit-log", asyncRoute(async (_req, res) => {
  const all = readAll();
  res.json([...all.auditLog].sort((a, b) => b.ts - a.ts));
}));

// targetType/snapshot אופציונליים — רשומה שכן נושאת snapshot הופכת ל"גיבוי"
// בפועל (ראו markLogRestored/annotations על אותו רעיון). לא ולידציה מחמירה
// כי הרשומות מגיעות משלל פעולות שונות עם צורה מעט שונה כל פעם.
router.post("/admin/audit-log", asyncRoute(async (req, res) => {
  const all = readAll();
  const { actor, action, target, targetType, snapshot } = req.body;
  const entry = {
    id: "log-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
    actor, action, target, targetType: targetType || null, snapshot: snapshot || null,
    restored: false, ts: Date.now(),
  };
  all.auditLog = [entry, ...all.auditLog];
  await writeCollection(REL_PATH, all);
  res.status(201).json(entry);
}));

router.patch("/admin/audit-log/:id/restore", asyncRoute(async (req, res) => {
  const all = readAll();
  all.auditLog = all.auditLog.map((l) => (l.id === req.params.id ? { ...l, restored: true } : l));
  await writeCollection(REL_PATH, all);
  res.json({ ok: true });
}));

export default router;

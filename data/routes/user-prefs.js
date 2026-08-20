import { Router } from "express";
import { readCollection, writeCollection } from "../lib/jsonStore.js";
import { asyncRoute } from "../middleware/validate.js";

const router = Router();
const REL_PATH = "user-prefs.json";

function key(userId, namespace) {
  return `${userId}:${namespace}`;
}
function readAll() {
  return readCollection(REL_PATH, {});
}

router.get("/users/:userId/prefs/:namespace", asyncRoute(async (req, res) => {
  const all = readAll();
  res.json(all[key(req.params.userId, req.params.namespace)] ?? null);
}));

router.put("/users/:userId/prefs/:namespace", asyncRoute(async (req, res) => {
  const all = readAll();
  all[key(req.params.userId, req.params.namespace)] = req.body?.value ?? null;
  await writeCollection(REL_PATH, all);
  res.json({ ok: true });
}));

router.delete("/users/:userId/prefs/:namespace", asyncRoute(async (req, res) => {
  const all = readAll();
  delete all[key(req.params.userId, req.params.namespace)];
  await writeCollection(REL_PATH, all);
  res.json({ ok: true });
}));

export default router;

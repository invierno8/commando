import { Router } from "express";
import { readCollection, writeCollection } from "../lib/jsonStore.js";
import { asyncRoute } from "../middleware/validate.js";

const router = Router();
const REL_PATH = "drafts.json";

function key(userId, kind) {
  return `${userId}:${kind}`;
}
function readAll() {
  return readCollection(REL_PATH, {});
}

router.get("/users/:userId/drafts/:kind", asyncRoute(async (req, res) => {
  const all = readAll();
  res.json(all[key(req.params.userId, req.params.kind)] ?? null);
}));

router.put("/users/:userId/drafts/:kind", asyncRoute(async (req, res) => {
  const all = readAll();
  const entry = { data: req.body?.data, savedAt: Date.now() };
  all[key(req.params.userId, req.params.kind)] = entry;
  await writeCollection(REL_PATH, all);
  res.json(entry);
}));

router.delete("/users/:userId/drafts/:kind", asyncRoute(async (req, res) => {
  const all = readAll();
  delete all[key(req.params.userId, req.params.kind)];
  await writeCollection(REL_PATH, all);
  res.json({ ok: true });
}));

export default router;

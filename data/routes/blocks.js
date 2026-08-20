import { Router } from "express";
import { readCollection, writeCollection } from "../lib/jsonStore.js";
import { asyncRoute, requireFields } from "../middleware/validate.js";

const router = Router();
const REL_PATH = "blocks.json";

export const BLOCK_SCOPE = { UNIT: "unit", BRIGADE: "brigade" };

function readAll() {
  return readCollection(REL_PATH, {});
}
function bucket(all, brigadeId) {
  return all[brigadeId] || [];
}

router.get("/brigades/:brigadeId/blocks", asyncRoute(async (req, res) => {
  const all = readAll();
  res.json([...bucket(all, req.params.brigadeId)].sort((a, b) => b.blockedAt - a.blockedAt));
}));

// חסימת יחידה חלה רק בתוך אותה יחידה; חסימת חטיבה חוסמת בכל מקום בחטיבה.
router.get("/brigades/:brigadeId/blocks/check", asyncRoute(async (req, res) => {
  const { personalNumber, unit } = req.query;
  if (!personalNumber) return res.json(null);
  const all = readAll();
  const hit = bucket(all, req.params.brigadeId).find(
    (b) => b.personalNumber === personalNumber && (b.scope === BLOCK_SCOPE.BRIGADE || (b.scope === BLOCK_SCOPE.UNIT && b.unit === unit))
  );
  res.json(hit || null);
}));

router.post("/brigades/:brigadeId/blocks", asyncRoute(async (req, res) => {
  requireFields(req.body, ["scope", "personalNumber", "rank", "name", "reason", "blockedBy"]);
  const { scope, unit, personalNumber, rank, name, reason, blockedBy } = req.body;
  const all = readAll();
  const brigadeId = req.params.brigadeId;
  const entry = {
    id: "blk-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
    scope, unit: unit || null, personalNumber, rank, name, reason, blockedBy, blockedAt: Date.now(),
  };
  all[brigadeId] = [entry, ...bucket(all, brigadeId)];
  await writeCollection(REL_PATH, all);
  res.status(201).json(entry);
}));

router.delete("/brigades/:brigadeId/blocks/:blockId", asyncRoute(async (req, res) => {
  const all = readAll();
  const brigadeId = req.params.brigadeId;
  all[brigadeId] = bucket(all, brigadeId).filter((b) => b.id !== req.params.blockId);
  await writeCollection(REL_PATH, all);
  res.json({ ok: true });
}));

export default router;

/* ================================================================== */
/* "You were @mentioned" notifications — shared across both comment      */
/* kinds (regular QA annotations and Jynx-meta feedback), which is why   */
/* this is its own small route file rather than living inside            */
/* annotations.js or jynx-feedback.js. Reading/writing the actual        */
/* mention records lives in lib/mentions.js; this file is just the       */
/* auth-gated HTTP surface a dev user reads their own notifications      */
/* through.                                                              */
/* ================================================================== */

import { Router } from "express";
import { requireDevUser } from "../middleware/auth.js";
import { asyncRoute } from "../middleware/validate.js";
import { readMentions, markMentionRead } from "../lib/mentions.js";

const router = Router();

router.get("/dev/mentions", requireDevUser, (req, res) => {
  res.json(readMentions(req.devUser.id));
});

router.post("/dev/mentions/:id/read", requireDevUser, asyncRoute(async (req, res) => {
  const ok = await markMentionRead(req.devUser.id, req.params.id);
  if (!ok) return res.status(404).json({ error: "לא נמצא" });
  res.json({ ok: true });
}));

export default router;

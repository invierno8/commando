/* ================================================================== */
/* Admin-only read/write for the auto-resolve-on-PR-opened toggle — see  */
/* lib/annotationSettings.js for the full explanation of what this        */
/* controls and why it can't just be enforced from a route handler here.  */
/* Shared by both DevAnnotationsScreen.jsx and JynxFeedbackScreen.jsx     */
/* (one setting for both comment kinds), hence its own small route file   */
/* rather than living inside annotations.js or jynx-feedback.js.          */
/* ================================================================== */

import { Router } from "express";
import { requireAdmin } from "../middleware/adminAuth.js";
import { asyncRoute } from "../middleware/validate.js";
import { readAnnotationSettings, writeAnnotationSettings } from "../lib/annotationSettings.js";

const router = Router();

router.get("/admin/annotation-settings", requireAdmin, (_req, res) => {
  res.json(readAnnotationSettings());
});

router.patch("/admin/annotation-settings", requireAdmin, asyncRoute(async (req, res) => {
  const settings = await writeAnnotationSettings({ autoResolveOnPrOpened: !!req.body.autoResolveOnPrOpened });
  res.json(settings);
}));

export default router;

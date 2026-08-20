import { Router } from "express";
import { getMode, setMode } from "../lib/dataMode.js";
import { resetMockCache } from "../lib/jsonStore.js";
import { requireDevUser } from "../middleware/auth.js";

const router = Router();

router.get("/dev/data-mode", (_req, res) => {
  res.json({ mode: getMode() });
});

// כל משתמש-פיתוח מחובר רשאי להחליף — נוחות הדגמה, לא גבול אבטחה.
// מעבר ל-mock מאפס את מטמון ה-mock, כדי שכל מעבר יתחיל מהזרע המקורי
// מחדש, לא ימשיך ממצב session קודם.
router.post("/dev/data-mode", requireDevUser, (req, res) => {
  const mode = setMode(req.body?.mode);
  if (mode === "mock") resetMockCache();
  res.json({ mode });
});

export default router;

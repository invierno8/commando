import { Router } from "express";
import { getMode } from "../lib/dataMode.js";

const router = Router();

// נקודת בדיקה ציבורית (ללא אימות) — גם לבדיקת "השרת חי" ידנית וגם כדי
// שספק אחסון (Render/Fly וכו׳) יוכל לבצע health check אוטומטי.
router.get("/health", (_req, res) => {
  res.json({ ok: true, mode: getMode(), time: new Date().toISOString() });
});

export default router;

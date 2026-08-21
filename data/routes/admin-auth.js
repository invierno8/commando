import { Router } from "express";
import { createSession, resolveSession, destroySession } from "../lib/sessions.js";
import { loginLimiter } from "../middleware/rateLimit.js";
import { asyncRoute, requireFields } from "../middleware/validate.js";

const router = Router();
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // שבוע — ראו dev-auth.js

// שער נפרד וגבוה יותר מסשן דב-יוזר רגיל — סוד יחיד (ADMIN_SECRET ב-.env),
// לא חשבון-פר-אדם, בכוונה: "לא מסובך מדי" ולא בונה מערכת חשבונות מלאה
// לפני שיש SSO אמיתי (ראו התוכנית).
router.post("/admin/verify", loginLimiter, asyncRoute(async (req, res) => {
  requireFields(req.body, ["secret"]);
  if (!process.env.ADMIN_SECRET || req.body.secret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: "סוד שגוי" });
  }
  const token = createSession({ admin: true }, SESSION_TTL_MS);
  res.json({ ok: true, token });
}));

router.get("/admin/me", (req, res) => {
  const token = req.headers["x-admin-session"] || req.cookies?.hangar_admin_session;
  res.json({ authenticated: !!resolveSession(token) });
});

router.post("/admin/logout", (req, res) => {
  const token = req.headers["x-admin-session"] || req.cookies?.hangar_admin_session;
  destroySession(token);
  res.json({ ok: true });
});

export default router;

import { Router } from "express";
import { createSession, resolveSession } from "../lib/sessions.js";
import { sessionCookieOptions } from "../lib/cookies.js";
import { loginLimiter } from "../middleware/rateLimit.js";
import { asyncRoute, requireFields } from "../middleware/validate.js";

const router = Router();

// שער נפרד וגבוה יותר מסשן דב-יוזר רגיל — סוד יחיד (ADMIN_SECRET ב-.env),
// לא חשבון-פר-אדם, בכוונה: "לא מסובך מדי" ולא בונה מערכת חשבונות מלאה
// לפני שיש SSO אמיתי (ראו התוכנית).
router.post("/admin/verify", loginLimiter, asyncRoute(async (req, res) => {
  requireFields(req.body, ["secret"]);
  if (!process.env.ADMIN_SECRET || req.body.secret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: "סוד שגוי" });
  }
  const token = createSession({ admin: true });
  res.cookie("hangar_admin_session", token, sessionCookieOptions(12 * 60 * 60 * 1000));
  res.json({ ok: true });
}));

router.get("/admin/me", (req, res) => {
  const token = req.cookies?.hangar_admin_session;
  res.json({ authenticated: !!resolveSession(token) });
});

router.post("/admin/logout", (req, res) => {
  res.clearCookie("hangar_admin_session");
  res.json({ ok: true });
});

export default router;

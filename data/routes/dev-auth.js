import { Router } from "express";
import { readDevUsers } from "../lib/devUsers.js";
import { verifyPassword } from "../lib/passwords.js";
import { createSession, destroySession } from "../lib/sessions.js";
import { sessionCookieOptions } from "../lib/cookies.js";
import { loginLimiter } from "../middleware/rateLimit.js";
import { asyncRoute, requireFields } from "../middleware/validate.js";

const router = Router();

router.post("/dev/login", loginLimiter, asyncRoute(async (req, res) => {
  requireFields(req.body, ["password"]);
  const { password } = req.body;
  const users = readDevUsers().filter((u) => u.active !== false);

  // אין שם משתמש בכניסה — כל אחד מקבל רק סיסמה, והזהות נגזרת מאיזה hash תואם.
  // חייבים לנסות מול כולם (לא לעצור בהתאמה ראשונה) כדי לא לדלוף מידע מתזמון.
  let matched = null;
  for (const u of users) {
    const ok = await verifyPassword(password, u.passwordHash);
    if (ok) matched = u;
  }

  if (matched) {
    const token = createSession({ id: matched.id, name: matched.name });
    res.cookie("hangar_dev_session", token, sessionCookieOptions(12 * 60 * 60 * 1000));
    return res.json({ name: matched.name });
  }

  // אותה תיבת התחברות מקבלת גם את ה-ADMIN_SECRET ישירות — נותנת בבת אחת גם
  // סשן dev וגם סשן admin, כדי שלא תצטרך קודם משתמש-פיתוח נפרד ורק אז לפתוח
  // את פאנל הניהול; זה אתה, לא QA, אז אין טעם בשני שלבים.
  if (process.env.ADMIN_SECRET && password === process.env.ADMIN_SECRET) {
    const devToken = createSession({ id: "admin", name: "מנהל" });
    res.cookie("hangar_dev_session", devToken, sessionCookieOptions(12 * 60 * 60 * 1000));
    const adminToken = createSession({ admin: true });
    res.cookie("hangar_admin_session", adminToken, sessionCookieOptions(12 * 60 * 60 * 1000));
    return res.json({ name: "מנהל", isAdmin: true });
  }

  return res.status(401).json({ error: "סיסמה שגויה" });
}));

router.get("/dev/me", (req, res) => {
  res.json(req.devUser ? { name: req.devUser.name } : null);
});

router.post("/dev/logout", (req, res) => {
  destroySession(req.cookies?.hangar_dev_session);
  res.clearCookie("hangar_dev_session");
  res.json({ ok: true });
});

export default router;

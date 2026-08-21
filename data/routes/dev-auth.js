import { Router } from "express";
import { readDevUsers } from "../lib/devUsers.js";
import { verifyPassword } from "../lib/passwords.js";
import { createSession, destroySession } from "../lib/sessions.js";
import { loginLimiter } from "../middleware/rateLimit.js";
import { asyncRoute, requireFields } from "../middleware/validate.js";

const router = Router();
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // שבוע — "לא להתנתק באמצע כתיבת הערה"

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
    const token = createSession({ id: matched.id, name: matched.name }, SESSION_TTL_MS);
    return res.json({ name: matched.name, token });
  }

  // אותה תיבת התחברות מקבלת גם את ה-ADMIN_SECRET ישירות — נותנת בבת אחת גם
  // סשן dev וגם סשן admin, כדי שלא תצטרך קודם משתמש-פיתוח נפרד ורק אז לפתוח
  // את פאנל הניהול; זה אתה, לא QA, אז אין טעם בשני שלבים.
  if (process.env.ADMIN_SECRET && password === process.env.ADMIN_SECRET) {
    const devToken = createSession({ id: "admin", name: "מנהל" }, SESSION_TTL_MS);
    const adminToken = createSession({ admin: true }, SESSION_TTL_MS);
    return res.json({ name: "מנהל", isAdmin: true, token: devToken, adminToken });
  }

  return res.status(401).json({ error: "סיסמה שגויה" });
}));

router.get("/dev/me", (req, res) => {
  res.json(req.devUser ? { id: req.devUser.id, name: req.devUser.name } : null);
});

router.post("/dev/logout", (req, res) => {
  const auth = req.headers.authorization;
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  destroySession(bearer || req.cookies?.hangar_dev_session);
  res.json({ ok: true });
});

export default router;

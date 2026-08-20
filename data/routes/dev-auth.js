import { Router } from "express";
import { readDevUsers } from "../lib/devUsers.js";
import { verifyPassword } from "../lib/passwords.js";
import { createSession, destroySession } from "../lib/sessions.js";
import { sessionCookieOptions } from "../lib/cookies.js";
import { loginLimiter } from "../middleware/rateLimit.js";
import { asyncRoute, requireFields } from "../middleware/validate.js";

const router = Router();

router.post("/dev/login", loginLimiter, asyncRoute(async (req, res) => {
  requireFields(req.body, ["name", "password"]);
  const { name, password } = req.body;
  const users = readDevUsers();
  const user = users.find((u) => u.name === name && u.active !== false);
  const ok = user && (await verifyPassword(password, user.passwordHash));
  if (!ok) return res.status(401).json({ error: "שם או סיסמה שגויים" });

  const token = createSession({ id: user.id, name: user.name });
  res.cookie("hangar_dev_session", token, sessionCookieOptions(12 * 60 * 60 * 1000));
  res.json({ name: user.name });
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

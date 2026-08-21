/* ================================================================== */
/* Admin-gated CRUD on the dev-user roster (data/config/dev-users.json).*/
/* The file is the real source of truth (git-tracked); this is a        */
/* convenience layer on top of it, per the plan's "Both" decision.      */
/* Passwords are hashed here, never returned by any GET.                */
/* ================================================================== */

import { Router } from "express";
import { readDevUsers, writeDevUsers } from "../lib/devUsers.js";
import { hashPassword } from "../lib/passwords.js";
import { requireAdmin } from "../middleware/adminAuth.js";
import { asyncRoute, requireFields } from "../middleware/validate.js";
import { listActiveDevUserIds } from "../lib/sessions.js";

const router = Router();

// passwordHash אף פעם לא חוזר — bcrypt הוא חד-כיווני מיסודו, אין דרך
// "להציג את הסיסמה הקיימת" (ראו admin/dev-users/:id PATCH — אפשר רק לאפס
// לסיסמה חדשה). online נגזר בזמן אמת ממפת הסשנים, לא נשמר בשום מקום.
function publicView(u, onlineIds) {
  return {
    id: u.id, name: u.name, role: u.role, active: u.active, createdAt: u.createdAt,
    online: onlineIds.has(u.id),
    // הרשאה נפרדת מהרשאת ה-admin — יכולה לתת משוב על Jynx עצמו (ראו
    // data/routes/jynx-feedback.js / requireAdminOrJynxCommenter). ברירת
    // מחדל false לכל משתמש קיים/חדש שלא הוגדר לו במפורש.
    canJynxComment: !!u.canJynxComment,
  };
}

router.get("/admin/dev-users", requireAdmin, (_req, res) => {
  const onlineIds = listActiveDevUserIds();
  res.json(readDevUsers().map((u) => publicView(u, onlineIds)));
});

router.post("/admin/dev-users", requireAdmin, asyncRoute(async (req, res) => {
  requireFields(req.body, ["name", "password"]);
  const users = readDevUsers();
  if (users.some((u) => u.name === req.body.name)) {
    const err = new Error("כבר קיים משתמש-פיתוח בשם הזה");
    err.status = 409;
    throw err;
  }
  const user = {
    id: "dev-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: req.body.name,
    role: req.body.role || "",
    passwordHash: await hashPassword(req.body.password),
    active: true,
    canJynxComment: false,
    createdAt: new Date().toISOString(),
  };
  await writeDevUsers([...users, user]);
  res.status(201).json(publicView(user, listActiveDevUserIds()));
}));

router.patch("/admin/dev-users/:id", requireAdmin, asyncRoute(async (req, res) => {
  const users = readDevUsers();
  let updated = null;
  const next = [];
  for (const u of users) {
    if (u.id !== req.params.id) { next.push(u); continue; }
    const patch = { ...req.body };
    if (patch.password) {
      patch.passwordHash = await hashPassword(patch.password);
      delete patch.password;
    }
    if ("canJynxComment" in patch) patch.canJynxComment = !!patch.canJynxComment;
    updated = { ...u, ...patch };
    next.push(updated);
  }
  await writeDevUsers(next);
  res.json(updated ? publicView(updated, listActiveDevUserIds()) : null);
}));

router.delete("/admin/dev-users/:id", requireAdmin, asyncRoute(async (req, res) => {
  await writeDevUsers(readDevUsers().filter((u) => u.id !== req.params.id));
  res.json({ ok: true });
}));

export default router;

/* ================================================================== */
/* Two routes backing Jynx's "user system" (2026-08-23): a click-through */
/* profile card for any dev user, reachable from @mentions and author    */
/* names all over the dev-tool chrome.                                  */
/*                                                                      */
/* GET /dev/users — deliberately NOT the same as GET /admin/dev-users    */
/* (dev-users.js, admin-only, returns role/active/canJynxComment/        */
/* online too). This one is open to any authenticated dev user and       */
/* returns only {id, name} for active users — just enough to (1) widen   */
/* @mention autocomplete beyond "names already seen in on-screen         */
/* comments" (the limitation flagged in CommentsPanel.jsx before this),  */
/* and (2) let the client resolve a typed "@Name" back to an id so       */
/* clicking it can open that id's profile card.                          */
/* ================================================================== */

import { Router } from "express";
import { requireDevUser } from "../middleware/auth.js";
import { readDevUsers } from "../lib/devUsers.js";
import { listActiveDevUserIds } from "../lib/sessions.js";
import { buildUserActivity } from "../lib/userActivity.js";

const router = Router();

router.get("/dev/users", requireDevUser, (_req, res) => {
  res.json(readDevUsers().filter((u) => u.active !== false).map((u) => ({ id: u.id, name: u.name })));
});

router.get("/dev/users/:id/profile", requireDevUser, (req, res) => {
  const user = readDevUsers().find((u) => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: "לא נמצא" });
  const activity = buildUserActivity(user.id);
  const stats = activity.reduce((acc, a) => {
    acc[a.type] = (acc[a.type] || 0) + 1;
    return acc;
  }, { comment: 0, reply: 0, reaction: 0 });
  res.json({
    id: user.id, name: user.name, role: user.role || "", active: user.active !== false,
    canJynxComment: !!user.canJynxComment, createdAt: user.createdAt,
    online: listActiveDevUserIds().has(user.id),
    stats, activity,
  });
});

export default router;

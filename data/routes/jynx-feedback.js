/* ================================================================== */
/* Jynx's OWN feedback queue — completely separate from                */
/* data/annotations/{notes,actions}/, which is QA feedback about the    */
/* underlying HANGAR app. This one is meta: comments about the Jynx     */
/* dev-tool overlay itself (the FAB, the toolbar, the admin panel...),  */
/* meant to evolve Jynx into its own standalone product later. Writable */
/* by the admin, and also by any dev user granted the "Jynx commenter"  */
/* permission (canJynxComment:true in data/config/dev-users.json — see  */
/* requireAdminOrJynxCommenter in middleware/adminAuth.js, and          */
/* DevAdminUsersScreen.jsx for how the admin grants it). Every entry is */
/* auto-queued as an action — same "everything written here becomes an  */
/* action" rule already used for admin QA notes — and now carries       */
/* authorId/authorName so it's attributable to whoever actually wrote   */
/* it. Resolving/replying/exporting stay admin-only.                    */
/* ================================================================== */

import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { requireAdmin, requireAdminOrJynxCommenter } from "../middleware/adminAuth.js";
import { asyncRoute, requireFields } from "../middleware/validate.js";
import { commitFileToGithub, githubPersistEnabled, listDirFromGithub, readFileFromGithub } from "../lib/githubPersist.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NOTES_DIR = path.join(__dirname, "..", "annotations", "jynx-notes");
const ACTIONS_DIR = path.join(__dirname, "..", "annotations", "jynx-actions");
const GITHUB_NOTES_DIR = "data/annotations/jynx-notes";
const GITHUB_ACTIONS_DIR = "data/annotations/jynx-actions";

function readAll() {
  try {
    return fs.readdirSync(NOTES_DIR)
      .filter((f) => f.endsWith(".json"))
      .map((f) => JSON.parse(fs.readFileSync(path.join(NOTES_DIR, f), "utf8")))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } catch {
    return [];
  }
}

function writeLocalNote(id, note) {
  fs.mkdirSync(NOTES_DIR, { recursive: true });
  fs.writeFileSync(path.join(NOTES_DIR, `${id}.json`), JSON.stringify(note, null, 2) + "\n");
}

async function persistNote(note, message) {
  writeLocalNote(note.id, note);
  if (githubPersistEnabled()) {
    await commitFileToGithub(`${GITHUB_NOTES_DIR}/${note.id}.json`, JSON.stringify(note, null, 2) + "\n", message);
  }
}

async function queueAction(note) {
  const workItem = {
    id: note.id, route: note.route, targetLabel: note.targetLabel, secondaryTargets: note.secondaryTargets || [],
    comment: note.comment, requestedAt: new Date().toISOString(),
  };
  fs.mkdirSync(ACTIONS_DIR, { recursive: true });
  fs.writeFileSync(path.join(ACTIONS_DIR, `${note.id}.json`), JSON.stringify(workItem, null, 2) + "\n");
  if (githubPersistEnabled()) {
    await commitFileToGithub(`${GITHUB_ACTIONS_DIR}/${note.id}.json`, JSON.stringify(workItem, null, 2) + "\n", `jynx action queued — ${note.id}`);
  }
}

const router = Router();

// דלת פתוחה גם למנהל וגם למשתמש-פיתוח עם canJynxComment:true (ראו
// requireAdminOrJynxCommenter ב-middleware/adminAuth.js) — "כל מה שנכתב
// הופך לפעולה" נשאר זהה לשני המסלולים; ההבדל היחיד הוא זהות המחבר, שעכשיו
// נשמרת (authorId/authorName) כדי שהמשוב יהיה משוייך למי שכתב אותו בפועל.
router.post("/admin/jynx-feedback", requireAdminOrJynxCommenter, asyncRoute(async (req, res) => {
  requireFields(req.body, ["comment"]);
  const secondaryTargets = Array.isArray(req.body.secondaryTargets)
    ? req.body.secondaryTargets.filter((t) => typeof t === "string" && t.trim()).slice(0, 10)
    : [];
  // authorId "admin" (לא null) גם עבור סשן מנהל — תואם ל-id הפסאודו-משתמש
  // הקבוע ("admin") שכבר משמש בכניסת ADMIN_SECRET (ראו dev-auth.js), כדי
  // ש"Just me" ב-CommentsPanel.jsx יעבוד נכון גם עבור מנהל.
  const authorId = req.jynxCommenterUser?.id || "admin";
  const authorName = req.jynxCommenterUser?.name || "Admin";
  const entry = {
    id: "jynx-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    createdAt: new Date().toISOString(),
    route: req.body.route || null, targetLabel: req.body.targetLabel || null, secondaryTargets,
    comment: req.body.comment, resolved: false, resolvedAt: null, resolutionNote: null,
    actionStatus: "queued", actionRequestedAt: new Date().toISOString(),
    actionPrUrl: null, actionLog: null,
    authorId, authorName,
    replies: [],
  };
  await persistNote(entry, `Jynx feedback (${entry.route || "?"}) — ${entry.targetLabel || "?"}`);
  await queueAction(entry);
  res.status(201).json({ ok: true });
}));

// גם GET נפתח לאותם שני המסלולים (לא רק requireAdmin) — כדי שמשתמש-פיתוח
// עם canJynxComment:true יוכל לראות בעצמו את מה שהוא כתב ב-CommentsPanel.jsx
// (סינון "Just me" קורה שם, בצד הלקוח, בדיוק כמו עם הערות QA רגילות).
router.get("/admin/jynx-feedback", requireAdminOrJynxCommenter, (_req, res) => {
  res.json(readAll());
});

router.patch("/admin/jynx-feedback/:id", requireAdmin, asyncRoute(async (req, res) => {
  const found = readAll().find((a) => a.id === req.params.id);
  if (!found) return res.json(null);
  const resolved = !!req.body.resolved;
  const updated = {
    ...found,
    resolved,
    resolvedAt: resolved ? new Date().toISOString() : null,
    resolutionNote: resolved ? (req.body.resolutionNote || found.resolutionNote || null) : found.resolutionNote,
    actionStatus: resolved ? "done" : found.actionStatus,
  };
  await persistNote(updated, `Jynx feedback ${updated.resolved ? "resolved" : "reopened"} — ${updated.id}`);
  res.json(updated);
}));

router.post("/admin/jynx-feedback/:id/reply", requireAdmin, asyncRoute(async (req, res) => {
  requireFields(req.body, ["text"]);
  const found = readAll().find((a) => a.id === req.params.id);
  if (!found) return res.status(404).json({ error: "לא נמצא" });
  const reply = {
    id: "rep-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    authorName: "Admin", text: req.body.text, createdAt: new Date().toISOString(),
  };
  const updated = { ...found, replies: [...(found.replies || []), reply] };
  await persistNote(updated, `reply on ${updated.id}`);
  res.status(201).json(updated);
}));

router.get("/admin/jynx-feedback/export", requireAdmin, (_req, res) => {
  const open = readAll().filter((a) => !a.resolved);
  let md = "# JYNX — self-improvement feedback queue\n\n";
  if (open.length === 0) md += "אין הערות פתוחות כרגע.\n";
  open.forEach((a) => {
    const arrow = a.secondaryTargets?.length ? ` (→ ${a.secondaryTargets.join(", ")})` : "";
    md += `- [ ] **${a.targetLabel || "?"}**${arrow} — ${a.comment} _(${new Date(a.createdAt).toLocaleString("he-IL")})_\n`;
  });
  res.type("text/markdown").send(md);
});

export async function hydrateJynxFeedbackFromGithub() {
  if (!githubPersistEnabled()) return;
  fs.mkdirSync(NOTES_DIR, { recursive: true });
  fs.mkdirSync(ACTIONS_DIR, { recursive: true });
  for (const [dir, githubDir] of [[NOTES_DIR, GITHUB_NOTES_DIR], [ACTIONS_DIR, GITHUB_ACTIONS_DIR]]) {
    const files = await listDirFromGithub(githubDir).catch(() => []);
    for (const f of files) {
      try {
        const remote = await readFileFromGithub(`${githubDir}/${f}`);
        if (remote) fs.writeFileSync(path.join(dir, f), remote.content);
      } catch (err) {
        console.error(`hydrateJynxFeedbackFromGithub: failed on ${githubDir}/${f}:`, err);
      }
    }
  }
}

export default router;

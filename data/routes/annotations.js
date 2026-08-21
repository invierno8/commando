/* ================================================================== */
/* The dev-overlay feedback queue. One JSON file per annotation under    */
/* data/annotations/notes/ — not one big array — so concurrent           */
/* submissions land as distinct files/commits instead of racing to       */
/* overwrite a shared file, and so git history genuinely reads as a      */
/* change log (one commit per note, one commit per resolve). Committed   */
/* straight to the repo (see lib/githubPersist.js) so it survives a      */
/* free-tier host's ephemeral disk.                                      */
/*                                                                      */
/* Any authenticated dev user can submit (write-only from their side).  */
/* Listing/resolving/exporting is admin-only.                            */
/*                                                                      */
/* "Action" flow (added 2026-08-21): the admin can flag a note as an     */
/* action item — either automatically (every note the admin themselves   */
/* writes while logged in) or by clicking "Action" on someone else's     */
/* note. Flagging writes a second, small work-item file under            */
/* data/annotations/actions/<id>.json — a distinct signal path a         */
/* scheduled cloud-agent routine watches, separate from the permanent    */
/* note record. The routine implements the change on a branch, opens a   */
/* PR (never pushes to main directly), then updates the note's           */
/* actionStatus/actionPrUrl fields (plain bookkeeping, committed         */
/* directly) and deletes the now-processed work-item file.               */
/* ================================================================== */

import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { requireDevUser } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/adminAuth.js";
import { asyncRoute, requireFields } from "../middleware/validate.js";
import { commitFileToGithub, githubPersistEnabled, listDirFromGithub, readFileFromGithub } from "../lib/githubPersist.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NOTES_DIR = path.join(__dirname, "..", "annotations", "notes");
const ACTIONS_DIR = path.join(__dirname, "..", "annotations", "actions");
const GITHUB_NOTES_DIR = "data/annotations/notes";
const GITHUB_ACTIONS_DIR = "data/annotations/actions";

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

// כותב את פריט העבודה בתיקיית התור — קובץ נפרד ומצומצם, רק מה שהרוטינה
// הריצה-בענן צריכה כדי להבין מה מבוקש ואיפה.
async function queueAction(note, requestedBy) {
  const workItem = {
    id: note.id, route: note.route, targetLabel: note.targetLabel, targetSelector: note.targetSelector,
    secondaryTargets: note.secondaryTargets || [],
    comment: note.comment, authorName: note.authorName, requestedAt: new Date().toISOString(), requestedBy,
  };
  fs.mkdirSync(ACTIONS_DIR, { recursive: true });
  fs.writeFileSync(path.join(ACTIONS_DIR, `${note.id}.json`), JSON.stringify(workItem, null, 2) + "\n");
  if (githubPersistEnabled()) {
    await commitFileToGithub(`${GITHUB_ACTIONS_DIR}/${note.id}.json`, JSON.stringify(workItem, null, 2) + "\n", `action queued (${note.route}) — ${note.id}`);
  }
}

const router = Router();

router.post("/dev/annotations", requireDevUser, asyncRoute(async (req, res) => {
  requireFields(req.body, ["route", "comment"]);
  // actionRequested מגיע מהלקוח רק כשהמשתמש-פיתוח המחובר גם מאומת כמנהל —
  // "כל מה שאני כותב הופך לפעולה" (ראו DevOverlay.jsx). לא נבדק כאן מול
  // עוגיית מנהל בכוונה: זו נוחות דמו, לא גבול אבטחה (בדיוק כמו מתג ה-mock/live).
  const actionRequested = !!req.body.actionRequested;
  const secondaryTargets = Array.isArray(req.body.secondaryTargets)
    ? req.body.secondaryTargets.filter((t) => typeof t === "string" && t.trim()).slice(0, 10)
    : [];
  const entry = {
    id: "ann-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    authorId: req.devUser.id, authorName: req.devUser.name, createdAt: new Date().toISOString(),
    route: req.body.route, targetLabel: req.body.targetLabel || null, targetSelector: req.body.targetSelector || null,
    secondaryTargets,
    comment: req.body.comment, resolved: false, resolvedAt: null, resolvedBy: null,
    actionStatus: actionRequested ? "queued" : "none",
    actionRequestedAt: actionRequested ? new Date().toISOString() : null,
    actionRequestedBy: actionRequested ? req.devUser.name : null,
    actionPrUrl: null, actionLog: null,
  };
  await persistNote(entry, `QA note (${entry.route}) — ${entry.authorName}`);
  if (actionRequested) await queueAction(entry, req.devUser.name);
  res.status(201).json({ ok: true });
}));

router.get("/admin/annotations", requireAdmin, (_req, res) => {
  res.json(readAll());
});

router.patch("/admin/annotations/:id", requireAdmin, asyncRoute(async (req, res) => {
  const found = readAll().find((a) => a.id === req.params.id);
  if (!found) return res.json(null);
  const updated = {
    ...found,
    resolved: !!req.body.resolved,
    resolvedAt: req.body.resolved ? new Date().toISOString() : null,
    resolvedBy: req.body.resolved ? (req.body.resolvedBy || "admin") : null,
  };
  await persistNote(updated, `QA note ${updated.resolved ? "resolved" : "reopened"} — ${updated.id}`);
  res.json(updated);
}));

// מנהל בלבד — מסמן הערה קיימת (שכתב מישהו אחר) כפריט עבודה.
router.post("/admin/annotations/:id/action", requireAdmin, asyncRoute(async (req, res) => {
  const found = readAll().find((a) => a.id === req.params.id);
  if (!found) return res.status(404).json({ error: "לא נמצא" });
  const updated = {
    ...found, actionStatus: "queued",
    actionRequestedAt: new Date().toISOString(), actionRequestedBy: req.body?.requestedBy || "admin",
    actionPrUrl: null, actionLog: null,
  };
  await persistNote(updated, `action requested — ${updated.id}`);
  await queueAction(updated, updated.actionRequestedBy);
  res.json(updated);
}));

// Markdown, סעיפים לא-פתורים בלבד, מקובצים לפי מסך — נועד להיות עותק-הדבק
// ישיר לתור עבודה.
router.get("/admin/annotations/export", requireAdmin, (_req, res) => {
  const open = readAll().filter((a) => !a.resolved);
  const byRoute = {};
  open.forEach((a) => { (byRoute[a.route] ||= []).push(a); });

  let md = "# HANGAR — Dev feedback queue\n\n";
  if (open.length === 0) md += "אין הערות פתוחות כרגע.\n";
  Object.entries(byRoute).forEach(([route, items]) => {
    md += `## ${route}\n\n`;
    items.forEach((a) => {
      const arrow = a.secondaryTargets?.length ? ` (→ ${a.secondaryTargets.join(", ")})` : "";
      md += `- [ ] **${a.targetLabel || "?"}**${arrow} — ${a.comment} _(${a.authorName}, ${new Date(a.createdAt).toLocaleString("he-IL")})_\n`;
    });
    md += "\n";
  });
  res.type("text/markdown").send(md);
});

// נקרא פעם אחת בעליית השרת — מחזיר את כל ההערות/פריטי העבודה האמיתיים
// מ-git לפני שהשרת מתחיל לענות, כי הדיסק המקומי עלול להתאפס. ללא
// GITHUB_TOKEN זו פעולה ריקה.
export async function hydrateAnnotationsFromGithub() {
  if (!githubPersistEnabled()) return;
  fs.mkdirSync(NOTES_DIR, { recursive: true });
  fs.mkdirSync(ACTIONS_DIR, { recursive: true });
  for (const [dir, githubDir] of [[NOTES_DIR, GITHUB_NOTES_DIR], [ACTIONS_DIR, GITHUB_ACTIONS_DIR]]) {
    const files = await listDirFromGithub(githubDir).catch(() => []);
    for (const f of files) {
      // קובץ בעייתי בודד (רשת/JSON פגום) לא אמור לעצור את כל שאר ההידרציה.
      try {
        const remote = await readFileFromGithub(`${githubDir}/${f}`);
        if (remote) fs.writeFileSync(path.join(dir, f), remote.content);
      } catch (err) {
        console.error(`hydrateAnnotationsFromGithub: failed on ${githubDir}/${f}:`, err);
      }
    }
  }
}

export default router;

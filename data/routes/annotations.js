/* ================================================================== */
/* The dev-overlay feedback queue. One JSON file per annotation under    */
/* data/annotations/notes/ — not one big array — so concurrent           */
/* submissions land as distinct files/commits instead of racing to       */
/* overwrite a shared file, and so git history genuinely reads as a      */
/* change log (one commit per note, one commit per resolve). Committed   */
/* straight to the repo (see lib/githubPersist.js) so it survives a      */
/* free-tier host's ephemeral disk — no database, no paid persistent-    */
/* disk plan needed, per the user's explicit call: this is a public      */
/* concept demo, not a security-sensitive system, and the annotation     */
/* text itself carries no real value worth protecting.                   */
/*                                                                      */
/* Any authenticated dev user can submit (write-only from their side).  */
/* Listing/resolving/exporting is admin-only.                            */
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
const GITHUB_DIR = "data/annotations/notes";

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
  fs.writeFileSync(path.join(NOTES_DIR, `${id}.json`), JSON.stringify(note, null, 2));
}

async function persistNote(note, message) {
  writeLocalNote(note.id, note);
  if (githubPersistEnabled()) {
    await commitFileToGithub(`${GITHUB_DIR}/${note.id}.json`, JSON.stringify(note, null, 2) + "\n", message);
  }
}

const router = Router();

router.post("/dev/annotations", requireDevUser, asyncRoute(async (req, res) => {
  requireFields(req.body, ["route", "comment"]);
  const entry = {
    id: "ann-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    authorId: req.devUser.id, authorName: req.devUser.name, createdAt: new Date().toISOString(),
    route: req.body.route, targetLabel: req.body.targetLabel || null, targetSelector: req.body.targetSelector || null,
    comment: req.body.comment, resolved: false, resolvedAt: null, resolvedBy: null,
  };
  await persistNote(entry, `QA note (${entry.route}) — ${entry.authorName}`);
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
      md += `- [ ] **${a.targetLabel || "?"}** — ${a.comment} _(${a.authorName}, ${new Date(a.createdAt).toLocaleString("he-IL")})_\n`;
    });
    md += "\n";
  });
  res.type("text/markdown").send(md);
});

// נקרא פעם אחת בעליית השרת — מחזיר את כל ההערות האמיתיות מ-git לפני שהשרת
// מתחיל לענות, כי הדיסק המקומי עלול להתאפס (redeploy/spin-down) בלי ש-git
// ישתנה. ללא GITHUB_TOKEN זו פעולה ריקה.
export async function hydrateAnnotationsFromGithub() {
  if (!githubPersistEnabled()) return;
  const files = await listDirFromGithub(GITHUB_DIR);
  fs.mkdirSync(NOTES_DIR, { recursive: true });
  for (const f of files) {
    const remote = await readFileFromGithub(`${GITHUB_DIR}/${f}`);
    if (remote) fs.writeFileSync(path.join(NOTES_DIR, f), remote.content);
  }
}

export default router;

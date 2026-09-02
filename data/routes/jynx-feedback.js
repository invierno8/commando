/* ================================================================== */
/* Jynx's OWN feedback queue — completely separate from                */
/* data/annotations/{notes,actions}/, which is QA feedback about the    */
/* underlying HANGAR app. This one is meta: comments about the Jynx     */
/* dev-tool overlay itself (the FAB, the toolbar, the admin panel...),  */
/* meant to evolve Jynx into its own standalone product later.          */
/*                                                                      */
/* Historically admin-only end to end. As of 2026-08-21, submitting a   */
/* NEW note (POST) is also open to any dev user whose roster record has */
/* canJynxComment:true (see data/lib/devUsers.js / DevAdminUsersScreen  */
/* .jsx) — "collect what the Jynx commenter says" — landing in this     */
/* exact same queue. Whether an entry queues as an action is an         */
/* explicit choice (the same "will send as action" toggle already used  */
/* for admin QA notes) — not implicitly always-on, so a plain comment   */
/* about Jynx can be left without it turning into a work item. Every    */
/* OTHER route here (GET, PATCH, reply, export) stays admin-only        */
/* exactly as before; requireAdmin itself is untouched — the wider POST */
/* gate is a small, local addition below, not a change to that shared   */
/* middleware.                                                          */
/* ================================================================== */

import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { requireAdmin } from "../middleware/adminAuth.js";
import { requireDevUser } from "../middleware/auth.js";
import { resolveSession } from "../lib/sessions.js";
import { readDevUsers } from "../lib/devUsers.js";
import { asyncRoute, requireFields } from "../middleware/validate.js";
import { commitFileToGithub, deleteFileFromGithub, githubPersistEnabled, listDirFromGithub, readFileFromGithub } from "../lib/githubPersist.js";
import { parseMentionedUsers, hasJynxMention, addMention } from "../lib/mentions.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NOTES_DIR = path.join(__dirname, "..", "annotations", "jynx-notes");
const ACTIONS_DIR = path.join(__dirname, "..", "annotations", "jynx-actions");
const GITHUB_NOTES_DIR = "data/annotations/jynx-notes";
const GITHUB_ACTIONS_DIR = "data/annotations/jynx-actions";

// אותה פלטה בדיוק כמו data/routes/annotations.js (ראו שם) — מוגדרת שוב פה
// ולא משותפת, כי כל route מודול כאן עצמאי לגמרי (אין ייבוא צולב בין קבצי
// routes/), בדיוק כמו הכלל של "כל מסך נושא <style> משלו" בצד הלקוח.
const REACTION_EMOJI = ["👍", "😄", "🤔", "❤️"];

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

async function deleteNote(id, message) {
  try { fs.unlinkSync(path.join(NOTES_DIR, `${id}.json`)); } catch { /* כבר לא קיים מקומית — ננסה עדיין למחוק ב-GitHub */ }
  if (githubPersistEnabled()) {
    await deleteFileFromGithub(`${GITHUB_NOTES_DIR}/${id}.json`, message);
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

// @jynx בתגובה — ראו ההסבר המלא ב-data/routes/annotations.js's queueFollowUp
// (אותו רעיון בדיוק, רק על תור jynx-actions/ הנפרד).
async function queueFollowUp(note, followUpText, requestedBy) {
  const workItem = {
    id: note.id, route: note.route, targetLabel: note.targetLabel, secondaryTargets: note.secondaryTargets || [],
    comment: note.comment, followUpText, requestedAt: new Date().toISOString(), requestedBy,
    isFollowUp: true, existingPrUrl: note.actionPrUrl || null,
  };
  fs.mkdirSync(ACTIONS_DIR, { recursive: true });
  fs.writeFileSync(path.join(ACTIONS_DIR, `${note.id}.json`), JSON.stringify(workItem, null, 2) + "\n");
  if (githubPersistEnabled()) {
    await commitFileToGithub(`${GITHUB_ACTIONS_DIR}/${note.id}.json`, JSON.stringify(workItem, null, 2) + "\n", `jynx follow-up queued — ${note.id}`);
  }
}

// שער-הרשאה מקומי, רק לroute הזה — לא נוגע ב-requireAdmin עצמו. עובר אם
// יש X-Admin-Session תקין (מנהל, בדיוק כמו היום) *או* אם req.devUser
// (מ-middleware/auth.js הגלובלי) מצביע על משתמש-פיתוח שהמנהל סימן לו
// canJynxComment:true ברשימה. נטען טרי מהקובץ בכל בקשה, לא מהטוקן, כדי
// שביטול הרשאה ייכנס לתוקף מיד.
function requireAdminOrJynxCommenter(req, res, next) {
  const adminToken = req.headers["x-admin-session"] || req.cookies?.hangar_admin_session;
  if (resolveSession(adminToken)) return next();
  if (req.devUser) {
    const record = readDevUsers().find((u) => u.id === req.devUser.id);
    if (record && record.active !== false && record.canJynxComment) return next();
  }
  return res.status(401).json({ error: "נדרש אימות מנהל, או הרשאת Jynx commenter" });
}

const router = Router();

router.post("/admin/jynx-feedback", requireAdminOrJynxCommenter, asyncRoute(async (req, res) => {
  requireFields(req.body, ["comment"]);
  const secondaryTargets = Array.isArray(req.body.secondaryTargets)
    ? req.body.secondaryTargets.filter((t) => typeof t === "string" && t.trim()).slice(0, 10)
    : [];
  // ברירת מחדל דלוקה (תואם להתנהגות הקודמת) כשלא נשלח בכלל — אבל כפתור
  // "יישלח כפעולה" ב-AnnotationPopover.jsx נותן למנהל לכבות את זה מראש.
  const actionRequested = req.body.actionRequested === undefined ? true : !!req.body.actionRequested;
  const entry = {
    id: "jynx-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    // authorId/authorName: לפני 2026-08-21 היה תמיד המנהל (השדה לא נשמר
    // בכלל); עכשיו יכול להיות גם Jynx commenter — נשמר לצורך תצוגה בלבד,
    // אין עדיין UI לכתוב "ההערות שלי" על התור הזה (ראו FORCLAUDE.md).
    authorId: req.devUser?.id || null, authorName: req.devUser?.name || "Admin",
    createdAt: new Date().toISOString(),
    route: req.body.route || null, targetLabel: req.body.targetLabel || null, secondaryTargets,
    comment: req.body.comment, resolved: false, resolvedAt: null, resolutionNote: null,
    actionStatus: actionRequested ? "queued" : "none",
    actionRequestedAt: actionRequested ? new Date().toISOString() : null,
    actionPrUrl: null, actionLog: null,
    replies: [],
    reactions: Object.fromEntries(REACTION_EMOJI.map((e) => [e, []])),
  };
  await persistNote(entry, `Jynx feedback (${entry.route || "?"}) — ${entry.authorName}`);
  if (actionRequested) await queueAction(entry);
  res.status(201).json({ ok: true });
}));

router.get("/admin/jynx-feedback", requireAdmin, (_req, res) => {
  res.json(readAll());
});

// "ההערות שלי" — עבור CommentsPanel.jsx, כדי שמשתמש-פיתוח עם canJynxComment
// (לא מנהל) יראה בפאנל שלו את משוב ה-Jynx שהוא עצמו כתב, בדיוק כמו שהוא כבר
// רואה אותו בתפריט המנהל. בכוונה לא הופך את GET /admin/jynx-feedback עצמו
// למשותף (זה נשאר admin-only, כמו כל route אחר כאן חוץ מה-POST) — route
// נפרד, מצומצם לרשומות של המשתמש עצמו בלבד, אותו היגיון בדיוק כמו
// PATCH /dev/annotations/:id מול PATCH /admin/annotations/:id.
router.get("/dev/jynx-feedback/mine", requireDevUser, (req, res) => {
  const record = readDevUsers().find((u) => u.id === req.devUser.id);
  if (!record || record.active === false || !record.canJynxComment) {
    return res.status(401).json({ error: "נדרש הרשאת Jynx commenter" });
  }
  res.json(readAll().filter((a) => a.authorId === req.devUser.id));
});

// jynx-mth5347s3eil: "for dev user - allow deleting their own comments" —
// same ownership pattern as GET .../mine above and PATCH /dev/annotations/:id
// in routes/annotations.js. Not extended to a note with replies from
// someone else — that has a visible consequence for another person, so it
// stays admin-only via a future admin-panel delete if ever needed.
router.delete("/dev/jynx-feedback/:id", requireDevUser, asyncRoute(async (req, res) => {
  const found = readAll().find((a) => a.id === req.params.id);
  if (!found) return res.status(404).json({ error: "לא נמצא" });
  if (found.authorId !== req.devUser.id) {
    return res.status(403).json({ error: "אפשר למחוק רק הערות שכתבת בעצמך" });
  }
  if ((found.replies || []).length > 0) {
    return res.status(409).json({ error: "לא ניתן למחוק הערה עם תגובות — פנה/י למנהל" });
  }
  await deleteNote(found.id, `Jynx feedback deleted by author — ${found.id}`);
  res.json({ ok: true });
}));

// גם resolve/reopen (כמו קודם) וגם, מ-2026-08-21, עריכת טקסט ההערה עצמה
// (comment) — ראו הכפתור-עיפרון ב-JynxFeedbackScreen.jsx. השדות בלתי-תלויים
// בכוונה: "resolved" מטופל רק אם הוא בפועל הגיע ב-body (כדי שקריאת עריכה
// שמעבירה רק {comment} לא תאפס resolved=false בטעות ותפתח מחדש הערה סגורה).
router.patch("/admin/jynx-feedback/:id", requireAdmin, asyncRoute(async (req, res) => {
  const found = readAll().find((a) => a.id === req.params.id);
  if (!found) return res.json(null);
  const resolvedProvided = Object.prototype.hasOwnProperty.call(req.body, "resolved");
  const resolved = resolvedProvided ? !!req.body.resolved : found.resolved;
  const commentProvided = typeof req.body.comment === "string" && req.body.comment.trim().length > 0;
  const updated = {
    ...found,
    comment: commentProvided ? req.body.comment.trim() : found.comment,
    resolved,
    resolvedAt: resolvedProvided ? (resolved ? new Date().toISOString() : null) : found.resolvedAt,
    resolutionNote: resolvedProvided
      ? (resolved ? (req.body.resolutionNote || found.resolutionNote || null) : found.resolutionNote)
      : found.resolutionNote,
    actionStatus: resolvedProvided && resolved && found.actionStatus && found.actionStatus !== "none" ? "done" : found.actionStatus,
  };
  const message = resolvedProvided
    ? `Jynx feedback ${updated.resolved ? "resolved" : "reopened"} — ${updated.id}`
    : `Jynx feedback edited — ${updated.id}`;
  await persistNote(updated, message);
  // jynx-mt5qb3ak9rsz: same "status update" notification as
  // routes/annotations.js's resolve route — see the comment there.
  if (resolvedProvided && resolved && !found.resolved && found.authorId && found.authorId !== req.devUser?.id) {
    await addMention(found.authorId, {
      kind: "status", noteId: found.id, route: found.route, targetLabel: found.targetLabel,
      mentionedBy: req.devUser?.name || "Admin", mentionedById: req.devUser?.id || null,
      snippet: "Marked your Jynx feedback as done.",
    });
  }
  res.json(updated);
}));

router.post("/admin/jynx-feedback/:id/reply", requireAdmin, asyncRoute(async (req, res) => {
  requireFields(req.body, ["text"]);
  const found = readAll().find((a) => a.id === req.params.id);
  if (!found) return res.status(404).json({ error: "לא נמצא" });
  // "תגובה בתור Jynx" (jynx-mt5ev53xof3v) — הנתיב הזה כבר admin-only
  // (requireAdmin), אז אין צורך בבדיקה נוספת כמו ב-routes/annotations.js.
  const asJynx = req.body.asJynx === true;
  const reply = {
    id: "rep-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    authorId: asJynx ? null : (req.devUser?.id || null), authorName: asJynx ? "Jynx" : (req.devUser?.name || "Admin"),
    ...(asJynx ? { isJynx: true } : {}),
    text: req.body.text, createdAt: new Date().toISOString(),
  };
  const jynxTagged = hasJynxMention(req.body.text);
  let updated = { ...found, replies: [...(found.replies || []), reply] };
  if (jynxTagged) {
    updated = { ...updated, actionStatus: "queued", actionRequestedAt: new Date().toISOString() };
  }
  await persistNote(updated, `reply on ${updated.id}`);
  const mentionedUsers = parseMentionedUsers(req.body.text);
  for (const u of mentionedUsers) {
    if (u.id === reply.authorId) continue;
    await addMention(u.id, {
      kind: "jynx", noteId: found.id, replyId: reply.id, route: found.route, targetLabel: found.targetLabel,
      mentionedBy: reply.authorName, mentionedById: reply.authorId, snippet: req.body.text.slice(0, 200),
    });
  }
  // jynx-mt5qb3ak9rsz: same "status update" notification as
  // routes/annotations.js's reply route — see the comment there.
  if (found.authorId && found.authorId !== reply.authorId && !mentionedUsers.some((u) => u.id === found.authorId)) {
    await addMention(found.authorId, {
      kind: "status", noteId: found.id, replyId: reply.id, route: found.route, targetLabel: found.targetLabel,
      mentionedBy: reply.authorName, mentionedById: reply.authorId,
      snippet: `Replied to your Jynx feedback: ${req.body.text.slice(0, 180)}`,
    });
  }
  if (jynxTagged) await queueFollowUp(updated, req.body.text, reply.authorName);
  res.status(201).json(updated);
}));

// ריאקציית אימוג'י — נשאר מגודר-מנהל בדיוק כמו שאר תור המשוב הזה (אין עדיין
// הרשאה רחבה יותר לקריאת/כתיבת jynx-feedback בקוד הזה). req.devUser זמין
// כאן כי attachDevUser רץ גלובלית (ראו server.js) והמנהל תמיד מחובר קודם
// כמשתמש-פיתוח לפני אימות המנהל — אבל ליתר ביטחון, נופלים חזרה ל-"admin"
// אם אין סשן dev מצורף, כמו ה-authorName הקבוע ב-reply למעלה.
router.post("/admin/jynx-feedback/:id/react", requireAdmin, asyncRoute(async (req, res) => {
  requireFields(req.body, ["emoji"]);
  if (!REACTION_EMOJI.includes(req.body.emoji)) return res.status(400).json({ error: "אימוג'י לא נתמך" });
  const found = readAll().find((a) => a.id === req.params.id);
  if (!found) return res.status(404).json({ error: "לא נמצא" });
  const reactorId = req.devUser?.id || "admin";
  const reactions = { ...Object.fromEntries(REACTION_EMOJI.map((e) => [e, []])), ...(found.reactions || {}) };
  const current = reactions[req.body.emoji] || [];
  reactions[req.body.emoji] = current.includes(reactorId)
    ? current.filter((id) => id !== reactorId)
    : [...current, reactorId];
  const updated = { ...found, reactions };
  await persistNote(updated, `reaction on ${updated.id}`);
  res.json(updated);
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

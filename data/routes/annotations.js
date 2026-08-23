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
import { requireAdmin, isAdminRequest } from "../middleware/adminAuth.js";
import { asyncRoute, requireFields } from "../middleware/validate.js";
import { commitFileToGithub, deleteFileFromGithub, githubPersistEnabled, listDirFromGithub, readFileFromGithub } from "../lib/githubPersist.js";
import { parseMentionedUsers, hasJynxMention, addMention } from "../lib/mentions.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NOTES_DIR = path.join(__dirname, "..", "annotations", "notes");
const ACTIONS_DIR = path.join(__dirname, "..", "annotations", "actions");
const GITHUB_NOTES_DIR = "data/annotations/notes";
const GITHUB_ACTIONS_DIR = "data/annotations/actions";
// גב-הגנה בצד השרת לגודל קובץ מצורף — הבדיקה העיקרית היא בצד הלקוח
// (AnnotationPopover.jsx, 2MB), אבל data-URL כזה מתחייב ל-git דרך
// githubPersist.js אז לא סומכים רק על הלקוח. ~2.75MB base64 ≈ 2MB בינארי.
const MAX_ATTACHMENT_CHARS = 2.8 * 1024 * 1024;

// פלטת אימוג'ים קבועה וקטנה — לא ספריית emoji-picker (אין ספריות UI חיצוניות
// נוספות בקודבייס הזה, ראו FORCLAUDE.md). מוגדרת גם כאן (לא רק בקליינט) כדי
// שהשרת ידחה ריאקציה עם אימוג'י שרירותי, לא רק יסמוך על הצד השני.
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

// מחיקה מלאה — בניגוד ל-archived (שרק מסתירה, ראו PATCH למטה), הקובץ עצמו
// נעלם, מקומית וב-GitHub כאחד.
async function deleteNote(id, message) {
  try { fs.unlinkSync(path.join(NOTES_DIR, `${id}.json`)); } catch { /* כבר לא קיים מקומית — ננסה עדיין למחוק ב-GitHub */ }
  if (githubPersistEnabled()) {
    await deleteFileFromGithub(`${GITHUB_NOTES_DIR}/${id}.json`, message);
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

// @jynx בתגובה (ראו POST .../reply למטה) — בניגוד ל-queueAction (בקשה
// טרייה), זה חוזר על פריט שכבר טופל בעבר: existingPrUrl מצביע על ה-PR
// הקיים (אם יש), כדי שהרוטינה תדע לעדכן אותו במקום לפתוח כפול. isFollowUp
// הוא הדגל שגורם לה לא לדלג למרות ש-actionStatus כבר "pr_opened"/"done".
async function queueFollowUp(note, followUpText, requestedBy) {
  const workItem = {
    id: note.id, route: note.route, targetLabel: note.targetLabel, targetSelector: note.targetSelector,
    secondaryTargets: note.secondaryTargets || [],
    comment: note.comment, followUpText, authorName: note.authorName,
    requestedAt: new Date().toISOString(), requestedBy,
    isFollowUp: true, existingPrUrl: note.actionPrUrl || null,
  };
  fs.mkdirSync(ACTIONS_DIR, { recursive: true });
  fs.writeFileSync(path.join(ACTIONS_DIR, `${note.id}.json`), JSON.stringify(workItem, null, 2) + "\n");
  if (githubPersistEnabled()) {
    await commitFileToGithub(`${GITHUB_ACTIONS_DIR}/${note.id}.json`, JSON.stringify(workItem, null, 2) + "\n", `follow-up queued (${note.route}) — ${note.id}`);
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
  // תמונת השראה / קובץ אחד, אופציונלי — data-URL כפי שנשלח מהלקוח
  // (AnnotationPopover.jsx, אותה קונבנציה כמו LogoUpload.jsx), נשמר כמות
  // שהוא על רשומת ההערה. שם הקובץ המקורי נשמר בנפרד רק לצורך תצוגה
  // (thumbnail/link), לא חלק מה-data-URL עצמו.
  const rawAttachment = typeof req.body.attachment === "string" ? req.body.attachment : null;
  if (rawAttachment && rawAttachment.length > MAX_ATTACHMENT_CHARS) {
    return res.status(400).json({ error: "Attachment too large (max ~2MB)" });
  }
  const attachment = rawAttachment && rawAttachment.startsWith("data:") ? rawAttachment : null;
  const attachmentName = attachment && typeof req.body.attachmentName === "string"
    ? req.body.attachmentName.slice(0, 200)
    : null;
  // ציור-חופשי/פוליגון על העמוד (ראו DrawingCanvas.jsx) — נקודות כאחוזים
  // (0-100) מגודל ה-viewport בזמן הציור, לא פיקסלים מוחלטים, כדי ש-
  // DrawingOverlay.jsx יוכל לשחזר אותו במידה יחסית נכונה גם על מסך אחר.
  // מוגבל ל-500 נקודות לכל קו — הגנה על גודל הקובץ (זה מתחייב ל-git), לא
  // מגבלה אמנותית; קו יד חופשית טיפוסי לא מתקרב לזה. מאז 2026-08-23 ציור
  // הוא אוסף של strokes (ציור-רב-שלבי — שחרור העכבר לא מסיים את הציור
  // יותר, ראו DrawingCanvas.jsx), עד 20 קווים לציור אחד, פלוס צבע אחד
  // משותף לכל הציור (אחד מ-4 הצבעים בלוח של Jynx).
  const rawDrawing = req.body.drawing;
  const cleanedStrokes = Array.isArray(rawDrawing?.strokes)
    ? rawDrawing.strokes
        .filter((s) => Array.isArray(s?.points) && s.points.length >= 2)
        .slice(0, 20)
        .map((s) => ({
          type: s.type === "polygon" ? "polygon" : "freehand",
          points: s.points.slice(0, 500).map((p) => [Number(p[0]) || 0, Number(p[1]) || 0]),
        }))
    : [];
  const drawing = cleanedStrokes.length
    ? { strokes: cleanedStrokes, color: typeof rawDrawing.color === "string" ? rawDrawing.color.slice(0, 40) : null }
    : null;
  const entry = {
    id: "ann-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    authorId: req.devUser.id, authorName: req.devUser.name, createdAt: new Date().toISOString(),
    route: req.body.route, targetLabel: req.body.targetLabel || null, targetSelector: req.body.targetSelector || null,
    secondaryTargets,
    comment: req.body.comment, attachment, attachmentName, drawing, resolved: false, resolvedAt: null, resolvedBy: null, resolutionNote: null,
    reopenedNote: null,
    archived: false, archivedAt: null,
    actionStatus: actionRequested ? "queued" : "none",
    actionRequestedAt: actionRequested ? new Date().toISOString() : null,
    actionRequestedBy: actionRequested ? req.devUser.name : null,
    actionPrUrl: null, actionLog: null,
    replies: [],
    // מפתח = אימוג'י, ערך = מערך מזהי dev-user שריאקטו איתו (ראו
    // POST /dev/annotations/:id/react למטה) — אין ספירה נפרדת, אורך המערך
    // הוא הספירה, וזה גם מה שקובע אם המשתמש הנוכחי כבר ריאקט (מחפשים
    // req.devUser.id בתוך המערך).
    reactions: Object.fromEntries(REACTION_EMOJI.map((e) => [e, []])),
  };
  await persistNote(entry, `QA note (${entry.route}) — ${entry.authorName}`);
  if (actionRequested) await queueAction(entry, req.devUser.name);
  res.status(201).json({ ok: true });
}));

// כל משתמש-פיתוח מחובר (לא רק מנהל) — תצוגת "כל ההערות על המסך הזה", ראו
// CommentsPanel.jsx. שונה בכוונה מ-GET /admin/annotations (שדורש מנהל):
// זו רק רשימת ההערות על המסך הנוכחי (כולל שטופלו — כדי שמי שכתב הערה יראה
// אותה זזה ל"טופל" עם התשובה, לא רק שתיעלם), לא פאנל הניהול/פעולות.
router.get("/dev/annotations", requireDevUser, (req, res) => {
  const route = req.query.route;
  const items = readAll().filter((a) => !route || a.route === route).filter((a) => !a.archived);
  res.json(items);
});

// תגובת-מעקב על הערה — כל משתמש-פיתוח מחובר, כולל מי שלא כתב את ההערה
// המקורית (כדי לאפשר דיון אמיתי, לא רק "בעל ההערה מגיב לעצמו"). שני דברים
// עצמאיים קורים כאן על טקסט התגובה עצמו:
//
// 1. אם ההערה כבר "טופלה" (resolved:true) וכעת מגיעה תגובה חדשה, מניחים
//    שהתגובה מבקשת המשך טיפול ופותחים אותה מחדש אוטומטית — עדיף מהערת
//    "טופל" שקטה שממשיכה לצבור תגובות שאף אחד לא רואה. reopenedNote היא
//    הודעה חד-פעמית שמוצגת על השורה עד שההערה תסומן "טופל" שוב (ראו PATCH
//    /admin/annotations/:id למטה, ששם היא מתאפסת) — לא toast חוזר.
// 2. מנתחת את הטקסט לשני סוגי אזכור, בדיוק כמו שה-[→ תווית] כבר מנותח
//    מטקסט חופשי במקום picker נפרד (ראו DevOverlay.jsx): "@שם" של
//    משתמש-פיתוח אמיתי מייצר לו התראה (ראו lib/mentions.js), ו-"@jynx"
//    (תמיד שמור, לעולם לא משתמש אמיתי) מחזיר את ההערה לתור הפעולות
//    כ-follow-up על ה-PR הקיים (אם יש) — כדי שלא תצטרך לפתוח הערה חדשה
//    רק כדי לומר "זה עוד לא בדיוק זה". שני הדברים יכולים לקרות יחד —
//    תגובה על הערה טופלה שגם מתייגת @jynx גם פותחת מחדש וגם מתורה חזרה.
router.post("/dev/annotations/:id/reply", requireDevUser, asyncRoute(async (req, res) => {
  requireFields(req.body, ["text"]);
  const found = readAll().find((a) => a.id === req.params.id);
  if (!found) return res.status(404).json({ error: "לא נמצא" });
  // "תגובה בתור Jynx" (jynx-mt5ev53xof3v: "make it have its own user so
  // we'll know its jynx and not admin user") — רק מנהל אמיתי-מחובר יכול
  // לבקש את זה (isAdminRequest, לא רק requireDevUser של הנתיב הזה), אחרת
  // כל משתמש-פיתוח יכול היה "להתחזות" ל-Jynx. authorId נשאר null בכוונה
  // (אין משתמש-פיתוח אמיתי מאחורי זה) — הרינדור בצד הלקוח (CommentsPanel.jsx)
  // בודק isJynx כדי לתת תג ייחודי במקום קישור-לפרופיל רגיל.
  const asJynx = req.body.asJynx === true && isAdminRequest(req);
  const reply = {
    id: "rep-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    authorId: asJynx ? null : req.devUser.id, authorName: asJynx ? "Jynx" : req.devUser.name,
    ...(asJynx ? { isJynx: true } : {}),
    text: req.body.text, createdAt: new Date().toISOString(),
  };
  const wasResolved = found.resolved;
  const jynxTagged = hasJynxMention(req.body.text);
  let updated = {
    ...found,
    replies: [...(found.replies || []), reply],
    resolved: wasResolved ? false : found.resolved,
    resolvedAt: wasResolved ? null : found.resolvedAt,
    resolvedBy: wasResolved ? null : found.resolvedBy,
    reopenedNote: wasResolved ? "Reopened — a new reply came in after this was marked done." : (found.reopenedNote || null),
  };
  if (jynxTagged) {
    updated = { ...updated, actionStatus: "queued", actionRequestedAt: new Date().toISOString(), actionRequestedBy: req.devUser.name };
  }
  await persistNote(updated, wasResolved ? `reply reopened ${updated.id} — ${req.devUser.name}` : `reply on ${updated.id} — ${req.devUser.name}`);
  for (const u of parseMentionedUsers(req.body.text)) {
    if (u.id === req.devUser.id) continue; // אל תתריע למי שמזכיר את עצמו
    await addMention(u.id, {
      kind: "app", noteId: found.id, replyId: reply.id, route: found.route, targetLabel: found.targetLabel,
      mentionedBy: req.devUser.name, mentionedById: req.devUser.id, snippet: req.body.text.slice(0, 200),
    });
  }
  if (jynxTagged) await queueFollowUp(updated, req.body.text, req.devUser.name);
  res.status(201).json(updated);
}));

// עריכת טקסט ההערה על ידי מי שכתב אותה בעצמו — שונה מ-PATCH
// /admin/annotations/:id למעלה/מטה (שדורש מנהל ויכול לערוך כל הערה): זו
// הדרך של CommentsPanel.jsx לתת לכל משתמש-פיתוח לערוך רק את מה שהוא עצמו
// כתב, מתוך "כל ההערות שהשארתי פיזית על המסך הזה" — בלי לעבור דרך פאנל
// הניהול, ובלי הרשאת מנהל בכלל.
router.patch("/dev/annotations/:id", requireDevUser, asyncRoute(async (req, res) => {
  requireFields(req.body, ["comment"]);
  const found = readAll().find((a) => a.id === req.params.id);
  if (!found) return res.status(404).json({ error: "לא נמצא" });
  if (found.authorId !== req.devUser.id) {
    return res.status(403).json({ error: "אפשר לערוך רק הערות שכתבת בעצמך" });
  }
  const updated = { ...found, comment: req.body.comment };
  await persistNote(updated, `comment edited by author — ${updated.id}`);
  res.json(updated);
}));

// ריאקציית אימוג'י — כל משתמש-פיתוח מחובר, גם על הערה שהוא לא כתב (בדיוק
// כמו התגובות). קליק על אימוג'י שכבר ריאקטתי איתו מסיר אותו (toggle רגיל),
// לא מוסיף שוב — כמו כל UI ריאקציות מוכר.
router.post("/dev/annotations/:id/react", requireDevUser, asyncRoute(async (req, res) => {
  requireFields(req.body, ["emoji"]);
  if (!REACTION_EMOJI.includes(req.body.emoji)) return res.status(400).json({ error: "אימוג'י לא נתמך" });
  const found = readAll().find((a) => a.id === req.params.id);
  if (!found) return res.status(404).json({ error: "לא נמצא" });
  const reactions = { ...Object.fromEntries(REACTION_EMOJI.map((e) => [e, []])), ...(found.reactions || {}) };
  const current = reactions[req.body.emoji] || [];
  reactions[req.body.emoji] = current.includes(req.devUser.id)
    ? current.filter((id) => id !== req.devUser.id)
    : [...current, req.devUser.id];
  const updated = { ...found, reactions };
  await persistNote(updated, `reaction on ${updated.id} — ${req.devUser.name}`);
  res.json(updated);
}));

router.get("/admin/annotations", requireAdmin, (_req, res) => {
  res.json(readAll());
});

router.patch("/admin/annotations/:id", requireAdmin, asyncRoute(async (req, res) => {
  const found = readAll().find((a) => a.id === req.params.id);
  if (!found) return res.json(null);
  // resolved / archived / comment מגיעים בקריאות נפרדות (Mark done / Archive /
  // Save-edit הם שלושה כפתורים שונים) — נוגעים רק בשדה שבאמת נשלח, כדי
  // שקריאה שמעדכנת אחד מהם לא תדרוס בטעות את מצב האחרים.
  const hasResolvedField = req.body.resolved !== undefined;
  const hasArchivedField = req.body.archived !== undefined;
  const hasCommentField = typeof req.body.comment === "string" && req.body.comment.trim().length > 0;
  const resolved = hasResolvedField ? !!req.body.resolved : found.resolved;
  const archived = hasArchivedField ? !!req.body.archived : !!found.archived;
  const updated = {
    ...found,
    resolved,
    resolvedAt: hasResolvedField ? (resolved ? new Date().toISOString() : null) : found.resolvedAt,
    resolvedBy: hasResolvedField ? (resolved ? (req.body.resolvedBy || "admin") : null) : found.resolvedBy,
    resolutionNote: hasResolvedField
      ? (resolved ? (req.body.resolutionNote || found.resolutionNote || null) : found.resolutionNote)
      : found.resolutionNote,
    archived,
    archivedAt: hasArchivedField ? (archived ? new Date().toISOString() : null) : (found.archivedAt || null),
    comment: hasCommentField ? req.body.comment.trim() : found.comment,
    // סימון "טופל" גם על תור הפעולות — "מעבר לטופל" שהמנהל ביקש, לא רק
    // resolved נפרד מ-actionStatus שלא באמת מסתנכרן.
    actionStatus: resolved && found.actionStatus && found.actionStatus !== "none" ? "done" : found.actionStatus,
    // "טופל" מחדש מאפס את הודעת "נפתחה מחדש" החד-פעמית (ראו POST
    // /dev/annotations/:id/reply למעלה) — היא כבר מילאה את תפקידה.
    reopenedNote: hasResolvedField && resolved ? null : (found.reopenedNote || null),
  };
  const verb = hasCommentField ? "edited" : hasArchivedField ? (archived ? "archived" : "unarchived") : (resolved ? "resolved" : "reopened");
  await persistNote(updated, `QA note ${verb} — ${updated.id}`);
  res.json(updated);
}));

// מחיקה מלאה ובלתי הפיכה — בניגוד ל-archived, שרק מסתירה מהתצוגות
// הרגילות אבל שומרת את הרשומה עצמה.
router.delete("/admin/annotations/:id", requireAdmin, asyncRoute(async (req, res) => {
  const found = readAll().find((a) => a.id === req.params.id);
  if (!found) return res.status(404).json({ error: "לא נמצא" });
  await deleteNote(found.id, `QA note deleted — ${found.id}`);
  res.json({ ok: true });
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
  const open = readAll().filter((a) => !a.resolved && !a.archived);
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

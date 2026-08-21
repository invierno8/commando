/* ================================================================== */
/* Jynx's OWN feedback queue — completely separate from                */
/* data/annotations/{notes,actions}/, which is QA feedback about the    */
/* underlying HANGAR app. This one is meta: comments about the Jynx     */
/* dev-tool overlay itself (the FAB, the toolbar, the admin panel...),  */
/* meant to evolve Jynx into its own standalone product later. Only the */
/* admin can write to it (no per-person dev-user roster for this one).  */
/* Whether an entry queues as an action is the admin's explicit choice  */
/* (the same "will send as action" toggle already used for admin QA     */
/* notes) — it's not implicitly always-on, so a plain comment about     */
/* Jynx can be left without it turning into an automated work item.     */
/* ================================================================== */

import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { requireAdmin } from "../middleware/adminAuth.js";
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

router.post("/admin/jynx-feedback", requireAdmin, asyncRoute(async (req, res) => {
  requireFields(req.body, ["comment"]);
  const secondaryTargets = Array.isArray(req.body.secondaryTargets)
    ? req.body.secondaryTargets.filter((t) => typeof t === "string" && t.trim()).slice(0, 10)
    : [];
  // ברירת מחדל דלוקה (תואם להתנהגות הקודמת) כשלא נשלח בכלל — אבל כפתור
  // "יישלח כפעולה" ב-AnnotationPopover.jsx נותן למנהל לכבות את זה מראש.
  const actionRequested = req.body.actionRequested === undefined ? true : !!req.body.actionRequested;
  const entry = {
    id: "jynx-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    createdAt: new Date().toISOString(),
    route: req.body.route || null, targetLabel: req.body.targetLabel || null, secondaryTargets,
    comment: req.body.comment, resolved: false, resolvedAt: null, resolutionNote: null,
    actionStatus: actionRequested ? "queued" : "none",
    actionRequestedAt: actionRequested ? new Date().toISOString() : null,
    actionPrUrl: null, actionLog: null,
    replies: [],
  };
  await persistNote(entry, `Jynx feedback (${entry.route || "?"}) — ${entry.targetLabel || "?"}`);
  if (actionRequested) await queueAction(entry);
  res.status(201).json({ ok: true });
}));

router.get("/admin/jynx-feedback", requireAdmin, (_req, res) => {
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
    actionStatus: resolved && found.actionStatus && found.actionStatus !== "none" ? "done" : found.actionStatus,
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

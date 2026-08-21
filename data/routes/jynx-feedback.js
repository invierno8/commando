/* ================================================================== */
/* Jynx's OWN feedback queue — completely separate from                */
/* data/annotations/{notes,actions}/, which is QA feedback about the    */
/* underlying HANGAR app. This one is meta: comments about the Jynx     */
/* dev-tool overlay itself (the FAB, the toolbar, the admin panel...),  */
/* meant to evolve Jynx into its own standalone product later. Only the */
/* admin can write to it (no per-person dev-user roster for this one),  */
/* so every entry is auto-queued as an action — same "everything I      */
/* write becomes an action" rule already used for admin QA notes.       */
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
  const entry = {
    id: "jynx-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    createdAt: new Date().toISOString(),
    route: req.body.route || null, targetLabel: req.body.targetLabel || null, secondaryTargets,
    comment: req.body.comment, resolved: false, resolvedAt: null,
    actionStatus: "queued", actionRequestedAt: new Date().toISOString(),
    actionPrUrl: null, actionLog: null,
  };
  await persistNote(entry, `Jynx feedback (${entry.route || "?"}) — ${entry.targetLabel || "?"}`);
  await queueAction(entry);
  res.status(201).json({ ok: true });
}));

router.get("/admin/jynx-feedback", requireAdmin, (_req, res) => {
  res.json(readAll());
});

router.patch("/admin/jynx-feedback/:id", requireAdmin, asyncRoute(async (req, res) => {
  const found = readAll().find((a) => a.id === req.params.id);
  if (!found) return res.json(null);
  const updated = {
    ...found,
    resolved: !!req.body.resolved,
    resolvedAt: req.body.resolved ? new Date().toISOString() : null,
  };
  await persistNote(updated, `Jynx feedback ${updated.resolved ? "resolved" : "reopened"} — ${updated.id}`);
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
    const files = await listDirFromGithub(githubDir);
    for (const f of files) {
      const remote = await readFileFromGithub(`${githubDir}/${f}`);
      if (remote) fs.writeFileSync(path.join(dir, f), remote.content);
    }
  }
}

export default router;

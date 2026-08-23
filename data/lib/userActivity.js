/* ================================================================== */
/* One dev user's activity across BOTH note queues (QA notes about the  */
/* underlying app, and Jynx-meta feedback about the dev tool itself) —  */
/* backs UserProfileCard.jsx. Reads its own copy of both directories    */
/* rather than importing readAll() from annotations.js/jynx-feedback.js */
/* — this repo's routes/ modules are each independent on purpose (see   */
/* the "no cross-importing between route files" note at the top of     */
/* jynx-feedback.js), so a small duplicated directory-read here follows */
/* the same convention instead of breaking it.                          */
/*                                                                      */
/* Reactions have no per-reaction timestamp in the data model (just an  */
/* emoji -> [devUserId] map on the note) — a reaction activity item     */
/* falls back to the note's own createdAt, which is approximate but the */
/* only timestamp available without a schema change to every reaction   */
/* endpoint for a read-only activity view.                              */
/* ================================================================== */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NOTES_DIR = path.join(__dirname, "..", "annotations", "notes");
const JYNX_NOTES_DIR = path.join(__dirname, "..", "annotations", "jynx-notes");

function readDir(dir) {
  try {
    return fs.readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")));
  } catch {
    return [];
  }
}

export function buildUserActivity(devUserId) {
  const items = [];
  for (const [notes, kind] of [[readDir(NOTES_DIR), "app"], [readDir(JYNX_NOTES_DIR), "jynx"]]) {
    for (const note of notes) {
      if (note.authorId === devUserId) {
        items.push({
          type: "comment", kind, noteId: note.id, route: note.route, targetLabel: note.targetLabel,
          text: note.comment, createdAt: note.createdAt, resolved: !!note.resolved,
          actionStatus: note.actionStatus || "none", actionPrUrl: note.actionPrUrl || null,
        });
      }
      for (const reply of note.replies || []) {
        if (reply.authorId === devUserId) {
          items.push({
            type: "reply", kind, noteId: note.id, route: note.route, targetLabel: note.targetLabel,
            text: reply.text, createdAt: reply.createdAt, parentComment: note.comment,
          });
        }
      }
      for (const [emoji, ids] of Object.entries(note.reactions || {})) {
        if ((ids || []).includes(devUserId)) {
          items.push({
            type: "reaction", kind, noteId: note.id, route: note.route, targetLabel: note.targetLabel,
            emoji, text: note.comment, createdAt: note.createdAt,
          });
        }
      }
    }
  }
  items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return items;
}

/* ================================================================== */
/* @mentions — parsed from free reply text (same "the text is the       */
/* source of truth" convention as the [→ label] secondary-target        */
/* tokens in DevOverlay.jsx), not a separate picker UI that has to stay  */
/* in sync. Two things a reply's text can trigger:                      */
/*  1. @<name> matching an active dev user's name (spaces stripped,     */
/*     case-insensitive, first-name also matches) files them a          */
/*     notification — one JSON file per dev user under                  */
/*     data/annotations/mentions/<devUserId>.json, newest first.        */
/*  2. @jynx (reserved — never matches a real dev user) is handled       */
/*     separately by whichever route calls hasJynxMention(); it's not    */
/*     a notification, it's the trigger for re-queuing the note as a     */
/*     follow-up work item (see queueFollowUp in annotations.js /        */
/*     jynx-feedback.js).                                                */
/* ================================================================== */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { commitFileToGithub, githubPersistEnabled } from "./githubPersist.js";
import { readDevUsers } from "./devUsers.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(__dirname, "..", "annotations", "mentions");
const GITHUB_DIR = "data/annotations/mentions";
// גבול לכל משתמש — התראות ישנות מספיק נחתכות בשקט, זה עדיין רק תור-הודעות
// קטן, לא ארכיון שצריך לשמור לנצח.
const MAX_PER_USER = 200;

function readFor(devUserId) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DIR, `${devUserId}.json`), "utf8"));
  } catch {
    return [];
  }
}

async function writeFor(devUserId, list) {
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(path.join(DIR, `${devUserId}.json`), JSON.stringify(list, null, 2) + "\n");
  if (githubPersistEnabled()) {
    await commitFileToGithub(`${GITHUB_DIR}/${devUserId}.json`, JSON.stringify(list, null, 2) + "\n", `mentions update — ${devUserId}`);
  }
}

function normalize(s) {
  return s.toLowerCase().replace(/\s+/g, "");
}

// מחזיר את משתמשי-הפיתוח (רשומות מלאות) שהוזכרו בטקסט עם @שם — "jynx" אף
// פעם לא נספר כאן, גם אם קיים (בפועל אין) משתמש בשם הזה, כי הוא מילת-מפתח
// שמורה שמטופלת בנפרד על ידי hasJynxMention().
export function parseMentionedUsers(text) {
  const tokens = [...text.matchAll(/@([\p{L}\p{N}_]+)/gu)].map((m) => m[1]);
  if (!tokens.length) return [];
  const users = readDevUsers().filter((u) => u.active !== false);
  const matched = new Map();
  tokens.forEach((raw) => {
    const t = normalize(raw);
    if (t === "jynx") return;
    const user = users.find((u) => {
      const full = normalize(u.name);
      const first = normalize(u.name.split(/\s+/)[0]);
      return full === t || first === t;
    });
    if (user) matched.set(user.id, user);
  });
  return [...matched.values()];
}

export function hasJynxMention(text) {
  return /@jynx\b/i.test(text);
}

export async function addMention(devUserId, mention) {
  const list = readFor(devUserId);
  list.unshift({
    id: "mtn-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    read: false,
    createdAt: new Date().toISOString(),
    ...mention,
  });
  await writeFor(devUserId, list.slice(0, MAX_PER_USER));
}

export function readMentions(devUserId) {
  return readFor(devUserId);
}

export async function markMentionRead(devUserId, mentionId) {
  const list = readFor(devUserId);
  if (!list.some((m) => m.id === mentionId)) return null;
  await writeFor(devUserId, list.map((m) => (m.id === mentionId ? { ...m, read: true } : m)));
  return true;
}

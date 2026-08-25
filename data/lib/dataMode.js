/* ================================================================== */
/* LEGO BLOCK — the mock/live data-mode flag. A single global runtime   */
/* value, not per-session (see FORCLAUDE.md / plan doc for why): this   */
/* is a small internal demo tool, not a multi-tenant product.           */
/*                                                                      */
/* Persisted to config/data-mode.json so a server restart remembers     */
/* the last choice — that local file alone used to be the whole story,  */
/* which meant a deliberate switch to "live" silently reverted to       */
/* "mock" on the very next Render free-tier idle spin-down (its disk is */
/* wiped on every spin-down/redeploy, not just a fresh clone). Now also */
/* committed to GitHub, same lib/githubPersist.js pattern already used  */
/* by lib/annotationSettings.js for the identical reason — this is a    */
/* real admin choice worth surviving a restart, not throwaway state.    */
/* Local-only fallback (no GITHUB_TOKEN, e.g. local dev) still defaults */
/* to "mock" on a fresh clone, unchanged from before.                   */
/* ================================================================== */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFileFromGithub, commitFileToGithub, githubPersistEnabled } from "./githubPersist.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODE_FILE = path.join(__dirname, "..", "config", "data-mode.json");
const GITHUB_PATH = "data/config/data-mode.json";

let mode = null;

function load() {
  if (mode) return mode;
  try {
    const raw = JSON.parse(fs.readFileSync(MODE_FILE, "utf8"));
    mode = raw.mode === "live" ? "live" : "mock";
  } catch {
    mode = "mock";
  }
  return mode;
}

function writeLocal(next) {
  mode = next;
  try {
    fs.mkdirSync(path.dirname(MODE_FILE), { recursive: true });
    fs.writeFileSync(MODE_FILE, JSON.stringify({ mode: next }, null, 2));
  } catch {
    /* best effort — the in-memory value is still correct for this process */
  }
}

export function getMode() {
  return load();
}

export async function setMode(next) {
  const resolved = next === "live" ? "live" : "mock";
  writeLocal(resolved);
  if (githubPersistEnabled()) {
    await commitFileToGithub(GITHUB_PATH, JSON.stringify({ mode: resolved }, null, 2) + "\n", `data mode: ${resolved}`);
  }
  return resolved;
}

// נקרא פעם אחת בעליית השרת (ראו server.js) — מושך את הבחירה האחרונה מ-git
// לפני שהשרת עונה לבקשות, אותו טעם בדיוק כמו hydrateAnnotationSettingsFromGithub.
export async function hydrateDataModeFromGithub() {
  if (!githubPersistEnabled()) return;
  const remote = await readFileFromGithub(GITHUB_PATH);
  if (remote) writeLocal(JSON.parse(remote.content).mode === "live" ? "live" : "mock");
}

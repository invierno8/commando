/* ================================================================== */
/* LEGO BLOCK — the mock/live data-mode flag. A single global runtime   */
/* value, not per-session (see FORCLAUDE.md / plan doc for why): this   */
/* is a small internal demo tool, not a multi-tenant product.           */
/*                                                                      */
/* Persisted to config/data-mode.json so a server restart remembers     */
/* the last choice, but that file is gitignored and defaults to "mock"  */
/* here in code if it's absent — so a fresh clone/deploy always boots   */
/* showing the familiar demo content, matching the app's prior behavior.*/
/* ================================================================== */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODE_FILE = path.join(__dirname, "..", "config", "data-mode.json");

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

export function getMode() {
  return load();
}

export function setMode(next) {
  mode = next === "live" ? "live" : "mock";
  try {
    fs.mkdirSync(path.dirname(MODE_FILE), { recursive: true });
    fs.writeFileSync(MODE_FILE, JSON.stringify({ mode }, null, 2));
  } catch {
    /* best effort — the in-memory value is still correct for this process */
  }
  return mode;
}

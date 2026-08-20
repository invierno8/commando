/* ================================================================== */
/* LEGO BLOCK — the one chokepoint every route goes through to read/    */
/* write data. Resolves against mock or live storage depending on the   */
/* current data mode (see dataMode.js):                                 */
/*                                                                      */
/*  - mock: data/mock/<relPath> loads into an in-process clone once per */
/*    process (or since the last reset — see resetMockCache), and every */
/*    write only mutates that clone. Disk is never touched, so a demo   */
/*    session can never corrupt the checked-in seed files.              */
/*  - live: real disk I/O against data/db/<relPath>, created lazily     */
/*    with a default empty value the first time it's touched — this is  */
/*    what "the system starts empty" means concretely. Writes to the    */
/*    same file are serialized through a small per-file queue so two    */
/*    overlapping requests can't tear the JSON.                         */
/* ================================================================== */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getMode } from "./dataMode.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_ROOT = path.join(__dirname, "..");
const MOCK_ROOT = path.join(DATA_ROOT, "mock");
const DB_ROOT = path.join(DATA_ROOT, "db");

const mockCache = new Map();
const writeQueues = new Map();

function readDiskJson(absPath, defaultValue) {
  try {
    return JSON.parse(fs.readFileSync(absPath, "utf8"));
  } catch {
    return defaultValue;
  }
}

function writeDiskJson(absPath, value) {
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, JSON.stringify(value, null, 2));
}

// relPath - למשל "brigades.json" או "brigade-data/brg-commando.json".
// defaultValue מוחזר (ולא נכתב לדיסק אוטומטית) אם הקובץ עדיין לא קיים —
// כתיבה בפועל קורית רק דרך writeCollection, כדי שקריאה בלבד לעולם לא
// "תיצור" בטעות רשומה חדשה וריקה.
export function readCollection(relPath, defaultValue) {
  const mode = getMode();
  if (mode === "mock") {
    if (!mockCache.has(relPath)) {
      mockCache.set(relPath, readDiskJson(path.join(MOCK_ROOT, relPath), defaultValue));
    }
    return mockCache.get(relPath);
  }
  return readDiskJson(path.join(DB_ROOT, relPath), defaultValue);
}

export async function writeCollection(relPath, value) {
  const mode = getMode();
  if (mode === "mock") {
    mockCache.set(relPath, value);
    return value;
  }
  const prev = writeQueues.get(relPath) || Promise.resolve();
  const next = prev.then(() => writeDiskJson(path.join(DB_ROOT, relPath), value));
  writeQueues.set(relPath, next);
  await next;
  return value;
}

// מרוקן את מטמון ה-mock — נקרא כשעוברים ל-mock (ראו routes/dev-data-mode.js),
// כדי שכל מעבר ל"הדגמה" יתחיל תמיד מהזרע המקורי, לא ימשיך ממצב session קודם.
export function resetMockCache() {
  mockCache.clear();
}

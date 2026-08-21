/* ================================================================== */
/* LEGO BLOCK — the one chokepoint every route goes through to read/    */
/* write data. Resolves against mock or live storage depending on the   */
/* current data mode (see dataMode.js):                                 */
/*                                                                      */
/*  - mock: data/mock/<relPath> loads into an in-process clone once per */
/*    process (or since the last reset — see resetMockCache), and every */
/*    write mutates that clone. LOCAL disk is never touched by a write  */
/*    (a demo session on your own machine can never dirty the checked-  */
/*    in seed files) — but if GITHUB_TOKEN is set (i.e. this is the     */
/*    real deployed instance), every write is ALSO committed straight   */
/*    to data/mock/<relPath> in the real repo. That's deliberate: a     */
/*    real user opening a ticket or requesting a catalog item in "demo" */
/*    mode should not lose that the moment Render's free tier spins the */
/*    instance down — the system stays operative even though it's      */
/*    still labeled "mock". hydrateMockDataFromGithub() below pulls the */
/*    latest committed state back down at boot, same pattern as         */
/*    dev-users.json/annotations.                                       */
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
import { commitFileToGithub, githubPersistEnabled, listDirFromGithub, readFileFromGithub } from "./githubPersist.js";

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
    if (githubPersistEnabled()) {
      // גם דיסק מקומי (לא רק git) — כדי ש-resetMockCache (מעבר mock/live/mock
      // תוך כדי ריצה) לא "ישכח" מה שכבר נכתב לפני שהעליית-שרת הבאה בכלל קרתה.
      writeDiskJson(path.join(MOCK_ROOT, relPath), value);
      await commitFileToGithub(`data/mock/${relPath}`, JSON.stringify(value, null, 2) + "\n", `mock data update — ${relPath}`);
    }
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

// נקרא פעם אחת בעליית השרת — מושך את כל data/mock/* מ-git לפני שהשרת עונה
// לבקשות, כי דיסק זול (Render free tier) מתאפס בכל spin-down/redeploy אבל
// git לא. בלי GITHUB_TOKEN זו פעולה ריקה (dev מקומי ממשיך לקרוא את הזרע
// הסטטי שכבר בעץ ה-git הרגיל, בדיוק כמו היום).
const MOCK_TOP_LEVEL_FILES = [
  "admin.json", "blocks.json", "brigades.json", "drafts.json",
  "notifications.json", "teams.json", "user-prefs.json",
];

export async function hydrateMockDataFromGithub() {
  if (!githubPersistEnabled()) return;

  for (const relPath of MOCK_TOP_LEVEL_FILES) {
    const remote = await readFileFromGithub(`data/mock/${relPath}`);
    if (remote) writeDiskJson(path.join(MOCK_ROOT, relPath), JSON.parse(remote.content));
  }

  const brigadeFiles = await listDirFromGithub("data/mock/brigade-data");
  for (const f of brigadeFiles) {
    const remote = await readFileFromGithub(`data/mock/brigade-data/${f}`);
    if (remote) writeDiskJson(path.join(MOCK_ROOT, "brigade-data", f), JSON.parse(remote.content));
  }
}

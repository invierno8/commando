// גישה לקובץ data/config/dev-users.json — נפרד מ-jsonStore.js בכוונה: זה
// קונפיג (מי רשאי להתחבר), לא דאטה תפעולית מדומה/live, ולכן לא כפוף
// לחלוקת mock/live. עכשיו גם מגובה ב-git (ראו githubPersist.js) — כתיבה
// כאן מתעדכנת מקומית מיד וגם נשלחת כ-commit, כדי שהמרשם ישרוד גם אירוח
// עם דיסק זמני (Render free tier וכו') בלי צורך בתוכנית בתשלום.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFileFromGithub, commitFileToGithub, githubPersistEnabled } from "./githubPersist.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, "..", "config", "dev-users.json");
const GITHUB_PATH = "data/config/dev-users.json";

export function readDevUsers() {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return [];
  }
}

function writeLocal(list) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(list, null, 2) + "\n");
}

export async function writeDevUsers(list) {
  writeLocal(list);
  if (githubPersistEnabled()) {
    await commitFileToGithub(GITHUB_PATH, JSON.stringify(list, null, 2) + "\n", `dev-users: ${list.length} total`);
  }
}

// נקרא פעם אחת בעליית השרת — מחזיר את המרשם האמיתי מ-git לפני שהשרת מתחיל
// לענות לבקשות, כי הדיסק המקומי עלול להתאפס (redeploy/spin-down) בלי ש-git
// ישתנה. ללא GITHUB_TOKEN זו פעולה ריקה — הקובץ המקומי (שקיים ב-repo מלכתחילה) פשוט משמש כרגיל.
export async function hydrateDevUsersFromGithub() {
  if (!githubPersistEnabled()) return;
  const remote = await readFileFromGithub(GITHUB_PATH);
  if (remote) writeLocal(JSON.parse(remote.content));
}

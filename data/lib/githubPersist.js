/* ================================================================== */
/* LEGO BLOCK — GitHub-as-database. Instead of paying for a hosting      */
/* tier with a persistent disk, dev-users.json and every QA annotation   */
/* are committed straight to this repo via the GitHub Contents API.      */
/* Render's free tier wipes the local filesystem on every idle           */
/* spin-down/redeploy — that's fine, because the real copy lives in git, */
/* and this module re-hydrates the local disk from git on every boot.    */
/*                                                                      */
/* Deliberately simple, matching the actual stakes here (a public demo   */
/* repo with no real military data, low-value comment text, not a       */
/* security-sensitive system): commits go straight to `main`, no PR      */
/* flow, no conflict-resolution beyond "one file per annotation" making  */
/* concurrent submissions land as distinct files instead of colliding.   */
/*                                                                      */
/* GITHUB_TOKEN is optional — if unset (the common case in local dev),   */
/* every function here is a no-op and callers fall back to local-disk-   */
/* only behavior, exactly like before this existed.                     */
/* ================================================================== */

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO || "joshuael120/commando";
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || "main";
const API_BASE = `https://api.github.com/repos/${GITHUB_REPO}/contents`;

export function githubPersistEnabled() {
  return !!GITHUB_TOKEN;
}

function headers() {
  return {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  };
}

// path יחסי לשורש הריפו, למשל "data/annotations/notes/ann-123.json".
export async function readFileFromGithub(path) {
  if (!GITHUB_TOKEN) return null;
  const res = await fetch(`${API_BASE}/${path}?ref=${GITHUB_BRANCH}`, { headers: headers() });
  if (!res.ok) return null;
  const json = await res.json();
  return { content: Buffer.from(json.content, "base64").toString("utf8"), sha: json.sha };
}

export async function listDirFromGithub(path) {
  if (!GITHUB_TOKEN) return [];
  const res = await fetch(`${API_BASE}/${path}?ref=${GITHUB_BRANCH}`, { headers: headers() });
  if (!res.ok) return [];
  const json = await res.json();
  return Array.isArray(json) ? json.filter((f) => f.type === "file").map((f) => f.name) : [];
}

// יוצר/מעדכן קובץ יחיד. עדכון קובץ קיים דורש את ה-sha הנוכחי שלו (מתקבל
// אוטומטית כאן) — כך ה-API של GitHub יודע שזו התאמה מודעת, לא דריסה עיוורת.
export async function commitFileToGithub(path, contentString, message) {
  if (!GITHUB_TOKEN) return false;
  const existing = await readFileFromGithub(path);
  const res = await fetch(`${API_BASE}/${path}`, {
    method: "PUT",
    headers: headers(),
    body: JSON.stringify({
      message,
      content: Buffer.from(contentString, "utf8").toString("base64"),
      branch: GITHUB_BRANCH,
      ...(existing ? { sha: existing.sha } : {}),
    }),
  });
  return res.ok;
}

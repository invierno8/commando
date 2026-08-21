/* ================================================================== */
/* LEGO BLOCK — the one shared fetch wrapper every api-client module    */
/* goes through. In production, client/ and data/ sit on two different  */
/* domains (GitHub Pages + Render) — modern browsers (Safari by default,*/
/* Chrome increasingly) block third-party cookies on cross-site fetch() */
/* no matter the server's SameSite config, so dev/admin sessions travel */
/* as a Bearer token + localStorage instead of a cookie (see            */
/* devtools/devApi.js for where the token gets stored on login).        */
/* VITE_API_BASE_URL points at wherever data/ is actually hosted — set  */
/* it as a build-time env var, nothing in this file needs to change.    */
/* ================================================================== */

const DEV_TOKEN_KEY = "hangar_dev_token";
const ADMIN_TOKEN_KEY = "hangar_admin_token";

function storageGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function storageSet(key, value) {
  try { value ? localStorage.setItem(key, value) : localStorage.removeItem(key); } catch { /* private browsing / storage disabled */ }
}

export const setDevToken = (token) => storageSet(DEV_TOKEN_KEY, token);
export const setAdminToken = (token) => storageSet(ADMIN_TOKEN_KEY, token);

function authHeaders() {
  const headers = {};
  const devToken = storageGet(DEV_TOKEN_KEY);
  const adminToken = storageGet(ADMIN_TOKEN_KEY);
  if (devToken) headers["Authorization"] = `Bearer ${devToken}`;
  if (adminToken) headers["X-Admin-Session"] = adminToken;
  return headers;
}

/* גיבוי קשיח: אם VITE_API_BASE_URL לא הוזרק בזמן ה-build (למשל בעיית scope    */
/* במשתני GitHub Actions), אבל אנחנו בפועל רצים מ-GitHub Pages, עדיף לפנות   */
/* לכתובת ה-Render הידועה מאשר ליפול חזרה ל-"/api" היחסי שלעולם לא יעבוד שם. */
const RENDER_API_BASE = "https://hangar-data.onrender.com/api";
const isGithubPages = typeof window !== "undefined" && window.location.hostname.endsWith("github.io");
const API_BASE = import.meta.env.VITE_API_BASE_URL || (isGithubPages ? RENDER_API_BASE : "/api");

async function request(path, { method = "GET", body } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: "include",
    headers: { ...authHeaders(), ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* תגובה ריקה (למשל 204) — נשאר null */
  }
  if (!res.ok) {
    throw new Error(data?.error || `שגיאת שרת (${res.status})`);
  }
  return data;
}

export const http = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: "POST", body: body ?? {} }),
  put: (path, body) => request(path, { method: "PUT", body: body ?? {} }),
  patch: (path, body) => request(path, { method: "PATCH", body: body ?? {} }),
  delete: (path) => request(path, { method: "DELETE" }),
  // עבור endpoint יחיד שמחזיר טקסט/Markdown, לא JSON (ראו annotations export).
  getText: async (path) => {
    const res = await fetch(`${API_BASE}${path}`, { credentials: "include", headers: authHeaders() });
    if (!res.ok) throw new Error(`שגיאת שרת (${res.status})`);
    return res.text();
  },
};

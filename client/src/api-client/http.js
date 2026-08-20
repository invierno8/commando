/* ================================================================== */
/* LEGO BLOCK — the one shared fetch wrapper every api-client module    */
/* goes through. In dev, requests to "/api/..." are same-origin thanks  */
/* to the Vite proxy in vite.config.js, so cookies (dev-session,        */
/* admin-session) work with zero CORS setup. In a production build,     */
/* VITE_API_BASE_URL points at wherever data/ is actually hosted (see   */
/* the "Public hosting" section of the architecture plan) — set it as   */
/* a build-time env var, nothing in this file needs to change.          */
/* ================================================================== */

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

async function request(path, { method = "GET", body } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: "include",
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
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
    const res = await fetch(`${API_BASE}${path}`, { credentials: "include" });
    if (!res.ok) throw new Error(`שגיאת שרת (${res.status})`);
    return res.text();
  },
};

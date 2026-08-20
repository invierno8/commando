// אפשרויות עוגיית סשן משותפות — dev ו-admin. CROSS_SITE נשלט דרך משתנה
// סביבה כי ברירת המחדל (same-origin, דרך פרוקסי Vite בפיתוח) שונה מהמצב
// האמיתי בפרודקשן (client/ ו-data/ על שני דומיינים נפרדים — ראו "Public
// hosting" בתוכנית הארכיטקטורה: sameSite:"none"+secure חובה אז).
const CROSS_SITE = process.env.COOKIE_CROSS_SITE === "true";

export function sessionCookieOptions(maxAgeMs) {
  return {
    httpOnly: true,
    sameSite: CROSS_SITE ? "none" : "lax",
    secure: CROSS_SITE || process.env.NODE_ENV === "production",
    maxAge: maxAgeMs,
  };
}

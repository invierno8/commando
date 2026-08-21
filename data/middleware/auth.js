import { resolveSession } from "../lib/sessions.js";

// שער האימות היחיד ל"משתמש פיתוח" — הנקודה היחידה בכל הקוד שקוראת את
// טוקן הסשן; כל route אחר תמיד קורא רק את req.devUser. זה מה שהופך את
// ההחלפה ל-SSO אמיתי (OpenID) בעתיד לשינוי מידלוור אחד, לא route-by-route.
//
// מועבר ב-Authorization: Bearer, לא בעוגייה — client/ ו-data/ יושבים על שני
// דומיינים נפרדים בפרודקשן (GitHub Pages + Render), ודפדפנים מודרניים
// (בעיקר Safari, ובהדרגה גם Chrome) חוסמים עוגיות צד-שלישי (SameSite=None)
// מבקשות fetch() חוצות-דומיין ללא קשר להגדרות השרת — לא ניתן לתיקון דרך
// COOKIE_CROSS_SITE. הדפדפן לא חוסם כותרות/localStorage באותו אופן.
export function attachDevUser(req, _res, next) {
  const auth = req.headers.authorization;
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  const token = bearer || req.cookies?.hangar_dev_session;
  req.devUser = resolveSession(token) || null;
  next();
}

export function requireDevUser(req, res, next) {
  if (!req.devUser) return res.status(401).json({ error: "לא מחובר/ת למצב פיתוח" });
  next();
}

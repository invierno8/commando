import { resolveSession } from "../lib/sessions.js";

// שער האימות היחיד ל"משתמש פיתוח" — הנקודה היחידה בכל הקוד שקוראת את
// עוגיית hangar_dev_session; כל route אחר תמיד קורא רק את req.devUser.
// זה מה שהופך את ההחלפה ל-SSO אמיתי (OpenID) בעתיד לשינוי מידלוור אחד,
// לא שינוי route-by-route בכל ה-API.
export function attachDevUser(req, _res, next) {
  const token = req.cookies?.hangar_dev_session;
  req.devUser = resolveSession(token) || null;
  next();
}

export function requireDevUser(req, res, next) {
  if (!req.devUser) return res.status(401).json({ error: "לא מחובר/ת למצב פיתוח" });
  next();
}
